/**
 * Web search command using Z.AI WebSearchPrime MCP
 */

import { ZaiMcpClient } from '../lib/mcp-client.js';
import { outputSuccess } from '../lib/output.js';
import { formatErrorOutput } from '../lib/errors.js';
import { silenceConsole, restoreConsole } from '../lib/silence.js';

type RecencyFilter = 'oneDay' | 'oneWeek' | 'oneMonth' | 'oneYear' | 'noLimit';

export interface SearchOptions {
  count?: number;
  domain?: string;
  recency?: RecencyFilter;
  contentSize?: 'medium' | 'high';
  location?: 'cn' | 'us';
}

export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<void> {
  silenceConsole();
  const client = new ZaiMcpClient({ enableVision: false });
  try {
    const results = await client.webSearch({
      query,
      domainFilter: options.domain,
      recencyFilter: options.recency,
      contentSize: options.contentSize,
      location: options.location,
    });

    const formattedResults = results.map((r, i) => ({
      rank: i + 1,
      title: r.title,
      url: r.link,
      summary: r.content,
      source: r.media || undefined,
      ...(r.publish_date && { date: r.publish_date }),
    }));

    const limited = options.count ? formattedResults.slice(0, options.count) : formattedResults;
    outputSuccess(limited);
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
export const SEARCH_HELP = `
Search Command - Real-time web search using Z.AI WebSearchPrime MCP

Usage: zai-cli search <query> [options]

Options:
  --domain <d>      Limit to specific domain (e.g., github.com)
  --recency <r>     Filter by time: oneDay, oneWeek, oneMonth, oneYear, noLimit
  --content-size <s>  Content size: medium, high
  --location <l>      Location hint: cn, us
  --count <n>         Limit number of results

Examples:
  zai-cli search "React 19 new features"
  zai-cli search "TypeScript best practices"
  zai-cli search "Node.js security" --domain nodejs.org
  zai-cli search "AI news" --recency oneWeek

Output format:
  [
    {
      "rank": 1,
      "title": "Page title",
      "url": "https://...",
      "summary": "Page summary",
      "source": "example.com",
      "date": "2024-01-15"
    }
  ]
`.trim();
