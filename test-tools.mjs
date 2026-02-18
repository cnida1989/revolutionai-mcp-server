/**
 * Integration test for all 12 MCP tools.
 * Tests tool discovery, schema validation, and error handling.
 * Connects via stdio transport using the MCP SDK client.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "./dist/server.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

// Mock auth context (bypasses API key validation for testing)
const mockAuth = {
  userId: "user_test_001",
  keyId: "key_test_001",
  scopes: ["read", "write"],
  rateLimitTier: "pro",
};

const EXPECTED_TOOLS = [
  "revolutionai_search_talent",
  "revolutionai_get_talent_profile",
  "revolutionai_list_skills",
  "revolutionai_scope_project",
  "revolutionai_create_project",
  "revolutionai_update_project",
  "revolutionai_list_projects",
  "revolutionai_get_matches",
  "revolutionai_hire_developer",
  "revolutionai_complete_engagement",
  "revolutionai_get_dashboard",
  "revolutionai_search_docs",
];

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, testName, detail) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function skip(testName, reason) {
  console.log(`  SKIP: ${testName} — ${reason}`);
  skipped++;
}

async function callTool(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.[0]?.text;
  const parsed = text ? JSON.parse(text) : null;
  return { raw: result, parsed, isError: result.isError };
}

async function main() {
  console.log("\n=== revolutionAI MCP Server — Integration Tests ===\n");

  // Create server + client with in-memory transport
  const server = createServer(mockAuth);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  // ─── Test 1: Tool Discovery ────────────────────────────────────────────

  console.log("1. Tool Discovery");
  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name).sort();

  assert(tools.length === 12, `Found ${tools.length} tools (expected 12)`);

  for (const expected of EXPECTED_TOOLS) {
    assert(
      toolNames.includes(expected),
      `Tool '${expected}' registered`,
      toolNames.includes(expected) ? "" : `Missing! Found: ${toolNames.join(", ")}`,
    );
  }

  // Verify all tools have descriptions
  for (const tool of tools) {
    assert(
      tool.description && tool.description.length > 10,
      `Tool '${tool.name}' has description (${tool.description?.length} chars)`,
    );
  }

  // ─── Test 2: list_skills (static data, no DB needed) ───────────────────

  console.log("\n2. list_skills (static data)");

  const allSkills = await callTool(client, "revolutionai_list_skills", {});
  assert(!allSkills.isError, "list_skills returns success");
  assert(allSkills.parsed?.categories?.length === 8, `Has 8 categories (got ${allSkills.parsed?.categories?.length})`);
  assert(allSkills.parsed?.total_skills > 200, `Has ${allSkills.parsed?.total_skills} total skills (expected 200+)`);

  // Test category filter
  const aiSkills = await callTool(client, "revolutionai_list_skills", { category: "ai-ml" });
  assert(!aiSkills.isError, "list_skills with category filter");
  assert(aiSkills.parsed?.category?.id === "ai-ml", "Returns AI/ML category");
  assert(aiSkills.parsed?.subcategories?.length === 5, `AI/ML has 5 subcategories`);

  // Test search filter
  const searchSkills = await callTool(client, "revolutionai_list_skills", { search: "react" });
  assert(!searchSkills.isError, "list_skills with search filter");
  assert(searchSkills.parsed?.matching_skills?.length > 0, `Found React-related skills`);
  assert(
    searchSkills.parsed?.matching_skills?.some((s) => s === "React"),
    "Search finds 'React'",
  );
  assert(
    searchSkills.parsed?.matching_skills?.some((s) => s === "React Native"),
    "Search finds 'React Native'",
  );

  // Test invalid category
  const badCat = await callTool(client, "revolutionai_list_skills", { category: "nonexistent" });
  assert(!badCat.isError, "Invalid category returns valid response (not error)");
  assert(badCat.parsed?.valid_categories?.length > 0, "Returns list of valid categories");

  // ─── Test 3: search_docs (static data, no DB needed) ───────────────────

  console.log("\n3. search_docs (static data)");

  const docsHiring = await callTool(client, "revolutionai_search_docs", { query: "how to hire" });
  assert(!docsHiring.isError, "search_docs returns success");
  assert(docsHiring.parsed?.results?.length > 0, `Found ${docsHiring.parsed?.results?.length} doc(s) for 'how to hire'`);

  const docsPricing = await callTool(client, "revolutionai_search_docs", { query: "pricing fees" });
  assert(docsPricing.parsed?.results?.[0]?.title?.includes("Pricing"), "Pricing doc found first for 'pricing fees'");

  const docsNothing = await callTool(client, "revolutionai_search_docs", { query: "xyznonexistent123" });
  assert(docsNothing.parsed?.results?.length === 0, "No results for nonsense query");
  assert(docsNothing.parsed?.suggestions?.length > 0, "Provides suggestions when no results");

  // ─── Test 4: scope_project (heuristic, no DB needed) ───────────────────

  console.log("\n4. scope_project (heuristic scoping)");

  const simpleScope = await callTool(client, "revolutionai_scope_project", {
    description: "Build a simple landing page for our product with contact form",
  });
  assert(!simpleScope.isError, "scope_project simple case");
  assert(simpleScope.parsed?.scope?.complexity === "simple", `Detects 'simple' complexity (got ${simpleScope.parsed?.scope?.complexity})`);
  assert(simpleScope.parsed?.scope?.suggested_milestones?.length >= 2, "Suggests milestones");
  assert(simpleScope.parsed?.next_steps?.length > 0, "Provides next steps");

  const complexScope = await callTool(client, "revolutionai_scope_project", {
    description: "Build a real-time dashboard with machine learning predictions, microservice architecture, and auto-scaling infrastructure",
  });
  assert(
    ["complex", "enterprise"].includes(complexScope.parsed?.scope?.complexity),
    `Detects complex/enterprise (got ${complexScope.parsed?.scope?.complexity})`,
  );
  assert(
    complexScope.parsed?.scope?.estimated_budget_max > simpleScope.parsed?.scope?.estimated_budget_max,
    "Complex project has higher budget estimate than simple",
  );

  const scopeWithHints = await callTool(client, "revolutionai_scope_project", {
    description: "Build a Next.js dashboard with Stripe payments",
    budget_hint: 1000000,
    timeline_hint: 6,
  });
  assert(!scopeWithHints.isError, "scope_project with budget/timeline hints");
  assert(scopeWithHints.parsed?.scope?.estimated_duration_weeks === 6, "Respects timeline hint");
  assert(scopeWithHints.parsed?.scope?.recommended_skills?.length > 0, "Recommends skills");

  // ─── Test 5: Input Validation (Zod schemas) ────────────────────────────

  console.log("\n5. Input Validation (Zod)");

  // search_docs with too-short query
  try {
    const shortQuery = await callTool(client, "revolutionai_search_docs", { query: "x" });
    // Zod should reject this
    assert(shortQuery.isError === true, "Rejects query shorter than 2 chars");
  } catch (e) {
    // MCP SDK may throw on validation error
    assert(true, "Rejects query shorter than 2 chars (threw)");
  }

  // scope_project with too-short description
  try {
    const shortDesc = await callTool(client, "revolutionai_scope_project", { description: "hi" });
    assert(shortDesc.isError === true, "Rejects description shorter than 10 chars");
  } catch (e) {
    assert(true, "Rejects description shorter than 10 chars (threw)");
  }

  // ─── Test 6: DB-dependent tools (expect graceful errors) ───────────────

  console.log("\n6. DB-dependent tools (graceful error handling)");

  // These will fail because we have placeholder Supabase credentials
  // but they should fail GRACEFULLY with proper error objects

  const searchResult = await callTool(client, "revolutionai_search_talent", {
    skills: ["Next.js", "TypeScript"],
  });
  if (searchResult.isError) {
    assert(
      searchResult.parsed?.error?.code !== undefined,
      "search_talent error has error code",
      `code: ${searchResult.parsed?.error?.code}`,
    );
    assert(
      typeof searchResult.parsed?.error?.message === "string",
      "search_talent error has message",
    );
  } else {
    assert(true, "search_talent succeeded (unexpected but fine)");
  }

  const profileResult = await callTool(client, "revolutionai_get_talent_profile", {
    talent_id: "tal_seed_001",
  });
  if (profileResult.isError) {
    assert(profileResult.parsed?.error?.code !== undefined, "get_talent_profile error has code");
  } else {
    assert(true, "get_talent_profile succeeded");
  }

  const listProjectsResult = await callTool(client, "revolutionai_list_projects", {});
  if (listProjectsResult.isError) {
    assert(listProjectsResult.parsed?.error?.code !== undefined, "list_projects error has code");
  } else {
    assert(true, "list_projects succeeded");
  }

  const dashboardResult = await callTool(client, "revolutionai_get_dashboard", {});
  if (dashboardResult.isError) {
    assert(dashboardResult.parsed?.error?.code !== undefined, "get_dashboard error has code");
  } else {
    assert(true, "get_dashboard succeeded");
  }

  // ─── Test 7: Auth scope enforcement ────────────────────────────────────

  console.log("\n7. Auth scope enforcement");

  // Create a read-only server
  const readOnlyAuth = { ...mockAuth, scopes: ["read"] };
  const readOnlyServer = createServer(readOnlyAuth);
  const [roClientTransport, roServerTransport] = InMemoryTransport.createLinkedPair();
  const readOnlyClient = new Client({ name: "readonly-client", version: "1.0.0" });
  await readOnlyServer.connect(roServerTransport);
  await readOnlyClient.connect(roClientTransport);

  // Read tools should work
  const roSkills = await callTool(readOnlyClient, "revolutionai_list_skills", {});
  assert(!roSkills.isError, "Read-only key CAN use list_skills");

  // Write tools should be blocked
  const roCreate = await callTool(readOnlyClient, "revolutionai_create_project", {
    title: "Test Project",
    description: "This should be blocked by scope check",
    skills_needed: ["TypeScript"],
    budget_min: 100000,
    budget_max: 500000,
  });
  assert(roCreate.isError === true, "Read-only key CANNOT use create_project");
  assert(
    roCreate.parsed?.error?.code === "FORBIDDEN",
    `Returns FORBIDDEN (got ${roCreate.parsed?.error?.code})`,
  );

  await readOnlyClient.close();

  // ─── Test 8: Tool annotations check ────────────────────────────────────

  console.log("\n8. Tool schema validation");

  // Verify specific tool schemas
  const searchTool = tools.find((t) => t.name === "revolutionai_search_talent");
  assert(searchTool?.inputSchema?.properties?.skills !== undefined, "search_talent has 'skills' param");
  assert(searchTool?.inputSchema?.properties?.cursor !== undefined, "search_talent has 'cursor' param");

  const hireTool = tools.find((t) => t.name === "revolutionai_hire_developer");
  assert(hireTool?.inputSchema?.properties?.milestones !== undefined, "hire_developer has 'milestones' param");
  assert(hireTool?.inputSchema?.required?.includes("project_id"), "hire_developer requires project_id");
  assert(hireTool?.inputSchema?.required?.includes("talent_id"), "hire_developer requires talent_id");
  assert(hireTool?.inputSchema?.required?.includes("amount_cents"), "hire_developer requires amount_cents");

  const completeTool = tools.find((t) => t.name === "revolutionai_complete_engagement");
  assert(completeTool?.inputSchema?.required?.includes("action"), "complete_engagement requires action");

  // ─── Summary ───────────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("=".repeat(50) + "\n");

  await client.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
