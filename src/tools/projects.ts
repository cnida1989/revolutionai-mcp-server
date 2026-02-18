/**
 * Project tools: scope_project, create_project, update_project, list_projects
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createProject, getProject, updateProject, listProjects } from "../db/queries/projects.js";
import { requireScope, requireOwnership } from "../auth/middleware.js";
import { formatToolResponse, formatToolError, ToolError } from "../utils/errors.js";
import { getAllSkills, getCategoriesForSkill } from "../data/skills.js";
import type { AuthContext, ProjectScope } from "../types/index.js";

export function registerProjectTools(server: McpServer, auth: AuthContext) {
  // ─── scope_project ───────────────────────────────────────────────────────
  server.tool(
    "revolutionai_scope_project",
    "AI-assisted project scoping. Describe what you need in natural language and get estimated budget, timeline, recommended skills, and milestone breakdown.",
    {
      description: z.string().min(10).describe("Describe your project in natural language (e.g. 'Build a Next.js dashboard with Stripe payments and user auth')"),
      budget_hint: z.number().optional().describe("Approximate budget in cents (helps calibrate estimates)"),
      timeline_hint: z.number().optional().describe("Desired timeline in weeks"),
    },
    async (params) => {
      try {
        requireScope(auth, "read");

        const scope = analyzeProjectScope(params.description, params.budget_hint, params.timeline_hint);

        return formatToolResponse({
          scope,
          formatted: {
            budget: `$${(scope.estimated_budget_min / 100).toLocaleString()}-$${(scope.estimated_budget_max / 100).toLocaleString()}`,
            duration: `${scope.estimated_duration_weeks} weeks`,
            complexity: scope.complexity,
            project_type: scope.project_type,
          },
          next_steps: [
            "Review the suggested scope and adjust as needed",
            "Use create_project to create a project with these parameters",
            "Use get_matches to find developers for this project",
          ],
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── create_project ──────────────────────────────────────────────────────
  server.tool(
    "revolutionai_create_project",
    "Create a new hiring project. Starts in 'draft' status. Use update_project to publish it as 'open'.",
    {
      title: z.string().min(5).max(200).describe("Project title"),
      description: z.string().min(20).describe("Detailed project description"),
      requirements: z.array(z.string()).optional().describe("List of specific requirements"),
      skills_needed: z.array(z.string()).min(1).describe("Required skills (use list_skills to find valid names)"),
      project_type: z.enum(["fixed_price", "hourly", "milestone_based"]).optional().describe("Payment type (default: milestone_based)"),
      budget_min: z.number().min(0).describe("Minimum budget in cents"),
      budget_max: z.number().min(0).describe("Maximum budget in cents"),
      estimated_duration_weeks: z.number().min(1).max(52).optional().describe("Estimated duration in weeks (default: 4)"),
    },
    async (params) => {
      try {
        requireScope(auth, "write");

        // Validate skills exist in taxonomy
        const allSkills = getAllSkills();
        const invalidSkills = params.skills_needed.filter(
          (s) => !allSkills.some((as) => as.toLowerCase() === s.toLowerCase()),
        );
        if (invalidSkills.length > 0) {
          throw new ToolError(
            "INVALID_INPUT",
            `Unknown skills: ${invalidSkills.join(", ")}`,
            "Use list_skills to browse valid skill names.",
          );
        }

        if (params.budget_max < params.budget_min) {
          throw new ToolError(
            "INVALID_INPUT",
            "budget_max must be greater than or equal to budget_min.",
          );
        }

        const project = await createProject({
          client_id: auth.userId,
          title: params.title,
          description: params.description,
          requirements: params.requirements ?? [],
          skills_needed: params.skills_needed,
          project_type: params.project_type ?? "milestone_based",
          budget_min: params.budget_min,
          budget_max: params.budget_max,
          estimated_duration_weeks: params.estimated_duration_weeks ?? 4,
        });

        return formatToolResponse({
          project: {
            id: project.id,
            title: project.title,
            status: project.status,
            budget: `$${(project.budget_min / 100).toLocaleString()}-$${(project.budget_max / 100).toLocaleString()}`,
            skills: project.skills_needed,
            duration: `${project.estimated_duration_weeks} weeks`,
          },
          next_steps: [
            `Project created as draft (ID: ${project.id})`,
            "Use update_project with status 'open' to publish it",
            `Use get_matches with project_id '${project.id}' to find developers`,
          ],
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── update_project ──────────────────────────────────────────────────────
  server.tool(
    "revolutionai_update_project",
    "Update a project's details or status. Only draft and open projects can be modified.",
    {
      project_id: z.string().describe("The project ID to update"),
      title: z.string().min(5).max(200).optional().describe("New project title"),
      description: z.string().min(20).optional().describe("New description"),
      requirements: z.array(z.string()).optional().describe("Updated requirements"),
      skills_needed: z.array(z.string()).optional().describe("Updated skills"),
      budget_min: z.number().min(0).optional().describe("New minimum budget (cents)"),
      budget_max: z.number().min(0).optional().describe("New maximum budget (cents)"),
      status: z.enum(["open", "cancelled"]).optional().describe("Change status: 'open' to publish, 'cancelled' to close"),
    },
    async (params) => {
      try {
        requireScope(auth, "write");

        const existing = await getProject(params.project_id);
        requireOwnership(auth, existing.client_id);

        if (!["draft", "open"].includes(existing.status)) {
          throw new ToolError(
            "CONFLICT",
            `Cannot update project in '${existing.status}' status. Only draft and open projects can be modified.`,
          );
        }

        const updates: Record<string, unknown> = {};
        if (params.title) updates.title = params.title;
        if (params.description) updates.description = params.description;
        if (params.requirements) updates.requirements = params.requirements;
        if (params.skills_needed) updates.skills_needed = params.skills_needed;
        if (params.budget_min !== undefined) updates.budget_min = params.budget_min;
        if (params.budget_max !== undefined) updates.budget_max = params.budget_max;
        if (params.status) updates.status = params.status;

        if (Object.keys(updates).length === 0) {
          throw new ToolError("INVALID_INPUT", "No updates provided. Specify at least one field to change.");
        }

        const updated = await updateProject(params.project_id, updates);

        return formatToolResponse({
          project: {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            updated_at: updated.updated_at,
          },
          message: params.status === "open"
            ? "Project is now live! Developers can see it. Use get_matches to find candidates."
            : "Project updated successfully.",
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );

  // ─── list_projects ───────────────────────────────────────────────────────
  server.tool(
    "revolutionai_list_projects",
    "List your projects with optional status filter. Returns paginated results.",
    {
      status: z.enum(["draft", "open", "in_progress", "completed", "cancelled"]).optional().describe("Filter by project status"),
      cursor: z.string().optional().describe("Pagination cursor"),
      page_size: z.number().min(1).max(50).optional().describe("Results per page (default 20)"),
    },
    async (params) => {
      try {
        requireScope(auth, "read");

        const result = await listProjects(auth.userId, params.status, params.cursor, params.page_size);

        return formatToolResponse({
          projects: result.items.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            budget: `$${(p.budget_min / 100).toLocaleString()}-$${(p.budget_max / 100).toLocaleString()}`,
            skills: p.skills_needed,
            duration: `${p.estimated_duration_weeks} weeks`,
            created_at: p.created_at,
          })),
          pagination: {
            next_cursor: result.nextCursor,
            has_more: result.hasMore,
            total: result.total,
          },
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  );
}

// ─── Scoping Heuristics ──────────────────────────────────────────────────────

function analyzeProjectScope(
  description: string,
  budgetHint?: number,
  timelineHint?: number,
): ProjectScope {
  const desc = description.toLowerCase();
  const allSkills = getAllSkills();

  // Extract skills mentioned in description
  const detectedSkills = allSkills.filter((skill) =>
    desc.includes(skill.toLowerCase()),
  );

  // Detect complexity signals
  const complexitySignals = {
    simple: ["landing page", "simple", "basic", "single page", "static"],
    moderate: ["dashboard", "crud", "api", "auth", "database", "payments"],
    complex: ["real-time", "microservice", "scale", "migration", "ai", "ml", "machine learning"],
    enterprise: ["enterprise", "compliance", "soc 2", "hipaa", "multi-tenant", "distributed"],
  };

  let complexity: "simple" | "moderate" | "complex" | "enterprise" = "moderate";
  if (complexitySignals.enterprise.some((s) => desc.includes(s))) complexity = "enterprise";
  else if (complexitySignals.complex.some((s) => desc.includes(s))) complexity = "complex";
  else if (complexitySignals.simple.some((s) => desc.includes(s))) complexity = "simple";

  // Budget estimation by complexity (in cents)
  const budgetRanges = {
    simple: { min: 250000, max: 1000000 },       // $2.5K-$10K
    moderate: { min: 500000, max: 2500000 },      // $5K-$25K
    complex: { min: 1500000, max: 7500000 },      // $15K-$75K
    enterprise: { min: 5000000, max: 20000000 },  // $50K-$200K
  };

  const durationRanges = {
    simple: { min: 1, max: 2 },
    moderate: { min: 2, max: 6 },
    complex: { min: 4, max: 12 },
    enterprise: { min: 8, max: 24 },
  };

  const budget = budgetRanges[complexity];
  const duration = durationRanges[complexity];

  // Generate milestone suggestions
  const milestoneTemplates = {
    simple: [
      { title: "Design & Setup", description: "Project setup, design review, and environment configuration", percentage: 30 },
      { title: "Implementation", description: "Core feature development", percentage: 50 },
      { title: "Testing & Deployment", description: "QA, bug fixes, and production deployment", percentage: 20 },
    ],
    moderate: [
      { title: "Discovery & Setup", description: "Requirements review, architecture design, environment setup", percentage: 20 },
      { title: "Core Features", description: "Primary feature development and API integration", percentage: 40 },
      { title: "Polish & Integration", description: "UI polish, integrations, edge cases", percentage: 25 },
      { title: "Testing & Launch", description: "QA, performance testing, deployment", percentage: 15 },
    ],
    complex: [
      { title: "Architecture & Planning", description: "System design, tech stack decisions, infrastructure setup", percentage: 15 },
      { title: "Foundation", description: "Core infrastructure, data models, auth system", percentage: 25 },
      { title: "Feature Development", description: "Primary features and integrations", percentage: 30 },
      { title: "Advanced Features", description: "Complex features, optimization, scaling", percentage: 20 },
      { title: "QA & Launch", description: "Comprehensive testing, security review, deployment", percentage: 10 },
    ],
    enterprise: [
      { title: "Discovery & Architecture", description: "Stakeholder alignment, system architecture, compliance planning", percentage: 10 },
      { title: "Infrastructure", description: "Cloud infrastructure, CI/CD, monitoring setup", percentage: 15 },
      { title: "Core Platform", description: "Core services, data layer, auth & authorization", percentage: 25 },
      { title: "Feature Development", description: "Business features, integrations, APIs", percentage: 25 },
      { title: "Compliance & Security", description: "Security hardening, compliance audit, penetration testing", percentage: 15 },
      { title: "Launch & Handoff", description: "Production deployment, documentation, team training", percentage: 10 },
    ],
  };

  // Recommend project type
  const projectType = complexity === "simple" ? "fixed_price" as const : "milestone_based" as const;

  // Add category-enriched skill recommendations
  const recommendedSkills = detectedSkills.length > 0
    ? detectedSkills
    : inferSkillsFromDescription(desc);

  return {
    suggested_title: generateTitle(description),
    estimated_budget_min: budgetHint ? Math.round(budgetHint * 0.8) : budget.min,
    estimated_budget_max: budgetHint ? Math.round(budgetHint * 1.3) : budget.max,
    estimated_duration_weeks: timelineHint ?? Math.round((duration.min + duration.max) / 2),
    recommended_skills: recommendedSkills.slice(0, 10),
    suggested_milestones: milestoneTemplates[complexity],
    complexity,
    project_type: projectType,
  };
}

function generateTitle(description: string): string {
  // Take first sentence or first 60 chars
  const firstSentence = description.split(/[.!?]/)[0].trim();
  if (firstSentence.length <= 80) return firstSentence;
  return firstSentence.slice(0, 77) + "...";
}

function inferSkillsFromDescription(desc: string): string[] {
  const skillMap: Record<string, string[]> = {
    "web app": ["TypeScript", "React", "Next.js", "Node.js"],
    "dashboard": ["React", "TypeScript", "Tailwind CSS", "REST APIs"],
    "mobile app": ["React Native", "TypeScript", "REST APIs"],
    "api": ["Node.js", "REST APIs", "PostgreSQL", "TypeScript"],
    "machine learning": ["Python", "Machine Learning", "PyTorch"],
    "data pipeline": ["Python", "Apache Spark", "SQL", "ETL Pipelines"],
    "devops": ["Docker", "Kubernetes", "Terraform", "CI/CD Pipelines"],
    "security": ["OWASP", "Cloud Security", "Penetration Testing"],
  };

  const skills = new Set<string>();
  for (const [keyword, associatedSkills] of Object.entries(skillMap)) {
    if (desc.includes(keyword)) {
      associatedSkills.forEach((s) => skills.add(s));
    }
  }

  return skills.size > 0 ? [...skills] : ["TypeScript", "React", "Node.js"];
}
