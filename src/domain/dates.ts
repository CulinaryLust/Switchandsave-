// Datumsrechnung auf ISO-Strings (YYYY-MM-DD) in UTC, damit Zeitzonen keine Tage verschieben.

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Monatsaddition mit Kappung auf das Monatsende (31.01. + 1 Monat = 28./29.02.). */
export function addMonths(iso: string, months: number): string {
  const d = parseDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toIso(d);
}

export function diffDays(fromIso: string, toIsoDate: string): number {
  return Math.round((parseDate(toIsoDate).getTime() - parseDate(fromIso).getTime()) / 86_400_000);
}

export function maxDate(...isos: string[]): string {
  return isos.reduce((a, b) => (a > b ? a : b));
}

export function todayIso(): string {
  return toIso(new Date());
}

export function formatDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
