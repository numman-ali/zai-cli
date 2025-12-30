<p align="center">
  <img src="https://raw.githubusercontent.com/numman-ali/zai-cli/main/assets/zai-logo.svg" alt="Z.AI Logo" width="120" height="120">
</p>

<h1 align="center">ZAI CLI</h1>

<p align="center">
  MCP-native command line interface for Z.AI capabilities: vision analysis, web search, web reader, and GitHub repo exploration.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/zai-cli"><img src="https://img.shields.io/npm/v/zai-cli.svg" alt="npm version"></a>
  <a href="https://github.com/numman-ali/zai-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

> **Found this useful?** Follow [@nummanali](https://x.com/nummanali) for more AI tooling!

---

## Features

- **Vision** - Analyze images, screenshots, diagrams, charts, videos using GLM-4.6V
- **Search** - Real-time web search with domain and recency filtering
- **Reader** - Fetch and parse web pages to markdown
- **Repo** - Search and read GitHub repository code via ZRead
- **Tools** - MCP tool discovery, schemas, and raw calls
- **Code Mode** - TypeScript tool chaining for agent automation

## Quick Start

```bash
export Z_AI_API_KEY="your-api-key"

npx zai-cli --help
npx zai-cli vision analyze ./screenshot.png "What errors do you see?"
npx zai-cli search "React 19 new features" --count 5
```

Get your API key at: https://z.ai/manage-apikey/apikey-list

## Installation

### As an Agent Skill

**OpenSkills** (universal - works with any AI coding agent):

```bash
npx openskills install numman-ali/zai-cli
```

**Claude Code** (native skill marketplace):

```bash
claude skill install numman-ali/zai-cli --skill zai-cli
```

### As a CLI Tool

```bash
npm i -g zai-cli
zai-cli --help
```

Or use directly with npx:

```bash
npx zai-cli --help
```

## Usage

The CLI is self-documenting. Use `--help` at any level:

```bash
zai-cli --help              # All commands
zai-cli vision --help       # Vision commands
zai-cli search --help       # Search options
zai-cli repo --help         # GitHub repo commands
```

### Examples

```bash
# Vision - analyze images
zai-cli vision analyze ./image.png "Describe this"
zai-cli vision ui-to-code ./design.png --output code
zai-cli vision extract-text ./screenshot.png --language python
zai-cli vision diagnose-error ./error.png

# Search - web search
zai-cli search "TypeScript best practices" --count 10
zai-cli search "security news" --recency oneDay

# Reader - fetch web content
zai-cli read https://docs.example.com/api
zai-cli read https://blog.example.com --format text

# Repo - GitHub exploration
zai-cli repo tree facebook/react
zai-cli repo search vercel/next.js "app router"
zai-cli repo read anthropics/anthropic-sdk-python README.md
zai-cli repo search openai/codex "config" --language en
zai-cli repo tree openai/codex --path codex-rs --depth 2

# Doctor - check setup
zai-cli doctor
zai-cli doctor --no-vision
```

## Output Format

Default output is **data-only** for token efficiency. Use `--output-format json` for structured responses:

```json
{
  "success": true,
  "data": "...",
  "timestamp": 1234567890
}
```

## Notes

- `repo search` defaults to English results. Use `--language zh` for Chinese.
- `repo tree` supports `--path` (directory scope) and `--depth` (expand subtrees).
- `tools`, `tool`, `call`, `doctor` accept `--no-vision` to speed startup when vision tools are not needed.
- `read` supports `--with-images-summary`, `--no-gfm`, and `--keep-img-data-url` for richer parsing control.
- Vision tool calls automatically retry transient 5xx/network errors (default: 2 retries). Configure with `ZAI_MCP_VISION_RETRY_COUNT` (or `ZAI_MCP_RETRY_COUNT` for all tools).
- Tool discovery can be cached to speed `tools`/`tool`/`doctor` (default: on, 24h TTL). Configure with `ZAI_MCP_TOOL_CACHE`, `ZAI_MCP_TOOL_CACHE_TTL_MS`, `ZAI_MCP_CACHE_DIR`.

## Contributing

See [CONTRIBUTING.md](https://github.com/numman-ali/zai-cli/blob/main/CONTRIBUTING.md) for development setup and guidelines.

## Performance

Benchmark tool discovery (cache on/off):

```bash
node scripts/bench-tools.mjs
```

## License

MIT - see [LICENSE](https://github.com/numman-ali/zai-cli/blob/main/LICENSE).

## Links

- [GitHub Repository](https://github.com/numman-ali/zai-cli)
- [OpenSkills](https://github.com/numman-ali/openskills)
