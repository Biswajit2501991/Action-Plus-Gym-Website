# Action Plus Gym Website

Premium Next.js 15 marketing site + CMS admin for **Action Plus Gym**, connected to the existing Supabase Gym Manager (`visitors` + `staff_users`).

## Stack

- Next.js 15 · React · TypeScript · Tailwind CSS · Framer Motion
- Supabase (content CMS + lead capture + staff auth)
- Railway deploy (`standalone` Docker) · GoDaddy DNS

## Features (MVP)

- Luxury dark/gold public site (hero, stats, services, pricing, trainers, gallery, videos, testimonials, hours, Google reviews cache, contact/join forms)
- Configurable popup offer
- Lead forms insert into Gym Manager `visitors` (`website`, `website_trial`, `website_contact`)
- Admin CMS with section toggles, popup editor, settings, content manager
- Staff login reuses Gym Manager credentials
- SEO: metadata, Open Graph, JSON-LD, sitemap, robots

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

- Site: http://localhost:3001  
- Admin: http://localhost:3001/admin/login  
- Website CMS: http://localhost:3001/admin/website

## Deploy

See [docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md).

## Gym Manager

Website leads appear in https://app.gymactionplus.com/ under Visitors.
