declare module "recharts";

interface DisplayStatus {
  platform: string;
  isLinux: boolean;
  hasDisplay: boolean;
  displayWarnings: string[];
  displayInfo?: string;
  isRunningWithSudo?: boolean;
}

interface RuntimePoolEndpoint {
  stratumHost: string;
  rpcHost: string;
  stratumPort: number;
  rpcPort: number;
}

interface RuntimePoolConfig {
  source: 'backend-runtime' | 'local-fallback';
  primary: RuntimePoolEndpoint;
  backup: RuntimePoolEndpoint | null;
}

// Add Three.js JSX types
import { ThreeElements } from '@react-three/fiber'

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, func: (...args: any[]) => void) => () => void;
      onMinerLog: (callback: (event: any, data: string) => void) => () => void;
      getDisplayStatus: () => Promise<DisplayStatus>;
      logToFile: (level: string, message: string, source?: string) => void;
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, func: (...args: any[]) => void) => () => void;
      };
      getRuntimePoolConfig?: () => Promise<RuntimePoolConfig>;
    };
  }
  
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

