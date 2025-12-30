/**
 * Doctor command for environment and MCP diagnostics
 */

import { ZaiMcpClient } from '../lib/mcp-client.js';
import { outputSuccess } from '../lib/output.js';
import { formatErrorOutput } from '../lib/errors.js';
import { silenceConsole, restoreConsole } from '../lib/silence.js';

export interface DoctorOptions {
  noTools?: boolean;
  enableVision?: boolean;
}

function getNodeMajor(): number {
  const [major] = process.versions.node.split('.');
  return parseInt(major, 10);
}

export async function doctor(options: DoctorOptions = {}): Promise<void> {
  const apiKey = process.env.Z_AI_API_KEY || process.env.ZAI_API_KEY;
  const mode = (process.env.Z_AI_MODE || process.env.PLATFORM_MODE || 'ZAI').toUpperCase();
  const nodeMajor = getNodeMajor();

  const report: Record<string, unknown> = {
    env: {
      apiKeyPresent: Boolean(apiKey),
      mode,
      baseUrl: process.env.Z_AI_BASE_URL || undefined,
    },
    node: {
      version: process.versions.node,
      visionMcpCompatible: nodeMajor >= 22,
    },
  };

  if (options.noTools || !apiKey) {
    outputSuccess(report);
    return;
  }

  silenceConsole();
  const client = new ZaiMcpClient({ enableVision: options.enableVision });
  try {
    const tools = await client.listTools();
    const byServer = tools.reduce<Record<string, number>>((acc, tool) => {
      const parts = tool.name.split('.');
      const server = parts.length >= 2 ? parts[1] : 'unknown';
      acc[server] = (acc[server] || 0) + 1;
      return acc;
    }, {});

    report.mcp = {
      toolCount: tools.length,
      servers: byServer,
    };

    outputSuccess(report);
  } catch (error) {
    restoreConsole();
    console.error(formatErrorOutput(error));
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
    restoreConsole();
  }
}

export const DOCTOR_HELP = `
Doctor - Check environment and MCP connectivity

Usage: zai-cli doctor [options]

Options:
  --no-tools   Skip tool discovery (env-only check)
  --no-vision  Skip vision MCP server (faster startup)

Examples:
  zai-cli doctor
  zai-cli doctor --no-tools
`.trim();
