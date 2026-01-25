import React, { Suspense, useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
    Environment, 
    Float, 
    OrbitControls, 
    Stars, 
    MeshDistortMaterial, 
    Sphere, 
    Torus, 
    PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';
import { Play, Square, Flame, Gauge, Zap, Shield, Sparkles, Cpu } from 'lucide-react';
import { useMinerStore } from '../store/useMinerStore';
import { cn, formatHashrate } from '../lib/utils';

const EnergyRing = ({ radius, speed, color, thickness = 0.02 }: { radius: number; speed: number; color: string; thickness?: number }) => {
    const ref = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        ref.current.rotation.x = t * speed * 0.5;
        ref.current.rotation.y = t * speed;
    });

    return (
        <group ref={ref}>
            <Torus args={[radius, thickness, 16, 100]}>
                <meshStandardMaterial 
                    color={color} 
                    emissive={color} 
                    emissiveIntensity={2} 
                    transparent 
                    opacity={0.6}
                />
            </Torus>
        </group>
    );
};

const Particles = ({ count = 100 }) => {
    const points = useMemo(() => {
        const p = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            p[i * 3] = (Math.random() - 0.5) * 15;
            p[i * 3 + 1] = (Math.random() - 0.5) * 15;
            p[i * 3 + 2] = (Math.random() - 0.5) * 15;
        }
        return p;
    }, [count]);

    const ref = useRef<THREE.Points>(null);
    useFrame((state) => {
        if (!ref.current) return;
        ref.current.rotation.y += 0.001;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={points.length / 3}
                    array={points}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial size={0.05} color="#10b981" transparent opacity={0.3} sizeAttenuation />
        </points>
    );
};

const ReactorCore = () => {
    const coreRef = useRef<THREE.Mesh>(null);
    const status = useMinerStore((state) => state.status);
    const currentHashrate = useMinerStore((state) => state.currentHashrate);
    
    const isMining = status === 'running';
    const activityFactor = isMining ? Math.min(1 + currentHashrate / 2000, 4) : 0.2;

    useFrame((state) => {
        if (!coreRef.current) return;
        const t = state.clock.getElapsedTime();
        coreRef.current.rotation.y = t * 0.4 * activityFactor;
        const s = 1 + Math.sin(t * 3 * activityFactor) * 0.05;
        coreRef.current.scale.set(s, s, s);
    });

    return (
        <group>
            <Float speed={2} rotationIntensity={1} floatIntensity={1}>
                <Sphere ref={coreRef} args={[1.2, 64, 64]}>
                    <MeshDistortMaterial
                        color={isMining ? "#10b981" : "#1e293b"}
                        speed={3 * activityFactor}
                        distort={0.4}
                        radius={1.2}
                        emissive={isMining ? "#051109" : "#020617"}
                        emissiveIntensity={isMining ? 4 : 0.2}
                        roughness={0.1}
                        metalness={0.9}
                    />
                </Sphere>
            </Float>

            <pointLight 
                intensity={isMining ? 15 : 2} 
                distance={10} 
                color={isMining ? "#10b981" : "#334155"} 
            />

            <EnergyRing radius={1.8} speed={0.4 * activityFactor} color="#10b981" />
            <EnergyRing radius={2.2} speed={-0.6 * activityFactor} color="#34d399" thickness={0.015} />
            <EnergyRing radius={2.8} speed={0.3 * activityFactor} color="#059669" thickness={0.01} />
            
            <Stars radius={50} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
            <Particles count={300} />
            
            <gridHelper args={[30, 30, 0x10b981, 0x020617]} position={[0, -5, 0]} opacity={0.1} transparent />
        </group>
    );
};

const MiningScene = () => (
    <Canvas gl={{ antialias: true }} dpr={[1, 2]} className="rounded-2xl overflow-hidden">
        <color attach="background" args={["#020408"]} />
        <PerspectiveCamera makeDefault position={[0, 2, 10]} fov={45} />
        <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            autoRotate 
            autoRotateSpeed={0.3}
            maxPolarAngle={Math.PI / 1.5}
            minPolarAngle={Math.PI / 3}
        />
        
        <ambientLight intensity={0.2} />
        <ReactorCore />
        <Environment preset="city" />
    </Canvas>
);

const Mining: React.FC = () => {
    const status = useMinerStore((state) => state.status);
    const setStatus = useMinerStore((state) => state.setStatus);
    const addLog = useMinerStore((state) => state.addLog);
    const deviceType = useMinerStore((state) => state.deviceType);
    const setDeviceType = useMinerStore((state) => state.setDeviceType);
    const wallet = useMinerStore((state) => state.wallet);
    const workerName = useMinerStore((state) => state.workerName);
    const updateStats = useMinerStore((state) => state.updateStats);
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
        return () => {
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (status !== 'running') return;
        statsIntervalRef.current = setInterval(fetchStats, 3500);
        return () => {
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        };
    }, [status, deviceType]);

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
            }
        } catch (err) {
            // ignore transient errors
        }
    };

    const startMining = async () => {
        if (status === 'running') return;
        resetSession();

        try {
            await window.electron.invoke('start-benchmark', {
                type: deviceType,
                wallet,
                worker: workerName,
                threads: deviceType === 'cpu' ? threads : undefined,
            });

            setStatus('running');
            addLog(`Mining started with ${threads} threads`);
            fetchStats();
        } catch (err: any) {
            setStatus('error');
            addLog(`Error starting mining: ${err.message}`);
        }
    };

    const stopMining = async () => {
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        setStatus('stopping');
        try {
            await window.electron.invoke('stop-benchmark', {});
            setStatus('completed');
            addLog('Mining stopped');
        } catch (err: any) {
            setStatus('error');
            addLog(`Error stopping mining: ${err.message}`);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-white">Mining Mode</h1>
                    <p className="text-zinc-500 mt-1">Immersive reactor view with live metrics. Mining to MineBench wallet.</p>
                </div>
                <div className="bg-zinc-900 p-1 rounded-lg border border-white/5 flex gap-1">
                    <button
                        onClick={() => status !== 'running' && setDeviceType('cpu')}
                        className={cn(
                            'px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all',
                            deviceType === 'cpu' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                        )}
                    >
                        <Flame size={16} /> RandomX (CPU)
                    </button>
                    {false && (
                        <button
                            onClick={() => status !== 'running' && setDeviceType('gpu')}
                            className={cn(
                                'px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all',
                                deviceType === 'gpu' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                            )}
                        >
                            <Gauge size={16} /> GPU (Soon)
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-purple-600/10 blur-3xl" />
                    <div className="relative rounded-2xl border border-white/5 bg-zinc-950/70 shadow-xl overflow-hidden">
                        <div className="absolute inset-x-6 top-6 z-10 flex items-center justify-between text-xs text-zinc-400">
                            <span className="flex items-center gap-2"><Sparkles size={14} /> Visual reactor</span>
                            <span className="flex items-center gap-2"><Shield size={14} /> Encrypted session</span>
                        </div>
                        <div className="h-[420px]">
                            <MiningScene />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* CPU Info Card */}
                    {deviceType === 'cpu' && cpuName && (
                        <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <Cpu size={16} />
                                <span className="font-medium text-sm">CPU Information</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Processor:</span>
                                    <span className="text-zinc-300 font-mono text-right max-w-[200px] truncate" title={cpuName}>
                                        {cpuName}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Cores/Threads:</span>
                                    <span className="text-zinc-300 font-mono">{cpuCores}</span>
                                </div>
                            </div>
                            
                            {/* Threads Slider */}
                            <div className="pt-2 border-t border-white/5 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs text-zinc-500">Mining Threads:</label>
                                    <span className="text-sm font-mono text-emerald-400">{threads} / {cpuCores}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max={cpuCores}
                                    value={threads}
                                    onChange={(e) => setThreads(Number(e.target.value))}
                                    disabled={status === 'running'}
                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                                />
                                <p className="text-[10px] text-zinc-600">
                                    {threads === cpuCores ? 'Maximum performance' : `Using ${Math.round((threads / cpuCores) * 100)}% of CPU`}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-zinc-400 text-sm">Session</span>
                            <span className={cn('text-xs px-2 py-1 rounded-full border',
                                status === 'running' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                                : status === 'completed' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                                : status === 'error' ? 'border-red-500/30 text-red-400 bg-red-500/10'
                                : 'border-white/10 text-zinc-400')}>{status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Hashrate" value={formatHashrate(currentHashrate)} icon={<Zap size={16} />} />
                            <StatCard label="Temp" value={currentTemp ? `${currentTemp.toFixed(1)} °C` : '-'} icon={<Flame size={16} />} />
                            <StatCard label="Power" value={currentPower ? `${currentPower.toFixed(0)} W` : '-'} icon={<Gauge size={16} />} />
                            <StatCard label="Session $BMT" value={sessionRewards.toFixed(5)} icon={<Shield size={16} />} />
                        </div>
                        <button
                            onClick={status === 'running' ? stopMining : startMining}
                            className={cn(
                                'w-full py-4 rounded-lg font-bold text-sm tracking-wide transition-all transform active:scale-[0.98]',
                                status === 'running'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                    : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                            )}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {status === 'running' ? <><Square size={18} /> Stop Mining</> : <><Play size={18} /> Start Mining</>}
                            </div>
                        </button>
                        <p className="text-xs text-zinc-500 text-center">Mining to app wallet {wallet.slice(0, 6)}...{wallet.slice(-6)}</p>
                    </div>

                    <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-4 text-sm text-zinc-400 space-y-2">
                        <div className="flex items-center gap-2 text-white">
                            <Shield size={16} />
                            <span className="font-medium">MineBench safety</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                            <li>CPU-first RandomX miner targeting MineBench pool.</li>
                            <li>Rewards are routed to the embedded MineBench wallet.</li>
                            <li>GPU path stays disabled until XMR GPU stack is vetted.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
    <div className="rounded-lg border border-white/5 bg-zinc-950/70 p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-widest">
            {icon}
            <span>{label}</span>
        </div>
        <div className="text-lg font-mono text-white">{value}</div>
    </div>
);

export default Mining;
