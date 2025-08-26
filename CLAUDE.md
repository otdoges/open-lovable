# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with Turbopack (opens at http://localhost:3000)
- `npm run build` - Build the application for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint to check code quality

### Testing
- `npm run test:integration` - Run E2B integration tests
- `npm run test:api` - Run API endpoint tests  
- `npm run test:code` - Run code execution tests
- `npm run test:all` - Run all tests sequentially

## Architecture Overview

### Core Functionality
ZapDev is an AI-powered development platform that uses E2B sandboxes to execute code in isolated environments. Users can clone git repositories, chat with AI to generate and modify applications in real-time, with integrated authentication and monetization.

### Key Components

#### Frontend Structure (Next.js 15 with App Router)
- `app/page.tsx` - Main application interface with chat, sandbox preview, and file management
- `app/layout.tsx` - Root layout with metadata and Inter font
- `components/` - Reusable UI components including sandbox preview and progress indicators
- `lib/` - Utilities for context selection, file parsing, edit analysis, and search execution

#### API Layer (`app/api/`)
Core sandbox management:
- `create-ai-sandbox/` - Initialize E2B sandboxes
- `apply-ai-code/` and `apply-ai-code-stream/` - Apply generated code to sandbox
- `get-sandbox-files/` - Retrieve current sandbox file structure
- `kill-sandbox/` - Terminate sandbox instances

AI and content processing:
- `generate-ai-code-stream/` - Stream AI code generation
- `analyze-edit-intent/` - Analyze user edit requests
- `scrape-url-enhanced/` and `scrape-screenshot/` - Web content extraction with Firecrawl

Development tools:
- `check-vite-errors/`, `monitor-vite-logs/`, `restart-vite/` - Vite development server management
- `detect-and-install-packages/`, `install-packages/` - Automatic package installation
- `run-command/` - Execute shell commands in sandbox

#### Configuration (`config/app.config.ts`)
Centralized configuration for:
- E2B sandbox settings (timeout: 15min, Vite port: 5173)
- AI models (default: Kimi K2 Instruct, supports GPT-5, Sonnet 4, Gemini 2.5 Pro)  
- Code application delays and truncation recovery
- Package installation with legacy peer deps
- File management patterns and size limits

### Key Dependencies
- **AI SDKs**: Anthropic, OpenAI, Google, Groq for multiple AI provider support
- **E2B**: `@e2b/code-interpreter` and `e2b` for sandbox environments
- **Authentication**: BetterAuth for secure user authentication and OAuth
- **Database**: Convex for real-time backend and data persistence
- **Payments**: Polar.sh for subscription and usage-based billing
- **Git Operations**: simple-git for repository cloning and management
- **UI**: Radix UI components, Tailwind CSS, Framer Motion for animations
- **Development**: TypeScript, ESLint, Next.js with Turbopack

### Environment Variables Required
```env
# Core services (required)
E2B_API_KEY=your_e2b_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Authentication (BetterAuth)
BETTER_AUTH_SECRET=your_random_secret
BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Database (Convex)
CONVEX_DEPLOYMENT=your_convex_deployment_url

# Payments (Polar.sh)
POLAR_ACCESS_TOKEN=your_polar_access_token
POLAR_WEBHOOK_SECRET=your_polar_webhook_secret

# AI providers (need at least one)
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

### File Structure Patterns
- Excludes: `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`, `*.log`
- Text files: `.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.html`, `.json`, `.md`
- Max file size: 1MB for processing

### Development Notes
- Uses Turbopack for faster development builds
- Automatic package detection and installation for missing dependencies
- Real-time Vite error monitoring and recovery
- Sandbox timeout: 15 minutes with automatic cleanup
- CSS rebuild delay: 2 seconds, package install refresh: 5 seconds

## New Features & Architecture

### Authentication (BetterAuth)
- User authentication with email/password and GitHub OAuth
- Session management and protected routes
- Route handler: `/app/api/auth/[...all]/route.ts`
- Client configuration: `lib/auth-client.ts`
- Database schema managed by BetterAuth CLI

### Database (Convex)  
- Real-time backend-as-a-service with TypeScript-first development
- Database functions in `convex/` directory
- Real-time subscriptions using `useQuery` hook
- Schema defined in `convex/schema.ts`
- Initialize with: `npx convex dev`

### Git Integration
- Repository cloning using simple-git package
- Clone directly into E2B sandbox environments
- API endpoint: `/app/api/clone-repository/route.ts`
- Supports public and private repositories (with authentication)
- Git operations preserved within sandbox sessions

### Payment System (Polar.sh)
- Subscription and usage-based billing
- Checkout flow: `/app/api/checkout/route.ts`
- Customer portal: `/app/api/portal/route.ts` 
- Webhook handling: `/app/api/webhook/polar/route.ts`
- Product configuration and tier management

### Development Commands
- `npx @better-auth/cli generate` - Generate auth database schema
- `npx @better-auth/cli migrate` - Run database migrations
- `npx convex dev` - Start Convex development server
- `npm run dev` - Start Next.js with Turbopack (includes all services)