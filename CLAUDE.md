# CLAUDE.md

## Important Restrictions

**Never run npm or yarn commands directly.** Always ask the user before executing any package manager commands.

## Project Overview

MCP server for the revolutionAI hiring platform. Exposes 12 tools across 4 categories (Discovery, Projects, Engagement, Account) via the Model Context Protocol. Supports stdio and HTTP/SSE transports.

**Tech Stack:** TypeScript, Node.js (ESM), MCP SDK, Supabase, Stripe, Zod, bcryptjs

## Build & Run

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode compilation
npm run start          # stdio transport (for Claude Desktop / Claude Code)
npm run start:http     # HTTP/SSE transport (for centralized server)
npm run test           # Run tool tests
npm run inspect        # Open MCP Inspector
```

## Architecture

### Entry Points
- `src/index.ts` — stdio transport (used by `npx`, Claude Desktop)
- `src/http.ts` — HTTP/SSE transport (centralized server, port 3001)

### Server Factory
`src/server.ts` — `createServer(auth)` creates an `McpServer` and registers all 12 tools from 4 groups.

### Tool Registration Pattern
Each tool file exports a `register*Tools(server, auth)` function:
- `src/tools/discovery.ts` — `search_talent`, `get_talent_profile`, `list_skills`
- `src/tools/projects.ts` — `scope_project`, `create_project`, `update_project`, `list_projects`
- `src/tools/engagement.ts` — `get_matches`, `hire_developer`, `complete_engagement`
- `src/tools/account.ts` — `get_dashboard`, `search_docs`

Tools follow a consistent pattern:
1. Call `requireScope(auth, "read"|"write")` for authorization
2. Call `requireOwnership(auth, resourceOwnerId)` for write ops on owned resources
3. Return via `formatToolResponse(data)` or `formatToolError(error)`
4. Tool names are prefixed: `revolutionai_<tool_name>`

### Auth Flow
1. API key (`rai_` prefix) → prefix lookup in `mcp_api_keys` table → bcrypt compare
2. Clerk user verification (active, not banned/locked/deleted)
3. Scope enforcement per-tool (`read` or `write`)
4. Ownership check on mutations

### Database
- Supabase via `createAdminClient()` in `src/db/client.ts`
- Queries in `src/db/queries/` — one file per domain (talent, projects, proposals, contracts)
- Migrations managed privately (not included in public repo)

### Client Library
`src/client.ts` — `RevolutionAIClient` with typed methods for all 12 tools. Factory: `createInProcess(auth)` for in-memory transport.

### Logging
`src/utils/logger.ts` — structured JSON to stderr (stdout reserved for MCP stdio protocol).

### Error Handling
`src/utils/errors.ts` — `ToolError` class with `code`, `message`, `recovery`. All tool responses go through `formatToolResponse`/`formatToolError` for consistent JSON output.

## Key Conventions

- **ESM only** — all imports use `.js` extensions (`import { foo } from "./bar.js"`)
- **Zod for validation** — tool parameters defined with Zod schemas inline in `server.tool()` calls
- **Amounts in cents** — all monetary values are integers in cents (e.g., 500000 = $5,000)
- **Cursor-based pagination** — `encodeCursor`/`decodeCursor` in `src/utils/pagination.ts`, default page size 20, max 50
- **Types** — all interfaces in `src/types/index.ts`, tool-specific param types in `src/client.ts`

## Environment Variables

```
REVOLUTIONAI_API_KEY    # Client-side key for stdio transport
SUPABASE_URL            # Supabase project URL
SUPABASE_SECRET_KEY     # Supabase service role key
STRIPE_SECRET_KEY       # Stripe secret key (for payments)
CLERK_SECRET_KEY        # Clerk secret key (for user verification)
PORT                    # HTTP/SSE transport port (default 3001)
```
