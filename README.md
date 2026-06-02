# Building Agents with Google ADK — Workshop

A multi-step workshop for building AI agents with Google ADK, a self-hosted
MCP server, and Crawl4AI — all deployed with Docker Compose.

## Structure

| Directory | What |
|---|---|
| `workshop/` | Docsify documentation site + participant exercises |
| `workshop/docs/` | Workshop step-by-step guides |
| `workshop/exercises/` | Code for each workshop step |
| `mcp-server/` | Self-hosted MCP server (with compose.yml) |
| `crawl4ai/` | Crawl4AI service (with compose.yml) |

## Quick start

```bash
# Start the workshop docs site
cd workshop
docker compose up

# Start the MCP server
cd ../mcp-server
docker compose up

# Start Crawl4AI
cd ../crawl4ai
docker compose up
```
