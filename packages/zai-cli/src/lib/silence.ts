/**
 * Utility to suppress console output from noisy dependencies (UTCP SDK)
 */

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

let silenced = false;

/**
 * Suppress console.log and console.error output
 */
export function silenceConsole(): void {
  if (silenced) return;
  silenced = true;

  console.log = (...args: unknown[]) => {
    // Only suppress UTCP/MCP protocol logs
    const msg = String(args[0] || '');
    if (
      msg.includes('[McpCommunicationProtocol]') ||
      msg.includes('UTCP Client') ||
      msg.includes('Successfully registered manual') ||
      msg.includes('Calling tool') ||
      msg.includes('via protocol')
    ) {
      return;
    }
    originalConsoleLog.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    const msg = String(args[0] || '');
    if (
      msg.includes('[McpCommunicationProtocol') ||
      msg.includes('UTCP')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

/**
 * Restore original console methods
 */
export function restoreConsole(): void {
  if (!silenced) return;
  silenced = false;
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}

/**
 * Run a function with console silenced
 */
export async function withSilentConsole<T>(fn: () => Promise<T>): Promise<T> {
  silenceConsole();
  try {
    return await fn();
  } finally {
    restoreConsole();
  }
}
