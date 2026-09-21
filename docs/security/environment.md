# Audit environnement et CI — 14 septembre 2026

## Périmètre et preuves

Travail effectué directement dans AVANA. Aucun dossier `.git` disponible : historique, index réel, remote, hooks Git et modifications préexistantes non vérifiables. Aucun commit ni changement de configuration global.

Compétences ECC effectivement lues : `security-scan`, `deployment-patterns`, `search-first`. Configuration agent, scripts npm, lockfile, workflows GitHub Actions et fichiers d'environnement examinés ; aucune valeur de secret inscrite dans ce rapport.

## Résultats applicables

| ID     | Priorité | Constat                                                                                                                                                                             | Résolution                                                                                                                                                                    |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENV-01 | P2       | L'ancien scanner excluait les fichiers `.env` même suivis par Git, et omettait les fichiers source non suivis. Il ne reconnaissait pas les clés secrètes/JWT service_role Supabase. | Corrigé : suivi Git + fichiers non ignorés, rejet des `.env` suivis, détection Supabase/Stripe test/OpenAI, option explicite `--include-local`, erreurs de lecture signalées. |
| ENV-02 | P2       | `.env.production`, `.env.staging`, etc. n'étaient pas exclus de Git.                                                                                                                | Corrigé : `.env.*` exclu avec exception `.env.example`.                                                                                                                       |
| ENV-03 | P3       | Checkout CI conservait les identifiants Git, jobs sans délai maximal.                                                                                                               | Corrigé : `persist-credentials: false`, timeout de 20 minutes sur qualité, navigateur et CodeQL.                                                                              |
| ENV-04 | P2       | Transcodes Guard n'est pas démontré actif pour les commandes Codex.                                                                                                                 | Ouvert, configuration externe au projet : voir preuves ci-dessous.                                                                                                            |
| ENV-05 | P2       | MCP Chrome DevTools ECC lancé via `npx -y chrome-devtools-mcp@latest`.                                                                                                              | Ouvert : version mutable téléchargée automatiquement. Épingler une version vérifiée dans la configuration du plugin, après accord utilisateur.                                |

Les totaux ci-dessus portent sur des défauts confirmés ou du durcissement de l'environnement ; ils ne constituent pas des CVE applicatives.

## AgentShield réellement exécuté

CLI `ecc-agentshield@1.6.0`, téléchargé temporairement avec scripts d'installation désactivés et sans installation globale. Métadonnées npm consultées avant exécution. Le paquet expose le binaire `agentshield` ; l'essai initial avec le nom `ecc-agentshield` a échoué, puis le point d'entrée Node réel a été utilisé.

Commandes effectives, chemin du cache utilisateur omis :

```text
node <cache>/ecc-agentshield/dist/index.js scan --path . --format json --supply-chain --output docs/security/agentshield-before.raw.json
node <cache>/ecc-agentshield/dist/index.js scan --path <profil>/.codex --format json --supply-chain --output docs/security/agentshield-codex.raw.json
node <cache>/ecc-agentshield/dist/index.js scan --path . --format json --supply-chain --output docs/security/agentshield-after.raw.json
```

Résultat dépôt avant : 525 alertes, dont 513 faux positifs « Azure storage account key » sur les empreintes d'intégrité npm. Après ajout du moteur de test RLS par l'audit principal : 526 alertes, dont **514/514 vérifiées sur les lignes `integrity` du lockfile**. Les 12 autres alertes sont des heuristiques de défenses de prompt manquantes dans `CLAUDE.md`, qui contient uniquement `@AGENTS.md`. Aucun chemin d'exploitation confirmé par ces heuristiques. Le score brut C/60 n'est pas une note de sécurité applicative.

Le scan du profil Codex a analysé 1 709 fichiers et produit 5 895 alertes, majoritairement sur des exemples, caches et configurations non actives. Les compteurs bruts ne décrivent pas 5 895 vulnérabilités exploitables. Les configurations actives pertinentes ont été triées dans `agentshield-codex.json`. La chaîne ECC SessionStart est du code local fourni par le plugin, référencé par un hash de confiance ; aucune interpolation de contenu utilisateur constatée dans cette commande. Sa longueur déclenche des heuristiques sans prouver une injection.

Extension VS Code installée : `aiconnai-vs.agentshield` 1.0.0. C'est un autre projet AgentShield (aiconnai), qui attend un exécutable `agentshield` externe. Aucun binaire de ce projet trouvé dans PATH, les emplacements npm, Cargo ou Python inspectés, et aucun chemin binaire personnalisé trouvé dans les paramètres utilisateur VS Code. **L'extension VS Code n'a pas été exécutée.** Aucun correctif automatique AgentShield lancé, aucun hook inconnu exécuté, aucun envoi à un modèle externe.

## Transcodes Guard : protection non validée

Plugin installé : 0.87.0, activé dans la configuration Codex. Les outils MCP de simulation en lecture seule ont réellement été invoqués :

- `tc_simulate_command` : Git lecture seule, suppression, Git global, lecture `.env`, téléchargement suivi d'exécution, permissions Windows, installation globale et écriture hors projet. Ce sont uniquement des chaînes simulées ; les actions sensibles n'ont pas été exécutées.
- Les huit résultats indiquent `block-no-token` : token Transcodes non configuré.
- `tc_simulate_tool_call` avec `exec_command` indique `will_trigger_hook: false` ; avec un outil MCP Chrome DevTools, `true`.
- Vérification locale indépendante : le manifeste du plugin référence `hooks/hooks.json`, qui contient **un objet hooks vide**. Le fichier source `hooks/pre-tool-use.ts` quitte également sans bloquer si le token manque et dans son gestionnaire d'erreur.

Les simulations ne prouvent donc pas qu'un appel réel Codex serait intercepté. Aucun test destructif, aucun contournement, aucune modification de permissions, token, hook ou configuration globale. Action manuelle : configurer le plugin via son mécanisme officiel et vérifier ensuite la couverture des commandes Codex par une sonde bénigne dans le véritable hôte.

## Dépendances et installation

`npm audit --offline=false --json` exécuté via registre npm : **0 vulnérabilité connue avant**, 513 dépendances comptées. Un premier `npm outdated` avait échoué à cause du mode cache imposé ; nouvelle exécution avec autorisation réseau et `--offline=false` réussie. Le rescan final est conservé dans `npm-audit-after.json`.

Lockfile v3 : origines de paquets uniquement sur `registry.npmjs.org`, empreintes d'intégrité présentes. Scripts d'installation déclarés avant modification : `fsevents` 2.3.3 et 2.3.2 (optionnels macOS), `unrs-resolver` 1.12.2 (installation de binding natif via `napi-postinstall`). Aucun script npm racine `preinstall`/`postinstall`.

Versions plus récentes disponibles sans vulnérabilité signalée : Playwright, types Node, ESLint, Lucide, Prettier, TypeScript, Zod. Pas de mise à jour opportuniste ni majeure appliquée. Métadonnées exactes dans `npm-outdated.json`. Le CLI d'audit externe a émis des avertissements de dépréciation de ses propres dépendances `glob` et `node-domexception` ; il n'a pas été ajouté aux dépendances AVANA.

## Secrets et Git

`node scripts/scan-secrets.mjs --include-local` réussi après correction. Les identifiants serveur présents dans `.env.local` (admin, session, Supabase, Stripe, Resend, Canada Post et cron) sont vides. Pas de secret réel trouvé dans les sources examinées. Analyse additionnelle du bundle `.next/static` : 45 fichiers JS/JSON/map/CSS, aucun motif secret détecté ; artifact `client-bundle-secrets.json`. Le même contrôle a été répété sur le bundle du build final par l'audit principal : 45 fichiers, aucun motif secret détecté.

Rotation nécessaire sur le périmètre AVANA inspecté : **aucune identifiée**. L'absence de `.git` empêche toute conclusion sur l'historique. Les magasins d'authentification personnels de l'hôte ne sont pas des sources applicatives et leurs valeurs n'ont pas été affichées.

Limites du scanner : détection par motifs et noms connus, pas preuve mathématique d'absence de secret ; fichiers binaires et liens symboliques non interprétés, fichier texte supérieur à 20 Mo signalé comme scan incomplet. Les rapports bruts sont exclus de Git et du formatage. Les rapports partageables contiennent seulement catégories, chemins et compteurs, jamais les éléments de preuve textuels.

## CI et validation

Protections existantes conservées : permissions GitHub minimales, actions épinglées par SHA, `npm ci`, audit npm au seuil moderate, formatage, TypeScript, ESLint, Vitest, build, Playwright et CodeQL. Aucune étape ignorée ou désactivée pour rendre la CI verte. Pas d'intégration fictive de Codex Security, AgentShield VS Code ou 42Crunch.

Sept tests réels ajoutés dans `tests/security/secret-scanner.test.mjs` : clé Supabase privée sans fuite de valeur, JWT service_role vs anon, `.env` réellement ajouté à un dépôt Git temporaire malgré gitignore, nouveau fichier non suivi, inclusion explicite d'un `.env.local`, hashes npm non secrets, exclusion limitée des preuves scanner et mot de passe serveur sans préfixe. **7/7 passent**. Lint ciblé réussi. Vitest avait d'abord échoué `spawn EPERM` dans le sandbox ; relance autorisée hors sandbox réussie sans désactiver la protection ni falsifier de test.

Validation finale consolidée par l'audit principal : 141 tests Vitest, 18 tests Playwright sur build de production, typecheck, lint, formatage et build réussis. Voir le [rapport général](../../SECURITY_HARDENING_2026-09-14.md) pour les limites de cette validation locale.

## 42Crunch et outils non exécutés dans ce sous-audit

Extension `42crunch.vscode-openapi` 5.9.0 installée. Aucune spécification OpenAPI/Swagger trouvée dans AVANA. L'extension n'a pas été exécutée ; l'audit manuel des routes API est traité par l'audit applicatif principal. Codex Security est également géré par l'audit principal, pas revendiqué ici.
