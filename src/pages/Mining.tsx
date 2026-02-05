import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Play, Square, Pause, Play as PlayIcon, Flame, Gauge, Zap, Shield, Cpu, TrendingUp, Clock, Activity, Thermometer, HardDrive, Info } from 'lucide-react';
import { useMinerStore } from '../store/useMinerStore';
import { useSolanaAuth } from '../services/solanaAuth';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatHashrate } from '../lib/utils';
import { p2poolAPI } from '../services/p2poolAPI';
import { getEnvironmentConfig } from '../config/environment';

// Extend window type for API error logging
declare global {
    interface Window {
        __apiErrorLogged?: boolean;
        __apiConnected?: string; // Track which endpoint is connected
    }
}

// Chart component for hashrate visualization - MEMOIZED to prevent re-renders
const HashRateChart: React.FC<{ data: any[]; theme: string }> = React.memo(({ data, theme }) => (
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
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
));

HashRateChart.displayName = 'HashRateChart';

const Mining: React.FC = () => {
    const { theme } = useTheme();
    const { user } = useSolanaAuth(); // Get Solana user for BMT rewards
    const status = useMinerStore((state) => state.status);
    const setStatus = useMinerStore((state) => state.setStatus);
    const addLog = useMinerStore((state) => state.addLog);
    const deviceType = useMinerStore((state) => state.deviceType);
    const setDeviceType = useMinerStore((state) => state.setDeviceType);
    const wallet = useMinerStore((state) => state.wallet);
    const setWallet = useMinerStore((state) => state.setWallet);
    const workerName = useMinerStore((state) => state.workerName);
    const setWorkerName = useMinerStore((state) => state.setWorkerName);
    const donateLevel = useMinerStore((state) => state.donateLevel);
    const setDonateLevel = useMinerStore((state) => state.setDonateLevel);
    const poolUrl = useMinerStore((state) => state.poolUrl);
    const setPoolUrl = useMinerStore((state) => state.setPoolUrl);
    const updateStats = useMinerStore((state) => state.updateStats);
    const history = useMinerStore((state) => state.history);
    const currentHashrate = useMinerStore((state) => state.currentHashrate);
    const currentTemp = useMinerStore((state) => state.currentTemp);
    const currentPower = useMinerStore((state) => state.currentPower);
    const resetSession = useMinerStore((state) => state.resetSession);
    const pools = useMinerStore((state) => state.pools);
    const setGlobalPoolStats = useMinerStore((state) => state.setGlobalPoolStats);
    const loadSettings = useMinerStore((state) => state.loadSettings);
    const saveSettings = useMinerStore((state) => state.saveSettings);

    const threads = useMinerStore((state) => state.threads);
    const setThreads = useMinerStore((state) => state.setThreads);
    const cpuName = useMinerStore((state) => state.cpuName);
    const cpuCores = useMinerStore((state) => state.cpuCores);
    const setCpuInfo = useMinerStore((state) => state.setCpuInfo);

    // Advanced xmrig settings
    const cpuPriority = useMinerStore((state) => state.cpuPriority);
    const randomxMode = useMinerStore((state) => state.randomxMode);
    const hugePages = useMinerStore((state) => state.hugePages);
    const setCpuPriority = useMinerStore((state) => state.setCpuPriority);
    const setRandomxMode = useMinerStore((state) => state.setRandomxMode);
    const setHugePages = useMinerStore((state) => state.setHugePages);

    // System resource monitoring
    const [systemStats, setSystemStats] = useState<{
        cpuUsage: number | null;
        ramUsage: number | null;
        ramTotal: number | null;
        hasCpuData: boolean;
        hasRamData: boolean;
    }>({
        cpuUsage: null,
        ramUsage: null,
        ramTotal: null,
        hasCpuData: false,
        hasRamData: false
    });
    const [showHugePagesInfo, setShowHugePagesInfo] = useState(false);

    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const poolStatsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [peakHashrate, setPeakHashrate] = useState(0);
    const [poolNetworkHashrate, setPoolNetworkHashrate] = useState(300000000000); // Default Monero difficulty
    const primaryPool = pools?.['cpu'];
    const reservePool = pools?.['cpu-backup'];
    const isNodeFullySynced = !!((primaryPool?.isSynced && primaryPool?.progress >= 99.9) || (reservePool?.isSynced && reservePool?.progress >= 99.9));
    
    // Get global pool stats from store
    const poolHashrateTotal = useMinerStore((state) => state.poolHashrateTotal);
    const poolMinersCount = useMinerStore((state) => state.poolMinersCount);
    const setPoolNetworkHashrateStore = useMinerStore((state) => state.setPoolNetworkHashrate);
    const setExchangeRates = useMinerStore((state) => state.setExchangeRates);
    const ratesLastUpdated = useMinerStore((state) => state.ratesLastUpdated);

    // Wallet balance and rewards
    const [xmrBalance, setXmrBalance] = useState(0);
    const [xmrUsd, setXmrUsd] = useState(0);
    const [bmtUsd, setBmtUsd] = useState(0);
    const [rateXmrBmt, setRateXmrBmt] = useState(0);
    const [bmtBalance, setBmtBalance] = useState(0);
    const [walletValid, setWalletValid] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

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

    // Load miner settings from localStorage/Electron on component mount
    useEffect(() => {
        let mounted = true;
        (async () => {
            await loadSettings();
            if (mounted) setSettingsLoaded(true);
            console.log('⚙️ Miner settings loaded from storage');
        })();

        return () => {
            mounted = false;
        };
    }, [loadSettings]);

    // Validate wallet address
    useEffect(() => {
        const isValid = p2poolAPI.validateMoneroAddress(wallet);
        setWalletValid(isValid);
    }, [wallet]);

    // Save settings whenever they change
    useEffect(() => {
        if (!settingsLoaded) return;

        const timer = setTimeout(() => {
            saveSettings();
        }, 500); // Debounce saves by 500ms to avoid too frequent I/O

        return () => clearTimeout(timer);
    }, [settingsLoaded, wallet, workerName, threads, cpuPriority, randomxMode, hugePages, donateLevel, poolUrl, deviceType, saveSettings]);

    // Load system stats - OPTIMIZED to reduce frequency
    useEffect(() => {
        const loadSystemStats = async () => {
            try {
                const stats = await window.electron.invoke('get-system-stats');
                const cpu = typeof stats?.cpuUsage === 'number' ? stats.cpuUsage : null;
                const ramUsage = typeof stats?.ramUsage === 'number' ? stats.ramUsage : null;
                const ramTotal = typeof stats?.ramTotal === 'number' ? stats.ramTotal : null;

                const hasCpuData = cpu !== null && Number.isFinite(cpu) && cpu >= 0 && cpu <= 100;
                const hasRamData =
                    ramUsage !== null && ramTotal !== null &&
                    Number.isFinite(ramUsage) && Number.isFinite(ramTotal) &&
                    ramTotal > 0 && ramUsage >= 0;

                setSystemStats({
                    cpuUsage: hasCpuData ? cpu : null,
                    ramUsage: hasRamData ? ramUsage : null,
                    ramTotal: hasRamData ? ramTotal : null,
                    hasCpuData,
                    hasRamData
                });
            } catch (err) {
                // Silently fail - system stats not critical
                setSystemStats({
                    cpuUsage: null,
                    ramUsage: null,
                    ramTotal: null,
                    hasCpuData: false,
                    hasRamData: false
                });
            }
        };
        loadSystemStats();
        // Increase from 2000ms to 3000ms to reduce IPC calls
        const interval = setInterval(loadSystemStats, 3000);
        return () => clearInterval(interval);
    }, []);

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
            if (poolStatsIntervalRef.current) clearInterval(poolStatsIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        const shouldPoll = status === 'running' || status === 'starting';

        if (!shouldPoll) {
            if (statsIntervalRef.current) {
                clearInterval(statsIntervalRef.current);
                statsIntervalRef.current = null;
            }
            return;
        }

        // Increase interval from 3.5s to 5s to reduce network load and UI updates
        statsIntervalRef.current = setInterval(fetchStats, 5000);
        // Call immediately for quicker initial response
        fetchStats();
        return () => {
            if (statsIntervalRef.current) {
                clearInterval(statsIntervalRef.current);
                statsIntervalRef.current = null;
            }
        };
    }, [status, deviceType]);

    // Fetch pool network hashrate and stats for reward calculation
    useEffect(() => {
        const fetchPoolStats = async () => {
            try {
                const stats = await p2poolAPI.getPoolStats();
                
                if (stats && stats.poolDifficulty) {
                    // Calculate network hashrate from difficulty
                    // Monero: difficulty = hashrate * 120 (block time in seconds)
                    const networkHashrate = stats.poolDifficulty / 120;
                    setPoolNetworkHashrate(networkHashrate);
                    setPoolNetworkHashrateStore(networkHashrate);

                    // Update global pool stats in store
                    setGlobalPoolStats(stats.poolHashrate || 0, stats.miners || 0, networkHashrate);
                }
            } catch (err) {
                console.warn('[Mining] Failed to fetch pool stats:', err);
                // Use default if fetch fails
            }
        };

        if (status === 'running' || status === 'paused') {
            fetchPoolStats();
            poolStatsIntervalRef.current = setInterval(fetchPoolStats, 60000); // Update every 60s
            return () => {
                if (poolStatsIntervalRef.current) clearInterval(poolStatsIntervalRef.current);
            };
        }
    }, [status]);

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

    // Fetch rates from backend (XMR USD, BMT USD, XMR->BMT)
    useEffect(() => {
        const fetchRates = async () => {
            try {
                // Use relative URL for Vite proxy in development
                const res = await fetch('/api/rates/current', { signal: AbortSignal.timeout(6000) });
                if (!res.ok) throw new Error(`rates/current HTTP ${res.status}`);
                const data = await res.json();

                const toNumber = (value: any) => {
                    if (value === null || value === undefined) return 0;
                    const num = Number(String(value).replace(/,/g, ''));
                    return Number.isFinite(num) ? num : 0;
                };

                const nextXmrUsd = toNumber(
                    data?.xmr_usd ?? data?.xmrUsd ?? data?.xmr_usd_price ?? data?.xmr_price_usd
                );
                const nextBmtUsd = toNumber(
                    data?.bmt_usd ?? data?.bmtUsd ?? data?.bmt_usd_price ?? data?.bmt_price_usd
                );
                const nextRate = toNumber(
                    data?.rate_xmr_bmt ?? data?.rateXmrBmt ?? data?.xmr_bmt_rate
                );

                setXmrUsd(Number.isFinite(nextXmrUsd) ? nextXmrUsd : 0);
                setBmtUsd(Number.isFinite(nextBmtUsd) ? nextBmtUsd : 0);
                setRateXmrBmt(Number.isFinite(nextRate) ? nextRate : 0);
                
                // Save to store for Layout component
                setExchangeRates(
                    Number.isFinite(nextXmrUsd) ? nextXmrUsd : 0,
                    Number.isFinite(nextBmtUsd) ? nextBmtUsd : 0,
                    Number.isFinite(nextRate) ? nextRate : 0
                );
            } catch (err) {
                console.warn('[Mining] Failed to fetch rates from backend:', err);
                
                // Use mock data for testing when backend is unavailable
                const mockXmrUsd = 376.86;
                const mockBmtUsd = 0.000003519;
                const mockRate = 107092924;
                
                setXmrUsd(mockXmrUsd);
                setBmtUsd(mockBmtUsd);
                setRateXmrBmt(mockRate);
                
                // Save mock data to store
                setExchangeRates(mockXmrUsd, mockBmtUsd, mockRate);
            }
        };

        // Fetch immediately on mount
        fetchRates();
        
        // Then fetch periodically when running
        if (status === 'running' || status === 'paused') {
            const interval = setInterval(fetchRates, 60000); // Update every 60s
            return () => clearInterval(interval);
        }
    }, [status]);

    // Update balance based on current hashrate from P2Pool estimation
    useEffect(() => {
        if (status === 'running' || status === 'paused') {
            // Estimate reward based on hashrate using P2Pool formula
            // Monero: 1 block every 120 seconds, ~0.6 XMR per block (approximate)
            // Formula: (Your Hashrate / Network Hashrate) * Blocks Per Period * Block Reward

            const networkHashrate = poolNetworkHashrate; // Already calculated from difficulty
            const blockReward = 0.6; // Current Monero block reward (approximate)

            // Prevent division by zero
            if (networkHashrate <= 0 || currentHashrate <= 0) {
                setXmrBalance(0);
                setBmtBalance(0);
                return;
            }

            const shareOfNetwork = currentHashrate / networkHashrate;

            // Calculate rewards for mining duration
            const secondsMined = elapsedTime;
            const blocksMined = (secondsMined / 120) * shareOfNetwork;
            const xmrEarned = blocksMined * blockReward;

            setXmrBalance(xmrEarned);

            // Convert XMR -> BMT using backend oracle rate (preferred)
            const rate = Number.isFinite(rateXmrBmt) ? rateXmrBmt : 0;
            const bmtEarned = rate > 0 ? (xmrEarned * rate * 0.8) : 0; // 80% after 20% fee
            setBmtBalance(Number.isFinite(bmtEarned) ? bmtEarned : 0);
        }
    }, [currentHashrate, rateXmrBmt, status, elapsedTime, poolNetworkHashrate]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const fetchStats = async () => {
        const shouldPoll = status === 'running' || status === 'starting';
        if (!shouldPoll) return;
        try {
            // Determine which xmrig API endpoint to use based on miner version
            // Standard (v6.21) and Compat (v6.14) use /2/summary (or /api/v1/summary)
            // Legacy (v5.11/v6.8) may use /api/stats or /summary
            let endpoints: string[] = [];
            if (deviceType === 'cpu') {
                // Try endpoints in order of preference
                endpoints = [
                    'http://127.0.0.1:4077/2/summary',           // v6.14+
                    'http://127.0.0.1:4077/api/v1/summary',      // Alternative v6.21
                    'http://127.0.0.1:4077/api/stats',           // v5.11/legacy
                    'http://127.0.0.1:4077/summary'              // Fallback
                ];
            } else {
                endpoints = [
                    'http://127.0.0.1:4067/summary',
                    'http://127.0.0.1:4067/api/v1/summary'
                ];
            }

            let data = null;
            let successUrl = null;

            // Try each endpoint until one succeeds
            for (const actualUrl of endpoints) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);

                    const res = await fetch(actualUrl, { signal: controller.signal }).catch(() => null);
                    clearTimeout(timeoutId);

                    if (res && res.ok) {
                        data = await res.json();
                        successUrl = actualUrl;

                        // Log successful connection once
                        if (!window.__apiConnected || window.__apiConnected !== actualUrl) {
                            console.log(`[Mining] ✅ Connected to xmrig API at ${actualUrl}`);
                            window.electron.invoke('log-to-file', { level: 'info', message: `✅ Connected to xmrig API at ${actualUrl}`, source: 'Mining' });
                            window.__apiConnected = actualUrl;
                            window.__apiErrorLogged = false;
                        }
                        break;
                    }
                } catch (err) {
                    // Try next endpoint
                }
            }

            if (!data) {
                // All endpoints failed
                if (!window.__apiErrorLogged) {
                    const errMsg = `Could not connect to xmrig API. Tried: ${endpoints.join(', ')}`;
                    console.warn(`[Mining] ${errMsg}`);
                    window.electron.invoke('log-to-file', { level: 'warn', message: errMsg, source: 'Mining' });
                    window.__apiErrorLogged = true;
                }
                return;
            }

            let hr = 0;
            let temp: number | null = null;
            let power = 0;

            if (deviceType === 'cpu') {
                // Try different hashrate paths for different xmrig versions
                hr = data.hashrate?.total?.[0] ??
                    data.hashrate?.current ??
                    data.hashrate ??
                    0;

                // Update peak hashrate for CPU (use functional update to avoid stale closure)
                if (hr > 0) {
                    setPeakHashrate((prev) => (hr > prev ? hr : prev));
                }
                // Fetch CPU temp asynchronously without blocking
                window.electron.invoke('get-cpu-temp').then((tempRes: any) => {
                    if (tempRes && tempRes.success) {
                        updateStats(hr, tempRes.temp, power);
                    } else {
                        // Update without temp if unavailable
                        updateStats(hr, null, power);
                    }
                }).catch(() => {
                    // Still update with hashrate if temp fails
                    updateStats(hr, null, power);
                });
                return; // Don't call updateStats again below
            } else if (data.gpus && data.gpus.length > 0) {
                hr = data.gpus[0].hashrate ?? data.gpus[0].hash ?? 0;
                temp = data.gpus[0].temperature ?? data.gpus[0].temp ?? 0;
                power = data.gpus[0].power ?? 0;
                window.electron.invoke('report-stats', { temp, power }).catch(() => { });
            }

            if (hr > 0) {
                updateStats(hr, temp, power);
                // Update peak hashrate for GPU / generic path
                setPeakHashrate((prev) => (hr > prev ? hr : prev));
            }
        } catch (err) {
            const errMsg = `fetchStats error: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[Mining] ${errMsg}`);
            window.electron.invoke('log-to-file', { level: 'error', message: errMsg, source: 'Mining' });
        }
    };

    const startMining = async () => {
        if (status === 'running' || status === 'starting') return;
        if (!isNodeFullySynced) {
            addLog('⏳ Node is not fully synced (100%). Mining is disabled until sync completes.');
            return;
        }
        resetSession();
        setElapsedTime(0);
        setPeakHashrate(0);

        try {
            await window.electron.invoke('start-mining', {
                type: deviceType,
                wallet,
                worker: workerName,
                threads: deviceType === 'cpu' ? threads : undefined,
                cpuPriority,
                randomxMode,
                hugePages,
                donateLevel,
                poolUrl,
                solanaWallet: user?.publicKey, // Raw Solana address (no encoding)
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
            // Save logs to disk before stopping
            const { logs: storeLogs } = useMinerStore.getState();
            if (window.electron?.invoke) {
                await window.electron.invoke('save-miner-logs', {
                    systemLogs: storeLogs,
                    minerLogs: storeLogs,
                    sessionType: 'mining',
                    device: deviceType
                }).catch((err: any) => {
                    console.warn('Failed to save logs:', err);
                });
            }

            await window.electron.invoke('stop-mining', {});
            setStatus('completed');
            addLog('⏹️ Mining stopped');
        } catch (err: any) {
            setStatus('error');
            addLog(`❌ Error: ${err.message}`);
        }
    };

    const pauseMining = async () => {
        try {
            await window.electron.invoke('pause-mining', {});
            setStatus('paused');
            if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
            addLog('⏸️ Mining paused');
        } catch (err: any) {
            setStatus('error');
            addLog(`❌ Error pausing: ${err.message}`);
        }
    };

    const resumeMining = async () => {
        try {
            await window.electron.invoke('resume-mining', {});
            setStatus('running');
            timeIntervalRef.current = setInterval(() => {
                setElapsedTime((t) => t + 1);
            }, 1000);
            addLog('▶️ Mining resumed');
        } catch (err: any) {
            setStatus('error');
            addLog(`❌ Error resuming: ${err.message}`);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={cn("text-3xl font-light tracking-tight", theme === 'light' ? 'text-zinc-900' : 'text-white')}>
                        Mining
                    </h1>
                    <p className={cn("text-sm mt-1", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
                        Track your hashrate and earnings in real-time
                    </p>
                </div>

                {/* Status Badge */}
                <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-all',
                    status === 'running' ? (theme === 'light' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400') :
                        status === 'starting' ? (theme === 'light' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-amber-500/40 bg-amber-500/10 text-amber-400') :
                            status === 'paused' ? (theme === 'light' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-blue-500/40 bg-blue-500/10 text-blue-400') :
                                status === 'error' ? (theme === 'light' ? 'border-red-300 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-400') :
                                    (theme === 'light' ? 'border-zinc-200 bg-zinc-50 text-zinc-600' : 'border-white/10 bg-white/5 text-zinc-400')
                )}>
                    <span className={cn('w-2 h-2 rounded-full',
                        status === 'running' ? 'bg-emerald-500 animate-pulse' :
                            status === 'starting' ? 'bg-amber-500 animate-pulse' :
                                status === 'paused' ? 'bg-blue-500' :
                                    status === 'error' ? 'bg-red-500' : 'bg-zinc-400'
                    )}></span>
                    <span>
                        {status === 'running' ? 'Mining' :
                            status === 'starting' ? 'Connecting' :
                                status === 'paused' ? 'Paused' :
                                    status === 'completed' ? 'Completed' :
                                        status === 'error' ? 'Error' : 'Idle'}
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
                                    className={cn("w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-yellow-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer",
                                        theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-800'
                                    )}
                                />
                            </div>

                            {/* CPU Priority - Limited to Normal */}
                            <div className={cn("pt-2 space-y-2", theme === 'light' ? 'border-t border-zinc-200' : 'border-t border-white/5')}>
                                <div className="flex justify-between items-center">
                                    <label className={cn("text-xs", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
                                        CPU Priority:
                                    </label>
                                    <span className={cn("text-sm font-mono",
                                        theme === 'light' ? 'text-yellow-600' : 'text-yellow-400'
                                    )}>
                                        {cpuPriority === 0 ? 'Idle' :
                                            cpuPriority === 1 ? 'Low' : 'Normal'}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    value={Math.min(cpuPriority, 2)}
                                    onChange={(e) => setCpuPriority(Number(e.target.value))}
                                    disabled={status === 'running' || status === 'starting'}
                                    className={cn("w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-yellow-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer",
                                        theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-800'
                                    )}
                                />
                                <p className={cn("text-xs", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}>
                                    Idle · Low · Normal - Балансування між продуктивністю та системною стабільністю
                                </p>
                            </div>

                            {/* RandomX Mode */}
                            <div className={cn("pt-2 space-y-2", theme === 'light' ? 'border-t border-zinc-200' : 'border-t border-white/5')}>
                                <label className={cn("text-xs block", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
                                    RandomX Mode (RAM Usage):
                                </label>
                                <select
                                    value={randomxMode}
                                    onChange={(e) => setRandomxMode(e.target.value as 'auto' | 'fast' | 'light')}
                                    disabled={status === 'running' || status === 'starting'}
                                    className={cn(
                                        "w-full px-3 py-2 rounded-lg text-xs border disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2",
                                        theme === 'light'
                                            ? 'bg-zinc-100 border-zinc-300 text-zinc-900 focus:ring-yellow-500'
                                            : 'bg-zinc-950/50 border-white/10 text-zinc-300 focus:ring-yellow-500'
                                    )}
                                >
                                    <option value="auto">Auto (~2GB RAM optimal)</option>
                                    <option value="fast">Fast (~2GB RAM high speed)</option>
                                    <option value="light">Light (~256MB RAM low memory)</option>
                                </select>
                                <p className={cn("text-xs", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}>
                                    Fast uses more RAM but gives better hashrate
                                </p>
                            </div>

                            {/* Huge Pages */}
                            <div className={cn("pt-2", theme === 'light' ? 'border-t border-zinc-200' : 'border-t border-white/5')}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hugePages}
                                        onChange={(e) => setHugePages(e.target.checked)}
                                        disabled={status === 'running' || status === 'starting'}
                                        className={cn(
                                            "w-4 h-4 rounded border disabled:opacity-50 disabled:cursor-not-allowed",
                                            theme === 'light'
                                                ? 'border-zinc-300 text-emerald-600 focus:ring-emerald-500'
                                                : 'border-white/10 bg-zinc-950/50 text-emerald-500 focus:ring-emerald-500'
                                        )}
                                    />
                                    <span className={cn("text-xs", theme === 'light' ? 'text-zinc-700' : 'text-zinc-300')}>
                                        Enable Huge Pages
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowHugePagesInfo(!showHugePagesInfo)}
                                        className={cn("flex items-center", theme === 'light' ? 'text-yellow-600 hover:text-yellow-700' : 'text-yellow-400 hover:text-yellow-300')}
                                        title="Information about Huge Pages"
                                    >
                                        <Info size={14} />
                                    </button>
                                </label>
                                {showHugePagesInfo && (
                                    <div className={cn("text-xs mt-2 p-2 rounded border", theme === 'light' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300')}>
                                        <p className="font-semibold mb-1">What is Huge Pages?</p>
                                        <p className="opacity-90">
                                            Huge Pages allows the system to use larger memory blocks instead of standard pages, which improves CPU cache performance. This is especially useful for mining, where large amounts of memory are processed continuously. Enabling Huge Pages can increase hash rate by 10-20%.
                                        </p>
                                    </div>
                                )}
                                <p className={cn("text-xs mt-1 ml-6", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}>
                                    Improves memory performance (+10-20% hash rate)
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Stats - Live Metrics */}
                    <div className={cn("border rounded-xl p-6 space-y-4",
                        theme === 'light'
                            ? 'bg-white border-zinc-200'
                            : 'bg-zinc-900/50 border-white/10'
                    )}>
                        <div className="flex items-center justify-between">
                            <span className={cn("text-sm font-semibold", theme === 'light' ? 'text-zinc-700' : 'text-zinc-300')}>Live Metrics</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <MetricCard label="H/s" value={formatHashrate(currentHashrate)} icon={<Zap size={14} />} color="emerald" theme={theme} />
                            <MetricCard label="Peak" value={formatHashrate(peakHashrate)} icon={<TrendingUp size={14} />} color="yellow" theme={theme} />
                            {currentTemp !== null && currentTemp !== undefined && currentTemp > 0 && (
                                <MetricCard label="Temp" value={`${currentTemp.toFixed(0)}°C`} icon={<Thermometer size={14} />} color="emerald" theme={theme} />
                            )}
                            <MetricCard label="Time" value={formatTime(elapsedTime)} icon={<Clock size={14} />} color="emerald" theme={theme} />
                        </div>

                        {/* Control Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                            {!walletValid && status === 'idle' && (
                                <div className={cn("col-span-2 p-3 rounded-lg text-xs text-center border",
                                    theme === 'light'
                                        ? 'bg-red-50 border-red-200 text-red-700'
                                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                                )}>
                                    ⚠️ Невалідна адреса Monero гаманця. Будь ласка, оновіть гаманець перед початком майнінгу.
                                </div>
                            )}
                            {!isNodeFullySynced && status !== 'running' && status !== 'starting' && (
                                <div className={cn("col-span-2 p-3 rounded-lg text-xs text-center border",
                                    theme === 'light'
                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                )}>
                                    ⏳ Node sync must be 100% to start mining.
                                </div>
                            )}
                            <button
                                onClick={status === 'running' || status === 'starting' ? stopMining : startMining}
                                disabled={status === 'starting' || (!walletValid && status === 'idle') || (!isNodeFullySynced && status === 'idle')}
                                className={cn(
                                    'py-3.5 px-4 rounded-xl font-semibold text-sm tracking-tight transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer',
                                    status === 'running' || status === 'starting'
                                        ? 'bg-red-500/10 text-red-500 border-2 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30'
                                        : (theme === 'light'
                                            ? 'bg-emerald-600 text-white border-2 border-emerald-600 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-200'
                                            : 'bg-emerald-500 text-zinc-950 border-2 border-emerald-500 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20')
                                )}
                            >
                                {status === 'running' ? <><Square size={16} className="fill-current" /> Stop</> :
                                    status === 'starting' ? <><Activity size={16} className="animate-spin" /> Connecting</> :
                                        status === 'paused' ? <><PlayIcon size={16} className="fill-current" /> Resume</> :
                                            <><Play size={16} className="fill-current" /> Start</>}
                            </button>

                            <button
                                onClick={status === 'paused' ? resumeMining : pauseMining}
                                disabled={status !== 'running' && status !== 'paused' && status !== 'starting'}
                                className={cn(
                                    'py-3.5 px-4 rounded-xl font-semibold text-sm tracking-tight transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer',
                                    status === 'paused'
                                        ? 'bg-yellow-500/10 text-yellow-600 border-2 border-yellow-500/20 hover:bg-yellow-500/20 hover:border-yellow-500/30'
                                        : status === 'running'
                                            ? 'bg-yellow-500/10 text-yellow-600 border-2 border-yellow-500/20 hover:bg-yellow-500/20 hover:border-yellow-500/30'
                                            : (theme === 'light'
                                                ? 'bg-zinc-200 text-zinc-500 border-2 border-zinc-200'
                                                : 'bg-zinc-800 text-zinc-600 border-2 border-zinc-800')
                                )}
                            >
                                {status === 'paused' ? <><PlayIcon size={16} className="fill-current" /> Resume</> : <><Pause size={16} className="fill-current" /> Pause</>}
                            </button>
                        </div>
                    </div>

                    {/* System Resource Monitor */}
                    {(systemStats.hasCpuData || systemStats.hasRamData) && (
                        <div className={cn("border rounded-xl p-5 space-y-3",
                            theme === 'light'
                                ? 'bg-white border-zinc-200'
                                : 'bg-zinc-900/50 border-white/10'
                        )}>
                            <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
                                theme === 'light' ? 'text-yellow-600' : 'text-yellow-400'
                            )}>
                                <HardDrive size={14} />
                                System Resources
                            </div>

                            {/* CPU Usage (hide if no CPU data) */}
                            {systemStats.hasCpuData && systemStats.cpuUsage !== null && (
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <div className={cn("text-xs uppercase tracking-wide", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
                                            CPU Load
                                        </div>
                                        <div className={cn("text-sm font-bold", theme === 'light' ? 'text-yellow-700' : 'text-yellow-300')}>
                                            {systemStats.cpuUsage.toFixed(1)}%
                                        </div>
                                    </div>
                                    <div className={cn("w-full h-1.5 rounded-full overflow-hidden",
                                        theme === 'light' ? 'bg-zinc-200' : 'bg-zinc-800'
                                    )}>
                                        <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all"
                                            style={{ width: `${Math.min(systemStats.cpuUsage, 100)}%` }} />
                                    </div>
                                </div>
                            )}

                            {/* RAM Usage */}
                            {systemStats.hasRamData && systemStats.ramUsage !== null && systemStats.ramTotal !== null && (
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <div className={cn("text-xs uppercase tracking-wide", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
                                            RAM Usage
                                        </div>
                                        <div className={cn("text-sm font-bold", theme === 'light' ? 'text-emerald-700' : 'text-emerald-300')}>
                                            {((systemStats.ramUsage / 1024 / 1024 / 1024).toFixed(1))} GB / {(systemStats.ramTotal / 1024 / 1024 / 1024).toFixed(1)} GB
                                        </div>
                                    </div>
                                    <div className={cn("w-full h-1.5 rounded-full overflow-hidden",
                                        theme === 'light' ? 'bg-zinc-200' : 'bg-zinc-800'
                                    )}>
                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                                            style={{ width: `${Math.min((systemStats.ramUsage / systemStats.ramTotal) * 100, 100)}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Wallet Balance */}
                    <div className={cn("border rounded-xl p-5 space-y-4",
                        theme === 'light'
                            ? 'bg-gradient-to-br from-emerald-50 via-white to-cyan-50 border-emerald-200'
                            : 'bg-gradient-to-br from-emerald-500/10 via-zinc-900/50 to-cyan-500/10 border-emerald-500/20'
                    )}>
                        <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
                            theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                        )}>
                            <Shield size={14} />
                            Estimated Wallet Balance
                        </div>
                        <div className={cn("text-xs mt-1", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}>
                            Calculated based on hashrate, mining time, Monero reward rate, and exchange rates
                        </div>

                        {/* XMR Balance */}
                        <div className="space-y-1">
                            <div className={cn("text-xs uppercase tracking-wide", theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>
                                Estimated Monero (XMR)
                            </div>
                            <div className={cn("text-xl font-bold font-mono", theme === 'light' ? 'text-zinc-900' : 'text-white')}>
                                {(Number.isFinite(xmrBalance) ? xmrBalance : 0).toFixed(8)} XMR
                            </div>
                            <div className={cn("text-xs", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}>
                                ≈ ${((Number.isFinite(xmrBalance) ? xmrBalance : 0) * (Number.isFinite(xmrUsd) ? xmrUsd : 0)).toFixed(2)} USD
                            </div>
                        </div>

                        <div className={cn("border-t", theme === 'light' ? 'border-zinc-200' : 'border-white/5')} />

                        {/* BMT Balance */}
                        <div className="space-y-1">
                            <div className={cn("text-xs uppercase tracking-wide", theme === 'light' ? 'text-emerald-600' : 'text-emerald-500')}>
                                your estimated rewards in $BMT
                            </div>
                            <div className={cn("text-2xl font-bold", theme === 'light' ? 'text-emerald-900' : 'text-emerald-300')}>
                                {(Number.isFinite(bmtBalance) ? bmtBalance : 0).toFixed(2)} BMT
                            </div>
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

const MetricCard = React.memo(({ label, value, icon, color, theme }: { label: string; value: string; icon: React.ReactNode; color: 'emerald' | 'yellow' | 'blue'; theme: string }) => {
    const colorMap = {
        emerald: { light: 'border-emerald-200 bg-emerald-50 text-emerald-700', dark: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
        yellow: { light: 'border-yellow-200 bg-yellow-50 text-yellow-700', dark: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400' },
        blue: { light: 'border-blue-200 bg-blue-50 text-blue-700', dark: 'border-blue-500/20 bg-blue-500/10 text-blue-400' },
    };
    const colorClass = colorMap[color][theme === 'light' ? 'light' : 'dark'];
    return (
        <div className={cn("rounded-lg border p-3 flex flex-col gap-2", colorClass)}>
            <div className="flex items-center gap-1.5">
                {icon}
                <div className="text-xs uppercase tracking-widest">{label}</div>
            </div>
            <div className="text-lg font-bold font-mono">{value}</div>
        </div>
    );
});

MetricCard.displayName = 'MetricCard';

export default Mining;


