# AVANA

AVANA is a full-stack commerce and operations platform for a traceable product business. The application combines a customer storefront with secure checkout, inventory workflows, customer accounts, traceability, transactional messaging, and a protected administration area.

This repository contains the public portfolio version of the project. Production credentials, customer data, payment data, and operational records are intentionally kept outside Git.

## Highlights

- Next.js App Router application with TypeScript and React
- Responsive storefront with search, filtering, product variants, cart persistence, and checkout flows
- Stripe-hosted payments with server-side validation, stock reservations, webhook processing, refunds, and fulfillment states
- Supabase-backed catalog, inventory, orders, customer accounts, traceability, documents, and row-level security
- Magic-link authentication and protected administrative sessions with TOTP support
- Transactional email, newsletter consent, unsubscribe flows, and operational notifications
- Inventory, lot, supplier, order, customer, B2B, marketing, and reporting workflows
- Security-focused API boundaries, rate limiting, input validation, audit logging, and automated checks

## Technology

- Next.js 16
- React 19
- TypeScript
- Supabase and PostgreSQL
- Stripe
- Resend
- Vitest
- Playwright
- ESLint and Prettier

## Requirements

- Node.js 20.9.0 or newer
- npm
- Supabase for persistent data and authentication
- Stripe for payment processing
- Resend for transactional email

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

The default example configuration keeps commerce disabled. To enable integrations locally, provide your own development credentials in `.env.local`. Never commit that file or any production credential.

## Configuration

Use `.env.example` as the configuration reference. The application expects environment variables for the site URL, Supabase, administration, Stripe, email delivery, scheduled tasks, and business settings.

Generate strong values for `SESSION_SECRET` and `CRON_SECRET` with a password manager or a local cryptographic tool. Store all real values in the deployment platform's encrypted environment settings.

The `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret key, webhook secret, email API key, administrator password, TOTP secret, and cron secret must remain server-side. They must never be exposed through a `NEXT_PUBLIC_` variable.

## Commands

```bash
npm run dev              # Start the development server
npm run build            # Create a production build
npm run start             # Start the production server
npm run typecheck         # Run TypeScript validation
npm run lint              # Run ESLint
npm test                  # Run the unit and security test suite
npm run test:e2e          # Run browser tests
npm run security:secrets  # Scan tracked and local project files
npm run readiness:test    # Validate test-mode configuration
npm run format:check      # Check formatting
```

## Production deployment

1. Create a Supabase project and apply the SQL in `supabase/commerce.sql` or the required migrations.
2. Configure Auth redirect URLs for the deployment domain.
3. Add production environment variables to the hosting provider, never to Git.
4. Deploy with `NEXT_PUBLIC_COMMERCE_ENABLED=false` while validating the environment.
5. Configure Stripe webhooks and verify a complete test checkout.
6. Configure transactional email delivery and domain authentication.
7. Review the launch checks in the administration area before enabling commerce.
8. Enable `NEXT_PUBLIC_COMMERCE_ENABLED=true` only after staging validation is complete.

## Security

Security is part of the application design. The repository includes protected server routes, database policies, validation, rate limits, signed webhook handling, and automated secret scanning. See [SECURITY.md](SECURITY.md) for the responsible disclosure policy and the SQL documentation in `docs/security/` for deployment considerations.

Do not open issues containing credentials, personal data, private customer information, or production logs. Revoke any credential immediately if it is accidentally exposed.

## Portfolio scope

The public repository is intended to demonstrate architecture, implementation quality, security practices, and product thinking. It does not include production databases, customer records, private documents, payment credentials, or deployment secrets.

## License

No open-source license has been selected for this project. All rights remain with the project owner unless a separate license is added to the repository.
