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
use crate::api::routes::create_router;
use crate::store::Store;
use axum::http::{header, Method};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

/// Start the RocksDB browser API server
pub async fn start_server(
    store: Arc<Store>,
    host: &str,
    port: u16,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let browser = Arc::new(RocksDbBrowser::new(store));
    
    // Configure CORS to allow frontend access
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    let app = create_router(browser).layer(cors);

    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    
    info!("🚀 RocksDB Browser API server started on http://{}", addr);
    info!("📊 API Endpoints:");
    info!("   GET  /health                      - Health check");
    info!("   GET  /api/cf                      - List all column families");
    info!("   GET  /api/cf/:name/entries        - Get entries (with pagination)");
    info!("   GET  /api/cf/:name/entry/:key     - Get specific entry");
    info!("   GET  /api/cf/:name/stats          - Get CF statistics");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}
