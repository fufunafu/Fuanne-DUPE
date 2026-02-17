# GitHub Pages Deployment Guide

## Quick Deploy (Automatic)

I've set up GitHub Actions to automatically build and deploy when you push to `master`.

### Steps:

1. **Enable GitHub Pages in your repository:**
   - Go to: https://github.com/fufunafu/Fuanne-DUPE/settings/pages
   - Under "Source", select: **GitHub Actions**
   - Click **Save**

2. **Push your code:**
   ```bash
   git add .
   git commit -m "Set up GitHub Pages deployment"
   git push origin master
   ```

3. **Wait for deployment:**
   - Go to: https://github.com/fufunafu/Fuanne-DUPE/actions
   - Watch the workflow run
   - When it completes, your site will be live at:
     **https://fufunafu.github.io/Fuanne-DUPE/**

## Manual Deploy (Alternative)

If you prefer to deploy manually:

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Deploy the dist folder:**
   - Option A: Use `gh-pages` package
     ```bash
     npm install -D gh-pages
     # Add to package.json scripts:
     # "deploy": "npm run build && gh-pages -d dist"
     npm run deploy
     ```
   
   - Option B: Copy dist folder to a `gh-pages` branch
   - Option C: Use GitHub Pages settings → Deploy from a branch → Select `dist` folder

## Important Notes

- **Base Path**: The Vite config is set to `/Fuanne-DUPE/` to match your GitHub Pages URL
- **Build Output**: Files are built to the `dist/` folder
- **Automatic**: GitHub Actions will rebuild on every push to `master`

## Troubleshooting

- **404 errors?** Make sure the `base` path in `vite.config.js` matches your repo name
- **Build fails?** Check GitHub Actions logs for errors
- **Styles not loading?** Verify paths are relative (Vite handles this automatically)

## Your Live URL

Once deployed:
**https://fufunafu.github.io/Fuanne-DUPE/**
