# AVANA — audit et durcissement avant production

Audit du 14 septembre 2026, terminé le 15 septembre en UTC. Travail effectué directement dans le dossier courant, sans déploiement ni modification de service externe.

## Résultat

**SÉCURITÉ AVANT : 60/100**  
**SÉCURITÉ APRÈS : 80/100**

Ces notes sont une appréciation indicative du code et des contrôles locaux, pas une mesure fournie par un scanner ni une certification. Grille de cinq axes sur 20 : identité/autorisation 12→16 ; API/paiements 13→17 ; données/confidentialité 12→17 ; dépendances/environnement agent 13→14 ; vérification/exploitation 10→16. Les paramètres cloud inconnus limitent la conclusion, quelle que soit la note.

| Sévérité      | Avant | Corrigé | Restant |
| ------------- | ----: | ------: | ------: |
| Critique — P0 |     0 |       0 |       0 |
| Élevée — P1   |     0 |       0 |       0 |
| Moyenne — P2  |     9 |       6 |       3 |
| Faible — P3   |     7 |       7 |       0 |

Ces 16 points comprennent des défauts applicatifs, de robustesse et de configuration/outillage. Ils ne représentent pas 16 exploitations démontrées. Aucun P0/P1 exploitable n'a été confirmé dans le périmètre examiné. Les alertes heuristiques AgentShield écartées ne sont pas comptées. « Corrigé » signifie corrigé et vérifié localement ; la migration SQL reste à déployer.

**ÉTAT : NON PRÊT POUR PRODUCTION.** Les vérifications locales réussissent, mais le contrôle de préparation signale encore **20 blocages et 2 avertissements**. Supabase, Stripe, Resend, le domaine HTTPS et les identifiants de production ne sont pas configurés ici. Les politiques et services réellement déployés n'ont pas été validés. Le code peut passer à une qualification en staging après configuration et migration.

## 1. État initial et périmètre

`git status --short` a échoué : ce dossier ne contient pas de dépôt Git accessible. L'historique, les remotes, les hooks Git et la comparaison exacte avec les modifications utilisateur initiales sont donc indisponibles. Aucun dépôt n'a été initialisé, aucun commit effectué, aucune réinitialisation ou modification globale de Git appliquée. Les éditions ont été ciblées sur les fichiers présents.

| Surface             | Inventaire constaté                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend et backend | Next.js **16.3.5**, App Router et Route Handlers ; React **19.3.0**, TypeScript **6.0.3**                                                      |
| Runtime             | Node local 24.13.0, npm 11.6.2 ; workflows Node 22                                                                                             |
| API                 | **42 fichiers Route Handler, 47 méthodes HTTP exportées** ; aucune spécification OpenAPI ; aucune Server Action `use server` trouvée           |
| Middleware          | `proxy.ts` ; contrôle admin, rafraîchissement des sessions client, CSP avec nonce                                                              |
| Base                | Supabase/PostgreSQL, **19 tables applicatives**, RLS et RPC transactionnelles ; client service_role exclusivement serveur                      |
| Auth client         | Liens magiques Supabase ; sessions et vérification d'identité côté serveur ; pas de client Auth navigateur                                     |
| Auth admin          | Session HMAC de deux heures, mot de passe et TOTP requis en production ; accès serveur centralisé                                              |
| Commerce            | Catalogue, variantes, lots, panier, commandes invité/client, adresses, stock, expédition, remboursement, administration et B2B                 |
| Paiement            | Stripe Checkout hébergé et webhook signé ; prix issus du serveur/SQL, réservations et transitions transactionnelles                            |
| Communications      | Resend, file de notifications, formulaires, newsletter avec confirmation et désabonnement ; cron commerce                                      |
| Stockage            | Supabase Storage, documents publics publiés et documents privés ; uploads réservés à l'administration                                          |
| Hébergement         | Configuration Vercel et cron présents ; hébergement et paramètres de déploiement effectifs non observés                                        |
| CI                  | GitHub Actions : secrets, npm audit, format, TypeScript, ESLint, Vitest, build, Playwright, CodeQL                                             |
| Environnement       | `.env.local` inspecté sans afficher les valeurs ; identifiants des fournisseurs et de l'administration vides, commerce désactivé et URL locale |

Guides de la version Next installée consultés avant modification. Sources applicatives TS/TSX de `app`, `components`, `hooks`, `lib`, `data`, `types`, SQL, scripts et configurations examinés, avec revue initiale indépendante puis nouvelle revue après correction. Dépendances et fichiers générés contrôlés par audit de paquets/build/scans ciblés, sans audit exhaustif de leur implémentation. CSS et fichiers binaires non intégralement relus. Aucun test intrusif contre un service externe.

### Validation avant / après

| Vérification réellement exécutée   | Avant                                             | Après                                                                                                        |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| TypeScript                         | Réussite                                          | Réussite                                                                                                     |
| ESLint                             | Réussite                                          | Réussite                                                                                                     |
| Build Next.js                      | Réussite                                          | Réussite, 68 pages générées                                                                                  |
| Vitest                             | 53 tests, 8 fichiers                              | **141 tests, 14 fichiers**                                                                                   |
| PostgreSQL comportemental          | Pas de suite exécutant réellement les politiques  | **46 tests** sur moteur PostgreSQL PGlite                                                                    |
| Playwright sur build de production | Pas de référence initiale mesurée dans ce mode    | **18 tests réussis**, desktop et mobile                                                                      |
| Formatage final                    | —                                                 | Réussite                                                                                                     |
| npm audit via registre             | 0 vulnérabilité connue / 513 dépendances          | **0 vulnérabilité connue / 514 dépendances**                                                                 |
| Secrets                            | Analyse initiale et lacunes du scanner constatées | Scanner renforcé, inclusion locale explicite, aucun secret réel détecté ; bundle final contrôlé, 45 fichiers |
| Préparation production             | Environnement non configuré                       | **20 blocages, 2 avertissements**, non masqués                                                               |

Les lancements de tests/build bloqués par `spawn EPERM` dans le sandbox ont été relancés avec l'autorisation requise, sans désactiver de protection. Les services externes ont uniquement été représentés par des contrats HTTP locaux là où nécessaire : le code applicatif, les SDK, les signatures Stripe et les politiques SQL testés sont réels. Ce ne sont pas des tests de bout en bout du cloud. Aucune exécution distante de la CI n'est revendiquée.

## 2. Constats classés et corrections

| ID     | Priorité | Problème et impact                                                                                                                                                    | Résolution / preuve                                                                                                                                                                                                          |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APP-01 | P2       | Absence de garde explicite sur une identité Supabase non confirmée avant rattachement/lecture des données client ; exploitabilité dépendante de la configuration Auth | Refus des erreurs Auth, utilisateurs anonymes, sans email ou sans `email_confirmed_at`. SDK `getUser()` conservé. Tests d'identité et métadonnées trompeuses. **La confirmation email du projet Supabase reste à vérifier.** |
| DB-01  | P2       | Index partiel incompatible avec `ON CONFLICT(dedupe_key)` : mise en file des liens d'accès et notifications en échec                                                  | Index UNIQUE complet ajouté ; erreur réelle PostgreSQL `42P10` reproduite sur le schéma précédent, migration appliquée deux fois et conservation des données vérifiée                                                        |
| DB-02  | P2       | Événement Stripe encore sous bail de traitement acquitté comme doublon terminé : risque de perte de reprise après interruption                                        | États `claimed` / `processed` / `busy` distingués ; bail actif → **503**, `Retry-After: 60` ; seul un événement terminé reçoit `200 duplicate`                                                                               |
| APP-02 | P2       | Campagne déjà en file envoyée après désabonnement                                                                                                                     | Consentement relu immédiatement avant envoi ; destinataire absent, pending ou désabonné → notification arrêtée sans envoi ; erreur de lecture → échec avec reprise, sans envoi. Huit tests comportementaux                   |
| ENV-01 | P2       | Scanner de secrets omettant des sources non suivies, `.env` suivis et clés Supabase privilégiées : risque de fuite non détectée par la CI                             | Scanner renforcé, lecture en échec signalée, sept tests réels incluant un dépôt Git temporaire ; aucune fuite réelle trouvée                                                                                                 |
| ENV-02 | P2       | Variantes `.env.production`, `.env.staging`, etc. susceptibles d'être ajoutées à Git                                                                                  | `.env.*` ignoré sauf `.env.example` ; contrôle séparé des fichiers déjà suivis. Aucun secret réel trouvé                                                                                                                     |
| APP-03 | P2       | Déconnexion admin ne révoquant pas un cookie déjà copié                                                                                                               | **Ouvert** : vol préalable requis, durée résiduelle maximale de deux heures ; ajout de sessions persistantes à concevoir et approuver                                                                                        |
| ENV-04 | P2       | Protection effective des commandes Codex par Transcodes Guard non active/validée                                                                                      | **Ouvert** : token absent, hooks déclarés vides, simulation `exec_command` hors couverture ; configuration hôte à corriger par le mécanisme officiel                                                                         |
| ENV-05 | P2       | MCP externe exécuté via `npx -y chrome-devtools-mcp@latest`                                                                                                           | **Ouvert** : version mutable, risque de supply chain d'un outil agent ; épinglage d'une version vérifiée dans la configuration externe à prévoir                                                                             |
| APP-04 | P3       | Cookies Auth client accessibles au JavaScript et attributs non centralisés                                                                                            | `HttpOnly`, `Secure` en production, `SameSite=Lax`, chemin `/` cohérents sur émission, callback et rafraîchissement ; tests SDK                                                                                              |
| APP-05 | P3       | Mémoire du limiteur local augmentant avec de nouveaux identifiants                                                                                                    | Plafond de 10 000 clés, purge des expirations et refus à saturation sans effacer les quotas actifs. Limiteur PostgreSQL de production conservé                                                                               |
| APP-06 | P3       | Export de données client coûteux sans quota dédié                                                                                                                     | Trois exports par heure et par utilisateur, `429` et `Retry-After`, réponses non mises en cache                                                                                                                              |
| APP-07 | P3       | Défense insuffisante contre cache/référent sur certaines pages privées ou à jeton                                                                                     | `private, no-store` et `no-referrer` sur les surfaces concernées et les redirections Auth ; tests navigateur                                                                                                                 |
| APP-08 | P3       | Longueurs d'email et schéma de login admin insuffisamment bornés                                                                                                      | Emails limités à 254 caractères, schémas stricts sur lien magique/login admin, destination admin bornée ; quotas et limites de corps conservés                                                                               |
| DB-03  | P3       | Indicateur de préparation demandant `payment_events.created_at`, colonne inexistante                                                                                  | Lecture de `processed_at` des événements traités ; sonde et readiness exigent le schéma version 5                                                                                                                            |
| ENV-03 | P3       | Identifiants de checkout CI persistés et jobs sans délai maximal                                                                                                      | `persist-credentials: false`, timeout de 20 minutes ; tests navigateur désormais sur le build de production                                                                                                                  |

Correction fonctionnelle associée, non comptée comme faille exploitable : la création du lien magique utilisait un flux implicite incompatible avec le callback échangeant un code PKCE. Les deux côtés utilisent maintenant le SDK SSR et un vérificateur PKCE protégé. Deux liens simultanés sont distingués via le mécanisme `sb_flow_id` du SDK installé. Les destinations restent internes et validées ; codes et identifiants de flux sont bornés. La preuve par navigateur/email réel reste une étape de staging.

Les deux P2 d'environnement ouverts sont des expositions contextuelles, sans compromission démontrée. Les corrections faibles sont principalement des protections supplémentaires et de la robustesse.

## 3. Base, autorisations, paiements et navigateur

Les 19 tables examinées sont `profiles`, `customer_addresses`, `products`, `product_variants`, `lots`, `orders`, `order_items`, `inventory_movements`, `order_status_events`, `shipments`, `payment_events`, `notifications`, `newsletter_subscribers`, `submissions`, `analytics_events`, `marketing_campaigns`, `operational_records`, `audit_logs`, `api_rate_limits`.

Les tests PostgreSQL exécutent le schéma et les migrations du dépôt avec les vrais rôles `anon` et `authenticated` : séparation A/B, impossibilité de modifier les données d'un autre client, refus des écritures directes et RPC privilégiées, métadonnée `role: admin` sans effet. Ils vérifient prix falsifié ignoré, produit désactivé refusé, réservation/stock, rollback, idempotence paiement et remboursement, remise en stock unique. Le contrat Supabase de test fournit les prérequis de plateforme ; il ne remplace pas les politiques de l'application. PGlite est un moteur PostgreSQL embarqué ; ses tests ne prouvent pas les courses entre connexions indépendantes. Voir [audit SQL détaillé](docs/security/database.md) et [contrat de test](supabase/tests/README.md).

Les accès serveur utilisent service_role et doivent donc conserver leurs filtres d'appartenance même lorsque RLS est correct. Les fonctions `SECURITY DEFINER`, `search_path`, droits EXECUTE et métadonnées de rôle ont été examinés. Les rôles SQL `staff`, `admin`, `founder` disposent volontairement de lectures privilégiées : l'attribution réelle de ces rôles et leur MFA Supabase restent à vérifier. Aucune modification silencieuse de cette politique métier.

Les protections existantes de paiement ont été conservées : produit/prix recalculés côté serveur et SQL, quantités bornées, réservation transactionnelle, association commande/session Stripe, validation montant/devise, signature et horodatage du webhook, état persistant et idempotence. Tests avec le SDK Stripe réel : corps altéré, signature absente/périmée et mode incorrect refusés ; bail actif, expiré et événement terminé vérifiés dans PostgreSQL. Les réponses non-2xx permettent les reprises Stripe ; le fournisseur ne promet pas de suivre exactement notre `Retry-After`. [Documentation Stripe](https://docs.stripe.com/webhooks?lang=node).

CSP existante avec nonce conservée : pas de `unsafe-eval` ni de `unsafe-inline` dans **script-src en production**, `frame-ancestors 'none'`. `style-src 'unsafe-inline'` reste nécessaire aux styles actuels ; aucune suppression de style pour améliorer artificiellement une note. HSTS en production, nosniff, Permissions-Policy, anti-clickjacking et restrictions des images distantes conservés. Les tests navigateur vérifient la CSP, les nonces, l'hydratation et l'absence de violations observées sur les parcours testés.

Uploads : contrôles existants de taille, type réel/signature, dimensions, chemins, publication et contenu actif relus ; documents privés servis avec contraintes de réponse. Tests d'uploads dangereux existants conservés et exécutés. Les buckets/objets déjà déployés et leurs ACL Storage nécessitent une vérification distante. Aucun nouveau service antivirus ni changement de stockage appliqué.

Journalisation : les mutations admin et événements commerce disposent de journaux métier/audit ; les erreurs publiques restent neutres. Les identifiants et statuts utiles peuvent figurer dans les logs, pas les clés, cookies ou mots de passe. Le dossier d'audit ne contient aucune valeur d'identifiant réel. L'acheminement, la rétention et les alertes des logs de production restent à valider. Une campagne déjà acceptée par Resend ou un retrait de consentement intervenant après la dernière lecture ne peut pas être annulé atomiquement par cette correction.

## 4. Outils réellement utilisés

### ECC

Compétences effectivement lues et appliquées : `security-review`, `production-audit`, `react-testing`, `security-scan`, `deployment-patterns`, `search-first`, `postgres-patterns`, `backend-patterns`. Elles ont structuré les revues indépendantes de l'architecture, des autorisations serveur/RLS, des transactions, du frontend, des dépendances, des tests et de la CI. Les incohérences PKCE, index de déduplication et acquittement des webhooks ont été analysées dans ces revues. ECC est ici un ensemble de compétences et de procédures utilisées avec les outils réels, pas un scanner CVE magique.

### OpenAI Codex Security

Workflow natif **Standard** effectivement lancé, préflight exécuté, modèle de menace, revue initiale indépendante, investigations SQL/paiement et revue finale des sources, triage et finalisation des artefacts. Le scan final `120c1121-14be-4fa6-88a7-c8e323635ff1` est **terminé, validé et indexé**, avec **un P2 confirmé restant** : révocation de session admin à la déconnexion.

Rapport généré par le plugin : [Codex Security](docs/security/codex-security-report.md), [couverture](docs/security/codex-security-coverage.json), [SARIF](docs/security/codex-security.sarif). Copies des artefacts générés conservées dans le projet ; originaux natifs inchangés. **Couverture globale partielle**, explicitement déclarée : l'inventaire de 37 297 fichiers contient surtout dépendances et fichiers générés ; il ne signifie pas 37 297 fichiers relus. Paramètres cloud et historique Git indisponibles. Les problèmes d'environnement externe sont documentés séparément.

Les lancements précédents qui avaient échoué pendant l'inspection du dossier en cours de modification ne sont pas comptés comme scans achevés. Accès Daybreak retourné `not_granted` par l'outil ; aucun accès à ce programme n'est revendiqué, et cela n'a pas empêché la génération finale des rapports locaux. Information du programme : [OpenAI Cyber](https://chatgpt.com/cyber).

Télémétrie retournée par le plugin : **1 494 928 tokens**, dont **1 465 216 tokens d'entrée en cache**, un thread mesuré, source `codex_rollout`. Ce compteur n'est ni un coût facturé, ni un total certifié de toute l'équipe. Sa couverture de télémétrie « complete » ne change pas la couverture d'audit « partial ».

### AgentShield

CLI **ecc-agentshield@1.6.0** réellement exécuté avant/après sur le projet et sur le profil `.codex`, avec analyse supply chain. Installation temporaire, version épinglée, scripts d'installation désactivés, aucune installation globale ni correction automatique.

Projet : 525 alertes avant, 526 après ; **514 alertes finales sur 514 vérifiées comme hashes d'intégrité npm**, plus 12 heuristiques sur `CLAUDE.md` sans exploitation établie. Le fichier supplémentaire provient de la dépendance de test SQL. Profil Codex : 1 709 fichiers, 5 895 alertes brutes majoritairement exemples/caches ; configuration active triée. Les scores bruts AgentShield ne sont pas les scores de sécurité de ce rapport. [Résultats et preuves expurgées](docs/security/environment.md).

**AgentShield VS Code** : extension `aiconnai-vs.agentshield` 1.0.0 détectée, autre projet que le CLI ECC ; binaire attendu absent, extension **non exécutée**. Aucune équivalence trompeuse entre les deux outils.

### 42Crunch

Extension 5.9.0 détectée. Aucune spécification OpenAPI/Swagger trouvée ; **42Crunch non exécuté**. Revue manuelle des 42 Route Handlers et de leurs fonctions appelées : identité, autorisation d'objet/fonction, schémas, masse des champs, exposition de données, injections, SSRF, quotas et opérations sensibles. Aucun faux rapport OpenAPI produit.

La [matrice API](docs/security/api-matrix.md) détaille les contrôles et leurs exceptions. Les routes admin métier, uploads et exports n'ont pas de quota applicatif dédié : elles sont réservées à une session privilégiée, avec bornes de corps et audits selon l'opération. Un quota adapté à l'usage admin réel reste recommandé en staging. Health, cron, callback et logout ont également des exceptions explicites ; le webhook utilise sa signature et sa déduplication. Aucun prétendu contrôle universel de quota ou de journalisation.

### Transcodes Guard

Plugin 0.87.0 et sources de hooks inspectés. **Huit simulations** de commandes exécutées : Git en lecture, suppression, Git global, lecture d'environnement, téléchargement/exécution, permissions Windows, installation globale, écriture hors projet. Toutes retournent `block-no-token`. Simulation des outils : `exec_command` → `will_trigger_hook: false`, outil MCP Chrome → `true`.

Le manifeste référence un objet hooks vide ; le code du hook quitte sans bloquer en l'absence de token ou sur certaines erreurs. **La protection effective des commandes Codex n'est pas validée.** Aucun des actes dangereux simulés n'a été exécuté, aucun contournement et aucune modification des permissions ou du plugin. Les restrictions du sandbox et leurs demandes d'autorisation sont restées en place.

### Autres vérifications

`npm audit --offline=false --json`, `npm outdated`, lockfile et scripts d'installation ; scanner de secrets renforcé ; Vitest, PGlite 0.5.8, SDK Stripe et Supabase réels, Playwright sur Next en production, TypeScript, ESLint, Prettier, build et readiness. Seule nouvelle dépendance AVANA : PGlite **dev**, version exacte ; aucune mise à jour majeure opportuniste. Le plugin OpenAI Developers a été identifié comme installé/activé via Plugin Management ; aucune API OpenAI n'existe dans le projet et aucun scanner supplémentaire n'est revendiqué à ce titre.

## 5. Tests de sécurité ajoutés

**88 tests Vitest supplémentaires** :

| Fichier                                       | Tests | Ce qu'ils vérifient                                                                                                                        |
| --------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/security/database-behavior.test.ts`    |    46 | Vrai SQL/RLS, comptes A/B/anon, droits/RPC, prix/stock/paiement/remboursement, migration idempotente, leases webhook                       |
| `tests/security/customer-auth.test.ts`        |    17 | SDK SSR/Auth réel sur contrat HTTP local, PKCE S256, deux liens simultanés, cookies, code rejoué, redirects, identité confirmée et anonyme |
| `tests/security/notification-consent.test.ts` |     8 | Lecture réelle via SDK PostgREST local, consentement et erreurs, absence d'envoi en cas de refus ; frontière Resend contrôlée              |
| `tests/security/api-boundaries.test.ts`       |     7 | Gardes serveur, session admin signée/falsifiée, Origin canonique, vraie validation Stripe                                                  |
| `tests/security/secret-scanner.test.mjs`      |     7 | Git temporaire réel, secrets synthétiques non affichés, fichiers suivis/non suivis et `.env`, empreintes npm                               |
| `tests/security/rate-limit.test.ts`           |     3 | Quota, expiration, saturation mémoire sans éviction d'une limite active                                                                    |

Playwright : nouveau `tests/e2e/admin-authorization.spec.ts`, découverte de toutes les méthodes admin protégées hors login/logout et appels HTTP réels refusés sans cookie ou avec cookie forgé. `tests/e2e/public.spec.ts` enrichi pour CSP, nonces, rendu client, cache et référent. **18 tests desktop/mobile passent sur `next build` puis `next start`**, sans mock Auth/DB pour les refus admin. Un compte client Supabase réel face aux endpoints admin reste un contrôle de staging.

Les suites antérieures sur uploads, validation, SQL, paiements et application sont conservées. Aucun test supprimé, ignoré ou remplacé pour masquer une régression.

## 6. Fichiers modifiés ou ajoutés

Liste du chantier ; elle ne remplace pas un diff Git, indisponible dans ce dossier.

- Auth et protections HTTP : `lib/supabase/cookie-options.ts` (nouveau), `lib/supabase/server.ts`, `app/api/auth/magic-link/route.ts`, `app/api/auth/callback/route.ts`, `proxy.ts`, `app/api/admin/login/route.ts`, `lib/validation.ts`.
- Abus et confidentialité : `lib/server/local-rate-limit.ts` (nouveau), `lib/server/rate-limit.ts`, `app/api/account/export/route.ts`, `lib/server/notifications.ts`.
- Transactions et exploitation : `lib/server/orders.ts`, `app/api/webhooks/stripe/route.ts`, `lib/server/readiness.ts`, `app/api/health/route.ts`, `supabase/commerce.sql`, `supabase/migrations/20260914000000_notification_upsert.sql` (nouveau).
- CI et dépendances : `.gitignore`, `.prettierignore`, `scripts/scan-secrets.mjs`, `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `package.json`, `package-lock.json`, `playwright.config.ts`.
- Tests : les six nouveaux fichiers Vitest ci-dessus ; `tests/security/database-security.test.ts` ; `tests/e2e/admin-authorization.spec.ts` (nouveau), `tests/e2e/public.spec.ts` ; `supabase/tests/platform-contract.sql`, `supabase/tests/fixtures.sql`, `supabase/tests/README.md` (nouveaux).
- Documentation : `README.md`, ce rapport et `docs/security/` : audits base/environnement, matrice API, résultats AgentShield expurgés, npm audit avant/après, npm outdated, scan de bundle, rapport/couverture/SARIF Codex Security.

## 7. Actions manuelles nécessaires avant production

1. **Configurer un staging isolé** : domaine HTTPS canonique, Supabase public/serveur, Stripe test et secret webhook, Resend et destinataires, mot de passe admin, secret session, TOTP, cron et coordonnées entreprise. Utiliser les secrets de l'hébergeur ; aucun secret dans Git. Les 20 blocages actuels concernent ces valeurs et le commerce désactivé. Téléphone et connexion Postes Canada sont les deux avertissements ; le suivi manuel existe déjà.
2. **Déployer et vérifier le schéma 5** : tester puis appliquer les migrations manquantes, dont `20260914000000_notification_upsert.sql`. Migration additive, sans effacement de données. La création de l'index peut bloquer temporairement des écritures selon la taille de la table ; planifier son exécution sur la base réelle. Aucun SQL distant n'a été exécuté ici.
3. **Vérifier Supabase Auth** : activer Confirm Email. Si cette option est désactivée, Supabase peut remplir `email_confirmed_at` sans vérifier la boîte mail ; la garde applicative ne compense pas ce réglage. Vérifier les fournisseurs autorisés, limites Auth directes et redirections du callback conservant `next` et `sb_flow_id`. Tester le parcours email complet, refresh, déconnexion et deux liens simultanés. [Configuration Auth](https://supabase.com/docs/guides/auth/general-configuration), [redirections](https://supabase.com/docs/guides/auth/redirect-urls).
4. **Valider RLS et Storage déployés** : deux clients confirmés et un anonyme via les vrais services Supabase, lecture/mutation croisée refusées, RPC privilégiées refusées, policies/grants conformes, buckets et objets privés/publics corrects. Vérifier les comptes SQL privilégiés et leur MFA. Les tests locaux ne prouvent pas l'absence d'anciennes policies dans le cloud.
5. **Exécuter le commerce complet en Stripe test** : prix falsifié, stock concurrent depuis deux connexions, double checkout, webhook signé/rejoué/interrompu, remboursements, stock et notifications. Vérifier les emails effectivement reçus, désabonnement et reprise des tâches. Puis configurer séparément les secrets/modes de production.
6. **Résoudre ou accepter explicitement les P2 ouverts** : sessions admin persistantes et révocation au logout (nouveau stockage et gardes serveur à concevoir avant accord architectural) ; activation officielle de Transcodes Guard avec preuve d'interception bénigne dans Codex ; épinglage du MCP externe. Aucun changement de service, permission globale ou rotation de secret appliqué.
7. **Valider l'exploitation** : protection fiable des en-têtes IP par le proxy d'hébergement, limites/WAF, alertes erreurs webhook/cron et authentification admin, rétention des logs, sauvegarde et restauration PostgreSQL. Vercel réécrit les en-têtes de forwarding selon sa documentation ; un hébergement différent doit fournir une garantie équivalente. [En-têtes Vercel](https://vercel.com/docs/headers/request-headers).
8. **Retrouver le dépôt Git d'origine** pour vérifier l'historique des secrets et les modifications préexistantes, relancer la CI réelle et faire relire le diff. Ne pas initialiser ou réécrire arbitrairement l'historique. Pour automatiser Codex Security/AgentShield/42Crunch ensuite, utiliser leurs intégrations réelles et leurs conditions d'accès ; aucun job factice ajouté.

### Secrets nécessitant une rotation

**Aucun secret réel exposé identifié dans le périmètre inspecté ; aucune rotation demandée sur cette base.** Les valeurs serveur locales sont vides. Sources, fichiers d'environnement et bundle client ont été contrôlés sans publier de valeur. L'historique Git et les secrets des services déployés restent non vérifiables ici. Les motifs du scanner ne constituent pas une preuve absolue d'absence de secret.

## Conclusion

**NON PRÊT POUR PRODUCTION** : code durci et validation locale réussie, aucun P0/P1 exploitable connu dans le périmètre examiné, six P2 et sept P3 corrigés localement. Trois P2 documentés restent ouverts ; configuration production, migration distante et validation effective de Supabase/Stripe/Resend sont encore nécessaires. Le score et le nombre de tests ne remplacent pas ces vérifications.
