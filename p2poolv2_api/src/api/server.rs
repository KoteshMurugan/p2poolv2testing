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

use crate::api::auth::auth_middleware;
use crate::api::error::ApiError;
use axum::{
    Extension, Json, Router,
    extract::{FromRef, Path, Query, State},
    middleware::{self},
    routing::get,
};
use chrono::DateTime;
use p2poolv2_lib::stratum::work::tracker::{JobTracker, parse_coinbase};
use p2poolv2_lib::{
    accounting::{simple_pplns::SimplePplnsShare, stats::metrics::MetricsHandle},
    config::ApiConfig,
    shares::chain::chain_store_handle::ChainStoreHandle,
};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::oneshot;
use tracing::info;

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) app_config: AppConfig,
    pub(crate) chain_store_handle: ChainStoreHandle,
    pub(crate) metrics_handle: MetricsHandle,
    pub(crate) tracker_handle: Arc<JobTracker>,
    pub(crate) auth_user: Option<String>,
    pub(crate) auth_token: Option<String>,
}

/// Stores application config values that don't change across requests
/// Used with Extension axum framework
#[derive(Clone)]
pub struct AppConfig {
    pub pool_signature_length: usize,
    pub network: bitcoin::Network,
}

/// Get AppConfig from AppState ref
impl FromRef<AppState> for AppConfig {
    fn from_ref(state: &AppState) -> Self {
        state.app_config.clone()
    }
}

#[derive(Deserialize)]
pub struct PplnsQuery {
    limit: Option<usize>,
    start_time: Option<String>,
    end_time: Option<String>,
}

// ============================================================================
// Chain API Response Structs
// ============================================================================

#[derive(Serialize)]
pub struct ChainTipResponse {
    pub tip: String,
}

#[derive(Serialize)]
pub struct ChainHeightResponse {
    pub height: Option<u32>,
}

#[derive(Serialize)]
pub struct ChainTipWithUnclesResponse {
    pub tip: String,
    pub uncles: Vec<String>,
}

#[derive(Serialize)]
pub struct SharesAtHeightResponse {
    pub height: u32,
    pub shares: Vec<ShareInfo>,
}

#[derive(Serialize)]
pub struct ShareInfo {
    pub blockhash: String,
    pub prev_share_blockhash: String,
}

#[derive(Serialize)]
pub struct TotalWorkResponse {
    pub total_work: String,
}

#[derive(Serialize)]
pub struct ChainLocatorResponse {
    pub locator: Vec<String>,
}

#[derive(Serialize)]
pub struct ChainInfoResponse {
    pub tip: String,
    pub height: Option<u32>,
    pub total_work: String,
    pub uncles: Vec<String>,
    pub network: String,
}

// ============================================================================
// Chain API Handlers
// ============================================================================

async fn chain_tip(State(state): State<Arc<AppState>>) -> Json<ChainTipResponse> {
    let tip = state.chain_store_handle.get_chain_tip();
    Json(ChainTipResponse {
        tip: tip.to_string(),
    })
}

async fn chain_height(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ChainHeightResponse>, ApiError> {
    let height = state
        .chain_store_handle
        .get_tip_height()
        .map_err(|e| ApiError::ServerError(e.to_string()))?;
    Ok(Json(ChainHeightResponse { height }))
}

async fn chain_tip_with_uncles(
    State(state): State<Arc<AppState>>,
) -> Json<ChainTipWithUnclesResponse> {
    let (tip, uncles) = state.chain_store_handle.get_chain_tip_and_uncles();
    Json(ChainTipWithUnclesResponse {
        tip: tip.to_string(),
        uncles: uncles.iter().map(|u| u.to_string()).collect(),
    })
}

async fn shares_at_height(
    State(state): State<Arc<AppState>>,
    Path(height): Path<u32>,
) -> Result<Json<SharesAtHeightResponse>, ApiError> {
    let shares = state
        .chain_store_handle
        .get_shares_at_height(height)
        .map_err(|e| ApiError::ServerError(e.to_string()))?;

    let share_infos: Vec<ShareInfo> = shares
        .iter()
        .map(|(hash, share)| ShareInfo {
            blockhash: hash.to_string(),
            prev_share_blockhash: share.header.prev_share_blockhash.to_string(),
        })
        .collect();

    Ok(Json(SharesAtHeightResponse {
        height,
        shares: share_infos,
    }))
}

async fn total_work(
    State(state): State<Arc<AppState>>,
) -> Result<Json<TotalWorkResponse>, ApiError> {
    let work = state
        .chain_store_handle
        .get_total_work()
        .map_err(|e| ApiError::ServerError(e.to_string()))?;
    Ok(Json(TotalWorkResponse {
        total_work: format!("{:x}", work),
    }))
}

async fn chain_locator(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ChainLocatorResponse>, ApiError> {
    let locator = state
        .chain_store_handle
        .build_locator()
        .map_err(|e| ApiError::ServerError(e.to_string()))?;
    Ok(Json(ChainLocatorResponse {
        locator: locator.iter().map(|h| h.to_string()).collect(),
    }))
}

async fn chain_info(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ChainInfoResponse>, ApiError> {
    let tip = state.chain_store_handle.get_chain_tip();
    let height = state
        .chain_store_handle
        .get_tip_height()
        .map_err(|e| ApiError::ServerError(e.to_string()))?;
    let total_work = state
        .chain_store_handle
        .get_total_work()
        .map_err(|e| ApiError::ServerError(e.to_string()))?;
    let (_, uncles) = state.chain_store_handle.get_chain_tip_and_uncles();

    Ok(Json(ChainInfoResponse {
        tip: tip.to_string(),
        height,
        total_work: format!("{:x}", total_work),
        uncles: uncles.iter().map(|u| u.to_string()).collect(),
        network: state.app_config.network.to_string(),
    }))
}

// ============================================================================
// Server Setup
// ============================================================================

/// Start the API server and return a shutdown channel
pub async fn start_api_server(
    config: ApiConfig,
    chain_store_handle: ChainStoreHandle,
    metrics_handle: MetricsHandle,
    tracker_handle: Arc<JobTracker>,
    network: bitcoin::Network,
    pool_signature: Option<String>,
) -> Result<oneshot::Sender<()>, std::io::Error> {
    let app_config = AppConfig {
        pool_signature_length: pool_signature.unwrap_or_default().len(),
        network,
    };

    let app_state = Arc::new(AppState {
        app_config: app_config.clone(),
        chain_store_handle,
        metrics_handle,
        tracker_handle,
        auth_user: config.auth_user.clone(),
        auth_token: config.auth_token.clone(),
    });

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let addr = SocketAddr::new(
        std::net::IpAddr::V4(config.hostname.parse().unwrap()),
        config.port,
    );

    let app = Router::new()
        // Health and metrics
        .route("/health", get(health_check))
        .route("/metrics", get(metrics))
        .route("/pplns_shares", get(pplns_shares))
        // Chain endpoints
        .route("/chain/tip", get(chain_tip))
        .route("/chain/height", get(chain_height))
        .route("/chain/tip_with_uncles", get(chain_tip_with_uncles))
        .route("/chain/shares/{height}", get(shares_at_height))
        .route("/chain/total_work", get(total_work))
        .route("/chain/locator", get(chain_locator))
        .route("/chain/info", get(chain_info))
        // Middleware and state
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            auth_middleware,
        ))
        .layer(Extension(app_config))
        .with_state(app_state);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(e) => return Err(e),
    };

    info!("API server listening on {}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
                info!("API server shutdown signal received");
            })
            .await
            .map_err(|e| ApiError::ServerError(e.to_string()))?;

        info!("API server stopped");
        Ok::<(), ApiError>(())
    });
    Ok(shutdown_tx)
}

async fn health_check() -> String {
    "OK".into()
}

/// Returns pool metrics in grafana exposition format
///
/// The exposition also includes parsed coinbase outputs for showing
/// the current coinbase payout distribution
async fn metrics(State(state): State<Arc<AppState>>) -> String {
    //  Get base metrics
    let pool_metrics = state.metrics_handle.get_metrics().await;
    let mut exposition = pool_metrics.get_exposition();

    if let Some(coinbase_distribution) = parse_coinbase::get_distribution(
        &state.tracker_handle,
        state.app_config.pool_signature_length,
        state.app_config.network,
    ) {
        exposition.push_str("# HELP coinbase_rewards_distribution Current coinbase rewards distribution between users\n");
        exposition.push_str(&coinbase_distribution);
    }
    exposition
}

async fn pplns_shares(
    State(state): State<Arc<AppState>>,
    Query(query): Query<PplnsQuery>,
) -> Result<Json<Vec<SimplePplnsShare>>, ApiError> {
    // Convert ISO 8601 strings to Unix timestamps
    let start_time = match query.start_time.as_ref() {
        Some(s) => match DateTime::parse_from_rfc3339(s) {
            Ok(dt) => dt.timestamp() as u64,
            Err(_) => {
                return Err(ApiError::ServerError("Invalid time format".into()));
            }
        },
        None => 0,
    };

    let end_time = match query.end_time.as_ref() {
        Some(s) => match DateTime::parse_from_rfc3339(s) {
            Ok(dt) => dt.timestamp() as u64,
            Err(_) => {
                return Err(ApiError::ServerError("Invalid time format".into()));
            }
        },
        None => {
            // Default to current time
            let now = chrono::Utc::now();
            now.timestamp() as u64
        }
    };

    if end_time < start_time {
        return Err(ApiError::ServerError("Invalid date range".into()));
    }

    let shares = state.chain_store_handle.get_pplns_shares_filtered(
        query.limit,
        Some(start_time),
        Some(end_time),
    );

    Ok(Json(shares))
}
#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::State;
    use bitcoin::{Amount, Network, TxOut};
    use p2poolv2_lib::accounting::stats::metrics;
    use p2poolv2_lib::shares::share_block::ShareBlock;
    use p2poolv2_lib::stratum::work::block_template::BlockTemplate;
    use p2poolv2_lib::stratum::work::coinbase::parse_address;
    use p2poolv2_lib::stratum::work::tracker::start_tracker_actor;
    use p2poolv2_lib::test_utils::setup_test_chain_store_handle;
    use std::collections::HashMap;
    use std::str::FromStr;
    use std::sync::Arc;

    #[test_log::test(tokio::test)]
    async fn test_metrics_endpoint_exposes_coinbase_split() {
        let tracker_handle = start_tracker_actor();

        let temp_dir = tempfile::tempdir().unwrap();
        let metrics_handle = metrics::start_metrics(temp_dir.path().to_str().unwrap().to_string())
            .await
            .unwrap();

        //  Use Signet Addresses
        let address = parse_address(
            "tb1q3udk7r26qs32ltf9nmqrjaaa7tr55qmkk30q5d",
            Network::Signet,
        )
        .unwrap();

        let donation_address = parse_address(
            "tb1q0afww6y0kgl4tyjjyv6xlttvfwdfqxvrfzz35f",
            Network::Signet,
        )
        .unwrap();

        let template = BlockTemplate {
            default_witness_commitment: Some(
                "6a24aa21a9ed010000000000000000000000000000000000000000000000000000000000"
                    .to_string(),
            ),
            height: 100,
            version: 0x20000000,
            previousblockhash: "0000000000000000000000000000000000000000000000000000000000000000"
                .to_string(),
            bits: "1d00ffff".to_string(),
            curtime: 1234567890,
            transactions: vec![],
            coinbasevalue: 50_0000_0000,
            coinbaseaux: HashMap::new(),
            rules: vec![],
            vbavailable: HashMap::new(),
            vbrequired: 0,
            longpollid: "".to_string(),
            target: "".to_string(),
            mintime: 0,
            mutable: vec![],
            noncerange: "".to_string(),
            sigoplimit: 0,
            sizelimit: 0,
            weightlimit: 0,
        };

        let pool_signature = b"P2Poolv2";

        // Build outputs
        let outputs = vec![
            TxOut {
                value: Amount::from_str("49 BTC").unwrap(),
                script_pubkey: address.script_pubkey(),
            },
            TxOut {
                value: Amount::from_str("1 BTC").unwrap(),
                script_pubkey: donation_address.script_pubkey(),
            },
        ];

        // Manually Construct `coinbase2` Hex
        let mut coinbase2_bytes = Vec::new();
        coinbase2_bytes.push(pool_signature.len() as u8);
        coinbase2_bytes.extend_from_slice(pool_signature);
        coinbase2_bytes.extend_from_slice(&[0xff, 0xff, 0xff, 0xff]); // Sequence
        coinbase2_bytes.extend_from_slice(&bitcoin::consensus::serialize(&outputs)); // Outputs
        coinbase2_bytes.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]); // LockTime

        let coinbase2_hex = hex::encode(coinbase2_bytes);

        //  Insert Job into Tracker
        let job_id = tracker_handle.get_next_job_id();
        tracker_handle.insert_job(
            Arc::new(template),
            "".to_string(),
            coinbase2_hex,
            None,
            job_id,
        );

        //  Mock ChainStore
        let _genesis = ShareBlock::build_genesis_for_network(Network::Signet);
        let (chain_store_handle, _temp_dir) = setup_test_chain_store_handle(true).await;

        //  Prepare AppState
        let state = Arc::new(AppState {
            app_config: AppConfig {
                pool_signature_length: 8,
                network: bitcoin::Network::Signet,
            },
            chain_store_handle,
            metrics_handle,
            tracker_handle,
            auth_user: None,
            auth_token: None,
        });

        let response_body = metrics(State(state)).await;

        println!("{}", response_body);

        //  Verify Output
        assert!(response_body.contains(
            "coinbase_output{index=\"0\",address=\"tb1q3udk7r26qs32ltf9nmqrjaaa7tr55qmkk30q5d\"} 4900000000"
        ));
        assert!(response_body.contains(
            "coinbase_output{index=\"1\",address=\"tb1q0afww6y0kgl4tyjjyv6xlttvfwdfqxvrfzz35f\"} 100000000"
        ));
    }
}
