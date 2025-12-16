#!/usr/bin/env node
/**
 * MegaSearch MCP Stdio Proxy
 *
 * A local MCP server that connects Claude Desktop to MegaSearch API
 * using OAuth 2.0 client credentials for authentication.
 *
 * Usage:
 *   MEGASEARCH_CLIENT_ID=xxx MEGASEARCH_CLIENT_SECRET=yyy megasearch-mcp
 *
 * Or in Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "megasearch": {
 *         "command": "npx",
 *         "args": ["megasearch-mcp"],
 *         "env": {
 *           "MEGASEARCH_CLIENT_ID": "mcp_xxx",
 *           "MEGASEARCH_CLIENT_SECRET": "your_secret",
 *           "MEGASEARCH_BASE_URL": "https://megasearch.prodevs.in"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ProgressNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Configuration from environment
const config = {
  baseUrl: process.env.MEGASEARCH_BASE_URL || "https://megasearch.prodevs.in",
  clientId: process.env.MEGASEARCH_CLIENT_ID || "",
  clientSecret: process.env.MEGASEARCH_CLIENT_SECRET || "",
  timeout: parseInt(process.env.MEGASEARCH_TIMEOUT || "300000", 10), // 5 minutes default
};

// Token cache
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get OAuth access token using client_credentials grant.
 * Caches tokens and refreshes them when expired.
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60 second buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken;
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Missing MEGASEARCH_CLIENT_ID or MEGASEARCH_CLIENT_SECRET environment variables"
    );
  }

  const tokenUrl = `${config.baseUrl}/api/v1/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to obtain access token: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

/**
 * Execute search via MegaSearch REST API with progress notifications
 */
async function executeSearch(
  query: string,
  progressToken: string | number | undefined,
  sendProgress: (progress: number, total: number, message: string) => Promise<void>
): Promise<SearchResponse> {
  const accessToken = await getAccessToken();

  // Send initial progress
  await sendProgress(0, 100, "Starting search...");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  // Start a progress ticker to keep the connection alive
  // Send progress updates every 10 seconds
  let progressValue = 5;
  const progressInterval = setInterval(async () => {
    progressValue = Math.min(progressValue + 5, 90);
    const messages = [
      "Querying search engines...",
      "Analyzing results...",
      "Extracting content...",
      "Synthesizing answer...",
      "Processing sources...",
      "Finalizing response...",
    ];
    const msgIndex = Math.floor((progressValue / 100) * messages.length);
    await sendProgress(progressValue, 100, messages[Math.min(msgIndex, messages.length - 1)]);
  }, 10000);

  try {
    await sendProgress(10, 100, "Sending query to MegaSearch...");

    const response = await fetch(`${config.baseUrl}/api/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    clearInterval(progressInterval);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail =
        (errorData as { detail?: string; message?: string }).detail ||
        (errorData as { message?: string }).message ||
        response.statusText;

      if (response.status === 401) {
        tokenCache = null;
        throw new Error("Authentication failed. Please check your credentials.");
      } else if (response.status === 402) {
        throw new Error(
          "Insufficient credits. Please purchase more credits or upgrade your plan."
        );
      } else if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment and try again."
        );
      }

      throw new Error(`Search failed: ${response.status} - ${detail}`);
    }

    await sendProgress(95, 100, "Formatting results...");
    const result = (await response.json()) as SearchResponse;
    await sendProgress(100, 100, "Search complete!");

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    clearInterval(progressInterval);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Search timed out after ${config.timeout / 1000} seconds`
      );
    }
    throw error;
  }
}

interface SearchSource {
  index: number;
  title: string;
  url: string;
  snippet: string;
  provider?: string;
  content?: string;
}

interface SearchMetadata {
  iterations: number;
  providers_used: string[];
  total_raw_results?: number;
  deduplicated_results?: number;
  used_paid_apis: boolean;
  gaps_identified?: string[];
  refined_queries?: string[];
  total_time_ms: number;
}

interface SearchResponse {
  query: string;
  answer: string;
  sources: SearchSource[];
  metadata?: SearchMetadata;
  usage?: {
    credits_charged: number;
    credits_remaining: number;
    plan: string;
  };
}

/**
 * Format search response for MCP
 */
function formatSearchResponse(result: SearchResponse): string {
  const lines: string[] = [];

  // Answer section
  lines.push(`# Answer to: ${result.query}`);
  lines.push("");
  lines.push(result.answer);
  lines.push("");

  // Sources section
  if (result.sources && result.sources.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Sources");
    lines.push("");

    for (const source of result.sources) {
      lines.push(`[${source.index}] **${source.title}**`);
      lines.push(`    URL: ${source.url}`);
      if (source.provider) {
        lines.push(`    Provider: ${source.provider}`);
      }
      lines.push("");
    }
  }

  // Metadata section
  if (result.metadata) {
    lines.push("---");
    lines.push("");
    lines.push("## Search Metadata");
    lines.push(`- Iterations: ${result.metadata.iterations}`);
    lines.push(`- Providers: ${result.metadata.providers_used.join(", ")}`);
    lines.push(`- Total time: ${result.metadata.total_time_ms}ms`);
    lines.push(`- Used paid APIs: ${result.metadata.used_paid_apis}`);

    if (
      result.metadata.gaps_identified &&
      result.metadata.gaps_identified.length > 0
    ) {
      lines.push(
        `- Gaps identified: ${result.metadata.gaps_identified.join(", ")}`
      );
    }

    if (
      result.metadata.refined_queries &&
      result.metadata.refined_queries.length > 0
    ) {
      lines.push(`- Query refinements: ${result.metadata.refined_queries.length}`);
    }
  }

  // Usage info
  if (result.usage) {
    lines.push("");
    lines.push("## Usage");
    lines.push(`- Credits charged: ${result.usage.credits_charged}`);
    lines.push(`- Credits remaining: ${result.usage.credits_remaining}`);
    lines.push(`- Plan: ${result.usage.plan}`);
  }

  return lines.join("\n");
}

// Define the search tool
const SEARCH_TOOL: Tool = {
  name: "search",
  description:
    "Search the web for any information using MegaSearch. " +
    "Fires multiple search engines in parallel, extracts content, " +
    "analyzes results, and synthesizes a comprehensive answer with citations. " +
    "Just provide your question - the system handles everything else. " +
    "Note: Comprehensive searches may take 30-60 seconds.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Your search query - ask anything",
      },
    },
    required: ["query"],
  },
};

// Create MCP server
const server = new Server(
  {
    name: "megasearch",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [SEARCH_TOOL],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args, _meta } = request.params;
  const progressToken = _meta?.progressToken;

  if (name !== "search") {
    return {
      content: [
        {
          type: "text" as const,
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  }

  const query = (args as { query?: string })?.query;
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: Query is required and must be a non-empty string",
        },
      ],
      isError: true,
    };
  }

  // Create progress sender function
  const sendProgress = async (progress: number, total: number, message: string) => {
    if (progressToken !== undefined) {
      try {
        await server.notification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress,
            total,
            message,
          },
        });
      } catch (e) {
        // Ignore notification errors - client may not support progress
        console.error("Progress notification failed:", e);
      }
    }
  };

  try {
    const result = await executeSearch(query.trim(), progressToken, sendProgress);
    const formatted = formatSearchResponse(result);

    return {
      content: [
        {
          type: "text" as const,
          text: formatted,
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      content: [
        {
          type: "text" as const,
          text: `Search error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  // Validate configuration
  if (!config.clientId || !config.clientSecret) {
    console.error(
      "Error: MEGASEARCH_CLIENT_ID and MEGASEARCH_CLIENT_SECRET environment variables are required"
    );
    console.error("");
    console.error("Usage:");
    console.error(
      "  MEGASEARCH_CLIENT_ID=mcp_xxx MEGASEARCH_CLIENT_SECRET=yyy megasearch-mcp"
    );
    console.error("");
    console.error("Or set in your Claude Desktop configuration.");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is used for MCP protocol)
  console.error(`MegaSearch MCP Proxy started`);
  console.error(`  Base URL: ${config.baseUrl}`);
  console.error(`  Client ID: ${config.clientId.substring(0, 10)}...`);
  console.error(`  Timeout: ${config.timeout / 1000}s`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
