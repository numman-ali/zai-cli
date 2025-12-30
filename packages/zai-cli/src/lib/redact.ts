/**
 * Redact sensitive values from tool metadata (for output + caching).
 */

import type { Tool } from '@utcp/sdk';

const REDACT_KEYS = new Set([
  'authorization',
  'Authorization',
  'api_key',
  'apiKey',
  'access_token',
  'token',
  'Z_AI_API_KEY',
  'ZAI_API_KEY',
]);

function redactString(value: string, apiKey?: string): string {
  let result = value;
  if (apiKey && result.includes(apiKey)) {
    result = result.replaceAll(apiKey, '[REDACTED]');
  }
  if (/^Bearer\s+\S+/.test(result)) {
    result = result.replace(/Bearer\s+\S+/, 'Bearer [REDACTED]');
  }
  return result;
}

export function redactSecrets(value: unknown, apiKey?: string): unknown {
  if (typeof value === 'string') {
    return redactString(value, apiKey);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, apiKey));
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      if (REDACT_KEYS.has(key)) {
        output[key] = '[REDACTED]';
        continue;
      }
      output[key] = redactSecrets(child, apiKey);
    }
    return output;
  }
  return value;
}

export function redactTool(tool: Tool): Tool {
  const apiKey = process.env.Z_AI_API_KEY || process.env.ZAI_API_KEY;
  const clone = JSON.parse(JSON.stringify(tool)) as Tool;
  return redactSecrets(clone, apiKey) as Tool;
}
