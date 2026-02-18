/**
 * MCP Server factory — creates the server instance and registers all 12 tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerDiscoveryTools,
  registerProjectTools,
  registerEngagementTools,
  registerAccountTools,
} from "./tools/index.js";
import type { AuthContext } from "./types/index.js";

export function createServer(auth: AuthContext): McpServer {
  const server = new McpServer(
    {
      name: "revolutionai",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register all 4 tool groups (12 tools total)
  registerDiscoveryTools(server, auth);
  registerProjectTools(server, auth);
  registerEngagementTools(server, auth);
  registerAccountTools(server, auth);

  return server;
}
