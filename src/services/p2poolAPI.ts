import { getEnvironmentConfig } from '../config/environment';

/**
 * P2Pool API Service
 * Отримує статистику майнінгу та винагороди з P2Pool RPC
 */

export interface P2PoolWorkerStats {
  wallet: string;
  totalHashes: number;
  totalShares: number;
  totalReward: number; // in XMR
  lastShare: number; // timestamp
  estimatedDaily: number; // estimated XMR per day
  estimatedMonthly: number; // estimated XMR per month
  hashrate: number; // current hashrate estimate
  workers: {
    name: string;
    hashrate: number;
    shares: number;
    lastSeen: number;
  }[];
}

export interface P2PoolStats {
  poolHashrate: number;
  poolDifficulty: number;
  miners: number;
  totalShares: number;
  blockReward: number;
  nextBlockTime: number;
}

class P2PoolService {
  private rpcHost: string;
  private rpcPort: number;
  private staleTime = 5000; // 5 seconds cache

  constructor(host?: string, port?: number) {
    const env = getEnvironmentConfig();
    this.rpcHost = host ?? env.poolRpcHost;
    this.rpcPort = port ?? env.poolRpcPort;
  }

  private async rpcCall(method: string, params: any = {}) {
    try {
      // Try to use Electron IPC first (bypasses CORS)
      // @ts-ignore
      if (window.electron?.ipcRenderer) {
        try {
          const result = await window.electron.ipcRenderer.invoke('p2pool-rpc-call', {
            method,
            params,
            host: this.rpcHost,
            port: this.rpcPort
          });
          return result;
        } catch (ipcErr) {
          console.warn(`[P2PoolAPI] IPC call failed, falling back to fetch:`, ipcErr);
        }
      }

      // Fallback to fetch for web environment
      const response = await fetch(`http://${this.rpcHost}:${this.rpcPort}/json_rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '0',
          method,
          params
        })
      });

      if (!response.ok) throw new Error(`RPC Error: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (err) {
      console.error(`[P2PoolAPI] RPC call failed (${method}):`, err);
      throw err;
    }
  }

  /**
   * Отримати інформацію про пул
   */
  async getPoolStats(): Promise<P2PoolStats> {
    try {
      const info = await this.rpcCall('get_info');
      
      return {
        poolHashrate: info.difficulty / 120, // rough estimate
        poolDifficulty: info.difficulty,
        miners: 0, // не доступно через RPC
        totalShares: 0, // не доступно через RPC
        blockReward: 4.4, // Monero block reward (примерно)
        nextBlockTime: 120 // Monero target: 120 seconds
      };
    } catch (err) {
      throw new Error(`Failed to get pool stats: ${err}`);
    }
  }

  /**
   * Отримати статистику worker за wallet адресою
   * ПРИМІТКА: P2Pool не предоставляє цю інформацію через стандартне RPC
   * Потрібна власна DB або integration з P2Pool API
   */
  async getWorkerStats(walletAddress: string): Promise<P2PoolWorkerStats> {
    try {
      // Тимчасово повертаємо mock дані
      // Реальна реалізація потребує:
      // 1. Custom P2Pool API endpoint
      // 2. Або парсинг P2Pool UI
      // 3. Або власна база даних для відстеження shares

      return {
        wallet: walletAddress,
        totalHashes: 0,
        totalShares: 0,
        totalReward: 0,
        lastShare: 0,
        estimatedDaily: 0,
        estimatedMonthly: 0,
        hashrate: 0,
        workers: []
      };
    } catch (err) {
      console.error('[P2PoolAPI] Failed to get worker stats:', err);
      throw err;
    }
  }

  /**
   * Розрахувати估計 винагороду на основі хешрейту
   */
  calculateEstimatedReward(
    hashrate: number, // in H/s
    networkDifficulty: number,
    blockReward: number = 4.4
  ): {
    hourly: number;
    daily: number;
    monthly: number;
  } {
    // Формула: Reward = (Your Hashrate / Network Hashrate) * Block Reward * Blocks per period
    // Monero: 1 block кожні 120 сек = 720 блоків на день
    
    // Network hashrate estimate (rough)
    const networkHashrate = networkDifficulty / 120;
    const shareOfNetwork = hashrate / networkHashrate;
    
    const blocksPerHour = (3600 / 120); // 30 блоків
    const blocksPerDay = blocksPerHour * 24; // 720 блоків
    const blocksPerMonth = blocksPerDay * 30; // 21,600 блоків

    const hourlyReward = shareOfNetwork * blocksPerHour * blockReward;
    const dailyReward = shareOfNetwork * blocksPerDay * blockReward;
    const monthlyReward = shareOfNetwork * blocksPerMonth * blockReward;

    return {
      hourly: hourlyReward,
      daily: dailyReward,
      monthly: monthlyReward
    };
  }

  /**
   * Отримати інформацію про додану вартість (BMT token)
   */
  async getBMTValue(): Promise<number> {
    try {
      // TODO: Інтегрувати з реальним API для BMT ціни
      // На разі повертаємо 0 поки не буде розроблено токен
      return 0;
    } catch (err) {
      console.error('[P2PoolAPI] Failed to get BMT value:', err);
      return 0;
    }
  }

  /**
   * Перевірити чи wallet адреса валідна для Monero
   */
  validateMoneroAddress(address: string): boolean {
    // Monero address: 95 char base58 або 106 char (integrated address)
    const moneroPrimaryPattern = /^4[0-9a-zA-Z]{94}$/;
    const moneroIntegratedPattern = /^8[0-9a-zA-Z]{105}$/;
    
    return moneroPrimaryPattern.test(address) || moneroIntegratedPattern.test(address);
  }

  /**
   * Отримати історію блоків (для діагностики)
   */
  async getBlockHistory(limit = 10) {
    try {
      const lastBlockHash = await this.rpcCall('getlastblockheader');
      const blocks = [lastBlockHash.block_header];

      for (let i = 1; i < limit; i++) {
        const prevHeader = await this.rpcCall('getblockheaderbyhash', {
          hash: blocks[blocks.length - 1].prev_hash
        });
        blocks.push(prevHeader.block_header);
      }

      return blocks;
    } catch (err) {
      console.error('[P2PoolAPI] Failed to get block history:', err);
      return [];
    }
  }
}

// Singleton instance
export const p2poolAPI = new P2PoolService();
