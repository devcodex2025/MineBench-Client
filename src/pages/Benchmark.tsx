import React, { useEffect, useRef, useState } from 'react';
import { useMinerStore, DeviceType } from '../store/useMinerStore';
import { useTheme } from '../contexts/ThemeContext';
import { Play, Square, Cpu, Monitor, Timer, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { cn, formatHashrate } from '../lib/utils'; // Assumes formatHashrate is in utils
// import { ipcRenderer } from 'electron'; 

// Adding IPC type safety shim for development if needed, 
// strictly speaking we use window.electron.invoke defined in preload

const Benchmark = () => {
    const { theme } = useTheme();
    // Select state individually to avoid unnecessary re-renders
    const status = useMinerStore(state => state.status);
    const setStatus = useMinerStore(state => state.setStatus);
    const addLog = useMinerStore(state => state.addLog);
    const deviceType = useMinerStore(state => state.deviceType);
    const setDeviceType = useMinerStore(state => state.setDeviceType);
    const wallet = useMinerStore(state => state.wallet);
    const workerName = useMinerStore(state => state.workerName);
    const updateStats = useMinerStore(state => state.updateStats);
    const history = useMinerStore(state => state.history);
    const currentHashrate = useMinerStore(state => state.currentHashrate);
    const currentTemp = useMinerStore(state => state.currentTemp);
    const currentPower = useMinerStore(state => state.currentPower);
    const resetSession = useMinerStore(state => state.resetSession);


    const [duration, setDuration] = useState<number>(60);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [finalResults, setFinalResults] = useState<{avg: number, max: number} | null>(null);


    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Keep local tracks for final calculation to avoid dependency on store sampling rate
    const localStatsRef = useRef<number[]>([]); 

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        };
    }, []);

    // Listen for miner events
    useEffect(() => {
        if (!window.electron.on) {
            console.warn("window.electron.on is not defined. Restart Electron to apply preload changes.");
            return;
        }

        const cleanupLog = window.electron.on('miner-log', (msg) => {
            // Filter heartbeat logs if needed, or just push to console
            console.log(`Miner: ${msg}`);
            // Optional: addLog(msg.trim()); // Only if you want verbose logs in UI
        });
        
        const cleanupError = window.electron.on('miner-error', (msg) => {
            console.error(`Miner Error: ${msg}`);
            addLog(`Error: ${msg}`);
            // If critical error, stop
            if (msg.includes('CuDa') || msg.includes('error') || msg.includes('exited')) {
               setStatus('error');
            }
        });

        const cleanupExit = window.electron.on('miner-exit', ({ code, signal }) => {
            console.log(`Miner exited with code ${code}`);
            if (code !== 0 && status === 'running') {
                 setStatus('error');
                 addLog(`Miner exited unexpectedly (Code: ${code})`);
            } else if (status === 'stopping') {
                 setStatus('completed');
            }
        });

        return () => {
            if (cleanupLog) cleanupLog();
            if (cleanupError) cleanupError();
            if (cleanupExit) cleanupExit();
        };
    }, [status, setStatus, addLog]);

    const startBenchmark = async () => {
        if (status === 'running') return;

        resetSession();
        localStatsRef.current = [];
        setFinalResults(null);
        setTimeLeft(duration);
        
        try {
            const res = await window.electron.invoke("start-benchmark", { 
                type: deviceType, 
                wallet, 
                worker: workerName 
            });
            
            setStatus('running');
            addLog(`Benchmark started: ${deviceType.toUpperCase()} | ${duration}s`);
            
            // Start Countdown
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 1) {
                        stopBenchmark();
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);

            // Start Polling Stats
            statsIntervalRef.current = setInterval(fetchStats, 3000);

        } catch (err: any) {
            console.error(err);
            setStatus('error');
            addLog(`Error starting: ${err.message}`);
        }
    };

    const stopBenchmark = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        
        setStatus('stopping');
        
        // Calculate Results
        const samples = localStatsRef.current;
        let avg = 0;
        let max = 0;
        
        if (samples.length > 0) {
             const sum = samples.reduce((a, b) => a + b, 0);
             avg = sum / samples.length;
             max = Math.max(...samples);
        }
        
        setFinalResults({ avg, max });

        try {
            const payload = {
                avg_hashrate: avg,
                max_hashrate: max
            };
            
            await window.electron.invoke("stop-benchmark", payload);
            setStatus('completed');
            addLog(`Benchmark finished. Avg: ${formatHashrate(avg)}`);
        } catch (err: any) {
            console.error(err);
            addLog(`Error stopping: ${err.message}`);
            setStatus('error');
        }
    };

    const fetchStats = async () => {
        try {
            // CPU uses /2/summary, GPU uses /summary usually in our previous setup. 
            // Let's adapt base on type
            const actualUrl = deviceType === 'cpu' 
                ? `http://127.0.0.1:4077/2/summary` 
                : `http://127.0.0.1:4067/summary`;

            const res = await fetch(actualUrl).catch(() => null);

            if (!res || !res.ok) {
                // Miner not ready yet, silently ignore
                return;
            }

            const data = await res.json();

            
            let hr = 0;
            let temp = null;
            let power = 0;

            if (deviceType === 'cpu') {
                hr = data.hashrate?.total?.[0] ?? 0;
                // Fetch Temp via IPC
                const tempRes = await window.electron.invoke('get-cpu-temp');
                if (tempRes && tempRes.success) temp = tempRes.temp;
            } else {
                // GPU
                if (data.gpus && data.gpus.length > 0) {
                     hr = data.gpus[0].hashrate ?? data.gpus[0].hash ?? 0;
                     temp = data.gpus[0].temperature ?? data.gpus[0].temp ?? 0;
                     power = data.gpus[0].power ?? 0;
                     
                     // Send usage report to main process for DB tracking
                     window.electron.invoke("report-stats", { temp, power });
                }
            }

            if (hr > 0) {
                updateStats(hr, temp, power);
                localStatsRef.current.push(hr);
            }

        } catch (e) {
            // display subtle error or ignoring during startup
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={cn("text-3xl font-light", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Benchmark Mode</h1>
                    <p className="text-zinc-500 mt-1">Test your hardware capabilities and estimate rewards.</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <p className="text-zinc-500 text-sm">Mining to MineBench application wallet.</p>
                                        <div className={cn("p-1 rounded-lg border flex gap-1",
                                            theme === 'light'
                                                ? 'bg-white border-zinc-200'
                                                : 'bg-zinc-900 border-white/5'
                                        )}>
                        <button 
                            onClick={() => status !== 'running' && setDeviceType('cpu')}
                            className={cn(
                                "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all",
                                deviceType === 'cpu'
                                                                    ? (theme === 'light' ? "bg-white text-zinc-900 border border-zinc-300 shadow-sm" : "bg-zinc-800 text-white shadow-sm")
                                                                    : (theme === 'light' ? "text-zinc-600 hover:bg-zinc-100" : "text-zinc-500 hover:text-zinc-300")
                            )}
                        >
                            <Cpu size={16} /> Monero (CPU)
                        </button>
                        {/* GPU Disabled for v1.0 XMR Focus */}
                        {false && (
                            <button 
                                onClick={() => status !== 'running' && setDeviceType('gpu')}
                                className={cn(
                                    "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all",
                                    deviceType === 'gpu' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <Monitor size={16} /> GPU (KawPow)
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Stats Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Control Card */}
                <div className="lg:col-span-1 space-y-4">
                    <div className={cn("border rounded-xl p-6",
                      theme === 'light'
                        ? 'bg-white border-zinc-200'
                        : 'bg-zinc-900/50 border-white/5'
                    )}>
                        <div className="flex justify-between items-center mb-6">
                            <span className={cn("text-sm font-medium", theme === 'light' ? 'text-zinc-700' : 'text-zinc-400')}>Session Duration</span>
                            <select 
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                disabled={status === 'running'}
                                className={cn("border rounded px-2 py-1 text-sm outline-none focus:border-emerald-500/50",
                                  theme === 'light'
                                    ? 'bg-zinc-100 border-zinc-300 text-zinc-900'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                                )}>
                                <option value={60}>1 Minute</option>
                                <option value={180}>3 Minutes</option>
                                <option value={300}>5 Minutes</option>
                            </select>
                        </div>

                        <div className={cn("mb-8 flex flex-col items-center justify-center py-6 border-b border-dashed",
                          theme === 'light' ? 'border-zinc-200' : 'border-white/5'
                        )}>
                             <div className={cn("text-5xl font-mono font-light tracking-tighter",
                               theme === 'light' ? 'text-zinc-900' : 'text-white'
                             )}>
                                {status === 'running' && timeLeft !== null ? timeLeft : duration}
                                <span className={cn("text-lg ml-1", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}> s</span>
                             </div>
                             <span className="text-xs text-zinc-500 mt-2 uppercase tracking-widest">
                                {status === 'running' ? 'Time Remaining' : 'Duration'}
                             </span>
                        </div>

                        <button
                            onClick={status === 'running' ? stopBenchmark : startBenchmark}
                            disabled={status === 'stopping'}
                            className={cn(
                                "w-full py-4 rounded-lg font-bold text-sm tracking-wide transition-all transform active:scale-[0.98]",
                                status === 'running' 
                                    ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                    : (theme === 'light'
                                        ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                                        : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]")
                            )}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {status === 'running' ? (
                                    <><Square size={18} fill="currentColor" /> STOP TEST</>
                                ) : (
                                    <><Play size={18} fill="currentColor" /> START BENCHMARK</>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Live Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={cn("border rounded-xl p-4",
                          theme === 'light'
                            ? 'bg-white border-zinc-200'
                            : 'bg-zinc-900/50 border-white/5'
                        )}>
                            <div className={cn("flex items-center gap-2 mb-2 text-xs",
                              theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'
                            )}>
                                <Zap size={14} /> <span>Power</span>
                            </div>
                            <div className={cn("text-xl font-mono",
                              theme === 'light' ? 'text-zinc-900' : 'text-white'
                            )}>{currentPower ? currentPower.toFixed(0) : '-'} <span className={cn("text-xs", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}>W</span></div>
                        </div>
                        <div className={cn("border rounded-xl p-4",
                          theme === 'light'
                            ? 'bg-white border-zinc-200'
                            : 'bg-zinc-900/50 border-white/5'
                        )}>
                             <div className={cn("flex items-center gap-2 mb-2 text-xs",
                              theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'
                            )}>
                                <Timer size={14} /> <span>Temp</span>
                            </div>
                            <div className={cn("text-xl font-mono",
                              theme === 'light' ? 'text-zinc-900' : 'text-white'
                            )}>{currentTemp ? currentTemp.toFixed(1) : '-'} <span className={cn("text-xs", theme === 'light' ? 'text-zinc-500' : 'text-zinc-600')}>°C</span></div>
                        </div>
                    </div>
                </div>

                {/* Chart Area */}
                <div className={cn("lg:col-span-2 border rounded-xl p-6 flex flex-col",
                  theme === 'light'
                    ? 'bg-white border-zinc-200'
                    : 'bg-zinc-900/50 border-white/5'
                )}>
                     <h3 className={cn("text-sm font-medium mb-6 flex justify-between",
                       theme === 'light' ? 'text-zinc-700' : 'text-zinc-400'
                     )}>
                        <span>Real-time Hashrate</span>
                        <span className={cn("font-mono", theme === 'light' ? 'text-emerald-600' : 'text-emerald-400')}>{formatHashrate(currentHashrate)}</span>
                     </h3>
                     
                     <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                                    itemStyle={{ color: '#10b981', fontFamily: 'monospace' }}
                                    labelStyle={{ color: '#71717a', fontSize: '12px' }}
                                    formatter={(value: any) => [formatHashrate(Number(value)), "Hashrate"]}
                                />
                                <XAxis dataKey="time" hide />
                                <YAxis hide domain={['auto', 'auto']} />
                                <Area 
                                    type="monotone" 
                                    dataKey="hashrate" 
                                    stroke="#10b981" 
                                    fillOpacity={1} 
                                    fill="url(#colorHr)" 
                                    strokeWidth={2}
                                    animationDuration={500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                     </div>
                </div>
            </div>

            {/* Results Section */}
            {finalResults && status !== 'running' && (
                                <div className={cn("border rounded-xl p-6 animate-in slide-in-from-bottom-2",
                                    theme === 'light'
                                        ? 'border-emerald-400/30 bg-emerald-500/5'
                                        : 'border-emerald-500/20 bg-emerald-500/5'
                                )}>
                                        <h3 className={cn("font-medium mb-4 flex items-center gap-2",
                                            theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
                                        )}>
                        Included in 1.0 DB Report ✅
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div>
                                                        <div className={cn("text-xs uppercase tracking-widest",
                                                            theme === 'light' ? 'text-emerald-700/70' : 'text-emerald-500/60'
                                                        )}>Average Speed</div>
                                                        <div className={cn("text-2xl font-mono mt-1",
                                                            theme === 'light' ? 'text-zinc-900' : 'text-white'
                                                        )}>{formatHashrate(finalResults.avg)}</div>
                        </div>
                        <div>
                                                        <div className={cn("text-xs uppercase tracking-widest",
                                                            theme === 'light' ? 'text-emerald-700/70' : 'text-emerald-500/60'
                                                        )}>Max Peak</div>
                                                        <div className={cn("text-2xl font-mono mt-1",
                                                            theme === 'light' ? 'text-zinc-900' : 'text-white'
                                                        )}>{formatHashrate(finalResults.max)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-emerald-500/60 uppercase tracking-widest">Algorithm</div>
                            <div className="text-2xl font-mono text-white mt-1">{deviceType === 'cpu' ? 'RandomX' : 'XMR-GPU'}</div>
                        </div>
                        <div>
                             <div className="text-xs text-emerald-500/60 uppercase tracking-widest">Est. Daily $BMT</div>
                             {/* Mock calc: 1 MH/s ~ 100 BMT */}
                             <div className="text-2xl font-mono text-white mt-1">
                                {(finalResults.avg / (deviceType === 'cpu' ? 1000 : 1000000) * 125).toFixed(2)}
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Benchmark;