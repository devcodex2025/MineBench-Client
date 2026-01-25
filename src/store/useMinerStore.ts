import { create } from 'zustand';

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
    workerName: string;
    threads: number;
    cpuName: string;
    cpuCores: number;
    
    // Status
    status: 'idle' | 'running' | 'stopping' | 'error' | 'completed';
    isRunning: boolean;
    
    // Metrics
    currentHashrate: number;
    currentTemp: number | null;
    currentPower: number | null;
    
    // Rewards ($BMT)
    sessionRewards: number;
    totalRewards: number;

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
    setStatus: (status: MiningState['status']) => void;
    setThreads: (threads: number) => void;
    setCpuInfo: (name: string, cores: number) => void;
    addLog: (msg: string) => void;
    updateStats: (hashrate: number, temp: number | null, power?: number) => void;
    updatePoolStatus: (id: string, status: Partial<MiningState['pools'][string]>) => void;
    resetSession: () => void;
}

export const useMinerStore = create<MiningState>((set) => ({
    mode: 'benchmark',
    deviceType: 'cpu',
    wallet: '48ghPqjkJYEKAL1ukr9YmB6B8V1g9kjMrFkrP36ZnVLxHRyFs9odvapQtjFkWRyjsG1N3ipHqiByjHUNrDZTsxG2DRRHWjj', 
    workerName: 'Miner-v1',
    threads: 1,
    cpuName: '',
    cpuCores: 1,
    
    status: 'idle',
    isRunning: false,
    
    currentHashrate: 0,
    currentTemp: null,
    currentPower: null,
    
    sessionRewards: 0,
    totalRewards: 0,
    
    history: [],
    logs: [],

    pools: {
        'cpu': { isSynced: false, height: 0, targetHeight: 0, progress: 0, connected: false, coin: 'XMR' }
        // GPU pool will be added when RVN node is deployed
    },

    setMode: (mode) => set({ mode }),
    setDeviceType: (deviceType) => set({ deviceType }),
    setWallet: (wallet) => set({ wallet }),
    setStatus: (status) => set({ status, isRunning: status === 'running' }),
    setThreads: (threads) => set({ threads }),
    setCpuInfo: (cpuName, cpuCores) => set({ cpuName, cpuCores, threads: cpuCores }),
    
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
         const newHistory = [
            ...state.history.slice(-50), 
            { time: new Date().toLocaleTimeString(), hashrate, temp, power }
         ];
         
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
    })
}));