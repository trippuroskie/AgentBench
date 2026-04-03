# AgentBench

A browser-based AI agent benchmarking tool for comparing local models' tool-calling and goal-completion capabilities.

Test how well different LLMs handle multi-step agent tasks — calling tools, navigating grids, solving problems — and compare them on metrics like success rate, speed, token usage, and trajectory efficiency.

## Features

- **Agent Harness** — TypeScript tool-calling loop: call model, parse tool_calls, execute mock tools, feed results back, repeat
- **5 Mock Tools** — Calculator, search, weather, grid move, grid look
- **7 Built-in Tasks** — Multi-step math, fact lookup, weather comparison, unit conversion, grid navigation (easy/medium)
- **Live Benchmark Monitor** — Full-screen dark-themed dashboard with real-time step feed, token counters, queue progress, ETA, and live grid visualization
- **Scoring** — Deterministic (exact match, function check), trajectory efficiency (grid nav), LLM-as-judge (optional)
- **Dashboard & Leaderboard** — Charts, model rankings, sortable results with filters
- **Side-by-Side Compare** — Radar chart + metrics table for up to 4 models on the same task
- **Grid Navigation Visualizer** — Animated playback of agent pathfinding with optimal path overlay
- **Agent Trace Viewer** — Step-by-step execution log with tool calls and results
- **SQLite In-Browser** — Persistent storage via sql.js + IndexedDB
- **Langfuse Tracing** — Optional self-hosted tracing via REST API
- **LLM-as-Judge** — Optional scoring via Ollama (local) or OpenRouter (cloud)

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS (CDN) + Font Awesome
- Recharts for visualization
- sql.js for in-browser SQLite
- Ollama for local model inference (OpenAI-compatible API)

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
2. Go to **Models** — your pulled models appear automatically
3. Go to **Run Benchmark** — select tasks and models, hit **Launch**
4. Watch the live monitor as agents execute
5. View results in **Results**, rankings in **Leaderboard**, comparisons in **Compare**

## Optional Integrations

### Langfuse (Tracing)

Self-host [Langfuse](https://langfuse.com/) and configure in **Settings**:
- Host URL, Public Key, Secret Key
- Each benchmark run creates traces with per-step spans and generations

### OpenRouter (LLM-as-Judge)

Add your [OpenRouter](https://openrouter.ai/) API key in **Settings** to use cloud frontier models as judges for open-ended tasks.

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
├── agent/           # Core agent loop, tools, scoring
├── components/      # React UI components
├── services/        # Ollama, OpenRouter, Langfuse, SQLite clients
├── tasks/           # Built-in task definitions
├── utils/           # Pathfinding, metrics
├── types.ts         # All TypeScript interfaces
└── constants.ts     # Model configs, metric definitions
```

## License

MIT
