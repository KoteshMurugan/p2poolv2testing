use crate::shares::chain::chain_store_handle::ChainStoreHandle;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::get,
};
use bitcoin::BlockHash;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// API State containing chain store handle
pub struct ApiState {
    pub chain_store: ChainStoreHandle,
}

// ============ Response Types ============

#[derive(Serialize)]
pub struct ChainTipResponse {
    pub tip_hash: String,
    pub height: Option<u32>,
    pub total_work: String,
    pub uncles: Vec<String>,
}

#[derive(Serialize)]
pub struct ShareInfo {
    pub hash: String,
    pub prev_hash: String,
    pub uncles: Vec<String>,
    pub height: Option<u32>,
    pub miner_pubkey: String,
    pub timestamp: u32,
    pub difficulty: String,
    pub bitcoin_block_hash: String,
    pub is_main_chain: bool,
    pub depth: Option<usize>,
}

#[derive(Serialize)]
pub struct DagNode {
    pub hash: String,
    pub prev_hash: String,
    pub uncles: Vec<String>,
    pub height: u32,
    pub miner_pubkey: String,
    pub is_main_chain: bool,
    pub is_uncle: bool,
}

#[derive(Serialize)]
pub struct DagResponse {
    pub nodes: Vec<DagNode>,
    pub edges: Vec<DagEdge>,
    pub tip_hash: String,
    pub from_height: u32,
    pub to_height: u32,
}

#[derive(Serialize)]
pub struct DagEdge {
    pub from: String,      // child hash
    pub to: String,        // parent hash
    pub edge_type: String, // "parent" or "uncle"
}

#[derive(Serialize)]
pub struct ChainStatsResponse {
    pub tip_height: Option<u32>,
    pub total_work: String,
    pub total_shares: u64,
    pub total_uncles: u64,
    pub average_shares_per_height: f64,
}

// ============ Query Parameters ============

#[derive(Deserialize)]
pub struct HeightQuery {
    pub height: u32,
}

#[derive(Deserialize)]
pub struct DagQuery {
    pub from_height: Option<u32>,
    pub to_height: Option<u32>,
    pub limit: Option<u32>,
}

// ============ Handlers ============

/// GET /api/blockchain/tip
pub async fn get_chain_tip(State(state): State<Arc<ApiState>>) -> Json<ChainTipResponse> {
    let (tip, uncles) = state.chain_store.get_chain_tip_and_uncles();
    let height = state.chain_store.get_tip_height().ok().flatten();
    let total_work = state
        .chain_store
        .get_total_work()
        .map(|w| format!("{:x}", w))
        .unwrap_or_default();

    Json(ChainTipResponse {
        tip_hash: tip.to_string(),
        height,
        total_work,
        uncles: uncles.iter().map(|u| u.to_string()).collect(),
    })
}

/// GET /api/blockchain/share/{hash}
pub async fn get_share(
    State(state): State<Arc<ApiState>>,
    Path(hash): Path<String>,
) -> Result<Json<ShareInfo>, axum::http::StatusCode> {
    let block_hash: BlockHash = hash
        .parse()
        .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;

    let share = state
        .chain_store
        .get_share(&block_hash)
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let tip = state.chain_store.get_chain_tip();
    let depth = state.chain_store.get_depth(&block_hash);
    let is_main_chain = is_on_main_chain(&state.chain_store, &block_hash, &tip);

    Ok(Json(ShareInfo {
        hash: share.block_hash().to_string(),
        prev_hash: share.header.prev_share_blockhash.to_string(),
        uncles: share.header.uncles.iter().map(|u| u.to_string()).collect(),
        height: depth
            .map(|d| {
                state
                    .chain_store
                    .get_tip_height()
                    .ok()
                    .flatten()
                    .map(|h| h.saturating_sub(d as u32))
            })
            .flatten(),
        miner_pubkey: share.header.miner_pubkey.to_string(),
        timestamp: share.header.time,
        difficulty: format!("{:x}", share.header.bits.to_consensus()),
        bitcoin_block_hash: share.header.bitcoin_header.block_hash().to_string(),
        is_main_chain,
        depth,
    }))
}

/// GET /api/blockchain/shares?height=N
pub async fn get_shares_at_height(
    State(state): State<Arc<ApiState>>,
    Query(params): Query<HeightQuery>,
) -> Result<Json<Vec<ShareInfo>>, axum::http::StatusCode> {
    let shares = state
        .chain_store
        .get_shares_at_height(params.height)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let tip = state.chain_store.get_chain_tip();

    let share_infos: Vec<ShareInfo> = shares
        .iter()
        .map(|(hash, share)| {
            let depth = state.chain_store.get_depth(hash);
            let is_main_chain = is_on_main_chain(&state.chain_store, hash, &tip);

            ShareInfo {
                hash: hash.to_string(),
                prev_hash: share.header.prev_share_blockhash.to_string(),
                uncles: share.header.uncles.iter().map(|u| u.to_string()).collect(),
                height: Some(params.height),
                miner_pubkey: share.header.miner_pubkey.to_string(),
                timestamp: share.header.time,
                difficulty: format!("{:x}", share.header.bits.to_consensus()),
                bitcoin_block_hash: share.header.bitcoin_header.block_hash().to_string(),
                is_main_chain,
                depth,
            }
        })
        .collect();

    Ok(Json(share_infos))
}

/// GET /api/blockchain/dag?from_height=N&to_height=M
pub async fn get_dag(
    State(state): State<Arc<ApiState>>,
    Query(params): Query<DagQuery>,
) -> Result<Json<DagResponse>, axum::http::StatusCode> {
    let tip_height = state
        .chain_store
        .get_tip_height()
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .unwrap_or(0);

    let limit = params.limit.unwrap_or(50).min(100);
    let to_height = params.to_height.unwrap_or(tip_height);
    let from_height = params
        .from_height
        .unwrap_or(to_height.saturating_sub(limit));

    let tip = state.chain_store.get_chain_tip();
    let (_, current_uncles) = state.chain_store.get_chain_tip_and_uncles();

    let mut nodes: Vec<DagNode> = Vec::new();
    let mut edges: Vec<DagEdge> = Vec::new();
    let mut seen_hashes: std::collections::HashSet<String> = std::collections::HashSet::new();

    for height in from_height..=to_height {
        if let Ok(shares) = state.chain_store.get_shares_at_height(height) {
            for (hash, share) in shares {
                let hash_str = hash.to_string();
                if seen_hashes.contains(&hash_str) {
                    continue;
                }
                seen_hashes.insert(hash_str.clone());

                let is_main_chain = is_on_main_chain(&state.chain_store, &hash, &tip);
                let is_uncle = current_uncles.contains(&hash);

                // Add parent edge
                let prev_hash_str = share.header.prev_share_blockhash.to_string();
                if prev_hash_str != BlockHash::all_zeros().to_string() {
                    edges.push(DagEdge {
                        from: hash_str.clone(),
                        to: prev_hash_str,
                        edge_type: "parent".to_string(),
                    });
                }

                // Add uncle edges
                for uncle in &share.header.uncles {
                    edges.push(DagEdge {
                        from: hash_str.clone(),
                        to: uncle.to_string(),
                        edge_type: "uncle".to_string(),
                    });
                }

                nodes.push(DagNode {
                    hash: hash_str,
                    prev_hash: share.header.prev_share_blockhash.to_string(),
                    uncles: share.header.uncles.iter().map(|u| u.to_string()).collect(),
                    height,
                    miner_pubkey: share.header.miner_pubkey.to_string(),
                    is_main_chain,
                    is_uncle,
                });
            }
        }
    }

    Ok(Json(DagResponse {
        nodes,
        edges,
        tip_hash: tip.to_string(),
        from_height,
        to_height,
    }))
}

/// GET /api/blockchain/stats
pub async fn get_chain_stats(State(state): State<Arc<ApiState>>) -> Json<ChainStatsResponse> {
    let tip_height = state.chain_store.get_tip_height().ok().flatten();
    let total_work = state
        .chain_store
        .get_total_work()
        .map(|w| format!("{:x}", w))
        .unwrap_or_default();

    // Count total shares and uncles by iterating through heights
    let mut total_shares: u64 = 0;
    let mut total_uncles: u64 = 0;

    if let Some(height) = tip_height {
        for h in 0..=height {
            if let Ok(shares) = state.chain_store.get_shares_at_height(h) {
                total_shares += shares.len() as u64;
                for (_, share) in shares {
                    total_uncles += share.header.uncles.len() as u64;
                }
            }
        }
    }

    let avg = if tip_height.unwrap_or(0) > 0 {
        total_shares as f64 / (tip_height.unwrap() + 1) as f64
    } else {
        0.0
    };

    Json(ChainStatsResponse {
        tip_height,
        total_work,
        total_shares,
        total_uncles,
        average_shares_per_height: avg,
    })
}

// ============ Helper Functions ============

fn is_on_main_chain(chain_store: &ChainStoreHandle, hash: &BlockHash, tip: &BlockHash) -> bool {
    if hash == tip {
        return true;
    }

    // Walk back from tip to see if this hash is in the main chain
    let mut current = *tip;
    for _ in 0..1000 {
        // Limit depth to prevent infinite loop
        if let Some(share) = chain_store.get_share(&current) {
            if share.header.prev_share_blockhash == *hash {
                return true;
            }
            if share.header.prev_share_blockhash == BlockHash::all_zeros() {
                break;
            }
            current = share.header.prev_share_blockhash;
        } else {
            break;
        }
    }
    false
}

// ============ Router ============

pub fn blockchain_routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/tip", get(get_chain_tip))
        .route("/share/:hash", get(get_share))
        .route("/shares", get(get_shares_at_height))
        .route("/dag", get(get_dag))
        .route("/stats", get(get_chain_stats))
}
