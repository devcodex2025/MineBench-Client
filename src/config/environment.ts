/**
 * Environment Configuration
 * Управління конфігурацією для розробки та продакшну
 */

export type Environment = 'development' | 'production';

export interface EnvironmentConfig {
  // App environment
  env: Environment;
  isDev: boolean;
  isProd: boolean;
  
  // Wallet Authorization
  walletAuthUrl: string;
  
  // API Endpoints
  apiBaseUrl: string;
  
  // Backend Services
  backendUrl: string;
  
  // Wallet Service
  walletServiceUrl: string;
  
  // Multi-device sync
  syncServiceUrl: string;
  
  // Solana RPC
  solanaRpcUrl: string;
  
  // Pool API
  poolApiUrl: string;

  // Pool Stratum
  poolStratumHost: string;
  poolStratumPort: number;
  poolStratumUrl: string;
  poolStratumHostBackup: string;
  poolStratumPortBackup: number;
  poolStratumUrlBackup: string;

  // Pool RPC (P2Pool JSON-RPC)
  poolRpcHost: string;
  poolRpcPort: number;
  poolRpcUrl: string;
  poolRpcHostBackup: string;
  poolRpcPortBackup: number;
  poolRpcUrlBackup: string;

  // Pool Infra Ports (for diagnostics/config display)
  moneroP2pPort: number;
  moneroP2pPortBackup: number;
  moneroRpcPort: number;
  moneroRpcPortBackup: number;
  moneroZmqPort: number;
  p2poolP2pPort: number;
  p2poolP2pPortBackup: number;

  // Akash port mapping (external -> internal)
  stratumPortInternal: number;
  moneroP2pPortInternal: number;
  moneroRpcPortInternal: number;
  p2poolP2pPortInternal: number;
}

// Development Configuration
const developmentConfig: EnvironmentConfig = {
  env: 'development',
  isDev: true,
  isProd: false,
  
  // Local development server
  walletAuthUrl: 'http://localhost:3000/auth',
  apiBaseUrl: 'http://localhost:3000/api',
  backendUrl: 'http://localhost:3000',
  walletServiceUrl: 'http://localhost:3000/wallet',
  syncServiceUrl: 'ws://localhost:3000/sync',
  solanaRpcUrl: 'https://api.devnet.solana.com',
  poolApiUrl: 'http://localhost:8080/api',
  poolStratumHost: 'xmr.minebench.cloud',
  poolStratumPort: 32599,
  poolStratumUrl: 'xmr.minebench.cloud:32599',
  poolStratumHostBackup: 'xmr2.minebench.cloud',
  poolStratumPortBackup: 31915,
  poolStratumUrlBackup: 'xmr2.minebench.cloud:31915',
  poolRpcHost: 'xmr.minebench.cloud',
  poolRpcPort: 31860,
  poolRpcUrl: 'http://xmr.minebench.cloud:31860/json_rpc',
  poolRpcHostBackup: 'xmr2.minebench.cloud',
  poolRpcPortBackup: 32076,
  poolRpcUrlBackup: 'http://xmr2.minebench.cloud:32076/json_rpc',
  moneroP2pPort: 31527,
  moneroP2pPortBackup: 31339,
  moneroRpcPort: 31860,
  moneroRpcPortBackup: 32076,
  moneroZmqPort: 18083,
  p2poolP2pPort: 31656,
  p2poolP2pPortBackup: 31885,
  stratumPortInternal: 32599,
  moneroP2pPortInternal: 31527,
  moneroRpcPortInternal: 31860,
  p2poolP2pPortInternal: 31656,
};

// Production Configuration
const productionConfig: EnvironmentConfig = {
  env: 'production',
  isDev: false,
  isProd: true,
  
  // Production cloud endpoints
  walletAuthUrl: 'https://minebench.cloud/auth',
  apiBaseUrl: 'https://minebench.cloud/api',
  backendUrl: 'https://minebench.cloud',
  walletServiceUrl: 'https://minebench.cloud/wallet',
  syncServiceUrl: 'wss://minebench.cloud/sync',
  solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
  poolApiUrl: 'https://minebench.cloud/api/pool',
  poolStratumHost: 'xmr.minebench.cloud',
  poolStratumPort: 32599,
  poolStratumUrl: 'xmr.minebench.cloud:32599',
  poolStratumHostBackup: 'xmr2.minebench.cloud',
  poolStratumPortBackup: 31915,
  poolStratumUrlBackup: 'xmr2.minebench.cloud:31915',
  poolRpcHost: 'xmr.minebench.cloud',
  poolRpcPort: 31860,
  poolRpcUrl: 'http://xmr.minebench.cloud:31860/json_rpc',
  poolRpcHostBackup: 'xmr2.minebench.cloud',
  poolRpcPortBackup: 32076,
  poolRpcUrlBackup: 'http://xmr2.minebench.cloud:32076/json_rpc',
  moneroP2pPort: 31527,
  moneroP2pPortBackup: 31339,
  moneroRpcPort: 31860,
  moneroRpcPortBackup: 32076,
  moneroZmqPort: 18083,
  p2poolP2pPort: 37889,
  p2poolP2pPortBackup: 31885,
  stratumPortInternal: 32599,
  moneroP2pPortInternal: 31527,
  moneroRpcPortInternal: 31860,
  p2poolP2pPortInternal: 31656,
};

/**
 * Get environment configuration based on Vite's mode
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  // Use Vite's import.meta.env.PROD which is true when building for production
  // Note: import.meta.env.MODE is set based on --mode flag or defaults to 'development'
  const isProduction = import.meta.env.PROD as boolean;
  const mode = (import.meta.env.MODE as string) || 'development';
  
  const env: Environment = isProduction || mode === 'production' ? 'production' : 'development';
  
  if (env === 'production') {
    return productionConfig;
  }
  
  return developmentConfig;
}

/**
 * Get current environment
 */
export function getEnvironment(): Environment {
  return getEnvironmentConfig().env;
}

/**
 * Check if development mode
 */
export function isDevelopment(): boolean {
  return getEnvironmentConfig().isDev;
}

/**
 * Check if production mode
 */
export function isProduction(): boolean {
  return getEnvironmentConfig().isProd;
}
