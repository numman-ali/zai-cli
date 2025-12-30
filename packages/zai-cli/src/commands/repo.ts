/**
 * Repo commands for GitHub repository exploration (ZRead)
 */

import { ZReadMcpClient } from '../lib/mcp-client.js';
import { outputSuccess } from '../lib/output.js';
import { formatErrorOutput, ValidationError } from '../lib/errors.js';
import { silenceConsole, restoreConsole } from '../lib/silence.js';
import path from 'node:path';

function validateRepo(repo: string): void {
  if (!repo.includes('/')) {
    throw new ValidationError(
      `Invalid repository format: "${repo}". Use "owner/repo" format (e.g., "facebook/react")`
    );
  }
}

export interface RepoSearchOptions {
  language?: 'en' | 'zh';
}

export interface RepoTreeOptions {
  path?: string;
  depth?: number;
}

interface TreeSnapshot {
  path: string;
  structure: string;
}

function extractStructureBlock(structure: string): string[] {
  const match = structure.match(/<structure>\n([\s\S]*?)\n<\/structure>/);
  const block = match ? match[1] : structure;
  return block.split('\n').map((line) => line.replace(/\r/g, '')).filter(Boolean);
}

function extractImmediateDirectories(structure: string, basePath: string): string[] {
  const lines = extractStructureBlock(structure);
  const directories: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([│\s]*)(├──|└──)\s(.+)$/);
    if (!match) continue;
    const prefix = match[1] || '';
    const name = (match[3] || '').trim();
    const normalizedPrefix = prefix.replace(/│/g, ' ');
    const level = Math.floor(normalizedPrefix.length / 4);

    if (level !== 0) continue;
    if (!name.endsWith('/')) continue;

    const dirName = name.slice(0, -1);
    const fullPath = basePath ? path.posix.join(basePath, dirName) : dirName;
    directories.push(fullPath);
  }

  return directories;
}

function normalizeDirPath(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/' || trimmed === '.') return undefined;
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
}

async function collectTreeSnapshots(
  client: ZReadMcpClient,
  repo: string,
  basePath: string | undefined,
  depth: number
): Promise<TreeSnapshot[]> {
  const snapshots: TreeSnapshot[] = [];
  const seen = new Set<string>();
  const queue: Array<{ path: string; level: number }> = [
    { path: basePath || '', level: 1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = current.path;
    if (seen.has(key)) continue;
    seen.add(key);

    const structure = await client.getRepoStructure(repo, current.path || undefined);
    snapshots.push({ path: current.path || '/', structure });

    if (current.level >= depth) continue;

    const children = extractImmediateDirectories(structure, current.path);
    for (const child of children) {
      queue.push({ path: child, level: current.level + 1 });
    }
  }

  return snapshots;
}

export async function repoSearch(
  repo: string,
  query: string,
  options: RepoSearchOptions = {}
): Promise<void> {
  try {
    validateRepo(repo);
    if (options.language && options.language !== 'en' && options.language !== 'zh') {
      throw new ValidationError('Language must be "en" or "zh"');
    }
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }

  silenceConsole();
  const client = new ZReadMcpClient({ enableVision: false });
  try {
    const language = options.language || 'en';
    const results = await client.searchDoc(repo, query, language);
    outputSuccess(results);
  } catch (error) {
    restoreConsole();
    console.error(formatErrorOutput(error));
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
    restoreConsole();
  }
}

export async function repoTree(
  repo: string,
  options: RepoTreeOptions = {}
): Promise<void> {
  try {
    validateRepo(repo);
    if (options.depth !== undefined) {
      const depthValue = Number(options.depth);
      if (!Number.isFinite(depthValue) || depthValue < 1) {
        throw new ValidationError('Depth must be a positive integer');
      }
    }
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }

  silenceConsole();
  const client = new ZReadMcpClient({ enableVision: false });
  try {
    const depth = Math.max(1, Math.floor(options.depth || 1));
    const dirPath = normalizeDirPath(options.path);
    if (depth === 1) {
      const structure = await client.getRepoStructure(repo, dirPath);
      outputSuccess(structure);
      return;
    }

    const snapshots = await collectTreeSnapshots(client, repo, dirPath, depth);
    outputSuccess({
      repo,
      depth,
      basePath: dirPath || '/',
      snapshots,
    });
  } catch (error) {
    restoreConsole();
    console.error(formatErrorOutput(error));
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
    restoreConsole();
  }
}

export async function repoRead(
  repo: string,
  path: string
): Promise<void> {
  try {
    validateRepo(repo);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }

  silenceConsole();
  const client = new ZReadMcpClient({ enableVision: false });
  try {
    const content = await client.readFile(repo, path);
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
export const REPO_HELP = `
Repo Commands - Explore GitHub repositories using ZRead

Usage: zai-cli repo <command> <owner/repo> [args]

Commands:
  search <owner/repo> <query>   Search docs and code in repository
  tree <owner/repo>             Get repository directory structure
  read <owner/repo> <path>      Read a file from repository

Search Options:
  --language <lang>   Result language: en (default) or zh

Tree Options:
  --path <path>       Directory path to inspect (default: repo root)
  --depth <n>         Expand subdirectory trees (default: 1)

Examples:
  zai-cli repo search facebook/react "server components"
  zai-cli repo search facebook/react "server components" --language en
  zai-cli repo tree vercel/next.js
  zai-cli repo tree vercel/next.js --path packages --depth 2
  zai-cli repo read anthropics/anthropic-sdk-python src/anthropic/client.py

Notes:
  - Repository must be public
  - Use "owner/repo" format (e.g., "facebook/react")
  - Paths are relative to repository root
  - Depth >1 returns structured snapshots (use --output-format pretty for readability)

Output format (search):
  Search results array

Output format (tree):
  Repository structure object

Output format (read):
  File contents
`.trim();
