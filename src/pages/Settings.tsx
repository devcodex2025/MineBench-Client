import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Info, Settings as SettingsIcon, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

const APP_VERSION = '0.4.1';
const LATEST_VERSION = '0.4.1';

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

      {/* Updates Section */}
      <div className={cardClass}>
        <div className="flex items-start gap-3 mb-4">
          <Download size={20} className={cn("mt-1 flex-shrink-0", theme === 'light' ? 'text-emerald-600' : 'text-emerald-400')} />
          <div className="flex-1">
            <h2 className={cn("text-lg font-semibold", theme === 'light' ? 'text-zinc-900' : 'text-white')}>Updates</h2>
            <p className={cn("mt-1", textClass)}>Check for the latest version and features</p>
          </div>
        </div>

        <div className="space-y-3 ml-8">
          {/* Update Status */}
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

          {/* Check Updates Button */}
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

          {/* Update Checked Message */}
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

          {/* Download Update Button */}
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
              className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                theme === 'dark' ? 'bg-emerald-500' : 'bg-zinc-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                theme === 'dark' ? 'ml-auto' : ''
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
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                autoStart ? 'ml-auto' : ''
              }`}></div>
            </button>
          </div>
        </div>
      </div>

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
            <p><span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'}>Platform Support:</span> Windows, macOS, Linux (with Wayland support)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
