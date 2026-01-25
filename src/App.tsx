import React, { Suspense, lazy, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TitleBar } from './components/TitleBar';
import BenchmarkPage from './pages/Benchmark';
import { Logs } from './pages/Logs';
import { useMinerStore } from './store/useMinerStore';
import { cn } from './lib/utils';
import { Activity, Coins, TrendingUp } from 'lucide-react';

const PoolMonitor = () => {
    const updatePoolStatus = useMinerStore(state => state.updatePoolStatus);

    useEffect(() => {
        const checkSync = async () => {
            // Only check CPU pool - GPU pool not deployed yet
            const poolIds = ['cpu'];
            for (const id of poolIds) {
                try {
                    const res = await window.electron.invoke('get-pool-sync', id);
                    updatePoolStatus(id, res);
                } catch (e) {
                    console.error(`[PoolMonitor] IPC Error for ${id}:`, e);
                    updatePoolStatus(id, { 
                        connected: false, 
                        message: "IPC Failed"
                    });
                }
            }
        };

        checkSync();
        const interval = setInterval(checkSync, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, [updatePoolStatus]);

    return null;
};

const MiningPage = lazy(() => import('./pages/Mining'));
const Dashboard = lazy(() => Promise.resolve({ default: () => {
    const { pools, totalRewards } = useMinerStore();
    const cpuPool = pools['cpu'];
    const navigate = useNavigate();

    const MIN_CLAIM_AMOUNT = 100;
    const canClaim = totalRewards >= MIN_CLAIM_AMOUNT;
    const claimProgress = Math.min((totalRewards / MIN_CLAIM_AMOUNT) * 100, 100);
    
    // Convert $BMT to XMR (example rate: 1000 BMT = 1 XMR)
    const BMT_TO_XMR_RATE = 1000;
    const xmrEquivalent = totalRewards / BMT_TO_XMR_RATE;

    const handleClaimRewards = () => {
        if (canClaim) {
            // TODO: Implement actual claim logic (blockchain transaction)
            alert(`Claiming ${totalRewards.toFixed(2)} $BMT (${xmrEquivalent.toFixed(6)} XMR) rewards!`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-light text-white">Dashboard <span className="text-zinc-600">v1.0</span></h1>
                <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500 uppercase">Status:</span>
                        <span className="text-emerald-400">Multi-Node Active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-xl bg-zinc-900 border border-white/5 p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Estimated Hashrate</h3>
                    <p className="text-3xl font-mono text-white mt-2">0.00 <span className="text-lg text-zinc-500">H/s</span></p>
                </div>
                
                <div className="rounded-xl bg-zinc-900 border border-white/5 p-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Total Rewards</h3>
                    <p className="text-3xl font-mono text-white mt-2">{totalRewards.toFixed(2)} <span className="text-lg text-zinc-500">$BMT</span></p>
                    <p className="text-xs text-zinc-600 mt-1 font-mono">≈ {xmrEquivalent.toFixed(6)} XMR</p>
                </div>

                <div className="rounded-xl bg-zinc-900 border border-white/5 p-6 relative overflow-hidden group hover:border-yellow-500/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">CPU Node Sync</h3>
                    <div className="mt-2">
                        <p className="text-3xl font-mono text-white">
                            {cpuPool.progress.toFixed(1)} <span className="text-lg text-zinc-500">%</span>
                        </p>
                        <div className="mt-2 w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                             <div 
                                className={cn(
                                    "h-full transition-all duration-1000",
                                    cpuPool.isSynced ? "bg-emerald-500" : "bg-yellow-500"
                                )}
                                style={{ width: `${cpuPool.progress}%` }}
                             />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-6">
                    <h3 className="text-white text-sm font-medium mb-4 uppercase tracking-widest text-zinc-500">Infrastructure Status</h3>
                    <div className="space-y-1 font-mono text-xs">
                        {Object.entries(pools).map(([id, pool]) => (
                            <div key={id} className="flex justify-between py-2.5 border-b border-white/5 last:border-0">
                                <span className="text-zinc-500 uppercase">{id} Daemon ({pool.coin})</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-zinc-500">{pool.progress.toFixed(1)}%</span>
                                    <span className={pool.connected ? "text-emerald-400" : "text-yellow-400"}>
                                        {pool.connected ? (pool.isSynced ? "READY" : "SYNCING") : "BUSY"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-6 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <Coins size={20} />
                            </div>
                            <div>
                                <h4 className="text-white font-medium">Rewards Balance</h4>
                                <p className="text-xs text-zinc-500">Accumulated mining rewards</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                                <div>
                                    <div className="text-3xl font-mono text-white">{totalRewards.toFixed(2)} <span className="text-sm text-zinc-500">$BMT</span></div>
                                    <div className="text-xs text-zinc-600 font-mono mt-0.5">≈ {xmrEquivalent.toFixed(6)} XMR</div>
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">Progress to claim</span>
                                    <span className="text-zinc-400">{claimProgress.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden">
                                    <div 
                                        className={cn(
                                            "h-full transition-all duration-500",
                                            canClaim ? "bg-emerald-500" : "bg-blue-500"
                                        )}
                                        style={{ width: `${claimProgress}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-600">
                                    {canClaim ? 'Ready to claim!' : `${(MIN_CLAIM_AMOUNT - totalRewards).toFixed(2)} $BMT more to claim`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleClaimRewards}
                        disabled={!canClaim}
                        className={cn(
                            "w-full mt-4 py-3 rounded-lg font-bold text-sm tracking-wide transition-all transform",
                            canClaim 
                                ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-[0.98]" 
                                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                        )}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <TrendingUp size={16} />
                            {canClaim ? `Claim ${totalRewards.toFixed(2)} $BMT` : `Claim (Min. ${MIN_CLAIM_AMOUNT} $BMT)`}
                        </div>
                    </button>
                 </div>
            </div>
        </div>
    );
} }));

const Placeholder = ({ name }: { name: string }) => <div className="text-2xl font-bold p-6">{name} (Under Construction)</div>;

const App: React.FC = () => {
  return (
    <Router>
        <TitleBar />
        <PoolMonitor />
        <Layout>
            <Suspense fallback={<div className="p-10 text-zinc-500 italic">Loading components...</div>}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/benchmark" element={<BenchmarkPage />} />
                    <Route path="/mining" element={<MiningPage />} />
                    <Route path="/logs" element={<Logs />} />
                    <Route path="/settings" element={<Placeholder name="Settings" />} />
                </Routes>
            </Suspense>
        </Layout>
    </Router>
  );
};

export default App;
