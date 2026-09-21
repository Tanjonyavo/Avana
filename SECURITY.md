# Sécurité et réponse aux incidents

## Signalement

Ne pas ouvrir publiquement un ticket contenant une vulnérabilité, une donnée client ou un secret. Transmettre le rapport au propriétaire AVANA par un canal privé avec : environnement, route concernée, impact observé, heure UTC et étapes minimales de reproduction. Ne jamais joindre de clé, mot de passe, cookie ou donnée de carte.

## Triage

| Niveau | Exemple                                                                     | Première action                                                 | Délai cible       |
| ------ | --------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------- |
| P0     | paiement contourné, accès administrateur, fuite massive, secret réel exposé | désactiver le commerce, révoquer les secrets, isoler le service | immédiat          |
| P1     | IDOR, XSS persistant, webhook incorrect, élévation de privilège             | limiter l’exposition et déployer un correctif prioritaire       | moins de 24 h     |
| P2     | abus limité, indisponibilité partielle, défense incomplète                  | corriger dans le prochain cycle court                           | moins de 7 jours  |
| P3     | durcissement sans exploitation directe connue                               | planifier et suivre                                             | moins de 30 jours |

## Arrêt d’urgence

1. Définir `NEXT_PUBLIC_COMMERCE_ENABLED=false` dans Vercel et redéployer.
2. Désactiver ou faire expirer les liens Checkout concernés dans Stripe si nécessaire.
3. Révoquer et remplacer tout secret soupçonné : Stripe, Supabase `service_role`, Resend, `SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`, `CRON_SECRET`.
4. Avec le schéma v6 et toutes les instances à jour, révoquer les sessions administrateur concernées dans `public.admin_sessions` en renseignant `revoked_at` depuis un accès serveur autorisé. Pour révoquer toutes les sessions, faire approuver puis exécuter `UPDATE public.admin_sessions SET revoked_at = now() WHERE revoked_at IS NULL;`. Une déconnexion normale utilise la RPC de révocation de sa seule session. Si un secret de signature ou identifiant admin est compromis, le remplacer également. La rotation de `SESSION_SECRET` invalide aussi les anciens liens de commande et de désabonnement signés ; elle n’est plus nécessaire pour révoquer uniquement un cookie volé. Les requêtes déjà autorisées avant la révocation peuvent terminer : vérifier leurs effets dans les journaux.
5. Conserver les journaux Vercel, Stripe, Supabase, Resend et `audit_logs` avant toute purge.
6. Ne restaurer la vente qu’après test du correctif en staging et validation de `/api/health`.

## Alertes minimales

- plus de 20 échecs de connexion administrateur en 15 minutes ou une connexion depuis un pays/réseau inhabituel ;
- hausse des réponses `401`, `403`, `413`, `429` ou `500` par route ;
- trois erreurs consécutives du webhook Stripe, événement bloqué en `processing` plus de dix minutes ou écart de montant/devise ;
- taux inhabituel de paiements refusés, litiges, remboursements ou réservations expirées ;
- variation de stock sans entrée correspondante dans le journal d’inventaire ;
- file de notifications en échec ou retard de la tâche `/api/cron/commerce` ;
- échec de sauvegarde, de restauration de test ou modification des politiques RLS/buckets.

Les alertes ne doivent jamais contenir de mot de passe, secret, cookie, URL signée complète, corps Stripe brut ou donnée de carte.

## Exploitation sûre

- Utiliser des projets et secrets distincts pour développement, staging et production.
- Exiger MFA et moindre privilège sur GitHub, Vercel, Supabase, Stripe, Resend, Squarespace et le registraire.
- Protéger la branche `main`, exiger la CI et une revue avant déploiement.
- Activer la protection des previews Vercel et ne jamais y connecter une base de production.
- Tester trimestriellement une restauration Supabase dans un environnement isolé ; les objets Storage doivent avoir leur propre sauvegarde.
- Réviser mensuellement les administrateurs, webhooks, clés API, journaux d’audit et dépendances.
- Conserver une procédure hors ligne pour les commandes, remboursements et rappels pendant une indisponibilité.

## Validation avant réouverture

```powershell
npm ci
npm run security:secrets
npm audit --audit-level=moderate
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run readiness
```

Consigner la version déployée, la migration Supabase, les tests Stripe de bout en bout et l’approbation humaine. Un test réussi ne remplace pas une vérification de la configuration cloud réelle.
