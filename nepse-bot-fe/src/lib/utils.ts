import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("en-NP").format(n);
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null) return "-";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(1) + "Cr";
  if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + "L";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}

export function percentColor(v: number): string {
  if (v > 0) return "text-green-600";
  if (v < 0) return "text-red-600";
  return "text-gray-500";
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
