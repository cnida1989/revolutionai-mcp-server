/**
 * Account tools: get_dashboard, search_docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listProjects } from "../db/queries/projects.js";
import { getContractsByClient, getMilestonesByContract } from "../db/queries/contracts.js";
import { searchDocs } from "../data/docs.js";
import { requireScope } from "../auth/middleware.js";
import { formatToolResponse, formatToolError } from "../utils/errors.js";
import type { AuthContext } from "../types/index.js";

export function registerAccountTools(server: McpServer, auth: AuthContext) {
  // ─── get_dashboard ───────────────────────────────────────────────────────
  server.tool(
    "revolutionai_get_dashboard",
    "Get an overview of your account: active projects, contracts, pending approvals, and total spend.",
    {},
    async () => {
      try {
        requireScope(auth, "read");

        // Fetch projects
        const { items: projects } = await listProjects(auth.userId, undefined, undefined, 50);

        // Fetch contracts
        const contracts = await getContractsByClient(auth.userId);

        // Count milestones needing attention
        let pendingApprovals = 0;
        let totalSpentCents = 0;
        let activeContracts = 0;

        for (const contract of contracts) {
          if (contract.status === "active") {
            activeContracts++;
            const milestones = await getMilestonesByContract(contract.id);
            for (const m of milestones) {
              if (m.status === "submitted") pendingApprovals++;
              if (m.status === "approved") totalSpentCents += m.amount_cents;
            }
          } else if (contract.status === "completed") {
            totalSpentCents += contract.total_amount_cents;
          }
        }

        // Group projects by status
        const projectsByStatus = projects.reduce<Record<string, number>>((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {});

        return formatToolResponse({
          dashboard: {
            projects: {
              total: projects.length,
              by_status: projectsByStatus,
            },
            contracts: {
              active: activeContracts,
              total: contracts.length,
            },
            pending_approvals: pendingApprovals,
            total_spent: `$${(totalSpentCents / 100).toLocaleString()}`,
          },
          actions_needed: pendingApprovals > 0
            ? [`${pendingApprovals} milestone(s) awaiting your approval. Use complete_engagement to review.`]
            : ["No pending actions. You're all caught up!"],
          quick_actions: [
            "search_talent — Find developers for a new project",
            "scope_project — Get AI-estimated project scope",
            "list_projects — View your projects",
          ],
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── search_docs ─────────────────────────────────────────────────────────
  server.tool(
    "revolutionai_search_docs",
    "Search revolutionAI platform documentation. Find help on hiring flows, pricing, API keys, matching, milestones, and troubleshooting.",
    {
      query: z.string().min(2).describe("Search query (e.g. 'how to hire', 'pricing', 'troubleshooting')"),
    },
    async (params) => {
      try {
        requireScope(auth, "read");

        const results = searchDocs(params.query);

        if (results.length === 0) {
          return formatToolResponse({
            results: [],
            message: "No docs matched your query.",
            suggestions: [
              "Try broader terms like 'hiring', 'payment', 'setup'",
              "Contact support: hello@revolutionai.io",
            ],
          });
        }

        return formatToolResponse({
          results: results.map((doc) => ({
            title: doc.title,
            category: doc.category,
            content: doc.content,
          })),
          count: results.length,
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}
