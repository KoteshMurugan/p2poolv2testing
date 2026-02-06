
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
