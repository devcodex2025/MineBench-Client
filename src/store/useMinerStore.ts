import { create } from 'zustand';
import { getEnvironmentConfig } from '../config/environment';

export type AppMode = 'benchmark' | 'mining';
export type DeviceType = 'cpu' | 'gpu';

interface StatsPoint {
    time: string;
    hashrate: number;
    temp: number | null;
    power?: number;
}

interface MiningState {
    // Configuration
    mode: AppMode;
    deviceType: DeviceType;
    wallet: string;
    walletVerified: boolean; // Verified with Solana wallet
    solanaPublicKey?: string; // User's Solana public key for multi-device sync
    workerName: string;
    threads: number;
    cpuName: string;
    cpuCores: number;

    // Status
    status: 'idle' | 'starting' | 'running' | 'stopping' | 'paused' | 'error' | 'completed';
    isRunning: boolean;
    isPaused: boolean;

    // Metrics
    currentHashrate: number;
    currentTemp: number | null;
    currentPower: number | null;

    // Rewards ($BMT)
    sessionRewards: number;
    totalRewards: number;
    p2poolBalance: number; // XMR balance in P2Pool
    dbTotalBMT: number;   // Confirmed total BMT rewards from backend

    // xmrig Settings
    donateLevel: number;
    poolUrl: string;
    cpuPriority: number; // 0-5, higher = more aggressive
    randomxMode: 'auto' | 'fast' | 'light'; // fast uses 2GB RAM, light uses 256MB
    hugePages: boolean;
    manualPoolSelection: boolean;

    // History
    history: StatsPoint[];
    logs: string[];

    // Pool statuses
    pools: {
        [key: string]: {
            isSynced: boolean;
            height: number;
            targetHeight: number;
            progress: number;
            connected: boolean;
            message?: string;
            coin?: string;
        };
    };

    // Global Pool Stats
    poolHashrateTotal: number;
    poolMinersCount: number;
    poolNetworkHashrate: number;

    // Exchange Rates (from Oracle)
    xmrUsd: number;
    bmtUsd: number;
    rateXmrBmt: number;
    ratesLastUpdated: string | null; // Timestamp when rates were last fetched

    // Actions
    setMode: (mode: AppMode) => void;
    setDeviceType: (type: DeviceType) => void;
    setWallet: (wallet: string) => void;
    setWalletVerified: (verified: boolean, solanaKey?: string) => void;
    setStatus: (status: MiningState['status']) => void;
    setThreads: (threads: number) => void;
    setCpuInfo: (name: string, cores: number) => void;
    setDonateLevel: (level: number) => void;
    setPoolUrl: (url: string) => void;
    setCpuPriority: (priority: number) => void;
    setRandomxMode: (mode: 'auto' | 'fast' | 'light') => void;
    setHugePages: (enabled: boolean) => void;
    setDbTotalBMT: (balance: number) => void;
    setP2PoolBalance: (balance: number) => void;
    setManualPoolSelection: (manual: boolean) => void;
    addLog: (msg: string) => void;
    updateStats: (hashrate: number, temp: number | null, power?: number) => void;
    updatePoolStatus: (id: string, status: Partial<MiningState['pools'][string]>) => void;
    setGlobalPoolStats: (hashrate: number, miners: number, networkHashrate?: number) => void;
    setPoolNetworkHashrate: (networkHashrate: number) => void;
    setExchangeRates: (xmrUsd: number, bmtUsd: number, rateXmrBmt: number) => void;
    resetSession: () => void;
    saveSettings: () => void;
    loadSettings: () => void;
}

// Types for settings persistence
interface MinerSettings {
    wallet: string;
    workerName: string;
    threads: number;
    donateLevel: number;
    poolUrl: string;
    cpuPriority: number;
    randomxMode: 'auto' | 'fast' | 'light';
    hugePages: boolean;
    deviceType: DeviceType;
    manualPoolSelection: boolean;
}

export const useMinerStore = create<MiningState>((set) => ({
    mode: 'benchmark',
    deviceType: 'cpu',
    wallet: '48ghPqjkJYEKAL1ukr9YmB6B8V1g9kjMrFkrP36ZnVLxHRyFs9odvapQtjFkWRyjsG1N3ipHqiByjHUNrDZTsxG2DRRHWjj',
    walletVerified: false,
    solanaPublicKey: undefined,
    workerName: 'Miner-v1',
    threads: 1,
    cpuName: '',
    cpuCores: 1,

    status: 'idle',
    isRunning: false,
    isPaused: false,

    currentHashrate: 0,
    currentTemp: null,
    currentPower: null,

    sessionRewards: 0,
    totalRewards: 0,
    dbTotalBMT: 0,
    p2poolBalance: 0,

    donateLevel: 1,
    poolUrl: getEnvironmentConfig().poolStratumUrl,
    cpuPriority: 2, // Default: balanced (0=lowest, 5=highest)
    randomxMode: 'auto', // auto-detect best mode
    hugePages: true, // Enable huge pages for better performance
    manualPoolSelection: false, // Default: auto-switch between primary/backup

    history: [],
    logs: [],

    pools: {
        'cpu': { isSynced: false, height: 0, targetHeight: 0, progress: 0, connected: false, coin: 'XMR' },
        'cpu-backup': { isSynced: false, height: 0, targetHeight: 0, progress: 0, connected: false, coin: 'XMR' }
        // GPU pool will be added when RVN node is deployed
    },

    poolHashrateTotal: 0,
    poolMinersCount: 0,
    poolNetworkHashrate: 0,

    xmrUsd: 0, // Will be fetched from backend
    bmtUsd: 0, // Will be fetched from backend
    rateXmrBmt: 0, // Will be fetched from backend
    ratesLastUpdated: null, // Timestamp when rates were last fetched

    setMode: (mode) => set({ mode }),
    setDeviceType: (deviceType) => set({ deviceType }),
    setWallet: (wallet) => set({ wallet }),
    setWalletVerified: (verified, solanaKey) => set({ walletVerified: verified, solanaPublicKey: solanaKey }),
    setStatus: (status) => set({ status, isRunning: status === 'running', isPaused: status === 'paused' }),
    setThreads: (threads) => set({ threads }),
    setCpuInfo: (cpuName, cpuCores) => set({ cpuName, cpuCores, threads: cpuCores }),
    setDonateLevel: (donateLevel) => set({ donateLevel }),
    setPoolUrl: (poolUrl) => set({ poolUrl }),
    setCpuPriority: (cpuPriority) => set({ cpuPriority }),
    setRandomxMode: (randomxMode) => set({ randomxMode }),
    setHugePages: (hugePages) => set({ hugePages }),
    setDbTotalBMT: (dbTotalBMT) => set({ dbTotalBMT }),
    setP2PoolBalance: (p2poolBalance) => set({ p2poolBalance }),
    setManualPoolSelection: (manualPoolSelection) => set({ manualPoolSelection }),

    addLog: (msg) => set((state) => ({
        logs: [...state.logs.slice(-100), `${new Date().toLocaleTimeString()} - ${msg}`]
    })),

    updatePoolStatus: (id, newStatus) => set((state) => ({
        pools: {
            ...state.pools,
            [id]: { ...state.pools[id], ...newStatus }
        }
    })),

    setGlobalPoolStats: (hashrate: number, miners: number, networkHashrate?: number) => set({
        poolHashrateTotal: hashrate,
        poolMinersCount: miners,
        poolNetworkHashrate: networkHashrate || 0
    }),

    setPoolNetworkHashrate: (networkHashrate: number) => set({ poolNetworkHashrate: networkHashrate }),

    setExchangeRates: (xmrUsd: number, bmtUsd: number, rateXmrBmt: number) => set({
        xmrUsd: Number.isFinite(xmrUsd) ? xmrUsd : 0,
        bmtUsd: Number.isFinite(bmtUsd) ? bmtUsd : 0,
        rateXmrBmt: Number.isFinite(rateXmrBmt) ? rateXmrBmt : 0,
        ratesLastUpdated: new Date().toLocaleString()
    }),

    updateStats: (hashrate: number, temp: number | null, power?: number) => set((state) => {
        const safeHashrate = hashrate || 0;
        const rewardTick = (safeHashrate / 1000000) * 0.1 / 3600; // 0.1 BMT per MH/hr
        const newTotal = (state.totalRewards || 0) + rewardTick;
        const newSession = (state.sessionRewards || 0) + rewardTick;

        return {
            currentHashrate: safeHashrate,
            currentTemp: temp,
            currentPower: power,
            sessionRewards: isNaN(newSession) ? state.sessionRewards : newSession,
            totalRewards: isNaN(newTotal) ? state.totalRewards : newTotal,
            history: [...state.history.slice(-29), {
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                hashrate: safeHashrate,
                temp: temp || 0,
                power: power || 0
            }]
        };
    }),

    resetSession: () => set({
        history: [],
        currentHashrate: 0,
        currentTemp: null,
        sessionRewards: 0,
        status: 'idle'
    }),

    saveSettings: () => set((state) => {
        const settings: MinerSettings = {
            wallet: state.wallet,
            workerName: state.workerName,
            threads: state.threads,
            donateLevel: state.donateLevel,
            poolUrl: state.poolUrl,
            cpuPriority: state.cpuPriority,
            randomxMode: state.randomxMode,
            hugePages: state.hugePages,
            deviceType: state.deviceType,
            manualPoolSelection: state.manualPoolSelection
        };

        try {
            // Save to localStorage
            localStorage.setItem('minerSettings', JSON.stringify(settings));

            // Also save to Electron app data for persistence
            if (window.electron?.invoke) {
                window.electron.invoke('save-miner-settings', settings).catch((err: any) => {
                    console.error('Failed to save settings to Electron:', err);
                });
            }

            console.log('✅ Miner settings saved');
        } catch (err) {
            console.error('Failed to save miner settings:', err);
        }

        return state;
    }),

    loadSettings: () => set((state) => {
        try {
            const saved = localStorage.getItem('minerSettings');
            if (saved) {
                const settings: MinerSettings = JSON.parse(saved);
                return {
                    wallet: settings.wallet || state.wallet,
                    workerName: settings.workerName || state.workerName,
                    threads: settings.threads || state.threads,
                    donateLevel: settings.donateLevel ?? state.donateLevel,
                    poolUrl: settings.poolUrl || state.poolUrl,
                    cpuPriority: settings.cpuPriority ?? state.cpuPriority,
                    randomxMode: settings.randomxMode || state.randomxMode,
                    hugePages: settings.hugePages ?? state.hugePages,
                    deviceType: settings.deviceType || state.deviceType,
                    manualPoolSelection: settings.manualPoolSelection ?? state.manualPoolSelection
                };
            }
        } catch (err) {
            console.error('Failed to load miner settings:', err);
        }

        return state;
    })
}));
