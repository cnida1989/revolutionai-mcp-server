/**
 * Proposal database queries.
 */

import { createAdminClient } from "../client.js";
import { ToolError } from "../../utils/errors.js";
import type { Proposal, ProposalMilestone } from "../../types/index.js";

export async function createProposal(data: {
  project_id: string;
  talent_id: string;
  amount_cents: number;
  estimated_hours: number;
  cover_letter: string;
  milestones: ProposalMilestone[];
}): Promise<Proposal> {
  const supabase = createAdminClient();

  const { data: proposal, error } = await supabase
    .from("mcp_proposals")
    .insert({
      project_id: data.project_id,
      talent_id: data.talent_id,
      amount_cents: data.amount_cents,
      estimated_hours: data.estimated_hours,
      cover_letter: data.cover_letter,
      milestones: data.milestones,
      status: "pending",
    })
    .select()
    .single();

  if (error || !proposal) {
    throw new ToolError("INTERNAL_ERROR", `Failed to create proposal: ${error?.message}`);
  }

  return proposal as Proposal;
}

export async function updateProposalStatus(
  id: string,
  status: "accepted" | "rejected" | "withdrawn",
): Promise<Proposal> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_proposals")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new ToolError("INTERNAL_ERROR", `Failed to update proposal: ${error?.message}`);
  }

  return data as Proposal;
}

export async function getProposal(id: string): Promise<Proposal> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new ToolError(
      "NOT_FOUND",
      `Proposal '${id}' not found.`,
    );
  }

  return data as Proposal;
}
