#!/usr/bin/env node

/**
 * revolutionAI MCP Server — stdio transport entry point.
 * Used when running via npx or Claude Code CLI configuration.
 *
 * Usage:
 *   REVOLUTIONAI_API_KEY=rai_xxx npx @revolutionai/mcp-server
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateApiKey } from "./auth/api-key.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

async function main() {
  const apiKey = process.env.REVOLUTIONAI_API_KEY;

  if (!apiKey) {
    logger.error("REVOLUTIONAI_API_KEY environment variable is required");
    process.stderr.write(
      "\nError: REVOLUTIONAI_API_KEY is not set.\n" +
      "Get your API key at https://revolutionai.io/settings/api-keys\n" +
      "Then set it: export REVOLUTIONAI_API_KEY=rai_your_key\n\n",
    );
    process.exit(1);
  }

  try {
    // Validate API key and get auth context
    const auth = await validateApiKey(apiKey);
    logger.info("API key validated", { userId: auth.userId, scopes: auth.scopes });

    // Create MCP server with authenticated context
    const server = createServer(auth);

    // Connect via stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("revolutionAI MCP server started (stdio transport)");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to start MCP server", { error: message });
    process.stderr.write(`\nFailed to start: ${message}\n`);
    process.exit(1);
  }
}

main();
