# Fuanne DUPE - Internal Knowledge Assistant

A modern, glass-inspired web app that lets internal employees ask questions about company policies and procedures. Built as a hybrid: your custom branded shell wraps OpenAI's ChatKit for the chat engine, with a fallback to direct API calls.

## Project Structure

```
├── index.html              # Main web app (glass shell + ChatKit embed)
├── styles.css              # Glass-inspired UI styles
├── app.js                  # ChatKit integration + fallback chat logic
├── worker/
│   ├── worker.js           # Cloudflare Worker (session tokens + API proxy)
│   └── wrangler.toml       # Worker configuration
└── README.md
```

## How It Works

The app has two modes:

1. **ChatKit mode** (preferred): When OpenAI's ChatKit JS library loads from CDN, it mounts an embedded chat widget inside your glass-themed shell. The Cloudflare Worker creates secure session tokens.

2. **Fallback mode**: If ChatKit CDN isn't available, the app renders its own chat UI and sends messages through the Cloudflare Worker to OpenAI's Responses API.

Both modes are wrapped in your custom glassmorphism design with the sidebar, branding, and animated background.

## Setup Guide

### Prerequisites

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- An [OpenAI Platform account](https://platform.openai.com) with an API key
- An Agent Builder workflow (your workflow ID: `wf_6993855a26d4819091b1bba88fc45c580afdc0b8f95265d1`)
- Node.js installed (for the Wrangler CLI)

### Step 1: Rotate Your API Key

If your previous API key was exposed, generate a new one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### Step 2: Deploy the Cloudflare Worker

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. Log in to Cloudflare:
   ```bash
   wrangler login
   ```

3. Navigate to the worker directory:
   ```bash
   cd worker
   ```

4. Set your OpenAI API key as a secret:
   ```bash
   npx wrangler secret put OPENAI_API_KEY
   ```
   Paste your new API key when prompted.

5. Deploy:
   ```bash
   npx wrangler deploy
   ```

6. Copy the worker URL it outputs (e.g., `https://fuanne-dupe-proxy.your-subdomain.workers.dev`)

### Step 3: Configure the Frontend

Open `app.js` and update the `CONFIG` object:

```javascript
const CONFIG = {
    WORKER_URL: 'https://fuanne-dupe-proxy.YOUR_SUBDOMAIN.workers.dev',
    WORKFLOW_ID: 'wf_6993855a26d4819091b1bba88fc45c580afdc0b8f95265d1',
};
```

Replace `YOUR_SUBDOMAIN` with your actual Cloudflare Workers subdomain.

### Step 4: Deploy to GitHub Pages

1. Push your code to the `main` branch of your GitHub repo
2. Go to repo Settings > Pages
3. Under "Source", select "Deploy from a branch"
4. Choose `main` branch and `/ (root)` folder
5. Click Save

Your site will be live at: `https://fufunafu.github.io/Fuanne-DUPE/`

### Step 5 (Optional): Custom Domain

1. In GitHub repo Settings > Pages > Custom domain, enter your domain
2. Add a CNAME record pointing to `fufunafu.github.io`
3. Enable "Enforce HTTPS"
4. Update `ALLOWED_ORIGINS` in `worker/wrangler.toml` to include your custom domain

## Allowed Domains (CORS)

The `ALLOWED_ORIGINS` setting in `worker/wrangler.toml` controls which websites can use your API proxy. Update it to match your deployment:

```toml
[vars]
ALLOWED_ORIGINS = "https://fufunafu.github.io,http://localhost:3000,https://your-custom-domain.com"
```

## Local Development

Open `index.html` directly in a browser for demo mode. For full functionality:

```bash
cd worker
npx wrangler dev
```

Then temporarily set `WORKER_URL` in `app.js` to `http://localhost:8787`.

## Security

- API key is stored as a Cloudflare Workers secret (never in frontend code)
- CORS restricts which origins can call your worker
- ChatKit session tokens are short-lived and user-scoped
- No conversation data is stored server-side
