# 444RADIO.CO.IN - Quick DNS Setup Guide
# ===========================================

## IMMEDIATE ACTION REQUIRED:
## Update GoDaddy DNS Records

### Step 1: Log into GoDaddy
1. Visit: https://godaddy.com
2. Sign in to your account
3. Go to "My Products" → "Domains"
4. Find "444radio.co.in" → Click "DNS"

### Step 2: Add Required Records

#### RECORD 1: Root Domain
- **Type:** A
- **Name:** @ (leave blank)
- **Value:** 216.198.79.1
- **TTL:** 600

#### RECORD 2: WWW Subdomain
- **Type:** CNAME
- **Name:** www
- **Value:** 092434441cef6182.vercel-dns-017.com.
- **TTL:** 600

### Step 3: Save & Verify
1. Click "Save" at bottom of page
2. Wait 5-30 minutes for DNS propagation
3. Check Vercel dashboard - should show "Valid Configuration"

### Step 4: Test
- Visit: https://444radio.co.in
- Should load your website
- Test all pages and authentication

## TROUBLESHOOTING:
- If "Invalid Configuration" persists, double-check record values
- Clear DNS cache: ipconfig /flushdns (Windows)
- Try incognito/private browsing mode
- Contact GoDaddy support if issues persist

## OPTIONAL ENHANCEMENTS:
- Add Cloudflare for better performance and security
- Set up custom email (MX records)
- Add SSL certificates
- Configure domain redirects

## IMPORTANT:
- Do NOT delete existing records without backing them up
- DNS changes may take up to 24 hours to fully propagate
- Keep this file for future reference