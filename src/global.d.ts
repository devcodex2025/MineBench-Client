declare module "recharts";

interface DisplayStatus {
  platform: string;
  isLinux: boolean;
  hasDisplay: boolean;
  displayWarnings: string[];
  displayInfo?: string;
  isRunningWithSudo?: boolean;
}

interface Window {
  electron: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => () => void;
    onMinerLog: (callback: (event: any, data: string) => void) => () => void;
    getDisplayStatus: () => Promise<DisplayStatus>;
  };
}

// Add Three.js JSX types
import { ThreeElements } from '@react-three/fiber'
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

