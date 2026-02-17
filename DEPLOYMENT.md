# Fuanne DUPE Deployment Guide

## Prerequisites
- ✅ Wrangler installed locally in `worker/` directory
- ⚠️ **Node.js v20+ required** (you currently have v16.14.2)
- ⏳ OpenAI API key (get from https://platform.openai.com/api-keys)
- ⏳ Cloudflare account (free tier works)

## Upgrade Node.js (Required First Step)

Wrangler requires Node.js v20.0.0 or higher. You currently have v16.14.2.

### Option 1: Using nvm (Recommended)
```bash
# Install Node.js 20 LTS
nvm install --lts

# Use Node.js 20
nvm use --lts

# Verify version
node --version  # Should show v20.x.x or higher
```

### Option 2: Download from nodejs.org
1. Visit https://nodejs.org/
2. Download and install the LTS version (v20.x.x or higher)
3. Restart your terminal
4. Verify: `node --version`

## Deployment Steps

### Step 1: Log in to Cloudflare
```bash
cd worker
npx wrangler login
```
This will open a browser window for you to authenticate with Cloudflare.

### Step 2: Set Your OpenAI API Key as a Secret
```bash
npx wrangler secret put OPENAI_API_KEY
```
When prompted, paste your OpenAI API key (starts with `sk-`).

### Step 3: Deploy the Worker
```bash
npx wrangler deploy
```
After deployment, you'll see output like:
```
✨ Deployment complete! Take a look at your worker at:
https://fuanne-dupe-proxy.<your-subdomain>.workers.dev
```

**Copy this URL** - you'll need it for the next step.

### Step 4: Update app.js
Open `app.js` and replace line 8:
```javascript
WORKER_URL: 'https://fuanne-dupe-proxy.YOUR_SUBDOMAIN.workers.dev',
```
with your actual worker URL:
```javascript
WORKER_URL: 'https://fuanne-dupe-proxy.<your-subdomain>.workers.dev',
```

### Step 5: Test Locally
Open `index.html` in your browser to test the app, or deploy to GitHub Pages.

## Troubleshooting

- **Node version warnings**: These are just warnings. Wrangler should still work with Node v16, though Node 20+ is recommended.
- **CORS errors**: Make sure your frontend origin is in the `ALLOWED_ORIGINS` in `wrangler.toml`
- **API key errors**: Double-check that the secret was set correctly: `npx wrangler secret list`
