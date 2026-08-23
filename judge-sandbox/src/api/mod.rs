pub mod handlers;
pub mod websocket;

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::orchestrator::JudgeWorkerPool;

pub struct ApiState {
    pub pool: Arc<JudgeWorkerPool>,
}

pub fn create_router(pool: Arc<JudgeWorkerPool>) -> Router {
    let state = ApiState { pool };

    Router::new()
        .route("/api/v1/submit", post(handlers::submit))
        .route("/api/v1/ws/execute", get(websocket::handle_websocket))
        .route("/health", get(handlers::health))
        .layer(axum::extract::DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(Arc::new(state))
}
