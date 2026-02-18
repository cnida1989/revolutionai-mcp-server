/**
 * Auth middleware for scope and ownership checks.
 */

import { ToolError } from "../utils/errors.js";
import type { AuthContext, ApiScope } from "../types/index.js";

export function requireScope(auth: AuthContext, scope: ApiScope): void {
  if (!auth.scopes.includes(scope)) {
    throw new ToolError(
      "FORBIDDEN",
      `This operation requires '${scope}' scope. Your key has: [${auth.scopes.join(", ")}].`,
      "Upgrade your API key scopes at https://revolutionai.io/settings/api-keys",
    );
  }
}

export function requireOwnership(auth: AuthContext, resourceOwnerId: string): void {
  if (auth.userId !== resourceOwnerId) {
    throw new ToolError(
      "FORBIDDEN",
      "You do not have permission to access this resource.",
    );
  }
}
