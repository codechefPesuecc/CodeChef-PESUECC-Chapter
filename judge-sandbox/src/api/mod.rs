pub mod handlers;
pub mod websocket;

use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{Json, Response},
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::orchestrator::JudgeWorkerPool;

pub struct ApiState {
    pub pool: Arc<JudgeWorkerPool>,
    pub secret: Option<String>,
}

async fn auth_middleware(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    if let Some(expected_secret) = &state.secret {
        let provided = headers
            .get("x-judge-secret")
            .and_then(|v| v.to_str().ok())
            .or_else(|| {
                headers
                    .get("authorization")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.strip_prefix("Bearer "))
            });

        if provided != Some(expected_secret.as_str()) {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Unauthorized: invalid or missing X-Judge-Secret or Bearer token"
                })),
            ));
        }
    }
    Ok(next.run(request).await)
}

pub fn create_router(pool: Arc<JudgeWorkerPool>, secret: Option<String>) -> Router {
    let state = Arc::new(ApiState { pool, secret });

    let protected_routes = Router::new()
        .route("/api/v1/submit", post(handlers::submit))
        .route("/api/v1/ws/execute", get(websocket::handle_websocket))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    let public_routes = Router::new()
        .route("/health", get(handlers::health));

    Router::new()
        .merge(protected_routes)
        .merge(public_routes)
        .layer(axum::extract::DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
