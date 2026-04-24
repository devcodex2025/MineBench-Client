const MONERO_BLOCK_TIME_SECONDS = 120;
const MONERO_BLOCK_REWARD_XMR = 0.6;
const MINEBENCH_USER_SHARE = 0.8;
const SECONDS_PER_DAY = 24 * 60 * 60;

interface RewardEstimateInput {
  hashrate: number;
  seconds: number;
  networkHashrate: number;
  rateXmrBmt?: number;
  userShare?: number;
}

function toSafePositiveNumber(value: number | null | undefined) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : 0;
}

export function estimateXmrReward({
  hashrate,
  seconds,
  networkHashrate,
}: RewardEstimateInput) {
  const safeHashrate = toSafePositiveNumber(hashrate);
  const safeSeconds = toSafePositiveNumber(seconds);
  const safeNetworkHashrate = toSafePositiveNumber(networkHashrate);

  if (!safeHashrate || !safeSeconds || !safeNetworkHashrate) return 0;

  const shareOfNetwork = safeHashrate / safeNetworkHashrate;
  const estimatedBlocks = (safeSeconds / MONERO_BLOCK_TIME_SECONDS) * shareOfNetwork;
  return estimatedBlocks * MONERO_BLOCK_REWARD_XMR;
}

export function estimateBmtReward({
  hashrate,
  seconds,
  networkHashrate,
  rateXmrBmt = 0,
  userShare = MINEBENCH_USER_SHARE,
}: RewardEstimateInput) {
  const xmrReward = estimateXmrReward({ hashrate, seconds, networkHashrate });
  const safeRate = toSafePositiveNumber(rateXmrBmt);
  const safeUserShare = userShare > 0 ? userShare : MINEBENCH_USER_SHARE;

  if (!xmrReward || !safeRate) return 0;

  return xmrReward * safeRate * safeUserShare;
}

export function estimateDailyBmtReward({
  hashrate,
  networkHashrate,
  rateXmrBmt = 0,
  userShare = MINEBENCH_USER_SHARE,
}: Omit<RewardEstimateInput, "seconds">) {
  return estimateBmtReward({
    hashrate,
    seconds: SECONDS_PER_DAY,
    networkHashrate,
    rateXmrBmt,
    userShare,
  });
}

export function estimateDailyXmrReward({
  hashrate,
  networkHashrate,
}: Omit<RewardEstimateInput, "seconds" | "rateXmrBmt" | "userShare">) {
  return estimateXmrReward({
    hashrate,
    seconds: SECONDS_PER_DAY,
    networkHashrate,
  });
}
