import { useState, useEffect } from 'react';
import { Database, Search, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ColumnFamily {
    name: string;
    description: string;
    key_format: string;
    value_format: string;
    estimated_entries: number;
}

interface CFStats {
    column_family: string;
    total_entries: number;
    estimated_size_bytes: number;
    description: string;
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

interface GetEntryResponse {
    column_family: string;
    key: string;
    value: string | null;
    found: boolean;
    size: number | null;
}

export default function RocksDBViewer() {
    const [columnFamilies, setColumnFamilies] = useState<ColumnFamily[]>([]);
    const [selectedCF, setSelectedCF] = useState<string | null>(null);
    const [cfStats, setCfStats] = useState<CFStats | null>(null);
    const [entries, setEntries] = useState<CFEntry[]>([]);
    const [searchKey, setSearchKey] = useState('');
    const [searchResult, setSearchResult] = useState<GetEntryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalEntries, setTotalEntries] = useState(0);
    const pageSize = 20;

    // Load column families on mount
    useEffect(() => {
        loadColumnFamilies();
    }, []);

    // Load entries when CF is selected or page changes
    useEffect(() => {
        if (selectedCF) {
            loadCFStats(selectedCF);
            loadEntries(selectedCF, page);
        }
    }, [selectedCF, page]);

    const loadColumnFamilies = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/db/cf`);
            if (!response.ok) throw new Error('Failed to load column families');
            const data = await response.json();
            setColumnFamilies(data.column_families || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const loadCFStats = async (cfName: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/db/cf/${cfName}/stats`);
            if (!response.ok) throw new Error('Failed to load stats');
            const data = await response.json();
            setCfStats(data);
        } catch (err) {
            console.error('Failed to load CF stats:', err);
        }
    };

    const loadEntries = async (cfName: string, pageNum: number) => {
        setIsLoading(true);
        setError(null);
        try {
            // Use page and page_size params as expected by backend
            const response = await fetch(
                `${API_BASE_URL}/db/cf/${cfName}/entries?page=${pageNum}&page_size=${pageSize}`
            );
            if (!response.ok) throw new Error('Failed to load entries');
            const data: EntriesResponse = await response.json();
            setEntries(data.entries || []);
            setTotalEntries(data.total_entries || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load entries');
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!selectedCF || !searchKey.trim()) return;

        setIsSearching(true);
        setError(null);
        setSearchResult(null);
        
        try {
            const response = await fetch(
                `${API_BASE_URL}/db/cf/${selectedCF}/entry/${encodeURIComponent(searchKey)}`
            );
            if (!response.ok) {
                if (response.status === 404) {
                    setError('Key not found');
                } else {
                    throw new Error('Search failed');
                }
                return;
            }
            const data = await response.json();
            if (!data.found) {
                setError('Key not found');
            } else {
                setSearchResult(data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    const handleCFSelect = (cfName: string) => {
        setSelectedCF(cfName);
        setPage(1);
        setSearchKey('');
        setSearchResult(null);
        setError(null);
    };

    const selectedCFData = columnFamilies.find(cf => cf.name === selectedCF);
    const totalPages = Math.ceil(totalEntries / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Database Explorer</h2>
                <p className="text-slate-400">Browse RocksDB column families and query data</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-red-400 font-medium">Error</p>
                        <p className="text-sm text-slate-400 mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column Families List */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Database className="w-5 h-5 text-orange-400" />
                            Column Families ({columnFamilies.length})
                        </h3>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                        {isLoading && columnFamilies.length === 0 ? (
                            <div className="p-8 text-center">
                                <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
                                <p className="text-slate-400 mt-2">Loading...</p>
                            </div>
                        ) : (
                            columnFamilies.map((cf) => (
                                <button
                                    key={cf.name}
                                    onClick={() => handleCFSelect(cf.name)}
                                    className={`w-full flex items-center justify-between p-4 border-b border-slate-700/50 transition-colors ${
                                        selectedCF === cf.name
                                            ? 'bg-orange-500/20 text-orange-400'
                                            : 'hover:bg-slate-700/50 text-slate-300'
                                    }`}
                                >
                                    <div className="text-left flex-1">
                                        <p className="font-mono font-medium">{cf.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{cf.description}</p>
                                        {cf.estimated_entries > 0 && (
                                            <p className="text-xs text-green-400 mt-1">
                                                {cf.estimated_entries.toLocaleString()} entries
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight
                                        className={`w-5 h-5 transition-transform ${
                                            selectedCF === cf.name ? 'rotate-90' : ''
                                        }`}
                                    />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Query Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {selectedCF && selectedCFData ? (
                        <>
                            {/* CF Details */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                <h3 className="text-lg font-semibold text-white mb-4">
                                    <span className="text-orange-400 font-mono">{selectedCF}</span>
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-slate-400">Description</p>
                                        <p className="text-white">{selectedCFData.description}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400">Key Format</p>
                                        <p className="text-cyan-400 font-mono">{selectedCFData.key_format}</p>
                                    </div>
                                    {cfStats && (
                                        <>
                                            <div>
                                                <p className="text-sm text-slate-400">Entry Count</p>
                                                <p className="text-green-400 font-mono">{cfStats.total_entries.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-400">Size</p>
                                                <p className="text-green-400 font-mono">
                                                    {(cfStats.estimated_size_bytes / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Search */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                <h3 className="text-lg font-semibold text-white mb-4">Search by Key</h3>
                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchKey}
                                            onChange={(e) => setSearchKey(e.target.value)}
                                            placeholder={`Enter ${selectedCFData.key_format}...`}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSearch}
                                        disabled={isSearching || !searchKey.trim()}
                                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        {isSearching && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {isSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>

                                {searchResult && searchResult.found && (
                                    <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                                        <p className="text-sm text-slate-400 mb-2">Key:</p>
                                        <pre className="text-sm text-cyan-400 font-mono mb-3 break-all">{searchResult.key}</pre>
                                        <p className="text-sm text-slate-400 mb-2">Value:</p>
                                        <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all">
                                            {searchResult.value}
                                        </pre>
                                        {searchResult.size && (
                                            <p className="text-xs text-slate-500 mt-2">
                                                Size: {searchResult.size.toLocaleString()} bytes
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Entries List */}
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700">
                                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-white">Entries</h3>
                                    <span className="text-sm text-slate-400">
                                        {totalEntries.toLocaleString()} total
                                    </span>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {isLoading ? (
                                        <div className="p-8 text-center">
                                            <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
                                        </div>
                                    ) : entries.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400">
                                            No entries found
                                        </div>
                                    ) : (
                                        entries.map((entry, idx) => (
                                            <div key={idx} className="p-4 border-b border-slate-700/50 hover:bg-slate-700/30">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-400 mb-1">Key:</p>
                                                        <p className="text-cyan-400 font-mono text-sm break-all mb-2">{entry.key}</p>
                                                        <p className="text-sm text-slate-400 mb-1">Value:</p>
                                                        <pre className="text-green-400 font-mono text-xs break-all line-clamp-3">
                                                            {entry.value}
                                                        </pre>
                                                    </div>
                                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                                        {entry.size.toLocaleString()}B
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {totalPages > 1 && (
                                    <div className="p-4 border-t border-slate-700 flex items-center justify-between">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-slate-400">
                                            Page {page} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
                            <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-300 mb-2">Select a Column Family</h3>
                            <p className="text-slate-500">Choose a column family from the list to view details and query data.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
