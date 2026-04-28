import type { PostedWithin } from "@/types/jobs";

export function ageInDays(isoDate: string, now?: number): number {
  const diff = (now ?? Date.now()) - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function postedWithinDays(filter: PostedWithin): number {
  switch (filter) {
    case "1d":
      return 1;
    case "1w":
      return 7;
    case "1m":
      return 30;
    case "3m":
      return 90;
    default:
      return 30;
  }
}

export function formatRelativePosted(isoDate: string): string {
  const days = ageInDays(isoDate);
  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  if (days < 30) {
    return `${days} days ago`;
  }

  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
