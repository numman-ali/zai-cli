/**
 * CLI integration tests for zai-cli
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '..', 'bin', 'zai-cli.js');

/**
 * Run the CLI with given arguments and return stdout/stderr
 */
function runCli(args, options = {}) {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, ...options.env },
      timeout: 10000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (err) => {
      resolve({ stdout, stderr, code: 1, error: err });
    });
  });
}

describe('CLI Help Commands', () => {
  it('should show main help with --help', async () => {
    const { stdout, code } = await runCli(['--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('zai-cli'));
    assert.ok(stdout.includes('vision'));
    assert.ok(stdout.includes('search'));
    assert.ok(stdout.includes('read'));
    assert.ok(stdout.includes('repo'));
    assert.ok(stdout.includes('tools'));
    assert.ok(stdout.includes('doctor'));
  });

  it('should show main help with -h', async () => {
    const { stdout, code } = await runCli(['-h'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('zai-cli'));
  });

  it('should show main help with no arguments', async () => {
    const { stdout, code } = await runCli([], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('Usage:'));
  });

  it('should show version with --version', async () => {
    const { stdout, code } = await runCli(['--version'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  it('should show vision help', async () => {
    const { stdout, code } = await runCli(['vision', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('analyze'));
    assert.ok(stdout.includes('ui-to-code'));
    assert.ok(stdout.includes('extract-text'));
    assert.ok(stdout.includes('diagnose-error'));
    assert.ok(stdout.includes('diagram'));
    assert.ok(stdout.includes('chart'));
    assert.ok(stdout.includes('diff'));
    assert.ok(stdout.includes('video'));
  });

  it('should show search help', async () => {
    const { stdout, code } = await runCli(['search', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('--count'));
    assert.ok(stdout.includes('--domain'));
    assert.ok(stdout.includes('--recency'));
  });

  it('should show read help', async () => {
    const { stdout, code } = await runCli(['read', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('--format'));
    assert.ok(stdout.includes('markdown'));
    assert.ok(stdout.includes('--with-images-summary'));
    assert.ok(stdout.includes('--no-gfm'));
    assert.ok(stdout.includes('--keep-img-data-url'));
  });

  it('should show repo help', async () => {
    const { stdout, code } = await runCli(['repo', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('search'));
    assert.ok(stdout.includes('tree'));
    assert.ok(stdout.includes('read'));
    assert.ok(stdout.includes('--language'));
    assert.ok(stdout.includes('--path'));
    assert.ok(stdout.includes('--depth'));
  });

  it('should show code help', async () => {
    const { stdout, code } = await runCli(['code', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('run'));
    assert.ok(stdout.includes('eval'));
  });

  it('should show doctor help', async () => {
    const { stdout, code } = await runCli(['doctor', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('doctor'));
  });
});

describe('CLI Error Handling', () => {
  it('should error on unknown command', async () => {
    const { stderr, code } = await runCli(['unknown'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 1);
    const error = JSON.parse(stderr);
    assert.strictEqual(error.success, false);
    assert.ok(error.error.includes('Unknown command'));
  });

  // Note: Testing missing API key is difficult in spawned processes
  // The config module calls process.exit(3) which can cause hangs
  // This behavior is tested manually during development

  it('should error on vision without source', async () => {
    const { stderr, code } = await runCli(['vision', 'analyze'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 1);
    const error = JSON.parse(stderr);
    assert.strictEqual(error.success, false);
    assert.ok(error.error.includes('Missing'));
  });

  it('should error on unknown vision command', async () => {
    const { stderr, code } = await runCli(['vision', 'unknown', 'file.png'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 1);
    const error = JSON.parse(stderr);
    assert.strictEqual(error.success, false);
    assert.ok(error.error.includes('Unknown vision command'));
  });

  it('should error on repo without repo name', async () => {
    const { stderr, code } = await runCli(['repo', 'tree'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 1);
    const error = JSON.parse(stderr);
    assert.strictEqual(error.success, false);
    assert.ok(error.error.includes('Missing'));
  });
});

describe('CLI Output Format', () => {
  it('should support --output-format json', async () => {
    const { stdout, code } = await runCli(['--output-format', 'json', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    // Help output is plain text, not JSON wrapped
    assert.ok(stdout.includes('zai-cli'));
  });

  it('should support --output-format pretty', async () => {
    const { stdout, code } = await runCli(['--output-format', 'pretty', '--help'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 0);
    assert.ok(stdout.includes('zai-cli'));
  });

  it('should reject invalid output format', async () => {
    const { stderr, code } = await runCli(['--output-format', 'invalid', 'doctor'], { env: { Z_AI_API_KEY: 'test' } });
    assert.strictEqual(code, 1);
    const error = JSON.parse(stderr);
    assert.strictEqual(error.success, false);
    assert.ok(error.error.includes('Invalid output format'));
  });
});
