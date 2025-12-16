# MegaSearch MCP Stdio Proxy

A local MCP server that connects Claude Desktop to MegaSearch API using OAuth 2.0 client credentials.

## Why use this?

- **No timeout issues** - Direct stdio communication avoids HTTP/SSE transport timeouts
- **Simple setup** - Just set environment variables
- **Secure** - Uses OAuth 2.0 client credentials flow

## Installation

```bash
npm install -g megasearch-mcp-proxy-stdio
```

Or use directly with npx (no installation needed):

```bash
npx megasearch-mcp-proxy-stdio
```

## Setup

### 1. Create OAuth Client

1. Go to [MegaSearch Dashboard](https://megasearch.prodevs.in/user/tokens)
2. Click "Create OAuth Client"
3. Copy the Client ID and Client Secret

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "megasearch": {
      "command": "npx",
      "args": ["megasearch-mcp-proxy-stdio"],
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

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEGASEARCH_CLIENT_ID` | Yes | - | OAuth Client ID (starts with `mcp_`) |
| `MEGASEARCH_CLIENT_SECRET` | Yes | - | OAuth Client Secret |
| `MEGASEARCH_BASE_URL` | No | `https://megasearch.prodevs.in` | MegaSearch API URL |
| `MEGASEARCH_TIMEOUT` | No | `300000` | Request timeout in milliseconds (5 min) |

## Usage

Once configured, you can use MegaSearch in Claude Desktop:

> "Search for the latest developments in quantum computing"

The search tool will:
1. Fire multiple search engines in parallel
2. Extract content from top results
3. Analyze and synthesize a comprehensive answer
4. Return sources with citations

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
MEGASEARCH_CLIENT_ID=xxx MEGASEARCH_CLIENT_SECRET=yyy npm start
```

## License

MIT
