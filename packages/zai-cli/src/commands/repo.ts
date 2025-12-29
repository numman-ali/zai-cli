/**
 * Repo commands for GitHub repository exploration (ZRead)
 */

import { ZReadMcpClient } from '../lib/mcp-client.js';
import { outputSuccess } from '../lib/output.js';
import { formatErrorOutput, ValidationError } from '../lib/errors.js';
import { silenceConsole, restoreConsole } from '../lib/silence.js';

function validateRepo(repo: string): void {
  if (!repo.includes('/')) {
    throw new ValidationError(
      `Invalid repository format: "${repo}". Use "owner/repo" format (e.g., "facebook/react")`
    );
  }
}

export async function repoSearch(
  repo: string,
  query: string
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
    const results = await client.searchDoc(repo, query);
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

export async function repoTree(repo: string): Promise<void> {
  try {
    validateRepo(repo);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }

  silenceConsole();
  const client = new ZReadMcpClient({ enableVision: false });
  try {
    const structure = await client.getRepoStructure(repo);
    outputSuccess(structure);
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

Examples:
  zai-cli repo search facebook/react "server components"
  zai-cli repo tree vercel/next.js
  zai-cli repo read anthropics/anthropic-sdk-python src/anthropic/client.py

Notes:
  - Repository must be public
  - Use "owner/repo" format (e.g., "facebook/react")
  - Paths are relative to repository root

Output format (search):
  Search results array

Output format (tree):
  Repository structure object

Output format (read):
  File contents
`.trim();
