# Executive Summary

Date du contre-audit : 11 septembre 2026.

Le contre-audit a repris l'architecture, les routes, les fonctions SQL, les flux Stripe, les politiques RLS, les uploads, les dépendances, les secrets et les 13 constats de `SECURITY_AUDIT.md`. Il a ensuite appliqué les correctifs disponibles dans le dépôt, ajouté des tests de régression et tenté des contournements par rejeu, concurrence, changement d'identifiant, propriétés supplémentaires, corps trompeurs et appels directs d'API.

- Aucun P0 ou P1 corrigeable uniquement dans le dépôt ne reste ouvert après cette passe.
- Les montants, taxes, livraison, stock et états de paiement restent autoritatifs côté serveur et dans les transactions SQL.
- Le checkout, les webhooks et les remboursements disposent maintenant d'une idempotence liée à l'opération métier et de corrélations Stripe strictes.
- Les documents ne sont plus servis depuis un bucket public : ils sont validés, renommés, stockés en privé et téléchargés par des routes contrôlées.
- Les 53 tests Vitest, les 14 scénarios Playwright, le typecheck, le lint, le formatage et le build passent.
- `npm audit` ne détecte aucune vulnérabilité connue et le scan local ne détecte aucun secret connu dans 233 fichiers.
- L'environnement actuel n'est pas une production configurée : la vérification de préparation bloque sur 20 paramètres obligatoires. La migration distante, les tests RLS multi-utilisateurs, Stripe Live, le webhook réel, les sauvegardes et l'infrastructure doivent encore être validés avec des accès externes.

Le score numérique est volontairement omis : il ne constituerait pas une certification et mélangerait la sécurité du code, désormais substantiellement durcie, avec une infrastructure de production encore non configurée.

# Architecture

## Composants

- **Application** : Next.js 16.3.5, React 19.3.0 et TypeScript, App Router, Route Handlers et Proxy Next.js.
- **Validation** : Zod 4.1.12, DTO explicites et lecteurs de corps HTTP bornés.
- **Base et identité** : Supabase Auth, PostgreSQL, RLS, RPC `SECURITY DEFINER` et client serveur `service_role`.
- **Paiement** : Stripe Checkout hébergé et Stripe Webhooks ; aucune donnée de carte, CVV ou CVC n'est collectée par AVANA.
- **Courriels** : Resend pour les confirmations, notifications et liens d'accès.
- **Fichiers** : Supabase Storage avec bucket public réservé aux images de produits et bucket privé pour tous les documents.
- **Hébergement prévu** : Vercel derrière son proxy/CDN ; `x-forwarded-for` est utilisé comme IP client parce que Vercel documente qu'il le remplace pour empêcher l'usurpation directe ([documentation Vercel](https://vercel.com/docs/headers/request-headers)).
- **CI/CD** : GitHub Actions, `npm ci`, tests, lint, build, audit de dépendances, scan de secrets et CodeQL avec actions épinglées par SHA.
- **Conteneurs** : aucun Dockerfile de production dans le dépôt ; les contrôles Docker sont `NON APPLICABLE`.

## Frontières de confiance

1. Internet et navigateur non fiable vers Vercel/Next.js.
2. Next.js vers Supabase avec session utilisateur ou clé privilégiée strictement serveur.
3. Next.js vers Stripe pour la création de Checkout et les remboursements.
4. Stripe vers le webhook signé, puis transaction SQL atomique.
5. Next.js vers Resend et les opérateurs de livraison.
6. Administrateur authentifié par mot de passe, TOTP et cookie de session signé vers les API administrateur.

## Actifs critiques

Comptes clients et administrateur, cookies et refresh tokens, secret TOTP, clé Supabase `service_role`, clés Stripe, secret webhook, données personnelles, commandes, montants, stock, remboursements, fichiers privés, journaux d'audit et sauvegardes.

## Surface d'attaque inspectée

- Routes publiques, authentifiées, administrateur, webhook, cron, santé, formulaires, newsletter, checkout, commandes et documents.
- Validation des paramètres, corps JSON, texte et multipart, méthodes HTTP alternatives et réponses d'erreur.
- Fonctions SQL, triggers, contraintes, RLS, privilèges Data API et stockage.
- CSP, cookies, cache, redirections, URL stockées, XSS, CSRF, CORS, SSRF et path traversal.
- Dépendances, workflows CI, fichiers d'environnement, scripts et marqueurs `TODO`, `FIXME`, `HACK`, `TEMP`, `bypass`, `disable`, `skip` et `security`.

# Threat Model

## Acteurs

- Utilisateur anonyme, bot de spam, scraper ou attaquant externe.
- Client légitime, client malveillant, fraudeur ou compte client compromis.
- Client B tentant d'accéder aux données du client A.
- Administrateur compromis ou attaquant connaissant seulement le mot de passe admin.
- Tiers compromis ou événement Stripe valide mais inattendu, rejoué ou mal corrélé.

## Menaces prioritaires

- Modifier le prix, les taxes, la livraison, la quantité, le statut payé ou l'identifiant de commande depuis le navigateur.
- Créer plusieurs commandes ou débits après double clic, perte réseau ou requêtes concurrentes.
- Rejouer un webhook, libérer le stock d'une autre commande ou appliquer deux fois un remboursement.
- Contourner les API Next.js en utilisant directement l'API Supabase.
- Lire une commande, une facture ou un fichier privé en modifiant un identifiant ou un chemin.
- Exploiter un compte admin compromis pour téléverser du contenu actif, rembourser ou modifier le stock.
- Épuiser la mémoire, les courriels, Stripe ou Supabase avec des corps volumineux et des quotas contournables.

## Matrice d'autorisation attendue et observée dans le code

| Action                      | Anonymous                                    | Client A                    | Client B | Admin                                |
| --------------------------- | -------------------------------------------- | --------------------------- | -------- | ------------------------------------ |
| Lire commande A             | Refus, sauf jeton signé limité à la commande | Autorisé                    | Refus    | Autorisé                             |
| Modifier commande A         | Refus                                        | Refus                       | Refus    | API/RPC admin contrôlée              |
| Voir profil A               | Refus                                        | Autorisé                    | Refus    | Autorisé                             |
| Modifier adresse A          | Refus                                        | API serveur avec identité A | Refus    | API serveur contrôlée                |
| Télécharger facture A       | Jeton signé limité ou refus                  | Autorisé                    | Refus    | Autorisé                             |
| Télécharger fichier interne | Refus                                        | Refus                       | Refus    | Autorisé                             |
| Administration              | Refus                                        | Refus                       | Refus    | Mot de passe + TOTP + session signée |

# Previous Audit Verification

Le rapport précédent a été relu puis confronté au code et à des tests supplémentaires. `CONFIRMÉ` signifie que le correctif et sa cause racine ont été retrouvés ; il ne signifie pas qu'une infrastructure distante non disponible a été testée.

| ID      | Affirmation précédente                | Vérification                                                                       | État final            |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------------- | --------------------- |
| SEC-001 | XSS persistant via JSON-LD            | Échappement de contexte HTML, nonce CSP et test d'injection retrouvés              | CORRIGÉ               |
| SEC-002 | Course/rejeu du webhook               | Revendication SQL atomique, états et contraintes retrouvés ; corrélation renforcée | CORRIGÉ               |
| SEC-003 | Validation Stripe incomplète          | Montants, devise, état, mode, commande et session contrôlés côté serveur/SQL       | CORRIGÉ               |
| SEC-004 | Admin sans MFA/session longue         | TOTP, session courte signée et anti-rejeu distribué retrouvés                      | CORRIGÉ               |
| SEC-005 | Corps HTTP non bornés                 | Lecteurs stream bornés ; multipart maintenant borné sur les octets réels           | CORRIGÉ               |
| SEC-006 | URL stockée insuffisamment contrainte | HTTPS externe et chemins locaux canoniques imposés                                 | CORRIGÉ               |
| SEC-007 | Écriture Supabase contournant l'API   | RLS, révocations DML et RPC réservées au `service_role` retrouvées                 | CORRIGÉ               |
| SEC-008 | CSP/cache/refresh incomplets          | Nonce par requête, CSP stricte, refresh SSR et anti-cache retrouvés                | CORRIGÉ               |
| SEC-009 | Jeton unsubscribe en clair            | Jeton HMAC et empreinte seulement en base retrouvés                                | CORRIGÉ               |
| SEC-010 | Upload PDF actif/limite tardive       | Validation et stockage privé fortement renforcés ; AV/CDR externe absent           | PARTIELLEMENT CORRIGÉ |
| SEC-011 | Lien commande valable un an           | Durée de 30 jours, signature et expiration retrouvées                              | CORRIGÉ               |
| SEC-012 | Table privilégiée pilotable par env   | Table fixe et variable supprimée retrouvées                                        | CORRIGÉ               |
| SEC-013 | CI sans SAST/audit/secrets            | Workflows durcis, SHAs immuables, CodeQL et scans retrouvés                        | CORRIGÉ               |

# Vulnerabilities

| ID      | Vulnérabilité                                                                     | Gravité | Correctif                                                              | Test                        | État                       |
| ------- | --------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- | --------------------------- | -------------------------- |
| SEC-001 | XSS persistant dans le JSON-LD produit                                            | P1      | Sérialisation HTML sûre et nonce CSP                                   | PASS                        | CORRIGÉ                    |
| SEC-002 | Rejeu/course non atomique du webhook                                              | P1      | Claim/complete/fail transactionnels et événements uniques              | PASS statique/E2E           | CORRIGÉ                    |
| SEC-003 | Paiement insuffisamment corrélé à la commande                                     | P1      | Mode, état, CAD, références, session et montants exigés                | PASS                        | CORRIGÉ                    |
| SEC-004 | Admin mono-facteur et session longue                                              | P1      | TOTP, session 2 h, signature liée aux secrets et anti-rejeu            | PASS                        | CORRIGÉ                    |
| SEC-005 | Corps HTTP non bornés avant parsing                                               | P2      | Lecture streaming bornée par type de route                             | PASS                        | CORRIGÉ                    |
| SEC-006 | URL ou chemin stocké ambigu/dangereux                                             | P2      | URL HTTPS et chemins locaux canoniques                                 | PASS                        | CORRIGÉ                    |
| SEC-007 | Mutation directe par la Data API Supabase                                         | P2      | RLS, révocations DML et RPC `service_role` seulement                   | PASS statique               | CORRIGÉ                    |
| SEC-008 | CSP permissive, cache privé et refresh incomplets                                 | P2      | Nonce, `strict-dynamic`, anti-cache et refresh SSR                     | PASS E2E                    | CORRIGÉ                    |
| SEC-009 | Jeton de désabonnement stocké en clair                                            | P2      | HMAC serveur et empreinte stockée                                      | PASS statique               | CORRIGÉ                    |
| SEC-010 | PDF actif, polyglotte ou bombe et multipart tardif                                | P2      | Validation binaire, limites, stockage privé et téléchargement forcé    | PASS, AV/CDR externe absent | PARTIELLEMENT CORRIGÉ      |
| SEC-011 | Jeton de commande trop durable                                                    | P3      | Expiration 30 jours et rotation par secret                             | PASS                        | CORRIGÉ                    |
| SEC-012 | Nom de table privilégiée configurable                                             | P3      | Nom de table constant                                                  | PASS statique               | CORRIGÉ                    |
| SEC-013 | Chaîne CI non durcie                                                              | P3      | Audit, secrets, CodeQL, permissions minimales et SHA                   | PASS local                  | CORRIGÉ                    |
| SEC-014 | Retry concurrent du checkout pouvant créer des réservations incohérentes          | P1      | `attemptId`, empreinte canonique, verrou transactionnel et unicité SQL | PASS                        | CORRIGÉ                    |
| SEC-015 | Libération de stock par session Stripe mal corrélée                               | P1      | Recherche par session et égalité metadata/référence/commande           | PASS                        | CORRIGÉ                    |
| SEC-016 | Remboursements partiels concurrents avec clés différentes                         | P1      | Clé d'idempotence liée à l'état remboursé observé                      | PASS statique               | CORRIGÉ                    |
| SEC-017 | Restock pilotable par metadata Stripe non authentifiée                            | P2      | Intention HMAC liée à commande, paiement, montant et décision          | PASS                        | CORRIGÉ                    |
| SEC-018 | Code TOTP réutilisable pendant sa fenêtre                                         | P2      | Identifiant HMAC et consommation distribuée à usage unique             | PASS                        | CORRIGÉ                    |
| SEC-019 | Sonde santé amplifiant onze requêtes privilégiées                                 | P2      | Une RPC de version bornée                                              | PASS                        | CORRIGÉ                    |
| SEC-020 | Rotation du User-Agent contournant le quota IP et spam par destinataire           | P2      | Empreinte IP stable et quotas HMAC par destinataire                    | PASS                        | CORRIGÉ                    |
| SEC-021 | `Content-Length` multipart inférieur au corps réel                                | P2      | Comptage des octets avant `formData()`                                 | PASS                        | CORRIGÉ                    |
| SEC-022 | URL de fichier opérationnel arbitraire                                            | P3      | Chemin interne généré par serveur seulement                            | PASS                        | CORRIGÉ                    |
| SEC-023 | Mélange Stripe test/live et événement facture inutile                             | P2      | Validation `livemode` et suppression du handler non requis             | PASS                        | CORRIGÉ                    |
| SEC-024 | Deadlock/duplication par ordre de variantes choisi par le client                  | P2      | Doublons refusés et verrouillage SQL trié                              | PASS statique               | CORRIGÉ                    |
| SEC-025 | Double décodage de paramètres dynamiques                                          | P3      | Validation directe des paramètres déjà décodés                         | PASS build/E2E              | CORRIGÉ                    |
| SEC-026 | Origine canonique acceptant credentials ou suffixes inattendus                    | P3      | Validation stricte scheme/credentials/path/query/hash                  | PASS                        | CORRIGÉ                    |
| SEC-027 | Absence d'antivirus/CDR et migration des anciens PDF publics non vérifiée         | P2      | Procédure documentée ; exige stockage et scanner distants              | EXTERNE                     | ACTION EXTERNE OBLIGATOIRE |
| SEC-028 | RLS, transactions concurrentes et webhooks non exécutés contre une staging réelle | P1      | Migration et tests statiques prêts ; environnement requis              | EXTERNE                     | ACTION EXTERNE OBLIGATOIRE |
| SEC-029 | Secrets, URLs et paramètres de production absents                                 | P0      | Contrôle `readiness` bloquant déjà présent                             | FAIL attendu                | ACTION EXTERNE OBLIGATOIRE |
| SEC-030 | Historique Git indisponible dans cette copie                                      | P3      | Scan du contenu courant effectué ; dépôt Git d'origine requis          | EXTERNE                     | ACTION EXTERNE OBLIGATOIRE |

## Détails des nouvelles causes racines

### SEC-014 — idempotence du checkout

- **Fichiers** : `app/api/checkout/session/route.ts`, `components/checkout-flow.tsx`, `lib/checkout-security.ts`, `lib/server/orders.ts`, `supabase/commerce.sql`, `supabase/migrations/20260911000000_security_v2.sql`.
- **Cause racine** : une tentative n'était pas liée de façon atomique à un payload canonique ; un retry pouvait recalculer des paramètres Stripe variables.
- **Scénario** : double clic, timeout ou deux requêtes simultanées avec le même identifiant mais un panier modifié.
- **Impact** : commandes multiples, réservations fantômes, conflit Stripe ou stock immobilisé.
- **Correctif** : UUID par tentative, empreinte SHA-256 du contenu serveur normalisé, verrou transactionnel, contrainte unique, rejet d'un payload différent et paramètres Stripe déterministes.

### SEC-015 à SEC-017 — corrélation Stripe et remboursements

- **Fichiers** : `app/api/webhooks/stripe/route.ts`, `app/api/admin/orders/[id]/refund/route.ts`, `lib/server/refund-security.ts`, `lib/server/stripe-checkout.ts`.
- **Cause racine** : certaines branches secondaires faisaient encore confiance à une metadata d'événement ou à une clé dépendante du montant demandé.
- **Scénario** : événement signé mais mal associé, metadata altérée ou remboursements concurrents de montants différents depuis le même état.
- **Impact** : libération de stock incorrecte, double remboursement ou remise en stock frauduleuse.
- **Correctif** : dérivation de la commande depuis les identifiants Stripe, égalités strictes, HMAC métier et idempotence liée à l'état financier persistant.

### SEC-018 à SEC-026 — défense en profondeur

- **Fichiers** : `lib/admin-auth.ts`, `app/api/admin/login/route.ts`, `lib/server/rate-limit.ts`, `lib/server/request-body.ts`, `app/api/health/route.ts`, `lib/site.ts` et routes dynamiques.
- **Causes racines** : contrôles locaux ou attributs client variables, parsing avant limite réelle, travail privilégié excessif et canonicalisation incomplète.
- **Impacts** : rejeu MFA, spam, DoS économique, paramètres ambigus et erreurs de déploiement.
- **Correctifs** : état distribué, identifiants HMAC, limite binaire, RPC santé unique et parseurs canoniques.

# Fixes Applied

## Checkout et stock

- Ajout d'un `attemptId` UUID obligatoire conservé par l'interface pendant les retries réseau.
- Empreinte canonique de l'e-mail, du contact, de l'adresse et du panier ; les prix envoyés par le client sont ignorés.
- Verrou transactionnel PostgreSQL par tentative, unicité partielle, rejet des doublons de variantes et ordre de lock déterministe.
- Réservation, prix, taxes, livraison, stock et création de commande restent calculés depuis PostgreSQL.
- Expiration de réservation et jeton de retour persistants pour rendre les paramètres Stripe identiques lors d'un retry.
- Attachement de session Stripe impossible à remplacer par une autre session.

## Stripe et webhooks

- Rejet d'un événement test en production ou live en test avant tout traitement.
- Signature Stripe, timestamp SDK, event ID atomique et état `processing/processed/failed` conservés.
- Corrélation obligatoire `metadata.orderId`, `client_reference_id`, session, PaymentIntent, devise CAD et montants serveur.
- Événement `invoice.finalized` supprimé : l'application n'écoute que les événements nécessaires, conformément aux recommandations Stripe ([webhooks Stripe](https://docs.stripe.com/webhooks?lang=node)).
- Clés Stripe idempotentes et stables pour le checkout et les remboursements, selon le mécanisme recommandé par Stripe ([idempotent requests](https://docs.stripe.com/api/idempotent_requests)).
- Restock de remboursement authentifié par HMAC et lié aux identifiants financiers attendus.

## Authentification, autorisation et anti-abus

- TOTP administrateur rendu non rejouable dans sa fenêtre d'acceptation via le rate limiter distribué.
- Toutes les API admin continuent de vérifier la session admin, pas seulement les pages.
- Rate limits liés à l'IP proxy normalisée et quotas HMAC non réversibles par adresse e-mail.
- Paramètres de commande et lot validés sans double décodage.
- Origine canonique de production limitée à une origine HTTP(S) sans credentials, chemin, query ni fragment.

## Uploads et téléchargements

- Taille maximale 8 MiB appliquée aux octets réellement lus avant parsing multipart.
- Allowlist extension/MIME/magic bytes ; faux MIME, double extension, traversal, vide et surdimensionné refusés.
- PDF limité à `%PDF-1.x`, EOF et `startxref` cohérents ; JavaScript, actions, formulaires, objets embarqués, contenu riche, chiffrement, objet stream et données après EOF refusés, y compris noms PDF obfusqués en hexadécimal.
- Images contrôlées par signature, dimensions et nombre maximal de pixels pour réduire les bombes de décompression.
- Nom serveur UUID v4, `upsert: false`, chemins canoniques et aucun nom client utilisé pour le stockage.
- Tous les documents sont privés ; seules les images de produits sont publiques.
- Routes de téléchargement avec autorisation ou preuve de publication, `Content-Disposition: attachment`, MIME serveur, `nosniff`, CSP sandbox, anti-cache et limite de taille.
- Ces contrôles suivent la défense en profondeur recommandée par l'[OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## Base, disponibilité et configuration

- Migration incrémentale `20260911000000_security_v2.sql` et baseline synchronisées, schéma version 4.
- Sonde santé réduite à une seule RPC de version.
- Bucket public modifié pour exclure les PDF.
- Contrôle de production refuse les origines avec credentials et maintient le commerce désactivé tant que la configuration n'est pas complète.

## Fichiers modifiés

- `app/api/admin/files/[...path]/route.ts`
- `app/api/admin/login/route.ts`
- `app/api/admin/orders/[id]/refund/route.ts`
- `app/api/admin/uploads/route.ts`
- `app/api/auth/magic-link/route.ts`
- `app/api/checkout/session/route.ts`
- `app/api/documents/[...path]/route.ts`
- `app/api/health/route.ts`
- `app/api/newsletter/confirm/route.ts`
- `app/api/newsletter/unsubscribe/route.ts`
- `app/api/orders/[number]/route.ts`
- `app/api/orders/access/route.ts`
- `app/api/submissions/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/commande/[number]/page.tsx`
- `components/checkout-flow.tsx`
- `lib/admin-auth.ts`
- `lib/checkout-security.ts`
- `lib/server/config.ts`
- `lib/server/lots.ts`
- `lib/server/operations.ts`
- `lib/server/order-access.ts`
- `lib/server/orders.ts`
- `lib/server/private-file-response.ts`
- `lib/server/rate-limit.ts`
- `lib/server/refund-security.ts`
- `lib/server/request-body.ts`
- `lib/server/stripe-checkout.ts`
- `lib/server/stripe.ts`
- `lib/site.ts`
- `lib/upload-security.ts`
- `lib/validation.ts`
- `types/commerce.ts`
- `scripts/check-production-env.mjs`
- `supabase/commerce.sql`
- `supabase/migrations/20260911000000_security_v2.sql`
- `tests/admin-auth.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/security.test.ts`
- `tests/security/database-security.test.ts`
- `tests/security/payment-security.test.ts`
- `tests/security/upload-security.test.ts`
- `tests/server-only.ts`
- `tests/validation.test.ts`
- `vitest.config.mts`
- `README.md`
- `SECURITY_AUDIT_V2.md`

# Security Tests

## Résultats complets

| Contrôle                    | Commande                           | Résultat                                                |
| --------------------------- | ---------------------------------- | ------------------------------------------------------- |
| Installation verrouillée    | `npm ci`                           | PASS, 430 packages                                      |
| Tests unitaires et sécurité | `npm test`                         | PASS, 8 fichiers et 53 tests                            |
| Tests E2E                   | `npm run test:e2e`                 | PASS, 14 scénarios Chromium desktop/mobile              |
| TypeScript                  | `npm run typecheck`                | PASS                                                    |
| ESLint                      | `npm run lint`                     | PASS                                                    |
| Formatage                   | `npm run format:check`             | PASS                                                    |
| Build production            | `npm run build`                    | PASS, 68 pages/routes générées                          |
| Dépendances                 | `npm audit --audit-level=moderate` | PASS, 0 vulnérabilité                                   |
| Secrets                     | `npm run security:secrets`         | PASS, aucun secret connu dans 233 fichiers              |
| Préparation production      | `npm run readiness`                | FAIL attendu, 20 bloqueurs et 2 avertissements externes |

## Tests de régression ajoutés

- `tests/security/payment-security.test.ts` : empreinte checkout, UUID, lock SQL, Stripe mode, restock HMAC, stabilité des tokens, corrélation financière et coût de la sonde santé.
- `tests/security/upload-security.test.ts` : PDF passif, PDF actif/obfusqué/polyglotte, traversal, MIME, taille, bombes images, chemins serveur et headers de téléchargement.
- `tests/security/database-security.test.ts` : RLS sur toutes les tables, révocations DML, RPC privilégiées, migration de course checkout et exclusion PDF du bucket public.
- `tests/security.test.ts` : origine canonique, corps binaire trompeur, User-Agent, quota HMAC et contrôles historiques.
- `tests/admin-auth.test.ts` : identifiant anti-rejeu TOTP non réversible.
- `tests/e2e/public.spec.ts` : upload/refund sans authentification, méthode non supportée, faux webhook, limites et headers réels.

## Limites de test

`psql` et la CLI Supabase ne sont pas installés. Le client Docker est présent mais son daemon n'est pas disponible. Les tests SQL exécutés sont donc structurels et les tests applicatifs utilisent les doubles existants ; aucune affirmation de test RLS distant ou de vraie concurrence PostgreSQL n'est faite.

# Adversarial Retests

| Tentative                                                   | Résultat attendu                               | Résultat                                 |
| ----------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Prix, taxe, total ou rôle ajouté au JSON checkout           | Ignoré/rejeté ; montant DB utilisé             | PASS                                     |
| Quantité 0, négative, décimale, excessive ou doublon SKU    | Rejet avant réservation et dans SQL            | PASS                                     |
| Même `attemptId` avec payload différent                     | Conflit, aucune deuxième commande              | PASS statique/unitaire                   |
| Retry identique après perte réseau                          | Même commande et mêmes paramètres Stripe       | PASS                                     |
| Ordre de variantes inversé en concurrence                   | Locks ordonnés, pas de deadlock induit         | PASS statique                            |
| `orderId` d'une autre commande                              | Jeton/ownership/corrélation exigés             | PASS code/E2E                            |
| Propriété `role: admin`                                     | Supprimée par DTO et mutation Data API refusée | PASS                                     |
| Appel direct d'une API admin                                | 401/403                                        | PASS E2E                                 |
| Upload sans session admin ou par GET                        | 401 et 405                                     | PASS E2E                                 |
| Corps sans longueur, longueur mensongère ou > limite        | 411/413 avant parsing coûteux                  | PASS                                     |
| PDF HTML, SVG, `.pdf.exe`, JS obfusqué ou données après EOF | Rejet                                          | PASS                                     |
| Traversal ou collision de nom                               | Rejet/UUID v4 et `upsert: false`               | PASS                                     |
| Webhook sans signature                                      | 400                                            | PASS E2E                                 |
| Webhook test/live opposé                                    | Rejet avant claim                              | PASS                                     |
| Même webhook répété                                         | Event ID atomique, traitement unique           | PASS statique ; staging requise          |
| Session expirée avec metadata d'une autre commande          | Rejet de corrélation                           | PASS                                     |
| Remboursements concurrents avec montants différents         | Même clé d'état, conflit/déduplication Stripe  | PASS statique ; Stripe staging requise   |
| Metadata de restock altérée                                 | HMAC invalide, aucun restock                   | PASS                                     |
| Même TOTP réutilisé                                         | Second usage refusé par état distribué         | PASS unitaire/statique ; staging requise |
| Rotation de User-Agent                                      | Même quota IP                                  | PASS                                     |
| User A sélectionne les données User B                       | Policy ownership retourne aucune ligne         | PASS statique ; staging requise          |

Les scénarios de coupon simultané sont `NON APPLICABLE` : aucune fonctionnalité coupon/promotion n'est implémentée dans cette version. Une commande non payée ne peut pas être déclarée payée par une route navigateur ; seule la transaction déclenchée par un événement Stripe signé et intégralement corrélé peut effectuer cette transition.

# Supabase / RLS Review

Supabase recommande d'activer RLS sur les tables exposées et de combiner policies et privilèges SQL ; le schéma suit cette approche ([RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [sécurisation de la Data API](https://supabase.com/docs/guides/api/securing-your-api)).

## Matrice SQL

| Groupe                                                         | RLS | SELECT `anon`          | SELECT `authenticated`       | INSERT/UPDATE/DELETE client | Service role         |
| -------------------------------------------------------------- | --- | ---------------------- | ---------------------------- | --------------------------- | -------------------- |
| `products`, `product_variants`                                 | Oui | Actifs seulement       | Actifs seulement             | Révoqué                     | Contrôle serveur     |
| `profiles`, `customer_addresses`                               | Oui | Aucun                  | Propriétaire/admin seulement | Révoqué                     | RPC serveur          |
| `orders`, `order_items`, `order_status_events`, `shipments`    | Oui | Aucun                  | Propriétaire/admin seulement | Révoqué                     | Transactions serveur |
| `lots` et données opérationnelles/financières                  | Oui | Aucune policy publique | Aucune policy client         | Révoqué                     | Contrôle serveur     |
| Newsletter, soumissions, analytics, marketing, audit et quotas | Oui | Aucune policy publique | Aucune policy client         | Révoqué                     | Contrôle serveur     |

- Toutes les 19 tables applicatives ont RLS activé.
- Les fonctions transactionnelles et administrateur sont révoquées à `public`, `anon` et `authenticated`, puis accordées uniquement à `service_role`.
- `reserve_order` verrouille la tentative, refuse les payloads divergents, trie les variantes et verrouille le stock avant écriture.
- Les transitions de paiement et remboursement sont centralisées dans des fonctions SQL et contraintes d'état.
- La clé `service_role` n'apparaît que dans des modules serveur et doit rester une variable de production non publique.
- Les nouvelles clés Supabase publishable/secret sont à planifier : Supabase annonce la transition hors des anciennes clés `anon`/`service_role` avant fin 2026 ([API keys Supabase](https://supabase.com/docs/guides/getting-started/api-keys)).

La migration distante et les essais Anonymous/User A/User B/Admin sur SELECT/INSERT/UPDATE/DELETE restent `ACTION EXTERNE OBLIGATOIRE` faute de projet Supabase de staging et de credentials disponibles.

# Stripe Review

- Stripe Checkout héberge la saisie carte ; AVANA ne reçoit pas le PAN ni le CVV, ce qui réduit le périmètre PCI sans l'annuler.
- Le navigateur envoie uniquement des identifiants de variantes, quantités et coordonnées ; le serveur recalcule le prix, la taxe, la livraison et le total depuis la base.
- Le checkout utilise un identifiant de tentative, une commande réservée et une clé Stripe idempotente stable. Stripe recommande ces clés pour répéter une requête sans créer une seconde opération ([idempotence Stripe](https://docs.stripe.com/api/idempotent_requests)).
- L'expiration Stripe utilise l'expiration persistée de la réservation ; Stripe limite `expires_at` à 30 minutes–24 heures ([Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)).
- Le webhook valide la signature avec le SDK, le mode live/test, l'event ID, le type requis, la commande, la session, le PaymentIntent, la devise et tous les montants.
- Les événements dupliqués sont revendiqués atomiquement. Stripe précise qu'un endpoint doit anticiper les livraisons en double et vérifier la signature ([webhooks Stripe](https://docs.stripe.com/webhooks?lang=node)).
- Un succès navigateur ne modifie jamais le statut payé.
- Les remboursements partiels et complets utilisent une clé par état financier, puis les webhooks recalculent l'état et le stock depuis les identifiants Stripe.

Validation Stripe Test puis Live, création du webhook, abonnement aux seuls événements documentés, synchronisation NTP et test de concurrence contre l'API réelle : `ACTION EXTERNE OBLIGATOIRE`.

# File Upload Review

## Contrôles présents

- Authentification administrateur avant upload.
- Taille stricte de 8 MiB vérifiée sur le flux binaire réel.
- Matrice dossier/type : images de produits seulement en public ; PDF/images internes en privé ; documents publics PDF seulement mais stockés en privé.
- Extension, MIME déclaré, magic bytes, dimensions et pixels validés ensemble.
- PDF passif uniquement, structure terminale contrôlée et marqueurs actifs/obfusqués refusés.
- Nom aléatoire UUID v4, traversal impossible, pas d'overwrite et chemins exacts validés au téléchargement.
- Document public téléchargeable seulement s'il est référencé par un lot publié et actif.
- Document interne téléchargeable seulement avec une session admin valide.
- Réponse forcée en pièce jointe, sans sniffing, sans cache et sous CSP sandbox.

## Risque restant

Le filtre interne réduit fortement les formats malveillants connus, mais ce n'est pas un antivirus, un moteur CDR ni un parseur PDF complet. Un scanner spécialisé doit analyser les fichiers en quarantaine avant publication. Les PDF déjà présents dans un ancien bucket public doivent être inventoriés, rescannés, déplacés et supprimés du bucket public. État : `ACTION EXTERNE OBLIGATOIRE`.

# Dependency Review

- `package-lock.json` est présent et `npm ci` est utilisé localement et en CI.
- Les dépendances directes sont épinglées ; aucune dépendance Git n'est déclarée.
- `npm audit --audit-level=moderate` : 0 vulnérabilité connue.
- `npm ls --depth=0` ne révèle que deux artefacts WASM optionnels de Next.js marqués extraneous après installation ; aucun avis de sécurité associé.
- Mises à jour majeures disponibles, notamment ESLint 10 et TypeScript 7, non appliquées automatiquement afin d'éviter une rupture sans campagne de compatibilité.
- Mises à jour mineures disponibles pour Playwright, Lucide, Prettier et Zod : maintenance recommandée avec tests complets, pas un bloqueur de sécurité connu à cette date.
- GitHub Actions utilise des références immuables, permissions minimales, audit, scan de secrets et CodeQL.

# Secrets Review

- `npm run security:secrets` : aucun motif de secret connu dans 233 fichiers.
- `.env.local` a été inspecté sans afficher les valeurs : toutes les variables sensibles attendues sont vides.
- `.env.local` est ignoré ; `.env.example` ne contient que des valeurs factices.
- Aucun secret Supabase, Stripe, Resend, cookie, TOTP ou cron n'est livré au navigateur dans les variables `NEXT_PUBLIC_*`.
- Le répertoire fourni ne contient pas `.git`. L'historique, les branches supprimées et les anciens commits n'ont donc pas pu être scannés. Le dépôt Git d'origine doit être analysé avant toute création de secrets live.
- Si un secret réel est trouvé dans cet historique, il doit être révoqué chez son fournisseur, pas seulement supprimé du code : `ACTION EXTERNE OBLIGATOIRE`.

# Production Blockers

## BLOQUE PRODUCTION

1. Appliquer `supabase/migrations/20260911000000_security_v2.sql` sur un projet Supabase de staging, puis production après validation.
2. Configurer une origine HTTPS publique et activer explicitement `NEXT_PUBLIC_COMMERCE_ENABLED=true` seulement après tous les contrôles.
3. Fournir les URLs et clés Supabase, dont une clé serveur secrète, et vérifier qu'aucune clé privilégiée n'est exposée au navigateur.
4. Fournir Stripe Secret et Webhook Secret, créer l'endpoint Stripe et tester le flux complet en mode Test puis Live.
5. Fournir Resend, expéditeur vérifié et destinataires de contact/commandes.
6. Fournir un mot de passe admin robuste, `SESSION_SECRET`, `ADMIN_TOTP_SECRET` et `CRON_SECRET` distincts et aléatoires.
7. Fournir l'adresse légale d'entreprise utilisée par les reçus et règles métier.
8. Exécuter les tests RLS User A/User B/Admin, concurrence de stock/webhook/remboursement et migration sur la base réelle.
9. Configurer puis tester sauvegardes, restauration, observabilité et alertes production.
10. Déployer la quarantaine/AV/CDR des documents et migrer les anciens PDF publics.

La commande `npm run readiness` refuse actuellement le démarrage production avec 20 bloqueurs correspondant à ces catégories.

## À FAIRE AVANT PRODUCTION

- Configurer téléphone d'entreprise, expéditeur, SPF/DKIM/DMARC et gabarits courriel réels.
- Connecter et tester le suivi Canada Post ou formaliser le processus manuel et ses alertes.
- Définir alertes sur échecs/retries webhook, connexions admin, remboursements, erreurs 5xx, quotas et paiements refusés.
- Tester le pipeline GitHub hébergé, les protections de branche et les environnements protégés.
- Vérifier HSTS, TLS, DNS, domaine, WAF/rate limiting d'infrastructure et journaux après déploiement.

## HARDENING

- Planifier la migration vers les nouvelles clés Supabase publishable/secret.
- Mettre à jour régulièrement les dépendances et exécuter DAST/SAST sur chaque release.
- Faire un test d'intrusion indépendant après intégration des fournisseurs et avant trafic réel.
- Définir rétention, export, anonymisation et demandes d'accès/suppression des données personnelles.

# External Actions Required

1. **Supabase** : créer staging, appliquer la migration v2, exécuter la matrice RLS et les tests concurrents, puis promouvoir en production.
2. **Stripe** : créer/valider les clés Test et Live, le webhook signé, ses événements minimaux et les scénarios paiement/remboursement/rejeu/concurrence.
3. **Secrets** : générer et stocker les secrets dans le coffre de l'hébergeur ; ne jamais les transmettre dans le dépôt.
4. **Historique Git** : scanner le dépôt d'origine complet ; révoquer toute valeur réelle historique chez Stripe, Supabase, Resend ou l'hébergeur.
5. **Fichiers** : connecter AV/CDR/quarantaine et migrer/supprimer les anciens PDF publics après inventaire.
6. **Infrastructure** : configurer domaine, TLS, HSTS observé, WAF, quotas, logs, alertes et restrictions des environnements.
7. **Résilience** : activer les sauvegardes Supabase et effectuer un test de restauration documenté.
8. **Courriels/livraison** : vérifier domaine Resend, SPF/DKIM/DMARC, destinataires et intégration Canada Post.

Aucune de ces actions n'est déclarée accomplie depuis le dépôt.

# Residual Risks

- La correction SQL est couverte structurellement, mais la sémantique réelle de PostgreSQL, RLS et des courses doit être validée sur une instance isolée.
- Les garanties Stripe dépendent aussi de la configuration Dashboard, des clés, du secret webhook, de l'horloge serveur et du mode Live.
- Un administrateur entièrement compromis peut toujours exercer ses pouvoirs légitimes ; MFA, session courte, audit et quotas réduisent ce risque sans l'éliminer.
- Le téléchargement en pièce jointe et la CSP sandbox réduisent l'impact des PDF, mais seul un service AV/CDR externe peut apporter une analyse de malware plus profonde.
- Les liens de commande sont des bearer tokens valables 30 jours ; leur confidentialité dépend du courriel, de l'historique navigateur et de `SESSION_SECRET`.
- Le rate limiting applicatif repose sur Supabase ; une protection WAF/CDN reste nécessaire contre les attaques distribuées et volumétriques.
- Aucun test de restauration, test de charge, DAST externe ou pentest tiers n'a été exécuté.

# Final Verdict

### 🔴 NON PRÊT POUR PRODUCTION

Le code est substantiellement renforcé et peut servir de candidat staging, mais l'application ne doit pas recevoir de vrais clients ou paiements tant que les 20 paramètres bloquants, la migration Supabase réelle, les tests RLS/concurrence, Stripe Test/Live, les secrets, le traitement AV/CDR, les sauvegardes et l'observabilité n'ont pas été configurés et validés.

Ce verdict ne signifie pas qu'un P0/P1 corrigeable dans le dépôt reste volontairement ouvert ; il reflète l'absence actuelle des contrôles externes indispensables à une exploitation e-commerce réelle.
