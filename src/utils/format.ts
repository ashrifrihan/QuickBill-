/** Display formatters. Pure and dependency-free so they are trivial to test. */

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

/** "Today", "Yesterday", or a date — for grouping bill history. */
export function formatRelativeDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return formatDate(iso);
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function todayRange(): { from: string; to: string } {
  const now = new Date();
  return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
}

export function lastNDaysRange(days: number): { from: string; to: string } {
  const now = new Date();
  const from = startOfDay(new Date(now.getTime() - (days - 1) * 86_400_000));
  return { from: from.toISOString(), to: endOfDay(now).toISOString() };
}

export function monthToDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() };
}

/** Percent for display: 0.15 → "15%". */
export function formatPercent(rate: number): string {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** Escapes text before it goes into the HTML receipt template. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Resolves a typed category name against the ones already in use.
 *
 * Returns the EXISTING spelling when the name matches case-insensitively, so
 * typing "drink" when "Drink" already exists reuses "Drink" instead of creating
 * a second category that filters separately. Returns null for blank input,
 * which the caller stores as "uncategorised".
 */
export function canonicaliseCategory(input: string, known: readonly string[]): string | null {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return null;

  const match = known.find((name) => name.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}
