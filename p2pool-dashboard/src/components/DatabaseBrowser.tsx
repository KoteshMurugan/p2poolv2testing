import { useState, useEffect } from 'react';
import { Database, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ColumnFamily {
    name: string;
    description: string;
    key_format: string;
    value_format: string;
    estimated_entries: number;
}

interface CFEntry {
    key: string;
    value: string;
    size: number;
}

interface EntriesResponse {
    column_family: string;
    entries: CFEntry[];
    page: number;
    page_size: number;
    total_entries: number;
    has_more: boolean;
}

interface CFStats {
    column_family: string;
    total_entries: number;
    estimated_size_bytes: number;
    description: string;
}

export default function DatabaseBrowser() {
    const [columnFamilies, setColumnFamilies] = useState<ColumnFamily[]>([]);
    const [selectedCF, setSelectedCF] = useState<string | null>(null);
    const [entries, setEntries] = useState<CFEntry[]>([]);
    const [stats, setStats] = useState<CFStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalEntries, setTotalEntries] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const pageSize = 50;

    useEffect(() => {
        loadColumnFamilies();
    }, []);

    useEffect(() => {
        if (selectedCF) {
            loadData();
        }
    }, [selectedCF, page]);

    const loadColumnFamilies = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/db/cf`);
            const data = await response.json();
            setColumnFamilies(data.column_families || []);
        } catch (err) {
            console.error('Failed to load CFs:', err);
        }
    };

    const loadData = async () => {
        if (!selectedCF) return;
        setIsLoading(true);
        
        try {
            // Load stats
            const statsResponse = await fetch(`${API_BASE_URL}/db/cf/${selectedCF}/stats`);
            const statsData = await statsResponse.json();
            setStats(statsData);

            // Load entries
            const entriesResponse = await fetch(
                `${API_BASE_URL}/db/cf/${selectedCF}/entries?page=${page}&page_size=${pageSize}`
            );
            const entriesData: EntriesResponse = await entriesResponse.json();
            setEntries(entriesData.entries || []);
            setTotalEntries(entriesData.total_entries || 0);
            setHasMore(entriesData.has_more || false);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCFSelect = (cfName: string) => {
        setSelectedCF(cfName);
        setPage(1);
    };

    const totalPages = Math.ceil(totalEntries / pageSize);
    const selectedCFData = columnFamilies.find(cf => cf.name === selectedCF);

    return (
        <div className="h-screen flex flex-col bg-slate-900">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Database Browser</h1>
                        <p className="text-sm text-slate-400 mt-1">MongoDB Compass-style viewer for RocksDB</p>
                    </div>
                    {selectedCF && (
                        <button
                            onClick={() => loadData()}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Column Families */}
                <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
                    <div className="p-4 border-b border-slate-700">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Database className="w-5 h-5 text-orange-400" />
                            Collections ({columnFamilies.length})
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {columnFamilies.map((cf) => (
                            <button
                                key={cf.name}
                                onClick={() => handleCFSelect(cf.name)}
                                className={`w-full text-left p-4 border-b border-slate-700/50 transition-colors ${
                                    selectedCF === cf.name
                                        ? 'bg-orange-500/20 border-l-4 border-l-orange-500'
                                        : 'hover:bg-slate-700/50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-mono font-medium truncate ${
                                            selectedCF === cf.name ? 'text-orange-400' : 'text-white'
                                        }`}>
                                            {cf.name}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">{cf.description}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-xs text-green-400">
                                                {cf.estimated_entries.toLocaleString()} docs
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-500" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content - Table View */}
                <div className="flex-1 flex flex-col bg-slate-900">
                    {selectedCF && selectedCFData ? (
                        <>
                            {/* Stats Bar */}
                            <div className="bg-slate-800/50 border-b border-slate-700 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-orange-400 font-mono">{selectedCF}</h2>
                                        <p className="text-sm text-slate-400 mt-1">{selectedCFData.description}</p>
                                    </div>
                                    {stats && (
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500">Documents</p>
                                                <p className="text-lg font-bold text-white">{stats.total_entries.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500">Size</p>
                                                <p className="text-lg font-bold text-white">
                                                    {(stats.estimated_size_bytes / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pagination Controls - Top */}
                            {totalPages > 1 && (
                                <div className="bg-slate-800/30 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
                                    <span className="text-sm text-slate-400">
                                        Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalEntries)} of {totalEntries.toLocaleString()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPage(1)}
                                            disabled={page === 1}
                                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded transition-colors"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-sm text-slate-400 px-2">
                                            Page {page} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded transition-colors"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages}
                                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded transition-colors"
                                        >
                                            Last
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="flex-1 overflow-auto">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <Loader2 className="w-12 h-12 text-orange-400 animate-spin mx-auto" />
                                            <p className="text-slate-400 mt-4">Loading data...</p>
                                        </div>
                                    </div>
                                ) : entries.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <Database className="w-16 h-16 text-slate-700 mx-auto" />
                                            <p className="text-slate-400 mt-4 text-lg">No documents found</p>
                                        </div>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-slate-800 sticky top-0 z-10">
                                            <tr>
                                                <th className="text-left p-4 font-semibold text-slate-300 border-b border-slate-700 w-1/3">
                                                    Key
                                                    <span className="text-xs text-slate-500 ml-2">({selectedCFData.key_format})</span>
                                                </th>
                                                <th className="text-left p-4 font-semibold text-slate-300 border-b border-slate-700">
                                                    Value
                                                    <span className="text-xs text-slate-500 ml-2">({selectedCFData.value_format})</span>
                                                </th>
                                                <th className="text-right p-4 font-semibold text-slate-300 border-b border-slate-700 w-24">
                                                    Size
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map((entry, idx) => (
                                                <tr
                                                    key={idx}
                                                    className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                                                >
                                                    <td className="p-4 align-top">
                                                        <pre className="text-sm text-cyan-400 font-mono break-all whitespace-pre-wrap">
                                                            {entry.key}
                                                        </pre>
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <pre className="text-sm text-green-400 font-mono break-all whitespace-pre-wrap max-h-32 overflow-auto">
                                                            {entry.value}
                                                        </pre>
                                                    </td>
                                                    <td className="p-4 text-right align-top">
                                                        <span className="text-sm text-slate-500">
                                                            {entry.size.toLocaleString()}B
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <Database className="w-20 h-20 text-slate-700 mx-auto" />
                                <h3 className="text-xl font-semibold text-slate-300 mt-4">Select a Collection</h3>
                                <p className="text-slate-500 mt-2">Choose a column family from the sidebar to browse data</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
