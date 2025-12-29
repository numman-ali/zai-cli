/**
 * Web reader command using Z.AI WebReader MCP
 */

import { ZaiMcpClient } from '../lib/mcp-client.js';
import { outputSuccess } from '../lib/output.js';
import { formatErrorOutput, ValidationError } from '../lib/errors.js';
import { silenceConsole, restoreConsole } from '../lib/silence.js';

export interface ReadOptions {
  format?: 'markdown' | 'text';
  noImages?: boolean;
  withLinks?: boolean;
  timeout?: number;
  noCache?: boolean;
}

export async function read(
  url: string,
  options: ReadOptions = {}
): Promise<void> {
  // Validate URL first (before silencing)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error(formatErrorOutput(new ValidationError('URL must start with http:// or https://')));
    process.exit(1);
  }

  silenceConsole();
  const client = new ZaiMcpClient({ enableVision: false });
  try {
    const content = await client.webRead({
      url,
      format: options.format || 'markdown',
      retainImages: !options.noImages,
      withLinksSummary: options.withLinks,
      timeout: options.timeout,
      noCache: options.noCache,
    });

    outputSuccess(content);
  } catch (error) {
    restoreConsole();
    console.error(formatErrorOutput(error));
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
    restoreConsole();
  }
}

// Help text
export const READ_HELP = `
Read Command - Fetch and parse web page content using Z.AI WebReader MCP

Usage: zai-cli read <url> [options]

Options:
  --format <f>    Output format: markdown (default), text
  --no-images     Remove images from output
  --no-cache      Disable server-side caching
  --with-links    Include links summary
  --timeout <s>   Request timeout in seconds (default: 20)

Examples:
  zai-cli read https://docs.example.com/api
  zai-cli read https://github.com/owner/repo --format text
  zai-cli read https://blog.example.com/post --no-images --with-links

Output format:
  Parsed page content (string or structured object)
`.trim();
