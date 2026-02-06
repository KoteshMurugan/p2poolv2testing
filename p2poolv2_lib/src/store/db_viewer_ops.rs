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
use rocksdb::{DB, IteratorMode};
use std::sync::Arc;

/// Get estimated entry count for a column family
pub fn get_cf_entry_count(
    db: &Arc<DB>,
    cf: ColumnFamily,
) -> Result<u64, String> {
    let cf_handle = db
        .cf_handle(cf.as_str())
        .ok_or_else(|| format!("Column family {} not found", cf.as_str()))?;

    // Approximate count using RocksDB property
    match db.property_int_value_cf(&cf_handle, "rocksdb.estimate-num-keys") {
        Ok(Some(count)) => Ok(count),
        Ok(None) => {
            // Fallback: iterate and count (expensive!)
            let count = db.iterator_cf(&cf_handle, IteratorMode::Start).count();
            Ok(count as u64)
        }
        Err(e) => Err(format!("Failed to get entry count: {}", e)),
    }
}

/// Get estimated size of a column family in bytes
pub fn get_cf_size_estimate(
    db: &Arc<DB>,
    cf: ColumnFamily,
) -> Result<u64, String> {
    let cf_handle = db
        .cf_handle(cf.as_str())
        .ok_or_else(|| format!("Column family {} not found", cf.as_str()))?;

    // Get approximate size using RocksDB property
    match db.property_int_value_cf(&cf_handle, "rocksdb.estimate-live-data-size") {
        Ok(Some(size)) => Ok(size),
        Ok(None) => Ok(0),
        Err(e) => Err(format!("Failed to get size estimate: {}", e)),
    }
}

/// List entries from a column family with pagination
pub fn list_cf_entries(
    db: &Arc<DB>,
    cf: ColumnFamily,
    skip: usize,
    limit: usize,
    search: Option<&str>,
) -> Result<(Vec<(Vec<u8>, Vec<u8>)>, u64), String> {
    let cf_handle = db
        .cf_handle(cf.as_str())
        .ok_or_else(|| format!("Column family {} not found", cf.as_str()))?;

    let mut entries = Vec::new();
    let mut count = 0usize;
    let mut total_count = 0u64;

    let iter = db.iterator_cf(&cf_handle, IteratorMode::Start);

    for item in iter {
        match item {
            Ok((key, value)) => {
                total_count += 1;

                // Apply search filter if provided
                if let Some(search_term) = search {
                    let key_str = String::from_utf8_lossy(&key);
                    if !key_str.contains(search_term) {
                        continue;
                    }
                }

                // Skip pagination
                if count < skip {
                    count += 1;
                    continue;
                }

                // Limit pagination
                if entries.len() >= limit {
                    break;
                }

                entries.push((key.to_vec(), value.to_vec()));
                count += 1;
            }
            Err(e) => {
                return Err(format!("Failed to iterate column family: {}", e));
            }
        }
    }

    Ok((entries, total_count))
}

/// Get a specific entry from a column family by key
pub fn get_cf_entry(
    db: &Arc<DB>,
    cf: ColumnFamily,
    key: &str,
) -> Result<Option<Vec<u8>>, String> {
    let cf_handle = db
        .cf_handle(cf.as_str())
        .ok_or_else(|| format!("Column family {} not found", cf.as_str()))?;

    // Try to parse the key as hex first, then as UTF-8
    let key_bytes = if let Ok(hex_bytes) = hex::decode(key) {
        hex_bytes
    } else {
        key.as_bytes().to_vec()
    };

    match db.get_cf(&cf_handle, &key_bytes) {
        Ok(value) => Ok(value.map(|v| v.to_vec())),
        Err(e) => Err(format!("Failed to get entry: {}", e)),
    }
}

/// Delete an entry from a column family (optional, for admin)
pub fn delete_cf_entry(
    db: &Arc<DB>,
    cf: ColumnFamily,
    key: &str,
) -> Result<(), String> {
    let cf_handle = db
        .cf_handle(cf.as_str())
        .ok_or_else(|| format!("Column family {} not found", cf.as_str()))?;

    // Try to parse the key as hex first, then as UTF-8
    let key_bytes = if let Ok(hex_bytes) = hex::decode(key) {
        hex_bytes
    } else {
        key.as_bytes().to_vec()
    };

    match db.delete_cf(&cf_handle, &key_bytes) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to delete entry: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::column_families::ColumnFamily;
    use rocksdb::{Options, DB};
    use std::sync::Arc;
    use tempfile::tempdir;

    #[test]
    fn test_db_viewer_operations() {
        let temp_dir = tempdir().unwrap();
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.create_missing_column_families(true);

        let cf_names = vec!["metadata"];
        let db = DB::open_cf(&opts, temp_dir.path(), &cf_names).unwrap();
        let db_arc = Arc::new(db);

        // Test entry count
        let count = get_cf_entry_count(&db_arc, ColumnFamily::Metadata).unwrap();
        assert_eq!(count, 0);

        // Add test data
        let cf_handle = db_arc.cf_handle("metadata").unwrap();
        db_arc.put_cf(&cf_handle, b"test_key", b"test_value").unwrap();

        // Test list entries
        let (entries, total) = list_cf_entries(&db_arc, ColumnFamily::Metadata, 0, 10, None).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(total, 1);

        // Test get entry
        let value = get_cf_entry(&db_arc, ColumnFamily::Metadata, "test_key").unwrap();
        assert!(value.is_some());
        assert_eq!(value.unwrap(), b"test_value");
    }
}
