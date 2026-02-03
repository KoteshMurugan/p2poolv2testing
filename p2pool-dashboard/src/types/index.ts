
export interface PoolMetrics {
    shares_accepted_total: number;
    accepted_difficulty_total: number;
    shares_rejected_total: number;
    best_share: number;
    best_share_ever: number;
    pool_difficulty: number;
    start_time_seconds: number;
    last_update_seconds: number;
    workers: WorkerMetrics[];
    coinbase_distribution: CoinbaseOutput[];
}
export interface WorkerMetrics {
    btcaddress: string;
    workername: string;
    shares_valid_total: number;
    best_share: number;
    best_share_ever: number;
    last_share_at: number;
}

export interface CoinbaseOutput {
    index: number;
    address: string;
    amount: number;
}

// PPLNS Share Types
export interface PplnsShare {
    blockhash: string;
    height: number;
    timestamp: number;
    difficulty: number;
    miner_address: string;
    worker_name: string;
}

// Blockchain Types  
export interface ShareBlock {
    blockhash: string;
    prev_share_blockhash: string;
    height: number;
    timestamp: number;
    difficulty: number;
    uncles: string[];
    is_confirmed: boolean;
    cumulative_work: string;
}

export interface ChainTip {
    blockhash: string;
    height: number;
    work: string;
}

// RocksDB Column Family
export interface ColumnFamily {
    name: string;
    description: string;
    keyFormat: string;
    valueFormat: string;
    count?: number;
}

export const COLUMN_FAMILIES: ColumnFamily[] = [
    { name: 'block', description: 'Share blocks', keyFormat: 'BlockHash', valueFormat: 'ShareBlock data' },
    { name: 'block_txids', description: 'Transaction IDs in block', keyFormat: 'BlockHash', valueFormat: 'TxID[]' },
    { name: 'txids_blocks', description: 'Blocks containing TX', keyFormat: 'TxID', valueFormat: 'BlockHash[]' },
    { name: 'uncles', description: 'Uncle relationships', keyFormat: 'Uncle BlockHash', valueFormat: 'Nephew BlockHash[]' },
    { name: 'bitcoin_txids', description: 'Bitcoin transaction IDs', keyFormat: '-', valueFormat: 'TxID[]' },
    { name: 'inputs', description: 'Transaction inputs', keyFormat: '-', valueFormat: 'Input data' },
    { name: 'outputs', description: 'Transaction outputs', keyFormat: '-', valueFormat: 'Output data' },
    { name: 'tx', description: 'Transactions', keyFormat: 'TxID', valueFormat: 'Transaction data' },
    { name: 'block_index', description: 'Parent-child relationships', keyFormat: 'BlockHash + "_bi"', valueFormat: 'Children BlockHash[]' },
    { name: 'block_height', description: 'Blocks at height', keyFormat: 'Height', valueFormat: 'BlockHash[]' },
    { name: 'share', description: 'Share metadata', keyFormat: '-', valueFormat: 'Share data' },
    { name: 'job', description: 'Mining jobs', keyFormat: '-', valueFormat: 'Job data' },
    { name: 'user', description: 'User information', keyFormat: '-', valueFormat: 'User data' },
    { name: 'user_index', description: 'User lookup index', keyFormat: '-', valueFormat: 'Index data' },
    { name: 'metadata', description: 'Block metadata', keyFormat: 'BlockHash', valueFormat: 'Height, work, etc.' },
    { name: 'spends_index', description: 'Spending index', keyFormat: '-', valueFormat: 'Spend data' },
];