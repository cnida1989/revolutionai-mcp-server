/**
 * MCP Project database queries.
 */

import { createAdminClient } from "../client.js";
import { ToolError } from "../../utils/errors.js";
import { encodeCursor, decodeCursor, clampPageSize, type PaginatedResult } from "../../utils/pagination.js";
import type { McpProject, ProjectStatus } from "../../types/index.js";

export async function createProject(data: {
  client_id: string;
  title: string;
  description: string;
  requirements: string[];
  skills_needed: string[];
  project_type: string;
  budget_min: number;
  budget_max: number;
  estimated_duration_weeks: number;
}): Promise<McpProject> {
  const supabase = createAdminClient();

  const { data: project, error } = await supabase
    .from("mcp_projects")
    .insert({
      client_id: data.client_id,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      skills_needed: data.skills_needed,
      project_type: data.project_type,
      budget_min: data.budget_min,
      budget_max: data.budget_max,
      estimated_duration_weeks: data.estimated_duration_weeks,
      status: "draft",
    })
    .select()
    .single();

  if (error || !project) {
    throw new ToolError("INTERNAL_ERROR", `Failed to create project: ${error?.message}`);
  }

  return project as McpProject;
}

export async function getProject(id: string): Promise<McpProject> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new ToolError(
      "NOT_FOUND",
      `Project '${id}' not found.`,
      "Use list_projects to find valid project IDs.",
    );
  }

  return data as McpProject;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<McpProject, "title" | "description" | "requirements" | "skills_needed" | "project_type" | "budget_min" | "budget_max" | "estimated_duration_weeks" | "status">>,
): Promise<McpProject> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("mcp_projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new ToolError("INTERNAL_ERROR", `Failed to update project: ${error?.message}`);
  }

  return data as McpProject;
}

export async function listProjects(
  clientId: string,
  status?: ProjectStatus,
  cursor?: string,
  pageSize?: number,
): Promise<PaginatedResult<McpProject>> {
  const limit = clampPageSize(pageSize);
  const supabase = createAdminClient();

  let query = supabase
    .from("mcp_projects")
    .select("*", { count: "exact" })
    .eq("client_id", clientId);

  if (status) {
    query = query.eq("status", status);
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      query = query.gt("id", decoded.id);
    }
  }

  query = query.order("created_at", { ascending: false }).limit(limit + 1);

  const { data, error, count } = await query;

  if (error) {
    throw new ToolError("INTERNAL_ERROR", `Database query failed: ${error.message}`);
  }

  const items = (data ?? []) as McpProject[];
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor = hasMore && items.length > 0
    ? encodeCursor({ id: items[items.length - 1].id })
    : null;

  return { items, nextCursor, hasMore, total: count ?? undefined };
}
