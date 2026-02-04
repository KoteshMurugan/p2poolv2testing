import { useState } from 'react';
import { Database, Search, ChevronRight, AlertCircle } from 'lucide-react';
import { COLUMN_FAMILIES, ColumnFamily } from '../types';

export default function RocksDBViewer() {
    const [selectedCF, setSelectedCF] = useState<ColumnFamily | null>(null);
    const [searchKey, setSearchKey] = useState('');
    const [searchResult, setSearchResult] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!selectedCF || !searchKey.trim()) return;

        setIsSearching(true);
        // Note: This requires implementing a database query endpoint
        // For now, showing that the endpoint isn't available
        setTimeout(() => {
            setSearchResult('Database query endpoint not yet implemented. Add GET /api/db/:cf/:key to your API.');
            setIsSearching(false);
        }, 500);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Database Explorer</h2>
                <p className="text-slate-400">Browse RocksDB column families and query data</p>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-blue-400 font-medium">Database API Required</p>
                    <p className="text-sm text-slate-400 mt-1">
                        To enable database queries, implement these endpoints in your Rust API:
                        <code className="ml-2 text-orange-400">GET /api/db/list/:cf</code> and
                        <code className="ml-2 text-orange-400">GET /api/db/get/:cf/:key</code>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column Families List */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Database className="w-5 h-5 text-orange-400" />
                            Column Families
                        </h3>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                        {COLUMN_FAMILIES.map((cf) => (
                            <button
                                key={cf.name}
                                onClick={() => setSelectedCF(cf)}
                                className={`w-full flex items-center justify-between p-4 border-b border-slate-700/50 transition-colors ${selectedCF?.name === cf.name
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : 'hover:bg-slate-700/50 text-slate-300'
                                    }`}
                            >
                                <div className="text-left">
                                    <p className="font-mono font-medium">{cf.name}</p>
                                    <p className="text-xs text-slate-500 mt-1">{cf.description}</p>
                                </div>
                                <ChevronRight className={`w-5 h-5 transition-transform ${selectedCF?.name === cf.name ? 'rotate-90' : ''
                                    }`} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Query Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {selectedCF ? (
                        <>
                            {/* CF Details */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                <h3 className="text-lg font-semibold text-white mb-4">
                                    <span className="text-orange-400 font-mono">{selectedCF.name}</span>
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-slate-400">Description</p>
                                        <p className="text-white">{selectedCF.description}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400">Key Format</p>
                                        <p className="text-cyan-400 font-mono">{selectedCF.keyFormat}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm text-slate-400">Value Format</p>
                                        <p className="text-green-400 font-mono">{selectedCF.valueFormat}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                <h3 className="text-lg font-semibold text-white mb-4">Query Data</h3>
                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchKey}
                                            onChange={(e) => setSearchKey(e.target.value)}
                                            placeholder={`Enter ${selectedCF.keyFormat}...`}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSearch}
                                        disabled={isSearching || !searchKey.trim()}
                                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                                    >
                                        {isSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>

                                {searchResult && (
                                    <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                                        <p className="text-sm text-slate-400 mb-2">Result:</p>
                                        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-all">
                                            {searchResult}
                                        </pre>
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
