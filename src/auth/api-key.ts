/**
 * API key validation for MCP authentication.
 * Keys use the `rai_` prefix format and are bcrypt-hashed in the database.
 * After key validation, the associated Clerk user is verified as active.
 */

import bcrypt from "bcryptjs";
import { createAdminClient } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { ToolError } from "../utils/errors.js";
import type { AuthContext, ApiKeyRow } from "../types/index.js";

const KEY_PREFIX = "rai_";
const CLERK_API_BASE = "https://api.clerk.com/v1";

/**
 * Verify a Clerk user exists and is not banned/deleted.
 * Uses the Clerk Backend API directly (no SDK dependency needed).
 */
async function verifyClerkUser(userId: string): Promise<void> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    logger.warn("CLERK_SECRET_KEY not set — skipping Clerk user verification");
    return;
  }

  const res = await fetch(`${CLERK_API_BASE}/users/${userId}`, {
    headers: { Authorization: `Bearer ${clerkSecretKey}` },
  });

  if (res.status === 404) {
    throw new ToolError(
      "UNAUTHORIZED",
      "User account no longer exists.",
      "Contact support or create a new account at https://revolutionai.io",
    );
  }

  if (!res.ok) {
    logger.error("Clerk API error during user verification", {
      status: res.status,
      userId,
    });
    // Don't block on Clerk API failures — key was valid in DB
    return;
  }

  const user = await res.json() as { banned?: boolean; locked?: boolean; deleted?: boolean };

  if (user.banned) {
    throw new ToolError(
      "UNAUTHORIZED",
      "User account has been suspended.",
      "Contact support at https://revolutionai.io/help",
    );
  }

  if (user.locked) {
    throw new ToolError(
      "UNAUTHORIZED",
      "User account is locked.",
      "Contact support at https://revolutionai.io/help",
    );
  }

  if (user.deleted) {
    throw new ToolError(
      "UNAUTHORIZED",
      "User account has been deleted.",
      "Contact support or create a new account at https://revolutionai.io",
    );
  }
}

export async function validateApiKey(apiKey: string): Promise<AuthContext> {
  if (!apiKey.startsWith(KEY_PREFIX)) {
    throw new ToolError(
      "UNAUTHORIZED",
      "Invalid API key format. Keys must start with 'rai_'.",
      "Get your API key at https://revolutionai.io/settings/api-keys",
    );
  }

  // Extract the prefix portion for lookup (first 12 chars)
  const keyPrefix = apiKey.slice(0, 12);

  const supabase = createAdminClient();
  const { data: keyRows, error } = await supabase
    .from("mcp_api_keys")
    .select("*")
    .eq("key_prefix", keyPrefix)
    .limit(10);

  if (error) {
    logger.error("Database error during API key lookup", { error: error.message });
    throw new ToolError("INTERNAL_ERROR", "Failed to validate API key");
  }

  if (!keyRows || keyRows.length === 0) {
    throw new ToolError(
      "UNAUTHORIZED",
      "Invalid API key.",
      "Check your key at https://revolutionai.io/settings/api-keys",
    );
  }

  // Compare against all matching prefix rows (handles hash collisions)
  for (const row of keyRows as ApiKeyRow[]) {
    const isMatch = await bcrypt.compare(apiKey, row.key_hash);
    if (!isMatch) continue;

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      throw new ToolError(
        "UNAUTHORIZED",
        "API key has expired.",
        "Generate a new key at https://revolutionai.io/settings/api-keys",
      );
    }

    // Verify the Clerk user is still active
    await verifyClerkUser(row.user_id);

    // Update last_used_at (fire-and-forget)
    supabase
      .from("mcp_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(() => {});

    logger.info("API key authenticated", { userId: row.user_id, keyId: row.id });

    return {
      userId: row.user_id,
      keyId: row.id,
      scopes: row.scopes,
      rateLimitTier: row.rate_limit_tier,
    };
  }

  throw new ToolError(
    "UNAUTHORIZED",
    "Invalid API key.",
    "Check your key at https://revolutionai.io/settings/api-keys",
  );
}
