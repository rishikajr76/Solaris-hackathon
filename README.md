🛡️ Sentinel-AG
Autonomous Agentic Code Governance & Review Framework
"Governing code at the speed of thought."

Sentinel-AG is a next-generation, AI-driven code governance platform that acts as an autonomous "Digital Lead Developer." It sits between developer contributions and the production branch, utilizing a Multi-Agent Orchestration model to ensure every Pull Request meets elite standards of security, performance, and architecture.

🚀 Core Features
Multi-Agent PR Analysis: Specialized AI Agents (Security, Performance, and Architecture) perform deep logic reasoning on incoming code changes using Gemini 1.5 Pro.

One-Click Automated Remediation: Beyond identifying bugs, Sentinel-AG provides ready-to-commit code fixes directly as GitHub comments.

Cognitive Load Mapping: Integrates Affective Computing principles to identify code "hotspots" that cause human developer fatigue and error.

Real-time Governance Dashboard: A high-fidelity, live-sync dashboard powered by Supabase Realtime for project leads to monitor repository health.

Privacy-First Architecture: Implements secure webhook validation and stateless processing to protect sensitive Intellectual Property.

🏗️ Technical Architecture
Sentinel-AG operates on a Perceive-Reason-Act (PRA) loop:

Perceive: Captures GitHub Webhook events via a Node.js orchestrator.

Reason: Dispatches context-aware agents to analyze the code "diff" against the entire repository context.

Act: Simultaneously posts feedback to GitHub and updates the Supabase global metrics.

The Stack
Frontend: React, Vite, Tailwind CSS, Framer Motion (Animations), Recharts (Analytics).

Backend: Node.js, TypeScript, Octokit (GitHub SDK).

AI: Google Gemini 1.5 Pro (via AI Studio).

Database: Supabase (PostgreSQL) with Realtime enabled.

## Project Structure

```
solaris-hackathon/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   ├── analysis/
│   │   ├── config/
│   │   ├── rag/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── webhooks/
│   │   └── index.ts
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
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
```
