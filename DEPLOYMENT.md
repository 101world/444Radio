# 444 RADIO - Deployment Guide

## Quick Deploy to Vercel

### Option 1: Vercel Git Integration (Recommended - Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import this repository: `101world/444Radio`
4. Configure environment variables (see below)
5. Click "Deploy"

**That's it!** Vercel will automatically deploy on every push to master.

### Option 2: GitHub Actions Auto-Deploy

To enable automatic deployments via GitHub Actions:

1. Get your Vercel credentials:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and link project
   vercel login
   vercel link
   
   # Get your credentials from .vercel/project.json
   ```

2. Add these secrets to GitHub repository (Settings → Secrets and variables → Actions):
   - `VERCEL_TOKEN` - Your Vercel API token
   - `VERCEL_ORG_ID` - From .vercel/project.json
   - `VERCEL_PROJECT_ID` - From .vercel/project.json

3. Push to master branch - deployment will happen automatically!

### Option 3: Manual Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

## Required Environment Variables

Set these in Vercel dashboard (Project Settings → Environment Variables):

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
- `PG_CONNECTION_STRING` - PostgreSQL connection string for migrations

### Clerk (Authentication)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Public key
- `CLERK_SECRET_KEY` - Secret key

### R2 Storage (Cloudflare)
- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET_NAME` - Bucket name

### AI Services
- `REPLICATE_API_KEY` - For AI music generation

### Monitoring (Optional)
- `SENTRY_DSN` - For error tracking
- `NEXT_PUBLIC_SENTRY_DSN` - Public Sentry DSN

## Post-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Clerk webhook configured (if using)
- [ ] Custom domain configured (optional)
- [ ] SSL/TLS verified
- [ ] Test core flows: signup, login, create track, play audio

## Current Deployment Status

✅ CI/CD pipeline configured
✅ Automatic builds on push to master
✅ TypeScript type checking
✅ ESLint validation
✅ Database migration support
⚠️ Deployment requires Vercel secrets or Git integration

## Troubleshooting

**Build fails with "Cannot find module"**
- Check all dependencies are in package.json
- Run `npm ci` locally to verify

**Environment variables not working**
- Verify variable names match exactly
- Check they're set for Production environment in Vercel
- Redeploy after adding new variables

**Database connection fails**
- Verify PG_CONNECTION_STRING is correct
- Check Supabase project is not paused
- Ensure service role key has proper permissions

## Support

For issues, check:
- GitHub Actions logs: https://github.com/101world/444Radio/actions
- Vercel deployment logs in dashboard
- Browser console for client-side errors
