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
    pub total_workers: usize,
    pub uptime_secs: u64,
}

pub async fn health(
    State(state): State<Arc<ApiState>>,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        idle_workers: state.pool.idle_workers(),
        busy_workers: state.pool.busy_workers(),
        total_workers: state.pool.num_workers(),
        uptime_secs: 0, // TODO: track uptime
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
                "supported": ["c", "cpp", "rust", "go", "python", "java"]
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

    // Submit to worker pool
    match state.pool.submit(request, None).await {
        Ok(result) => (StatusCode::OK, Json(serde_json::to_value(&result).unwrap())),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e })),
        ),
    }
}
