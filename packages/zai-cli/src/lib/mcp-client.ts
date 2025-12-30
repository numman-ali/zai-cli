/**
 * MCP (Model Context Protocol) client for Z.AI services using UTCP
 *
 * Supports four MCP servers:
 * - Vision: Image and video analysis (stdio)
 * - ZRead: GitHub repository exploration
 * - Web Search: Real-time web search
 * - Web Reader: Web page content extraction
 */

import { UtcpClient, type Tool } from '@utcp/sdk';
import '@utcp/mcp';
import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildMcpCallTemplate, getMcpToolName } from './mcp-config.js';
import { ApiError, AuthError, NetworkError, TimeoutError, ValidationError } from './errors.js';
import { loadConfig, getMcpEndpoints } from './config.js';
import { redactTool } from './redact.js';

const DEFAULT_TIMEOUT_MS = parseInt(process.env.Z_AI_TIMEOUT || '300000', 10);
const DEFAULT_RETRY_BASE_MS = parseInt(process.env.ZAI_MCP_RETRY_BASE_MS || '500', 10);
const DEFAULT_RETRY_MAX_MS = parseInt(process.env.ZAI_MCP_RETRY_MAX_MS || '8000', 10);
const DEFAULT_RETRY_JITTER_MS = parseInt(process.env.ZAI_MCP_RETRY_JITTER_MS || '250', 10);
const TOOL_CACHE_VERSION = 1;
const DEFAULT_TOOL_CACHE_TTL_MS = parseInt(process.env.ZAI_MCP_TOOL_CACHE_TTL_MS || '86400000', 10);
const TOOL_CACHE_ENABLED = !['0', 'false'].includes(
  (process.env.ZAI_MCP_TOOL_CACHE || '1').toLowerCase()
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveCacheDir(): string {
  const explicit = process.env.ZAI_MCP_CACHE_DIR || process.env.ZAI_CACHE_DIR;
  if (explicit) {
    return explicit;
  }
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) {
    return path.join(xdg, 'zai-cli');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'zai-cli');
  }
  return path.join(os.homedir(), '.cache', 'zai-cli');
}

// ZRead response types
export interface ZReadSearchResult {
  title: string;
  content: string;
  url?: string;
  type?: string;
}

// Web Search response types
export interface WebSearchResult {
  refer: string;
  title: string;
  link: string;
  media: string;
  content: string;
  icon: string;
  publish_date?: string;
}

/**
 * Unified MCP client for all Z.AI MCP services
 */
export class ZaiMcpClient {
  private client: UtcpClient | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;
  private options: { enableVision?: boolean };

  constructor(options: { enableVision?: boolean } = {}) {
    this.options = options;
  }

  /**
   * Initialize the UTCP client and register all MCP servers
   */
  private async init(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      this.client = await UtcpClient.create();
      const result = await this.client.registerManual(buildMcpCallTemplate(this.options));

      if (!result.success) {
        throw new ApiError(`Failed to register MCP servers: ${result.errors.join(', ')}`, 500);
      }

      this.isInitialized = true;
    } catch (error) {
      this.initPromise = null;

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403') || error.message.includes('auth')) {
          throw new AuthError(`Authentication failed: ${error.message}`);
        }
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
          throw new TimeoutError(DEFAULT_TIMEOUT_MS);
        }
        if (error.message.includes('ECONNREFUSED') || error.message.includes('network') || error.message.includes('fetch')) {
          throw new NetworkError(error.message);
        }
      }

      throw new ApiError(`MCP initialization failed: ${error instanceof Error ? error.message : String(error)}`, 500);
    }
  }

  /**
   * Call an MCP tool
   */
  private async callTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
    const maxRetries = this.getRetryCount(toolName);
    let attempt = 0;

    while (true) {
      await this.init();

      if (!this.client) {
        throw new ApiError('MCP client not initialized', 500);
      }

      try {
        const result = await this.client.callTool(toolName, args);

        // The result might be a string or already parsed object
        if (typeof result === 'string') {
          try {
            return JSON.parse(result) as T;
          } catch {
            return result as unknown as T;
          }
        }

        return result as T;
      } catch (error) {
        attempt += 1;

        if (attempt <= maxRetries && this.isRetriableError(error)) {
          await this.close().catch(() => {});
          const backoff = Math.min(
            DEFAULT_RETRY_MAX_MS,
            DEFAULT_RETRY_BASE_MS * Math.pow(2, attempt - 1)
          );
          const jitter = Math.floor(Math.random() * DEFAULT_RETRY_JITTER_MS);
          await sleep(backoff + jitter);
          continue;
        }

        if (error instanceof Error) {
          if (error.message.includes('401') || error.message.includes('403')) {
            throw new AuthError(`Authentication failed: ${error.message}`);
          }
          if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            throw new TimeoutError(DEFAULT_TIMEOUT_MS);
          }
          if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
            throw new NetworkError(error.message);
          }
          if (error.message.includes('-500') || error.message.includes('Unexpected system error')) {
            throw new ApiError(error.message, -500);
          }
        }

        throw new ApiError(`MCP tool call failed: ${error instanceof Error ? error.message : String(error)}`, 500);
      }
    }
  }

  private getRetryCount(toolName: string): number {
    const globalRetries = parseInt(process.env.ZAI_MCP_RETRY_COUNT || '0', 10);
    if (toolName.includes('.vision.')) {
      const visionRetriesRaw =
        process.env.ZAI_MCP_VISION_RETRY_COUNT || process.env.Z_AI_RETRY_COUNT;
      if (visionRetriesRaw !== undefined) {
        const parsed = parseInt(visionRetriesRaw, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 2;
    }
    return Number.isFinite(globalRetries) ? globalRetries : 0;
  }

  private isRetriableError(error: unknown): boolean {
    if (error instanceof AuthError || error instanceof ValidationError) {
      return false;
    }

    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (normalized.includes('401') || normalized.includes('403') || normalized.includes('auth')) {
      return false;
    }

    return (
      normalized.includes('timeout') ||
      normalized.includes('timed out') ||
      normalized.includes('etimedout') ||
      normalized.includes('econnrefused') ||
      normalized.includes('econnreset') ||
      normalized.includes('network') ||
      normalized.includes('fetch') ||
      normalized.includes('internal network failure') ||
      normalized.includes('unexpected system error') ||
      normalized.includes('http 500') ||
      normalized.includes('http 502') ||
      normalized.includes('http 503') ||
      normalized.includes('http 504') ||
      normalized.includes('rate limit') ||
      normalized.includes('429') ||
      normalized.includes('-500')
    );
  }

  private resolveEnableVision(): boolean {
    const envVision = !['0', 'false'].includes(
      (process.env.Z_AI_VISION_MCP || '').toLowerCase()
    );
    return this.options.enableVision ?? envVision;
  }

  private getToolCacheKey(): string {
    const config = loadConfig();
    const endpoints = getMcpEndpoints();
    const keyData = {
      mode: config.mode,
      baseUrl: config.baseUrl,
      endpoints,
      enableVision: this.resolveEnableVision(),
    };
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex').slice(0, 16);
  }

  private getToolCachePath(): string {
    const cacheDir = resolveCacheDir();
    const key = this.getToolCacheKey();
    return path.join(cacheDir, `tools-${key}.json`);
  }

  private async readToolsCache(refresh: boolean): Promise<Tool[] | null> {
    if (!TOOL_CACHE_ENABLED || refresh) {
      return null;
    }
    if (DEFAULT_TOOL_CACHE_TTL_MS <= 0) {
      return null;
    }
    try {
      const raw = await fs.readFile(this.getToolCachePath(), 'utf8');
      const data = JSON.parse(raw) as {
        version?: number;
        timestamp?: number;
        tools?: Tool[];
      };
      if (!data || data.version !== TOOL_CACHE_VERSION || !Array.isArray(data.tools)) {
        return null;
      }
      const age = Date.now() - (data.timestamp || 0);
      if (age > DEFAULT_TOOL_CACHE_TTL_MS) {
        return null;
      }
      return data.tools;
    } catch {
      return null;
    }
  }

  private async writeToolsCache(tools: Tool[]): Promise<void> {
    if (!TOOL_CACHE_ENABLED || DEFAULT_TOOL_CACHE_TTL_MS <= 0) {
      return;
    }
    try {
      const cacheDir = resolveCacheDir();
      await fs.mkdir(cacheDir, { recursive: true });
      const payload = {
        version: TOOL_CACHE_VERSION,
        timestamp: Date.now(),
        tools: tools.map((tool) => redactTool(tool)),
      };
      await fs.writeFile(this.getToolCachePath(), JSON.stringify(payload));
    } catch {
      // Best-effort cache only.
    }
  }

  /**
   * List all discovered tools from registered MCP servers
   */
  async listTools(refresh: boolean = false): Promise<Tool[]> {
    const cached = await this.readToolsCache(refresh);
    if (cached) {
      return cached;
    }

    await this.init();
    if (!this.client) {
      throw new ApiError('MCP client not initialized', 500);
    }
    const tools = await this.client.getTools();
    await this.writeToolsCache(tools);
    return tools;
  }

  /**
   * Find a tool by exact name or by suffix match
   */
  async getTool(toolName: string): Promise<Tool | undefined> {
    let tools = await this.listTools();
    let exact = tools.find((tool) => tool.name === toolName);
    if (exact) return exact;
    let suffix = tools.find((tool) => tool.name.endsWith(`.${toolName}`));
    if (suffix) return suffix;

    tools = await this.listTools(true);
    exact = tools.find((tool) => tool.name === toolName);
    if (exact) return exact;
    return tools.find((tool) => tool.name.endsWith(`.${toolName}`));
  }

  /**
   * Resolve a tool name, accepting full names or suffixes
   */
  async resolveToolName(toolName: string): Promise<string> {
    const tool = await this.getTool(toolName);
    if (!tool) {
      throw new ApiError(`Unknown tool: ${toolName}`, 400);
    }
    return tool.name;
  }

  /**
   * Call a tool by full name or suffix
   */
  async callToolRaw<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
    const resolved = await this.resolveToolName(toolName);
    return this.callTool<T>(resolved, args);
  }

  // ============ ZRead Methods ============

  /**
   * Search documentation and code in a GitHub repository
   */
  async zreadSearch(repo: string, query: string, language?: 'zh' | 'en'): Promise<string> {
    return this.callTool<string>(getMcpToolName('zread', 'search_doc'), {
      repo_name: repo,
      query,
      ...(language && { language }),
    });
  }

  /**
   * Get the directory structure of a GitHub repository
   */
  async zreadTree(repo: string, dirPath?: string): Promise<string> {
    return this.callTool<string>(getMcpToolName('zread', 'get_repo_structure'), {
      repo_name: repo,
      ...(dirPath && { dir_path: dirPath }),
    });
  }

  /**
   * Read a file from a GitHub repository
   */
  async zreadFile(repo: string, path: string): Promise<string> {
    return this.callTool<string>(getMcpToolName('zread', 'read_file'), { repo_name: repo, file_path: path });
  }

  // ============ Web Search Methods ============

  /**
   * Search the web using WebSearchPrime
   */
  async webSearch(params: {
    query: string;
    domainFilter?: string;
    recencyFilter?: 'oneDay' | 'oneWeek' | 'oneMonth' | 'oneYear' | 'noLimit';
    contentSize?: 'medium' | 'high';
    location?: 'cn' | 'us';
  }): Promise<WebSearchResult[]> {
    const args: Record<string, unknown> = {
      search_query: params.query,
    };

    if (params.domainFilter) {
      args.search_domain_filter = params.domainFilter;
    }
    if (params.recencyFilter) {
      args.search_recency_filter = params.recencyFilter;
    }
    if (params.contentSize) {
      args.content_size = params.contentSize;
    }
    if (params.location) {
      args.location = params.location;
    }

    return this.callTool<WebSearchResult[]>(getMcpToolName('search', 'webSearchPrime'), args);
  }

  // ============ Web Reader Methods ============

  /**
   * Read and parse web page content
   */
  async webRead(params: {
    url: string;
    timeout?: number;
    noCache?: boolean;
    format?: 'markdown' | 'text';
    retainImages?: boolean;
    withLinksSummary?: boolean;
    noGfm?: boolean;
    keepImgDataUrl?: boolean;
    withImagesSummary?: boolean;
  }): Promise<string> {
    const args: Record<string, unknown> = {
      url: params.url,
    };

    if (params.timeout !== undefined) {
      args.timeout = params.timeout;
    }
    if (params.noCache !== undefined) {
      args.no_cache = params.noCache;
    }
    if (params.format) {
      args.return_format = params.format;
    }
    if (params.retainImages !== undefined) {
      args.retain_images = params.retainImages;
    }
    if (params.withLinksSummary !== undefined) {
      args.with_links_summary = params.withLinksSummary;
    }
    if (params.noGfm !== undefined) {
      args.no_gfm = params.noGfm;
    }
    if (params.keepImgDataUrl !== undefined) {
      args.keep_img_data_url = params.keepImgDataUrl;
    }
    if (params.withImagesSummary !== undefined) {
      args.with_images_summary = params.withImagesSummary;
    }

    return this.callTool<string>(getMcpToolName('reader', 'webReader'), args);
  }

  // ============ Vision Methods ============

  async visionAnalyze(params: { imageSource: string; prompt: string }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'analyze_image'), {
      image_source: params.imageSource,
      prompt: params.prompt,
    });
  }

  async visionUiToArtifact(params: {
    imageSource: string;
    outputType: 'code' | 'prompt' | 'spec' | 'description';
    prompt: string;
  }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'ui_to_artifact'), {
      image_source: params.imageSource,
      output_type: params.outputType,
      prompt: params.prompt,
    });
  }

  async visionExtractText(params: {
    imageSource: string;
    prompt: string;
    programmingLanguage?: string;
  }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'extract_text_from_screenshot'), {
      image_source: params.imageSource,
      prompt: params.prompt,
      ...(params.programmingLanguage && { programming_language: params.programmingLanguage }),
    });
  }

  async visionDiagnoseError(params: {
    imageSource: string;
    prompt: string;
    context?: string;
  }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'diagnose_error_screenshot'), {
      image_source: params.imageSource,
      prompt: params.prompt,
      ...(params.context && { context: params.context }),
    });
  }

  async visionDiagram(params: {
    imageSource: string;
    prompt: string;
    diagramType?: string;
  }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'understand_technical_diagram'), {
      image_source: params.imageSource,
      prompt: params.prompt,
      ...(params.diagramType && { diagram_type: params.diagramType }),
    });
  }

  async visionChart(params: {
    imageSource: string;
    prompt: string;
    focus?: string;
  }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'analyze_data_visualization'), {
      image_source: params.imageSource,
      prompt: params.prompt,
      ...(params.focus && { analysis_focus: params.focus }),
    });
  }

  async visionDiff(params: {
    expectedImageSource: string;
    actualImageSource: string;
    prompt: string;
  }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'ui_diff_check'), {
      expected_image_source: params.expectedImageSource,
      actual_image_source: params.actualImageSource,
      prompt: params.prompt,
    });
  }

  async visionVideo(params: { videoSource: string; prompt: string }): Promise<string> {
    return this.callTool<string>(getMcpToolName('vision', 'analyze_video'), {
      video_source: params.videoSource,
      prompt: params.prompt,
    });
  }

  /**
   * Close the MCP client and cleanup resources
   */
  async close(timeoutMs: number = 2000): Promise<void> {
    if (this.client) {
      await Promise.race([
        this.client.close(),
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
      this.client = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

// Legacy exports for backward compatibility
export class ZReadMcpClient extends ZaiMcpClient {
  constructor(options: { enableVision?: boolean } = {}) {
    super(options);
  }

  async searchDoc(repo: string, query: string, language?: 'zh' | 'en') {
    return this.zreadSearch(repo, query, language);
  }

  async getRepoStructure(repo: string, dirPath?: string) {
    return this.zreadTree(repo, dirPath);
  }

  async readFile(repo: string, path: string) {
    return this.zreadFile(repo, path);
  }
}
