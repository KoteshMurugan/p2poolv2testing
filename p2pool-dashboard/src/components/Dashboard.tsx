// src/components/Dashboard.tsx
import { useMetrics } from '../hooks/useMetrics';
import { formatHashrate, formatDifficulty, formatTimestamp, timeAgo } from '../utils/parseMetrics';
import { Activity, Zap, TrendingUp, Clock, Users, Award } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import ChainStats from './ChainStats';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ec4899', '#8b5cf6'];

export default function Dashboard() {
    const { data: metrics, isLoading, error } = useMetrics();

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
                <h3 className="font-semibold">Failed to load metrics</h3>
                <p className="text-sm mt-1">Make sure the P2Pool node is running and the API is accessible.</p>
            </div>
        );
    }

    const uptimeSeconds = metrics.last_update_seconds - metrics.start_time_seconds;
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    const acceptanceRate = metrics.shares_accepted_total > 0
        ? ((metrics.shares_accepted_total / (metrics.shares_accepted_total + metrics.shares_rejected_total)) * 100).toFixed(2)
        : '0.00';

    const pieData = metrics.coinbase_distribution.map((output, index) => ({
        name: `${output.address.slice(0, 8)}...${output.address.slice(-6)}`,
        fullAddress: output.address,
        value: output.amount,
        btc: (output.amount / 1e8).toFixed(8),
    }));

    const workerData = metrics.workers.map(worker => ({
        name: worker.workername || worker.btcaddress.slice(0, 8),
        shares: worker.shares_valid_total,
        bestShare: worker.best_share,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Pool Overview</h2>
                <p className="text-slate-400">Real-time statistics for your P2Pool node</p>
            </div>

            {/* Sharechain Status - NEW SECTION */}
            <ChainStats />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Zap className="w-5 h-5" />}
                    label="Pool Difficulty"
                    value={formatDifficulty(metrics.pool_difficulty)}
                    color="orange"
                />
                <StatCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label="Est. Hashrate"
                    value={formatHashrate(metrics.accepted_difficulty_total / Math.max(uptimeSeconds, 1) * 600)}
                    color="blue"
                />
                <StatCard
                    icon={<Award className="w-5 h-5" />}
                    label="Best Share Ever"
                    value={formatDifficulty(metrics.best_share_ever)}
                    color="green"
                />
                <StatCard
                    icon={<Clock className="w-5 h-5" />}
                    label="Uptime"
                    value={`${uptimeHours}h ${uptimeMinutes}m`}
                    color="purple"
                />
            </div>

            {/* Shares Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-slate-400 text-sm font-medium mb-4">Share Statistics</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Accepted</span>
                            <span className="text-green-400 font-mono">{metrics.shares_accepted_total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Rejected</span>
                            <span className="text-red-400 font-mono">{metrics.shares_rejected_total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Acceptance Rate</span>
                            <span className="text-blue-400 font-mono">{acceptanceRate}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Total Difficulty</span>
                            <span className="text-orange-400 font-mono">{formatDifficulty(metrics.accepted_difficulty_total)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-slate-400 text-sm font-medium mb-4">Current Session</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Best Share</span>
                            <span className="text-yellow-400 font-mono">{formatDifficulty(metrics.best_share)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Active Workers</span>
                            <span className="text-cyan-400 font-mono">{metrics.workers.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Started</span>
                            <span className="text-slate-400 font-mono text-sm">{formatTimestamp(metrics.start_time_seconds)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300">Last Update</span>
                            <span className="text-slate-400 font-mono text-sm">{timeAgo(metrics.last_update_seconds)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-slate-400 text-sm font-medium mb-4">Coinbase Distribution</h3>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {pieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                                                    <p className="text-xs text-slate-400 font-mono">{data.fullAddress}</p>
                                                    <p className="text-sm text-white font-semibold">{data.btc} BTC</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-slate-500">
                            No coinbase data available
                        </div>
                    )}
                </div>
            </div>

            {/* Worker Performance Chart */}
            {workerData.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-slate-400 text-sm font-medium mb-4">Worker Share Distribution</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={workerData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                }}
                                labelStyle={{ color: '#f8fafc' }}
                            />
                            <Bar dataKey="shares" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'orange' | 'blue' | 'green' | 'purple';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
    const colorClasses = {
        orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        green: 'bg-green-500/20 text-green-400 border-green-500/30',
        purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };

    return (
        <div className={`rounded-xl p-5 border ${colorClasses[color]}`}>
            <div className="flex items-center gap-3 mb-3">
                {icon}
                <span className="text-sm text-slate-400">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );
}
