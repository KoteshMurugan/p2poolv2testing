import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    GitBranch,
    Users,
    Database,
    FileStack,
    Activity,
    Network
} from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/blockchain', icon: GitBranch, label: 'Blockchain' },
    { path: '/dag', icon: Network, label: 'DAG View' },
    { path: '/workers', icon: Users, label: 'Workers' },
    { path: '/shares', icon: FileStack, label: 'Shares' },
    { path: '/database', icon: Database, label: 'Database' },
];

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">P2Pool Dashboard</h1>
                            <p className="text-xs text-slate-400">Decentralized Mining Pool</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                            Connected
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <nav className="w-64 bg-slate-800/50 min-h-[calc(100vh-73px)] border-r border-slate-700 p-4">
                    <ul className="space-y-2">
                        {navItems.map(({ path, icon: Icon, label }) => (
                            <li key={path}>
                                <Link
                                    to={path}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${location.pathname === path
                                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    {label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Main content */}
                <main className="flex-1 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}