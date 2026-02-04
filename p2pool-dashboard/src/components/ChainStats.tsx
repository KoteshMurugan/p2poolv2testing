// src/components/ChainStats.tsx
import { useEffect, useState } from 'react';
import { fetchChainInfo, ChainInfo } from '../api/chainApi';
import { Link2, Layers, Hash, GitBranch, Globe } from 'lucide-react';

export const ChainStats = () => {
    const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const info = await fetchChainInfo();
                setChainInfo(info);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to fetch chain info');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-slate-700 rounded"></div>
                            <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
                <h3 className="font-semibold">Chain API Error</h3>
                <p className="text-sm mt-1">{error}</p>
            </div>
        );
    }

    if (!chainInfo) return null;

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-orange-400" />
                Sharechain Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                        <Globe className="w-4 h-4" />
                        Network
                    </div>
                    <p className="text-white font-semibold capitalize">{chainInfo.network}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                        <Layers className="w-4 h-4" />
                        Height
                    </div>
                    <p className="text-green-400 font-mono text-xl font-bold">
                        {chainInfo.height ?? 'N/A'}
                    </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                        <Hash className="w-4 h-4" />
                        Chain Tip
                    </div>
                    <p className="text-blue-400 font-mono text-sm truncate" title={chainInfo.tip}>
                        {chainInfo.tip.substring(0, 12)}...
                    </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                        <GitBranch className="w-4 h-4" />
                        Uncles
                    </div>
                    <p className="text-yellow-400 font-mono text-xl font-bold">
                        {chainInfo.uncles.length}
                    </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                        <Hash className="w-4 h-4" />
                        Total Work
                    </div>
                    <p className="text-purple-400 font-mono text-sm">
                        {parseInt(chainInfo.total_work, 16) || chainInfo.total_work.substring(0, 8)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChainStats;
