import { useQuery } from '@tanstack/react-query';
import { PplnsShare } from '../types';

interface PplnsQueryParams {
    limit?: number;
    start_time?: string;
    end_time?: string;
}

export function usePplnsShares(params: PplnsQueryParams = {}) {
    return useQuery<PplnsShare[]>({
        queryKey: ['pplns_shares', params],
        queryFn: async () => {
            const searchParams = new URLSearchParams();
            if (params.limit) searchParams.set('limit', params.limit.toString());
            if (params.start_time) searchParams.set('start_time', params.start_time);
            if (params.end_time) searchParams.set('end_time', params.end_time);

            const response = await fetch(`/api/pplns_shares?${searchParams}`);
            if (!response.ok) throw new Error('Failed to fetch PPLNS shares');
            return response.json();
        },
        refetchInterval: 10000,
    });
}