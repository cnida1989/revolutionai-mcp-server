/**
 * Discovery tools: search_talent, get_talent_profile, list_skills
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchTalent, getTalentProfile } from "../db/queries/talent.js";
import { skillCategories, getAllSkills } from "../data/skills.js";
import { formatToolResponse, formatToolError } from "../utils/errors.js";
import { requireScope } from "../auth/middleware.js";
import type { AuthContext } from "../types/index.js";

export function registerDiscoveryTools(server: McpServer, auth: AuthContext) {
  // ─── search_talent ───────────────────────────────────────────────────────
  server.tool(
    "revolutionai_search_talent",
    "Search for developers by skills, budget, availability, and more. Returns paginated results ranked by relevance.",
    {
      skills: z.array(z.string()).optional().describe("Filter by skills (e.g. ['Next.js', 'TypeScript'])"),
      budget_min: z.number().optional().describe("Minimum hourly rate in cents (e.g. 10000 = $100/hr)"),
      budget_max: z.number().optional().describe("Maximum hourly rate in cents"),
      availability: z.enum(["available", "limited"]).optional().describe("Filter by availability status"),
      min_rating: z.number().min(0).max(5).optional().describe("Minimum average rating (0-5)"),
      min_experience_years: z.number().optional().describe("Minimum years of experience"),
      timezone: z.string().optional().describe("Filter by timezone (e.g. 'America/New_York')"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      page_size: z.number().min(1).max(50).optional().describe("Results per page (default 20, max 50)"),
    },
    async (params) => {
      try {
        requireScope(auth, "read");

        const result = await searchTalent(
          {
            skills: params.skills,
            budget_min: params.budget_min,
            budget_max: params.budget_max,
            availability: params.availability,
            min_rating: params.min_rating,
            min_experience_years: params.min_experience_years,
            timezone: params.timezone,
          },
          params.cursor,
          params.page_size,
        );

        return formatToolResponse({
          developers: result.items.map(formatTalentSummary),
          pagination: {
            next_cursor: result.nextCursor,
            has_more: result.hasMore,
            total: result.total,
          },
          tip: result.items.length === 0
            ? "No developers found matching your criteria. Try broadening your search — remove some skills or increase the budget range."
            : `Found ${result.total ?? result.items.length} developers. Use get_talent_profile with an ID for full details.`,
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── get_talent_profile ──────────────────────────────────────────────────
  server.tool(
    "revolutionai_get_talent_profile",
    "Get a developer's full profile including skills, rates, availability, and project history.",
    {
      talent_id: z.string().describe("The talent profile ID (e.g. 'tal_seed_001')"),
    },
    async (params) => {
      try {
        requireScope(auth, "read");

        const profile = await getTalentProfile(params.talent_id);

        return formatToolResponse({
          profile: {
            id: profile.id,
            name: profile.display_name,
            title: profile.title,
            bio: profile.bio,
            skills: profile.skills,
            hourly_rate: {
              min: profile.hourly_rate_min,
              max: profile.hourly_rate_max,
              min_formatted: formatCents(profile.hourly_rate_min) + "/hr",
              max_formatted: formatCents(profile.hourly_rate_max) + "/hr",
            },
            availability: profile.availability,
            hours_per_week: profile.availability_hours_per_week,
            timezone: profile.timezone,
            experience_years: profile.years_experience,
            stats: {
              completed_projects: profile.completed_projects,
              avg_rating: profile.avg_rating,
              total_reviews: profile.total_reviews,
            },
            links: {
              portfolio: profile.portfolio_url,
              github: profile.github_url,
            },
          },
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── list_skills ─────────────────────────────────────────────────────────
  server.tool(
    "revolutionai_list_skills",
    "Browse the full skill taxonomy (300+ skills across 8 categories). Use to discover valid skill names for search_talent.",
    {
      category: z.string().optional().describe("Filter by category ID (e.g. 'ai-ml', 'software-dev')"),
      search: z.string().optional().describe("Search skills by name (case-insensitive partial match)"),
    },
    async (params) => {
      try {
        requireScope(auth, "read");

        if (params.search) {
          const term = params.search.toLowerCase();
          const matches = getAllSkills().filter((s) => s.toLowerCase().includes(term));
          return formatToolResponse({
            matching_skills: matches,
            count: matches.length,
            tip: matches.length === 0
              ? "No skills match that search. Try a broader term or use list_skills without a search to browse categories."
              : undefined,
          });
        }

        if (params.category) {
          const cat = skillCategories.find((c) => c.id === params.category);
          if (!cat) {
            return formatToolResponse({
              error: `Category '${params.category}' not found.`,
              valid_categories: skillCategories.map((c) => ({ id: c.id, name: c.name })),
            });
          }
          return formatToolResponse({
            category: { id: cat.id, name: cat.name, description: cat.description },
            subcategories: cat.minorCategories.map((mc) => ({
              id: mc.id,
              name: mc.name,
              skills: mc.skills,
            })),
          });
        }

        // Return all categories overview
        return formatToolResponse({
          categories: skillCategories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            skill_count: c.minorCategories.reduce((sum, mc) => sum + mc.skills.length, 0),
            subcategories: c.minorCategories.map((mc) => mc.name),
          })),
          total_skills: getAllSkills().length,
          tip: "Use category parameter to drill into a specific category, or search to find skills by name.",
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTalentSummary(t: { id: string; display_name: string; title: string; skills: unknown; hourly_rate_min: number; hourly_rate_max: number; availability: string; avg_rating: number; total_reviews: number; years_experience: number }) {
  return {
    id: t.id,
    name: t.display_name,
    title: t.title,
    skills: t.skills,
    rate: `${formatCents(t.hourly_rate_min)}-${formatCents(t.hourly_rate_max)}/hr`,
    availability: t.availability,
    rating: `${t.avg_rating} (${t.total_reviews} reviews)`,
    experience: `${t.years_experience} years`,
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
