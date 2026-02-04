import { usePplnsShares } from '../hooks/usePplnsShares';
import { formatDifficulty, formatTimestamp } from '../utils/parseMetrics';
import { FileStack, RefreshCw, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function SharesTable() {
    const { data: shares, isLoading, error, refetch } = usePplnsShares();
    const [copiedHash, setCopiedHash] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedHash(text);
        setTimeout(() => setCopiedHash(null), 2000);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-red-400">
                <h3 className="font-semibold">Failed to load PPLNS shares</h3>
                <p className="text-sm mt-1">Error: {error.message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">PPLNS Shares</h2>
                    <p className="text-slate-400">Recent shares in the Pay-Per-Last-N-Shares window</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
                        <FileStack className="w-5 h-5 text-orange-400" />
                        <span className="text-white font-semibold">{shares?.length || 0}</span>
                        <span className="text-slate-400">shares</span>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg border border-orange-500/30 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {!shares || shares.length === 0 ? (
                <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
                    <FileStack className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">No Shares Found</h3>
                    <p className="text-slate-500">PPLNS shares will appear here once mining activity starts.</p>
                </div>
            ) : (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Height</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Block Hash</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Miner</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Worker</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Difficulty</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shares.map((share, index) => (
                                    <tr
                                        key={share.blockhash}
                                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${index % 2 === 0 ? 'bg-slate-800/30' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-cyan-400 font-mono font-medium">
                                                #{share.height.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 font-mono text-sm">
                                                    {share.blockhash.slice(0, 12)}...{share.blockhash.slice(-8)}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(share.blockhash)}
                                                    className="p-1 hover:bg-slate-600 rounded transition-colors"
                                                    title="Copy hash"
                                                >
                                                    {copiedHash === share.blockhash ? (
                                                        <Check className="w-4 h-4 text-green-400" />
                                                    ) : (
                                                        <Copy className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-300 font-mono text-sm">
                                                {share.miner_address.slice(0, 10)}...
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-white">
                                                {share.worker_name || 'default'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-orange-400 font-mono">
                                                {formatDifficulty(share.difficulty)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-slate-400 text-sm">
                                                {formatTimestamp(share.timestamp)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
