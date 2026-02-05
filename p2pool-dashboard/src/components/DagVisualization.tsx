import { useState, useEffect, useRef, useCallback } from 'react';
import { GitBranch, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, Move, MousePointer } from 'lucide-react';
import { fetchChainDag, DagNode, DagEdge, DagResponse } from '../api/chainApi';

interface NodePosition {
    x: number;
    y: number;
    node: DagNode;
}

export default function DagVisualization() {
    const [dagData, setDagData] = useState<DagResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<DagNode | null>(null);
    const [zoom, setZoom] = useState(1);
    const [limit, setLimit] = useState(50);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
    const [autoRefresh, setAutoRefresh] = useState(false);
    
    // Pan state
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [canvasBounds, setCanvasBounds] = useState({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

    const loadDagData = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await fetchChainDag({ limit });
            setDagData(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch DAG data');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        loadDagData();
    }, [loadDagData]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(loadDagData, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, loadDagData]);

    // Calculate node positions for visualization
    useEffect(() => {
        if (!dagData) return;

        const positions = new Map<string, NodePosition>();
        const nodesByHeight = new Map<number, DagNode[]>();

        // Group nodes by height
        dagData.nodes.forEach(node => {
            const nodes = nodesByHeight.get(node.height) || [];
            nodes.push(node);
            nodesByHeight.set(node.height, nodes);
        });

        // Calculate positions
        const horizontalSpacing = 220;
        const verticalSpacing = 120;

        const heights = Array.from(nodesByHeight.keys()).sort((a, b) => b - a); // Descending - newest at top
        
        let minX = Infinity, maxX = -Infinity, minY = 0, maxY = 0;
        
        heights.forEach((height, heightIndex) => {
            const nodesAtHeight = nodesByHeight.get(height) || [];
            const totalWidth = nodesAtHeight.length * horizontalSpacing;
            const startX = -totalWidth / 2 + horizontalSpacing / 2;

            nodesAtHeight.forEach((node, nodeIndex) => {
                const x = startX + nodeIndex * horizontalSpacing;
                const y = heightIndex * verticalSpacing;
                
                positions.set(node.hash, { x, y, node });
                
                minX = Math.min(minX, x - 100);
                maxX = Math.max(maxX, x + 100);
                maxY = Math.max(maxY, y + 80);
            });
        });

        setNodePositions(positions);
        setCanvasBounds({ minX, maxX, minY, maxY });
        
        // Reset pan to show the tip (top of chain)
        setPanOffset({ x: 0, y: 0 });
    }, [dagData]);

    // Draw DAG on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !dagData || nodePositions.size === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const container = canvas.parentElement;
        if (container) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }

        // Clear canvas
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply zoom and pan
        ctx.save();
        ctx.translate(canvas.width / 2 + panOffset.x, 80 + panOffset.y);
        ctx.scale(zoom, zoom);

        // Draw edges first (so they appear behind nodes)
        dagData.edges.forEach(edge => {
            const fromPos = nodePositions.get(edge.from);
            const toPos = nodePositions.get(edge.to);
            if (!fromPos || !toPos) return;

            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y + 70);
            
            if (edge.edge_type === 'uncle') {
                // Dashed line for uncle relationships
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = '#a855f7'; // Purple for uncles
                ctx.lineWidth = 2;
                
                // Curved line for uncle
                const midX = (fromPos.x + toPos.x) / 2;
                const midY = (fromPos.y + toPos.y) / 2;
                const offset = 50;
                ctx.quadraticCurveTo(midX + offset, midY, toPos.x, toPos.y);
            } else {
                // Solid line for parent relationships
                ctx.setLineDash([]);
                ctx.strokeStyle = '#64748b'; // Gray for parent
                ctx.lineWidth = 2;
                ctx.lineTo(toPos.x, toPos.y);
            }
            
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // Draw nodes
        nodePositions.forEach((pos, hash) => {
            const node = pos.node;
            const isSelected = selectedNode?.hash === hash;
            const isTip = dagData.tip_hash === hash;

            // Node background
            ctx.fillStyle = isSelected ? '#f97316' : 
                           isTip ? '#22c55e' :
                           node.is_uncle ? '#a855f7' :
                           node.is_main_chain ? '#3b82f6' : '#6b7280';
            
            // Draw rounded rectangle
            const x = pos.x - 80;
            const y = pos.y;
            const width = 160;
            const height = 70;
            const radius = 8;

            ctx.beginPath();
            ctx.roundRect(x, y, width, height, radius);
            ctx.fill();

            // Border for selected node
            if (isSelected) {
                ctx.strokeStyle = '#fed7aa';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Node text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            
            // Height label
            ctx.fillText(`Height: ${node.height}`, pos.x, pos.y + 18);
            
            // Hash (truncated)
            ctx.font = '10px monospace';
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(`${node.hash.slice(0, 8)}...${node.hash.slice(-6)}`, pos.x, pos.y + 35);
            
            // Status badges
            ctx.font = '9px sans-serif';
            if (isTip) {
                ctx.fillStyle = '#bbf7d0';
                ctx.fillText('TIP', pos.x, pos.y + 52);
            } else if (node.is_uncle) {
                ctx.fillStyle = '#e9d5ff';
                ctx.fillText('UNCLE', pos.x, pos.y + 52);
            } else if (!node.is_main_chain) {
                ctx.fillStyle = '#fecaca';
                ctx.fillText('ORPHAN', pos.x, pos.y + 52);
            }

            // Uncle count badge
            if (node.uncles.length > 0) {
                ctx.fillStyle = '#a855f7';
                ctx.beginPath();
                ctx.arc(pos.x + 70, pos.y + 10, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(node.uncles.length.toString(), pos.x + 70, pos.y + 14);
            }
        });

        ctx.restore();

        // Draw legend (fixed position)
        ctx.font = '12px sans-serif';
        const legendY = canvas.height - 30;
        const legendItems = [
            { color: '#22c55e', label: 'Tip' },
            { color: '#3b82f6', label: 'Main Chain' },
            { color: '#a855f7', label: 'Uncle' },
            { color: '#6b7280', label: 'Orphan' },
        ];
        
        let legendX = 20;
        legendItems.forEach(item => {
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX, legendY, 16, 16);
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(item.label, legendX + 22, legendY + 12);
            legendX += 100;
        });

        // Draw scroll hint
        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Drag to pan • Scroll to zoom', canvas.width - 20, canvas.height - 12);

    }, [dagData, nodePositions, zoom, selectedNode, panOffset]);

    // Handle mouse down - start panning
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    // Handle mouse move - pan if dragging
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isPanning) return;
        
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        setPanOffset(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
        }));
        
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    // Handle mouse up - stop panning
    const handleMouseUp = () => {
        setIsPanning(false);
    };

    // Handle mouse leave - stop panning
    const handleMouseLeave = () => {
        setIsPanning(false);
    };

    // Handle wheel - zoom
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(z => Math.max(0.2, Math.min(3, z + delta)));
    };

    // Handle canvas click to select nodes
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        // Don't select if we were panning
        if (Math.abs(e.clientX - lastMousePos.x) > 5 || Math.abs(e.clientY - lastMousePos.y) > 5) {
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvas.width / 2 - panOffset.x) / zoom;
        const y = (e.clientY - rect.top - 80 - panOffset.y) / zoom;

        // Find clicked node
        for (const [hash, pos] of nodePositions) {
            if (x >= pos.x - 80 && x <= pos.x + 80 && y >= pos.y && y <= pos.y + 70) {
                setSelectedNode(pos.node);
                return;
            }
        }
        setSelectedNode(null);
    };

    // Reset view
    const resetView = () => {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
    };

    // Jump to tip
    const jumpToTip = () => {
        setPanOffset({ x: 0, y: 0 });
    };

    // Jump to bottom (oldest blocks)
    const jumpToBottom = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setPanOffset({ x: 0, y: -(canvasBounds.maxY - canvas.height + 150) * zoom });
    };

    const formatTimestamp = (ts: number) => {
        return new Date(ts * 1000).toLocaleString();
    };

    if (isLoading && !dagData) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (error && !dagData) {
        return (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
                <p className="text-red-400">{error}</p>
                <button onClick={loadDagData} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">DAG Visualization</h2>
                    <p className="text-slate-400">Interactive sharechain DAG with uncle relationships</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600"
                    >
                        <option value={20}>Last 20 blocks</option>
                        <option value={50}>Last 50 blocks</option>
                        <option value={100}>Last 100 blocks</option>
                        <option value={200}>Last 200 blocks</option>
                    </select>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${autoRefresh ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'}`}
                    >
                        <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                        Auto
                    </button>
                    <button
                        onClick={loadDagData}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg flex items-center gap-2 hover:bg-orange-600"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            {dagData && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Total Nodes</p>
                        <p className="text-2xl font-bold text-white">{dagData.nodes.length}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Height Range</p>
                        <p className="text-2xl font-bold text-white">{dagData.from_height} - {dagData.to_height}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Uncle Edges</p>
                        <p className="text-2xl font-bold text-purple-400">
                            {dagData.edges.filter(e => e.edge_type === 'uncle').length}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Tip Hash</p>
                        <p className="text-sm font-mono text-green-400 truncate">{dagData.tip_hash.slice(0, 16)}...</p>
                    </div>
                </div>
            )}

            {/* Controls Bar */}
            <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3 border border-slate-700">
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-sm mr-2">Zoom:</span>
                    <button
                        onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}
                        className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600"
                    >
                        <ZoomOut className="w-4 h-4 text-slate-300" />
                    </button>
                    <span className="text-slate-300 w-14 text-center text-sm">{Math.round(zoom * 100)}%</span>
                    <button
                        onClick={() => setZoom(z => Math.min(3, z + 0.1))}
                        className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600"
                    >
                        <ZoomIn className="w-4 h-4 text-slate-300" />
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-sm mr-2">Navigate:</span>
                    <button
                        onClick={jumpToTip}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                    >
                        ↑ Jump to Tip
                    </button>
                    <button
                        onClick={jumpToBottom}
                        className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
                    >
                        ↓ Jump to Oldest
                    </button>
                    <button
                        onClick={resetView}
                        className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 flex items-center gap-1"
                    >
                        <Maximize2 className="w-4 h-4" />
                        Reset View
                    </button>
                </div>

                <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Move className="w-4 h-4" />
                    <span>Drag to pan</span>
                    <span className="mx-2">•</span>
                    <MousePointer className="w-4 h-4" />
                    <span>Click to select</span>
                </div>
            </div>

            {/* Canvas Container */}
            <div 
                className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden relative" 
                style={{ height: '600px' }}
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleCanvasClick}
                    onWheel={handleWheel}
                    className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                />
                
                {/* Pan position indicator */}
                <div className="absolute bottom-4 left-4 bg-slate-900/80 px-3 py-1 rounded text-xs text-slate-400">
                    Pan: ({Math.round(panOffset.x)}, {Math.round(panOffset.y)}) | Zoom: {Math.round(zoom * 100)}%
                </div>
            </div>

            {/* Selected Node Details */}
            {selectedNode && (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-orange-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <Info className="w-5 h-5 text-orange-400" />
                        <h3 className="text-lg font-semibold text-white">Block Details</h3>
                        <button 
                            onClick={() => setSelectedNode(null)}
                            className="ml-auto text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-slate-400 text-sm">Block Hash</p>
                            <p className="text-white font-mono text-sm break-all">{selectedNode.hash}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Previous Hash</p>
                            <p className="text-white font-mono text-sm break-all">{selectedNode.prev_hash}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Height</p>
                            <p className="text-white text-lg font-bold">{selectedNode.height}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Timestamp</p>
                            <p className="text-white">{formatTimestamp(selectedNode.timestamp)}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Miner Pubkey</p>
                            <p className="text-cyan-400 font-mono text-sm truncate">{selectedNode.miner_pubkey}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Status</p>
                            <div className="flex gap-2">
                                {selectedNode.is_main_chain && (
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">Main Chain</span>
                                )}
                                {selectedNode.is_uncle && (
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">Uncle</span>
                                )}
                                {!selectedNode.is_main_chain && !selectedNode.is_uncle && (
                                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-sm">Orphan</span>
                                )}
                            </div>
                        </div>
                        {selectedNode.uncles.length > 0 && (
                            <div className="md:col-span-2">
                                <p className="text-slate-400 text-sm mb-2">Referenced Uncles ({selectedNode.uncles.length})</p>
                                <div className="space-y-1">
                                    {selectedNode.uncles.map((uncle, idx) => (
                                        <p key={idx} className="text-purple-400 font-mono text-sm">{uncle}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
