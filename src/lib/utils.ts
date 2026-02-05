import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHashrate(hr: number) {
  const val = Number(hr);
  if (typeof val !== 'number' || isNaN(val)) return '0.00 H/s';

  if (val >= 1e9) return (val / 1e9).toFixed(2) + ' GH/s';
  if (val >= 1e6) return (val / 1e6).toFixed(2) + ' MH/s';
  if (val >= 1e3) return (val / 1e3).toFixed(2) + ' KH/s';
  return val.toFixed(2) + ' H/s';
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