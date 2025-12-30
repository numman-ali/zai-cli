/**
 * zai-cli - CLI for Z.AI capabilities
 */

import * as vision from './commands/vision.js';
import { search, SEARCH_HELP } from './commands/search.js';
import { read, READ_HELP } from './commands/read.js';
import { repoSearch, repoTree, repoRead, REPO_HELP } from './commands/repo.js';
import { listTools, showTool, callTool, TOOLS_HELP, CALL_HELP } from './commands/tools.js';
import { doctor, DOCTOR_HELP } from './commands/doctor.js';
import { runCodeFile, evalCode, printInterfaces, printPromptTemplate, CODE_HELP } from './commands/code.js';
import { outputError, setOutputMode } from './lib/output.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json') as { version: string };

const MAIN_HELP = `
zai-cli v${VERSION} - CLI for Z.AI MCP services

Usage: zai-cli <command> [args] [options]

Commands:
  vision   Image and video analysis (MCP)
  search   Real-time web search
  read     Fetch and parse web pages
  repo     GitHub repository exploration
  tools    List available MCP tools
  tool     Show a tool schema
  call     Call a tool directly
  doctor   Environment + connectivity checks
  code     Execute TypeScript tool chains (Code Mode)

Global Options:
  --output-format <data|json|pretty>  Output mode (default: data)

Help:
  zai-cli --help
  zai-cli vision --help
  zai-cli search --help
  zai-cli read --help
  zai-cli repo --help
  zai-cli tools --help
  zai-cli call --help
  zai-cli code --help
`.trim();

function parseArgs(args: string[]): { flags: Record<string, string | boolean>; positional: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);

      if (key.startsWith('no-')) {
        flags[key.slice(3)] = false;
        flags[key] = true;
        i++;
        continue;
      }

      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        flags[key] = nextArg;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        flags[key] = nextArg;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }

  return { flags, positional };
}

function extractGlobalOptions(args: string[]): {
  outputFormat?: string;
  rest: string[];
} {
  const rest: string[] = [];
  let outputFormat: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--output-format' || arg === '-O') {
      outputFormat = args[i + 1];
      i += 1;
      continue;
    }
    rest.push(arg);
  }

  return { outputFormat, rest };
}

function applyOutputMode(mode?: string): void {
  if (!mode) return;
  if (mode === 'data' || mode === 'json' || mode === 'pretty') {
    setOutputMode(mode);
    return;
  }
  outputError(`Invalid output format: ${mode}`, 'INVALID_ARGS', 'Use data, json, or pretty');
}

async function handleVision(args: string[]): Promise<void> {
  const { flags, positional } = parseArgs(args);

  if (flags.help || flags.h || positional.length === 0) {
    console.log(vision.VISION_HELP);
    return;
  }

  const command = positional[0];
  const source = positional[1];
  const prompt = positional[2];

  switch (command) {
    case 'analyze':
      if (!source) {
        outputError('Missing image source', 'INVALID_ARGS', 'Usage: zai-cli vision analyze <image> [prompt]');
      }
      await vision.analyze(source, prompt);
      break;

    case 'ui-to-code':
      if (!source) {
        outputError('Missing image source', 'INVALID_ARGS', 'Usage: zai-cli vision ui-to-code <image> [prompt]');
      }
      const outputType = (flags.output as string) || 'code';
      await vision.uiToCode(source, prompt, outputType as 'code' | 'prompt' | 'spec' | 'description');
      break;

    case 'extract-text':
      if (!source) {
        outputError('Missing image source', 'INVALID_ARGS', 'Usage: zai-cli vision extract-text <image> [prompt] [--language <lang>]');
      }
      await vision.extractText(source, prompt, flags.language as string);
      break;

    case 'diagnose-error':
      if (!source) {
        outputError('Missing image source', 'INVALID_ARGS', 'Usage: zai-cli vision diagnose-error <image> [prompt] [--context <ctx>]');
      }
      await vision.diagnoseError(source, prompt, flags.context as string);
      break;

    case 'diagram':
      if (!source) {
        outputError('Missing image source', 'INVALID_ARGS', 'Usage: zai-cli vision diagram <image> [prompt] [--type <type>]');
      }
      await vision.diagram(source, prompt, flags.type as string);
      break;

    case 'chart':
      if (!source) {
        outputError('Missing image source', 'INVALID_ARGS', 'Usage: zai-cli vision chart <image> [prompt] [--focus <focus>]');
      }
      await vision.chart(source, prompt, flags.focus as string);
      break;

    case 'diff':
      const actual = positional[2];
      const diffPrompt = positional[3];
      if (!source || !actual) {
        outputError('Missing image sources', 'INVALID_ARGS', 'Usage: zai-cli vision diff <expected> <actual> [prompt]');
      }
      await vision.diff(source, actual, diffPrompt);
      break;

    case 'video':
      if (!source) {
        outputError('Missing video source', 'INVALID_ARGS', 'Usage: zai-cli vision video <video> [prompt]');
      }
      await vision.video(source, prompt);
      break;

    default:
      outputError(`Unknown vision command: ${command}`, 'INVALID_ARGS', 'Run "zai-cli vision --help" for available commands');
  }
}

async function handleSearch(args: string[]): Promise<void> {
  const { flags, positional } = parseArgs(args);

  if (flags.help || flags.h || positional.length === 0) {
    console.log(SEARCH_HELP);
    return;
  }

  const query = positional.join(' ');

  await search(query, {
    count: flags.count ? parseInt(flags.count as string, 10) : undefined,
    domain: flags.domain as string,
    recency: flags.recency as 'oneDay' | 'oneWeek' | 'oneMonth' | 'oneYear' | 'noLimit',
    contentSize: flags['content-size'] as 'medium' | 'high',
    location: flags.location as 'cn' | 'us',
  });
}

async function handleRead(args: string[]): Promise<void> {
  const { flags, positional } = parseArgs(args);

  if (flags.help || flags.h || positional.length === 0) {
    console.log(READ_HELP);
    return;
  }

  const url = positional[0];

  await read(url, {
    format: flags.format as 'markdown' | 'text',
    noImages: flags['no-images'] === true,
    noCache: flags['no-cache'] === true,
    withLinks: flags['with-links'] === true,
    timeout: flags.timeout ? parseInt(flags.timeout as string, 10) : undefined,
    noGfm: flags['no-gfm'] === true,
    keepImgDataUrl: flags['keep-img-data-url'] === true,
    withImagesSummary: flags['with-images-summary'] === true,
  });
}

async function handleRepo(args: string[]): Promise<void> {
  const { flags, positional } = parseArgs(args);

  if (flags.help || flags.h || positional.length === 0) {
    console.log(REPO_HELP);
    return;
  }

  const command = positional[0];
  const repo = positional[1];

  switch (command) {
    case 'search':
      const query = positional.slice(2).join(' ');
      if (!repo || !query) {
        outputError('Missing repo or query', 'INVALID_ARGS', 'Usage: zai-cli repo search <owner/repo> <query>');
      }
      await repoSearch(repo, query, {
        language: flags.language as 'en' | 'zh',
      });
      break;

    case 'tree':
      if (!repo) {
        outputError('Missing repo', 'INVALID_ARGS', 'Usage: zai-cli repo tree <owner/repo>');
      }
      await repoTree(repo, {
        path: flags.path as string,
        depth: flags.depth ? parseInt(flags.depth as string, 10) : undefined,
      });
      break;

    case 'read':
      const path = positional[2];
      if (!repo || !path) {
        outputError('Missing repo or path', 'INVALID_ARGS', 'Usage: zai-cli repo read <owner/repo> <path>');
      }
      await repoRead(repo, path);
      break;

    default:
      outputError(`Unknown repo command: ${command}`, 'INVALID_ARGS', 'Run "zai-cli repo --help" for available commands');
  }
}

async function handleTools(args: string[]): Promise<void> {
  const { flags } = parseArgs(args);

  if (flags.help || flags.h) {
    console.log(TOOLS_HELP);
    return;
  }

  await listTools({
    filter: flags.filter as string,
    full: flags.full === true,
    typescript: flags.typescript === true || flags.ts === true,
    enableVision: flags.vision !== false,
  });
}

async function handleTool(args: string[]): Promise<void> {
  const { flags, positional } = parseArgs(args);

  if (flags.help || flags.h || positional.length === 0) {
    console.log(TOOLS_HELP);
    return;
  }

  await showTool(positional[0], { enableVision: flags.vision !== false });
}

async function handleCall(args: string[]): Promise<void> {
  const { flags, positional } = parseArgs(args);

  if (flags.help || flags.h || positional.length === 0) {
    console.log(CALL_HELP);
    return;
  }

  await callTool(positional[0], {
    json: flags.json as string,
    file: flags.file as string,
    stdin: flags.stdin === true,
    dryRun: flags['dry-run'] === true,
    enableVision: flags.vision !== false,
  });
}

async function handleDoctor(args: string[]): Promise<void> {
  const { flags } = parseArgs(args);

  if (flags.help || flags.h) {
    console.log(DOCTOR_HELP);
    return;
  }

  await doctor({
    noTools: flags['no-tools'] === true,
    enableVision: flags.vision !== false,
  });
}

async function handleCode(args: string[]): Promise<void> {
  const { flags, positional } = parseArgs(args);

  if (flags.help || flags.h || positional.length === 0) {
    console.log(CODE_HELP);
    return;
  }

  const command = positional[0];
  const timeout = flags.timeout ? parseInt(flags.timeout as string, 10) : undefined;
  const includeLogs = flags.logs === true;

  switch (command) {
    case 'run': {
      const filePath = positional[1];
      if (!filePath) {
        outputError('Missing code file', 'INVALID_ARGS', 'Usage: zai-cli code run <file>');
      }
      await runCodeFile(filePath, { timeout, includeLogs });
      break;
    }
    case 'eval': {
      const code = positional.slice(1).join(' ');
      if (!code) {
        outputError('Missing code string', 'INVALID_ARGS', 'Usage: zai-cli code eval <code>');
      }
      await evalCode(code, { timeout, includeLogs });
      break;
    }
    case 'interfaces':
      await printInterfaces();
      break;
    case 'prompt':
      printPromptTemplate();
      break;
    default:
      outputError(`Unknown code command: ${command}`, 'INVALID_ARGS', 'Run "zai-cli code --help" for available commands');
  }
}

export async function main(args: string[]): Promise<void> {
  const cleanArgs = args[0]?.includes('node') || args[0]?.includes('zai-cli')
    ? args.slice(2)
    : args;

  const { outputFormat, rest } = extractGlobalOptions(cleanArgs);
  applyOutputMode(outputFormat);

  if (rest.length === 0 || rest[0] === '--help' || rest[0] === '-h') {
    console.log(MAIN_HELP);
    return;
  }

  if (rest[0] === '--version' || rest[0] === '-v') {
    console.log(VERSION);
    return;
  }

  const command = rest[0];
  const commandArgs = rest.slice(1);

  switch (command) {
    case 'vision':
      await handleVision(commandArgs);
      break;
    case 'search':
      await handleSearch(commandArgs);
      break;
    case 'read':
      await handleRead(commandArgs);
      break;
    case 'repo':
      await handleRepo(commandArgs);
      break;
    case 'tools':
      await handleTools(commandArgs);
      break;
    case 'tool':
      await handleTool(commandArgs);
      break;
    case 'call':
      await handleCall(commandArgs);
      break;
    case 'doctor':
      await handleDoctor(commandArgs);
      break;
    case 'code':
      await handleCode(commandArgs);
      break;
    default:
      outputError(`Unknown command: ${command}`, 'INVALID_ARGS', 'Run "zai-cli --help" for available commands');
  }
}

main(process.argv)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      code: 'FATAL_ERROR',
    }, null, 2));
    process.exit(1);
  });
