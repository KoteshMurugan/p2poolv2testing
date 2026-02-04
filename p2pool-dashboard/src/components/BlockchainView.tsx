import { useState, useEffect } from 'react';
import { GitBranch, ChevronRight, Clock, Hash, Activity } from 'lucide-react';
import { ShareBlock, ChainTip } from '../types';
import { formatTimestamp, timeAgo } from '../utils/parseMetrics';

export default function BlockchainView() {
    const [chainTip, setChainTip] = useState<ChainTip | null>(null);
    const [blocks, setBlocks] = useState<ShareBlock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBlock, setSelectedBlock] = useState<ShareBlock | null>(null);

    // Note: You'll need to add these API endpoints to your backend
    useEffect(() => {
        const fetchChainData = async () => {
            try {
                // These endpoints need to be implemented in your Rust API
                // For now, showing placeholder UI
                setIsLoading(false);
            } catch (err) {
                setError('Chain data endpoints not yet implemented');
                setIsLoading(false);
            }
        };
        fetchChainData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Share Chain</h2>
                <p className="text-slate-400">P2Pool sharechain blocks and tips</p>
            </div>

            {/* Chain Tip Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                        <Activity className="w-5 h-5 text-green-400" />
                        <span className="text-sm text-slate-400">Chain Height</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        {chainTip?.height?.toLocaleString() || '---'}
                    </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                        <Hash className="w-5 h-5 text-orange-400" />
                        <span className="text-sm text-slate-400">Tip Hash</span>
                    </div>
                    <p className="text-sm font-mono text-slate-300 truncate">
                        {chainTip?.blockhash || 'Not available'}
                    </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                        <GitBranch className="w-5 h-5 text-blue-400" />
                        <span className="text-sm text-slate-400">Cumulative Work</span>
                    </div>
                    <p className="text-xl font-bold text-white">
                        {chainTip?.work || '---'}
                    </p>
                </div>
            </div>

            {/* Visual Chain Representation */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Blocks</h3>

                {blocks.length === 0 ? (
                    <div className="text-center py-12">
                        <GitBranch className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">Chain Data Not Available</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            To display sharechain blocks, implement the following API endpoints:
                        </p>
                        <div className="mt-4 bg-slate-900 rounded-lg p-4 text-left max-w-md mx-auto">
                            <code className="text-sm text-orange-400">
                                GET /api/chain/tip<br />
                                GET /api/chain/blocks?limit=50<br />
                                GET /api/chain/block/:hash
                            </code>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {blocks.map((block, index) => (
                            <div
                                key={block.blockhash}
                                onClick={() => setSelectedBlock(block)}
                                className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all ${selectedBlock?.blockhash === block.blockhash
                                    ? 'bg-orange-500/20 border border-orange-500/30'
                                    : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
                                    }`}
                            >
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${block.is_confirmed ? 'bg-green-500/20' : 'bg-yellow-500/20'
                                        }`}>
                                        <span className={`text-xs font-bold ${block.is_confirmed ? 'text-green-400' : 'text-yellow-400'
                                            }`}>
                                            {index + 1}
                                        </span>
                                    </div>
                                    {index < blocks.length - 1 && (
                                        <div className="w-0.5 h-6 bg-slate-600 mt-1"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-cyan-400 font-mono font-semibold">
                                            #{block.height}
                                        </span>
                                        {block.uncles.length > 0 && (
                                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                                                {block.uncles.length} uncle{block.uncles.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 font-mono text-sm truncate">
                                        {block.blockhash}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-300 text-sm">{timeAgo(block.timestamp)}</p>
                                    <p className="text-slate-500 text-xs">Diff: {block.difficulty}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-500" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Block Details Panel */}
            {selectedBlock && (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-orange-500/30">
                    <h3 className="text-lg font-semibold text-white mb-4">Block Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailRow label="Block Hash" value={selectedBlock.blockhash} mono />
                        <DetailRow label="Previous Hash" value={selectedBlock.prev_share_blockhash} mono />
                        <DetailRow label="Height" value={selectedBlock.height.toLocaleString()} />
                        <DetailRow label="Timestamp" value={formatTimestamp(selectedBlock.timestamp)} />
                        <DetailRow label="Difficulty" value={selectedBlock.difficulty.toLocaleString()} />
                        <DetailRow label="Cumulative Work" value={selectedBlock.cumulative_work} />
                        <DetailRow label="Status" value={selectedBlock.is_confirmed ? 'Confirmed' : 'Pending'} />
                        <DetailRow label="Uncles" value={selectedBlock.uncles.length.toString()} />
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">{label}</span>
            <span className={`text-white ${mono ? 'font-mono text-sm break-all' : ''}`}>{value}</span>
        </div>
    );
}
