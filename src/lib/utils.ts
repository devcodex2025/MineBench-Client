import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHashrate(hr: number) {
  if (hr >= 1e9) return (hr / 1e9).toFixed(2) + ' GH/s';
  if (hr >= 1e6) return (hr / 1e6).toFixed(2) + ' MH/s';
  if (hr >= 1e3) return (hr / 1e3).toFixed(2) + ' KH/s';
  return hr.toFixed(2) + ' H/s';
}

export function calculateBmtReward(hashrate: number, seconds: number, difficulty: number = 240000000000) {
    // Conceptual mock formula based on Monero difficulty
    // This is a placeholder for the "Reward Formula" from PRD 14.4
    if (hashrate <= 0) return 0;
    
    // Abstract XMR estimation
    const estimatedXmrPerSecond = hashrate / difficulty * 0.6; 
    const totalXmr = estimatedXmrPerSecond * seconds;
    
    const userShare = totalXmr * 0.8; // 80% to user
    const bmtRate = 1000; // 1 XMR = 1000 BMT (Example Oracle)
    
    return userShare * bmtRate;
}