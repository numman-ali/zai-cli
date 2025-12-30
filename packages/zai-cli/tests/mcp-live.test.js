/**
 * Live MCP integration tests (opt-in).
 *
 * Enable with:
 *   ZAI_LIVE_TESTS=1 Z_AI_API_KEY=... node --test tests/mcp-live.test.js
 *
 * Optional:
 *   ZAI_TEST_ENABLE_VISION=1  (requires Node >= 22 and vision MCP deps)
 *   ZAI_TEST_IMAGE_SOURCE=/path/to/image.png (override generated pixel image)
 *   ZAI_TEST_REPO=owner/repo
 *   ZAI_TEST_REPO_FILE=README.md
 *   ZAI_TEST_REPO_DIR=path/inside/repo
 *   ZAI_TEST_VIDEO_SOURCE=/path/to/video.mp4 (or URL)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ToolSchema } from '@utcp/sdk';
import { ZaiMcpClient } from '../dist/lib/mcp-client.js';
import { getMcpToolName } from '../dist/lib/mcp-config.js';

const apiKey = process.env.Z_AI_API_KEY || process.env.ZAI_API_KEY;
const runLive = process.env.ZAI_LIVE_TESTS === '1' && Boolean(apiKey);
const enableVision = process.env.ZAI_TEST_ENABLE_VISION === '1';
const nodeMajor = Number(process.versions.node.split('.')[0] || 0);

const describeLive = runLive ? describe : describe.skip;

describeLive('MCP Live Tests', () => {
  let client;
  let tools = [];
  let tempDir;
  let imagePath;

  before(async () => {
    client = new ZaiMcpClient({ enableVision });
    tools = await client.listTools();

    const providedImage = process.env.ZAI_TEST_IMAGE_SOURCE;
    if (providedImage) {
      await fs.access(providedImage);
      imagePath = providedImage;
    } else {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zai-cli-'));
      imagePath = path.join(tempDir, 'pixel.png');
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
      await fs.writeFile(imagePath, Buffer.from(pngBase64, 'base64'));
    }
  });

  after(async () => {
    if (client) {
      await client.close().catch(() => {});
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('discovers tools and validates tool schemas', () => {
    assert.ok(Array.isArray(tools) && tools.length > 0, 'expected tools to be discovered');
    for (const tool of tools) {
      ToolSchema.parse(tool);
      assert.ok(tool.name, 'tool has name');
      assert.ok(tool.inputs, 'tool has inputs');
      assert.ok(tool.outputs, 'tool has outputs');
    }
  });

  it('includes expected core tools', () => {
    const expected = [
      getMcpToolName('search', 'webSearchPrime'),
      getMcpToolName('reader', 'webReader'),
      getMcpToolName('zread', 'search_doc'),
      getMcpToolName('zread', 'get_repo_structure'),
      getMcpToolName('zread', 'read_file'),
    ];

    for (const name of expected) {
      assert.ok(
        tools.some((tool) => tool.name === name),
        `expected tool not found: ${name}`
      );
    }

    if (enableVision && nodeMajor >= 22) {
      const visionExpected = [
        getMcpToolName('vision', 'analyze_image'),
        getMcpToolName('vision', 'ui_to_artifact'),
        getMcpToolName('vision', 'extract_text_from_screenshot'),
        getMcpToolName('vision', 'diagnose_error_screenshot'),
        getMcpToolName('vision', 'understand_technical_diagram'),
        getMcpToolName('vision', 'analyze_data_visualization'),
        getMcpToolName('vision', 'ui_diff_check'),
        getMcpToolName('vision', 'analyze_video'),
      ];

      for (const name of visionExpected) {
        assert.ok(
          tools.some((tool) => tool.name === name),
          `expected vision tool not found: ${name}`
        );
      }
    }
  });

  it('calls every discovered tool (mapped coverage)', async () => {
    const repo = process.env.ZAI_TEST_REPO || 'numman-ali/zai-cli';
    const repoFile = process.env.ZAI_TEST_REPO_FILE || 'README.md';
    const repoDir = process.env.ZAI_TEST_REPO_DIR;
    const basePrompt = 'Test prompt';

    const handlers = new Map();

    handlers.set(getMcpToolName('search', 'webSearchPrime'), async () =>
      client.callToolRaw(getMcpToolName('search', 'webSearchPrime'), {
        search_query: 'hello world',
        search_recency_filter: 'oneMonth',
        content_size: 'medium',
        location: 'us',
      })
    );

    handlers.set(getMcpToolName('reader', 'webReader'), async () =>
      client.callToolRaw(getMcpToolName('reader', 'webReader'), {
        url: 'https://example.com',
        return_format: 'text',
        no_gfm: true,
        keep_img_data_url: false,
        with_images_summary: false,
        with_links_summary: true,
      })
    );

    handlers.set(getMcpToolName('zread', 'search_doc'), async () =>
      client.callToolRaw(getMcpToolName('zread', 'search_doc'), {
        repo_name: repo,
        query: 'config',
        language: 'en',
      })
    );

    handlers.set(getMcpToolName('zread', 'get_repo_structure'), async () => {
      const args = { repo_name: repo };
      if (repoDir) {
        args.dir_path = repoDir;
      }
      return client.callToolRaw(getMcpToolName('zread', 'get_repo_structure'), args);
    });

    handlers.set(getMcpToolName('zread', 'read_file'), async () =>
      client.callToolRaw(getMcpToolName('zread', 'read_file'), {
        repo_name: repo,
        file_path: repoFile,
      })
    );

    if (enableVision) {
      if (nodeMajor < 22) {
        throw new Error('Vision MCP requires Node >= 22');
      }

      handlers.set(getMcpToolName('vision', 'analyze_image'), async () =>
        client.callToolRaw(getMcpToolName('vision', 'analyze_image'), {
          image_source: imagePath,
          prompt: basePrompt,
        })
      );

      handlers.set(getMcpToolName('vision', 'ui_to_artifact'), async () =>
        client.callToolRaw(getMcpToolName('vision', 'ui_to_artifact'), {
          image_source: imagePath,
          prompt: basePrompt,
          output_type: 'code',
        })
      );

      handlers.set(getMcpToolName('vision', 'extract_text_from_screenshot'), async () =>
        client.callToolRaw(getMcpToolName('vision', 'extract_text_from_screenshot'), {
          image_source: imagePath,
          prompt: basePrompt,
          programming_language: 'python',
        })
      );

      handlers.set(getMcpToolName('vision', 'diagnose_error_screenshot'), async () =>
        client.callToolRaw(getMcpToolName('vision', 'diagnose_error_screenshot'), {
          image_source: imagePath,
          prompt: basePrompt,
          context: 'during npm install',
        })
      );

      handlers.set(getMcpToolName('vision', 'understand_technical_diagram'), async () =>
        client.callToolRaw(getMcpToolName('vision', 'understand_technical_diagram'), {
          image_source: imagePath,
          prompt: basePrompt,
          diagram_type: 'architecture',
        })
      );

      handlers.set(getMcpToolName('vision', 'analyze_data_visualization'), async () =>
        client.callToolRaw(getMcpToolName('vision', 'analyze_data_visualization'), {
          image_source: imagePath,
          prompt: basePrompt,
          analysis_focus: 'trend',
        })
      );

      handlers.set(getMcpToolName('vision', 'ui_diff_check'), async () =>
        client.callToolRaw(getMcpToolName('vision', 'ui_diff_check'), {
          expected_image_source: imagePath,
          actual_image_source: imagePath,
          prompt: basePrompt,
        })
      );

      const videoSource = process.env.ZAI_TEST_VIDEO_SOURCE;
      handlers.set(getMcpToolName('vision', 'analyze_video'), async () => {
        if (!videoSource) {
          return 'skipped: no video source';
        }
        return client.callToolRaw(getMcpToolName('vision', 'analyze_video'), {
          video_source: videoSource,
          prompt: basePrompt,
        });
      });
    }

    const missing = tools
      .map((tool) => tool.name)
      .filter((name) => !handlers.has(name));
    assert.strictEqual(
      missing.length,
      0,
      `Missing test handlers for tools: ${missing.join(', ')}`
    );

    for (const tool of tools) {
      const handler = handlers.get(tool.name);
      const result = await handler();
      assert.ok(result !== undefined, `tool returned undefined: ${tool.name}`);
    }
  });
});
