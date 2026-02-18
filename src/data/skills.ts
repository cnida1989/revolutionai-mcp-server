/**
 * Skill taxonomy — copied from revolutionai/lib/skills.ts with icon fields stripped.
 * 300+ skills across 8 major categories.
 */

export interface MinorCategory {
  id: string;
  name: string;
  skills: string[];
}

export interface MajorCategory {
  id: string;
  name: string;
  description: string;
  minorCategories: MinorCategory[];
}

export const skillCategories: MajorCategory[] = [
  {
    id: "ai-ml",
    name: "AI & Machine Learning",
    description: "Artificial intelligence and machine learning technologies",
    minorCategories: [
      { id: "core-ml", name: "Core ML", skills: ["Machine Learning", "Deep Learning", "Neural Networks", "Statistical Modeling"] },
      { id: "specializations", name: "Specializations", skills: ["Natural Language Processing", "Computer Vision", "Reinforcement Learning", "Speech Recognition", "Recommender Systems"] },
      { id: "llms", name: "LLMs & Generative AI", skills: ["LLMs & GPT", "Prompt Engineering", "Fine-tuning", "RAG Systems", "AI Agents"] },
      { id: "ml-frameworks", name: "Frameworks & Tools", skills: ["TensorFlow", "PyTorch", "Scikit-learn", "Hugging Face", "JAX", "Keras"] },
      { id: "mlops", name: "MLOps", skills: ["Model Deployment", "Model Monitoring", "Feature Stores", "ML Pipelines", "Experiment Tracking"] },
    ],
  },
  {
    id: "software-dev",
    name: "Software Development",
    description: "Programming languages and development frameworks",
    minorCategories: [
      { id: "languages", name: "Languages", skills: ["Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin"] },
      { id: "frontend", name: "Frontend", skills: ["React", "Vue.js", "Angular", "Next.js", "Svelte", "HTML/CSS", "Tailwind CSS", "Redux"] },
      { id: "backend", name: "Backend", skills: ["Node.js", "Django", "FastAPI", "Express.js", "Spring Boot", "Ruby on Rails", ".NET"] },
      { id: "apis", name: "APIs & Integration", skills: ["REST APIs", "GraphQL", "gRPC", "WebSockets", "OAuth", "API Design"] },
      { id: "mobile", name: "Mobile", skills: ["React Native", "Flutter", "iOS Development", "Android Development", "Cross-platform"] },
    ],
  },
  {
    id: "cloud-infra",
    name: "Cloud & Infrastructure",
    description: "Cloud platforms and infrastructure management",
    minorCategories: [
      { id: "cloud-platforms", name: "Cloud Platforms", skills: ["AWS", "Google Cloud", "Azure", "DigitalOcean", "Heroku", "Vercel"] },
      { id: "containers", name: "Containers & Orchestration", skills: ["Docker", "Kubernetes", "Helm", "Container Registry", "Service Mesh"] },
      { id: "iac", name: "Infrastructure as Code", skills: ["Terraform", "Pulumi", "CloudFormation", "Ansible", "Chef"] },
      { id: "devops", name: "DevOps & CI/CD", skills: ["CI/CD Pipelines", "GitHub Actions", "Jenkins", "GitLab CI", "ArgoCD"] },
      { id: "networking", name: "Networking & Systems", skills: ["Linux", "Networking", "Load Balancing", "DNS", "CDN", "Serverless"] },
    ],
  },
  {
    id: "data",
    name: "Data Engineering & Analytics",
    description: "Data pipelines, analytics, and business intelligence",
    minorCategories: [
      { id: "databases", name: "Databases", skills: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Neo4j", "DynamoDB"] },
      { id: "data-processing", name: "Data Processing", skills: ["Apache Spark", "Apache Kafka", "Apache Flink", "Airflow", "dbt", "ETL Pipelines"] },
      { id: "data-warehousing", name: "Data Warehousing", skills: ["Snowflake", "BigQuery", "Redshift", "Databricks", "Data Modeling"] },
      { id: "analytics-bi", name: "Analytics & BI", skills: ["SQL", "Power BI", "Tableau", "Looker", "Metabase", "Data Visualization"] },
    ],
  },
  {
    id: "design",
    name: "Design",
    description: "Visual design, user experience, and creative work",
    minorCategories: [
      { id: "ux-design", name: "UX Design", skills: ["User Research", "Usability Testing", "Information Architecture", "User Flows", "Personas"] },
      { id: "ui-design", name: "UI Design", skills: ["UI Design", "Visual Design", "Design Systems", "Responsive Design", "Accessibility"] },
      { id: "design-tools", name: "Design Tools", skills: ["Figma", "Adobe XD", "Sketch", "Adobe Photoshop", "Adobe Illustrator", "InVision"] },
      { id: "prototyping", name: "Prototyping & Interaction", skills: ["Prototyping", "Wireframing", "Interaction Design", "Motion Design", "Micro-interactions"] },
      { id: "brand-design", name: "Brand & Creative", skills: ["Brand Design", "Logo Design", "Typography", "Color Theory", "Graphic Design"] },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Digital marketing, growth, and brand building",
    minorCategories: [
      { id: "content", name: "Content Marketing", skills: ["Content Strategy", "Copywriting", "Blog Writing", "Video Content", "Podcasting"] },
      { id: "seo-sem", name: "SEO & SEM", skills: ["SEO", "SEM / PPC", "Google Ads", "Keyword Research", "Link Building"] },
      { id: "social", name: "Social & Community", skills: ["Social Media Marketing", "Community Management", "Influencer Marketing", "LinkedIn Marketing"] },
      { id: "growth", name: "Growth & Analytics", skills: ["Growth Hacking", "Marketing Analytics", "Google Analytics", "A/B Testing", "Conversion Optimization"] },
      { id: "automation", name: "Marketing Automation", skills: ["Email Marketing", "Marketing Automation", "CRM", "Lead Generation", "Funnel Optimization"] },
    ],
  },
  {
    id: "business",
    name: "Business & Strategy",
    description: "Business operations, strategy, and management",
    minorCategories: [
      { id: "product", name: "Product Management", skills: ["Product Strategy", "Roadmap Planning", "User Stories", "Feature Prioritization", "Product Analytics"] },
      { id: "project", name: "Project Management", skills: ["Project Planning", "Agile / Scrum", "Kanban", "Resource Management", "Risk Management"] },
      { id: "strategy", name: "Strategy & Analysis", skills: ["Business Analysis", "Strategic Planning", "Market Research", "Competitive Analysis", "SWOT Analysis"] },
      { id: "operations", name: "Operations", skills: ["Process Optimization", "Change Management", "Vendor Management", "Quality Assurance", "Documentation"] },
      { id: "finance", name: "Finance & Metrics", skills: ["Financial Modeling", "Budgeting", "OKRs & KPIs", "Unit Economics", "Forecasting"] },
    ],
  },
  {
    id: "security",
    name: "Security & Compliance",
    description: "Cybersecurity, compliance, and risk management",
    minorCategories: [
      { id: "appsec", name: "Application Security", skills: ["OWASP", "Secure Coding", "Code Review", "Vulnerability Assessment", "Penetration Testing"] },
      { id: "infra-sec", name: "Infrastructure Security", skills: ["Network Security", "Cloud Security", "Identity Management", "Encryption", "Zero Trust"] },
      { id: "mlsec", name: "AI/ML Security", skills: ["MLSecOps", "Model Security", "Adversarial ML", "AI Governance", "Responsible AI"] },
      { id: "compliance", name: "Compliance & Governance", skills: ["SOC 2", "GDPR", "HIPAA", "ISO 27001", "PCI DSS", "Risk Assessment"] },
      { id: "incident", name: "Security Operations", skills: ["Incident Response", "Security Monitoring", "Threat Detection", "Forensics", "Security Auditing"] },
    ],
  },
];

/** Get all skills as a flat array */
export function getAllSkills(): string[] {
  return skillCategories.flatMap((major) =>
    major.minorCategories.flatMap((minor) => minor.skills),
  );
}

/** Find major and minor category for a skill */
export function getCategoriesForSkill(
  skill: string,
): { major: MajorCategory; minor: MinorCategory } | undefined {
  for (const major of skillCategories) {
    for (const minor of major.minorCategories) {
      if (minor.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
        return { major, minor };
      }
    }
  }
  return undefined;
}
