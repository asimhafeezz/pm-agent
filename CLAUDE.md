# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Setup

Start PostgreSQL first (required by all services):
```bash
docker compose up -d
```

### Agent (Python/FastAPI)
```bash
cd agent
cp .env.example .env   # Set GROQ_API_KEY at minimum
uv sync
uv run python run.py   # Runs on port 8000
```

### API (NestJS)
```bash
cd api
npm install
npm run start:dev      # Runs on port 6000
```

### Integration Service (NestJS)
```bash
cd integration-service
npm install
npm run start:dev      # Runs on port 6001
```

### UI (React/Vite)
```bash
cd ui
npm install
npm run dev            # Runs on port 7001
```

## Commands

### TypeScript Services (`api/`, `integration-service/`)
- `npm run start:dev` — start in watch mode
- `npm run build` — compile TypeScript
- `npm run test` — run Jest unit tests
- `npm run test:e2e` — end-to-end tests
- `npm run lint` — ESLint with auto-fix
- `npm run format` — Prettier formatting

### UI (`ui/`)
- `npm run dev` — Vite dev server (port 7001)
- `npm run build` — TypeScript check + Vite build
- `npm run lint` — ESLint

### Agent (`agent/`)
- `uv run python run.py` — start the FastAPI server
- `uv sync` — install/sync dependencies from `pyproject.toml`

## Architecture

Microservices monorepo — four services communicate via HTTP:

```
UI (7001) ──→ API (6000) and Agent via proxy (6003→8000)
API (6000) ──→ Agent (8000) to trigger runs
Agent (8000) ──→ Integration Service (6001) for market data
Agent (8000) ──→ API (6000) to persist results
All services ──→ PostgreSQL + pgvector (5433)
```

**UI** proxies `/api/*` to the API service and `/agent/*` to the Agent service (configured in `ui/vite.config.ts`).

**API** creates an `AgentRun` record and fires an async HTTP request to the Agent when a user submits a message. It also handles authentication (Auth0 + JWT) and owns the PostgreSQL schema.

**Agent** runs a LangGraph state machine: fetches market data from the Integration Service, calls Groq for LLM inference, and posts final results back to the API. Mem0 (semantic memory via pgvector + Ollama embeddings) and Tavily (web search) are optional — the agent degrades gracefully if they are unavailable.

**Integration Service** is a thin NestJS wrapper over three external financial APIs, all exposed under the `/integration/tools/` prefix:
- TwelveData — market prices and time series
- Financial Modeling Prep (FMP) — fundamentals, earnings, analyst estimates
- NewsData.io — market news

### Agent LangGraph Pipeline

Nodes run in sequence (`agent/app/graph/builder.py`):
```
load_user → search_memories → parse_intent → generate_answer → store_memories → persist
```
State is typed as `AgentState` in `agent/app/schemas.py`. Each node receives and returns the full state dict.

### API Data Model

```
User (1) ──→ (N) Conversation (1) ──→ (N) Message
                           └──→ (N) AgentRun (1) ──→ (N) ToolCall
                                                └──→ (N) AgentRunEvent
```

Entity files live under `api/src/*/entities/`.

## Environment Variables

### Agent (`agent/.env`)

| Variable | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | Yes | LLM inference |
| `GROQ_MODEL` | No | Default: `openai/gpt-oss-120b` |
| `INTEGRATION_BASE_URL` | No | Default: `http://localhost:3001/integration` |
| `APP_API_BASE_URL` | No | Default: `http://localhost:3000/api` |
| `OLLAMA_BASE_URL` | No | Embeddings for Mem0; default: `http://localhost:11434` |
| `TAVILY_API_KEY` | No | Enables web search |
| `PG_HOST/PORT/USER/PASSWORD/DB` | No | PostgreSQL for Mem0 memory storage |

### Integration Service (`integration-service/.env`)

| Variable | Required | Notes |
|---|---|---|
| `FMP_API_KEY` | Yes | Financial Modeling Prep |
| `TWELVEDATA_API_KEY` | Yes | Market prices |
| `NEWSDATA_API_KEY` | Yes | News aggregation |

### API (`api/.env`)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Token signing |
| `AGENT_BASE_URL` | No | Default: `http://localhost:8000` |
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Yes | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Yes | Auth0 application client secret |
