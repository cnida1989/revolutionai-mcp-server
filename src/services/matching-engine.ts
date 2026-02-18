/**
 * 4-stage matching pipeline: filter → score → boost → rank
 *
 * Weights: Skills 40%, Rate 20%, Availability 15%, Rating 15%, Experience 10%
 */

import { searchTalent } from "../db/queries/talent.js";
import type { TalentProfile, McpProject, MatchResult } from "../types/index.js";

// Scoring weights
const WEIGHTS = {
  skills: 0.40,
  rate: 0.20,
  availability: 0.15,
  rating: 0.15,
  experience: 0.10,
};

const MIN_SKILL_OVERLAP = 0.6; // 60% minimum to be considered

export async function getMatches(project: McpProject, limit = 10): Promise<MatchResult[]> {
  const requiredSkills = project.skills_needed as string[];
  if (requiredSkills.length === 0) return [];

  // Stage 1: Filter — fetch candidates with at least one matching skill
  // We fetch more than needed because we'll filter further
  const { items: candidates } = await searchTalent(
    { availability: "available" },
    undefined,
    50,
  );

  // Also fetch limited-availability talent
  const { items: limitedCandidates } = await searchTalent(
    { availability: "limited" },
    undefined,
    50,
  );

  const allCandidates = [...candidates, ...limitedCandidates];

  // Stage 2: Score — compute composite score for each candidate
  const scored: MatchResult[] = [];

  for (const talent of allCandidates) {
    const talentSkills = talent.skills as string[];

    // Skills overlap check
    const matchingSkills = requiredSkills.filter((s) =>
      talentSkills.some((ts) => ts.toLowerCase() === s.toLowerCase()),
    );
    const skillOverlap = matchingSkills.length / requiredSkills.length;

    // Filter: must have ≥60% skill overlap
    if (skillOverlap < MIN_SKILL_OVERLAP) continue;

    // Score each dimension (0-1 scale)
    const skillsScore = skillOverlap;

    const rateScore = scoreRate(talent, project.budget_min, project.budget_max);
    const availabilityScore = scoreAvailability(talent);
    const ratingScore = talent.avg_rating / 5.0;
    const experienceScore = Math.min(talent.years_experience / 10, 1.0);

    // Weighted composite
    const score =
      skillsScore * WEIGHTS.skills +
      rateScore * WEIGHTS.rate +
      availabilityScore * WEIGHTS.availability +
      ratingScore * WEIGHTS.rating +
      experienceScore * WEIGHTS.experience;

    // Stage 3: Boost — bonus for exact skill matches and high ratings
    let finalScore = score;
    if (skillOverlap === 1.0) finalScore += 0.05; // Perfect skill match boost
    if (talent.avg_rating >= 4.9 && talent.total_reviews >= 5) finalScore += 0.03; // Elite rating boost

    // Build match reasons
    const reasons: string[] = [];
    if (skillOverlap >= 0.9) reasons.push(`Matches ${matchingSkills.length}/${requiredSkills.length} required skills`);
    else reasons.push(`Matches ${matchingSkills.length}/${requiredSkills.length} skills (${Math.round(skillOverlap * 100)}%)`);
    if (talent.avg_rating >= 4.8) reasons.push(`Excellent ${talent.avg_rating} rating from ${talent.total_reviews} reviews`);
    if (talent.availability === "available") reasons.push("Immediately available");
    if (rateScore > 0.8) reasons.push("Rate fits well within budget");

    scored.push({
      talent,
      score: Math.round(finalScore * 100) / 100,
      breakdown: {
        skills_score: Math.round(skillsScore * 100) / 100,
        rate_score: Math.round(rateScore * 100) / 100,
        availability_score: Math.round(availabilityScore * 100) / 100,
        rating_score: Math.round(ratingScore * 100) / 100,
        experience_score: Math.round(experienceScore * 100) / 100,
      },
      match_reasons: reasons,
    });
  }

  // Stage 4: Rank — sort by score descending, return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function scoreRate(talent: TalentProfile, budgetMin: number, budgetMax: number): number {
  if (budgetMin === 0 && budgetMax === 0) return 0.5; // No budget specified

  const talentMidRate = (talent.hourly_rate_min + talent.hourly_rate_max) / 2;
  const budgetMid = (budgetMin + budgetMax) / 2;

  if (budgetMid === 0) return 0.5;

  // Score based on how close talent rate is to budget midpoint
  const ratio = talentMidRate / budgetMid;

  if (ratio <= 1.0) return 1.0; // Under budget — perfect
  if (ratio <= 1.2) return 0.8; // Slightly over
  if (ratio <= 1.5) return 0.5; // Moderately over
  return 0.2; // Well over budget
}

function scoreAvailability(talent: TalentProfile): number {
  if (talent.availability === "available") {
    return talent.availability_hours_per_week >= 30 ? 1.0 : 0.8;
  }
  if (talent.availability === "limited") {
    return talent.availability_hours_per_week >= 15 ? 0.5 : 0.3;
  }
  return 0.0; // unavailable
}
