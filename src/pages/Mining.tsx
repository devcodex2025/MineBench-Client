import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Play, Square, Flame, Gauge, Zap, Shield, Cpu, TrendingUp, Clock, Activity } from 'lucide-react';
import { useMinerStore } from '../store/useMinerStore';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatHashrate } from '../lib/utils';

// Chart component for hashrate visualization
const HashRateChart: React.FC<{ data: any[]; theme: string }> = ({ data, theme }) => (
    <div className={cn("border rounded-xl p-6 space-y-4",
        theme === 'light'
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900/50 border-white/10'
    )}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <TrendingUp className="text-emerald-500" size={18} />
                <span className={cn("text-sm font-semibold", theme === 'light' ? 'text-zinc-900' : 'text-white')}>
                    Hashrate Performance
                </span>
            </div>
            <span className={cn("text-xs px-2 py-1 rounded-full", theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-zinc-400')}>
                Real-time
            </span>
        </div>

        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorHashrate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e4e4e7' : '#27272a'} />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#71717a' : '#a1a1aa'} />
                    <YAxis tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#71717a' : '#a1a1aa'} />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: theme === 'light' ? '#fafafa' : '#18181b',
                            border: `1px solid ${theme === 'light' ? '#e4e4e7' : '#27272a'}`,
                            borderRadius: '8px'
                        }}
                        formatter={(value) => [formatHashrate(value as number), 'H/s']}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="hashrate" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorHashrate)" 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
);

const Mining: React.FC = () => {
    const { theme } = useTheme();
    const status = useMinerStore((state) => state.status);
    const setStatus = useMinerStore((state) => state.setStatus);
    const addLog = useMinerStore((state) => state.addLog);
    const deviceType = useMinerStore((state) => state.deviceType);
    const setDeviceType = useMinerStore((state) => state.setDeviceType);
    const wallet = useMinerStore((state) => state.wallet);
    const workerName = useMinerStore((state) => state.workerName);
    const updateStats = useMinerStore((state) => state.updateStats);
    const history = useMinerStore((state) => state.history);
    const currentHashrate = useMinerStore((state) => state.currentHashrate);
    const currentTemp = useMinerStore((state) => state.currentTemp);
    const currentPower = useMinerStore((state) => state.currentPower);
    const sessionRewards = useMinerStore((state) => state.sessionRewards);
    const resetSession = useMinerStore((state) => state.resetSession);
    
    const threads = useMinerStore((state) => state.threads);
    const setThreads = useMinerStore((state) => state.setThreads);
    const cpuName = useMinerStore((state) => state.cpuName);
    const cpuCores = useMinerStore((state) => state.cpuCores);
    const setCpuInfo = useMinerStore((state) => state.setCpuInfo);

    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [peakHashrate, setPeakHashrate] = useState(0);

    // Load CPU info
    useEffect(() => {
        const loadCpuInfo = async () => {
            try {
                const name = await window.electron.invoke('get-cpu-name');
                const cores = await window.electron.invoke('get-cpu-cores');
                setCpuInfo(name, cores);
            } catch (err) {
                console.error('Failed to load CPU info:', err);
            }
        };
        loadCpuInfo();
    }, [setCpuInfo]);

    useEffect(() => {
        if (!window.electron.on) return;
        const offLog = window.electron.on('miner-log', (msg: string) => {
            const line = msg.toLowerCase();
            if (line.includes('connection refused') || (line.includes('error') && line.includes('connect'))) {
                setStatus('error');
                addLog('❌ Connection error');
            }
            if (line.includes('connected') || line.includes('login succeeded') || line.includes('new job')) {
                if (status === 'starting') setStatus('running');
            }
        });
        return () => { if (offLog) offLog(); };
    }, [setStatus, addLog, status]);

    useEffect(() => {
        return () => {
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
            if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (status === 'idle') return;
        statsIntervalRef.current = setInterval(fetchStats, 3500);
        return () => {
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        };
    }, [status, deviceType]);

    useEffect(() => {
        if (status !== 'running') {
            if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
            return;
        }
        timeIntervalRef.current = setInterval(() => {
            setElapsedTime((t) => t + 1);
        }, 1000);
        return () => {
            if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        };
    }, [status]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const fetchStats = async () => {
        try {
            const actualUrl = deviceType === 'cpu'
                ? 'http://127.0.0.1:4077/2/summary'
                : 'http://127.0.0.1:4067/summary';

            const res = await fetch(actualUrl).catch(() => null);
            if (!res || !res.ok) return;

            const data = await res.json();
            let hr = 0;
            let temp: number | null = null;
            let power = 0;

            if (deviceType === 'cpu') {
                hr = data.hashrate?.total?.[0] ?? 0;
                const tempRes = await window.electron.invoke('get-cpu-temp');
                if (tempRes && tempRes.success) temp = tempRes.temp;
            } else if (data.gpus && data.gpus.length > 0) {
                hr = data.gpus[0].hashrate ?? data.gpus[0].hash ?? 0;
                temp = data.gpus[0].temperature ?? data.gpus[0].temp ?? 0;
                power = data.gpus[0].power ?? 0;
                window.electron.invoke('report-stats', { temp, power });
            }

            if (hr > 0) {
                updateStats(hr, temp, power);
                if (hr > peakHashrate) setPeakHashrate(hr);
            }
        } catch (err) {
            // ignore transient errors
        }
    };

    const startMining = async () => {
        if (status === 'running' || status === 'starting') return;
        resetSession();
        setElapsedTime(0);
        setPeakHashrate(0);

        try {
            await window.electron.invoke('start-mining', {
                type: deviceType,
                wallet,
                worker: workerName,
                threads: deviceType === 'cpu' ? threads : undefined,
            });

            setStatus('starting');
            addLog(`⚙️ Starting mining with ${threads} threads...`);
            fetchStats();
        } catch (err: any) {
            setStatus('error');
            addLog(`❌ Error: ${err.message}`);
        }
    };

    const stopMining = async () => {
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        setStatus('stopping');
        try {
            await window.electron.invoke('stop-mining', {});
            setStatus('completed');
            addLog('⏹️ Mining stopped');
        } catch (err: any) {
            setStatus('error');
            addLog(`❌ Error: ${err.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={cn("text-3xl font-light", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Mining Mode</h1>
                    <p className="text-zinc-500 mt-1">Real-time hashrate tracking and earnings.</p>
                </div>

                {/* Status Badge */}
                <div className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium',
                    status === 'running' ? (theme === 'light' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400') :
                    status === 'starting' ? (theme === 'light' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-amber-500/40 bg-amber-500/10 text-amber-400') :
                    status === 'error' ? (theme === 'light' ? 'border-red-400 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-400') :
                    (theme === 'light' ? 'border-zinc-300 bg-zinc-100 text-zinc-600' : 'border-white/10 bg-white/5 text-zinc-400')
                )}>
                    <span className={cn('w-2 h-2 rounded-full',
                        status === 'running' ? 'bg-emerald-400' :
                        status === 'starting' ? 'bg-amber-400 animate-pulse' :
                        status === 'error' ? 'bg-red-400' : 'bg-zinc-500'
                    )}></span>
                    <span>
                        {status === 'running' ? '🟢 Connected' :
                         status === 'starting' ? '🟡 Connecting…' :
                         status === 'completed' ? '✅ Completed' :
                         status === 'error' ? '🔴 Error' : '⚫ Idle'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="xl:col-span-2">
                    <HashRateChart data={history} theme={theme} />
                </div>

                {/* Right Panel */}
                <div className="space-y-4">
                    {/* CPU Info */}
                    {deviceType === 'cpu' && cpuName && (
                        <div className={cn("border rounded-xl p-4 space-y-3",
                            theme === 'light'
                                ? 'bg-white border-zinc-200'
                                : 'bg-zinc-900/50 border-white/10'
                        )}>
                            <div className={cn("flex items-center gap-2",
                                theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
                            )}>
                                <Cpu size={16} />
                                <span className="font-medium text-sm">CPU Information</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Processor:</span>
                                    <span className={cn("font-mono text-right max-w-[120px] truncate", theme === 'light' ? 'text-zinc-900' : 'text-zinc-300')} title={cpuName}>
                                        {cpuName}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Cores:</span>
                                    <span className={cn("font-mono", theme === 'light' ? 'text-zinc-900' : 'text-zinc-300')}>{cpuCores}</span>
                                </div>
                            </div>

                            {/* Threads Slider */}
                            <div className={cn("pt-2 space-y-2", theme === 'light' ? 'border-t border-zinc-200' : 'border-t border-white/5')}>
                                <div className="flex justify-between items-center">
                                    <label className={cn("text-xs", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>Threads:</label>
                                    <span className={cn("text-sm font-mono",
                                        theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
                                    )}>{threads} / {cpuCores}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max={cpuCores}
                                    value={threads}
                                    onChange={(e) => setThreads(Number(e.target.value))}
                                    disabled={status === 'running' || status === 'starting'}
                                    className={cn("w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer",
                                        theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-800'
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className={cn("border rounded-xl p-6 space-y-4",
                        theme === 'light'
                            ? 'bg-white border-zinc-200'
                            : 'bg-zinc-900/50 border-white/10'
                    )}>
                        <div className="flex items-center justify-between">
                            <span className={cn("text-sm font-semibold", theme === 'light' ? 'text-zinc-700' : 'text-zinc-300')}>Live Metrics</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <MetricCard label="H/s" value={formatHashrate(currentHashrate)} color="emerald" theme={theme} />
                            <MetricCard label="Peak" value={formatHashrate(peakHashrate)} color="cyan" theme={theme} />
                            <MetricCard label="Temp" value={currentTemp ? `${currentTemp.toFixed(0)}°C` : '-'} color="orange" theme={theme} />
                            <MetricCard label="Time" value={formatTime(elapsedTime)} color="purple" theme={theme} />
                        </div>

                        {/* Control Button */}
                        <button
                            onClick={status === 'running' || status === 'starting' ? stopMining : startMining}
                            disabled={status === 'starting'}
                            className={cn(
                                'w-full py-4 rounded-lg font-bold text-sm tracking-wide transition-all transform active:scale-[0.98] disabled:opacity-50',
                                status === 'running' || status === 'starting'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                    : (theme === 'light'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                                        : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]')
                            )}
                        >
                            {status === 'running' ? <><Square size={18} /> Stop Mining</> : 
                             status === 'starting' ? <><Activity size={18} className="animate-spin" /> Connecting...</> :
                             <><Play size={18} /> Start Mining</>}
                        </button>

                        <p className={cn("text-xs text-center", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
                            Wallet {wallet.slice(0, 8)}...
                        </p>
                    </div>

                    {/* Rewards */}
                    <div className={cn("border rounded-xl p-4 space-y-2",
                        theme === 'light'
                            ? 'bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-200'
                            : 'bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/20'
                    )}>
                        <div className={cn("flex items-center gap-2 text-sm font-semibold",
                            theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                        )}>
                            <Shield size={16} />
                            Rewards
                        </div>
                        <div className={cn("text-2xl font-bold", theme === 'light' ? 'text-emerald-900' : 'text-emerald-300')}>
                            {sessionRewards.toFixed(6)} BMT
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon, theme }: { label: string; value: string; icon: React.ReactNode; theme: string }) => (
    <div className={cn("rounded-lg border p-3 flex flex-col gap-1",
      theme === 'light'
        ? 'bg-white border-zinc-200'
        : 'bg-zinc-950/70 border-white/5'
    )}>
        <div className={cn("flex items-center gap-2 text-xs uppercase tracking-widest", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
            {icon}
            <span>{label}</span>
        </div>
        <div className={cn("text-lg font-mono", theme === 'light' ? 'text-zinc-900' : 'text-white')}>{value}</div>
    </div>
);

const MetricCard = ({ label, value, color, theme }: { label: string; value: string; color: 'emerald' | 'cyan' | 'orange' | 'purple'; theme: string }) => {
    const colorMap = {
        emerald: { light: 'border-emerald-200 bg-emerald-50 text-emerald-700', dark: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
        cyan: { light: 'border-cyan-200 bg-cyan-50 text-cyan-700', dark: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400' },
        orange: { light: 'border-orange-200 bg-orange-50 text-orange-700', dark: 'border-orange-500/20 bg-orange-500/10 text-orange-400' },
        purple: { light: 'border-purple-200 bg-purple-50 text-purple-700', dark: 'border-purple-500/20 bg-purple-500/10 text-purple-400' },
    };
    const colorClass = colorMap[color][theme === 'light' ? 'light' : 'dark'];
    return (
        <div className={cn("rounded-lg border p-3 flex flex-col gap-1", colorClass)}>
            <div className="text-xs uppercase tracking-widest">{label}</div>
            <div className="text-lg font-bold font-mono">{value}</div>
        </div>
    );
};

export default Mining;
