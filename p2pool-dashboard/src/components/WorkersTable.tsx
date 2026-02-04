import { useMetrics } from '../hooks/useMetrics';
import { formatDifficulty, timeAgo } from '../utils/parseMetrics';
import { Users, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function WorkersTable() {
    const { data: metrics, isLoading, error } = useMetrics();
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedAddress(text);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-red-400">
                <h3 className="font-semibold">Failed to load worker data</h3>
            </div>
        );
    }

    const workers = metrics.workers;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Workers</h2>
                    <p className="text-slate-400">Connected mining workers and their statistics</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
                    <Users className="w-5 h-5 text-orange-400" />
                    <span className="text-white font-semibold">{workers.length}</span>
                    <span className="text-slate-400">active</span>
                </div>
            </div>

            {workers.length === 0 ? (
                <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">No Workers Connected</h3>
                    <p className="text-slate-500">Workers will appear here once they start submitting shares.</p>
                </div>
            ) : (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Worker</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">BTC Address</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Valid Shares</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Best Share</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Best Ever</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Last Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workers.map((worker, index) => (
                                    <tr
                                        key={`${worker.btcaddress}-${worker.workername}`}
                                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${index % 2 === 0 ? 'bg-slate-800/30' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-white font-medium">
                                                {worker.workername || 'default'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 font-mono text-sm">
                                                    {worker.btcaddress.slice(0, 12)}...{worker.btcaddress.slice(-8)}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(worker.btcaddress)}
                                                    className="p-1 hover:bg-slate-600 rounded transition-colors"
                                                    title="Copy address"
                                                >
                                                    {copiedAddress === worker.btcaddress ? (
                                                        <Check className="w-4 h-4 text-green-400" />
                                                    ) : (
                                                        <Copy className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-green-400 font-mono">
                                                {worker.shares_valid_total.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-yellow-400 font-mono">
                                                {formatDifficulty(worker.best_share)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-orange-400 font-mono">
                                                {formatDifficulty(worker.best_share_ever)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-slate-400">
                                                {worker.last_share_at > 0 ? timeAgo(worker.last_share_at) : 'Never'}
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
