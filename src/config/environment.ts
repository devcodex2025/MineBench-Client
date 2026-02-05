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

  // Solana SPL Token (BMT)
  // Mint address of the $BMT SPL token on Solana mainnet
  bmtTokenMint: string;

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

  // Production cloud endpoints (use production for wallet services)
  walletAuthUrl: 'https://minebench.cloud/auth',
  apiBaseUrl: 'https://backend.minebench.cloud/api',
  backendUrl: 'https://backend.minebench.cloud',
  walletServiceUrl: 'https://minebench.cloud/wallet',
  syncServiceUrl: 'ws://localhost:3000/sync',
  solanaRpcUrl: 'https://api.devnet.solana.com',
  bmtTokenMint: (import.meta.env.VITE_BMT_TOKEN_MINT as string) || '67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev',
  poolApiUrl: 'http://localhost:8080/api',
  poolStratumHost: 'xmr.minebench.cloud',
  poolStratumPort: Number(import.meta.env.VITE_POOL_STRATUM_PORT) || 31446,
  poolStratumUrl: `xmr.minebench.cloud:${import.meta.env.VITE_POOL_STRATUM_PORT || 31446}`,
  poolStratumHostBackup: 'xmr2.minebench.cloud',
  poolStratumPortBackup: 31915,
  poolStratumUrlBackup: 'xmr2.minebench.cloud:31915',
  poolRpcHost: 'xmr.minebench.cloud',
  poolRpcPort: Number(import.meta.env.VITE_MONERO_RPC_PORT) || 30339,
  poolRpcUrl: `http://xmr.minebench.cloud:${import.meta.env.VITE_MONERO_RPC_PORT || 30339}/json_rpc`,
  poolRpcHostBackup: 'xmr2.minebench.cloud',
  poolRpcPortBackup: 32076,
  poolRpcUrlBackup: 'http://xmr2.minebench.cloud:32076/json_rpc',
  moneroP2pPort: Number(import.meta.env.VITE_MONERO_P2P_PORT) || 30396,
  moneroP2pPortBackup: 31339,
  moneroRpcPort: Number(import.meta.env.VITE_MONERO_RPC_PORT) || 30339,
  moneroRpcPortBackup: 32076,
  moneroZmqPort: 18083,
  p2poolP2pPort: Number(import.meta.env.VITE_P2POOL_P2P_PORT) || 30681,
  p2poolP2pPortBackup: 31885,
  stratumPortInternal: 3333,
  moneroP2pPortInternal: 18080,
  moneroRpcPortInternal: 18081,
  p2poolP2pPortInternal: 37889,
};

// Production Configuration
const productionConfig: EnvironmentConfig = {
  env: 'production',
  isDev: false,
  isProd: true,

  // Production cloud endpoints
  // Production cloud endpoints
  walletAuthUrl: 'https://minebench.cloud/auth',
  // All direct backend API calls should go to backend.minebench.cloud
  apiBaseUrl: (import.meta as any).env.VITE_API_BASE_URL || 'https://backend.minebench.cloud/api',
  backendUrl: (import.meta as any).env.VITE_BACKEND_URL || 'https://backend.minebench.cloud',
  walletServiceUrl: 'https://minebench.cloud/wallet',
  syncServiceUrl: 'wss://minebench.cloud/sync',
  solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
  bmtTokenMint: (import.meta.env.VITE_BMT_TOKEN_MINT as string) || '67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev',
  poolApiUrl: 'https://minebench.cloud/api/pool',
  poolStratumHost: 'xmr.minebench.cloud',
  poolStratumPort: Number(import.meta.env.VITE_POOL_STRATUM_PORT) || 31446,
  poolStratumUrl: `xmr.minebench.cloud:${import.meta.env.VITE_POOL_STRATUM_PORT || 31446}`,
  poolStratumHostBackup: 'xmr2.minebench.cloud',
  poolStratumPortBackup: 31915,
  poolStratumUrlBackup: 'xmr2.minebench.cloud:31915',
  poolRpcHost: 'xmr.minebench.cloud',
  poolRpcPort: Number(import.meta.env.VITE_MONERO_RPC_PORT) || 30339,
  poolRpcUrl: `http://xmr.minebench.cloud:${import.meta.env.VITE_MONERO_RPC_PORT || 30339}/json_rpc`,
  poolRpcHostBackup: 'xmr2.minebench.cloud',
  poolRpcPortBackup: 32076,
  poolRpcUrlBackup: 'http://xmr2.minebench.cloud:32076/json_rpc',
  moneroP2pPort: Number(import.meta.env.VITE_MONERO_P2P_PORT) || 30396,
  moneroP2pPortBackup: 31339,
  moneroRpcPort: Number(import.meta.env.VITE_MONERO_RPC_PORT) || 30339,
  moneroRpcPortBackup: 32076,
  moneroZmqPort: 18083,
  p2poolP2pPort: Number(import.meta.env.VITE_P2POOL_P2P_PORT) || 30681,
  p2poolP2pPortBackup: 31885,
  stratumPortInternal: 3333,
  moneroP2pPortInternal: 18080,
  moneroRpcPortInternal: 18081,
  p2poolP2pPortInternal: 37889,
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
