/**
 * Static documentation content for the search_docs tool.
 * Allows developers to query platform docs from Claude Code.
 */

export interface DocEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
}

export const docs: DocEntry[] = [
  {
    id: "getting-started",
    title: "Getting Started with revolutionAI MCP",
    category: "Setup",
    content: `# Getting Started

1. Get your API key at https://revolutionai.io/settings/api-keys
2. Add to your Claude Code config:
   {
     "mcpServers": {
       "revolutionai": {
         "command": "npx",
         "args": ["@revolutionai/mcp-server"],
         "env": { "REVOLUTIONAI_API_KEY": "rai_your_key" }
       }
     }
   }
3. Restart Claude Code
4. Try: "search for a Next.js developer"`,
    keywords: ["setup", "install", "getting started", "configuration", "api key"],
  },
  {
    id: "hiring-flow",
    title: "Hiring Flow Overview",
    category: "Guides",
    content: `# Hiring Flow

1. **Search**: Use search_talent to find developers by skills, budget, availability
2. **Scope**: Use scope_project to get AI-estimated budget and timeline
3. **Create**: Use create_project to post your hiring request
4. **Match**: Use get_matches to get AI-ranked developer matches
5. **Hire**: Use hire_developer to create a contract with milestones
6. **Complete**: Use complete_engagement to approve milestones and release payment

Payments are held in escrow via Stripe. Developers receive 90% (10% platform fee).`,
    keywords: ["hiring", "flow", "process", "steps", "how to hire"],
  },
  {
    id: "pricing",
    title: "Pricing & Fees",
    category: "Billing",
    content: `# Pricing

- **Platform fee**: 10% (vs 20-30% on other platforms)
- **Developer receives**: 90% of project cost
- **Payment**: Milestone-based via Stripe
- **Escrow**: Funds held until milestone approved
- **Refunds**: Available for disputed milestones

No subscription required. Pay per project.`,
    keywords: ["pricing", "fees", "cost", "payment", "escrow", "refund"],
  },
  {
    id: "api-keys",
    title: "API Key Management",
    category: "Auth",
    content: `# API Keys

- Keys use the \`rai_\` prefix format
- Scopes: \`read\` (search, browse) and \`write\` (create projects, hire)
- Keys can be rotated at https://revolutionai.io/settings/api-keys
- Never share your API key or commit it to source control
- Use environment variables: REVOLUTIONAI_API_KEY`,
    keywords: ["api key", "authentication", "auth", "security", "scopes"],
  },
  {
    id: "matching",
    title: "How Matching Works",
    category: "Guides",
    content: `# Matching Algorithm

Our AI matching engine scores developers across 5 dimensions:

1. **Skills Match (40%)**: Overlap between your required skills and developer's skills
2. **Rate Fit (20%)**: How well their rate fits your budget
3. **Availability (15%)**: Current availability and hours per week
4. **Rating (15%)**: Average rating from past projects
5. **Experience (10%)**: Years of experience and completed projects

Developers need ≥60% skill overlap to be considered. Results are ranked by composite score.`,
    keywords: ["matching", "algorithm", "scoring", "skills", "ranking"],
  },
  {
    id: "milestones",
    title: "Working with Milestones",
    category: "Guides",
    content: `# Milestones

Each contract is broken into milestones:

- **pending**: Not yet started
- **in_progress**: Developer is working on it
- **submitted**: Developer submitted for review
- **approved**: You approved — payment released to developer
- **revision_requested**: You requested changes
- **disputed**: Escalated for mediation

Use complete_engagement with action: "approve" | "revision" | "dispute"`,
    keywords: ["milestones", "approval", "revision", "dispute", "status"],
  },
  {
    id: "skills-list",
    title: "Available Skills",
    category: "Reference",
    content: `# Skills Taxonomy

300+ skills across 8 categories:

- **AI & Machine Learning**: ML, NLP, Computer Vision, LLMs, MLOps
- **Software Development**: Python, TypeScript, React, Next.js, Node.js
- **Cloud & Infrastructure**: AWS, Docker, Kubernetes, Terraform
- **Data Engineering**: PostgreSQL, Spark, Kafka, dbt
- **Design**: UX, UI, Figma, Prototyping
- **Marketing**: SEO, Content, Growth, Analytics
- **Business & Strategy**: Product Management, Agile, Analysis
- **Security & Compliance**: OWASP, Cloud Security, SOC 2

Use list_skills to browse the full taxonomy.`,
    keywords: ["skills", "categories", "taxonomy", "list"],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    category: "Support",
    content: `# Troubleshooting

**"Invalid API key"**: Check REVOLUTIONAI_API_KEY is set correctly. Keys start with rai_.
**"Forbidden"**: Your key may not have write scope. Check at revolutionai.io/settings.
**"Not found"**: The resource ID may be invalid. Use list tools to find valid IDs.
**"Rate limited"**: Free tier: 100 req/hr. Pro: 1000. Enterprise: unlimited.
**Connection issues**: Ensure SUPABASE_URL and SUPABASE_SECRET_KEY are set.

Contact support: hello@revolutionai.io`,
    keywords: ["troubleshooting", "error", "help", "support", "debug"],
  },
];

/** Simple text search across docs */
export function searchDocs(query: string): DocEntry[] {
  const terms = query.toLowerCase().split(/\s+/);
  return docs
    .map((doc) => {
      const text = `${doc.title} ${doc.content} ${doc.keywords.join(" ")}`.toLowerCase();
      const matchCount = terms.filter((term) => text.includes(term)).length;
      return { doc, matchCount };
    })
    .filter(({ matchCount }) => matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .map(({ doc }) => doc);
}
