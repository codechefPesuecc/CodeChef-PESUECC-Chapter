pub mod redis;

use std::error::Error;

#[async_trait::async_trait]
pub trait QueueConsumer: Send + Sync {
    async fn start(&self) -> Result<(), Box<dyn Error>>;
}
