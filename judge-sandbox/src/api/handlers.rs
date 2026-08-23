use axum::{
    extract::{State, Json},
    http::StatusCode,
};
use serde_json::json;
use std::sync::Arc;

use crate::orchestrator::{JobRequest, JobResult};
use super::ApiState;

#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub idle_workers: usize,
    pub busy_workers: usize,
    pub queued_jobs: usize,
    pub total_workers: usize,
    pub uptime_secs: u64,
}

pub async fn health(
    State(state): State<Arc<ApiState>>,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        idle_workers: state.pool.idle_workers(),
        busy_workers: state.pool.busy_workers(),
        queued_jobs: state.pool.queued_jobs(),
        total_workers: state.pool.num_workers(),
        uptime_secs: 0,
    })
}

pub async fn submit(
    State(state): State<Arc<ApiState>>,
    Json(request): Json<JobRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // Validate language
    if crate::languages::SupportedLanguage::from_str(&request.language).is_none() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": format!("Unsupported language: {}", request.language),
                "supported": ["c", "cpp", "python", "javascript", "typescript", "sql", "java"]
            })),
        );
    }

    // Validate test cases exist
    if request.test_cases.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "At least one test case is required"})),
        );
    }

    // Submit to worker pool with backpressure protection
    match state.pool.submit(request, None).await {
        Ok(result) => (StatusCode::OK, Json(serde_json::to_value(&result).unwrap())),
        Err(e) if e == "QUEUE_FULL" => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "Judge queue is full. Server is under heavy contest load. Please retry in 3 seconds.",
                "retry_after_secs": 3
            })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e })),
        ),
    }
}
