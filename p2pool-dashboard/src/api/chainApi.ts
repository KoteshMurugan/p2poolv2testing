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
