// src/api/chainApi.ts
const API_BASE = '/api';


export interface ChainInfo {
    tip: string;
    height: number | null;
    total_work: string;
    uncles: string[];
    network: string;
}

export interface SharesAtHeight {
    height: number;
    shares: Array<{
        blockhash: string;
        prev_share_blockhash: string;
    }>;
}

// DAG Types
export interface DagNode {
    hash: string;
    prev_hash: string;
    uncles: string[];
    height: number;
    miner_pubkey: string;
    timestamp: number;
    is_main_chain: boolean;
    is_uncle: boolean;
}

export interface DagEdge {
    from: string;
    to: string;
    edge_type: 'parent' | 'uncle';
}

export interface DagResponse {
    nodes: DagNode[];
    edges: DagEdge[];
    tip_hash: string;
    from_height: number;
    to_height: number;
}

export interface DagQueryParams {
    from_height?: number;
    to_height?: number;
    limit?: number;
}

export const fetchChainInfo = async (): Promise<ChainInfo> => {
    const response = await fetch(`${API_BASE}/chain/info`);
    return response.json();
};

export const fetchChainTip = async (): Promise<{ tip: string }> => {
    const response = await fetch(`${API_BASE}/chain/tip`);
    return response.json();
};

export const fetchChainHeight = async (): Promise<{ height: number | null }> => {
    const response = await fetch(`${API_BASE}/chain/height`);
    return response.json();
};

export const fetchSharesAtHeight = async (height: number): Promise<SharesAtHeight> => {
    const response = await fetch(`${API_BASE}/chain/shares/${height}`);
    return response.json();
};

export const fetchTotalWork = async (): Promise<{ total_work: string }> => {
    const response = await fetch(`${API_BASE}/chain/total_work`);
    return response.json();
};

export const fetchChainLocator = async (): Promise<{ locator: string[] }> => {
    const response = await fetch(`${API_BASE}/chain/locator`);
    return response.json();
};

export const fetchChainDag = async (params?: DagQueryParams): Promise<DagResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.from_height !== undefined) queryParams.set('from_height', params.from_height.toString());
    if (params?.to_height !== undefined) queryParams.set('to_height', params.to_height.toString());
    if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    const url = `${API_BASE}/chain/dag${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url);
    return response.json();
};
