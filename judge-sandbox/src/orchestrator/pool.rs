use crate::orchestrator::pipeline::ExecutionPipeline;
use crate::orchestrator::job::JobRequest;
use tokio::sync::mpsc;
use std::sync::Arc;

pub struct JudgeWorkerPool {
    sender: mpsc::UnboundedSender<JobRequest>,
    num_workers: usize,
}

impl JudgeWorkerPool {
    pub fn new(num_workers: Option<usize>) -> (Self, mpsc::UnboundedReceiver<JobRequest>) {
        let worker_count = num_workers.unwrap_or_else(|| {
            std::thread::available_parallelism()
                .map(|p| p.get())
                .unwrap_or(4)
        });

        let (sender, receiver) = mpsc::unbounded_channel();

        (
            Self {
                sender,
                num_workers: worker_count,
            },
            receiver,
        )
    }

    pub fn num_workers(&self) -> usize {
        self.num_workers
    }

    pub fn submit(&self, job: JobRequest) -> Result<(), JobRequest> {
        self.sender.send(job).map_err(|e| e.0)
    }

    pub async fn run_workers(&self, receiver: mpsc::UnboundedReceiver<JobRequest>) {
        let receiver = Arc::new(tokio::sync::Mutex::new(receiver));
        let mut handles = vec![];

        for worker_id in 0..self.num_workers {
            let receiver_clone = receiver.clone();

            let handle = tokio::spawn(async move {
                tracing::info!("Worker {} started", worker_id);

                loop {
                    let job = {
                        let mut receiver_guard = receiver_clone.lock().await;
                        receiver_guard.recv().await
                    };

                    match job {
                        Some(job) => {
                            tracing::info!("Worker {} processing job {}", worker_id, job.job_id);

                            match ExecutionPipeline::execute(&job).await {
                                Ok(result) => {
                                    tracing::info!(
                                        "Worker {} completed job {}: {:?}",
                                        worker_id,
                                        job.job_id,
                                        result.verdict
                                    );
                                }
                                Err(e) => {
                                    tracing::error!("Worker {} error on job {}: {}", worker_id, job.job_id, e);
                                }
                            }
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
}
