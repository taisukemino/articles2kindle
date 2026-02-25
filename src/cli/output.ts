import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Renders a formatted table to the console.
 *
 * @param headers - Column header labels
 * @param rows - Table row data as string arrays
 */
export function printTable(headers: string[], rows: string[][]): void {
  const table = new Table({
    head: headers.map((header) => chalk.bold(header)),
    style: { head: [], border: [] },
  });
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}

/**
 * Prints a green success message to stdout.
 *
 * @param message - The success message to display
 */
export function printSuccess(message: string): void {
  console.log(chalk.green('✓ ') + message);
}

/**
 * Prints a red error message to stderr.
 *
 * @param message - The error message to display
 */
export function printError(message: string): void {
  console.error(chalk.red('✗ ') + message);
}

/**
 * Prints a blue informational message to stdout.
 *
 * @param message - The informational message to display
 */
export function printInfo(message: string): void {
  console.log(chalk.blue('ℹ ') + message);
}

/**
 * Truncates text to the specified length, appending an ellipsis if needed.
 *
 * @param text - The string to truncate
 * @param maxLength - Maximum allowed character length
 * @returns The original or truncated string
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Formats an ISO date string into a human-readable short date.
 *
 * @param isoDate - ISO 8601 date string, or null
 * @returns Formatted date string (e.g., "Jan 1, 2025") or a dash for null
 */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats a byte count into a human-readable file size string.
 *
 * @param bytes - File size in bytes, or null
 * @returns Formatted size string (e.g., "1.5MB") or a dash for null
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
