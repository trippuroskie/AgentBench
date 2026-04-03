# AgentBench

A browser-based AI agent benchmarking tool for comparing local models' tool-calling and goal-completion capabilities.

Test how well different LLMs handle multi-step agent tasks — calling tools, navigating grids, solving problems — and compare them on metrics like success rate, speed, token usage, and trajectory efficiency.

## Features

### Core
- **Agent Harness** — TypeScript tool-calling loop: call model, parse tool_calls, execute tools, feed results back, repeat
- **Multi-Provider LLM Support** — Run benchmarks against local Ollama models and cloud models via OpenRouter (Claude, GPT-4, Gemini, etc.) in the same benchmark
- **Parallel Benchmark Execution** — Configurable concurrency limit (1-10) to run multiple benchmark items simultaneously
- **Model Parameter Tuning** — Configure temperature, top_p, top_k, repeat penalty, and seed per benchmark run

### Tools
- **5 Built-in Tools** — Calculator, search, weather, grid move, grid look
- **Custom Template Tools** — Static response templates with `{{param}}` substitution
- **HTTP API Tools** — Make real HTTP requests to external APIs (e.g., wttr.in weather, DuckDuckGo search) with configurable method, URL, headers, and body templates
- **JavaScript Tools** — Write custom JS function bodies that execute in the browser
- **Example Tool Prefills** — One-click setup for real weather API and web search tools

### Tasks & Scoring
- **7 Built-in Tasks** — Multi-step math, fact lookup, weather comparison, unit conversion, grid navigation (easy/medium)
- **Custom Tasks** — Create deterministic or open-ended tasks with configurable prompts, tools, scoring, and expected answers
- **Milestone-Based Scoring** — Partial credit scoring that checks tool usage, intermediate results, and answer proximity
- **Scoring Methods** — Exact match, contains check, trajectory efficiency (grid nav), LLM-as-judge (optional)

### Analysis & Visualization
- **Statistical Analysis** — Mean, std dev, min/max, 95% confidence intervals across multiple iterations
- **Dashboard & Leaderboard** — Charts, model rankings with +/- std dev, sortable results with filters
- **Side-by-Side Compare** — Radar chart + metrics table (with statistical aggregation) for up to 4 models
- **Statistical Summary** — Auto-generated stats tables in Results view for groups with multiple runs
- **Live Benchmark Monitor** — Full-screen dashboard with real-time step feed, token counters, queue progress, and live grid visualization
- **Grid Navigation Visualizer** — Animated playback of agent pathfinding with optimal path overlay
- **Agent Trace Viewer** — Step-by-step execution log with tool calls and results

### Infrastructure
- **SQLite In-Browser** — Persistent storage via sql.js + IndexedDB
- **Model Pulling** — Pull Ollama models directly from the UI with progress tracking
- **OpenRouter Cloud Models** — Add cloud models with per-token pricing for cost tracking
- **Langfuse Tracing** — Optional self-hosted tracing via REST API
- **LLM-as-Judge** — Optional scoring via Ollama (local) or OpenRouter (cloud)

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS (CDN) + Font Awesome
- Recharts for visualization
- sql.js for in-browser SQLite
- Ollama for local model inference (native `/api/chat` endpoint)
- OpenRouter for cloud model inference (OpenAI-compatible API)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.com/) installed and running

### 1. Set up Ollama CORS (one-time)

```bash
# macOS
launchctl setenv OLLAMA_ORIGINS "*"
# Then restart Ollama (quit and reopen, or: brew services restart ollama)
```

### 2. Pull models

```bash
ollama pull llama3.2      # 3B, fast
ollama pull qwen3          # 8B, good tool calling
ollama pull gemma4         # 27B, strong performance
```

Any model with tool/function-calling support works.

### 3. Install and run

```bash
git clone https://github.com/trippuroskie/AgentBench.git
cd AgentBench
npm install
npm run dev
```

Open http://localhost:5173

### 4. Run your first benchmark

1. Check the sidebar — Ollama status should show **Connected** (green dot)
2. Go to **Models** — your pulled models appear automatically (or use **Pull Model** to download new ones)
3. Go to **Tools** — view built-in tools or create custom ones for your tasks
4. Go to **Tasks** — view built-in tasks or create custom ones with your tools
5. Go to **Run Benchmark** — select tasks and models, hit **Launch**
6. Watch the live monitor as agents execute
7. View results in **Results**, rankings in **Leaderboard**, comparisons in **Compare**

## Optional Integrations

### Langfuse (Tracing)

Self-host [Langfuse](https://langfuse.com/) and configure in **Settings**:
- Host URL, Public Key, Secret Key
- Each benchmark run creates traces with per-step spans and generations

### OpenRouter (Cloud Models + LLM-as-Judge)

Add your [OpenRouter](https://openrouter.ai/) API key in **Settings** to:
- **Benchmark cloud models** — Add models like `anthropic/claude-sonnet-4-20250514` or `openai/gpt-4o` via the Models page and run them alongside local Ollama models
- **LLM-as-Judge** — Use cloud frontier models as judges for open-ended task scoring

## Configuration

Copy `.env.example` to `.env.local` and fill in optional values:

```bash
cp .env.example .env.local
```

| Variable | Description | Required |
|---|---|---|
| `OLLAMA_BASE_URL` | Ollama API URL (default: `http://localhost:11434`) | No |
| `OPENROUTER_API_KEY` | OpenRouter key for LLM-as-judge | No |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key | No |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key | No |
| `LANGFUSE_HOST` | Langfuse host URL | No |

## Project Structure

```
src/
├── agent/           # Core agent loop, tools (template/HTTP/JS), scoring
├── components/      # React UI components
├── services/        # Ollama, OpenRouter, Langfuse, SQLite clients
├── tasks/           # Built-in task definitions
├── utils/           # Pathfinding, concurrency, statistics
├── types.ts         # All TypeScript interfaces (LLMService, ModelParams, etc.)
└── constants.ts     # Model configs, metric definitions
```

## License

MIT
