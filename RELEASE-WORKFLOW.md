# QA and production release workflow

Production dashboard/customer apps use dbLocalVIP_Prod on 209.126.85.224.
QA uses dbLocalVIP_QA on 62.146.230.220. /qa links retain their existing redirects.
The QA backend is exposed through the QA dashboard origin's API/OIDC routes, forwarded over a restricted SSH tunnel; its IIS binding is loopback-only.

Release code from a Git commit, never by copying the QA database/configuration over production.
1. Make a feature branch from this production baseline. Preserve unrelated local work.
2. Build and deploy that commit to QA with QA-only settings and Stripe test credentials.
3. Verify login/registration, business/cause setup, deal visibility, Stripe test payments, transaction history, access checks and backups. No real charges are required for QA validation.
4. Back up production SQL/uploads/configuration. Apply additive/schema migrations with preservation checks. Legacy schema reconciliation scripts are under ops/production-20261012; review before use on another database.
5. Deploy the exact verified commit to production using production configuration, keys and uploads. Check public routes and restore the prior build if verification fails.
6. Preserve current production data when rolling back code; do not overwrite new transactions with an old SQL backup.

Environment secrets, signing keys, database backups, uploads and build outputs stay outside Git.
The production baseline includes the Stripe dashboard links, web checkout via Stripe PaymentIntents, and settled Stripe bonus-wallet status support. Current-month bonus credits retain their existing monthly schedule.
