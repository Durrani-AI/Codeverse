<div align="center">

# 🤖 AI Technical Interview Coach

**Practice coding, behavioral, and system design interviews with real-time AI-powered feedback.**

[![Python](https://img.shields.io/badge/Python-3.11+-3776ab?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Ollama](https://img.shields.io/badge/Ollama-LLM-ff6600?style=for-the-badge)](https://ollama.com)

<br />

<img src="https://img.shields.io/badge/status-active_development-brightgreen?style=flat-square" />
<img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />

</div>

---

## 📋 Table of Contents

- [Problem & Solution](#-problem--solution)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running Locally](#-running-locally)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Future Roadmap](#-future-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Problem & Solution

**The Problem:** Preparing for technical interviews is stressful. Mock interviews are expensive, scheduling with peers is hard, and generic question banks don't provide personalised feedback.

**The Solution:** AI Interview Coach is a full-stack platform that simulates realistic technical interviews — coding, behavioral, and system design — powered by a local LLM (Ollama) or cloud LLM (Groq). Get instant, context-aware feedback on your answers, track your progress over time, and practice whenever you want.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💻 **Coding Interviews** | Monaco code editor with syntax highlighting for Python, JavaScript, and Java |
| 🗣️ **Behavioral Interviews** | Practice STAR-method answers with evaluation |
| 🏗️ **System Design** | Explain architectures and get scored on completeness |
| 🤖 **Real-time Feedback** | Scoring (1-10) with strengths, improvements, and recommendations |
| 📊 **Analytics Dashboard** | Track total interviews, average scores, and improvement trends |
| 🔐 **JWT Authentication** | Secure login/register with bcrypt password hashing |
| ⚡ **Rate Limiting** | Built-in per-IP sliding-window request throttling |
| 🛡️ **Security Headers** | X-Content-Type-Options, X-Frame-Options, HSTS, CSP |
| 🎨 **Dark Theme UI** | Beautiful, responsive dark interface with Tailwind CSS |
| 📱 **Fully Responsive** | Works on mobile, tablet, and desktop |
| 🖨️ **Export Results** | Print or share your interview results |
| 💾 **Auto-Save Drafts** | Code editor auto-saves to localStorage |
| 🔄 **Dual AI Support** | Ollama (local/private) or Groq (cloud/fast) |

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| **FastAPI** 0.109 | Async REST API framework |
| **SQLAlchemy** 2.0+ | Async ORM with SQLite/PostgreSQL support |
| **Pydantic** v2 | Data validation & serialisation |
| **Python-Jose** | JWT token creation & verification |
| **Passlib + bcrypt** | Secure password hashing |
| **Uvicorn** | ASGI server |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js** 14 | React framework with App Router |
| **TypeScript** 5 | Type-safe development |
| **Tailwind CSS** 3 | Utility-first styling |
| **Axios** | HTTP client with interceptors |
| **Monaco Editor** | VS Code-like code editing |

### AI Engine
| Technology | Purpose |
|-----------|---------|
| **Ollama** | Local LLM runtime (privacy-first) |
| **Groq** | Cloud LLM API (low-latency inference) |
| **llama3.2:1b** | Default local model (switchable) |

### Database
| Technology | Purpose |
|-----------|---------|
| **SQLite** (dev) | Zero-config local database via aiosqlite |
| **PostgreSQL** (prod) | Production-ready with asyncpg + connection pooling |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Next.js 14     │     │   FastAPI         │     │  Ollama /    │
│  Frontend       │────▶│   Backend         │────▶│  Groq LLM    │
│  (Port 3000)    │     │   (Port 8000)     │     │              │
└─────────────────┘     └────────┬─────────┘     └──────────────┘
                                 │
                        ┌────────▼─────────┐
                        │  SQLite / Postgres│
                        │  Database         │
                        └──────────────────┘
```

**Request Flow:**
1. Client authenticates via JWT → receives Bearer token
2. Protected endpoints validate token via `get_current_active_user` dependency
3. Interview questions are generated by the LLM with dedup logic
4. Answers are evaluated, scored (1-10), and stored with per-question feedback
5. Session-level holistic analysis aggregates all Q&A for a final debrief

---

## 📦 Prerequisites

Before you begin, make sure you have the following installed:

| Requirement | Version | Download |
|------------|---------|----------|
| **Python** | 3.11 or higher | [python.org](https://python.org/downloads) |
| **Node.js** | 18 or higher | [nodejs.org](https://nodejs.org) |
| **Ollama** | Latest | [ollama.com](https://ollama.com/download) |
| **Git** | Any recent | [git-scm.com](https://git-scm.com) |

After installing Ollama, pull the default model:

```bash
ollama pull llama3.2:1b
```

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/Durrani-AI/AI-Tech-Interviewer.git
cd AI-Tech-Interviewer
```

### 2. Backend setup

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd frontend

# Install Node.js dependencies
npm install

# Return to root
cd ..
```

---

## ⚙️ Environment Variables

### Backend (`.env`)

Copy the example and edit:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | AI Technical Interview Platform | Application display name |
| `DEBUG` | True | Enable debug logging |
| `SECRET_KEY` | (change me) | JWT signing secret — **change in production** |
| `ALGORITHM` | HS256 | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Token TTL |
| `DATABASE_URL` | sqlite+aiosqlite:///./interview_platform.db | DB connection string |
| `AI_PROVIDER` | ollama | `ollama` (local) or `groq` (cloud) |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama server URL |
| `OLLAMA_MODEL` | llama3.2:1b | LLM model name |
| `GROQ_API_KEY` | (empty) | Groq cloud API key |
| `GROQ_MODEL` | llama-3.3-70b-versatile | Groq model name |
| `ALLOWED_ORIGINS` | ["http://localhost:3000", ...] | CORS allowed origins |
| `RATE_LIMIT_PER_MINUTE` | 60 | Max requests per IP per minute |

### Frontend (`frontend/.env.local`)

```bash
cp frontend/.env.local.example frontend/.env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | http://127.0.0.1:8000/api/v1 | Backend API base URL |

---

## ▶️ Running Locally

You need **three terminals** running simultaneously:

### Terminal 1 — Ollama

```bash
ollama serve
```

> Ollama may already be running as a system service. Check with `ollama list`.

### Terminal 2 — Backend (FastAPI)

```bash
# From project root, with venv activated
uvicorn main:app --reload --port 8000
```

The API will be available at **http://127.0.0.1:8000**
Interactive docs at **http://127.0.0.1:8000/docs**

### Terminal 3 — Frontend (Next.js)

```bash
cd frontend
npm run dev
```

The app will be available at **http://localhost:3000**

### Quick verification

1. Open **http://localhost:3000** — you should see the landing page
2. Click **Create Account** and register a new user
3. Log in and start your first interview
4. Answer questions and receive feedback in real time

---

## 📚 API Documentation

The FastAPI backend provides interactive API documentation:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc

### Key Endpoints

#### Authentication

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123"
}
```

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepassword123"
}

→ { "access_token": "eyJ...", "token_type": "bearer" }
```

```http
GET /api/v1/auth/me
Authorization: Bearer <token>

→ { "id": "...", "email": "...", "username": "johndoe", ... }
```

```http
PUT /api/v1/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "securepassword123",
  "new_password": "newsecurepassword456"
}

→ { "message": "Password updated successfully" }
```

#### Interviews

```http
POST /api/v1/interviews/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "interview_type": "coding",
  "difficulty_level": "medium",
  "topic": "Arrays and Strings"
}

→ { "session_id": "...", "first_question": { ... }, ... }
```

```http
POST /api/v1/interviews/{session_id}/answer
Authorization: Bearer <token>
Content-Type: application/json

{
  "question_id": "...",
  "response_text": "My approach is to use two pointers...",
  "response_code": "def two_sum(nums, target): ..."
}

→ { "response": { "feedback": { "score": 8, ... } }, "next_question": { ... } }
```

```http
POST /api/v1/interviews/{session_id}/feedback
Authorization: Bearer <token>

→ { "overall_score": 7.5, "summary": "...", "key_strengths": [...], ... }
```

#### Analytics

```http
GET /api/v1/analytics/overview
Authorization: Bearer <token>

→ { "sessions_count": 12, "average_score": 7.2, "improvement_trend": "improving", ... }
```

---

## 🗂️ Project Structure

```
AI-Tech-Interviewer/
│
├── 📄 main.py                    # FastAPI entry point, middleware, error handlers
├── 📄 requirements.txt           # Python dependencies
├── 📄 .env.example               # Backend environment template
├── 📄 render.yaml                # Render deployment blueprint
├── 📄 Procfile                   # Heroku / generic PaaS start command
├── 📄 .gitignore
│
├── 📁 app/                       # Backend application package
│   ├── config.py                 # Pydantic Settings configuration
│   ├── database.py               # Async SQLAlchemy engine & session
│   ├── models.py                 # 5 SQLAlchemy ORM models (UUID PKs)
│   ├── schemas.py                # 20+ Pydantic v2 request/response schemas
│   │
│   ├── 📁 routes/                # API endpoint routers
│   │   ├── auth.py               # Register, login, profile, password change
│   │   ├── interviews.py         # Start, answer, feedback, list, cancel
│   │   └── analytics.py          # Overview, recent activity, performance
│   │
│   ├── 📁 services/              # Business logic layer
│   │   └── ai_service.py         # Ollama / Groq LLM integration + retry
│   │
│   └── 📁 utils/                 # Shared utilities
│       └── helpers.py            # UUID, datetime, clamp, truncate helpers
│
├── 📁 frontend/                  # Next.js 14 application
│   ├── 📄 next.config.mjs        # API proxy rewrite config
│   ├── 📄 tailwind.config.ts     # Custom dark theme & brand colours
│   ├── 📄 .env.local.example     # Frontend environment template
│   │
│   ├── 📁 app/                   # App Router pages
│   │   ├── page.tsx              # Landing page (/)
│   │   ├── layout.tsx            # Root layout with fonts & dark mode
│   │   ├── globals.css           # Tailwind + custom component classes
│   │   │
│   │   ├── 📁 login/             # Login page
│   │   ├── 📁 register/          # Registration page
│   │   ├── 📁 dashboard/         # Authenticated home with stats
│   │   │
│   │   └── 📁 interview/
│   │       └── 📁 [sessionId]/   # Live interview session
│   │           ├── page.tsx      # Questions, code editor, timer, submit
│   │           └── 📁 results/   # Post-interview analysis & scores
│   │
│   ├── 📁 components/            # Reusable React components
│   │   ├── code-editor.tsx       # Monaco Editor with auto-save
│   │   ├── interview-card.tsx    # Session card with actions
│   │   ├── navbar.tsx            # Navigation bar
│   │   └── 📁 ui/               # Primitive UI components
│   │
│   ├── 📁 lib/                   # Client-side utilities
│   │   ├── api.ts                # Axios client with interceptors
│   │   ├── auth-context.tsx      # React auth context & provider
│   │   └── utils.ts              # cn(), formatDate(), scoreColor()
│   │
│   └── 📁 types/                 # TypeScript interfaces
│       └── index.ts              # All shared types & API contracts
│
└── 📁 static/                    # Vanilla HTML/JS/CSS frontend (legacy)
```

---

## 🔮 Future Roadmap

- [ ] 🎙️ **Voice interviews** — speech-to-text input for behavioral questions
- [ ] 📐 **Whiteboard mode** — drawing canvas for system design diagrams
- [ ] 🧠 **Multi-model support** — additional LLM providers
- [ ] 👥 **Peer mock interviews** — real-time sessions with other users
- [ ] 📈 **Advanced analytics** — weekly reports, spaced repetition scheduling
- [ ] 🏆 **Leaderboard** — anonymous ranking by interview type
- [ ] 📝 **Custom question banks** — upload your own questions
- [ ] 🌐 **Multi-language support** — UI and questions in multiple languages
- [ ] 🐳 **Docker Compose** — one-command deployment
- [ ] ☁️ **Cloud deployment guide** — AWS/GCP/Azure with PostgreSQL
- [ ] 📱 **PWA support** — installable mobile app experience
- [ ] 🔗 **OAuth** — GitHub and Google sign-in

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m "Add amazing feature"`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Guidelines

- Follow existing code style and conventions
- Write TypeScript (not JavaScript) for frontend code
- Add type hints for all Python functions
- Test your changes locally before submitting
- Update the README if you add new features
- Keep PRs focused — one feature or fix per PR

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 AI Interview Coach

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

<div align="center">

**Built with ❤️ using FastAPI, Next.js, and Ollama**

[Report Bug](../../issues) · [Request Feature](../../issues) · [Discussions](../../discussions)

</div>
