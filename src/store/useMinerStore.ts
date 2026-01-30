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
    status: 'idle' | 'running' | 'stopping' | 'paused' | 'error' | 'completed';
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

    // xmrig Settings
    donateLevel: number;
    poolUrl: string;
    cpuPriority: number; // 0-5, higher = more aggressive
    randomxMode: 'auto' | 'fast' | 'light'; // fast uses 2GB RAM, light uses 256MB
    hugePages: boolean;

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
    setP2PoolBalance: (balance: number) => void;
    addLog: (msg: string) => void;
    updateStats: (hashrate: number, temp: number | null, power?: number) => void;
    updatePoolStatus: (id: string, status: Partial<MiningState['pools'][string]>) => void;
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
    p2poolBalance: 0,

    donateLevel: 1,
    poolUrl: getEnvironmentConfig().poolStratumUrl,
    cpuPriority: 2, // Default: balanced (0=lowest, 5=highest)
    randomxMode: 'auto', // auto-detect best mode
    hugePages: true, // Enable huge pages for better performance
    
    history: [],
    logs: [],

    pools: {
        'cpu': { isSynced: false, height: 0, targetHeight: 0, progress: 0, connected: false, coin: 'XMR' }
        // GPU pool will be added when RVN node is deployed
    },

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
    setP2PoolBalance: (p2poolBalance) => set({ p2poolBalance }),
    
    addLog: (msg) => set((state) => ({ 
        logs: [...state.logs.slice(-100), `${new Date().toLocaleTimeString()} - ${msg}`] 
    })),

    updatePoolStatus: (id, newStatus) => set((state) => ({
        pools: {
            ...state.pools,
            [id]: { ...state.pools[id], ...newStatus }
        }
    })),
    
    updateStats: (hashrate, temp, power) => set((state) => {
         // Limit history to last 50 points
         const newEntry = { time: new Date().toLocaleTimeString(), hashrate, temp, power };
         const newHistory = [...state.history.slice(-49), newEntry];
         
         // Mock BMT Calculation accumulation
         // 0.0001 BMT per MH/s per update (5s) - Mock
         const rewardTick = (hashrate / 1000) * 0.00001; 

         return {
            history: newHistory,
            currentHashrate: hashrate,
            currentTemp: temp,
            currentPower: power || null,
            sessionRewards: state.sessionRewards + rewardTick,
            totalRewards: state.totalRewards + rewardTick
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
            deviceType: state.deviceType
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
                    deviceType: settings.deviceType || state.deviceType
                };
            }
        } catch (err) {
            console.error('Failed to load miner settings:', err);
        }
        
        return state;
    })
}));