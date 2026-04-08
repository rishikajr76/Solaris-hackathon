🛡️ Sentinel-AG

Autonomous Agentic Code Governance & Review Framework – "Governing code at the speed of thought."

Sentinel-AG is a next-generation AI-driven code governance platform that acts as an autonomous Digital Lead Developer. Sitting between developer contributions and the production branch, it uses a Multi-Agent Orchestration model to ensure every Pull Request meets elite standards of security, performance, and architecture.

🚀 Core Features
Multi-Agent PR Analysis
Specialized AI agents (Security, Performance, Architecture) perform deep reasoning on incoming code changes using Gemini 1.5 Pro.
One-Click Automated Remediation
Beyond identifying issues, Sentinel-AG provides ready-to-commit code fixes directly as GitHub suggestions.
Cognitive Load Mapping
Integrates affective computing principles to identify code "hotspots" that increase developer fatigue and error risk.
Real-time Governance Dashboard
High-fidelity, live-sync dashboard powered by Supabase Realtime for project leads to monitor repository health.
Privacy-First Architecture
Secure webhook validation and stateless processing protect sensitive intellectual property.
🏗️ Technical Architecture

Sentinel-AG operates on a Perceive-Reason-Act (PRA) loop:

Perceive: Captures GitHub Webhook events via a Node.js orchestrator.
Reason: Dispatches context-aware agents to analyze the code diff against the repository context.
Act: Posts feedback to GitHub and updates global metrics in Supabase.
Tech Stack
Layer	Tools & Frameworks
Frontend	React, Vite, Tailwind CSS, Framer Motion, Recharts
Backend	Node.js, TypeScript, Octokit (GitHub SDK)
AI	Google Gemini 1.5 Pro (via AI Studio)
Database	Supabase (PostgreSQL) with Realtime
📂 Project Structure
solaris-hackathon/
├── backend/
│   ├── src/
│   │   ├── agents/       # Multi-agent orchestration logic
│   │   ├── analysis/     # Security, Performance, Architecture analysis
│   │   ├── config/       # Environment & configuration files
│   │   ├── rag/          # Repository Retrieval-Augmented Generation logic
│   │   ├── services/     # Supabase, GitHub, and other services
│   │   ├── types/        # TypeScript type definitions
│   │   ├── utils/        # Helper utilities
│   │   ├── webhooks/     # GitHub webhook handlers
│   │   └── index.ts      # Backend entry point
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/   # React UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Supabase client & libraries
│   │   ├── pages/        # Page components
│   │   ├── styles/       # Tailwind CSS and custom styles
│   │   ├── App.tsx       # Main React component
│   │   ├── main.tsx      # React entry point
│   │   └── vite-env.d.ts # Vite environment typings
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── .gitignore
├── LICENSE
└── package.json
⚡ Highlights
Seamless GitHub Integration: Inline suggestions and summaries directly in PRs.
AI-Powered Multi-Agent Governance: Security, Performance, and Architecture agents work together.
Realtime Metrics: Track cognitive complexity, technical debt prevented, and reviewer hours saved.
