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

use crate::store::column_families::ColumnFamily;
use crate::store::Store;
use rocksdb::IteratorMode;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Information about a single column family
#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnFamilyInfo {
    pub name: String,
    pub entry_count: u64,
    pub description: String,
}

/// A single key-value entry from RocksDB
#[derive(Debug, Serialize, Deserialize)]
pub struct DbEntry {
    pub key: String,
    pub value: String,
    pub key_hex: String,
    pub value_hex: String,
    pub size_bytes: usize,
}

/// Paginated response for entries
#[derive(Debug, Serialize, Deserialize)]
pub struct EntriesResponse {
    pub column_family: String,
    pub total_entries: u64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
    pub data: Vec<DbEntry>,
    pub has_next: bool,
    pub has_prev: bool,
}

/// Response for all column families overview
#[derive(Debug, Serialize, Deserialize)]
pub struct OverviewResponse {
    pub column_families: Vec<ColumnFamilyInfo>,
    pub total_entries: u64,
    pub database_path: String,
}

/// Statistics for a column family
#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnFamilyStats {
    pub name: String,
    pub entry_count: u64,
    pub approximate_size_bytes: u64,
    pub first_key: Option<String>,
    pub last_key: Option<String>,
}

/// RocksDB Browser - handles database inspection
pub struct RocksDbBrowser {
    store: Arc<Store>,
}

impl RocksDbBrowser {
    pub fn new(store: Arc<Store>) -> Self {
        Self { store }
    }

    /// Get all column families with their entry counts
    pub fn get_overview(&self) -> OverviewResponse {
        let column_families = vec![
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
        let mut total_entries = 0u64;

        for cf in column_families {
            let count = self.count_entries(cf);
            total_entries += count;
            cf_infos.push(ColumnFamilyInfo {
                name: cf.as_str().to_string(),
                entry_count: count,
                description: Self::get_cf_description(cf),
            });
        }

        OverviewResponse {
            column_families: cf_infos,
            total_entries,
            database_path: self.store.get_path().to_string(),
        }
    }

    /// Count entries in a column family
    fn count_entries(&self, cf: ColumnFamily) -> u64 {
        let cf_handle = match self.store.get_db().cf_handle(cf.as_str()) {
            Some(handle) => handle,
            None => return 0,
        };

        let iter = self.store.get_db().iterator_cf(cf_handle, IteratorMode::Start);
        iter.count() as u64
    }

    /// Get paginated entries from a column family
    pub fn get_entries(
        &self,
        cf_name: &str,
        page: u32,
        page_size: u32,
        search_key: Option<&str>,
    ) -> Result<EntriesResponse, String> {
        let cf = Self::parse_column_family(cf_name)?;
        let cf_handle = self
            .store
            .get_db()
            .cf_handle(cf.as_str())
            .ok_or_else(|| format!("Column family '{}' not found", cf_name))?;

        let total_entries = self.count_entries(cf);
        let total_pages = ((total_entries as f64) / (page_size as f64)).ceil() as u32;

        let skip_count = ((page - 1) * page_size) as usize;
        let mut data = Vec::new();

        let iter = self.store.get_db().iterator_cf(cf_handle, IteratorMode::Start);

        for (idx, item) in iter.enumerate() {
            if let Ok((key, value)) = item {
                // Apply search filter if provided
                if let Some(search_term) = search_key {
                    let key_str = Self::bytes_to_string(&key);
                    if !key_str.to_lowercase().contains(&search_term.to_lowercase()) {
                        continue;
                    }
                }

                // Skip to the requested page
                if idx < skip_count {
                    continue;
                }

                // Stop after collecting page_size entries
                if data.len() >= page_size as usize {
                    break;
                }

                data.push(DbEntry {
                    key: Self::bytes_to_string(&key),
                    value: Self::bytes_to_string(&value),
                    key_hex: hex::encode(&key),
                    value_hex: hex::encode(&value),
                    size_bytes: key.len() + value.len(),
                });
            }
        }

        Ok(EntriesResponse {
            column_family: cf_name.to_string(),
            total_entries,
            page,
            page_size,
            total_pages,
            data,
            has_next: page < total_pages,
            has_prev: page > 1,
        })
    }

    /// Get a specific entry by key
    pub fn get_entry(&self, cf_name: &str, key: &str) -> Result<DbEntry, String> {
        let cf = Self::parse_column_family(cf_name)?;
        let cf_handle = self
            .store
            .get_db()
            .cf_handle(cf.as_str())
            .ok_or_else(|| format!("Column family '{}' not found", cf_name))?;

        // Try to decode key as hex first, fallback to raw string
        let key_bytes = hex::decode(key).unwrap_or_else(|_| key.as_bytes().to_vec());

        let value = self
            .store
            .get_db()
            .get_cf(cf_handle, &key_bytes)
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| format!("Key not found: {}", key))?;

        Ok(DbEntry {
            key: Self::bytes_to_string(&key_bytes),
            value: Self::bytes_to_string(&value),
            key_hex: hex::encode(&key_bytes),
            value_hex: hex::encode(&value),
            size_bytes: key_bytes.len() + value.len(),
        })
    }

    /// Get statistics for a column family
    pub fn get_stats(&self, cf_name: &str) -> Result<ColumnFamilyStats, String> {
        let cf = Self::parse_column_family(cf_name)?;
        let cf_handle = self
            .store
            .get_db()
            .cf_handle(cf.as_str())
            .ok_or_else(|| format!("Column family '{}' not found", cf_name))?;

        let entry_count = self.count_entries(cf);

        // Get first and last keys
        let mut iter = self.store.get_db().iterator_cf(cf_handle, IteratorMode::Start);
        let first_key = iter.next().and_then(|r| r.ok()).map(|(k, _)| Self::bytes_to_string(&k));

        let mut iter = self.store.get_db().iterator_cf(cf_handle, IteratorMode::End);
        let last_key = iter.next().and_then(|r| r.ok()).map(|(k, _)| Self::bytes_to_string(&k));

        // Approximate size (RocksDB doesn't provide exact size easily)
        let approximate_size_bytes = entry_count * 100; // Rough estimate

        Ok(ColumnFamilyStats {
            name: cf_name.to_string(),
            entry_count,
            approximate_size_bytes,
            first_key,
            last_key,
        })
    }

    /// Convert bytes to displayable string
    fn bytes_to_string(bytes: &[u8]) -> String {
        // Try UTF-8 first
        if let Ok(s) = String::from_utf8(bytes.to_vec()) {
            // If it contains non-printable chars, show hex
            if s.chars().all(|c| c.is_ascii_graphic() || c.is_ascii_whitespace()) {
                return s;
            }
        }
        // Fallback to hex representation
        format!("0x{}", hex::encode(bytes))
    }

    /// Parse column family name string to enum
    fn parse_column_family(name: &str) -> Result<ColumnFamily, String> {
        match name.to_lowercase().as_str() {
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
            _ => Err(format!("Unknown column family: {}", name)),
        }
    }

    /// Get description for a column family
    fn get_cf_description(cf: ColumnFamily) -> String {
        match cf {
            ColumnFamily::Block => "Share blocks data".to_string(),
            ColumnFamily::BlockTxids => "Block to transaction IDs mapping".to_string(),
            ColumnFamily::TxidsBlocks => "Transaction IDs to blocks mapping".to_string(),
            ColumnFamily::Uncles => "Uncle block records".to_string(),
            ColumnFamily::BitcoinTxids => "Bitcoin transaction IDs".to_string(),
            ColumnFamily::Inputs => "Transaction inputs".to_string(),
            ColumnFamily::Outputs => "Transaction outputs".to_string(),
            ColumnFamily::Tx => "Transaction data".to_string(),
            ColumnFamily::BlockIndex => "Block indexing data".to_string(),
            ColumnFamily::BlockHeight => "Height to block mapping".to_string(),
            ColumnFamily::Share => "Mining shares".to_string(),
            ColumnFamily::Job => "Mining jobs".to_string(),
            ColumnFamily::User => "User/miner data".to_string(),
            ColumnFamily::UserIndex => "User indexing".to_string(),
            ColumnFamily::Metadata => "System metadata".to_string(),
            ColumnFamily::SpendsIndex => "Spending transaction index".to_string(),
        }
    }
}

impl Store {
    /// Get database path (add this method to Store)
    pub fn get_path(&self) -> &str {
        &self.path
    }

    /// Get direct access to the DB (add this method to Store)
    pub fn get_db(&self) -> &rocksdb::DB {
        &self.db
    }
}
