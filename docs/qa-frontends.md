# Parallel QA frontends

These run on the existing Ubuntu host, separately from the public applications.

| App | Hostname | Directory | PM2 name | Loopback port |
| --- | --- | --- | --- | --- |
| Dashboard | `dashboard-qa.5.252.52.243.sslip.io` | `/var/www/localvip-dashboard-qa` | `localvip-dashboard-qa` | 3101 |
| Customer app | `my-qa.5.252.52.243.sslip.io` | `/var/www/localvip-app-qa` | `localvip-app-qa` | 3102 |

The QA frontends must point to the separate QA backend at `https://qa-new.209.126.85.224.sslip.io`. Do not start them against the backend that is being promoted to production. Do not copy either public `.env.production` file: it contains credentials and URLs that cross environments.

Create each directory and a mode-600 `.env.production` first. Required dashboard values:

```env
NEXT_PUBLIC_APP_URL=https://dashboard-qa.5.252.52.243.sslip.io
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard-qa.5.252.52.243.sslip.io
NEXT_PUBLIC_WEBAPP_URL=https://my-qa.5.252.52.243.sslip.io
NEXT_PUBLIC_QA_AUTH_BASE_URL=https://qa-new.209.126.85.224.sslip.io
NEXT_PUBLIC_DEPLOY_ENV=qa
QA_AUTH_STATE_SECRET=<unique random secret>
QA_AUTH_CLIENT_ID=<QA registered client>
QA_AUTH_REDIRECT_URI=https://dashboard-qa.5.252.52.243.sslip.io/
QA_AUTH_POST_LOGOUT_REDIRECT_URI=https://dashboard-qa.5.252.52.243.sslip.io/login
```

Required customer app values:

```env
APP_PUBLIC_URL=https://my-qa.5.252.52.243.sslip.io
NEXT_PUBLIC_SITE_URL=https://my-qa.5.252.52.243.sslip.io
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard-qa.5.252.52.243.sslip.io
NEXT_PUBLIC_QA_API_URL=https://qa-new.209.126.85.224.sslip.io
QA_AUTHORITY=https://qa-new.209.126.85.224.sslip.io
NEXT_PUBLIC_DEPLOY_ENV=qa
LOCALVIP_SESSION_SECRET=<unique random secret>
QA_AUTH_CLIENT_ID=<QA registered client>
```

Add only other QA-specific keys needed by each app. Do not add Supabase credentials. Register the QA OIDC redirect and logout URLs on the QA backend. Keep Stripe test keys and test webhooks on QA. Review email, push, Google sign-in and other outbound services before enabling them.

Build and deploy a reviewed commit as a Git archive to the corresponding server script (`scripts/deploy-qa-dashboard.sh` here; `scripts/deploy-qa-app.sh` in the customer repo). These scripts require the QA config and refuse a production or Supabase target. Run them with `bash <script> <archive>`; they build in a separate directory, restart only the QA PM2 process, and check the loopback port. Never use the production deploy scripts for QA.

The `sslip.io` names resolve to `5.252.52.243` without DNS changes. Add separate nginx server blocks proxying 3101 and 3102, obtain certificates with certbot, and check both public URLs. `https://dashboard.localvip.com/qa` and `https://my.localvip.com/qa` can redirect to these isolated hosts. They cannot serve the QA builds in place: existing root-relative API calls and same-host cookies would mix QA with production. Until the QA backend, OIDC registrations, URL audit, and certificates are ready, do not expose the QA frontends.

Known remaining cross-environment links: some campaign flyer and QR generation paths and older portal links still embed `my.localvip.com` or `localvip.com`. QA-generated links must be inspected before sharing them externally. The QA customer app uses a host-only referral cookie when `NEXT_PUBLIC_DEPLOY_ENV=qa`.
