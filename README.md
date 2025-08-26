# ZapDev

Clone, build, and deploy projects instantly with AI-powered development platform. Features git integration, authentication, real-time collaboration, and monetization.

<img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmZtaHFleGRsMTNlaWNydGdianI4NGQ4dHhyZjB0d2VkcjRyeXBucCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ZFVLWMa6dVskQX0qu1/giphy.gif" alt="ZapDev Demo" width="100%"/>



## Setup

1. **Clone & Install**
```bash
git clone https://github.com/mendableai/zapdev.git
cd zapdev
npm install
```

2. **Add `.env.local`**
```env
# Required
E2B_API_KEY=your_e2b_api_key  # Get from https://e2b.dev (Sandboxes)
FIRECRAWL_API_KEY=your_firecrawl_api_key  # Get from https://firecrawl.dev (Web scraping)

# Authentication (BetterAuth)
BETTER_AUTH_SECRET=your_random_secret  # Generate a random string
BETTER_AUTH_URL=http://localhost:3000  # Your app URL
GITHUB_CLIENT_ID=your_github_client_id  # GitHub OAuth app
GITHUB_CLIENT_SECRET=your_github_client_secret

# Database (Convex)
CONVEX_DEPLOYMENT=your_convex_deployment_url  # From npx convex dev

# Payments (Polar.sh)
POLAR_ACCESS_TOKEN=your_polar_access_token  # Get from https://polar.sh
POLAR_WEBHOOK_SECRET=your_polar_webhook_secret

# Optional (need at least one AI provider)
ANTHROPIC_API_KEY=your_anthropic_api_key  # Get from https://console.anthropic.com
OPENAI_API_KEY=your_openai_api_key  # Get from https://platform.openai.com (GPT-5)
GEMINI_API_KEY=your_gemini_api_key  # Get from https://aistudio.google.com/app/apikey
GROQ_API_KEY=your_groq_api_key  # Get from https://console.groq.com (Fast inference - Kimi K2 recommended)
```

3. **Run**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)  

## License

MIT
