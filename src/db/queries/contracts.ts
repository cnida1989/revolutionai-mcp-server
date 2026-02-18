/**
 * Contract and milestone database queries.
 */

import { createAdminClient } from "../client.js";
import { ToolError } from "../../utils/errors.js";
import type { Contract, McpMilestone, MilestoneStatus, ProposalMilestone } from "../../types/index.js";

export async function createContract(data: {
  project_id: string;
  proposal_id: string;
  client_id: string;
  talent_id: string;
  total_amount_cents: number;
  platform_fee_cents: number;
  talent_amount_cents: number;
  transfer_group: string;
  stripe_checkout_session_id?: string;
}): Promise<Contract> {
  const supabase = createAdminClient();

  const { data: contract, error } = await supabase
    .from("mcp_contracts")
    .insert({
      project_id: data.project_id,
      proposal_id: data.proposal_id,
      client_id: data.client_id,
      talent_id: data.talent_id,
      total_amount_cents: data.total_amount_cents,
      platform_fee_cents: data.platform_fee_cents,
      talent_amount_cents: data.talent_amount_cents,
      transfer_group: data.transfer_group,
      stripe_checkout_session_id: data.stripe_checkout_session_id ?? null,
      status: "active",
    })
    .select()
    .single();

  if (error || !contract) {
    throw new ToolError("INTERNAL_ERROR", `Failed to create contract: ${error?.message}`);
  }

  return contract as Contract;
}

export async function getContract(id: string): Promise<Contract> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_contracts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new ToolError(
      "NOT_FOUND",
      `Contract '${id}' not found.`,
      "Use list_projects to find active contracts.",
    );
  }

  return data as Contract;
}

export async function updateContractStatus(
  id: string,
  status: "completed" | "disputed" | "cancelled",
): Promise<Contract> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_contracts")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new ToolError("INTERNAL_ERROR", `Failed to update contract: ${error?.message}`);
  }

  return data as Contract;
}

export async function createMilestones(
  contractId: string,
  milestones: ProposalMilestone[],
): Promise<McpMilestone[]> {
  const supabase = createAdminClient();

  const rows = milestones.map((m, i) => ({
    contract_id: contractId,
    title: m.title,
    description: m.description,
    amount_cents: m.amount_cents,
    order_index: i,
    status: "pending" as const,
  }));

  const { data, error } = await supabase
    .from("mcp_milestones")
    .insert(rows)
    .select();

  if (error || !data) {
    throw new ToolError("INTERNAL_ERROR", `Failed to create milestones: ${error?.message}`);
  }

  return data as McpMilestone[];
}

export async function getMilestonesByContract(contractId: string): Promise<McpMilestone[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_milestones")
    .select("*")
    .eq("contract_id", contractId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new ToolError("INTERNAL_ERROR", `Failed to fetch milestones: ${error.message}`);
  }

  return (data ?? []) as McpMilestone[];
}

export async function getMilestone(id: string): Promise<McpMilestone> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_milestones")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new ToolError("NOT_FOUND", `Milestone '${id}' not found.`);
  }

  return data as McpMilestone;
}

export async function updateMilestoneStatus(
  id: string,
  status: MilestoneStatus,
  extra?: { stripe_transfer_id?: string; submitted_at?: string; approved_at?: string },
): Promise<McpMilestone> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_milestones")
    .update({ status, ...extra })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new ToolError("INTERNAL_ERROR", `Failed to update milestone: ${error?.message}`);
  }

  return data as McpMilestone;
}

export async function getContractsByClient(clientId: string): Promise<Contract[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_contracts")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ToolError("INTERNAL_ERROR", `Failed to fetch contracts: ${error.message}`);
  }

  return (data ?? []) as Contract[];
}
