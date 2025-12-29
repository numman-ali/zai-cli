/**
 * Vision commands using Z.AI Vision MCP server
 */

import { ZaiMcpClient } from '../lib/mcp-client.js';
import { resolveImageSource, resolveVideoSource } from '../lib/image.js';
import { outputSuccess } from '../lib/output.js';
import { formatErrorOutput } from '../lib/errors.js';
import { silenceConsole, restoreConsole } from '../lib/silence.js';

type OutputType = 'code' | 'prompt' | 'spec' | 'description';

const DEFAULT_PROMPTS = {
  analyze: 'Describe this image in detail.',
  uiToCode: 'Convert this UI to production-ready code.',
  extractText: 'Extract all text from this image.',
  diagnoseError: 'Diagnose this error and suggest fixes.',
  diagram: 'Explain this technical diagram.',
  chart: 'Analyze this data visualization.',
  diff: 'Compare these two UI screenshots and identify differences.',
  video: 'Analyze this video content.',
};

async function withClient<T>(fn: (client: ZaiMcpClient) => Promise<T>): Promise<T> {
  silenceConsole();
  const client = new ZaiMcpClient();
  try {
    const result = await fn(client);
    return result;
  } catch (error) {
    restoreConsole();
    throw error;
  } finally {
    await client.close().catch(() => {});
    restoreConsole();
  }
}

export async function analyze(
  imageSource: string,
  prompt: string = DEFAULT_PROMPTS.analyze
): Promise<void> {
  try {
    const image = resolveImageSource(imageSource);
    const result = await withClient((client) =>
      client.visionAnalyze({ imageSource: image, prompt })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

export async function uiToCode(
  imageSource: string,
  prompt: string = DEFAULT_PROMPTS.uiToCode,
  outputType: OutputType = 'code'
): Promise<void> {
  try {
    const image = resolveImageSource(imageSource);
    const result = await withClient((client) =>
      client.visionUiToArtifact({ imageSource: image, outputType, prompt })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

export async function extractText(
  imageSource: string,
  prompt: string = DEFAULT_PROMPTS.extractText,
  language?: string
): Promise<void> {
  try {
    const image = resolveImageSource(imageSource);
    const result = await withClient((client) =>
      client.visionExtractText({
        imageSource: image,
        prompt,
        programmingLanguage: language,
      })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

export async function diagnoseError(
  imageSource: string,
  prompt: string = DEFAULT_PROMPTS.diagnoseError,
  context?: string
): Promise<void> {
  try {
    const image = resolveImageSource(imageSource);
    const result = await withClient((client) =>
      client.visionDiagnoseError({ imageSource: image, prompt, context })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

export async function diagram(
  imageSource: string,
  prompt: string = DEFAULT_PROMPTS.diagram,
  diagramType?: string
): Promise<void> {
  try {
    const image = resolveImageSource(imageSource);
    const result = await withClient((client) =>
      client.visionDiagram({ imageSource: image, prompt, diagramType })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

export async function chart(
  imageSource: string,
  prompt: string = DEFAULT_PROMPTS.chart,
  focus?: string
): Promise<void> {
  try {
    const image = resolveImageSource(imageSource);
    const result = await withClient((client) =>
      client.visionChart({ imageSource: image, prompt, focus })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

export async function diff(
  expectedSource: string,
  actualSource: string,
  prompt: string = DEFAULT_PROMPTS.diff
): Promise<void> {
  try {
    const expectedImage = resolveImageSource(expectedSource);
    const actualImage = resolveImageSource(actualSource);
    const result = await withClient((client) =>
      client.visionDiff({
        expectedImageSource: expectedImage,
        actualImageSource: actualImage,
        prompt,
      })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

export async function video(
  videoSource: string,
  prompt: string = DEFAULT_PROMPTS.video
): Promise<void> {
  try {
    const videoPath = resolveVideoSource(videoSource);
    const result = await withClient((client) =>
      client.visionVideo({ videoSource: videoPath, prompt })
    );
    outputSuccess(result);
  } catch (error) {
    console.error(formatErrorOutput(error));
    process.exit(1);
  }
}

// Help text
export const VISION_HELP = `
Vision Commands - Analyze images and videos via Z.AI Vision MCP

Usage: zai-cli vision <command> <source> [prompt] [options]

Commands:
  analyze <image> [prompt]           General image analysis
  ui-to-code <image> [prompt]        Convert UI screenshot to code
  extract-text <image> [prompt]      OCR for code, terminals, documents
  diagnose-error <image> [prompt]    Analyze error screenshots
  diagram <image> [prompt]           Interpret technical diagrams
  chart <image> [prompt]             Analyze data visualizations
  diff <expected> <actual> [prompt]  Compare two UI screenshots
  video <video> [prompt]             Analyze video content

Options:
  --language <lang>  Programming language hint (extract-text)
  --context <ctx>    Error context (diagnose-error)
  --type <type>      Diagram type hint (diagram)
  --focus <focus>    Analysis focus (chart)
  --output <type>    Output type for ui-to-code: code, prompt, spec, description

Constraints:
  Images: ≤5MB, JPG/PNG/JPEG
  Videos: ≤8MB, MP4/MOV/M4V (URLs supported)

Examples:
  zai-cli vision analyze ./screenshot.png "What's in this image?"
  zai-cli vision ui-to-code ./design.png --output code
  zai-cli vision extract-text ./code.png --language python
  zai-cli vision diagnose-error ./error.png --context "during npm install"
  zai-cli vision diagram ./arch.png --type architecture
  zai-cli vision diff ./expected.png ./actual.png "Check alignment"
  zai-cli vision video ./demo.mp4 "Summarize the key steps"
`.trim();
