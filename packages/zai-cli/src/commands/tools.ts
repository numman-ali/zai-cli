/**
 * Meta commands: tool discovery, schema inspection, and raw calls
 */

import * as fs from 'node:fs/promises';
import { ZaiMcpClient } from '../lib/mcp-client.js';
import { ZaiCodeModeClient } from '../lib/code-mode.js';
import { outputSuccess } from '../lib/output.js';
import { formatErrorOutput, ValidationError } from '../lib/errors.js';
import { silenceConsole, restoreConsole } from '../lib/silence.js';
import { redactTool } from '../lib/redact.js';

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

export interface ToolsOptions {
  filter?: string;
  full?: boolean;
  typescript?: boolean;
  enableVision?: boolean;
}

export async function listTools(options: ToolsOptions = {}): Promise<void> {
  if (options.typescript) {
    silenceConsole();
    const codeClient = new ZaiCodeModeClient();
    try {
      const interfaces = await codeClient.getAllInterfaces();
      outputSuccess(interfaces);
    } catch (error) {
      restoreConsole();
      console.error(formatErrorOutput(error));
      process.exit(1);
    } finally {
      await codeClient.close().catch(() => {});
      restoreConsole();
    }
    return;
  }

  silenceConsole();
  const client = new ZaiMcpClient({ enableVision: options.enableVision });
  try {
    const tools = await client.listTools();
    const filtered = options.filter
      ? tools.filter((tool) =>
          tool.name.toLowerCase().includes(options.filter!.toLowerCase())
        )
      : tools;

    if (options.full) {
      outputSuccess(filtered.map((tool) => redactTool(tool)));
      return;
    }

    outputSuccess(filtered.map((tool) => tool.name));
  } catch (error) {
    restoreConsole();
    console.error(formatErrorOutput(error));
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
    restoreConsole();
  }
}

export async function showTool(name: string, options: ToolsOptions = {}): Promise<void> {
  silenceConsole();
  const client = new ZaiMcpClient({ enableVision: options.enableVision });
  try {
    const tool = await client.getTool(name);
    if (!tool) {
      restoreConsole();
      throw new ValidationError(`Unknown tool: ${name}`);
    }
    outputSuccess(redactTool(tool));
  } catch (error) {
    restoreConsole();
    console.error(formatErrorOutput(error));
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
    restoreConsole();
  }
}

export interface CallToolOptions {
  json?: string;
  file?: string;
  stdin?: boolean;
  dryRun?: boolean;
  enableVision?: boolean;
}

async function parseToolArgs(options: CallToolOptions): Promise<Record<string, unknown>> {
  if (options.json) {
    const raw = options.json.trim();
    const value = raw.startsWith('@') ? await fs.readFile(raw.slice(1), 'utf8') : raw;
    return JSON.parse(value);
  }

  if (options.file) {
    const value = await fs.readFile(options.file, 'utf8');
    return JSON.parse(value);
  }

  if (options.stdin || !process.stdin.isTTY) {
    const value = await readStdin();
    if (value.trim().length === 0) {
      return {};
    }
    return JSON.parse(value);
  }

  return {};
}

export async function callTool(
  toolName: string,
  options: CallToolOptions = {}
): Promise<void> {
  let args: Record<string, unknown>;
  try {
    args = await parseToolArgs(options);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(formatErrorOutput(new ValidationError(`Invalid JSON: ${error.message}`)));
      process.exit(1);
    }
    throw error;
  }

  silenceConsole();
  const client = new ZaiMcpClient({ enableVision: options.enableVision });
  try {
    const resolved = await client.resolveToolName(toolName);

    if (options.dryRun) {
      outputSuccess({ tool: resolved, args });
      return;
    }

    const result = await client.callToolRaw(resolved, args);
    outputSuccess(result);
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
export const TOOLS_HELP = `
Tools - Discover MCP tools and schemas

Usage:
  zai-cli tools [options]
  zai-cli tool <name>

Options:
  --filter <text>   Filter tools by name
  --full            Return full tool schemas
  --typescript      Output TypeScript interfaces (Code Mode)
  --no-vision       Skip vision MCP server (faster startup)

Examples:
  zai-cli tools
  zai-cli tools --filter vision
  zai-cli tools --full
  zai-cli tools --typescript
  zai-cli tool zai.vision.analyze_image
`.trim();

export const CALL_HELP = `
Call - Invoke a tool by name with JSON arguments

Usage: zai-cli call <tool> [options]

Options:
  --json <json>     Inline JSON args (prefix with @file to load)
  --file <path>     Read JSON args from file
  --stdin           Read JSON args from stdin
  --dry-run         Print resolved tool name + args without calling
  --no-vision       Skip vision MCP server (faster startup)

Examples:
  zai-cli call zai.search.webSearchPrime --json '{"search_query":"LLM tools"}'
  zai-cli call zai.reader.webReader --file ./args.json
  echo '{"repo_name":"owner/repo"}' | zai-cli call zai.zread.get_repo_structure --stdin
`.trim();
