# Deployment Guide for AI Video Generator

This guide covers the deployment process for both **cPanel Hosting** (Apache/Nginx) and **Cloudflare Workers/Pages**.

## Prerequisites

- Node.js (v18+) and npm installed.
- A Cloudflare account (for Cloudflare deployment).
- Access to cPanel File Manager or FTP (for cPanel deployment).

## Environment Variables

The application relies on the following environment variables:

- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `VITE_PLATFORM`: Target platform (`cpanel` or `cloudflare`).

**Note:** Since this is a client-side application, these variables are embedded into the build artifacts. You must provide them at build time.

## 1. cPanel Deployment

Target: Standard shared hosting with Apache or Nginx.

### Setup

1.  Copy `.env.cpanel.example` to `.env.cpanel`:
    ```bash
    cp .env.cpanel.example .env.cpanel
    ```
2.  Edit `.env.cpanel` and add your `GEMINI_API_KEY`.

### Build

Run the cPanel build script:

```bash
npm run build:cpanel
```

This will create a `dist` directory containing the production build.

### Upload

1.  Access your cPanel File Manager or FTP.
2.  Navigate to your domain's public directory (e.g., `public_html`).
3.  Upload the **contents** of the `dist` folder to this directory.
4.  Ensure the `.htaccess` file is included in the upload. This file handles routing for the Single Page Application (SPA) and security headers.

### Configuration Details

-   **Routing**: The `.htaccess` file redirects all requests to `index.html` so React Router can handle them.
-   **Security**: Basic security headers are applied automatically via `.htaccess`.

---

## 2. Cloudflare Deployment

Target: Cloudflare Pages (Recommended) or Cloudflare Workers Sites.

### Setup

1.  Copy `.env.cloudflare.example` to `.env.cloudflare`:
    ```bash
    cp .env.cloudflare.example .env.cloudflare
    ```
2.  Edit `.env.cloudflare` and add your `GEMINI_API_KEY`.

### Build

Run the Cloudflare build script:

```bash
npm run build:cloudflare
```

This will create a `dist-worker` directory.

### Deploy via Wrangler (CLI)

**Recommended Method:** Use the provided deployment script which handles the build and deploy in one step.

```bash
npm run deploy:cloudflare
```

This command runs:
1. `npm run build:cloudflare` (Builds to `dist-worker`)
2. `wrangler pages deploy dist-worker` (Deploys the correct folder)

If you prefer to run commands manually:

```bash
# 1. Build
npm run build:cloudflare

# 2. Deploy
npx wrangler pages deploy dist-worker --project-name ai-gen-realistic
```

### Deploy via Dashboard (Git Integration)

1.  Push your code to a Git repository (GitHub/GitLab).
2.  Log in to Cloudflare Dashboard -> Pages.
3.  Create a new project -> Connect to Git.
4.  Select your repository.
5.  **Build Settings**:
    -   **Framework Preset**: Vite
    -   **Build Command**: `npm run build:cloudflare`
    -   **Output Directory**: `dist-worker`
6.  **Environment Variables**:
    -   Add `GEMINI_API_KEY` in the Settings -> Environment Variables section.
    -   Add `VITE_PLATFORM` = `cloudflare`.

### Configuration Details (`wrangler.toml`)

A `wrangler.toml` file is provided for advanced configuration if you are using Cloudflare Workers or need specific routing rules.

-   **Compatibility**: `nodejs_compat` flag is set for better compatibility.
-   **Routes**: You can uncomment the `routes` section in `wrangler.toml` to map custom domains if deploying as a Worker.

---

## Troubleshooting

### "Missing entry-point" or "wrangler deploy on a Pages project" Error
-   **Cause**: Running `npx wrangler deploy` (which is for Workers) instead of `npx wrangler pages deploy` (for Pages/Static Sites).
-   **Fix**: Use `npm run deploy:cloudflare` or `npx wrangler pages deploy dist-worker`.

### cPanel: 404 Errors on Refresh
-   **Cause**: The server is trying to find a file matching the URL path instead of serving `index.html`.
-   **Fix**: Ensure the `.htaccess` file was uploaded correctly to the root directory.

### Cloudflare: API Key Errors
-   **Cause**: The `GEMINI_API_KEY` was not present during the build.
-   **Fix**: 
    -   If using CLI: Ensure `.env.cloudflare` exists and is populated.
    -   If using Git Integration: Ensure the variable is added in the Cloudflare Project Settings **before** triggering the build.

### "Vite not recognized" Error
-   **Fix**: Run `npm install` to ensure all dependencies are installed.
