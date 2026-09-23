// Deterministic demo data. Every live tool falls back to this when its
// integration isn't configured, so the demo never dies on wifi or a missing key.
// Dates are relative to "now" so the demo stays fresh on any day.

export function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// InternPrep AI profile shape (edit freely for the demo).
export const studentProfile = {
  name: "Aarav Mehta",
  university: "IIT Bombay",
  degree: "B.Tech, Computer Science (3rd year)",
  cgpa: 8.6,
  location: "Mumbai, India",
  skills: ["TypeScript", "Next.js", "Python", "FastAPI", "Postgres", "LLM apps", "Financial modelling"],
  interests: ["AI agents", "fintech", "product management", "consulting case competitions"],
  projects: [
    { name: "CaseForge", summary: "Case-competition intelligence platform: case ingestion, industry research, milestone planning (Next.js, Prisma, Tavily)." },
    { name: "Opportunity OS", summary: "Opportunity discovery + matching for students with Telegram/email digests (Next.js, Supabase, n8n)." },
    { name: "InternPrep AI", summary: "AI interview-prep and resume platform with mock interviews and resume strategy reports (Next.js, FastAPI, Supabase)." },
  ],
  resumeHighlights: [
    "Built and shipped 3 full-stack AI products used by 500+ students",
    "Finalist, national case competition 2025",
    "Summer intern, fintech startup (backend, payments reconciliation)",
  ],
  preferences: { workHours: "10:00-22:00", deepWorkBlock: "90 min", notifyVia: "Telegram" },
};

export function opportunities() {
  return [
    {
      id: "opp-1",
      title: "AI Product Intern — Winter 2026",
      organization: "Razorpay",
      category: "internship",
      tags: ["product", "ai", "fintech"],
      eligibility: "Pre-final/final year B.Tech. Strong product sense.",
      deadline: daysFromNow(3, 23, 59).toISOString(),
      location: "Bangalore / Remote",
      compensation: "₹80,000/month",
      apply_url: "https://razorpay.com/jobs/",
    },
    {
      id: "opp-2",
      title: "Anthropic Student Builder Program",
      organization: "Anthropic",
      category: "fellowship",
      tags: ["ai agents", "llm", "open source"],
      eligibility: "University students building with Claude.",
      deadline: daysFromNow(5, 23, 59).toISOString(),
      location: "Remote",
      compensation: "API credits + mentorship",
      apply_url: "https://www.anthropic.com/",
    },
    {
      id: "opp-3",
      title: "McKinsey Business Analyst Internship",
      organization: "McKinsey & Company",
      category: "internship",
      tags: ["consulting", "strategy"],
      eligibility: "Pre-final year, CGPA 8+, case-interview ready.",
      deadline: daysFromNow(6, 18, 0).toISOString(),
      location: "Mumbai",
      compensation: "Competitive",
      apply_url: "https://www.mckinsey.com/careers",
    },
    {
      id: "opp-4",
      title: "Smart India Hackathon — FinTech Track",
      organization: "Govt. of India",
      category: "hackathon",
      tags: ["hackathon", "fintech", "python"],
      eligibility: "Teams of 6, any college.",
      deadline: daysFromNow(9, 23, 59).toISOString(),
      location: "Hybrid",
      compensation: "₹1,00,000 prize",
      apply_url: "https://sih.gov.in/",
    },
    {
      id: "opp-5",
      title: "Backend Engineering Intern",
      organization: "Zerodha",
      category: "internship",
      tags: ["backend", "go", "postgres", "fintech"],
      eligibility: "Pre-final year CS/IT. CGPA 7+.",
      deadline: daysFromNow(4, 23, 59).toISOString(),
      location: "Bangalore",
      compensation: "₹60,000/month",
      apply_url: "https://zerodha.com/careers",
    },
    {
      id: "opp-6",
      title: "Graphic Design Fellowship",
      organization: "Canva",
      category: "fellowship",
      tags: ["design", "illustration"],
      eligibility: "Design portfolio required.",
      deadline: daysFromNow(2, 23, 59).toISOString(),
      location: "Remote",
      compensation: "Stipend",
      apply_url: "https://www.canva.com/careers/",
    },
  ];
}

// CaseForge case library (subset).
export function caseLibrary() {
  return [
    {
      id: "case-quickcommerce",
      competition: "Inter-IIT Strategy Case Challenge",
      date: daysFromNow(3, 10, 0).toISOString(),
      company: "Zepto",
      industry: "Quick commerce (India)",
      problemStatement:
        "Zepto's contribution margin is negative in Tier-2 cities. Recommend a 12-month strategy to reach unit-economics breakeven outside metros without losing market share to Blinkit and Swiggy Instamart.",
      constraints: ["12-month horizon", "No additional dark-store capex beyond ₹150 Cr", "10-slide final deck", "15-minute presentation + 10-minute Q&A"],
      keyQuestions: [
        "What drives negative contribution margin in Tier-2: AOV, delivery cost, or dark-store utilisation?",
        "Which Tier-2 cities are worth defending vs exiting?",
        "What levers (private label, ads, subscription, category mix) move margin fastest?",
      ],
      suggestedFrameworks: ["Unit-economics tree", "City prioritisation matrix (demand density × competitive intensity)", "Lever sizing with sensitivity analysis"],
      dataNeeded: ["Average order value by city tier", "Dark-store utilisation benchmarks", "Competitor city footprints", "Ad revenue as % of GMV in q-commerce"],
    },
  ];
}

export function calendarEvents() {
  return [
    { title: "Data Structures lecture", start: daysFromNow(0, 11, 0).toISOString(), end: daysFromNow(0, 12, 30).toISOString() },
    { title: "Claude Build Day", start: daysFromNow(0, 17, 30).toISOString(), end: daysFromNow(0, 21, 0).toISOString() },
    { title: "Operating Systems lab", start: daysFromNow(1, 14, 0).toISOString(), end: daysFromNow(1, 17, 0).toISOString() },
    { title: "Finance club meeting", start: daysFromNow(1, 19, 0).toISOString(), end: daysFromNow(1, 20, 0).toISOString() },
    { title: "Mid-sem: Probability", start: daysFromNow(2, 10, 0).toISOString(), end: daysFromNow(2, 12, 0).toISOString() },
    { title: "Gym", start: daysFromNow(2, 18, 0).toISOString(), end: daysFromNow(2, 19, 0).toISOString() },
  ];
}

export function searchFixture(query: string) {
  const q = query.toLowerCase();
  if (q.includes("zepto") || q.includes("quick commerce") || q.includes("q-commerce")) {
    return {
      answer:
        "Indian quick commerce is a ~$6–7B GMV market led by Blinkit (~45%), Zepto (~29%) and Swiggy Instamart (~25%). Profitability hinges on dark-store throughput (>1,500 orders/day), AOV above ₹500, and high-margin revenue lines like ads (3–4% of GMV) and private labels.",
      results: [
        { title: "Quick commerce in India: the path to profitability", url: "https://www.redseer.com/", content: "Dark stores reach contribution breakeven at ~1,200–1,500 daily orders; AOV growth from ₹400 to ₹550 has been the key lever in 2025." },
        { title: "Zepto's Tier-2 expansion playbook", url: "https://inc42.com/", content: "Zepto has expanded to 40+ cities; Tier-2 order density remains 40–60% of metro levels." },
        { title: "Ads and private labels: q-commerce's margin engine", url: "https://economictimes.indiatimes.com/", content: "Ad income contributes 3–4% of GMV for leading players; private labels carry 10–15pp higher gross margin." },
      ],
    };
  }
  if (q.includes("hackathon") || q.includes("build day") || q.includes("agent")) {
    return {
      answer:
        "Winning hackathon demos show one end-to-end workflow working live, a clear user problem, and visible AI reasoning. Agent products stand out when they take real actions (calendar, messaging, browser) with human approval gates.",
      results: [
        { title: "What judges look for at AI hackathons", url: "https://devpost.com/", content: "Live working demo > slides. Clear problem, clear user, visible technical depth, and a memorable moment." },
        { title: "Building agents with Claude tool use", url: "https://docs.anthropic.com/", content: "Give Claude a small set of well-described tools; let it plan and call them; keep humans in the loop for consequential actions." },
      ],
    };
  }
  return {
    answer: `Summary of current sources for "${query}".`,
    results: [
      { title: `Overview: ${query}`, url: "https://en.wikipedia.org/", content: `Background and key concepts related to ${query}.` },
      { title: `Latest on ${query}`, url: "https://news.ycombinator.com/", content: `Recent discussion and developments on ${query}.` },
    ],
  };
}

export function githubFixture(query: string) {
  return [
    { name: "browser-use/browser-use", stars: 70000, description: "Make websites accessible for AI agents.", url: "https://github.com/browser-use/browser-use", license: "MIT", updated: daysFromNow(-1).toISOString() },
    { name: "modelcontextprotocol/servers", stars: 60000, description: "Model Context Protocol reference servers.", url: "https://github.com/modelcontextprotocol/servers", license: "MIT", updated: daysFromNow(-2).toISOString() },
    { name: "vercel/ai-chatbot", stars: 18000, description: "Full-featured Next.js AI chatbot template.", url: "https://github.com/vercel/ai-chatbot", license: "Apache-2.0", updated: daysFromNow(-3).toISOString() },
  ].map((r) => ({ ...r, matchedQuery: query }));
}
