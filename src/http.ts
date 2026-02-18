#!/usr/bin/env node

/**
 * revolutionAI MCP Server — HTTP/SSE transport entry point.
 * Used for the centralized server that clients + contributors connect to
 * via Claude.ai MCP connector or any HTTP-based MCP client.
 *
 * Usage:
 *   npm run start:http
 *   # Server listens on PORT (default 3001)
 *
 * Clients connect with their API key in the Authorization header.
 * Each connection gets its own authenticated MCP session.
 */

import { createServer as createHttpServer } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { validateApiKey } from "./auth/api-key.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

// Track active transports for cleanup
const activeSessions = new Map<string, SSEServerTransport>();

const httpServer = createHttpServer(async (req, res) => {
  // CORS headers for browser-based MCP clients
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "0.1.0", transport: "sse" }));
    return;
  }

  // SSE endpoint — client connects here to establish MCP session
  if (req.url === "/sse" && req.method === "GET") {
    try {
      // Extract API key from Authorization header or query param
      const authHeader = req.headers.authorization;
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const apiKey = authHeader?.replace("Bearer ", "") ?? url.searchParams.get("key");

      if (!apiKey) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: "API key required. Pass via Authorization: Bearer rai_xxx header.",
        }));
        return;
      }

      // Validate API key
      const auth = await validateApiKey(apiKey);
      logger.info("SSE client authenticated", { userId: auth.userId });

      // Create an authenticated MCP server for this session
      const mcpServer = createServer(auth);
      const transport = new SSEServerTransport("/messages", res);

      // Track session
      const sessionId = transport.sessionId;
      activeSessions.set(sessionId, transport);

      // Cleanup on disconnect
      res.on("close", () => {
        activeSessions.delete(sessionId);
        logger.info("SSE client disconnected", { sessionId, userId: auth.userId });
      });

      await mcpServer.connect(transport);
      logger.info("SSE session established", { sessionId, userId: auth.userId });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      logger.error("SSE connection failed", { error: message });
      if (!res.headersSent) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
    }
    return;
  }

  // Message endpoint — client sends tool calls here
  if (req.url?.startsWith("/messages") && req.method === "POST") {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId || !activeSessions.has(sessionId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or expired session. Reconnect to /sse." }));
      return;
    }

    const transport = activeSessions.get(sessionId)!;
    await transport.handlePostMessage(req, res);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    error: "Not found",
    endpoints: {
      "GET /health": "Health check",
      "GET /sse": "Connect MCP client (SSE transport)",
      "POST /messages": "Send MCP messages (requires sessionId)",
    },
  }));
});

httpServer.listen(PORT, () => {
  logger.info(`revolutionAI MCP server started (HTTP/SSE transport)`, { port: PORT });
  process.stderr.write(
    `\nrevolutionAI MCP Server running on http://localhost:${PORT}\n` +
    `  SSE endpoint: http://localhost:${PORT}/sse\n` +
    `  Health check: http://localhost:${PORT}/health\n\n`,
  );
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down...");
  activeSessions.clear();
  httpServer.close(() => process.exit(0));
});
