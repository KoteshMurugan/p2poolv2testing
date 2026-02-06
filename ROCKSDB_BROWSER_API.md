# RocksDB Browser API

A complete REST API for browsing and inspecting RocksDB column families data in your P2Pool database.

## Features

✨ **Simple Database Browser** - View all your RocksDB data like pgAdmin or MongoDB Compass
- Browse all 16 column families
- Paginated entry listing
- Search functionality
- View individual entries
- Statistics per column family
- CORS enabled for frontend access

## Quick Start

### 1. Start the API Server

```bash
# Navigate to the project directory
cd p2poolv2testing

# Run the RocksDB browser (default: localhost:3000)
cargo run --example rocksdb_browser -- /path/to/your/p2pool_data

# Or specify custom host and port
HOST=0.0.0.0 PORT=8080 cargo run --example rocksdb_browser -- ./p2pool_data
```

### 2. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Get overview of all column families
curl http://localhost:3000/api/cf

# Get entries from a specific column family (paginated)
curl http://localhost:3000/api/cf/user/entries?page=1&page_size=50

# Search for entries
curl "http://localhost:3000/api/cf/block/entries?search=000"

# Get specific entry by key
curl http://localhost:3000/api/cf/user/entry/your_key_here

# Get statistics
curl http://localhost:3000/api/cf/share/stats
```

## API Endpoints

### Overview

**GET `/api/cf`**

Get overview of all column families with entry counts.

**Response:**
```json
{
  "column_families": [
    {
      "name": "block",
      "entry_count": 1234,
      "description": "Share blocks data"
    },
    {
      "name": "user",
      "entry_count": 45,
      "description": "User/miner data"
    }
  ],
  "total_entries": 5678,
  "database_path": "./p2pool_data"
}
```

### Get Entries (Paginated)

**GET `/api/cf/:name/entries?page=1&page_size=50&search=term`**

Get paginated entries from a column family.

**Parameters:**
- `page` (optional, default: 1) - Page number
- `page_size` (optional, default: 50) - Entries per page
- `search` (optional) - Search term to filter keys

**Response:**
```json
{
  "column_family": "block",
  "total_entries": 1234,
  "page": 1,
  "page_size": 50,
  "total_pages": 25,
  "data": [
    {
      "key": "block_001",
      "value": "{...data...}",
      "key_hex": "626c6f636b5f303031",
      "value_hex": "7b2e2e2e646174612e2e2e7d",
      "size_bytes": 512
    }
  ],
  "has_next": true,
  "has_prev": false
}
```

### Get Specific Entry

**GET `/api/cf/:name/entry/:key`**

Get a specific entry by key (supports both string and hex keys).

**Response:**
```json
{
  "key": "user_123",
  "value": "{...user data...}",
  "key_hex": "757365725f313233",
  "value_hex": "7b2e2e2e757365722064617461",
  "size_bytes": 256
}
```

### Get Statistics

**GET `/api/cf/:name/stats`**

Get statistics for a column family.

**Response:**
```json
{
  "name": "block",
  "entry_count": 1234,
  "approximate_size_bytes": 123400,
  "first_key": "block_000",
  "last_key": "block_999"
}
```

### Health Check

**GET `/health`**

**Response:**
```json
{
  "status": "ok",
  "service": "rocksdb-browser"
}
```

## Column Families

The API provides access to all 16 RocksDB column families:

| Name | Description |
|------|-------------|
| `block` | Share blocks data |
| `block_txids` | Block to transaction IDs mapping |
| `txids_blocks` | Transaction IDs to blocks mapping |
| `uncles` | Uncle block records |
| `bitcoin_txids` | Bitcoin transaction IDs |
| `inputs` | Transaction inputs |
| `outputs` | Transaction outputs |
| `tx` | Transaction data |
| `block_index` | Block indexing data |
| `block_height` | Height to block mapping |
| `share` | Mining shares |
| `job` | Mining jobs |
| `user` | User/miner data |
| `user_index` | User indexing |
| `metadata` | System metadata |
| `spends_index` | Spending transaction index |

## Usage Examples

### Using with cURL

```bash
# List all column families
curl http://localhost:3000/api/cf | jq

# Get first page of users
curl http://localhost:3000/api/cf/user/entries?page=1 | jq

# Search for blocks containing "abc"
curl "http://localhost:3000/api/cf/block/entries?search=abc" | jq

# Get statistics for shares
curl http://localhost:3000/api/cf/share/stats | jq
```

### Using with JavaScript (fetch)

```javascript
// Get overview
fetch('http://localhost:3000/api/cf')
  .then(res => res.json())
  .then(data => console.log(data));

// Get entries with pagination
fetch('http://localhost:3000/api/cf/user/entries?page=1&page_size=20')
  .then(res => res.json())
  .then(data => console.log(data));
```

### Using with Python

```python
import requests

# Get overview
response = requests.get('http://localhost:3000/api/cf')
print(response.json())

# Get entries
response = requests.get(
    'http://localhost:3000/api/cf/block/entries',
    params={'page': 1, 'page_size': 50}
)
print(response.json())
```

## Frontend Integration

The API is ready to be consumed by your `p2poolfrontend` React app. CORS is enabled for all origins.

### Next Steps

1. Create a simple table view in your frontend
2. Use the `/api/cf` endpoint to list all column families
3. When a user clicks a column family, fetch entries using `/api/cf/:name/entries`
4. Display the data in a table with pagination controls
5. Add a search box that updates the `search` query parameter

## Configuration

### Environment Variables

- `HOST` - Server host (default: `127.0.0.1`)
- `PORT` - Server port (default: `3000`)
- `RUST_LOG` - Logging level (default: `info`)

### Example

```bash
HOST=0.0.0.0 PORT=8080 RUST_LOG=debug cargo run --example rocksdb_browser -- ./p2pool_data
```

## Development

### Running Tests

```bash
cargo test --lib
```

### Building for Production

```bash
cargo build --release --example rocksdb_browser
./target/release/examples/rocksdb_browser ./p2pool_data
```

## Architecture

```
p2poolv2_lib/src/api/
├── mod.rs                  # Module exports
├── rocksdb_browser.rs      # Core database browsing logic
├── routes.rs               # API route handlers
└── server.rs               # Axum server setup

p2poolv2_lib/examples/
└── rocksdb_browser.rs      # Binary to start the server
```

## Performance Notes

- Database is opened in **read-only mode** for safety
- Pagination is implemented for efficient memory usage
- Entry counting uses iterators (may be slow for large CFs)
- Key/value display automatically detects binary vs text data

## Troubleshooting

### "Database is locked"
- Make sure p2pool is not running when you start the browser in read-only mode
- Or use a copy of the database

### "Column family not found"
- Check the column family name spelling (case-insensitive)
- Ensure the database was created with the same column families

### Empty responses
- Verify the database path is correct
- Check if the column family has any data

## License

GNU General Public License v3.0 - See LICENSE file
