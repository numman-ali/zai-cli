# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-12-30

### Added
- Repo search language flag (defaults to English) and repo tree path/depth expansion.
- Web reader flags for images summary, GFM control, and data URL preservation.
- MCP tool discovery cache with 24h default TTL plus configurable cache directory.
- Automatic retry/backoff for transient MCP failures (vision defaults to 2 retries).
- `--no-vision` to skip vision MCP startup for faster non-vision commands.
- Live MCP coverage tests and a tools benchmark script.
- Advanced skill reference for raw tool usage and performance tuning.

### Changed
- CLI version now reads from package.json.
- Tool schema output is redacted for secrets.

## [1.0.0] - 2025-12-29

### Added
- MCP-native ZAI CLI covering vision, search, reader, repo, and tool discovery.
- ZAI CLI skill for the marketplace with detailed references.
- Open-source project scaffolding and release process.

### Changed
- Default output format to data-only for LLM and token efficiency.
