import { PoolMetrics, WorkerMetrics, CoinbaseOutput } from '../types';

export function parsePrometheusMetrics(text: string): PoolMetrics {
    const lines = text.split('\n');
    const metrics: PoolMetrics = {
        shares_accepted_total: 0,
        accepted_difficulty_total: 0,
        shares_rejected_total: 0,
        best_share: 0,
        best_share_ever: 0,
        pool_difficulty: 0,
        start_time_seconds: 0,
        last_update_seconds: 0,
        workers: [],
        coinbase_distribution: [],
    };

    const workerMap = new Map<string, Partial<WorkerMetrics>>();

    for (const line of lines) {
        if (line.startsWith('#') || line.trim() === '') continue;

        // Parse simple metrics
        const simpleMatch = line.match(/^(\w+)\s+([\d.]+)$/);
        if (simpleMatch) {
            const [, name, value] = simpleMatch;
            switch (name) {
                case 'shares_accepted_total':
                    metrics.shares_accepted_total = parseInt(value) || 0;
                    break;
                case 'accepted_difficulty_total':
                    metrics.accepted_difficulty_total = parseInt(value) || 0;
                    break;
                case 'shares_rejected_total':
                    metrics.shares_rejected_total = parseInt(value) || 0;
                    break;
                case 'best_share':
                    metrics.best_share = parseInt(value) || 0;
                    break;
                case 'best_share_ever':
                    metrics.best_share_ever = parseInt(value) || 0;
                    break;
                case 'pool_difficulty':
                    metrics.pool_difficulty = parseInt(value) || 0;
                    break;
                case 'start_time_seconds':
                    metrics.start_time_seconds = parseInt(value) || 0;
                    break;
                case 'last_update_seconds':
                    metrics.last_update_seconds = parseInt(value) || 0;
                    break;
            }
            continue;
        }

        // Parse worker metrics
        const workerMatch = line.match(/^worker_(\w+)\{btcaddress="([^"]+)",workername="([^"]*)"\}\s+([\d.]+)$/);
        if (workerMatch) {
            const [, metricType, btcaddress, workername, value] = workerMatch;
            const key = `${btcaddress}:${workername}`;

            if (!workerMap.has(key)) {
                workerMap.set(key, { btcaddress, workername });
            }
            const worker = workerMap.get(key)!;

            switch (metricType) {
                case 'shares_valid_total':
                    worker.shares_valid_total = parseInt(value) || 0;
                    break;
                case 'best_share':
                    worker.best_share = parseInt(value) || 0;
                    break;
                case 'best_share_ever':
                    worker.best_share_ever = parseInt(value) || 0;
                    break;
                case 'last_share_at':
                    worker.last_share_at = parseInt(value) || 0;
                    break;
            }
            continue;
        }

        // Parse coinbase outputs
        const coinbaseMatch = line.match(/^coinbase_output\{index="(\d+)",address="([^"]+)"\}\s+(\d+)$/);
        if (coinbaseMatch) {
            const [, index, address, amount] = coinbaseMatch;
            metrics.coinbase_distribution.push({
                index: parseInt(index),
                address,
                amount: parseInt(amount),
            });
        }
    }

    metrics.workers = Array.from(workerMap.values()).map(w => ({
        btcaddress: w.btcaddress || '',
        workername: w.workername || '',
        shares_valid_total: w.shares_valid_total || 0,
        best_share: w.best_share || 0,
        best_share_ever: w.best_share_ever || 0,
        last_share_at: w.last_share_at || 0,
    }));

    return metrics;
}

export function formatHashrate(difficulty: number): string {
    const diff = difficulty || 0;
    const hashrate = diff * Math.pow(2, 32) / 600;
    if (hashrate >= 1e18) return (hashrate / 1e18).toFixed(2) + ' EH/s';
    if (hashrate >= 1e15) return (hashrate / 1e15).toFixed(2) + ' PH/s';
    if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
    if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
    if (hashrate >= 1e6) return (hashrate / 1e6).toFixed(2) + ' MH/s';
    return hashrate.toFixed(2) + ' H/s';
}

export function formatDifficulty(diff: number | undefined | null): string {
    const d = diff || 0;
    if (d >= 1e15) return (d / 1e15).toFixed(2) + ' P';
    if (d >= 1e12) return (d / 1e12).toFixed(2) + ' T';
    if (d >= 1e9) return (d / 1e9).toFixed(2) + ' G';
    if (d >= 1e6) return (d / 1e6).toFixed(2) + ' M';
    if (d >= 1e3) return (d / 1e3).toFixed(2) + ' K';
    return d.toString();
}

export function formatSatoshis(sats: number): string {
    return ((sats || 0) / 1e8).toFixed(8) + ' BTC';
}

export function formatTimestamp(ts: number): string {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleString();
}

export function timeAgo(ts: number): string {
    if (!ts) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - ts);
    if (seconds < 0) return 'Just now';
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}
