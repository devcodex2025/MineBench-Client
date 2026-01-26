import React, { useState } from 'react';
import { Download, RefreshCw, Info, Settings as SettingsIcon, CheckCircle } from 'lucide-react';

const APP_VERSION = '0.3.0';
const LATEST_VERSION = '0.3.0';

export const Settings = () => {
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateChecked, setUpdateChecked] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [autoStart, setAutoStart] = useState(false);

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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleAutoStart = () => {
    setAutoStart(!autoStart);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light text-white">Settings</h1>
      </div>

      {/* Version Information */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-yellow-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Application Version</h2>
            <p className="text-sm text-zinc-400 mt-1">Current version: <span className="text-yellow-400 font-mono font-bold">v{APP_VERSION}</span></p>
          </div>
        </div>
      </div>

      {/* Updates Section */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-3 mb-4">
          <Download size={20} className="text-emerald-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Updates</h2>
            <p className="text-sm text-zinc-400 mt-1">Check for the latest version and features</p>
          </div>
        </div>

        <div className="space-y-3 ml-8">
          {/* Update Status */}
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded border border-white/5">
            <div>
              <p className="text-sm font-medium text-white">Latest Version</p>
              <p className="text-xs text-zinc-400 mt-1">v{LATEST_VERSION}</p>
            </div>
            <div className="text-right">
              {APP_VERSION === LATEST_VERSION ? (
                <span className="text-xs text-emerald-400 font-medium">Up to Date</span>
              ) : (
                <span className="text-xs text-yellow-400 font-medium">Update Available</span>
              )}
            </div>
          </div>

          {/* Check Updates Button */}
          <button
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:opacity-50 text-zinc-200 rounded border border-white/5 transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} className={checkingUpdates ? 'animate-spin' : ''} />
            {checkingUpdates ? 'Checking...' : 'Check for Updates'}
          </button>

          {/* Update Checked Message */}
          {updateChecked && !checkingUpdates && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded border border-emerald-500/30 text-emerald-400 text-sm">
              <CheckCircle size={16} />
              <span>You are using the latest version</span>
            </div>
          )}

          {/* Download Update Button */}
          {updateAvailable && (
            <button
              onClick={handleDownloadUpdate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded border border-emerald-500/30 transition-colors text-sm font-medium"
            >
              <Download size={16} />
              Download Latest Version
            </button>
          )}

          <a
            href="https://minebench.app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/30 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Visit MineBench Website
          </a>
        </div>
      </div>

      {/* Other Settings */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-3 mb-4">
          <SettingsIcon size={20} className="text-blue-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Preferences</h2>
            <p className="text-sm text-zinc-400 mt-1">Configure application settings</p>
          </div>
        </div>

        <div className="space-y-3 ml-8">
          {/* Theme Setting */}
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded border border-white/5">
            <div>
              <p className="text-sm font-medium text-white">Dark Mode</p>
              <p className="text-xs text-zinc-400 mt-0.5">Enable dark theme</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                darkMode ? 'bg-emerald-500' : 'bg-zinc-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                darkMode ? 'ml-auto' : ''
              }`}></div>
            </button>
          </div>

          {/* Auto Start Setting */}
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded border border-white/5">
            <div>
              <p className="text-sm font-medium text-white">Auto-Start on Boot</p>
              <p className="text-xs text-zinc-400 mt-0.5">Launch application at startup</p>
            </div>
            <button
              onClick={toggleAutoStart}
              className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                autoStart ? 'bg-emerald-500' : 'bg-zinc-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                autoStart ? 'ml-auto' : ''
              }`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">About MineBench</h2>
        
        <div className="space-y-2 text-sm text-zinc-400">
          <p>
            MineBench is a decentralized mining benchmark platform designed to provide accurate and real-time performance metrics for cryptocurrency mining operations.
          </p>
          
          <div className="pt-4 space-y-2 text-xs">
            <p><span className="text-zinc-500">License:</span> MIT</p>
            <p><span className="text-zinc-500">Website:</span> <a href="https://minebench.app" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">minebench.app</a></p>
            <p><span className="text-zinc-500">Built with:</span> Electron, React, TypeScript, Three.js</p>
            <p><span className="text-zinc-500">Platform Support:</span> Windows, macOS, Linux (with Wayland support)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
