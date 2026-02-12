# Deploying IOU Website to Cloudflare Pages

Your Vite frontend is already configured for deployment. Output goes to `dist/` with relative paths (`base: './'`), which works well on Cloudflare Pages.

---

## Option 1: Git Integration (recommended)

1. **Sign in** to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.

2. **Connect your repo** (GitHub/GitLab).

3. **Configure build settings:**
   - **Project name:** `iou-website` (or your choice)
   - **Production branch:** `main`
   - **Root directory:** `frontend` (important: your frontend is in a subfolder)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`

4. **Environment variables** (if needed): Add any in the dashboard. None required for this static site.

5. **Save** and deploy. Cloudflare will build and deploy on each push to `main`.

**If using Workers with custom deploy command** (`npx wrangler deploy`):
- Set **Build command:** `npm run build` (must run first so `dist/` exists)
- Set **Deploy command:** `npx wrangler deploy`
- The `wrangler.jsonc` in this folder configures the `dist/` assets.

---

## Option 2: Direct deploy with Wrangler CLI

1. **Install Wrangler** (if not already):
   ```bash
   npm install -g wrangler
   ```

2. **Log in:**
   ```bash
   npx wrangler login
   ```

3. **Build and deploy:**
   ```bash
   cd frontend
   npm run deploy
   ```
   Or manually:
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name=iou-website
   ```

4. On first run, Wrangler will prompt you to create the project. After that, it deploys directly.

---

## Custom domain

1. In **Workers & Pages** → your project → **Custom domains**.
2. Add your domain (e.g. `iouapp.co`).
3. Update DNS as instructed (Cloudflare provides a CNAME target).

---

## Notes

- **Root directory:** For Git integration, always set `frontend` as the root so the build runs from there.
- **Preview builds:** Each PR gets a preview URL when using Git integration.
- **Free tier:** Cloudflare Pages free tier is suitable for this static site.
