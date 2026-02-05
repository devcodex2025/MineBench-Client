import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Info, Settings as SettingsIcon, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { useMinerStore } from '../store/useMinerStore';
import { useEnvironment } from '../hooks/useEnvironment';

// Version from build-time define
declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__ || '0.5.3';
const LATEST_VERSION = APP_VERSION;

export const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateChecked, setUpdateChecked] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartSupported, setAutoStartSupported] = useState(true);
  const [autoStartLoading, setAutoStartLoading] = useState(false);
  const autoStartDisabled = autoStartLoading || !autoStartSupported || !window?.electron?.invoke;

  const cardClass = cn(
    'rounded-lg p-6 space-y-4',
    theme === 'light'
      ? 'bg-white border border-zinc-200'
      : 'bg-zinc-900/50 backdrop-blur-xl border border-white/5'
  );

  const labelClass = cn(
    'text-xs font-bold uppercase tracking-widest',
    theme === 'light' ? 'text-zinc-600' : 'text-zinc-600'
  );

  const textClass = cn(
    'text-sm',
    theme === 'light' ? 'text-zinc-700' : 'text-zinc-400'
  );

  const subLabelClass = cn(
    'text-xs',
    theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'
  );

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    // Simulate checking for updates
    await new Promise(resolve => setTimeout(resolve, 1500));
    setUpdateAvailable(false);
    setUpdateChecked(true);
    setCheckingUpdates(false);
  };

  const handleDownloadUpdate = () => {
    // Open MineBench releases page
    window.open('https://minebench.app/releases', '_blank');
  };

  const refreshAutoStart = useCallback(async () => {
    if (!window.electron?.invoke) return;
    setAutoStartLoading(true);
    try {
      const res = await window.electron.invoke('get-auto-start');
      setAutoStart(!!res?.enabled);
      setAutoStartSupported(res?.supported !== false);
    } catch (err) {
      console.error('get-auto-start failed', err);
      setAutoStartSupported(false);
    } finally {
      setAutoStartLoading(false);
    }
  }, []);

  const toggleAutoStart = async () => {
    if (!window.electron?.invoke || autoStartLoading) return;
    const next = !autoStart;
    setAutoStart(next);
    setAutoStartLoading(true);
    try {
      const res = await window.electron.invoke('set-auto-start', next);
      if (res?.supported === false || res?.success === false) {
        setAutoStartSupported(false);
        setAutoStart(!next);
        return;
      }
      if (typeof res?.enabled === 'boolean') {
        setAutoStart(res.enabled);
      }
      setAutoStartSupported(true);
    } catch (err) {
      console.error('set-auto-start failed', err);
      setAutoStart(!next);
    } finally {
      setAutoStartLoading(false);
    }
  };

  useEffect(() => {
    refreshAutoStart();
  }, [refreshAutoStart]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={cn("text-3xl font-light", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Settings</h1>
      </div>

      {/* Version Information */}
      <div className={cardClass}>
        <div className="flex items-start gap-3">
          <Info size={20} className="text-yellow-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h2 className={cn("text-lg font-semibold", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Application Version</h2>
            <p className={cn("mt-1", textClass)}>Current version: <span className="text-yellow-400 font-mono font-bold">v{APP_VERSION}</span></p>
          </div>
        </div>
      </div>

      {/* Updates Section (temporarily disabled)
      <div className={cardClass}>
        <div className="flex items-start gap-3 mb-4">
          <Download size={20} className={cn("mt-1 flex-shrink-0", theme === 'light' ? 'text-emerald-600' : 'text-emerald-400')} />
          <div className="flex-1">
            <h2 className={cn("text-lg font-semibold", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Updates</h2>
            <p className={cn("mt-1", textClass)}>Check for the latest version and features</p>
          </div>
        </div>

        <div className="space-y-3 ml-8">
          <div className={cn("flex items-center justify-between p-3 rounded border",
            theme === 'light'
              ? 'bg-zinc-100 border-zinc-300'
              : 'bg-zinc-800/50 border-white/5'
          )}>
            <div>
              <p className={cn("text-sm font-medium", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Latest Version</p>
              <p className={cn("text-xs mt-1", theme === 'light' ? 'text-zinc-600' : 'text-zinc-400')}>v{LATEST_VERSION}</p>
            </div>
            <div className="text-right">
              {APP_VERSION === LATEST_VERSION ? (
                <span className={cn("text-xs font-medium", theme === 'light' ? 'text-emerald-600' : 'text-emerald-400')}>Up to Date</span>
              ) : (
                <span className="text-xs text-yellow-400 font-medium">Update Available</span>
              )}
            </div>
          </div>

          <button
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
            className={cn("w-full flex items-center justify-center gap-2 px-4 py-2 rounded border transition-colors text-sm font-medium cursor-pointer",
              theme === 'light'
                ? 'bg-zinc-200 hover:bg-zinc-300 disabled:bg-zinc-200 disabled:opacity-50 text-zinc-900 border-zinc-300'
                : 'bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:opacity-50 text-zinc-200 border-white/5'
            )}
          >
            <RefreshCw size={16} className={checkingUpdates ? 'animate-spin' : ''} />
            {checkingUpdates ? 'Checking...' : 'Check for Updates'}
          </button>

          {updateChecked && !checkingUpdates && (
            <div className={cn("flex items-center gap-2 p-3 rounded border text-sm",
              theme === 'light'
                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-600'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            )}>
              <CheckCircle size={16} />
              <span>You are using the latest version</span>
            </div>
          )}

          {updateAvailable && (
            <button
              onClick={handleDownloadUpdate}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2 rounded border transition-colors text-sm font-medium",
                theme === 'light'
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 border-emerald-400/50'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
              )}
            >
              <Download size={16} />
              Download Latest Version
            </button>
          )}

        </div>
      </div>
      */}

      {/* Other Settings */}
      <div className={cardClass}>
        <div className="flex items-start gap-3 mb-4">
          <SettingsIcon size={20} className="text-blue-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h2 className={cn("text-lg font-semibold", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Preferences</h2>
            <p className={cn("mt-1", textClass)}>Configure application settings</p>
          </div>
        </div>

        <div className="space-y-3 ml-8">
          {/* Theme Setting */}
          <div className={cn("flex items-center justify-between p-3 rounded border",
            theme === 'light'
              ? 'bg-white border-zinc-200'
              : 'bg-zinc-800/50 border-white/5'
          )}>
            <div>
              <p className={cn("text-sm font-medium", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Dark Mode</p>
              <p className={cn("text-xs mt-0.5", theme === 'light' ? 'text-zinc-600' : 'text-zinc-400')}>Enable dark theme</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${theme === 'dark' ? 'bg-emerald-500' : 'bg-zinc-600'
                }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${theme === 'dark' ? 'ml-auto' : ''
                }`}></div>
            </button>
          </div>

          {/* Auto Start Setting */}
          <div className={cn("flex items-center justify-between p-3 rounded border",
            theme === 'light'
              ? 'bg-white border-zinc-200'
              : 'bg-zinc-800/50 border-white/5'
          )}>
            <div>
              <p className={cn("text-sm font-medium", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Auto-Start on Boot</p>
              <p className={cn("text-xs mt-0.5", theme === 'light' ? 'text-zinc-600' : 'text-zinc-400')}>
                {autoStartSupported ? 'Launch MineBench automatically' : 'Auto-start not available on this OS'}
              </p>
            </div>
            <button
              onClick={toggleAutoStart}
              disabled={autoStartDisabled}
              className={cn(
                "w-12 h-6 rounded-full flex items-center px-1 transition-colors",
                autoStartDisabled ? 'opacity-50 cursor-not-allowed bg-zinc-400/50' : 'cursor-pointer',
                autoStart ? 'bg-emerald-500' : 'bg-zinc-600'
              )}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoStart ? 'ml-auto' : ''
                }`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Mining Configuration (disabled for now)
      <div className={cardClass}>
        <div className="flex items-start gap-3 mb-4">
          <SettingsIcon size={20} className="text-yellow-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h2 className={cn("text-lg font-semibold", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Mining Configuration</h2>
            <p className={cn("mt-1", textClass)}>Set your wallet and preferred pool</p>
          </div>
        </div>

        <MiningConfigForm theme={theme} />
      </div>
      */}

      {/* About Section */}
      <div className={cardClass}>
        <h2 className={cn("text-lg font-semibold", theme === 'light' ? 'text-zinc-900' : 'text-white')}>About MineBench</h2>

        <div className={cn("space-y-2 text-sm", theme === 'light' ? 'text-zinc-700' : 'text-zinc-400')}>
          <p>
            MineBench is a decentralized mining benchmark platform designed to provide accurate and real-time performance metrics for cryptocurrency mining operations.
          </p>

          <div className="pt-4 space-y-2 text-xs">
            <p><span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>License:</span> MIT</p>
            <p><span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Website:</span> <span className="text-blue-400">minebench.cloud</span></p>
            <p>
              <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Discord:</span>{' '}
              <a className="text-blue-400" href="https://discord.gg/vsDyYh4rma" target="_blank" rel="noreferrer">
                discord.gg/vsDyYh4rma
              </a>{' '}
              — тут можна долучитись до спільноти, отримати технічну консультацію і т.д
            </p>
            <p>
              <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Twitter/X:</span>{' '}
              <a className="text-blue-400" href="https://x.com/MineBenchdapp" target="_blank" rel="noreferrer">
                x.com/MineBenchdapp
              </a>{' '}
              — тут відображаються новини про додаток
            </p>
            <p><span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Platform Support:</span> Windows, macOS, Linux (with Wayland support)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Monero wallet validation: starts with 4 or 8 and ~95 characters
const validateXmrWallet = (addr: string) => {
  const trimmed = addr.trim();
  if (!trimmed) return { ok: false, reason: 'Wallet is required' };
  if (!(trimmed.startsWith('4') || trimmed.startsWith('8'))) return { ok: false, reason: 'Must start with 4 or 8' };
  if (trimmed.length < 90 || trimmed.length > 110) return { ok: false, reason: 'Unexpected length' };
  return { ok: true };
};

const MiningConfigForm: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const env = useEnvironment();
  const wallet = useMinerStore((s) => s.wallet);
  const poolUrl = useMinerStore((s) => s.poolUrl);
  const donateLevel = useMinerStore((s) => s.donateLevel);
  const setWallet = useMinerStore((s) => s.setWallet);
  const setPoolUrl = useMinerStore((s) => s.setPoolUrl);
  const setDonateLevel = useMinerStore((s) => s.setDonateLevel);
  const setManualPoolSelection = useMinerStore((s) => s.setManualPoolSelection);

  const [localWallet, setLocalWallet] = useState(wallet);
  const [localPool, setLocalPool] = useState(poolUrl);
  const [localDonate, setLocalDonate] = useState(donateLevel);
  const [saving, setSaving] = useState(false);
  const validation = useMemo(() => validateXmrWallet(localWallet), [localWallet]);

  // Local label style (fix: avoid referencing outer component variables)
  const labelClass = cn(
    'text-xs font-bold uppercase tracking-widest',
    theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'
  );

  const presetPools = [
    { name: 'MineBench Pool (Primary)', url: 'xmr.minebench.cloud:31651' },
    { name: 'MineBench Pool (Reserve)', url: 'xmr2.minebench.cloud:31915' },
    { name: 'SupportXMR', url: 'pool.supportxmr.com:3333' },
    { name: 'MoneroOcean', url: 'gulf.moneroocean.stream:10032' },
    { name: 'MineBench Cloud (Production)', url: env.poolStratumUrl },
  ];

  const save = async () => {
    if (!validation.ok) return;
    setSaving(true);
    try {
      setWallet(localWallet.trim());
      setPoolUrl(localPool.trim());
      setDonateLevel(Math.max(0, Math.min(5, Math.round(localDonate))));
      setManualPoolSelection(true); // Enable manual override
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 ml-8">
      {/* Wallet */}
      <div className={cn("p-3 rounded border", theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-800/50 border-white/5')}>
        <label className={labelClass}>Wallet Address (XMR)</label>
        <input
          value={localWallet}
          onChange={(e) => setLocalWallet(e.target.value)}
          placeholder="Enter your Monero wallet"
          className={cn(
            'mt-2 w-full px-3 py-2 rounded border text-sm outline-none',
            theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-900 border-white/10 text-white'
          )}
        />
        {!validation.ok && (
          <div className={cn('mt-2 text-xs', theme === 'light' ? 'text-red-600' : 'text-red-400')}>{validation.reason}</div>
        )}
      </div>

      {/* Pool Selection */}
      <div className={cn("p-3 rounded border", theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-800/50 border-white/5')}>
        <label className={labelClass}>Mining Pool</label>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {presetPools.map((p) => (
            <button
              key={p.url}
              onClick={() => setLocalPool(p.url)}
              className={cn(
                'px-3 py-2 rounded border text-sm text-left',
                localPool === p.url
                  ? theme === 'light' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : theme === 'light' ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-900 border-white/10 text-white'
              )}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs opacity-70">{p.url}</div>
            </button>
          ))}
        </div>
        <input
          value={localPool}
          onChange={(e) => setLocalPool(e.target.value)}
          placeholder="host:port (e.g., xmr.minebench.cloud:31651)"
          className={cn(
            'mt-2 w-full px-3 py-2 rounded border text-sm outline-none',
            theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-900 border-white/10 text-white'
          )}
        />
        <div className={cn('mt-2 text-xs', theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>Protocol will be set automatically to `stratum+tcp://`.</div>
      </div>

      {/* Donate Level */}
      {false && (
        <div className={cn("p-3 rounded border", theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-800/50 border-white/5')}>
          <label className={labelClass}>Donate Level</label>
          <input
            type="number"
            min={0}
            max={5}
            value={localDonate}
            onChange={(e) => setLocalDonate(Number(e.target.value))}
            className={cn(
              'mt-2 w-full px-3 py-2 rounded border text-sm outline-none',
              theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-900 border-white/10 text-white'
            )}
          />
          <div className={cn('mt-2 text-xs', theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>Xmrig default is 1%. Set 0 to disable.</div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !validation.ok}
          className={cn(
            'px-4 py-2 rounded border text-sm font-semibold',
            saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            theme === 'light' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-500 text-black border-emerald-500'
          )}
        >
          Save Configuration
        </button>
        <div className={cn('text-xs self-center', theme === 'light' ? 'text-zinc-600' : 'text-zinc-500')}>Changes apply on next start.</div>
      </div>
    </div>
  );
};
