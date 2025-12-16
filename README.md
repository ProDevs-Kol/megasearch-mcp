# MegaSearch MCP

[![npm version](https://badge.fury.io/js/megasearch-mcp.svg)](https://www.npmjs.com/package/megasearch-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A local MCP (Model Context Protocol) server that connects Claude Desktop to [MegaSearch](https://megasearch.prodevs.in) API using OAuth 2.0 client credentials.

## Features

- **No timeout issues** - Direct stdio communication avoids HTTP/SSE transport timeouts
- **5-minute timeout** - Configurable timeout for comprehensive searches
- **OAuth 2.0** - Secure authentication with automatic token refresh
- **Simple setup** - Just set environment variables

## What is MegaSearch?

MegaSearch is an AI-powered metasearch engine that:
- Fires 10+ search engines in parallel
- Extracts and analyzes content from top results
- Synthesizes comprehensive answers with citations
- Iteratively refines queries until the answer is complete

## Installation

```bash
npm install -g megasearch-mcp
```

Or use directly with npx (no installation needed):

```bash
npx megasearch-mcp
```

## Quick Start

### 1. Create OAuth Client

1. Go to [MegaSearch Dashboard](https://megasearch.prodevs.in/user/tokens)
2. Sign up / Log in with Google
3. Click **"+ Create OAuth Client"**
4. Copy the **Client ID** and **Client Secret** (shown only once!)

### 2. Configure Claude Desktop

Add to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "megasearch": {
      "command": "npx",
      "args": ["megasearch-mcp"],
      "env": {
        "MEGASEARCH_CLIENT_ID": "mcp_your_client_id",
        "MEGASEARCH_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After saving the config, restart Claude Desktop to load the MCP server.

## Usage

Once configured, ask Claude to search for anything:

> "Search for the latest developments in quantum computing"

> "What are the best practices for React performance optimization?"

> "Find recent news about AI regulations in the EU"

Claude will use MegaSearch to:
1. Fire multiple search engines in parallel
2. Extract content from top results
3. Analyze and synthesize a comprehensive answer
4. Return sources with citations

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEGASEARCH_CLIENT_ID` | Yes | - | OAuth Client ID (starts with `mcp_`) |
| `MEGASEARCH_CLIENT_SECRET` | Yes | - | OAuth Client Secret |
| `MEGASEARCH_BASE_URL` | No | `https://megasearch.prodevs.in` | MegaSearch API URL |
| `MEGASEARCH_TIMEOUT` | No | `300000` | Request timeout in ms (default: 5 min) |

## Development

```bash
# Clone the repository
git clone https://github.com/ProDevs-Kol/megasearch-mcp.git
cd megasearch-mcp

# Install dependencies
npm install

# Build
npm run build

# Run locally
MEGASEARCH_CLIENT_ID=xxx MEGASEARCH_CLIENT_SECRET=yyy npm start
```

## Troubleshooting

### "Missing MEGASEARCH_CLIENT_ID or MEGASEARCH_CLIENT_SECRET"

Make sure you've set both environment variables in your Claude Desktop config.

### "Failed to obtain access token"

- Check that your Client ID and Secret are correct
- Ensure your MegaSearch account is active
- Try creating a new OAuth client

### Search takes too long

MegaSearch performs comprehensive searches that may take 30-60 seconds. This is expected behavior. You can reduce the timeout with `MEGASEARCH_TIMEOUT` if needed.

## Related Projects

- [MegaSearch](https://megasearch.prodevs.in) - The AI-powered metasearch engine
- [n8n-nodes-megasearch](https://www.npmjs.com/package/n8n-nodes-megasearch) - n8n integration

## License

MIT - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
