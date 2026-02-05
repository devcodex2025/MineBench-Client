import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  Award,
  Zap,
  Cpu,
  Calendar,
  TrendingDown,
  AlertCircle,
  Loader
} from 'lucide-react';
import { useSolanaAuth } from '../services/solanaAuth';
import { useTheme } from '../contexts/ThemeContext';
import { useMinerStore } from '../store/useMinerStore';
import { cn, formatHashrate } from '../lib/utils';

interface RewardData {
  date: string;
  rewards: number;
}

interface DeviceStats {
  name: string;
  hashrate: number;
  uptime: number;
  shares: number;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  theme: string;
}> = ({ icon, title, value, subtitle, trend, theme }) => (
  <div className={cn(
    'p-4 rounded-lg border',
    theme === 'light'
      ? 'bg-white border-zinc-200'
      : 'bg-zinc-900/50 border-white/10'
  )}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn(
            'p-2 rounded-lg',
            theme === 'light'
              ? 'bg-zinc-100 text-zinc-700'
              : 'bg-white/10 text-white/60'
          )}>
            {icon}
          </span>
        </div>
        <p className={cn(
          'text-xs font-medium mb-1',
          theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'
        )}>
          {title}
        </p>
        <p className={cn(
          'text-2xl font-bold',
          theme === 'light' ? 'text-zinc-900' : 'text-white'
        )}>
          {value}
        </p>
        {subtitle && (
          <p className={cn(
            'text-xs mt-1',
            theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'
          )}>
            {subtitle}
          </p>
        )}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={cn(
            'text-sm font-semibold',
            trend > 0 ? 'text-emerald-600' : 'text-red-600'
          )}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        </div>
      )}
    </div>
  </div>
);

export const MiningStatistics: React.FC = () => {
  const { theme } = useTheme();
  const { user, miningStats, statsLoading } = useSolanaAuth();
  const currentHashrate = useMinerStore(state => state.currentHashrate);
  const totalRewards = useMinerStore(state => state.totalRewards);
  const history = useMinerStore(state => state.history);
  const poolHashrateTotal = useMinerStore(state => state.poolHashrateTotal);
  const poolMinersCount = useMinerStore(state => state.poolMinersCount);
  const safeTotalRewards = Number.isFinite(totalRewards) ? totalRewards : 0;

  // Build reward history from live miner history (no mocks)
  const rewardHistory = useMemo<RewardData[]>(() => {
    if (!history || history.length === 0) return [];
    // Map each tick to an approximate reward increment using same formula as store
    // rewardTick = (hashrate / 1000) * 0.00001
    const last = history.slice(-20); // keep last 20 points
    return last.map((p) => ({
      date: p.time,
      rewards: (p.hashrate / 1000) * 0.00001,
    }));
  }, [history]);

  const [deviceStats, setDeviceStats] = useState<DeviceStats[]>([
    {
      name: 'Desktop CPU',
      hashrate: currentHashrate,
      uptime: 12.5,
      shares: 245
    }
  ]);

  useEffect(() => {
    // Оновити статистику пристроєм
    if (miningStats?.devices) {
      setDeviceStats(miningStats.devices.map(d => ({
        name: d.name,
        hashrate: d.totalHashrate,
        uptime: Math.random() * 24,
        shares: Math.floor(Math.random() * 500)
      })));
    }
  }, [miningStats]);

  if (!user) {
    return (
      <div className={cn(
        'p-6 rounded-lg border text-center',
        theme === 'light'
          ? 'bg-zinc-50 border-zinc-200'
          : 'bg-zinc-900/50 border-white/10'
      )}>
        <AlertCircle className={cn(
          'w-12 h-12 mx-auto mb-3',
          theme === 'light' ? 'text-zinc-400' : 'text-zinc-600'
        )} />
        <p className={cn(
          'font-semibold mb-1',
          theme === 'light' ? 'text-zinc-900' : 'text-white'
        )}>
          Connect Your Wallet
        </p>
        <p className={cn(
          'text-sm',
          theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'
        )}>
          Sign in with Solana to view mining statistics and rewards across devices
        </p>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={cn(
          'text-2xl font-bold mb-2',
          theme === 'light' ? 'text-zinc-900' : 'text-white'
        )}>
          Mining Statistics
        </h1>
        <p className={cn(
          'text-sm',
          theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'
        )}>
          Track your mining rewards across all devices
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Award className="w-5 h-5" />}
          title="Total Rewards"
          value={`${safeTotalRewards.toFixed(4)} $BMT`}
          subtitle={undefined}
          trend={12.5}
          theme={theme}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          title="This Session"
          value={`${(history.length).toString()} samples`}
          subtitle="Live data"
          trend={8.3}
          theme={theme}
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          title="Current Hashrate"
          value={formatHashrate(currentHashrate)}
          subtitle={`${(miningStats?.devices.length || 0)} devices`}
          theme={theme}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          title="Pool Sync"
          value={`${useMinerStore.getState().pools['cpu']?.progress.toFixed(1) || 0}%`}
          subtitle={useMinerStore.getState().pools['cpu']?.isSynced ? 'Ready' : 'Syncing'}
          trend={-2.1}
          theme={theme}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          title="Pool Performance"
          value={formatHashrate(poolHashrateTotal)}
          subtitle={`${poolMinersCount} Miners Active`}
          theme={theme}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reward History */}
        <div className={cn(
          'p-6 rounded-lg border',
          theme === 'light'
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900/50 border-white/10'
        )}>
          <h2 className={cn(
            'text-lg font-semibold mb-4',
            theme === 'light' ? 'text-zinc-900' : 'text-white'
          )}>
            Reward History (live)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rewardHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e4e4e7' : '#27272a'} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#71717a' : '#a1a1aa'} />
              <YAxis tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#71717a' : '#a1a1aa'} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'light' ? '#fafafa' : '#18181b',
                  border: `1px solid ${theme === 'light' ? '#e4e4e7' : '#27272a'}`,
                  borderRadius: '8px'
                }}
                formatter={(value: any) => [`${Number(value).toFixed(6)} $BMT`, 'Rewards (tick)']}
              />
              <Bar dataKey="rewards" fill="#facc15" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Device Performance */}
        <div className={cn(
          'p-6 rounded-lg border',
          theme === 'light'
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900/50 border-white/10'
        )}>
          <h2 className={cn(
            'text-lg font-semibold mb-4',
            theme === 'light' ? 'text-zinc-900' : 'text-white'
          )}>
            Device Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={deviceStats}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e4e4e7' : '#27272a'} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#71717a' : '#a1a1aa'} />
              <YAxis tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#71717a' : '#a1a1aa'} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'light' ? '#fafafa' : '#18181b',
                  border: `1px solid ${theme === 'light' ? '#e4e4e7' : '#27272a'}`,
                  borderRadius: '8px'
                }}
              />
              <Line type="monotone" dataKey="hashrate" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Devices List */}
      <div className={cn(
        'p-6 rounded-lg border',
        theme === 'light'
          ? 'bg-white border-zinc-200'
          : 'bg-zinc-900/50 border-white/10'
      )}>
        <h2 className={cn(
          'text-lg font-semibold mb-4',
          theme === 'light' ? 'text-zinc-900' : 'text-white'
        )}>
          Connected Devices
        </h2>
        <div className="space-y-3">
          {miningStats?.devices && miningStats.devices.length > 0 ? (
            miningStats.devices.map((device) => (
              <div
                key={device.id}
                className={cn(
                  'p-4 rounded-lg border flex items-center justify-between',
                  theme === 'light'
                    ? 'bg-zinc-50 border-zinc-200'
                    : 'bg-white/5 border-white/10'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    device.isActive
                      ? theme === 'light'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-emerald-900/30 text-emerald-400'
                      : theme === 'light'
                        ? 'bg-zinc-100 text-zinc-500'
                        : 'bg-zinc-800 text-zinc-400'
                  )}>
                    {device.deviceType === 'cpu' ? (
                      <Cpu className="w-5 h-5" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className={cn(
                      'font-semibold',
                      theme === 'light' ? 'text-zinc-900' : 'text-white'
                    )}>
                      {device.name}
                    </p>
                    <p className={cn(
                      'text-xs',
                      theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'
                    )}>
                      {formatHashrate(device.totalHashrate)} • Last seen: {new Date(device.lastSeen).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'font-semibold',
                    device.isActive
                      ? 'text-emerald-600'
                      : theme === 'light'
                        ? 'text-zinc-500'
                        : 'text-zinc-400'
                  )}>
                    {device.isActive ? '🟢 Active' : '🔴 Offline'}
                  </p>
                  <p className={cn(
                    'text-xs',
                    theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'
                  )}>
                    {(Number.isFinite(device.totalRewards) ? device.totalRewards : 0).toFixed(4)} XMR
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className={cn(
              'p-4 rounded-lg text-center',
              theme === 'light'
                ? 'bg-zinc-50 text-zinc-600'
                : 'bg-white/5 text-zinc-400'
            )}>
              <p className="text-sm">No devices connected yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
