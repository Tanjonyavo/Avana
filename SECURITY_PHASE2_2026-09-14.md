# AVANA — phase 2 de durcissement ciblée

Date de référence : 14 septembre 2026 (exécutions finales le 15 septembre UTC).

## Résultat et limites

**Sécurité avant : 80/100. Sécurité après : 88/100.** Estimation d'ingénierie sur le périmètre local contrôlé, pas une mesure certifiée de la sécurité d'un service déployé. Aucun contrôle cloud non exécuté n'entre dans cette validation.

| Sévérité      | Avant phase 2 | Corrigé localement | Restant connu |
| ------------- | ------------: | -----------------: | ------------: |
| P0 — Critique |             0 |                  0 |             0 |
| P1 — Élevée   |             0 |                  0 |             0 |
| P2 — Moyenne  |             3 |                  2 |             1 |
| P3 — Faible   |             0 |                  0 |             0 |

Les deux P2 corrigés concernent le rejeu du cookie admin après logout et le lancement MCP avec une version flottante. **Le P2 restant est Transcodes Guard : authentification et interception réelle non validées.** Les deux informations AgentShield sur des descriptions MCP absentes ne constituent pas des vulnérabilités P3.

Les nombres P0/P1 reprennent la référence de phase 1 et l'absence de nouvelle vulnérabilité confirmée dans cette revue ciblée. Cette phase ne refait pas l'audit général. Les services Supabase, Stripe et Resend réels ne sont **pas déclarés sécurisés**. Leurs contrôles restent à vérifier ; les 18 blocages de configuration ne sont pas assimilés artificiellement à 18 vulnérabilités applicatives.

**Verdict : PRÊT POUR STAGING, pour qualification après configuration et migration autorisées. Production non validée.** Le code local peut être livré à un staging isolé ; il ne peut pas encore assurer un lancement commercial avec les variables actuelles. Aucun déploiement ni transaction Stripe n'a été effectué.

## 1. Session admin : analyse et correction

### Autorité et cycle de vie

- Le back-office AVANA utilise son propre cookie `avana_admin_session`, obtenu par mot de passe et TOTP en production. Le rôle admin ne provient pas d'un paramètre client, d'une métadonnée Supabase ou du profil d'un compte client.
- La signature du cookie dépend de `SESSION_SECRET`, `ADMIN_PASSWORD` et `ADMIN_TOTP_SECRET`. Le cookie contient un identifiant aléatoire, une expiration et une signature ; sa durée maximale reste deux heures. Il est HttpOnly, Secure en production et SameSite=Strict.
- Avant cette phase, la suppression du cookie dans le navigateur ne révoquait pas une copie valide. Désormais chaque page admin protégée et chaque garde d'API admin exigent une ligne active dans le registre SQL `admin_sessions`, avec expiration, rôle admin et MFA en production. Seul le SHA-256 du cookie est stocké.
- La connexion inscrit d'abord la session côté serveur ; elle n'émet aucun nouveau cookie si cette inscription échoue. Une reconnexion révoque atomiquement le cookie précédent présenté par ce navigateur. Les autres sessions indépendantes restent actives.
- La déconnexion révoque en base avant de répondre avec succès et d'effacer le cookie. Une panne renvoie 503 et conserve le cookie pour permettre une nouvelle tentative ; l'interface affiche l'échec. Un cookie copié est refusé dès que la révocation est validée en base, sur toutes les instances à jour.
- Il n'y a pas de cache positif d'autorisation entre requêtes ni de rafraîchissement automatique du cookie admin. Le proxy conserve son contrôle préalable de signature ; les pages et les API assurent elles-mêmes le contrôle SQL avant lecture ou mutation.

### Supabase Auth reste distinct

Les comptes clients utilisent Supabase Auth et PKCE ; leur cycle de refresh n'a pas été remplacé. Supabase signout révoque les refresh tokens concernés, mais un JWT déjà émis peut rester valable jusqu'à son expiration. La correction admin ne dépend donc pas de signout pour révoquer le cookie AVANA. [Documentation Supabase signout](https://supabase.com/docs/guides/auth/signout).

Les éventuels profils Supabase `staff/admin/founder` et leurs policies constituent une autre autorité à contrôler sur le projet distant. Le TOTP AVANA ne certifie pas l'inscription MFA de ces comptes Supabase ou des comptes opérateurs des fournisseurs.

### Options évaluées

| Option                                                    | Décision                                                                                                                                                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Révocation serveur / contrôle de session                  | Ajoutés ; lookup SQL à chaque opération protégée, erreur → refus                                                                                                                                     |
| Rotation de session                                       | Nouvelle session aléatoire à chaque authentification ; ancienne session présentée révoquée atomiquement                                                                                              |
| Token versioning global                                   | Un registre par session apporte une révocation ciblée ; un changement des identifiants admin invalide aussi les signatures existantes                                                                |
| Durée de vie admin réduite                                | Durée maximale de deux heures conservée ; le rejeu après logout est supprimé par le registre sans imposer des reconnexions répétées                                                                  |
| Revalidation du rôle                                      | Rôle, MFA, expiration et révocation vérifiés côté SQL à chaque garde                                                                                                                                 |
| MFA / nouvelle authentification pour chaque remboursement | TOTP obligatoire en production conservé et enregistré dans la session ; une MFA supplémentaire par opération modifierait le parcours et reste une décision produit, pas un contrôle déclaré implanté |

### Déploiement et limites résiduelles

La migration additive `20260914010000_admin_sessions.sql` apporte la version **6**, après la v5 demandée. Elle ajoute une vingtième table et trois RPC service_role uniquement ; RLS, privilèges et `search_path` sont testés. Le schéma complet converge vers la même version.

Appliquer les migrations autorisées **avant** le code et mettre à jour toutes les instances. Les anciens cookies nécessitent une reconnexion unique ; sans la migration, l'administration refuse l'accès. Les opérations déjà autorisées avant la révocation peuvent terminer. Le registre ne protège pas contre un poste encore compromis, un mot de passe/TOTP compromis ou un service_role volé. Ces situations nécessitent une réponse à incident distincte.

La revue indépendante a repéré une régression transitoire P3 : un cookie invalide pouvait générer un faux événement `admin.logout`. Elle a été corrigée avant livraison : la RPC renvoie si une transition a réellement eu lieu, et seul ce résultat déclenche l'audit. Les tests vérifient zéro audit sur faux cookie et un seul sur plusieurs déconnexions identiques. Cette régression introduite puis supprimée ne fait pas partie des trois risques initiaux.

## 2. Concurrence et stock

**Deux clients ne peuvent pas tous deux réserver la dernière unité dans les scénarios SQL testés.** Le code existant utilise une transaction, un verrou advisory par tentative de checkout, des verrous de lignes ordonnés sur les variantes, le contrôle du disponible et la mise à jour atomique de la réservation. Les quantités/prix proviennent du serveur.

La validation du paiement verrouille la commande et rend l'effet d'inventaire idempotent ; les remboursements utilisent un état monotone et `restocked_at` pour empêcher une seconde remise en stock. La réconciliation consulte Stripe et expire une session ouverte avant de libérer sa réservation. Aucune modification du métier stock n'a été nécessaire pour ces invariants.

Quatre tests sur **PostgreSQL 17.11 réel**, avec trois connexions indépendantes et constat de l'attente de verrou dans `pg_stat_activity`, ont vérifié :

1. deux acheteurs sur une unité → une réservation, un refus ;
2. deux retries du même checkout → une commande, une réservation ;
3. paiements et remboursements dupliqués en concurrence → un effet d'inventaire par opération ;
4. révocation admin validée dans une connexion → refus dans une autre.

Ces tests locaux ne couvrent pas tous les entrelacements Stripe/cron, toutes les commandes multi-produits ou les pannes distribuées. Si un stock devient impossible après réservation, la transaction SQL échoue et le traitement webhook doit être repris/réconcilié. Aucun remboursement automatique d'un conflit ambigu n'a été ajouté ; son automatisation modifierait sensiblement le comportement financier. Le staging doit éprouver ce cas et sa procédure opérateur.

## 3. MCP et Transcodes Guard

Le MCP Chrome d'ECC exécutait `npx -y chrome-devtools-mcp@latest`. La version **1.9.0**, déjà présente localement, a été confirmée sur le registre officiel et installée dans un répertoire utilisateur dédié avec `--save-exact --ignore-scripts`. La configuration active lance désormais directement son fichier JavaScript avec Node, sans téléchargement automatique au lancement. Version et intégrité SRI du lockfile concordent avec le registre ; l'entrée a réellement répondu `1.9.0` à `--version`. Aucun changement majeur ni installation npm globale.

Les autres MCP trouvés utilisent les entrées locales des bundles versionnés Transcodes 0.87.0, Codex Security 0.1.24 et OpenAI Developers 1.3.0. Les exemples `@latest`, branches et URL flottantes présents dans des documentations ne sont pas des commandes actives. Les services hébergés ne fournissent pas nécessairement de version épinglable. Les permissions MCP restent celles du processus utilisateur ; aucune permission supplémentaire accordée.

Le cache du plugin ECC peut être remplacé par une mise à jour. Vérifier à nouveau son `.mcp.json` après une mise à jour et redémarrer l'hôte pour qu'il recharge la configuration. Cette phase a testé l'entrée CLI épinglée, pas une nouvelle connexion navigateur MCP complète.

**Guard reste ouvert.** Plugin installé/activé, CLI absent du PATH, hooks déclarés vides et appel réel `tc_get_current_project_id` refusé faute de token. L'exécution s'est arrêtée à cette exigence d'authentification. Aucune simulation post-configuration n'est déclarée réussie, aucune restriction contournée, aucun token créé. La [checklist](docs/security/phase2/staging-checklist.md#transcodes-guard--arrêt-à-lauthentification-requise) donne l'installation par canal autorisé, `transcodes install`, `transcodes login`, la configuration locale privée et les simulations bénignes à reprendre ensuite.

## 4. Configuration, Supabase distant et Stripe test

La [checklist complète](docs/security/phase2/staging-checklist.md) contient **exactement les 20 messages initiaux**, avec catégorie, valeur attendue, emplacement, vérification et risque. Répartition : **A=2, B=4, C=2, D=2, E=3, F=7**.

Seuls les deux A ont été corrigés : `SESSION_SECRET` et `CRON_SECRET`, initialement vides, ont chacun reçu 32 octets aléatoires indépendants dans `.env.local` ignoré. Aucune valeur n'est reproduite dans ce rapport. Readiness reste volontairement en échec : **18 blocages et 2 avertissements**. Le transfert sécurisé de ces secrets vers l'hébergement reste humain.

La requête `supabase/tests/schema-fingerprint.sql` est en lecture seule. Elle exporte les métadonnées des 19 tables métier et de `admin_sessions`, RLS, policies, privilèges, contraintes/index, RPC, SECURITY DEFINER, search_path, triggers et buckets. `scripts/compare-supabase-schema.mjs` compare deux exports locaux et échoue en cas d'écart ou de JSON invalide. La référence `docs/security/phase2/local-schema.json` provient du vrai PostgreSQL local ; **aucun export distant n'a été comparé**.

Les tests à exécuter sont précisément référencés : **SB01–SB09** (Supabase/Auth/Storage/autorisation) et **ST01–ST15** (Stripe exclusivement test). Ils incluent prix/quantité falsifiés, signature, rejeu, paiements réussis/échoués, refunds, duplication, retries et courses paiement/stock/cron. Aucune transaction réelle ni de test Stripe distante n'a été déclenchée.

## 5. CI et vérifications

La CI conserve tous ses contrôles obligatoires. Elle ajoute un job PostgreSQL réel avec image versionnée et épinglée par digest, puis **Security gate**, qui échoue si `quality`, `postgres` ou `browser` échoue, est annulé ou est ignoré. Tests, types, build, secrets, audit npm au seuil moderate, migrations SQL et tests RLS propagent leurs erreurs. Aucun `continue-on-error` ni faux test ajouté.

Le dossier courant n'a toujours pas de métadonnées Git accessibles. Il est impossible de vérifier ici une PR ou les règles de fusion GitHub. La checklist exige de rendre **Security gate** et le résultat CodeQL obligatoires, puis de vérifier le refus de fusion sur des PR de validation sans les fusionner. Un workflow local correct n'est pas une preuve de branche distante protégée.

| Contrôle                              | Avant             | Après / preuve locale                                                                |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| Vitest                                | 141               | 158 tests sur 16 fichiers                                                            |
| SQL embarqué                          | 46                | 46 tests existants + 13 tests sessions utilisant PGlite, inclus dans les 158         |
| Concurrence PostgreSQL native         | Non prouvée       | 4 tests supplémentaires, PostgreSQL 17.11, connexions indépendantes                  |
| Navigateur Chromium ordinateur/mobile | 18                | 18 sur build de production                                                           |
| Typecheck / lint / build / format     | OK                | OK                                                                                   |
| npm audit                             | 0 vulnérabilité   | 0, rapport enregistré                                                                |
| Secret scanning source                | Aucun motif connu | Aucun motif connu dans les sources distribuables ; `.env.local` volontairement privé |
| Readiness production                  | 20 blocages       | 18 blocages + 2 avertissements ; échec attendu, pas un contrôle vert                 |
| Supabase / Stripe / Resend distants   | Non validés       | Toujours non validés                                                                 |
| Protection GitHub des PR              | Non vérifiée      | Workflow renforcé ; règles distantes non vérifiées                                   |

Les nouveaux tests sont des régressions exécutables : 13 tests de sessions, quatre du comparateur (égalité, RLS désactivé, RPC manquant, entrée invalide) et quatre PostgreSQL concurrents. Le transport vers PGlite ne remplace pas la décision de sécurité par une réponse simulée ; les RPC, policies, transactions et gestionnaires d'authentification sont réellement exécutés.

## 6. Outils réellement utilisés

| Outil                                                  | Utilisation et résultat de phase 2                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECC                                                    | Compétence security-review appliquée au cycle de session, frontières d'autorité, configuration MCP et preuves ; revue ciblée, pas un audit général renouvelé                                                                                                                  |
| OpenAI Codex Security                                  | Scan natif ciblé avec préflight, modèle de menaces, deux revues indépendantes, triage et validation ; régression d'audit corrigée et revérifiée. Aucun finding applicatif confirmé restant dans ce périmètre. Accès Daybreak non accordé ; aucun contrôle Daybreak revendiqué |
| AgentShield CLI 1.6.0                                  | Scan ciblé de quatre copies de configurations/hooks réellement installés. Après correction, zéro alerte moyenne/élevée/critique/faible et deux informations de description MCP. L'essai initial sur un fichier isolé avait scanné zéro fichier : résultat écarté              |
| AgentShield VS Code                                    | Pas d'exécution de scan VS Code revendiquée pour cette phase                                                                                                                                                                                                                  |
| Transcodes Guard                                       | Installation/configuration inspectées ; appel MCP réel confirme l'absence d'authentification. Protection et interception non validées                                                                                                                                         |
| 42Crunch                                               | Non relancé : cette phase concerne les blocages ciblés et ne modifie pas une spécification OpenAPI                                                                                                                                                                            |
| npm / Vitest / PGlite / Playwright / PostgreSQL Docker | Audit dépendances, tests de régression, autorisations SQL, build navigateur et véritables verrous concurrents                                                                                                                                                                 |

Les artefacts de phase 2 sont dans `docs/security/phase2/`. Les rapports scanner bruts restent ignorés par Git ; les copies des hooks utilisées pour AgentShield ont été archivées dans le répertoire temporaire du poste, hors des sources TypeScript. Le conteneur PostgreSQL de cette session, limité à des fixtures synthétiques, a été arrêté après vérification de son nom et de son étiquette de propriété.

La vérification finale de secrets a parcouru 273 fichiers distribuables sans motif connu. Une recherche exacte, sans affichage des valeurs, a également confirmé l'absence des deux nouveaux secrets techniques dans les fichiers JavaScript du bundle client de production.

Le [rapport natif Codex Security](docs/security/phase2/codex-security-report.md) est finalisé. Le moteur signale que le dossier a changé pendant le scan et conserve l'identifiant de son instantané initial : il ne certifie donc pas l'immuabilité du dossier final. La couverture précise que la revue a suivi les sources courantes, y compris la correction de journalisation, et les tests locaux ont été exécutés après cette correction. La couverture reste partielle au regard du dépôt complet, conformément au ciblage demandé.

Mesure retournée par Codex Security : **5 611 347 tokens** sur trois threads, dont **5 148 800 tokens d'entrée en cache**, 5 562 451 tokens d'entrée au total et 48 896 tokens de sortie. Il s'agit de la télémétrie retournée par le plugin, pas d'une estimation de facturation.

## 7. Fichiers modifiés ou ajoutés

- Sessions et gardes : `lib/admin-auth.ts`, `lib/server/admin-session.ts` (nouveau), `lib/server/admin-page.ts` (nouveau), `lib/server/admin-request.ts`, `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts`, `components/admin-shell.tsx`.
- Pages : `app/admin/page.tsx`, `app/admin/[section]/page.tsx`, `app/admin/analytics/page.tsx`, `app/admin/b2b/page.tsx`, `app/admin/clients/page.tsx`, `app/admin/commandes/page.tsx`, `app/admin/connexion/page.tsx`, `app/admin/finances/page.tsx`, `app/admin/lots/page.tsx`, `app/admin/marketing/page.tsx`, `app/admin/messages/page.tsx`, `app/admin/parametres/page.tsx`, `app/admin/produits/page.tsx`, `app/admin/stocks/page.tsx`.
- SQL/préparation : `supabase/commerce.sql`, `supabase/migrations/20260914010000_admin_sessions.sql` (nouveau), `supabase/tests/schema-fingerprint.sql` (nouveau), `lib/server/readiness.ts`, `app/api/health/route.ts`.
- Tests : `tests/security/admin-session.test.ts` (nouveau), `tests/security/schema-comparison.test.ts` (nouveau), `tests/security/api-boundaries.test.ts`, `tests/security/database-behavior.test.ts`, `tests/security/database-security.test.ts`, `scripts/test-postgres-concurrency.mjs` (nouveau), `scripts/compare-supabase-schema.mjs` (nouveau).
- CI/dépendances : `.github/workflows/ci.yml`, `package.json`, `package-lock.json` (pg 8.23.0 exact), `.gitignore`, `.prettierignore`.
- Documentation/preuves : `README.md`, `SECURITY.md`, `supabase/tests/README.md`, mention d'archive dans `docs/security/api-matrix.md`, ce rapport et `docs/security/phase2/`.
- Configuration privée locale : deux champs précédemment vides de `.env.local`, sans publication.
- Hors dépôt, autorisé par le ciblage MCP : `C:\Users\ramia\.codex\plugins\cache\ecc\ecc\2.2.1\.mcp.json` et installation dédiée `C:\Users\ramia\.codex\tools\chrome-devtools-mcp\1.9.0`.

Cette liste est un relevé de travail, pas un `git diff` disponible. Les modifications utilisateur préexistantes n'ont pas été réinitialisées ; aucun commit n'a été créé.

## 8. Actions humaines restantes

1. Authentifier et activer Guard via la procédure précise de la checklist, puis reprendre les simulations d'interception non destructives. Ne jamais transmettre son token dans le projet ou cette conversation.
2. Renseigner les **18 paramètres/messages restants** du tableau A–F et transférer séparément les deux secrets locaux au magasin de secrets du staging. Inscrire réellement le TOTP admin ; choisir les boîtes email, l'adresse commerciale et le domaine HTTPS.
3. Autoriser explicitement le projet Supabase staging, ses migrations manquantes jusqu'à v6 et la création des seules fixtures de test nécessaires. Appliquer les migrations, déployer toutes les instances à jour, comparer les métadonnées, exécuter SB01–SB09.
4. Configurer Stripe test et sa destination webhook, confirmer `livemode=false`, puis autoriser et exécuter ST01–ST15. Ne pas basculer vers le mode réel à partir des seuls résultats locaux.
5. Vérifier domaine/clé/expéditeur Resend et tester les emails vers des boîtes consentantes contrôlées ; vérifier cron, TLS, origines, en-têtes IP de confiance et disponibilité des sessions sur l'hébergement.
6. Relier le dépôt Git réel et rendre les checks CI/CodeQL obligatoires ; confirmer le blocage des PR en échec.
7. Après une mise à jour ECC, recontrôler la version et la commande MCP ; confirmer le chargement de la configuration épinglée dans l'hôte.

**Rotation nécessaire connue : aucune identifiée dans cette phase ciblée.** Les deux secrets techniques sont nouvellement générés et privés. Cela ne constitue pas un audit des secrets distants ou de l'historique Git indisponible.

Le passage en production reste conditionné à ces preuves distantes, à la résolution Guard et à une validation humaine du staging. Aucun niveau « 100 % sécurisé » n'est revendiqué.
