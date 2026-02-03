import { useQuery } from '@tanstack/react-query';
import { parsePrometheusMetrics } from '../utils/parseMetrics';
import { PoolMetrics } from '../types';

export function useMetrics() {
    return useQuery<PoolMetrics>({
        queryKey: ['metrics'],
        queryFn: async () => {
            const response = await fetch('/api/metrics');
            if (!response.ok) throw new Error('Failed to fetch metrics');
            const text = await response.text();
            return parsePrometheusMetrics(text);
        },
        refetchInterval: 5000, // Refresh every 5 seconds
    });
}