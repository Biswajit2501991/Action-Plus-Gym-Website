# Deploy Action Plus Gym to Railway + GoDaddy DNS

## 1. Prepare environment variables

In Railway → your service → Variables, set:

```
NEXT_PUBLIC_SUPABASE_URL=https://oddggoiyckyxolmqqjrf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase>
SUPABASE_SERVICE_ROLE_KEY=<optional service role for privileged ops>
ADMIN_SESSION_SECRET=<long random string 32+ chars>
NEXT_PUBLIC_SITE_URL=https://actionplusgym.com
NEXT_PUBLIC_GYM_ID=48815df4-6144-40dd-bbd6-91fd8522d1ff

# Optional — live Google reviews on the homepage slider
GOOGLE_PLACES_API_KEY=<Google Cloud Places API key>
GOOGLE_PLACE_ID=<optional Place ID; otherwise text search is used>
GOOGLE_PLACE_QUERY=Action Plus Gym and Fitness Club Adra West Bengal
NEXT_PUBLIC_GOOGLE_REVIEWS_URL=https://www.google.com/search?q=Action+Plus+Gym+and+Fitness+Club+Reviews
```

Enable **Places API (New)** in Google Cloud. The homepage shows up to 10 top reviews in a slider; after the 10th slide a **Check Google Reviews** button opens your Google listing. Reviews refresh automatically about every 6 hours when the API key is set.

## 2. Deploy on Railway

1. Create a new Railway project.
2. Connect this GitHub repo (or deploy from CLI: `railway up`).
3. Railway will build using the included `Dockerfile` (`output: 'standalone'`).
4. Confirm the service exposes port `3000`.
5. Open the Railway-generated URL and verify the homepage loads.

## 3. Custom domain on Railway

1. Railway → Service → Settings → Networking → Custom Domain.
2. Add `actionplusgym.com` and `www.actionplusgym.com`.
3. Railway shows the required DNS records (usually a `CNAME` for `www` and an apex record / CNAME flattening guidance).

## 4. GoDaddy DNS

In GoDaddy → Domains → actionplusgym.com → DNS:

1. For `www`: create a **CNAME** pointing to the Railway domain value.
2. For apex `@`: follow Railway’s instruction (ALIAS/ANAME if available, or Railway’s recommended A record targets).
3. Remove conflicting old A/CNAME records that point to parked GoDaddy pages.
4. Wait for DNS propagation (often 5–60 minutes).

## 5. SSL

Railway provisions HTTPS automatically once DNS validates.

## 6. Post-deploy checks

- Homepage loads with luxury theme
- Join form creates a visitor in [Gym Manager](https://app.gymactionplus.com/) with `intake_source = website`
- `/admin/login` accepts existing staff credentials
- Section toggles update the live site

## 7. Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3001
