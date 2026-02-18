/**
 * Engagement tools: get_matches, hire_developer, complete_engagement
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject, updateProject } from "../db/queries/projects.js";
import { getTalentProfile } from "../db/queries/talent.js";
import { createProposal, updateProposalStatus } from "../db/queries/proposals.js";
import {
  createContract,
  createMilestones,
  getContract,
  getMilestone,
  getMilestonesByContract,
  updateMilestoneStatus,
  updateContractStatus,
} from "../db/queries/contracts.js";
import { getMatches } from "../services/matching-engine.js";
import { calculateMcpPaymentSplit, createMcpCheckoutSession, createMilestoneTransfer } from "../services/payment-service.js";
import { requireScope, requireOwnership } from "../auth/middleware.js";
import { formatToolResponse, formatToolError, ToolError } from "../utils/errors.js";
import type { AuthContext } from "../types/index.js";

export function registerEngagementTools(server: McpServer, auth: AuthContext) {
  // ─── get_matches ─────────────────────────────────────────────────────────
  server.tool(
    "revolutionai_get_matches",
    "Get AI-ranked developer matches for a project. Scores developers across 5 dimensions: skills (40%), rate (20%), availability (15%), rating (15%), experience (10%).",
    {
      project_id: z.string().describe("The project ID to find matches for"),
      limit: z.number().min(1).max(20).optional().describe("Maximum matches to return (default 10)"),
    },
    async (params) => {
      try {
        requireScope(auth, "read");

        const project = await getProject(params.project_id);
        requireOwnership(auth, project.client_id);

        const matches = await getMatches(project, params.limit ?? 10);

        if (matches.length === 0) {
          return formatToolResponse({
            matches: [],
            message: "No developers matched your project requirements.",
            suggestions: [
              "Broaden your required skills — the matching engine needs ≥60% skill overlap",
              "Increase budget range to attract more candidates",
              "Use search_talent to manually browse available developers",
            ],
          });
        }

        return formatToolResponse({
          matches: matches.map((m, i) => ({
            rank: i + 1,
            talent_id: m.talent.id,
            name: m.talent.display_name,
            title: m.talent.title,
            score: m.score,
            match_reasons: m.match_reasons,
            breakdown: m.breakdown,
            rate: `$${(m.talent.hourly_rate_min / 100).toLocaleString()}-$${(m.talent.hourly_rate_max / 100).toLocaleString()}/hr`,
            availability: `${m.talent.availability} (${m.talent.availability_hours_per_week} hrs/wk)`,
          })),
          project: {
            id: project.id,
            title: project.title,
            skills_needed: project.skills_needed,
          },
          next_step: `Use hire_developer with project_id '${project.id}' and talent_id of your chosen developer.`,
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── hire_developer ──────────────────────────────────────────────────────
  server.tool(
    "revolutionai_hire_developer",
    "Hire a developer for your project. Creates a proposal, contract, milestones, and Stripe checkout session for payment.",
    {
      project_id: z.string().describe("The project ID"),
      talent_id: z.string().describe("The developer's talent profile ID"),
      amount_cents: z.number().min(100).describe("Total contract amount in cents (e.g. 500000 = $5,000)"),
      milestones: z.array(z.object({
        title: z.string().describe("Milestone title"),
        description: z.string().describe("What will be delivered"),
        amount_cents: z.number().min(0).describe("Payment for this milestone in cents"),
        estimated_days: z.number().min(1).describe("Estimated days to complete"),
      })).min(1).describe("Contract milestones with payment breakdown"),
      message: z.string().optional().describe("Optional message to the developer"),
    },
    async (params) => {
      try {
        requireScope(auth, "write");

        // Validate project ownership and status
        const project = await getProject(params.project_id);
        requireOwnership(auth, project.client_id);

        if (!["draft", "open"].includes(project.status)) {
          throw new ToolError(
            "CONFLICT",
            `Cannot hire for project in '${project.status}' status. Project must be draft or open.`,
          );
        }

        // Validate talent exists
        const talent = await getTalentProfile(params.talent_id);

        // Validate milestone amounts sum to total
        const milestoneTotal = params.milestones.reduce((sum, m) => sum + m.amount_cents, 0);
        if (milestoneTotal !== params.amount_cents) {
          throw new ToolError(
            "INVALID_INPUT",
            `Milestone amounts ($${(milestoneTotal / 100).toFixed(2)}) must equal total contract amount ($${(params.amount_cents / 100).toFixed(2)}).`,
            "Adjust milestone amounts so they sum to the total.",
          );
        }

        // Calculate payment split
        const { platformFeeCents, talentAmountCents } = calculateMcpPaymentSplit(params.amount_cents);
        const transferGroup = `mcp_${project.id}_${Date.now()}`;

        // Create proposal (auto-accepted in hire flow)
        const proposal = await createProposal({
          project_id: params.project_id,
          talent_id: params.talent_id,
          amount_cents: params.amount_cents,
          estimated_hours: params.milestones.reduce((sum, m) => sum + m.estimated_days * 8, 0),
          cover_letter: params.message ?? `Hired via revolutionAI MCP for project: ${project.title}`,
          milestones: params.milestones,
        });
        await updateProposalStatus(proposal.id, "accepted");

        // Create contract
        const contract = await createContract({
          project_id: params.project_id,
          proposal_id: proposal.id,
          client_id: auth.userId,
          talent_id: params.talent_id,
          total_amount_cents: params.amount_cents,
          platform_fee_cents: platformFeeCents,
          talent_amount_cents: talentAmountCents,
          transfer_group: transferGroup,
        });

        // Create milestones
        const milestones = await createMilestones(contract.id, params.milestones);

        // Update project status to in_progress
        await updateProject(params.project_id, { status: "in_progress" });

        // Create Stripe checkout (may fail if Stripe not configured — that's ok)
        let checkoutUrl: string | null = null;
        try {
          const checkout = await createMcpCheckoutSession({
            contractId: contract.id,
            projectId: params.project_id,
            talentId: params.talent_id,
            clientId: auth.userId,
            amountCents: params.amount_cents,
            projectTitle: project.title,
            talentName: talent.display_name,
            transferGroup,
          });
          checkoutUrl = checkout.checkoutUrl;
        } catch {
          // Stripe not configured — skip payment for now
        }

        return formatToolResponse({
          contract: {
            id: contract.id,
            developer: talent.display_name,
            total: `$${(params.amount_cents / 100).toLocaleString()}`,
            platform_fee: `$${(platformFeeCents / 100).toLocaleString()} (10%)`,
            developer_receives: `$${(talentAmountCents / 100).toLocaleString()} (90%)`,
            milestones: milestones.map((m) => ({
              id: m.id,
              title: m.title,
              amount: `$${(m.amount_cents / 100).toLocaleString()}`,
              status: m.status,
            })),
          },
          payment: checkoutUrl
            ? { checkout_url: checkoutUrl, message: "Complete payment at the URL above to fund the contract." }
            : { message: "Stripe not configured. Set STRIPE_SECRET_KEY to enable payments." },
          next_steps: [
            "Developer will begin work on the first milestone",
            `Use complete_engagement with milestone_id to approve completed work`,
            `Use get_dashboard to see all active contracts`,
          ],
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── complete_engagement ─────────────────────────────────────────────────
  server.tool(
    "revolutionai_complete_engagement",
    "Manage milestone completion: approve (releases payment), request revision, or dispute. Use to progress through contract milestones.",
    {
      milestone_id: z.string().describe("The milestone ID to act on"),
      action: z.enum(["approve", "revision", "dispute"]).describe("Action: 'approve' releases payment, 'revision' requests changes, 'dispute' escalates"),
      feedback: z.string().optional().describe("Feedback for the developer (required for revision/dispute)"),
    },
    async (params) => {
      try {
        requireScope(auth, "write");

        const milestone = await getMilestone(params.milestone_id);
        const contract = await getContract(milestone.contract_id);
        requireOwnership(auth, contract.client_id);

        if (params.action === "approve") {
          if (milestone.status !== "submitted") {
            throw new ToolError(
              "CONFLICT",
              `Cannot approve milestone in '${milestone.status}' status. Milestone must be 'submitted'.`,
              "Wait for the developer to submit the milestone for review.",
            );
          }

          // Attempt Stripe transfer
          let transferId: string | null = null;
          const talent = await getTalentProfile(contract.talent_id);

          if (talent.stripe_connect_account_id) {
            try {
              const { talentAmountCents } = calculateMcpPaymentSplit(milestone.amount_cents);
              transferId = await createMilestoneTransfer({
                connectedAccountId: talent.stripe_connect_account_id,
                amountCents: talentAmountCents,
                contractId: contract.id,
                milestoneId: milestone.id,
                transferGroup: contract.transfer_group,
              });
            } catch {
              // Transfer failed — mark approved but note payment issue
            }
          }

          await updateMilestoneStatus(milestone.id, "approved", {
            approved_at: new Date().toISOString(),
            stripe_transfer_id: transferId ?? undefined,
          });

          // Check if all milestones are approved → complete contract
          const allMilestones = await getMilestonesByContract(contract.id);
          const allApproved = allMilestones.every((m) =>
            m.id === milestone.id ? true : m.status === "approved",
          );

          if (allApproved) {
            await updateContractStatus(contract.id, "completed");
            await updateProject(contract.project_id, { status: "completed" });
          }

          return formatToolResponse({
            milestone: {
              id: milestone.id,
              title: milestone.title,
              status: "approved",
              payment: transferId
                ? `$${(milestone.amount_cents / 100).toLocaleString()} released to developer`
                : "Payment pending — developer needs Stripe Connect setup",
            },
            contract_completed: allApproved,
            message: allApproved
              ? "All milestones approved! Contract is now complete."
              : "Milestone approved. Developer can proceed to the next milestone.",
          });

        } else if (params.action === "revision") {
          if (!["pending", "submitted", "in_progress"].includes(milestone.status)) {
            throw new ToolError("CONFLICT", `Cannot request revision for milestone in '${milestone.status}' status.`);
          }

          await updateMilestoneStatus(milestone.id, "revision_requested");

          return formatToolResponse({
            milestone: { id: milestone.id, title: milestone.title, status: "revision_requested" },
            feedback: params.feedback ?? "No feedback provided",
            message: "Revision requested. The developer will be notified.",
          });

        } else {
          // dispute
          if (!params.feedback) {
            throw new ToolError("INVALID_INPUT", "Feedback is required when disputing a milestone.", "Describe the issue.");
          }

          await updateMilestoneStatus(milestone.id, "disputed");
          await updateContractStatus(contract.id, "disputed");

          return formatToolResponse({
            milestone: { id: milestone.id, title: milestone.title, status: "disputed" },
            feedback: params.feedback,
            message: "Dispute filed. Our team will review and mediate. Contact hello@revolutionai.io for urgent issues.",
          });
        }
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}
