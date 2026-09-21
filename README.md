# AVANA

A modern e-commerce and operations platform built with Next.js. It includes storefront browsing, secure checkout, customer account flows, traceability and inventory management, email notifications, and an administration dashboard.

## Features

- Product catalog and storefront with product filters and cart persistence
- Stripe-hosted checkout flow with reservation logic and stock management
- Customer account features with magic-link authentication
- Admin dashboard for products, orders, stock, reports, and operational workflows
- Newsletter and transactional email flows
- Supabase-backed data model and server-side configuration checks

## Requirements

- Node.js 20.9.0 or newer
- npm
- A Supabase project
- A Stripe account for checkout/webhooks
- A Resend account for transactional emails

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Important: do not commit `.env.local` or any real credentials. Keep all secrets in your host environment or a secrets manager.

## Environment setup

Copy the values from `.env.example` and set the required variables in your deployment platform or local `.env.local` file.

Minimum required variables for a working local app:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_TOTP_SECRET`
- `SESSION_SECRET`
- `CRON_SECRET`

## Production checks

Before shipping, validate the environment with:

```bash
npm run readiness:test
npm run readiness
```

The test-mode readiness check validates the presence of development/test credentials without exposing secrets. The production check expects your live environment values.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
npm test
npm run security:secrets
```

## Security notes

- Never commit `.env`, `.env.local`, or any generated credentials.
- Keep service-role keys and webhook secrets only in the deployment environment.
- Use strong random values for `SESSION_SECRET` and `CRON_SECRET`.
- Use example/test values in `.env.example` only.

## License

This project is provided as-is for development and deployment. Adjust the licensing terms to match your distribution model before public release.
npm audit --audit-level=moderate
```

La CI GitHub exécute aussi le formatage, les types, ESLint, les tests unitaires, la compilation, les tests Playwright sur ordinateur et mobile, la détection de secrets, l’audit des dépendances, des tests PostgreSQL concurrents et CodeQL. Configurer le contrôle **Security gate** comme obligatoire dans les règles de la branche principale ; sa présence dans le workflow ne configure pas à elle seule le blocage des fusions.

Le [rapport de phase 1](SECURITY_HARDENING_2026-09-14.md) conserve l’état initial (141 tests Vitest et 18 tests navigateur). La [phase 2 ciblée](SECURITY_PHASE2_2026-09-14.md) ajoute les tests de révocation admin, la comparaison de schémas et quatre tests PostgreSQL avec connexions indépendantes. La configuration cloud, les migrations SQL jusqu’à la version 6 et les vérifications de staging restent nécessaires ; ces résultats locaux n’autorisent pas à eux seuls une mise en production.

Les tests `tests/security/database-behavior.test.ts` exécutent le SQL réel dans PostgreSQL embarqué (PGlite), avec isolation RLS entre comptes, mutations interdites, transactions de paiement et reprise des webhooks. Les tests de session admin utilisent également ce SQL réel. `npm run test:postgres` exige une instance PostgreSQL locale jetable dédiée et vérifie les verrouillages entre connexions indépendantes. Voir [la préparation, le périmètre et les limites](supabase/tests/README.md) : les politiques déployées, Storage HTTP, Supabase Auth et les interactions Stripe/cron doivent aussi être validés en staging.

## Responsabilités hors code

Le logiciel est prêt à recevoir la configuration de production, mais aucun code ne peut remplacer ces validations humaines :

- identité légale, coordonnées commerciales, prix, stocks, lots et documents réels ;
- inscription fiscale et configuration des taxes selon les obligations d’AVANA ;
- conformité des étiquettes, allégations, quantités nettes et informations bilingues ;
- approbation des politiques de vente, livraison, retours, confidentialité et consentement marketing ;
- contrats fournisseurs, importation, assurance, transport et procédure de rappel ;
- ouverture, vérification et financement des comptes Supabase, Stripe, Resend, Vercel et Postes Canada.

Ne publier aucune donnée marquée `Démo` ou `Hypothèse` comme une affirmation réelle. Faire approuver les textes juridiques et réglementaires avant d’accepter des commandes.
