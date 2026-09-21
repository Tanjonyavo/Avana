# Audit de sécurité AVANA

Date : 11 septembre 2026  
Portée : dépôt local AVANA, application Next.js, routes API, SQL Supabase, intégrations Stripe/Resend/Postes Canada, CI GitHub et préparation Vercel.  
Limite : audit défensif du code et tests locaux. Aucun compte cloud de production, secret réel, trafic réel, configuration DNS/TLS/WAF ou base Supabase distante n’a été inspecté.

## Référentiel et méthode

L’analyse est alignée sur [OWASP Top 10 2025](https://owasp.org/Top10/), [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/), [OWASP API Security Top 10 2023](https://owasp.org/API-Security/), [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) et les exigences PCI applicables à un checkout hébergé. Cette revue n’est ni un pentest externe exhaustif ni une certification PCI DSS.

### Architecture cartographiée

```text
Internet
  → DNS Squarespace
  → Vercel CDN / terminaison TLS / pare-feu à configurer
  → Next.js 16 App Router + Proxy CSP/Auth
      → API Next.js côté serveur
          → Supabase Auth
          → Supabase Postgres + RLS + RPC transactionnelles
          → Supabase Storage public/privé
          → Stripe Checkout hébergé + webhooks signés
          → Resend
          → Postes Canada (facultatif)
      → navigateur client (non fiable)
```

- **Frontend/backend** : TypeScript, React 19, Next.js 16.3.5 ; aucun ORM, GraphQL, WebSocket ou Docker.
- **Authentification client** : liens magiques Supabase, cookies SSR, identité revalidée côté serveur.
- **Administration** : mot de passe partagé fort + TOTP + cookie HMAC `HttpOnly`, `Secure` en production, `SameSite=Lax`, durée deux heures.
- **Paiement** : Stripe Checkout hébergé ; le navigateur n’envoie que produits, variantes et quantités, jamais un prix fiable ni une carte.
- **Données sensibles** : identité, courriel, téléphone, adresses, commandes, suivi, journaux d’audit, secrets de services. Aucune donnée CVV/CVC ou PAN n’est prévue dans le modèle.
- **Trust boundaries** : navigateur/API, API/Supabase `service_role`, API/Stripe, webhook Stripe/API, API/Resend, API/Storage, CI/Vercel et opérateur/admin.

### Surface d’attaque

- **Routes publiques** : pages marketing/catalogue, traçabilité, panier, checkout, formulaires et infolettre.
- **API publiques contrôlées** : `POST /api/submissions`, `POST /api/analytics`, `POST /api/auth/magic-link`, `GET /api/auth/callback`, `POST /api/auth/logout`, `POST /api/checkout/session`, `POST /api/orders/access`, `GET /api/orders/[number]`, confirmation/désabonnement infolettre, `GET /api/health` et webhook Stripe.
- **API compte** : profil, adresses et export ; identité obtenue de Supabase, jamais d’un `userId` client.
- **API admin** : 25 handlers couvrant produits, variantes, stocks, lots, commandes, remboursements, expédition, fichiers, exports, B2B, campagnes et opérations. Tous sauf le login exigent la session admin ; les mutations exigent aussi une origine valide.
- **API machine** : `GET /api/cron/commerce`, protégée par `Authorization: Bearer <CRON_SECRET>`.
- **Stockage** : bucket public limité aux actifs publiables ; bucket privé servi par URLs signées après autorisation admin.

### Modèle de menace synthétique

- Un client modifie prix, quantité, livraison, taxe, `userId`, `orderId` ou `role` : schémas allowlist, recalcul serveur, possession vérifiée et RPC transactionnelles.
- Un bot appelle directement les API : contrôle d’origine sur mutations navigateur, limites distribuées en base et tailles maximales.
- Un fraudeur rejoue ou parallélise un webhook : signature Stripe, revendication atomique de l’événement, validation commande/montant/devise/session et machine d’état.
- Un attaquant tente l’admin : mot de passe + TOTP, rate limit, cookie signé court, CSP et audit des connexions/actions.
- Un tiers ou secret est compromis : rotation requise, arrêt du commerce et conservation des preuves selon `SECURITY.md`.

## 1. Security score

**88 / 100** — indicateur interne après corrections, pas une certification. La note est limitée par l’absence de validation du cloud réel, de test concurrent contre une base staging, de scan antimalware externe et d’identités administrateur individuelles.

## 2. Risque avant corrections

**Élevé.** La combinaison XSS persistant possible, absence de MFA admin, course d’idempotence webhook, validation Stripe incomplète et écritures Supabase directes contournables pouvait toucher comptes, paiements, stock et données clients.

## 3. Risque après corrections

**Moyen.** Aucun P0/P1 connu ne reste dans le code audité. Le risque résiduel est principalement opérationnel : configuration cloud non inspectée, migration SQL non exécutée sur la base réelle, contrôles anti-fraude externes et architecture admin partagée.

## 4. Tableau des vulnérabilités

| ID      | Vulnérabilité                                          | Gravité | Impact                             | Statut                |
| ------- | ------------------------------------------------------ | ------: | ---------------------------------- | --------------------- |
| SEC-001 | XSS persistant via JSON-LD produit                     |      P1 | compte/admin, données              | Corrigé               |
| SEC-002 | Course et replay dans l’idempotence webhook            |      P1 | paiement, stock, notifications     | Corrigé               |
| SEC-003 | Validation métier Stripe incomplète                    |      P1 | commande marquée payée à tort      | Corrigé               |
| SEC-004 | Administration sans MFA et session trop longue         |      P1 | accès administrateur               | Corrigé               |
| SEC-005 | Corps HTTP non bornés avant parsing                    |      P2 | disponibilité, coûts               | Corrigé               |
| SEC-006 | URLs stockées insuffisamment contraintes               |      P2 | XSS/redirection/contenu non sûr    | Corrigé               |
| SEC-007 | Écritures directes Supabase contournant l’API          |      P2 | règles métier, rôles, adresses     | Corrigé               |
| SEC-008 | CSP permissive, cache privé et refresh Auth incomplets |      P2 | session, données privées           | Corrigé               |
| SEC-009 | Jeton de désabonnement conservé en clair               |      P2 | consentement marketing             | Corrigé               |
| SEC-010 | Upload PDF actif et taille multipart tardive           |      P2 | contenu actif, DoS                 | Partiellement corrigé |
| SEC-011 | Lien de commande valable un an                         |      P3 | confidentialité commande           | Corrigé               |
| SEC-012 | Nom de table pilotable avec `service_role`             |      P3 | mauvaise configuration privilégiée | Corrigé               |
| SEC-013 | CI sans SAST/audit/secrets et actions mouvantes        |      P3 | chaîne d’approvisionnement         | Corrigé               |

### SEC-001

- **Vulnérabilité** : fermeture de balise dans le JSON-LD produit.
- **Gravité** : P1.
- **Fichier** : `app/boutique/[slug]/page.tsx`, `lib/security.ts`.
- **Ligne** : rendu `dangerouslySetInnerHTML` autour de la ligne 57 ; `serializeJsonForHtml` autour de la ligne 1.
- **Cause** : `JSON.stringify` seul n’échappe pas une séquence `</script>` provenant d’une donnée produit stockée.
- **Scénario d’exploitation** : un contenu catalogue malveillant ferme le script JSON-LD et injecte du script dans la fiche produit visitée par un client ou un administrateur.
- **Impact** : vol de session, actions admin, altération du checkout et exfiltration de données visibles.
- **Correctif** : sérialisation adaptée au contexte HTML et nonce CSP par requête.
- **Modification** : échappement de `<`, `>`, `&`, U+2028/U+2029 et nonce appliqué au script.
- **Test** : `tests/security.test.ts`, séquence `</script><script>` sans caractère `<` dans le résultat.

### SEC-002

- **Vulnérabilité** : test puis insertion non atomiques pour dédupliquer les webhooks.
- **Gravité** : P1.
- **Fichier** : `supabase/commerce.sql`, `lib/server/orders.ts`, `app/api/webhooks/stripe/route.ts`.
- **Ligne** : RPC `claim_payment_event` vers 1022 ; helpers vers 408 ; revendication vers 117.
- **Cause** : deux exécutions concurrentes pouvaient toutes deux constater l’absence de l’événement avant son enregistrement.
- **Scénario d’exploitation** : retries Stripe ou requêtes simultanées traitent deux fois un événement financier ou une notification.
- **Impact** : double mouvement de stock, doubles courriels et incohérences de remboursement/commande.
- **Correctif** : machine d’état atomique `processing/processed/failed`, conflit SQL, compteur et reprise des traitements bloqués.
- **Modification** : RPC de revendication/complétion/échec, droits réservés à `service_role` et traitement asynchrone persistant.
- **Test** : `tests/data-integrity.test.ts` vérifie conflit atomique, locks et fonctions ; test live concurrent **NON VÉRIFIÉ** faute de base staging accessible.

### SEC-003

- **Vulnérabilité** : confiance excessive dans un événement Checkout signé mais insuffisamment corrélé.
- **Gravité** : P1.
- **Fichier** : `app/api/webhooks/stripe/route.ts`, `lib/server/stripe-checkout.ts`, `supabase/commerce.sql`.
- **Ligne** : validation vers 127 ; corrélation vers 25 ; contrôles DB vers 680.
- **Cause** : signature valide ne garantissait pas seule mode, état payé, devise CAD, référence, pays et correspondance stricte de session/montant.
- **Scénario d’exploitation** : événement valide mais inattendu ou mal associé tente de confirmer une autre commande ou une valeur incohérente.
- **Impact** : produit livré sans paiement correct, comptabilité et stock erronés.
- **Correctif** : valider tous les invariants côté serveur et dans la transaction SQL.
- **Modification** : mode `payment`, état payé, CAD, `client_reference_id`, Canada, session Stripe et montants exacts sont exigés.
- **Test** : assertions SQL dans `tests/data-integrity.test.ts` et faux webhook rejeté en 400 dans `tests/e2e/public.spec.ts`.

### SEC-004

- **Vulnérabilité** : authentification admin mono-facteur et session partagée de huit heures.
- **Gravité** : P1.
- **Fichier** : `lib/admin-auth.ts`, `app/api/admin/login/route.ts`, `components/admin-login-form.tsx`.
- **Ligne** : création/vérification session vers 61 ; TOTP vers 94 ; login vers 36.
- **Cause** : la connaissance du mot de passe suffisait pour contrôler toute l’administration.
- **Scénario d’exploitation** : credential stuffing, phishing ou fuite du mot de passe donne accès aux prix, stocks, clients et remboursements.
- **Impact** : fraude, données personnelles, argent et compromission opérationnelle.
- **Correctif** : TOTP obligatoire en production, session deux heures, nonce, signature liée aux trois secrets, rate limit et audit générique.
- **Modification** : `ADMIN_TOTP_SECRET`, générateur local, champ OTP, rotation de credentials invalidant les sessions.
- **Test** : `tests/admin-auth.test.ts` couvre RFC TOTP, altération, rotation et redirections.

### SEC-005

- **Vulnérabilité** : parsing JSON/texte sans borne indépendante de `Content-Length`.
- **Gravité** : P2.
- **Fichier** : `lib/server/request-body.ts` et tous les handlers de mutation.
- **Ligne** : lecteur stream vers 19 ; JSON vers 51.
- **Cause** : `request.json()` pouvait allouer un corps arbitraire, notamment en transfert chunked ou avec longueur forgée.
- **Scénario d’exploitation** : un bot envoie des corps volumineux parallèles sur formulaires, login ou checkout.
- **Impact** : mémoire, temps CPU, coûts serverless et indisponibilité.
- **Correctif** : lecture stream bornée, type JSON obligatoire et limites adaptées de 4 Ko à 1 Mo.
- **Modification** : remplacement de tous les `request.json()`/`request.text()` ; multipart rejeté sans longueur bornée.
- **Test** : `tests/security.test.ts` teste un stream surdimensionné sans longueur ; E2E obtient 413.

### SEC-006

- **Vulnérabilité** : URLs externes ou chemins stockés trop permissifs.
- **Gravité** : P2.
- **Fichier** : `lib/security.ts`, `lib/validation.ts`, `lib/server/catalog.ts`, `lib/server/lots.ts`, `lib/server/orders.ts`.
- **Ligne** : allowlists URL vers 10/19 ; usages validation vers 87, 102, 226 et 287.
- **Cause** : des schémas acceptaient des protocoles ou formes ambiguës ensuite rendus en liens/images.
- **Scénario d’exploitation** : un compte admin compromis stocke `javascript:`, HTTP, credentials URL, chemin `//` ou traversée ambiguë.
- **Impact** : XSS, phishing, fuite de référent et navigation non sûre.
- **Correctif** : HTTPS externe uniquement et chemins locaux stricts ; sanitation également à la lecture des anciennes lignes.
- **Modification** : validateurs centraux et filtrage catalogue/lots/suivi/factures.
- **Test** : `tests/validation.test.ts` refuse `javascript:` et HTTP.

### SEC-007

- **Vulnérabilité** : droits Data API permettant des mutations directes hors logique serveur.
- **Gravité** : P2.
- **Fichier** : `supabase/commerce.sql`.
- **Ligne** : politiques profils/adresses et révocations vers 1642.
- **Cause** : une session authentifiée pouvait contourner certaines limites métier de l’API, notamment le maximum d’adresses ; une future policy profil risquait une élévation de rôle.
- **Scénario d’exploitation** : appel direct Supabase au lieu de l’API Next.js avec un payload choisi.
- **Impact** : intégrité des profils, adresses et données commerciales.
- **Correctif** : aucune policy de modification de rôle/adresse et révocation explicite `insert/update/delete` pour `anon` et `authenticated` sur les tables métier.
- **Modification** : seules les opérations serveur `service_role` contrôlées peuvent muter ces tables.
- **Test** : `tests/data-integrity.test.ts` vérifie l’absence des policies dangereuses et les `REVOKE`.

### SEC-008

- **Vulnérabilité** : CSP script permissive, cache privé incomplet et cookies Auth non rafraîchis par le Proxy.
- **Gravité** : P2.
- **Fichier** : `proxy.ts`, `app/layout.tsx`, `app/api/auth/callback/route.ts`.
- **Ligne** : refresh vers 9 ; CSP vers 36 ; anti-cache vers 74 ; callback `setAll`.
- **Cause** : une CSP statique avec script inline protège peu ; les Server Components ne peuvent pas persister seuls un refresh Supabase ; une page privée cachée peut mélanger des sessions.
- **Scénario d’exploitation** : une injection exploite l’inline, ou un CDN sert une réponse Auth à un autre utilisateur.
- **Impact** : vol/session confuse, données compte/commande/admin.
- **Correctif** : nonce aléatoire, `strict-dynamic`, `script-src-attr 'none'`, `frame-ancestors 'none'`, pages dynamiques, cache privé et modèle SSR Supabase officiel `getClaims`.
- **Modification** : Proxy propage les cookies et en-têtes anti-cache à la requête et à la réponse.
- **Test** : `tests/security.test.ts` inspecte le refresh ; E2E vérifie nonce, absence de script `unsafe-inline`, anti-clickjacking et cache non public.

### SEC-009

- **Vulnérabilité** : jeton de désabonnement réutilisable conservé en clair en base.
- **Gravité** : P2.
- **Fichier** : `lib/server/subscriber-tokens.ts`, `lib/server/submissions.ts`, `lib/server/marketing.ts`, `supabase/commerce.sql`.
- **Ligne** : création HMAC vers 13 ; migration `drop column` vers 316.
- **Cause** : une lecture de base donnait directement les liens capables de modifier le consentement.
- **Scénario d’exploitation** : fuite ou accès abusif à la table puis désabonnement ciblé ou massif.
- **Impact** : intégrité des consentements, réputation et opérations marketing.
- **Correctif** : jeton HMAC dérivé du courriel et secret serveur ; seule son empreinte est stockée.
- **Modification** : suppression de la colonne en clair et rotation des empreintes lors des campagnes.
- **Test** : inspection SQL et recherche globale ; test live de migration **NON VÉRIFIÉ**.

### SEC-010

- **Vulnérabilité** : contrôle multipart tardif et PDF potentiellement actif.
- **Gravité** : P2.
- **Fichier** : `app/api/admin/uploads/route.ts`.
- **Ligne** : longueur vers 48 ; signatures PDF actives vers 78.
- **Cause** : `formData()` peut parser avant le contrôle réel ; le type MIME/extension seuls ne neutralisent pas JavaScript, actions ou pièces jointes PDF.
- **Scénario d’exploitation** : admin compromis téléverse un gros flux ou un PDF actif présenté ensuite comme document AVANA.
- **Impact** : disponibilité, phishing, compromission du lecteur PDF.
- **Correctif** : longueur déclarée obligatoire et bornée, magic bytes, extensions allowlist, noms aléatoires et rejet de marqueurs PDF actifs.
- **Modification** : taille 8,5 Mo avant parsing et signatures `/JavaScript`, `/OpenAction`, `/Launch`, etc. refusées.
- **Test** : contrôle statique et build ; antivirus, décompression/image bomb et CDR **NON VÉRIFIÉS** car aucun service d’analyse n’est connecté.

### SEC-011

- **Vulnérabilité** : lien privé de commande valable 365 jours.
- **Gravité** : P3.
- **Fichier** : `lib/server/order-access.ts`.
- **Ligne** : `DEFAULT_LIFETIME_SECONDS` vers 4.
- **Cause** : une URL divulguée restait utile trop longtemps.
- **Scénario d’exploitation** : historique navigateur, transfert de courriel ou journal expose un lien encore valable.
- **Impact** : nom, adresse, articles et suivi d’une commande.
- **Correctif** : réduire la fenêtre et permettre rotation globale.
- **Modification** : durée de 30 jours ; rotation de `SESSION_SECRET` invalide les liens existants.
- **Test** : vérification de signature/expiration existante et build ; test temporel dédié recommandé.

### SEC-012

- **Vulnérabilité** : nom de table Supabase configurable dans un contexte `service_role`.
- **Gravité** : P3.
- **Fichier** : `lib/server/submissions.ts`, `.env.example`.
- **Ligne** : table fixe vers 32.
- **Cause** : une variable de déploiement erronée pouvait rediriger des écritures privilégiées vers une table inattendue.
- **Scénario d’exploitation** : compromission de configuration ou erreur opérateur élargit l’effet du client privilégié.
- **Impact** : intégrité/confidentialité de données selon le schéma ciblé.
- **Correctif** : supprimer cette flexibilité inutile.
- **Modification** : valeur constante `submissions` et variable retirée de l’exemple.
- **Test** : recherche globale sans occurrence de `SUPABASE_SUBMISSIONS_TABLE`.

### SEC-013

- **Vulnérabilité** : chaîne CI sans audit/SAST/secrets et références GitHub Actions mouvantes.
- **Gravité** : P3.
- **Fichier** : `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `scripts/scan-secrets.mjs`, `package.json`.
- **Ligne** : étapes CI vers 15 ; CodeQL vers 19 ; script npm vers 18.
- **Cause** : le pipeline ne bloquait pas une dépendance vulnérable ou un secret détectable et faisait confiance à des tags d’action.
- **Scénario d’exploitation** : dépendance compromise, secret commité ou action tierce remplacée atteint le build/déploiement.
- **Impact** : code, secrets CI, production et chaîne d’approvisionnement.
- **Correctif** : SHA immuables, permissions minimales, `npm ci`, audit, scan de secrets et CodeQL hebdomadaire/PR.
- **Modification** : workflows durcis et Next.js mis à jour de 16.3.4 à 16.3.5.
- **Test** : exécution locale du scan et de `npm audit` ; workflow GitHub hébergé **NON VÉRIFIÉ** tant que le dépôt n’est pas poussé.

## 5. Correctifs réalisés

- Sérialisation JSON-LD anti-XSS et CSP à nonce stricte, clickjacking bloqué, HSTS et headers défensifs.
- MFA TOTP admin, session courte signée avec nonce, rotation invalidante, rate limit et audit login/logout.
- Rafraîchissement Supabase SSR conforme au Proxy, identité revalidée et cache privé interdit.
- Origine vérifiée sur mutations cookie, redirections locales allowlistées et empreinte IP privilégiant l’en-tête Vercel non usurpable.
- Parsing de tous les corps JSON/texte borné ; upload borné avant multipart et PDF actif filtré.
- Prix, livraison, CAD, taxes, quantités et stock déterminés serveur ; locks SQL et contraintes de machine d’état.
- Webhook Stripe brut signé, corrélé, atomiquement idempotent, récupérable après échec et notifications persistantes.
- RLS/droits renforcés, mutation métier réservée au serveur et fonctions sensibles uniquement `service_role`.
- URLs stockées HTTPS/locales sûres, anciennes valeurs filtrées à la sortie, CSV protégé contre l’injection tableur.
- Minimisation des jetons infolettre et durée réduite des liens de commande.
- CI supply-chain renforcée, scan de secrets, CodeQL, audit npm et versions exactes.
- Runbook de réponse aux incidents et checklist d’exploitation dans `SECURITY.md`.

## 6. Correctifs encore nécessaires

Aucun correctif P0/P1 connu ne reste dans le code. Les éléments suivants nécessitent une action externe ou une évolution ultérieure :

- **Avant production — NON VÉRIFIÉ** : exécuter `supabase/commerce.sql` version 3 sur staging puis production et vérifier RLS/RPC/buckets avec les vraies clés.
- **Avant production — NON VÉRIFIÉ** : configurer Stripe test puis live, webhook live, événements, taxes, Radar et faire paiement/remboursement/litige de bout en bout.
- **Avant production — NON VÉRIFIÉ** : configurer Vercel TLS, WAF, protection des previews, limites de coût, logs/alertes et domaine Squarespace.
- **Avant production — NON VÉRIFIÉ** : activer MFA et moindre privilège sur tous les comptes fournisseurs, puis séparer développement/staging/production.
- **Avant production — NON VÉRIFIÉ** : activer backups/PITR selon le plan, sauvegarder séparément Storage et réussir une restauration de test.
- **Avant production — NON VÉRIFIÉ** : vérifier SPF, DKIM et DMARC Resend ainsi que la délivrabilité et les consentements réels.
- **P2 résiduel** : connecter un antivirus/CDR si des PDF tiers non entièrement fiables doivent être publiés.
- **P2 architectural** : remplacer à terme l’identité admin partagée par des comptes nominatifs Supabase/SSO, MFA par personne, révocation et rôles fins.
- **P3** : ajouter des tests d’intégration SQL concurrents dans un projet Supabase de staging et une campagne DAST authentifiée après hébergement.

## 7. Tests ajoutés

- XSS JSON-LD et URL dangereuse.
- TOTP, session admin altérée, rotation de credentials et retour ouvert.
- Corps stream surdimensionné, type JSON incorrect et réponse 413.
- Webhook sans signature rejeté.
- Présence de la revendication webhook atomique, locks de stock, corrélation session et droits SQL.
- Champ `role` client supprimé, prix/total client supprimés, quantités/adresses validées.
- CSP nonce stricte, `frame-ancestors`, `object-src` et réponse privée non publique.
- Refresh Supabase `getClaims` et propagation cookies/cache.
- Parcours mobile/desktop, checkout sans champ carte, formulaires et traçabilité.

Résultat local final : **30 tests unitaires et 14 tests Playwright réussis**, typecheck/lint/format/build réussis, **0 vulnérabilité npm**, aucun motif de secret connu parmi **222 fichiers**.

### Scénarios d’abus demandés

| Scénario                       | Résultat                                                 | Niveau de preuve                                 |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------ |
| prix modifié dans DevTools     | prix client absent du DTO et recalcul DB                 | VÉRIFIÉ statiquement                             |
| appel direct checkout          | origine, rate limit, schéma, catalogue DB                | VÉRIFIÉ localement                               |
| `userId` modifié               | aucune identité client acceptée                          | VÉRIFIÉ statiquement                             |
| `orderId` modifié              | propriétaire Supabase ou token HMAC lié à ordre+courriel | VÉRIFIÉ statiquement                             |
| `role=admin`                   | propriété supprimée, droits profil révoqués              | VÉRIFIÉ par test                                 |
| faux webhook réussi            | signature Stripe obligatoire                             | VÉRIFIÉ par E2E                                  |
| webhook valide rejoué dix fois | claim SQL atomique                                       | PARTIELLEMENT VÉRIFIÉ, test DB live requis       |
| deux achats du dernier stock   | `FOR UPDATE` et stock conditionnel                       | PARTIELLEMENT VÉRIFIÉ, test DB live requis       |
| 1000 logins                    | rate limit distribué + WAF recommandé                    | PARTIELLEMENT VÉRIFIÉ, charge live non lancée    |
| coupon simultané               | promotions gérées/limitées par Stripe Checkout           | PARTIELLEMENT VÉRIFIÉ, compte Stripe live requis |

## 8. Risques résiduels

- Le modèle admin reste un principal partagé : l’audit indique une action admin, pas quelle personne l’a faite.
- Une session admin volée reste utilisable au maximum deux heures ; aucune liste de révocation instantanée n’est persistée.
- Le rate limiting applicatif dépend de Supabase ; en panne de base il refuse ou dégrade selon la route, et le WAF doit absorber les volumes extrêmes.
- Les marqueurs PDF bloqués ne remplacent pas un moteur antivirus/CDR ni une inspection de bombes d’image.
- La configuration `style-src 'unsafe-inline'` subsiste pour les styles React inline ; les scripts n’acceptent pas `unsafe-inline`.
- La sécurité finale dépend des clés, politiques RLS, buckets, redirections Auth, WAF, DNS, TLS et comptes fournisseurs réels.
- Une compromission Stripe, Supabase, Resend, Vercel ou du compte DNS reste un risque tiers à réduire par MFA, rôles minimaux, alertes et rotation.
- Les sauvegardes base Supabase ne couvrent pas automatiquement le contenu Storage ; un plan de sauvegarde séparé est indispensable.

### Périmètre PCI

Le code redirige vers **Stripe Checkout hébergé** et les tests ne trouvent aucun champ ou stockage de carte. L’application manipule identifiants de session, montants et statuts, pas PAN/CVV. Cette architecture réduit fortement le périmètre et peut correspondre aux critères SAQ A si tous les éléments de paiement proviennent du prestataire conforme ; l’éligibilité finale doit être confirmée par l’acquéreur ou le conseiller PCI selon la [FAQ officielle PCI SSC](https://www.pcisecuritystandards.org/faqs/if-a-merchant-s-e-commerce-implementation-meets-the-criteria-that-all-elements-of-payment-pages-originate-from-a-pci-dss-compliant-service-provider-is-the-merchant-eligible-to-complete-saq-a-or-saq-a-ep/). **Ce rapport n’est pas une certification PCI DSS.**

## 9. Configuration production

- [ ] Créer projets, clés et données distincts pour staging/production ; ne jamais copier `.env.local` dans Git.
- [ ] Exécuter `supabase/commerce.sql`, confirmer `commerce_schema_version() = 3`, RLS actif et privilèges `anon/authenticated` minimaux.
- [ ] Vérifier buckets `avana-public`/`avana-private`, types/taille, URLs signées et sauvegarde Storage.
- [ ] Configurer Auth Site URL/redirect exacts, SMTP, durée OTP, CAPTCHA si abus et tester refresh/logout sur plusieurs navigateurs.
- [ ] Générer `ADMIN_PASSWORD`, `SESSION_SECRET`, `ADMIN_TOTP_SECRET`, `CRON_SECRET` uniques ; enregistrer TOTP hors dépôt.
- [ ] Activer MFA fournisseur, rôles minimaux, protection de branche et revue obligatoire.
- [ ] Configurer Stripe live, endpoint signé exact, événements, taxes, Radar, alertes et réconciliation cron.
- [ ] Effectuer commande CAD réelle contrôlée, remboursement partiel/complet, expiration, double clic et replay webhook en staging.
- [ ] Vérifier Resend SPF/DKIM/DMARC, adresses From/To, désabonnement et suppression des données.
- [ ] Importer dans Vercel avec Node 22, variables Production séparées, Pro pour le cron, protection des previews et aucune clé prod sur PR non fiable.
- [ ] Configurer domaine Squarespace vers Vercel, HTTPS canonique, redirection HTTP, HSTS et absence de mixed content.
- [ ] Activer Vercel Firewall/WAF, règles bot/rate/cost, Log Drain et alertes décrites dans `SECURITY.md`.
- [ ] Activer backups/PITR, rétention, accès restreint et réussir une restauration staging incluant les fichiers.
- [ ] Exécuter `npm run readiness` jusqu’à zéro blocage puis toute la suite de validation de `SECURITY.md`.
- [ ] Lancer d’abord avec `NEXT_PUBLIC_COMMERCE_ENABLED=false`, valider `/api/health` et `/admin/parametres`, puis activer le commerce.
- [ ] Faire approuver fiscalité, politiques, confidentialité, consentements, étiquetage et périmètre PCI par les responsables compétents.

Le contrôle local `npm run readiness:test` retourne actuellement **20 blocages et 2 avertissements**, car `.env.local` contient des valeurs absentes/de démonstration. Aucun secret n’a été affiché. C’est attendu localement, mais cela interdit d’interpréter ce dépôt comme prêt à vendre sans configuration d’hébergement.

## 10. Verdict

**🟡 ACCEPTABLE POUR STAGING, AUDIT SUPPLÉMENTAIRE RECOMMANDÉ**

Le code ne présente plus de problème P0/P1 connu après les vérifications effectuées, mais le passage en production reste conditionné à la migration SQL v3, aux secrets réels, aux tests Stripe/Supabase live, au WAF/monitoring, aux sauvegardes/restauration et à la validation PCI/juridique. Ce verdict ne signifie jamais une sécurité absolue.
