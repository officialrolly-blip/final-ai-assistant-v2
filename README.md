# 🧠 Interview Copilot

> **Real-time AI interview assistant** — Upload your resume, add the job details, and get instant AI-generated answers during live interviews. Transcribed in real time from the interviewer's voice.

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🎬 How It Works](#-how-it-works)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [⚙️ Configuration](#️-configuration)
- [📱 Usage Guide](#-usage-guide)
- [🔌 API Reference](#-api-reference)
- [🎨 UI Components](#-ui-components)
- [🔐 Privacy & Security](#-privacy--security)
- [🚢 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

### 📄 Resume Analysis
- **ATS Compatibility Scoring** — See how well your resume passes Applicant Tracking Systems
- **Keyword Match Analysis** — Identify missing keywords from the job description
- **Skill Gap Detection** — Compare your skills against job requirements
- **Quality Scoring** — Get actionable feedback on resume quality, formatting, and grammar
- **Smart Suggestions** — Receive specific, actionable improvement recommendations

### 🧠 Interview Prep
- **Behavioral Questions** — Practice with likely behavioral questions and model answers
- **Technical Questions** — Prepare for role-specific technical challenges
- **Company-Specific Questions** — Get questions tailored to the target company
- **STAR Examples** — Pre-built Situation/Task/Action/Result stories from your experience
- **Strength & Weakness Questions** — Prepare for the classic "What's your greatest strength/weakness?"
- **Key Talking Points** — Each answer includes bullet points and keywords to hit

### 🎤 Live Interview Copilot
- **Real-time Transcription** — Uses Deepgram's Nova-3 model for ultra-low-latency speech-to-text
- **Instant AI Answers** — Generates professional answers the moment a question is detected
- **Question Type Detection** — Automatically categorizes questions (behavioral, technical, salary, etc.)
- **Conversation Memory** — Maintains context from the last 8 turns for coherent follow-up answers
- **Confidence Scoring** — Each answer includes a confidence score and speaking time estimate
- **Multiple Answer Formats** — Professional response, short version, STAR format, bullet points, keywords, and follow-up suggestions

### 📺 Teleprompter Mode
- **Floating Window** — Opens in a separate draggable, resizable window
- **Auto-Scroll** — Automatically scrolls as the AI generates text
- **Adjustable Opacity** — Make it semi-transparent for discreet reading
- **Font Size Control** — Adjust text size on the fly
- **Keyboard Shortcuts** — `Ctrl+T` to toggle, `Space` to pause, `Ctrl+↑/↓` for font size
- **Popup-Blocker Aware** — Gracefully handles blocked popups with helpful guidance

### 🎨 Polish & UX
- **Dark/Light Theme** — Beautiful dark mode by default with light mode option
- **Glassmorphism UI** — Modern frosted-glass cards with backdrop blur
- **Animated Transitions** — Smooth Framer Motion animations throughout
- **Responsive Design** — Works on desktop and tablet
- **Persistent State** — Your resume, job info, and settings are saved locally (Zustand + localStorage)
- **Error Handling** — Graceful error messages for permission denials, API failures, and parsing issues

---

## 🎬 How It Works

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│  🖥️ Screen   │────▶│  🎤 Deepgram  │────▶│  📝 Transcript │────▶│  🤖 OpenRouter│────▶│  ✨ AI Answer  │────▶│  📺 Teleprompter│
│  Audio Share │     │  Nova-3 STT  │     │  + Question   │     │  LLM Stream   │     │  (JSON)       │     │  Display      │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘     └──────────────┘     └───────────────┘
```

1. **🖥️ Screen Share** — You share your screen with audio (captures the interview call audio)
2. **🎤 Deepgram** — Audio streams to Deepgram's WebSocket API for real-time transcription
3. **📝 Transcript** — The transcript is monitored for question-end signals (`?`, `.`, or pauses > 1.5s)
4. **🤖 OpenRouter** — The question + your resume + job context + conversation history is sent to an LLM
5. **✨ AI Answer** — The LLM streams back a structured JSON answer (professional response, STAR format, bullet points, etc.)
6. **📺 Teleprompter** — The answer is displayed in a floating teleprompter window you can read while talking

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | ![Next.js](https://img.shields.io/badge/Next.js-13.5.11-black?logo=next.js) | React framework with App Router |
| **Language** | ![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue?logo=typescript) | Type-safe development |
| **Styling** | ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3.3-38B2AC?logo=tailwind-css) | Utility-first CSS framework |
| **UI Components** | ![shadcn/ui](https://img.shields.io/badge/shadcn/ui-latest-black) | Reusable component library |
| **Icons** | ![Lucide](https://img.shields.io/badge/Lucide-React-red) | Beautiful, consistent icons |
| **Animations** | ![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.43.0-FF0080?logo=framer) | Smooth page and component animations |
| **State Management** | ![Zustand](https://img.shields.io/badge/Zustand-5.0.14-orange) | Lightweight state with localStorage persistence |
| **Speech-to-Text** | ![Deepgram](https://img.shields.io/badge/Deepgram-Nova--3-purple) | Real-time audio transcription |
| **AI/LLM** | ![OpenRouter](https://img.shields.io/badge/OpenRouter-API-blueviolet) | Multi-model LLM access with fallback |
| **Forms** | ![React Hook Form](https://img.shields.io/badge/React_Hook_Form-7.53.0-EC5990) | Form validation and handling |
| **Schema** | ![Zod](https://img.shields.io/badge/Zod-3.23.8-blue) | Runtime type validation |
| **Resume Parsing** | ![unpdf](https://img.shields.io/badge/unpdf-PDF-green) + ![mammoth](https://img.shields.io/badge/mammoth-DOCX-blue) | PDF and DOCX text extraction |
| **Deployment** | ![Netlify](https://img.shields.io/badge/Netlify-Ready-00C7B7?logo=netlify) | One-click deployment |

---

## 📁 Project Structure

```
interview-copilot/
├── 📂 app/                          # Next.js App Router
│   ├── 📂 api/                      # API Routes (server-side)
│   │   ├── 📂 chat/                 # AI chat streaming endpoint
│   │   │   └── route.ts             # OpenRouter proxy with model fallback
│   │   ├── 📂 config/               # Config endpoint (API keys)
│   │   │   └── route.ts
│   │   ├── 📂 deepgram-token/       # Deepgram token endpoint
│   │   │   └── route.ts
│   │   └── 📂 parse-resume/         # Resume file parser
│   │       └── route.ts             # PDF/DOCX/TXT extraction
│   ├── 📂 analyze/                  # Resume analysis & prep page
│   │   └── page.tsx
│   ├── 📂 interview/                # Live interview mode page
│   │   └── page.tsx
│   ├── globals.css                  # Global styles + Tailwind
│   ├── layout.tsx                   # Root layout (theme, toaster, teleprompter)
│   └── page.tsx                     # Home page
│
├── 📂 components/
│   ├── 📂 home/                     # Home page components
│   │   ├── home-client.tsx          # Landing page with step flow
│   │   ├── job-form.tsx             # Job details input form
│   │   ├── resume-uploader.tsx      # Drag-and-drop resume upload
│   │   └── settings-dialog.tsx      # Settings modal
│   ├── 📂 providers/
│   │   └── theme-provider.tsx       # Dark/light theme provider
│   ├── 📂 teleprompter/
│   │   └── teleprompter-portal.tsx  # Floating teleprompter window
│   └── 📂 ui/                       # shadcn/ui components (40+)
│       ├── button.tsx, card.tsx, badge.tsx, dialog.tsx, ...
│       └── ...
│
├── 📂 hooks/
│   ├── use-interview.ts             # Core interview logic hook
│   ├── use-screen-audio-capture.ts  # Screen audio capture hook
│   └── use-toast.ts                 # Toast notifications hook
│
├── 📂 lib/
│   ├── 📂 ai/
│   │   ├── client.ts                # Streaming chat client + JSON extraction
│   │   ├── deepgram.ts              # Deepgram WebSocket client class
│   │   └── models.ts                # Free model registry + resolver
│   ├── store.ts                     # Zustand global state store
│   ├── types.ts                     # TypeScript domain types
│   └── utils.ts                     # Utility functions
│
├── .env                             # Environment variables (not in git)
├── .eslintrc.json                   # ESLint config
├── .gitignore
├── components.json                  # shadcn/ui config
├── netlify.toml                     # Netlify deployment config
├── next.config.js                   # Next.js config
├── package.json
├── postcss.config.js
├── tailwind.config.ts               # Tailwind theme + plugins
└── tsconfig.json                    # TypeScript config
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.17+ (recommended: 20.x)
- **npm** or **yarn**
- An **OpenRouter API key** — [Get one free →](https://openrouter.ai/)
- A **Deepgram API key** — [Get one free →](https://console.deepgram.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd interview-copilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env   # or create .env manually
   ```
   
   Add your API keys to `.env`:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx
   DEEPGRAM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the app**
   ```
   http://localhost:3000
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | ✅ Yes | OpenRouter API key for LLM access |
| `DEEPGRAM_API_KEY` | ✅ Yes | Deepgram API key for speech-to-text |

### AI Models

The app uses a curated list of **free OpenRouter models** with automatic fallback:

| Model | Name | Use Case |
|-------|------|----------|
| `inclusionai/ling-3.0-flash:free` | Ling 3.0 Flash | ⚡ Fastest (default) |
| `poolside/laguna-s-2.1:free` | Poolside Laguna S 2.1 | 🔄 Fallback |
| `google/gemma-4-26b-a4b-it:free` | Google Gemma 4 26B | 🔄 Fallback |
| `google/gemma-4-31b-it:free` | Google Gemma 4 31B | 🔄 Fallback |
| `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA Nemotron 3 Super | 🔄 Fallback |

> 💡 **Tip:** Set `openRouterModel` to `auto` in Settings to use the fallback chain, or select a specific model.

### Token Limits

The app uses task-specific token limits to prevent truncated responses:

| Task | Max Tokens | Why |
|------|-----------|-----|
| `analyze-resume` | 4,000 | Detailed analysis with many fields |
| `interview-prep` | 8,000 | Multiple question categories + STAR examples |
| `answer-question` | 2,000 | Single structured answer |
| `detect-question` | 200 | Tiny classification response |

---

## 📱 Usage Guide

### Step 1: 📄 Upload Your Resume

1. Click **"Get Started"** on the home page
2. Drag & drop or browse for your resume file
3. Supported formats: **PDF**, **DOCX**, **TXT**
4. The app extracts text and stores it locally

### Step 2: 💼 Enter Job Details

1. Fill in the **job role**, **company name**, and **job description**
2. Select the **interview type** (Technical, Behavioral, HR, or Mixed)
3. Click **"Analyze"** to proceed

### Step 3: 📊 Analyze & Prepare

1. **Resume Analysis tab** auto-runs — see your ATS score, skill gaps, and suggestions
2. Click the **"Interview Prep"** tab to generate practice questions and model answers
3. Review STAR examples, behavioral/technical questions, and key talking points

### Step 4: 🎤 Start Live Interview Mode

1. Click **"Enter Interview Mode"**
2. Click **"Start Interview"**
3. **Share your screen with audio** — make sure to check "Share audio" in the browser dialog
4. The app transcribes the interviewer's voice in real time
5. When a question is detected, the AI generates an instant answer

### Step 5: 📺 Use the Teleprompter

1. Click the **"Teleprompter"** button in the header
2. A floating window opens (allow popups if prompted)
3. **Drag** the window to position it
4. **Resize** from the bottom-right corner
5. Use keyboard shortcuts:
   - `Ctrl+T` — Show/hide teleprompter
   - `Space` — Pause/resume auto-scroll
   - `Ctrl+↑/↓` — Increase/decrease font size

### Tips for Best Results

- 🎧 **Use headphones** to prevent audio echo
- 🖥️ **Share the right tab** — share the tab with your interview call (Google Meet, Zoom web, etc.)
- 🔇 **Mute your mic** in the interview call to avoid capturing your own voice (unless using mic mode)
- ⚡ **First compile is slow** — the initial page load may take 30-60s in dev mode; subsequent loads are fast

---

## 🔌 API Reference

### `POST /api/chat`

Streams an AI chat completion from OpenRouter.

**Request Body:**
```json
{
  "task": "analyze-resume | interview-prep | answer-question | detect-question",
  "messages": [{ "role": "system|user|assistant", "content": "..." }],
  "model": "auto | specific-model-id"
}
```

**Response:** Server-Sent Events (SSE) stream
```
data: {"model": "inclusionai/ling-3.0-flash:free"}
data: {"content": "Here is..."}
data: {"content": "your answer..."}
data: [DONE]
```

### `POST /api/parse-resume`

Parses a resume file (PDF/DOCX/TXT) and extracts text.

**Request:** `FormData` with `file` field

**Response:**
```json
{
  "text": "Extracted resume text...",
  "fileName": "resume.pdf",
  "fileType": "pdf",
  "sizeBytes": 102400
}
```

### `GET /api/config`

Returns API key configuration status.

**Response:**
```json
{
  "openRouterApiKey": "sk-or-v1-...",
  "deepgramApiKey": "...",
  "hasOpenRouter": true,
  "hasDeepgram": true
}
```

### `GET /api/deepgram-token`

Returns a Deepgram API key for client-side WebSocket connections.

---

## 🎨 UI Components

This project uses [shadcn/ui](https://ui.shadcn.com/) — a collection of 40+ beautifully designed, accessible components built on Radix UI primitives:

<details>
<summary>📦 Full Component List</summary>

| Component | File |
|-----------|------|
| Accordion | `components/ui/accordion.tsx` |
| Alert Dialog | `components/ui/alert-dialog.tsx` |
| Alert | `components/ui/alert.tsx` |
| Aspect Ratio | `components/ui/aspect-ratio.tsx` |
| Avatar | `components/ui/avatar.tsx` |
| Badge | `components/ui/badge.tsx` |
| Breadcrumb | `components/ui/breadcrumb.tsx` |
| Button | `components/ui/button.tsx` |
| Calendar | `components/ui/calendar.tsx` |
| Card | `components/ui/card.tsx` |
| Carousel | `components/ui/carousel.tsx` |
| Chart | `components/ui/chart.tsx` |
| Checkbox | `components/ui/checkbox.tsx` |
| Collapsible | `components/ui/collapsible.tsx` |
| Command | `components/ui/command.tsx` |
| Context Menu | `components/ui/context-menu.tsx` |
| Dialog | `components/ui/dialog.tsx` |
| Drawer | `components/ui/drawer.tsx` |
| Dropdown Menu | `components/ui/dropdown-menu.tsx` |
| Form | `components/ui/form.tsx` |
| Hover Card | `components/ui/hover-card.tsx` |
| Input OTP | `components/ui/input-otp.tsx` |
| Input | `components/ui/input.tsx` |
| Label | `components/ui/label.tsx` |
| Menubar | `components/ui/menubar.tsx` |
| Navigation Menu | `components/ui/navigation-menu.tsx` |
| Pagination | `components/ui/pagination.tsx` |
| Popover | `components/ui/popover.tsx` |
| Progress | `components/ui/progress.tsx` |
| Radio Group | `components/ui/radio-group.tsx` |
| Resizable | `components/ui/resizable.tsx` |
| Scroll Area | `components/ui/scroll-area.tsx` |
| Select | `components/ui/select.tsx` |
| Separator | `components/ui/separator.tsx` |
| Sheet | `components/ui/sheet.tsx` |
| Skeleton | `components/ui/skeleton.tsx` |
| Slider | `components/ui/slider.tsx` |
| Sonner (Toaster) | `components/ui/sonner.tsx` |
| Switch | `components/ui/switch.tsx` |
| Table | `components/ui/table.tsx` |
| Tabs | `components/ui/tabs.tsx` |
| Textarea | `components/ui/textarea.tsx` |
| Toast | `components/ui/toast.tsx` |
| Toaster | `components/ui/toaster.tsx` |
| Toggle Group | `components/ui/toggle-group.tsx` |
| Toggle | `components/ui/toggle.tsx` |
| Tooltip | `components/ui/tooltip.tsx` |

</details>

---

## 🔐 Privacy & Security

- 🔒 **API keys are server-side** — Keys are stored in `.env` and proxied through Next.js API routes. They are never exposed to the browser.
- 💾 **Local storage only** — Your resume, job details, and settings are stored in your browser's localStorage. No data is sent to a database.
- 🎤 **Audio stays in-browser** — Audio is captured via the browser's `getDisplayMedia` API and streamed directly to Deepgram. It does not pass through our servers.
- 🚫 **No tracking** — This app does not include analytics or tracking.
- ⚠️ **Screen share required** — The app needs screen-share-with-audio permission to function. This is a browser requirement, not an app limitation.

---

## 🚢 Deployment

### Netlify (Recommended)

The app includes a `netlify.toml` config for one-click deployment:

1. Push your code to GitHub
2. Go to [Netlify](https://app.netlify.com/)
3. Click **"Add new site"** → **"Import an existing project"**
4. Connect your GitHub repo
5. Add environment variables:
   - `OPENROUTER_API_KEY`
   - `DEEPGRAM_API_KEY`
6. Deploy! 🎉

### Vercel

1. Push to GitHub
2. Go to [Vercel](https://vercel.com/)
3. Import your repo
4. Add environment variables
5. Deploy

### Manual / Self-hosted

```bash
npm run build
npm run start
```

> ⚠️ **Note:** The app requires a Node.js runtime (not Edge) due to the resume parsing dependencies (`unpdf`, `mammoth`).

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m '✨ Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style (TypeScript, functional components, Tailwind)
- Use conventional commit emojis: `✨` feature, `🐛` bugfix, `📝` docs, `🎨` style, `♻️` refactor
- Run `npm run typecheck` before committing
- Run `npm run lint` to check for lint errors
- Test your changes in the browser before submitting

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**🧠 Interview Copilot** — *Ace every interview with an AI copilot by your side.*

Made with ❤️ using Next.js, Deepgram, and OpenRouter

</div># ai-rolly-personal-assistant
# final-ai-assistant
# final-ai-assistant
# ai-rolly-personal-assistant
