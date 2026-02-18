# @revolutionai/mcp-server

MCP server for the revolutionAI hiring platform. Lets AI assistants search talent, scope projects, and manage the full hiring workflow — directly from Claude Code, Cursor, or any MCP-compatible client.

## Quick Start

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "revolutionai": {
      "command": "npx",
      "args": ["-y", "@revolutionai/mcp-server"],
      "env": {
        "REVOLUTIONAI_API_KEY": "rai_your_key_here"
      }
    }
  }
}
```

Get your API key at [revolutionai.io/settings](https://revolutionai.io/settings).

### Self-hosted (HTTP/SSE)

```bash
npm install
npm run build
npm run start:http
# Server listens on PORT 3001 (configurable via PORT env var)
```

Clients connect to `GET /sse` with `Authorization: Bearer rai_xxx`.

## Tools (12)

### Discovery

| Tool | Description | Scope |
|------|-------------|-------|
| `search_talent` | Search developers by skills, budget, availability, timezone, rating | read |
| `get_talent_profile` | Get a developer's full profile with rates, history, and links | read |
| `list_skills` | Browse 300+ skills across 8 categories | read |

### Projects

| Tool | Description | Scope |
|------|-------------|-------|
| `scope_project` | AI-assisted scoping — describe in natural language, get budget/timeline/skills/milestones | read |
| `create_project` | Create a hiring project (starts as draft) | write |
| `update_project` | Update project details or publish/cancel | write |
| `list_projects` | List your projects with optional status filter | read |

### Engagement

| Tool | Description | Scope |
|------|-------------|-------|
| `get_matches` | AI-ranked developer matches scored across 5 dimensions | read |
| `hire_developer` | Hire a developer — creates contract, milestones, and Stripe checkout | write |
| `complete_engagement` | Approve milestones (releases payment), request revisions, or dispute | write |

### Account

| Tool | Description | Scope |
|------|-------------|-------|
| `get_dashboard` | Account overview: projects, contracts, pending approvals, spend | read |
| `search_docs` | Search platform documentation | read |

## Transports

| Transport | Entry Point | Use Case |
|-----------|-------------|----------|
| **stdio** | `src/index.ts` → `dist/index.js` | Claude Desktop, Claude Code, `npx` |
| **HTTP/SSE** | `src/http.ts` → `dist/http.js` | Centralized server, Claude.ai MCP connector |

## Typed Client Library

```typescript
import { RevolutionAIClient } from "@revolutionai/mcp-server/client";

const client = await RevolutionAIClient.createInProcess(auth);

const results = await client.searchTalent({
  skills: ["TypeScript", "Next.js"],
  availability: "available",
  min_rating: 4.5,
});

const scope = await client.scopeProject({
  description: "Build a real-time dashboard with Stripe billing",
});
```

## Authentication

API keys use the `rai_` prefix and support two scopes:

- **read** — search talent, view profiles, scope projects, browse skills, view dashboard, search docs
- **write** — everything in read, plus create/update projects, hire developers, manage milestones, release payments

Keys are bcrypt-hashed in the database. The server also verifies the associated Clerk user is active on each request.

## Project Structure

```
src/
├── index.ts              # stdio transport entry point
├── http.ts               # HTTP/SSE transport entry point
├── server.ts             # MCP server factory (registers all 12 tools)
├── client.ts             # Typed client library
├── auth/
│   ├── api-key.ts        # API key validation + Clerk user verification
│   └── middleware.ts      # Scope and ownership checks
├── tools/
│   ├── index.ts          # Re-exports all tool groups
│   ├── discovery.ts      # search_talent, get_talent_profile, list_skills
│   ├── projects.ts       # scope_project, create_project, update_project, list_projects
│   ├── engagement.ts     # get_matches, hire_developer, complete_engagement
│   └── account.ts        # get_dashboard, search_docs
├── db/
│   ├── client.ts         # Supabase admin client factory
│   └── queries/
│       ├── talent.ts     # Talent search and profile queries
│       ├── projects.ts   # Project CRUD
│       ├── proposals.ts  # Proposal creation and status
│       └── contracts.ts  # Contracts and milestones
├── services/
│   ├── matching-engine.ts # Multi-dimensional talent scoring
│   └── payment-service.ts # Stripe checkout and milestone transfers
├── data/
│   ├── skills.ts         # Skill taxonomy (300+ skills, 8 categories)
│   └── docs.ts           # Platform documentation search index
├── types/
│   └── index.ts          # All TypeScript interfaces
└── utils/
    ├── errors.ts         # ToolError class, formatToolResponse/formatToolError
    ├── logger.ts         # Structured JSON logger (writes to stderr)
    └── pagination.ts     # Cursor-based pagination utilities
```

## Environment Variables

```bash
# Required
REVOLUTIONAI_API_KEY=rai_xxx     # For stdio transport (client-side)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx

# Optional
STRIPE_SECRET_KEY=sk_xxx         # Required for payment operations
CLERK_SECRET_KEY=sk_xxx          # Required for user verification
PORT=3001                        # HTTP/SSE transport port
```

See `.env.example` for the full template.

## Scripts

```bash
npm run build       # Compile TypeScript
npm run dev         # Watch mode
npm run start       # stdio transport (requires .env)
npm run start:http  # HTTP/SSE transport (requires .env)
npm run test        # Run tool tests
npm run inspect     # Open MCP Inspector
```

## License

MIT
