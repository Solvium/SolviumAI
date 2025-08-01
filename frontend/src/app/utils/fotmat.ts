// import { BigNumber } from "bignumber.js";

import { Address } from "@ton/core";

/**
 * Format TON amount with proper decimal places
 */
// export function formatTon(
//   amount: string | number | BigNumber,
//   decimals: number = 2
// ): string {
//   try {
//     const bn = new BigNumber(amount);
//     const formatted = bn.div(1e9).toFixed(decimals);
//     return `${formatted}`;
//   } catch (error) {
//     console.error("Error formatting TON amount:", error);
//     return "0.00";
//   }
// }

/**
 * Format nano TON to regular TON
 */
// export function fromNano(amount: string | number | BigNumber): string {
//   try {
//     const bn = new BigNumber(amount);
//     return bn.div(1e9).toString();
//   } catch (error) {
//     console.error("Error converting from nano:", error);
//     return "0";
//   }
// }

/**
 * Convert TON to nano TON
 */
// export function toNano(amount: string | number | BigNumber): string {
//   try {
//     const bn = new BigNumber(amount);
//     return bn.times(1e9).toString();
//   } catch (error) {
//     console.error("Error converting to nano:", error);
//     return "0";
//   }
// }

/**
 * Format date to local string
 */
export function formatDate(timestamp: number): string {
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  try {
    const now = Date.now();
    const diff = now - timestamp * 1000;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days !== 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    return "Just now";
  } catch (error) {
    console.error("Error formatting relative time:", error);
    return "Unknown time";
  }
}

/**
 * Format time remaining (e.g., for countdown)
 */
export function formatTimeRemaining(endTimestamp: number): string {
  try {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTimestamp - now;

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (24 * 60 * 60));
    const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((diff % (60 * 60)) / 60);

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  } catch (error) {
    console.error("Error formatting time remaining:", error);
    return "Unknown time";
  }
}

/**
 * Format wallet address with ellipsis
 */
export function formatAddress(
  address: Address | string,
  length: number = 4
): string {
  try {
    const addr = address.toString();
    if (addr.length <= length * 2) return addr;
    return `${addr.slice(0, length)}...${addr.slice(-length)}`;
  } catch (error) {
    console.error("Error formatting address:", error);
    return "Invalid address";
  }
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number | string): string {
  try {
    return new Intl.NumberFormat().format(Number(num));
  } catch (error) {
    console.error("Error formatting number:", error);
    return "0";
  }
}

/**
 * Format percentage
 */
export function formatPercent(
  value: number | string,
  decimals: number = 2
): string {
  try {
    return `${Number(value).toFixed(decimals)}%`;
  } catch (error) {
    console.error("Error formatting percentage:", error);
    return "0%";
  }
}

/**
 * Format multiplier
 */
export function formatMultiplier(value: number | string): string {
  try {
    return `${Number(value).toFixed(1)}x`;
  } catch (error) {
    console.error("Error formatting multiplier:", error);
    return "0x";
  }
}

/**
 * Validate TON amount
 */
export function isValidTonAmount(amount: string | number): boolean {
  try {
    const num = Number(amount);
    return !isNaN(num) && num > 0 && num >= 0.01;
  } catch {
    return false;
  }
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  try {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) return `${days} day${days !== 1 ? "s" : ""}`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  } catch (error) {
    console.error("Error formatting duration:", error);
    return "Invalid duration";
  }
}
