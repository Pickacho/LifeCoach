# 🧠 LifeCoach — External Prefrontal Cortex

> A self-hosted, AI-powered life coaching dashboard designed for high-performance individuals managing ADHD, grief, and career pivots. Built with **Next.js 14**, **SQLite**, **Qdrant** vector memory, and any OpenAI-compatible LLM.

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 💬 **AI Chat Coach** | Streamed conversations with an elite life coach persona (Hebrew by default) |
| 🧠 **Vector Memory (RAG)** | Qdrant-powered long-term memory retrieval — the coach remembers past sessions |
| 🗺️ **Context Map (Insights)** | 8 life domains auto-analyzed from your conversations (Ikigai, Longevity, Grief, ADHD...) |
| 🎮 **Gamified Tier System** | XP points for daily habits (Hydration, Zone 2, Deep Work, Tantra) |
| 📥 **Single Capture Inbox** | ADHD-friendly brain-dump area to capture thoughts without losing focus |
| ⚙️ **Live LLM Configuration** | Switch AI providers (LM Studio, Ollama, OpenAI, OpenRouter, Claude) from the UI |
| 🏃 **Google Health Integration** | Connect Google Fit for automatic Zone 2 workout tracking |
| 🐳 **Docker-first** | One `docker compose up` and you're running |

---

## 🏗️ Architecture

```
LifeCoach/
├── app/
│   ├── page.jsx              # Main dashboard (React, single-page)
│   ├── layout.jsx            # Root layout
│   ├── globals.css           # Dark glassmorphism design system
│   └── api/
│       ├── chat/route.js     # LLM chat + RAG pipeline (core engine)
│       ├── insights/         # Domain insight extraction from chat history
│       ├── config/           # Persistent LLM config (stored in SQLite)
│       ├── models/           # Scan available models from LLM provider
│       ├── auth/             # Google OAuth handler
│       └── health/           # Health check endpoint
├── lib/
│   └── db.js                 # better-sqlite3 singleton
├── Dockerfile                # Multi-stage Node.js 18 Alpine build
├── docker-compose.yml        # App + Qdrant vector DB
└── .env.example              # Environment variables template
```

### Data Flow

```
User Message
     │
     ▼
[1] Generate Embedding (via LLM provider's /embeddings)
     │
     ▼
[2] Qdrant Vector Search → Retrieve 3 most relevant past memories
     │
     ▼
[3] Build prompt = System Prompt + Past Memories + Last 10 messages + New message
     │
     ▼
[4] LLM API Call (OpenAI-compatible or native Claude)
     │
     ▼
[5] Save User + AI messages to SQLite
     │
     ▼
[6] Async: Upsert new memory vector to Qdrant
```

---

## 🚀 Quick Start

### Option A: Docker Compose (Recommended)

**Prerequisites:** Docker & Docker Compose installed.

```bash
# 1. Clone the repository
git clone https://github.com/Pickacho/LifeCoach.git
cd LifeCoach

# 2. Copy and configure environment variables
cp .env.example .env

# 3. Launch the app + Qdrant vector DB
docker compose up -d

# 4. Open in browser
open http://localhost:3000
```

The `./data` directory is automatically created and mounted as a persistent volume for the SQLite database and Qdrant storage.

### Option B: Local Development

**Prerequisites:** Node.js 18+, npm.

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local
# Edit .env.local with your settings

# 3. Start development server
npm run dev

# 4. Open http://localhost:3000
```

> **Note:** Running locally without Docker means Qdrant won't be available. The app gracefully falls back to short-term memory (last 10 messages from SQLite) if Qdrant is unreachable.

---

## ⚙️ Configuration

### Environment Variables (`.env`)

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `/app/data/coach.db` | Path to SQLite database file |
| `PORT` | `3000` | App port |
| `LLM_BASE_URL` | `http://host.docker.internal:1234/v1` | OpenAI-compatible API base URL |
| `LLM_API_KEY` | `your-api-key-here` | API key (not required for local LLMs) |
| `LLM_MODEL` | `local-model` | Model name/ID to use |
| `GOOGLE_CLIENT_ID` | *(optional)* | For Google Health integration |
| `GOOGLE_CLIENT_SECRET` | *(optional)* | For Google Health integration |
| `APP_URL` | `http://localhost:3000` | Public URL (required for OAuth callback) |

### Configuring Your LLM Provider

You can configure the LLM **at runtime** from the Settings panel (⚙️ icon in the top-right corner). No restart needed.

#### Supported Providers

| Provider | Base URL | API Key Required |
|---|---|---|
| **LM Studio** (local) | `http://host.docker.internal:1234/v1` | No |
| **Ollama** (local) | `http://host.docker.internal:11434/v1` | No |
| **OpenAI** | `https://api.openai.com/v1` | ✅ Yes |
| **OpenRouter** | `https://openrouter.ai/api/v1` | ✅ Yes |
| **Anthropic (Claude)** | Native endpoint handled automatically | ✅ Yes |

> **Docker note:** When running inside Docker, use `host.docker.internal` instead of `localhost` to reach services on your host machine (e.g., LM Studio, Ollama).

#### Setting Up Vector Memory (Embeddings)

For long-term memory to work, your LLM provider must support an `/embeddings` endpoint.  
Recommended embedding models:
- **Local:** `nomic-embed-text` (via LM Studio or Ollama)
- **OpenAI:** `text-embedding-3-small`
- **OpenRouter:** Any embedding model available on their catalog

Configure the embedding model separately from the chat model in the Settings panel.

---

## 🧠 How the AI Coach Works

The system prompt defines an elite life coach persona with these characteristics:

- **Direct & structured** — ADHD-friendly bullet points, no fluff
- **Action-oriented** — CBT/NLP coping strategies, not just emotional validation
- **Peter Attia Medicine 3.0** framework for longevity (Zone 2, VO2 Max, Stability, Strength)
- **Gamified habits** — references the Tier system during coaching
- **Always responds in Hebrew** (עברית)

### Tier System (Gamification)

| Tier | Habits | XP |
|---|---|---|
| **Tier 1 — Minimum Viable Day** | 3.7L water, fiber, medications | +10 each |
| **Tier 2 — Priority** | Zone 2 cardio (auto-sync), 50min Deep Work | +50 / +20 |
| **Tier 3 — Bonus** | Yoga, Tantra (Mula Bandha) | +30 |

### Context Map (Insights)

After each conversation, the system automatically extracts insights across 8 life domains:

- **Ikigai & Career Pivot** — Purpose alignment and career direction
- **Longevity (Med 3.0)** — Health optimization signals
- **Grief & Resilience** — Emotional processing indicators
- **ADHD & Systems** — Productivity system effectiveness
- **General Career** — Professional development signals
- **General Health** — Overall health patterns
- **Relationships** — Connection quality signals
- **Personal Growth** — Learning and development trajectories

Each domain shows a confidence score (1–5 bars) based on conversation depth.

---

## 🔌 API Reference

All endpoints are Next.js Route Handlers under `/app/api/`.

### `GET /api/chat`
Returns full chat history ordered by time.

### `POST /api/chat`
Send a new message to the AI coach.
```json
{ "message": "מה אני צריך לעשות היום?" }
```

### `DELETE /api/chat`
- Without params: Clears **all** chat history + Qdrant memory collection
- With `?id=<id>`: Deletes a single message

### `PUT /api/chat`
Edit an existing message.
```json
{ "id": 42, "content": "Updated message text" }
```

### `GET /api/config`
Returns current LLM configuration.

### `POST /api/config`
Save LLM configuration to persistent SQLite storage.
```json
{
  "LLM_PROVIDER": "OpenRouter",
  "LLM_BASE_URL": "https://openrouter.ai/api/v1",
  "LLM_API_KEY": "sk-...",
  "LLM_MODEL": "anthropic/claude-3.5-sonnet",
  "EMBEDDINGS_MODEL": "text-embedding-3-small"
}
```

### `GET /api/models?baseUrl=...&apiKey=...`
Scans the given provider for available models. Returns array of model IDs.

### `GET/POST /api/insights`
- `GET`: Returns stored life domain insights
- `POST`: Triggers re-analysis of chat history to update all insights

### `GET /api/health`
Health check endpoint for monitoring.

---

## 🐳 Docker Details

The `docker-compose.yml` spins up two containers:

| Container | Image | Port | Purpose |
|---|---|---|---|
| `life-coach-app` | Built from `Dockerfile` | `3000` | Next.js application |
| `life-coach-qdrant` | `qdrant/qdrant:latest` | `6333` | Vector database for memory |

Both containers share a `./data` volume for persistent storage.

### Useful Docker Commands

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f app

# Restart after code changes
docker compose up -d --build

# Stop everything
docker compose down

# Wipe all data (nuclear reset)
docker compose down -v
rm -rf ./data
```

---

## 🔧 Development Notes

### Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** SQLite via `better-sqlite3` (synchronous, zero-config)
- **Vector DB:** Qdrant (runs as a sidecar container)
- **UI Components:** Lucide React icons, `react-markdown`
- **Styling:** Custom CSS variables — dark glassmorphism aesthetic
- **LLM Integration:** OpenAI SDK-compatible fetch calls (works with any compatible provider)

### Adding a New Life Domain

In `app/page.jsx`, find the domains array and add an entry:
```js
{ id: 'Finance', label: 'Financial Independence' }
```
Then update the insights extraction prompt in `app/api/insights/route.js` to include the new domain.

### Changing the Coach Persona

Edit `BASE_SYSTEM_PROMPT` in `app/api/chat/route.js`. The prompt is injected at the start of every LLM call, so changes take effect immediately (no restart needed when using docker compose, as the config is read per-request).

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is private. All rights reserved.
