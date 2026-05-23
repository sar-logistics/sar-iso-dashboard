# SAR ISO Tank Business Dashboard

Internal management dashboard for SAR's ISO tank leasing & logistics business.

**Stack:** Next.js 14 · MongoDB Atlas · NextAuth (Google) · Google Sheets API · Tailwind · Vercel

---

## Phase 1 Setup (you do this once)

### 1. Clone and install
```bash
git clone <your-repo-url>
cd sar-iso-dashboard
npm install
```

### 2. Create accounts and gather credentials

**MongoDB Atlas** — https://cloud.mongodb.com
- Create free M0 cluster in Mumbai region
- Database Access → add user (note the password)
- Network Access → allow `0.0.0.0/0`
- Connect → Drivers → copy connection string (replace `<password>`)

**Google Cloud Console** — https://console.cloud.google.com
- New project: `sar-iso-dashboard`
- APIs & Services → Enable: **Google Sheets API**
- APIs & Services → Credentials:
  - **OAuth consent screen**: External, app name `SAR ISO Dashboard`, support email = your email, scopes leave default
  - **OAuth 2.0 Client ID**: Web application
    - Authorized JavaScript origins: `http://localhost:3000`
    - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
    - Save → copy **Client ID** and **Client Secret**
  - **Service Account** (for Sheets API): name `sheets-sync` → grant role "Viewer" → Done → click the account → Keys tab → Add Key → JSON → downloads a file. Open the file, you need `client_email` and `private_key`.

**Share the Google Sheet with the service account email** (the `client_email` from the JSON) as **Viewer**.

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
# MongoDB
MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/sar_iso?retryWrites=true&w=majority"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate with: openssl rand -base64 32"

# Google OAuth
GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"

# Allowlist (comma-separated)
ALLOWED_EMAILS="sanket.mane@sarlogisolutions.com,nishant.sharma@sartransport.com,mohammed.asad@sarlogisolutions.com"

# Google Sheets API (service account)
GOOGLE_SHEET_ID="1Ibw5D4-wDGkNEkLiVJAoK0InYd5k8J8zcZ3L2Eay7XY"
GOOGLE_SERVICE_ACCOUNT_EMAIL="sheets-sync@sar-iso-dashboard.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# Vercel Cron secret (any random string)
CRON_SECRET="generate with: openssl rand -base64 32"
```

> **Note on `GOOGLE_PRIVATE_KEY`**: keep the `\n` characters literal in the env value. The code converts them back to real newlines.

### 4. Run locally
```bash
npm run dev
```
Open `http://localhost:3000` → click "Sign in with Google" → use one of the allowlisted emails.

### 5. First sync
After login, on the dashboard click **Sync Now** (or `POST /api/sync/sales` with auth cookie). You should see Total Revenue load from MongoDB.

### 6. Deploy to Vercel
- Push to GitHub
- Import to Vercel → paste all env vars from `.env.local` into Vercel project settings
- Add `https://your-app.vercel.app/api/auth/callback/google` to Google OAuth redirect URIs
- Update `NEXTAUTH_URL` env var to the Vercel URL
- Vercel Cron is configured in `vercel.json` to auto-sync hourly

---

## Project Structure
```
app/
  api/
    auth/[...nextauth]/   NextAuth Google OAuth
    sync/sales/           Pull Sales Register → MongoDB
    cron/sync-all/        Hourly cron endpoint (Vercel Cron hits this)
  dashboard/              Protected dashboard pages
  login/                  Sign-in page
lib/
  mongodb.ts              MongoDB client (singleton)
  google-sheets.ts        Google Sheets API client
  auth.ts                 NextAuth config + helpers
types/
  index.ts                Shared TypeScript types
middleware.ts             Route protection
vercel.json               Cron schedule
```

## Build phases
- ✅ **Phase 1 (this commit)**: Auth + Sales sync + minimal dashboard
- ⬜ **Phase 2**: Purchase, Detention, Depot, Inventory sync routes
- ⬜ **Phase 3**: Full Sales / M&R / Finance modules with charts and slicers
- ⬜ **Phase 4**: Outstanding Report module
