# AVANA — matrice de sécurité des API

**Archive de phase 1.** Depuis la [phase 2](../../SECURITY_PHASE2_2026-09-14.md), les gardes admin vérifient aussi le registre SQL de sessions révocables. Les constats ci-dessous restent ceux de la revue initiale.

Revue du code local, 2026-09-14. Les nombres entre parenthèses représentent les
**42 fichiers Route Handler**, pas le nombre de méthodes HTTP. Cette matrice
décrit les contrôles constatés et leurs exceptions ; elle ne prétend pas que
toutes les routes ont une authentification, un quota ou un journal d'audit.
Elle ne certifie pas la configuration des services déployés.

**C** : session Supabase vérifiée, email confirmé. **A** : session admin signée,
obtenue par mot de passe + TOTP.

| Famille `/api/…`                                                                             | AUTH                                                         | AUTHZ                                                                               | Validation serveur                                                     | Quotas applicatifs                                          | Journalisation                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `submissions`, `analytics` **(2)**                                                           | Public                                                       | Origine ; finalité publique                                                         | Zod + corps borné ; honeypot formulaires                               | Oui ; formulaires aussi par destinataire                    | Données métier/analytics ; erreurs de livraison                |
| `auth/{magic-link,callback,logout}` **(3)**                                                  | Lien magique ; échange PKCE ; session courante               | Redirection interne ; origine sur POST                                              | Email strict ; code/flowId bornés ; retour contrôlé                    | Magic-link : IP + destinataire. **Callback/logout : aucun** | Erreurs magic-link ; pas d'audit général callback/logout       |
| `account/{profile,addresses,addresses/[id],export}` **(4)**                                  | C                                                            | Identité serveur + ownership ; origine mutations                                    | Zod borné ; UUID adresse ; export sans paramètres                      | Profil/adresses par utilisateur ; export **3/h**            | Pas d'audit métier systématique                                |
| `orders/{[number],access}` **(2)**                                                           | C **ou** jeton signé pour lecture ; demande publique de lien | Propriétaire ou signature liée commande/email ; lien envoyé à l'adresse enregistrée | Format numéro ; Zod demande ; vérification cryptographique             | Lecture IP ; demande IP + paire email/commande              | File de notification ; pas d'audit de chaque lecture/refus     |
| `checkout/session` **(1)**                                                                   | Achat invité autorisé                                        | Origine ; configuration ; catalogue disponible                                      | Zod ; corps 24 Ko ; prix/stock SQL ; Stripe corrélé                    | IP + email                                                  | Commande/événements persistés ; erreurs serveur                |
| `newsletter/{confirm,unsubscribe}` **(2)**                                                   | Jeton de possession                                          | Hash enregistré ; confirmation expirante/unique                                     | Jeton borné ; état abonnement                                          | POST limités ; **GET redirections sans quota**              | État/horodatage abonnement ; erreurs welcome                   |
| `documents/[...path]` **(1)**                                                                | Public                                                       | Document référencé par lot public non archivé                                       | Chemin autorisé ; fichier borné ; téléchargement contrôlé              | Oui                                                         | Pas d'audit de téléchargement                                  |
| `admin/{login,logout}` **(2)**                                                               | Mot de passe + TOTP / A                                      | Origine ; signature session                                                         | Schéma login strict ; retour interne                                   | Login limité + anti-rejeu OTP ; **logout aucun**            | Succès/échecs login, logout ; audit au mieux disponible        |
| Admin produits/variantes/lots/stocks/commandes/B2B/submissions/operations/campagnes **(15)** | A                                                            | Contrôle serveur + origine mutations                                                | Zod borné ; UUID/module contrôlés selon route ; transitions SQL        | **Aucun quota applicatif**                                  | `audit_logs` mutations ; événements commande/inventaire        |
| `admin/uploads` **(1)**                                                                      | A                                                            | Origine ; destination autorisée                                                     | Corps 8,5 Mo ; fichier 8 Mo ; signature/MIME/extension ; chemin généré | **Aucun quota de fréquence**                                | Upload réussi audité ; erreur stockage                         |
| Admin exports B2B/lots/stocks/orders/operations + `files/[...path]` **(6)**                  | A                                                            | Session serveur ; module/chemin autorisé                                            | Export CSV protégé ; données serveur ; chemin fichier contrôlé         | **Aucun quota applicatif**                                  | **5 exports audités** ; fichier téléchargé non audité          |
| `webhooks/stripe` **(1)**                                                                    | Signature Stripe horodatée + mode                            | Corrélation session/commande ; autorisation restock                                 | Corps 1 Mo ; montants/country/statuts ; transactions                   | Pas de quota générique ; déduplication/bail, busy→503       | Événements persistés + erreurs ; pas chaque signature invalide |
| `cron/commerce` **(1)**                                                                      | Bearer secret comparé sûrement                               | Secret dédié                                                                        | Pas de paramètres métier ; opérations bornées                          | **Aucun quota ni verrou global d'exécution**                | Résultats JSON + logs des sous-services                        |
| `health` **(1)**                                                                             | Public                                                       | Sonde volontairement publique                                                       | Pas d'entrée ; une RPC de version                                      | **Aucun quota**                                             | Pas d'audit ; réponse réduite                                  |

## Interprétation des exceptions

- Le contrôle d'origine n'est pas une authentification. L'absence d'origine sur
  le désabonnement POST permet le mécanisme _one-click_ fondé sur son jeton.
- Les routes admin métier sont réservées à une autorité privilégiée : vérification
  serveur de la session, origine sur les mutations, corps bornés lorsqu'un corps
  est attendu, et audit selon les routes indiquées. L'absence d'un quota ne prouve
  pas qu'un endpoint public exploitable existe. Elle laisse néanmoins une capacité
  de consommation à encadrer pour un administrateur, une session compromise ou une
  automatisation erronée. Les quotas des uploads, exports et campagnes doivent
  être calibrés au trafic réel en staging, sans bloquer les opérations légitimes.
- Ne pas écrire « toutes les API sont authentifiées, limitées et journalisées ».
  Ne pas affirmer non plus que tous les schémas rejettent les champs inconnus :
  plusieurs `z.object` les retirent ; certains IDs texte catalogue/lots sont
  seulement transmis comme paramètres de requête.
- Les audits admin utilisent notamment l'acteur générique `admin-session` ;
  aucune attribution nominative complète ni révocation centralisée de session
  n'est démontrée par cette matrice.

## Limites OWASP API à valider sur staging

- **API1/API3/API5 — objets, propriétés et fonctions.** Les contrôles locaux
  d'ownership, les DTO et les refus RLS sont testés. Les grants/policies réellement
  déployés, Storage HTTP et l'attribution des rôles privilégiés nécessitent encore
  des requêtes avec deux comptes réels et un accès anonyme.
- **API2 — authentification.** Vérifier la configuration Supabase Auth, les URLs
  de retour, les fournisseurs d'identité, l'expiration et le cycle de vie des
  sessions sur le domaine de staging. Les contrôles locaux ne certifient pas
  les paramètres cloud.
- **API4/API6 — ressources et abus métier.** Les quotas par IP dépendent des
  en-têtes transmis par un proxy de confiance. Vérifier leur remplacement par
  l'hébergeur et l'absence d'accès direct au serveur permettant de les falsifier.
  Les limites distribuées exigent Supabase ; le secours local est propre au
  processus. Mesurer le trafic, les coûts et les opérations admin avant de fixer
  des quotas supplémentaires. Les courses entre connexions PostgreSQL et les
  exécutions cron concurrentes ne sont pas prouvées par un moteur à une session.
- **API7/API10 — requêtes sortantes et fournisseurs.** Les destinations et données
  sont contrôlées dans le code ; les redirections, réponses effectives, droits des
  clés, événements Stripe et pannes réseau doivent aussi être éprouvés avec les
  intégrations de staging. Pas de certification globale d'absence de SSRF fondée
  sur cette seule matrice.
- **API8/API9 — configuration et inventaire.** Les 42 fichiers décrivent le dépôt
  courant. Ils ne recensent pas d'éventuels anciens déploiements, endpoints des
  fournisseurs, objets Storage publics historiques, configurations WAF/proxy ou
  APIs ajoutées hors du dépôt. La migration SQL v5 n'a pas été déployée par cet
  audit.

Le bilan global communiqué est de **141 tests, dont 46 PostgreSQL, et 18 E2E sur
build production**. Ces résultats ne signifient pas que les 42 routes ont chacune
été testées de bout en bout contre les services distants. Voir aussi
[l'audit base de données](database.md) et
[le contrat des tests PostgreSQL](../../supabase/tests/README.md).
