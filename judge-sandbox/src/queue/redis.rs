use redis::{streams::StreamReadOptions, Commands};
use std::sync::Arc;
use std::error::Error;
use crate::orchestrator::{JobRequest, JudgeWorkerPool};

pub struct RedisConsumer {
    redis_url: String,
    pool: Arc<JudgeWorkerPool>,
    stream_key: String,
    consumer_group: String,
    consumer_name: String,
}

impl RedisConsumer {
    pub fn new(
        redis_url: String,
        pool: Arc<JudgeWorkerPool>,
        stream_key: Option<String>,
        consumer_group: Option<String>,
    ) -> Self {
        Self {
            redis_url,
            pool,
            stream_key: stream_key.unwrap_or_else(|| "judge:jobs".to_string()),
            consumer_group: consumer_group.unwrap_or_else(|| "judge_workers".to_string()),
            consumer_name: format!("worker-{}", uuid::Uuid::new_v4()),
        }
    }

    pub async fn run(&self) -> Result<(), Box<dyn Error>> {
        let client = redis::Client::open(self.redis_url.as_str())?;
        let mut con = client.get_connection()?;

        // Create consumer group if it doesn't exist
        let _: Result<(), _> = con.xgroup_create(&self.stream_key, &self.consumer_group, "$");
        // Ignore BUSYGROUP errors

        tracing::info!(
            "Redis consumer started: {} on group {} as {}",
            self.stream_key,
            self.consumer_group,
            self.consumer_name
        );

        loop {
            // Read messages from consumer group
            let opts = StreamReadOptions::default()
                .count(10)
                .block(2000);

            let response: Result<Vec<(String, Vec<(String, Vec<(String, String)>)>)>, _> =
                con.xread_options(&[&self.stream_key], &[">"], &opts);

            match response {
                Ok(messages) => {
                    for (_, stream_messages) in messages {
                        for (msg_id, fields) in stream_messages {
                            // Parse job from Redis fields
                            let mut job_data = std::collections::HashMap::new();
                            for (key, value) in fields {
                                job_data.insert(key, value);
                            }

                            // Try to deserialize as JobRequest
                            if let Some(job_json) = job_data.get("job") {
                                match serde_json::from_str::<JobRequest>(job_json) {
                                    Ok(request) => {
                                        tracing::info!("Processing job {} from Redis", request.job_id);

                                        // Execute job
                                        match self.pool.submit(request.clone(), None).await {
                                            Ok(result) => {
                                                // Write result back to Redis
                                                let result_key = format!("judge:results:{}", request.job_id);
                                                let result_json = serde_json::to_string(&result).unwrap_or_default();
                                                let _: Result<(), _> =
                                                    con.set_ex(&result_key, result_json, 86400); // 24h TTL

                                                // Acknowledge message
                                                let _: Result<(), _> =
                                                    con.xack(&self.stream_key, &self.consumer_group, &[msg_id]);

                                                tracing::info!("Job {} completed and result stored", request.job_id);
                                            }
                                            Err(e) => {
                                                tracing::error!("Job {} failed: {}", request.job_id, e);
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        tracing::error!("Failed to parse job from Redis: {}", e);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    // NOGROUP or other errors
                    tracing::debug!("Redis read error (may be NOGROUP on first run): {}", e);
                    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                }
            }
        }
    }
}
