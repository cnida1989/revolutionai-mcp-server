/**
 * Talent profile database queries.
 */

import { createAdminClient } from "../client.js";
import { ToolError } from "../../utils/errors.js";
import { encodeCursor, decodeCursor, clampPageSize, type PaginatedResult } from "../../utils/pagination.js";
import type { TalentProfile, TalentSearchFilters } from "../../types/index.js";

export async function searchTalent(
  filters: TalentSearchFilters,
  cursor?: string,
  pageSize?: number,
): Promise<PaginatedResult<TalentProfile>> {
  const limit = clampPageSize(pageSize);
  const supabase = createAdminClient();

  let query = supabase
    .from("talent_profiles")
    .select("*", { count: "exact" });

  // Skill containment filter (GIN-indexed)
  // Must JSON.stringify the array — raw arrays fail for skills with special chars (e.g. "Next.js")
  if (filters.skills && filters.skills.length > 0) {
    query = query.contains("skills", JSON.stringify(filters.skills));
  }

  // Budget range filter (compare against talent's rate range)
  if (filters.budget_min !== undefined) {
    query = query.gte("hourly_rate_max", filters.budget_min);
  }
  if (filters.budget_max !== undefined) {
    query = query.lte("hourly_rate_min", filters.budget_max);
  }

  // Availability filter
  if (filters.availability) {
    query = query.eq("availability", filters.availability);
  }

  // Minimum rating
  if (filters.min_rating !== undefined) {
    query = query.gte("avg_rating", filters.min_rating);
  }

  // Minimum experience
  if (filters.min_experience_years !== undefined) {
    query = query.gte("years_experience", filters.min_experience_years);
  }

  // Timezone filter
  if (filters.timezone) {
    query = query.eq("timezone", filters.timezone);
  }

  // Cursor-based pagination
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      query = query.gt("id", decoded.id);
    }
  }

  // Order and limit (fetch limit+1 to detect hasMore)
  query = query.order("id", { ascending: true }).limit(limit + 1);

  const { data, error, count } = await query;

  if (error) {
    throw new ToolError("INTERNAL_ERROR", `Database query failed: ${error.message}`);
  }

  const items = (data ?? []) as TalentProfile[];
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor = hasMore && items.length > 0
    ? encodeCursor({ id: items[items.length - 1].id })
    : null;

  return { items, nextCursor, hasMore, total: count ?? undefined };
}

export async function getTalentProfile(id: string): Promise<TalentProfile> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("talent_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new ToolError(
      "NOT_FOUND",
      `Talent profile '${id}' not found.`,
      "Use search_talent to find valid profile IDs.",
    );
  }

  return data as TalentProfile;
}
