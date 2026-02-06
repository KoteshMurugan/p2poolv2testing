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

use crate::api::error::ApiError;
use crate::api::server::AppState;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use p2poolv2_lib::store::column_families::ColumnFamily;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// ============================================================================
// Request/Response Structs
// ============================================================================

#[derive(Deserialize)]
pub struct ListQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub search: Option<String>,
}

#[derive(Serialize)]
pub struct ColumnFamilyInfo {
    pub name: String,
    pub description: String,
    pub estimated_entries: u64,
    pub key_format: String,
    pub value_format: String,
}

#[derive(Serialize)]
pub struct ColumnFamiliesResponse {
    pub column_families: Vec<ColumnFamilyInfo>,
    pub total: usize,
}

#[derive(Serialize)]
pub struct DbEntry {
    pub key: String,
    pub value: String,
    pub size: usize,
}

#[derive(Serialize)]
pub struct DbListResponse {
    pub column_family: String,
    pub entries: Vec<DbEntry>,
    pub page: u32,
    pub page_size: u32,
    pub total_entries: u64,
    pub has_more: bool,
}

#[derive(Serialize)]
pub struct DbGetResponse {
    pub column_family: String,
    pub key: String,
    pub value: Option<String>,
    pub found: bool,
    pub size: Option<usize>,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_cf_info(cf: ColumnFamily) -> ColumnFamilyInfo {
    let (description, key_format, value_format) = match cf {
        ColumnFamily::Block => (
            "Share blocks in the P2Pool chain",
            "BlockHash (32 bytes)",
            "ShareBlock",
        ),
        ColumnFamily::BlockTxids => (
            "Block hash to transaction IDs mapping",
            "BlockHash (32 bytes)",
            "Vec<Txid>",
        ),
        ColumnFamily::TxidsBlocks => (
            "Transaction IDs to block hash mapping",
            "Txid (32 bytes)",
            "BlockHash",
        ),
        ColumnFamily::Uncles => (
            "Uncle blocks at each height",
            "u32 (height)",
            "Vec<BlockHash>",
        ),
        ColumnFamily::BitcoinTxids => (
            "Bitcoin transaction IDs",
            "Txid (32 bytes)",
            "Transaction",
        ),
        ColumnFamily::Inputs => (
            "Transaction inputs",
            "OutPoint",
            "TxIn",
        ),
        ColumnFamily::Outputs => (
            "Transaction outputs",
            "OutPoint",
            "TxOut",
        ),
        ColumnFamily::Tx => (
            "Full transactions",
            "Txid (32 bytes)",
            "Transaction",
        ),
        ColumnFamily::BlockIndex => (
            "Block hash to height mapping",
            "BlockHash (32 bytes)",
            "u32 (height)",
        ),
        ColumnFamily::BlockHeight => (
            "Height to block hash mapping",
            "u32 (height)",
            "BlockHash",
        ),
        ColumnFamily::Share => (
            "Mining shares",
            "ShareId",
            "Share",
        ),
        ColumnFamily::Job => (
            "Mining jobs",
            "JobId",
            "Job",
        ),
        ColumnFamily::User => (
            "User/miner information",
            "String (username)",
            "UserInfo",
        ),
        ColumnFamily::UserIndex => (
            "User indexing data",
            "String (key)",
            "UserIndexData",
        ),
        ColumnFamily::Metadata => (
            "System metadata and configuration",
            "String (key)",
            "String (value)",
        ),
        ColumnFamily::SpendsIndex => (
            "Spending transaction index",
            "OutPoint",
            "Txid",
        ),
    };

    ColumnFamilyInfo {
        name: cf.as_str().to_string(),
        description: description.to_string(),
        estimated_entries: 0, // Will be filled by actual count
        key_format: key_format.to_string(),
        value_format: value_format.to_string(),
    }
}

// ============================================================================
// API Handlers
// ============================================================================

/// List all column families with their info
pub async fn list_column_families(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ColumnFamiliesResponse>, ApiError> {
    let all_cfs = vec![
        ColumnFamily::Block,
        ColumnFamily::BlockTxids,
        ColumnFamily::TxidsBlocks,
        ColumnFamily::Uncles,
        ColumnFamily::BitcoinTxids,
        ColumnFamily::Inputs,
        ColumnFamily::Outputs,
        ColumnFamily::Tx,
        ColumnFamily::BlockIndex,
        ColumnFamily::BlockHeight,
        ColumnFamily::Share,
        ColumnFamily::Job,
        ColumnFamily::User,
        ColumnFamily::UserIndex,
        ColumnFamily::Metadata,
        ColumnFamily::SpendsIndex,
    ];

    let mut cf_infos = Vec::new();
    for cf in all_cfs {
        let mut info = get_cf_info(cf);
        
        // Get estimated entry count from RocksDB
        if let Ok(count) = state.chain_store_handle.get_cf_entry_count(cf) {
            info.estimated_entries = count;
        }
        
        cf_infos.push(info);
    }

    Ok(Json(ColumnFamiliesResponse {
        total: cf_infos.len(),
        column_families: cf_infos,
    }))
}

/// List entries in a specific column family with pagination
pub async fn list_cf_entries(
    State(state): State<Arc<AppState>>,
    Path(cf_name): Path<String>,
    Query(params): Query<ListQuery>,
) -> Result<Json<DbListResponse>, ApiError> {
    // Parse column family name
    let cf = parse_column_family(&cf_name)?;
    
    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(50).min(100).max(1);
    let skip = ((page - 1) * page_size) as usize;

    // Get entries from the store
    let (entries, total) = state
        .chain_store_handle
        .list_cf_entries(cf, skip, page_size as usize, params.search.as_deref())
        .map_err(|e| ApiError::ServerError(e.to_string()))?;

    let db_entries: Vec<DbEntry> = entries
        .into_iter()
        .map(|(key, value)| {
            let size = value.len();
            DbEntry {
                key: format_key(&key),
                value: format_value(&value),
                size,
            }
        })
        .collect();

    let has_more = (skip + db_entries.len()) < total as usize;

    Ok(Json(DbListResponse {
        column_family: cf_name,
        entries: db_entries,
        page,
        page_size,
        total_entries: total,
        has_more,
    }))
}

/// Get a specific entry by key from a column family
pub async fn get_cf_entry(
    State(state): State<Arc<AppState>>,
    Path((cf_name, key)): Path<(String, String)>,
) -> Result<Json<DbGetResponse>, ApiError> {
    // Parse column family name
    let cf = parse_column_family(&cf_name)?;
    
    // Get the entry
    let result = state
        .chain_store_handle
        .get_cf_entry(cf, &key)
        .map_err(|e| ApiError::ServerError(e.to_string()))?;

    match result {
        Some(value) => {
            let size = value.len();
            Ok(Json(DbGetResponse {
                column_family: cf_name,
                key: key.clone(),
                value: Some(format_value(&value)),
                found: true,
                size: Some(size),
            }))
        }
        None => Ok(Json(DbGetResponse {
            column_family: cf_name,
            key,
            value: None,
            found: false,
            size: None,
        })),
    }
}

/// Get statistics for a specific column family
#[derive(Serialize)]
pub struct CfStatsResponse {
    pub column_family: String,
    pub total_entries: u64,
    pub estimated_size_bytes: u64,
    pub description: String,
}

pub async fn get_cf_stats(
    State(state): State<Arc<AppState>>,
    Path(cf_name): Path<String>,
) -> Result<Json<CfStatsResponse>, ApiError> {
    let cf = parse_column_family(&cf_name)?;
    let info = get_cf_info(cf);
    
    let total_entries = state
        .chain_store_handle
        .get_cf_entry_count(cf)
        .map_err(|e| ApiError::ServerError(e.to_string()))?;
    
    let estimated_size = state
        .chain_store_handle
        .get_cf_size_estimate(cf)
        .unwrap_or(0);

    Ok(Json(CfStatsResponse {
        column_family: cf_name,
        total_entries,
        estimated_size_bytes: estimated_size,
        description: info.description,
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_column_family(name: &str) -> Result<ColumnFamily, ApiError> {
    match name {
        "block" => Ok(ColumnFamily::Block),
        "block_txids" => Ok(ColumnFamily::BlockTxids),
        "txids_blocks" => Ok(ColumnFamily::TxidsBlocks),
        "uncles" => Ok(ColumnFamily::Uncles),
        "bitcoin_txids" => Ok(ColumnFamily::BitcoinTxids),
        "inputs" => Ok(ColumnFamily::Inputs),
        "outputs" => Ok(ColumnFamily::Outputs),
        "tx" => Ok(ColumnFamily::Tx),
        "block_index" => Ok(ColumnFamily::BlockIndex),
        "block_height" => Ok(ColumnFamily::BlockHeight),
        "share" => Ok(ColumnFamily::Share),
        "job" => Ok(ColumnFamily::Job),
        "user" => Ok(ColumnFamily::User),
        "user_index" => Ok(ColumnFamily::UserIndex),
        "metadata" => Ok(ColumnFamily::Metadata),
        "spends_index" => Ok(ColumnFamily::SpendsIndex),
        _ => Err(ApiError::NotFound(format!("Unknown column family: {}", name))),
    }
}

fn format_key(key: &[u8]) -> String {
    // Try to decode as UTF-8 first
    if let Ok(s) = std::str::from_utf8(key) {
        s.to_string()
    } else {
        // Otherwise show as hex
        hex::encode(key)
    }
}

fn format_value(value: &[u8]) -> String {
    // For small values, try UTF-8, otherwise show hex
    if value.len() < 1024 {
        if let Ok(s) = std::str::from_utf8(value) {
            return s.to_string();
        }
    }
    
    // For binary data or large values, show hex with truncation
    if value.len() > 512 {
        format!("{}... ({} bytes)", hex::encode(&value[..512]), value.len())
    } else {
        hex::encode(value)
    }
}
