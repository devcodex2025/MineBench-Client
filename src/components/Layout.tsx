import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, Hammer, Settings, BarChart3, Terminal, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMinerStore } from '../store/useMinerStore';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { sessionRewards, status, pools } = useMinerStore();

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden font-sans selection:bg-emerald-500/30 pt-8">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-zinc-900/50 backdrop-blur-xl flex flex-col justify-between p-4 flex-shrink-0">
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
           <div className="flex items-center gap-3 px-2 mt-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                    <img src="/minebench-logo-yellow.png" alt="MineBench Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="font-bold text-lg tracking-tight">MineBench</h1>
                </div>
           </div>

           <nav className="space-y-1">
              <NavItem to="/" icon={BarChart3} label="Dashboard" />
              <NavItem to="/benchmark" icon={Activity} label="Benchmarks" />
              <NavItem to="/mining" icon={Hammer} label="Mining Mode" />
              <NavItem to="/logs" icon={Terminal} label="Node Logs" />
           </nav>

           <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="px-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Active Pools</div>
                {Object.entries(pools).map(([id, pool]) => (
                    <div key={id} className="p-3 bg-zinc-800/30 rounded-lg border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500 uppercase font-medium tracking-wider">{id} Node</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                                !pool.connected ? "bg-yellow-500/10 text-yellow-500 animate-pulse" :
                                !pool.isSynced ? "bg-yellow-500/10 text-yellow-500 animate-pulse" :
                                "bg-emerald-500/10 text-emerald-400"
                            )}>
                                {!pool.connected ? "Sync..." : !pool.isSynced ? "Sync" : "Ready"}
                            </span>
                        </div>
                        
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                                <span className="text-emerald-500/50">{pool.coin}</span>
                                <span>{pool.progress.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div 
                                    className={cn(
                                        "h-full transition-all duration-1000",
                                        pool.isSynced ? "bg-emerald-500" : "bg-yellow-500"
                                    )}
                                    style={{ width: `${Math.max(pool.progress, 2)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
           </div>
        </div>

        <div className="pt-4 space-y-3">
             {/* Mini Stats Card */}
            <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                <div className="text-xs text-zinc-500 mb-1 font-medium italic">Available Rewards</div>
                <div className="font-mono text-xl font-medium text-emerald-400 flex items-baseline gap-1">
                    {sessionRewards.toFixed(4)} <span className="text-[10px] text-emerald-500/70 uppercase tracking-widest">$BMT</span>
                </div>
            </div>

            <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
         {/* Background Glows */}
         <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

         <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur z-10">
            <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600')} />
                <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                    {status === 'running' ? 'System Active' : 'System Idle'}
                </span>
            </div>
            <div className="font-mono text-sm text-zinc-400">
                <span className="text-zinc-600 mr-2">NET_HASH:</span>
                0.00 H/s
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-6 z-10 custom-scrollbar">
            {children}
         </div>
      </main>
    </div>
  );
};

const NavItem = ({ to, icon: Icon, label }: { to: string, icon: LucideIcon, label: string }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group",
        isActive 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
            : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
    )}
  >
    <Icon size={18} className="opacity-70 group-hover:opacity-100" />
    <span className="text-sm font-medium">{label}</span>
  </NavLink>
);