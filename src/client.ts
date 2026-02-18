/**
 * Typed MCP client for the revolutionAI hiring platform.
 * Transport-agnostic — works with stdio, SSE, or in-memory transport.
 *
 * Usage:
 *   // In-process (web app, tests)
 *   const client = await RevolutionAIClient.createInProcess(auth);
 *   const results = await client.searchTalent({ skills: ["Next.js"] });
 *
 *   // With custom transport
 *   const client = new RevolutionAIClient(transport);
 *   await client.connect();
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { AuthContext } from "./types/index.js";

// ─── Error ──────────────────────────────────────────────────────────────────

export class RevolutionAIError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly recovery?: string,
  ) {
    super(message);
    this.name = "RevolutionAIError";
  }
}

// ─── Parameter Types ────────────────────────────────────────────────────────

export interface SearchTalentParams {
  skills?: string[];
  budget_min?: number;
  budget_max?: number;
  availability?: "available" | "limited";
  min_rating?: number;
  min_experience_years?: number;
  timezone?: string;
  cursor?: string;
  page_size?: number;
}

export interface ListSkillsParams {
  category?: string;
  search?: string;
}

export interface ScopeProjectParams {
  description: string;
  budget_hint?: number;
  timeline_hint?: number;
}

export interface CreateProjectParams {
  title: string;
  description: string;
  requirements?: string[];
  skills_needed: string[];
  project_type?: "fixed_price" | "hourly" | "milestone_based";
  budget_min: number;
  budget_max: number;
  estimated_duration_weeks?: number;
}

export interface UpdateProjectParams {
  project_id: string;
  title?: string;
  description?: string;
  requirements?: string[];
  skills_needed?: string[];
  budget_min?: number;
  budget_max?: number;
  status?: "open" | "cancelled";
}

export interface ListProjectsParams {
  status?: "draft" | "open" | "in_progress" | "completed" | "cancelled";
  cursor?: string;
  page_size?: number;
}

export interface HireParams {
  project_id: string;
  talent_id: string;
  amount_cents: number;
  milestones: Array<{
    title: string;
    description: string;
    amount_cents: number;
    estimated_days: number;
  }>;
  message?: string;
}

export interface CompleteParams {
  milestone_id: string;
  action: "approve" | "revision" | "dispute";
  feedback?: string;
}

// ─── Tool Info ──────────────────────────────────────────────────────────────

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class RevolutionAIClient {
  private client: Client;
  private connected = false;

  constructor(private transport: Transport) {
    this.client = new Client({ name: "revolutionai-client", version: "0.1.0" });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.client.connect(this.transport);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  async listTools(): Promise<ToolInfo[]> {
    const { tools } = await this.client.listTools();
    return tools as ToolInfo[];
  }

  // ─── Discovery ──────────────────────────────────────────────────────────

  async searchTalent(params: SearchTalentParams = {}): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_search_talent", params);
  }

  async getTalentProfile(talentId: string): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_get_talent_profile", { talent_id: talentId });
  }

  async listSkills(params: ListSkillsParams = {}): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_list_skills", params);
  }

  // ─── Projects ───────────────────────────────────────────────────────────

  async scopeProject(params: ScopeProjectParams): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_scope_project", params);
  }

  async createProject(params: CreateProjectParams): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_create_project", params);
  }

  async updateProject(params: UpdateProjectParams): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_update_project", params);
  }

  async listProjects(params: ListProjectsParams = {}): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_list_projects", params);
  }

  // ─── Engagement ─────────────────────────────────────────────────────────

  async getMatches(projectId: string, limit?: number): Promise<Record<string, unknown>> {
    const args: Record<string, unknown> = { project_id: projectId };
    if (limit !== undefined) args.limit = limit;
    return this.callToolParsed("revolutionai_get_matches", args);
  }

  async hireDeveloper(params: HireParams): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_hire_developer", params);
  }

  async completeEngagement(params: CompleteParams): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_complete_engagement", params);
  }

  // ─── Account ────────────────────────────────────────────────────────────

  async getDashboard(): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_get_dashboard", {});
  }

  async searchDocs(query: string): Promise<Record<string, unknown>> {
    return this.callToolParsed("revolutionai_search_docs", { query });
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private async callToolParsed(
    name: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await this.client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content?.[0]?.text;

    if (!text) {
      throw new RevolutionAIError("INTERNAL_ERROR", `Empty response from ${name}`);
    }

    const parsed = JSON.parse(text);

    if (result.isError) {
      const err = parsed.error ?? {};
      throw new RevolutionAIError(
        err.code ?? "INTERNAL_ERROR",
        err.message ?? "Tool returned an error",
        err.recovery,
      );
    }

    return parsed;
  }

  // ─── Factory Methods ──────────────────────────────────────────────────

  /**
   * Create an in-process client using InMemoryTransport.
   * Links directly to a server instance — no HTTP hop.
   */
  static async createInProcess(auth: AuthContext): Promise<RevolutionAIClient> {
    const { createServer } = await import("./server.js");
    const { InMemoryTransport } = await import(
      "@modelcontextprotocol/sdk/inMemory.js"
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const server = createServer(auth);
    await server.connect(serverTransport);

    const client = new RevolutionAIClient(clientTransport);
    await client.connect();
    return client;
  }
}

// Re-export AuthContext for convenience
export type { AuthContext } from "./types/index.js";
