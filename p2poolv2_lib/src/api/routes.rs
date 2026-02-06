// Copyright (C) 2024, 2025 P2Poolv2 Developers (see AUTHORS)
//
// This file is part of P2Poolv2
//
// P2Poolv2 is free software: you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// P2Poolv2 is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License along with
// P2Poolv2. If not, see <https://www.gnu.org/licenses/>.

use crate::api::rocksdb_browser::RocksDbBrowser;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Query parameters for pagination
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    pub search: Option<String>,
}

fn default_page() -> u32 {
    1
}

fn default_page_size() -> u32 {
    50
}

/// Error response structure
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// GET /api/cf - Get overview of all column families
pub async fn get_overview(
    State(browser): State<Arc<RocksDbBrowser>>,
) -> impl IntoResponse {
    Json(browser.get_overview())
}

/// GET /api/cf/:name/entries - Get paginated entries from a column family
pub async fn get_entries(
    State(browser): State<Arc<RocksDbBrowser>>,
    Path(cf_name): Path<String>,
    Query(params): Query<PaginationParams>,
) -> impl IntoResponse {
    match browser.get_entries(
        &cf_name,
        params.page,
        params.page_size,
        params.search.as_deref(),
    ) {
        Ok(response) => (StatusCode::OK, Json(response)).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        )
            .into_response(),
    }
}

/// GET /api/cf/:name/entry/:key - Get a specific entry by key
pub async fn get_entry(
    State(browser): State<Arc<RocksDbBrowser>>,
    Path((cf_name, key)): Path<(String, String)>,
) -> impl IntoResponse {
    match browser.get_entry(&cf_name, &key) {
        Ok(entry) => (StatusCode::OK, Json(entry)).into_response(),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse { error: e }),
        )
            .into_response(),
    }
}

/// GET /api/cf/:name/stats - Get statistics for a column family
pub async fn get_stats(
    State(browser): State<Arc<RocksDbBrowser>>,
    Path(cf_name): Path<String>,
) -> impl IntoResponse {
    match browser.get_stats(&cf_name) {
        Ok(stats) => (StatusCode::OK, Json(stats)).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        )
            .into_response(),
    }
}

/// Health check endpoint
pub async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "service": "rocksdb-browser"
    }))
}

/// Create the API router
pub fn create_router(browser: Arc<RocksDbBrowser>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/api/cf", get(get_overview))
        .route("/api/cf/:name/entries", get(get_entries))
        .route("/api/cf/:name/entry/:key", get(get_entry))
        .route("/api/cf/:name/stats", get(get_stats))
        .with_state(browser)
}
