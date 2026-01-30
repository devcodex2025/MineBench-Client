import React, { Suspense, lazy, useEffect, useState } from 'react';
import { MemoryRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TitleBar } from './components/TitleBar';
import BenchmarkPage from './pages/Benchmark';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { MiningStatistics } from './pages/Statistics';
import { ThemeProvider } from './contexts/ThemeContext';
import { useTheme } from './contexts/ThemeContext';
import { useMinerStore } from './store/useMinerStore';
import { cn, formatHashrate } from './lib/utils';
import { Activity, Coins, TrendingUp, AlertTriangle, X } from 'lucide-react';

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

// Linux Display Warning Banner
const DisplayWarningBanner = () => {
    const { theme } = useTheme();
    const [displayStatus, setDisplayStatus] = useState<any>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (window.electron?.getDisplayStatus) {
            window.electron.getDisplayStatus().then(status => {
                setDisplayStatus(status);
            }).catch(err => {
                console.error('Failed to get display status:', err);
            });
        }
    }, []);

    if (!displayStatus || dismissed || displayStatus.displayWarnings.length === 0) {
        return null;
    }

    return (
        <div className={cn(
            "w-full px-4 py-3 flex items-start gap-3 border-b",
            theme === 'light'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-yellow-950/30 border-yellow-900/50'
        )}>
            <AlertTriangle size={18} className={cn(
                "flex-shrink-0 mt-0.5",
                theme === 'light' ? 'text-yellow-700' : 'text-yellow-500'
            )} />
            <div className="flex-1 text-sm">
                <p className={cn("font-medium mb-1", theme === 'light' ? 'text-yellow-900' : 'text-yellow-200')}>
                    Display Configuration Issue
                </p>
                <ul className={cn("text-xs space-y-0.5 ml-4 list-disc", theme === 'light' ? 'text-yellow-800' : 'text-yellow-300')}>
                    {displayStatus.displayWarnings.map((warning: string, i: number) => (
                        <li key={i}>{warning}</li>
                    ))}
                </ul>
                {displayStatus.isLinux && (
                    <p className={cn("text-xs mt-2", theme === 'light' ? 'text-yellow-700' : 'text-yellow-400')}>
                        <strong>Solution:</strong> Run without sudo: <code className={cn("px-1 rounded", theme === 'light' ? 'bg-yellow-100' : 'bg-black/30')}>./MineBench\ Client-0.3.0.AppImage</code>
                    </p>
                )}
            </div>
            <button
                onClick={() => setDismissed(true)}
                className={cn(
                    "flex-shrink-0 p-1 rounded hover:bg-yellow-200/50 transition-colors",
                    theme === 'light' ? 'text-yellow-600' : 'text-yellow-400'
                )}
                aria-label="Dismiss warning"
            >
                <X size={16} />
            </button>
        </div>
    );
};

const MiningPage = lazy(() => import('./pages/Mining'));

const Dashboard = () => {
    const { pools, totalRewards, deviceType } = useMinerStore();
    const { theme } = useTheme();
    const cpuPool = pools['cpu'];
    const navigate = useNavigate();
    const [estimatedHashrate, setEstimatedHashrate] = useState<number>(0);
    const [lastBenchmarkDate, setLastBenchmarkDate] = useState<Date | null>(null);
    
    // Load latest benchmark from Supabase on mount and when deviceType changes
    useEffect(() => {
        const fetchLatestBenchmark = async () => {
            try {
                const result = await window.electron.invoke('get-latest-benchmark', deviceType);
                if (result?.avg_hashrate) {
                    setEstimatedHashrate(result.avg_hashrate);
                    if (result.created_at) {
                        setLastBenchmarkDate(new Date(result.created_at));
                    }
                }
            } catch (e) {
                console.warn('Failed to load benchmark from DB:', e);
            }
        };
        fetchLatestBenchmark();
    }, [deviceType]);

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
                <h1 className={cn("text-3xl font-light", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Dashboard</h1>
                <div className={cn("flex items-center gap-4 text-xs font-mono", theme === 'light' ? 'text-zinc-700' : '')}>
                    <div className="flex items-center gap-2">
                        <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Status:</span>
                        <span className={cn(
                          theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
                        )}>Multi-Node Active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className={cn("rounded-xl border p-6 relative overflow-hidden group transition-colors",
                                    theme === 'light'
                                        ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400'
                                        : 'bg-zinc-900 border-white/5 hover:border-emerald-500/30'
                                )}>
                                        <div className={cn("absolute inset-0 opacity-30 group-hover:opacity-100 transition-opacity",
                                            theme === 'light'
                                                ? 'bg-gradient-to-br from-emerald-300/30 to-transparent'
                                                : 'bg-gradient-to-br from-emerald-500/10 to-transparent'
                                        )} />
                    <h3 className={cn("text-sm font-medium uppercase tracking-wider", theme === 'light' ? 'text-zinc-600' : 'text-zinc-400')}>Estimated Hashrate</h3>
                    <p className={cn("text-3xl font-mono mt-2", theme === 'light' ? 'text-zinc-900' : 'text-white')}>{formatHashrate(estimatedHashrate)} <span className={cn("text-lg", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>H/s</span></p>
                    {lastBenchmarkDate && (
                        <p className={cn("text-xs mt-1 font-mono", theme === 'light' ? 'text-zinc-600' : 'text-zinc-600')}>
                            {deviceType.toUpperCase()} · Last benchmark: {lastBenchmarkDate.toLocaleDateString()}
                        </p>
                    )}
                </div>
                
                                <div className={cn("rounded-xl border p-6 relative overflow-hidden group transition-colors",
                                    theme === 'light'
                                        ? 'bg-blue-50 border-blue-200 hover:border-blue-400'
                                        : 'bg-zinc-900 border-white/5 hover:border-blue-500/30'
                                )}>
                                        <div className={cn("absolute inset-0 opacity-30 group-hover:opacity-100 transition-opacity",
                                            theme === 'light'
                                                ? 'bg-gradient-to-br from-blue-300/30 to-transparent'
                                                : 'bg-gradient-to-br from-blue-500/10 to-transparent'
                                        )} />
                    <h3 className={cn("text-sm font-medium uppercase tracking-wider", theme === 'light' ? 'text-zinc-600' : 'text-zinc-400')}>Total Rewards</h3>
                    <p className={cn("text-3xl font-mono mt-2", theme === 'light' ? 'text-zinc-900' : 'text-white')}>{totalRewards.toFixed(2)} <span className={cn("text-lg", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>$BMT</span></p>
                    <p className={cn("text-xs mt-1 font-mono", theme === 'light' ? 'text-zinc-600' : 'text-zinc-600')}>≈ {xmrEquivalent.toFixed(6)} XMR</p>
                </div>

                                <div className={cn("rounded-xl border p-6 relative overflow-hidden group transition-colors",
                                    theme === 'light'
                                        ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'
                                        : 'bg-zinc-900 border-white/5 hover:border-yellow-500/30'
                                )}>
                                        <div className={cn("absolute inset-0 opacity-30 group-hover:opacity-100 transition-opacity",
                                            theme === 'light'
                                                ? 'bg-gradient-to-br from-yellow-300/30 to-transparent'
                                                : 'bg-gradient-to-br from-yellow-500/5 to-transparent'
                                        )} />
                    <h3 className={cn("text-sm font-medium uppercase tracking-wider", theme === 'light' ? 'text-zinc-600' : 'text-zinc-400')}>CPU Node Sync</h3>
                    <div className="mt-2">
                        <p className={cn("text-3xl font-mono", theme === 'light' ? 'text-zinc-900' : 'text-white')}>
                            {cpuPool.progress.toFixed(1)} <span className={cn("text-lg", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>%</span>
                        </p>
                        <div className={cn("mt-2 w-full h-1.5 rounded-full overflow-hidden", theme === 'light' ? 'bg-zinc-200' : 'bg-zinc-950')}>
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
                 <div className={cn("border rounded-xl p-6",
                   theme === 'light'
                     ? 'bg-white border-zinc-200'
                     : 'bg-zinc-900/40 border-white/5'
                 )}>
                    <h3 className={cn("text-sm font-medium mb-4 uppercase tracking-widest", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>Infrastructure Status</h3>
                    <div className={cn("space-y-1 font-mono text-xs", theme === 'light' ? 'text-zinc-700' : 'text-zinc-400')}>
                        {Object.entries(pools).map(([id, pool]) => (
                            <div key={id} className={cn("flex justify-between py-2.5 border-b last:border-0", theme === 'light' ? 'border-zinc-200' : 'border-white/5')}>
                                <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>{id} Daemon ({pool.coin})</span>
                                <div className="flex items-center gap-3">
                                    <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>{pool.progress.toFixed(1)}%</span>
                                                                        <span className={pool.connected
                                                                            ? cn(theme === 'light' ? 'text-emerald-600' : 'text-emerald-400')
                                                                            : 'text-yellow-400'}>
                                                                                {pool.connected ? (pool.isSynced ? "READY" : "SYNCING") : "BUSY"}
                                                                        </span>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className={cn("border rounded-xl p-6 flex flex-col justify-between",
                   theme === 'light'
                     ? 'bg-white border-zinc-200'
                     : 'bg-zinc-900/40 border-white/5'
                 )}>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center",
                              theme === 'light'
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-emerald-500/10 text-emerald-500'
                            )}>
                                <Coins size={20} />
                            </div>
                            <div>
                                <h4 className={cn("font-medium", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Rewards Balance</h4>
                                <p className={cn("text-xs", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>Accumulated mining rewards</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                                <div>
                                    <div className={cn("text-3xl font-mono", theme === 'light' ? 'text-zinc-900' : 'text-white')}>{totalRewards.toFixed(2)} <span className={cn("text-sm", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>$BMT</span></div>
                                    <div className={cn("text-xs font-mono mt-0.5", theme === 'light' ? 'text-zinc-600' : 'text-zinc-600')}>≈ {xmrEquivalent.toFixed(6)} XMR</div>
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Progress to claim</span>
                                    <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}>{claimProgress.toFixed(1)}%</span>
                                </div>
                                <div className={cn("w-full h-2 rounded-full overflow-hidden", theme === 'light' ? 'bg-zinc-200' : 'bg-zinc-950')}>
                                    <div 
                                        className={cn(
                                            "h-full transition-all duration-500",
                                            canClaim ? "bg-emerald-500" : "bg-blue-500"
                                        )}
                                        style={{ width: `${claimProgress}%` }}
                                    />
                                </div>
                                <p className={cn("text-[10px]", theme === 'light' ? 'text-zinc-600' : 'text-zinc-600')}>
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
                                : theme === 'light'
                                ? "bg-zinc-300 text-zinc-500 cursor-not-allowed"
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
};

const Placeholder = ({ name }: { name: string }) => <div className="text-2xl font-bold p-6">{name} (Under Construction)</div>;

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
          <TitleBar />
          <DisplayWarningBanner />
          <PoolMonitor />
          <Layout>
              <Suspense fallback={<div className="p-10 text-zinc-500 italic">Loading components...</div>}>
                  <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/benchmark" element={<BenchmarkPage />} />
                      <Route path="/mining" element={<MiningPage />} />
                      <Route path="/statistics" element={<MiningStatistics />} />
                      <Route path="/logs" element={<Logs />} />
                      <Route path="/settings" element={<Settings />} />
                  </Routes>
              </Suspense>
          </Layout>
      </Router>
    </ThemeProvider>
  );
};

export default App;
