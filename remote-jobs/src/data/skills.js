// User Skill Graph — seeded from the user's capability profile (see master prompt §1 and §15).
// Levels: 1=foundational, 2=working, 3=proficient, 4=expert, 5=distinctive.
// market_demand 0-100 and avg_comp are ESTIMATES updated by the Market Agent as data is observed.
// They are labelled "model estimate" in the UI, never presented as verified facts.

export const defaultSkills = [
  // Architecture / Built Environment
  { id: 'arch-design', name: 'Architectural design', category: 'AEC', level: 4, keywords: ['architect', 'architecture', 'architectural design', 'concept design', 'residential design', 'commercial design'], market_demand: 70 },
  { id: 'development-planning', name: 'Development planning & feasibility', category: 'AEC', level: 3, keywords: ['development planning', 'site analysis', 'feasibility', 'development feasibility', 'property development', 'masterplan'], market_demand: 72 },
  { id: 'archicad', name: 'ArchiCAD / BIM', category: 'AEC', level: 4, keywords: ['archicad', 'bim', 'building information modeling', 'building information modelling', 'vdc', '5d bim', 'digital twin', 'digital construction'], market_demand: 78 },
  { id: '3d-viz', name: '3D modelling & visualization', category: 'AEC', level: 4, keywords: ['3d model', '3d modelling', '3d modeling', 'visualization', 'visualisation', 'rendering', 'twinmotion', 'sketchup', 'real estate visualization', 'archviz', 'architectural visualization'], market_demand: 75 },
  { id: 'doc-and-cost', name: 'Construction documentation & cost intelligence', category: 'AEC', level: 3, keywords: ['construction documentation', 'working drawings', 'cost analysis', 'cost estimation', 'cost intelligence', 'building cost', 'quantity survey', 'bills of quantities'], market_demand: 70 },
  { id: 'construction-tech', name: 'Construction technology / AEC tech', category: 'AEC', level: 3, keywords: ['construction technology', 'contech', 'proptech', 'digital twin', 'smart buildings', 'aec technology'], market_demand: 68 },

  // Digital / Technology
  { id: 'wordpress', name: 'WordPress development', category: 'Technology', level: 3, keywords: ['wordpress', 'gutenberg', 'kadence', 'wp theme', 'wp plugin', 'elementor', 'website development'], market_demand: 82 },
  { id: 'web-dev', name: 'Web development / web apps', category: 'Technology', level: 3, keywords: ['web development', 'web developer', 'frontend', 'backend', 'full stack', 'react', 'next js', 'html', 'css'], market_demand: 85 },
  { id: 'no-code', name: 'No-code / low-code development', category: 'Technology', level: 3, keywords: ['no code', 'nocode', 'low code', 'bubble', 'retool', 'airtable', 'zapier', 'make.com', 'glide'], market_demand: 80 },
  { id: 'ai-automation', name: 'AI automation / AI agents / workflows', category: 'Technology', level: 4, keywords: ['ai automation', 'ai agent', 'ai agents', 'agentic', 'workflow', 'n8n', 'automation', 'prompt engineering', 'ai workflow', 'chatbot', 'llm integration', 'rag'], market_demand: 92 },
  { id: 'ai-research', name: 'AI research & evaluation', category: 'Technology', level: 3, keywords: ['ai research', 'ai evaluation', 'model evaluation', 'llm evaluation', 'ai trainer', 'ai training', 'rlhf', 'prompt evaluator', 'search evaluator'], market_demand: 88 },
  { id: 'apis', name: 'API concepts & integrations', category: 'Technology', level: 3, keywords: ['api', 'apis', 'api integration', 'openai', 'saas', 'webhook'], market_demand: 84 },
  { id: 'data', name: 'Data organization & business intelligence', category: 'Technology', level: 3, keywords: ['data entry', 'data organization', 'business intelligence', 'data analysis', 'spreadsheet', 'excel', 'google sheets', 'analytics', 'data cleaning'], market_demand: 78 },
  { id: 'technical-writing', name: 'Technical & documentation writing', category: 'Communication', level: 3, keywords: ['technical writing', 'documentation', 'technical writer', 'api documentation'], market_demand: 74 },
  { id: 'qa', name: 'QA / testing', category: 'Technology', level: 2, keywords: ['qa', 'quality assurance', 'testing', 'manual testing', 'bug', 'uat'], market_demand: 76 },

  // Business
  { id: 'business-dev', name: 'Business development & sales', category: 'Business', level: 3, keywords: ['business development', 'sales', 'lead generation', 'bdr', 'sdr', 'appointment setting'], market_demand: 80 },
  { id: 'market-research', name: 'Market & opportunity research', category: 'Business', level: 4, keywords: ['market research', 'opportunity research', 'competitive analysis', 'product research', 'investor research', 'due diligence', 'market intelligence'], market_demand: 78 },
  { id: 'strategy', name: 'Business strategy & consulting', category: 'Business', level: 3, keywords: ['business strategy', 'consulting', 'consultant', 'advisory', 'digital transformation', 'growth strategy'], market_demand: 76 },
  { id: 'proposals', name: 'Proposal & grant writing', category: 'Business', level: 3, keywords: ['proposal', 'grant writing', 'fundraising', 'tender', 'bid', 'concept note', 'donor'], market_demand: 74 },
  { id: 'product-dev', name: 'Product development', category: 'Business', level: 3, keywords: ['product development', 'product manager', 'saas concept', 'digital product', 'mvp'], market_demand: 78 },

  // Creative
  { id: 'writing', name: 'Writing & content', category: 'Creative', level: 3, keywords: ['writing', 'content writing', 'copywriting', 'blog', 'article', 'ghostwriting', 'storytelling'], market_demand: 76 },
  { id: 'content-dev', name: 'Content & course creation', category: 'Creative', level: 3, keywords: ['course creation', 'educational content', 'online course', 'teaching', 'tutoring', 'lesson plan', 'curriculum'], market_demand: 70 },
  { id: 'graphic', name: 'Graphic / visual design', category: 'Creative', level: 3, keywords: ['graphic design', 'visual design', 'design thinking', 'figma', 'adobe', 'brand identity'], market_demand: 74 },
  { id: 'social-content', name: 'Social media & community management', category: 'Creative', level: 3, keywords: ['social media', 'community management', 'community manager', 'content moderation', 'moderator', 'online community'], market_demand: 72 },

  // Research / knowledge
  { id: 'web-research', name: 'Web research', category: 'Research', level: 4, keywords: ['web research', 'research assistant', 'research analyst', 'online research', 'lead research'], market_demand: 80 },
  { id: 'africa-market', name: 'Ghana / Africa market specialist', category: 'Research', level: 4, keywords: ['ghana', 'africa', 'african market', 'west africa', 'market entry africa', 'africa consultant'], market_demand: 72 },
  { id: 'policy-research', name: 'Policy & document research', category: 'Research', level: 3, keywords: ['policy research', 'policy analysis', 'document review', 'development policy', 'regulatory'], market_demand: 66 },

  // Service / any-task mode
  { id: 'virtual-assist', name: 'Virtual assistance', category: 'Service', level: 3, keywords: ['virtual assistant', 'executive assistant', 'administrative', 'personal assistant', 'data entry', 'calendar', 'inbox'], market_demand: 84 },
  { id: 'customer-support', name: 'Customer support', category: 'Service', level: 3, keywords: ['customer support', 'customer service', 'support agent', 'live chat', 'helpdesk', 'csr'], market_demand: 86 },
  { id: 'transcription', name: 'Transcription & translation', category: 'Service', level: 2, keywords: ['transcription', 'transcribe', 'translation', 'subtitle', 'captioning'], market_demand: 76 },
];

export const defaultPortfolio = [
  { id: 'p-bim-5d', title: 'BIM / 5D construction cost case study', skills: ['archicad', 'doc-and-cost', 'construction-tech'], industry: 'AEC', problem: 'Own a combined BIM + cost-intelligence story that proves 5D capability.', outcome: 'Reusable case study that unblocks multiple AEC-consulting opportunity categories.', categories: ['AEC', 'Consulting', 'Freelance'] },
  { id: 'p-archicad-viz', title: 'ArchiCAD 3D visualization portfolio', skills: ['archicad', '3d-viz'], industry: 'AEC', problem: 'Demonstrate end-to-end from ArchiCAD model to Twinmotion/SketchUp marketing renders.', outcome: 'Strongest evidence for rendering/visualization gigs.', categories: ['Freelance', 'AEC'] },
  { id: 'p-wordpress-ai', title: 'AI-automated WordPress build', skills: ['wordpress', 'ai-automation', 'web-dev'], industry: 'Web', problem: 'Show a site that uses AI (chat, workflow, automation) beyond a static theme.', outcome: 'Evidence for AI + WordPress service packaging.', categories: ['Freelance', 'Technology'] },
  { id: 'p-ghana-market', title: 'Ghana market intelligence brief', skills: ['africa-market', 'market-research', 'web-research'], industry: 'Research', problem: 'Produce a dated Ghana/Africa market brief with sources.', outcome: 'Portfolio for market-entry consulting and expert-network profiles.', categories: ['Consulting', 'Expert Networks', 'Research'] },
  { id: 'p-ai-eval', title: 'LLM evaluation / prompt-engineering sample pack', skills: ['ai-research', 'ai-automation'], industry: 'AI', problem: 'Collect graded prompt/evaluation samples with reasoning.', outcome: 'Required evidence for most AI-training platforms.', categories: ['AI Economy', 'Technology'] },
  { id: 'p-proposal', title: 'Development-sector proposal sample', skills: ['proposals', 'writing'], industry: 'Development', problem: 'One donor-facing concept note + budget.', outcome: 'Evidence for proposal/grants work and UN/NGO roles.', categories: ['Development', 'Consulting'] },
];

export function getKeywordsForIds(skills) {
  const map = new Map(defaultSkills.map((s) => [s.id, s]));
  return skills.map((id) => (map.get(id) ? map.get(id).keywords : [])).flat();
}