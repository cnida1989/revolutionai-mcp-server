/**
 * Core types for the revolutionAI MCP server.
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export type ApiScope = "read" | "write";

export interface AuthContext {
  userId: string;
  keyId: string;
  scopes: ApiScope[];
  rateLimitTier: "free" | "pro" | "enterprise";
}

// ─── Talent ──────────────────────────────────────────────────────────────────

export interface TalentProfile {
  id: string;
  display_name: string;
  title: string;
  bio: string;
  skills: string[];
  hourly_rate_min: number;
  hourly_rate_max: number;
  availability: "available" | "limited" | "unavailable";
  availability_hours_per_week: number;
  timezone: string;
  years_experience: number;
  completed_projects: number;
  avg_rating: number;
  total_reviews: number;
  portfolio_url: string | null;
  github_url: string | null;
  stripe_connect_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalentSearchFilters {
  skills?: string[];
  budget_min?: number;
  budget_max?: number;
  availability?: "available" | "limited";
  min_rating?: number;
  min_experience_years?: number;
  timezone?: string;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export type ProjectStatus = "draft" | "open" | "in_progress" | "completed" | "cancelled";
export type ProjectType = "fixed_price" | "hourly" | "milestone_based";

export interface McpProject {
  id: string;
  client_id: string;
  title: string;
  description: string;
  requirements: string[];
  skills_needed: string[];
  project_type: ProjectType;
  budget_min: number;
  budget_max: number;
  estimated_duration_weeks: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

// ─── Proposals ───────────────────────────────────────────────────────────────

export type ProposalStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface Proposal {
  id: string;
  project_id: string;
  talent_id: string;
  amount_cents: number;
  estimated_hours: number;
  cover_letter: string;
  milestones: ProposalMilestone[];
  status: ProposalStatus;
  created_at: string;
}

export interface ProposalMilestone {
  title: string;
  description: string;
  amount_cents: number;
  estimated_days: number;
}

// ─── Contracts ───────────────────────────────────────────────────────────────

export type ContractStatus = "active" | "completed" | "disputed" | "cancelled";

export interface Contract {
  id: string;
  project_id: string;
  proposal_id: string;
  client_id: string;
  talent_id: string;
  total_amount_cents: number;
  platform_fee_cents: number;
  talent_amount_cents: number;
  status: ContractStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  transfer_group: string;
  created_at: string;
  updated_at: string;
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export type MilestoneStatus = "pending" | "in_progress" | "submitted" | "approved" | "revision_requested" | "disputed";

export interface McpMilestone {
  id: string;
  contract_id: string;
  title: string;
  description: string;
  amount_cents: number;
  order_index: number;
  status: MilestoneStatus;
  submitted_at: string | null;
  approved_at: string | null;
  stripe_transfer_id: string | null;
  created_at: string;
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiScope[];
  rate_limit_tier: "free" | "pro" | "enterprise";
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

// ─── Matching ────────────────────────────────────────────────────────────────

export interface MatchResult {
  talent: TalentProfile;
  score: number;
  breakdown: {
    skills_score: number;
    rate_score: number;
    availability_score: number;
    rating_score: number;
    experience_score: number;
  };
  match_reasons: string[];
}

// ─── Scoping ─────────────────────────────────────────────────────────────────

export interface ProjectScope {
  suggested_title: string;
  estimated_budget_min: number;
  estimated_budget_max: number;
  estimated_duration_weeks: number;
  recommended_skills: string[];
  suggested_milestones: Array<{
    title: string;
    description: string;
    percentage: number;
  }>;
  complexity: "simple" | "moderate" | "complex" | "enterprise";
  project_type: ProjectType;
}
