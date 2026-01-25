import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Circle, Trash2, Download } from 'lucide-react';
import { useMinerStore } from '../store/useMinerStore';

interface LogEntry {
  time: string;
  message: string;
  type: 'miner' | 'node' | 'system';
}

export const Logs: React.FC = () => {
  const { logs: storeLogs, pools } = useMinerStore();
  const [minerLogs, setMinerLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'miner' | 'node' | 'system'>('all');
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMinerLog = (_: any, data: string) => {
      setMinerLogs(prev => [...prev.slice(-200), data.trim()].filter(Boolean));
    };

    if (window.electron) {
      window.electron.onMinerLog(handleMinerLog);
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [minerLogs, storeLogs, autoScroll]);

  const clearLogs = () => {
    setMinerLogs([]);
  };

  const downloadLogs = () => {
    const allLogs = [
      '=== SYSTEM LOGS ===',
      ...storeLogs,
      '',
      '=== MINER LOGS ===',
      ...minerLogs
    ].join('\n');

    const blob = new Blob([allLogs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minebench-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getNodeStatus = () => {
    const cpuPool = pools['cpu'];
    if (!cpuPool) return { status: 'disconnected', text: 'Not Connected' };
    
    if (!cpuPool.connected) return { status: 'syncing', text: 'Connecting...' };
    if (!cpuPool.isSynced) return { status: 'syncing', text: `Syncing ${cpuPool.progress.toFixed(1)}%` };
    return { status: 'ready', text: 'Synced' };
  };

  const nodeStatus = getNodeStatus();
  const combinedLogs = [
    ...storeLogs.map(log => ({ type: 'system' as const, message: log })),
    ...minerLogs.map(log => ({ type: 'miner' as const, message: log }))
  ];

  const filteredLogs = filter === 'all' 
    ? combinedLogs 
    : combinedLogs.filter(log => log.type === filter);

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Terminal className="w-7 h-7 text-emerald-500" />
            Node Logs
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Real-time system and miner output</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={downloadLogs}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Node Status */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">XMR Node</div>
            <Circle 
              className={`w-3 h-3 ${
                nodeStatus.status === 'ready' ? 'fill-emerald-500 text-emerald-500' :
                nodeStatus.status === 'syncing' ? 'fill-yellow-500 text-yellow-500 animate-pulse' :
                'fill-zinc-600 text-zinc-600'
              }`}
            />
          </div>
          <div className="mt-2 text-sm font-medium">{nodeStatus.text}</div>
          {pools['cpu']?.height > 0 && (
            <div className="mt-1 text-xs text-zinc-500 font-mono">
              Block {pools['cpu'].height.toLocaleString()} / {pools['cpu'].targetHeight.toLocaleString()}
            </div>
          )}
        </div>

        {/* Miner Status */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Miner</div>
            <Circle 
              className={`w-3 h-3 ${
                minerLogs.length > 0 && minerLogs[minerLogs.length - 1].includes('accepted') 
                  ? 'fill-emerald-500 text-emerald-500' 
                  : minerLogs.length > 0 
                    ? 'fill-blue-500 text-blue-500' 
                    : 'fill-zinc-600 text-zinc-600'
              }`}
            />
          </div>
          <div className="mt-2 text-sm font-medium">
            {minerLogs.length > 0 ? 'Active' : 'Idle'}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {minerLogs.length} log entries
          </div>
        </div>

        {/* System Logs */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">System</div>
            <Circle className="w-3 h-3 fill-zinc-500 text-zinc-500" />
          </div>
          <div className="mt-2 text-sm font-medium">Monitoring</div>
          <div className="mt-1 text-xs text-zinc-500">
            {storeLogs.length} system events
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5">
        {(['all', 'miner', 'system'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors relative ${
              filter === tab
                ? 'text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
            {filter === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </button>
        ))}
        
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Logs Display */}
      <div
        ref={logContainerRef}
        className="flex-1 bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-xs overflow-y-auto space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-zinc-600 py-8">
            <Terminal className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No logs yet. Start mining to see output.</p>
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div
              key={idx}
              className={`py-1 px-2 rounded hover:bg-white/5 transition-colors ${
                log.type === 'miner' ? 'text-blue-400' :
                log.type === 'system' ? 'text-emerald-400' :
                'text-zinc-400'
              }`}
            >
              <span className="text-zinc-600 mr-2">[{log.type.toUpperCase()}]</span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
