use clap::{Parser, ValueEnum};
use judge_sandbox::{JudgeWorkerPool, api, queue::redis::RedisConsumer};
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

#[derive(Debug, Clone, ValueEnum)]
enum RunMode {
    /// Run only the HTTP/WebSocket REST gateway
    Server,
    /// Run only the Redis Streams worker daemon
    Worker,
    /// Run both API server and local worker pool
    All,
}

#[derive(Parser, Debug)]
#[command(name = "Judge Sandbox")]
#[command(about = "High-performance online judge executor with Rust")]
struct Args {
    /// Runtime mode: server, worker, or all
    #[arg(long, env = "JUDGE_MODE", value_enum, default_value = "all")]
    mode: RunMode,

    /// HTTP server port
    #[arg(long, env = "JUDGE_PORT", default_value = "8080")]
    port: u16,

    /// Number of worker threads (auto-detect if not set)
    #[arg(long, env = "JUDGE_WORKERS")]
    workers: Option<usize>,

    /// Redis connection string for queue consumer
    #[arg(long, env = "JUDGE_REDIS", default_value = "redis://127.0.0.1:6379")]
    redis: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let (pool, receiver) = JudgeWorkerPool::new(args.workers);
    let pool = Arc::new(pool);

    match args.mode {
        RunMode::Server => {
            tracing::info!("Starting Judge Sandbox in SERVER mode on port {}", args.port);
            run_server(pool, receiver, args.port).await?;
        }
        RunMode::Worker => {
            tracing::info!("Starting Judge Sandbox in WORKER mode (Redis consumer)");
            run_worker(pool, receiver, &args.redis).await?;
        }
        RunMode::All => {
            tracing::info!("Starting Judge Sandbox in ALL mode (server + worker pool)");
            run_all(pool, receiver, args.port, &args.redis).await?;
        }
    }

    Ok(())
}

async fn run_server(
    pool: Arc<JudgeWorkerPool>,
    receiver: tokio::sync::mpsc::UnboundedReceiver<judge_sandbox::JobEnvelope>,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    // Spawn worker tasks
    let pool_workers = pool.clone();
    tokio::spawn(async move {
        pool_workers.run_workers(receiver).await;
    });

    // Start HTTP server
    let router = api::create_router(pool);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;

    tracing::info!("HTTP server listening on port {}", port);
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn run_worker(
    pool: Arc<JudgeWorkerPool>,
    receiver: tokio::sync::mpsc::UnboundedReceiver<judge_sandbox::JobEnvelope>,
    redis_url: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Spawn worker tasks for local processing
    let pool_workers = pool.clone();
    tokio::spawn(async move {
        pool_workers.run_workers(receiver).await;
    });

    // Start Redis consumer
    let consumer = RedisConsumer::new(redis_url.to_string(), pool, None, None);
    consumer.run().await?;

    Ok(())
}

async fn run_all(
    pool: Arc<JudgeWorkerPool>,
    receiver: tokio::sync::mpsc::UnboundedReceiver<judge_sandbox::JobEnvelope>,
    port: u16,
    redis_url: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Spawn worker tasks
    let pool_workers = pool.clone();
    tokio::spawn(async move {
        pool_workers.run_workers(receiver).await;
    });

    // Start HTTP server
    let pool_http = pool.clone();
    tokio::spawn(async move {
        let router = api::create_router(pool_http);
        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
            .await
            .expect("Failed to bind HTTP listener");
        tracing::info!("HTTP server listening on port {}", port);
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown_signal())
            .await;
    });

    // Start Redis consumer
    let consumer = RedisConsumer::new(redis_url.to_string(), pool, None, None);
    consumer.run().await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received CTRL+C, shutting down...");
        }
        _ = terminate => {
            tracing::info!("Received SIGTERM, shutting down...");
        }
    }
}
