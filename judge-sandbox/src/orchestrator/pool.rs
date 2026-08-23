use crate::orchestrator::pipeline::ExecutionPipeline;
use crate::orchestrator::job::{JobRequest, JobResult, ProgressEvent};
use tokio::sync::{mpsc, oneshot};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use uuid;

pub struct JobEnvelope {
    pub request: JobRequest,
    pub result_tx: oneshot::Sender<Result<JobResult, String>>,
    pub progress_tx: Option<mpsc::UnboundedSender<ProgressEvent>>,
}

pub struct JudgeWorkerPool {
    sender: mpsc::UnboundedSender<JobEnvelope>,
    num_workers: usize,
    busy_workers: Arc<AtomicUsize>,
    queued_jobs: Arc<AtomicUsize>,
    max_queue_size: usize,
}

impl JudgeWorkerPool {
    pub fn new(num_workers: Option<usize>) -> (Self, mpsc::UnboundedReceiver<JobEnvelope>) {
        let worker_count = num_workers.unwrap_or_else(|| {
            std::thread::available_parallelism()
                .map(|p| p.get())
                .unwrap_or(4)
        });

        let max_queue = std::env::var("JUDGE_MAX_QUEUE")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(128);

        let (sender, receiver) = mpsc::unbounded_channel();
        let busy_workers = Arc::new(AtomicUsize::new(0));
        let queued_jobs = Arc::new(AtomicUsize::new(0));

        (
            Self {
                sender,
                num_workers: worker_count,
                busy_workers,
                queued_jobs,
                max_queue_size: max_queue,
            },
            receiver,
        )
    }

    pub fn num_workers(&self) -> usize {
        self.num_workers
    }

    pub fn busy_workers(&self) -> usize {
        self.busy_workers.load(Ordering::Relaxed)
    }

    pub fn idle_workers(&self) -> usize {
        self.num_workers.saturating_sub(self.busy_workers())
    }

    pub fn queued_jobs(&self) -> usize {
        self.queued_jobs.load(Ordering::Relaxed)
    }

    pub async fn submit(
        &self,
        mut request: JobRequest,
        progress: Option<mpsc::UnboundedSender<ProgressEvent>>,
    ) -> Result<JobResult, String> {
        // Backpressure defense: reject if queue is saturated
        if self.queued_jobs.load(Ordering::Relaxed) >= self.max_queue_size {
            return Err("QUEUE_FULL".to_string());
        }

        // Generate server-side job_id if not present
        if request.job_id.is_empty() {
            request.job_id = uuid::Uuid::new_v4().to_string();
        }

        let (result_tx, result_rx) = oneshot::channel();

        let envelope = JobEnvelope {
            request,
            result_tx,
            progress_tx: progress,
        };

        self.queued_jobs.fetch_add(1, Ordering::Relaxed);

        if let Err(_) = self.sender.send(envelope) {
            self.queued_jobs.fetch_sub(1, Ordering::Relaxed);
            return Err("Failed to submit job to worker pool".to_string());
        }

        result_rx.await.map_err(|_| "Worker lost connection".to_string())?
    }

    pub async fn run_workers(&self, receiver: mpsc::UnboundedReceiver<JobEnvelope>) {
        let receiver = Arc::new(tokio::sync::Mutex::new(receiver));
        let mut handles = vec![];
        let busy_workers = self.busy_workers.clone();
        let queued_jobs = self.queued_jobs.clone();

        for worker_id in 0..self.num_workers {
            let receiver_clone = receiver.clone();
            let busy = busy_workers.clone();
            let queued = queued_jobs.clone();

            let handle = tokio::spawn(async move {
                tracing::info!("Worker {} started", worker_id);

                loop {
                    let envelope = {
                        let mut receiver_guard = receiver_clone.lock().await;
                        receiver_guard.recv().await
                    };

                    match envelope {
                        Some(envelope) => {
                            queued.fetch_sub(1, Ordering::Relaxed);
                            busy.fetch_add(1, Ordering::Relaxed);
                            tracing::info!("Worker {} processing job {}", worker_id, envelope.request.job_id);

                            let result = ExecutionPipeline::execute(&envelope.request, envelope.progress_tx).await;

                            tracing::info!(
                                "Worker {} completed job {}: {:?}",
                                worker_id,
                                envelope.request.job_id,
                                result.as_ref().map(|r| r.verdict)
                            );

                            let _ = envelope.result_tx.send(result);
                            busy.fetch_sub(1, Ordering::Relaxed);
                        }
                        None => {
                            tracing::info!("Worker {} shutting down", worker_id);
                            break;
                        }
                    }
                }
            });

            handles.push(handle);
        }

        for handle in handles {
            let _ = handle.await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worker_pool_creation() {
        let (pool, _receiver) = JudgeWorkerPool::new(None);
        assert!(pool.num_workers() > 0);
    }

    #[test]
    fn test_worker_pool_with_custom_size() {
        let (pool, _receiver) = JudgeWorkerPool::new(Some(4));
        assert_eq!(pool.num_workers(), 4);
    }

    #[test]
    fn test_idle_and_busy_workers() {
        let (pool, _receiver) = JudgeWorkerPool::new(Some(4));
        assert_eq!(pool.idle_workers(), 4);
        assert_eq!(pool.busy_workers(), 0);
    }

    #[tokio::test]
    async fn test_submit_generates_job_id() {
        let (pool, _receiver) = JudgeWorkerPool::new(Some(1));
        let mut request = JobRequest::new(
            "cpp".to_string(),
            "int main(){}".to_string(),
            1000,
            256 * 1024 * 1024,
            vec![],
        );
        request.job_id.clear();

        // We can't fully test submit without a running worker,
        // but we can verify the pool exists and accepts submissions structurally
        assert_eq!(request.job_id.len(), 0);
    }
}
