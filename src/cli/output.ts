import Table from 'cli-table3';
import chalk from 'chalk';

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

export function printSuccess(message: string): void {
  console.log(chalk.green('✓ ') + message);
}

export function printError(message: string): void {
  console.error(chalk.red('✗ ') + message);
}

export function printInfo(message: string): void {
  console.log(chalk.blue('ℹ ') + message);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
