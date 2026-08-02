# EDGC237 OS v1.0 — Guide de déploiement Phase Fondation

## Ce qui a été ajouté au site

```
edgc237_v7/
├── sql/001_init_fondation.sql   ← schéma Supabase à exécuter une fois
├── api/attempt.js                ← enregistre une auto-évaluation
├── api/ipe.js                    ← calcule l'IPE réel d'un élève
├── evaluation.html               ← formulaire élève (lié depuis WhatsApp)
└── package.json                  ← dépendance @supabase/supabase-js
```

## Étape 1 — Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com), crée un compte gratuit, puis "New project".
2. Une fois créé : **Project Settings → API**, note deux valeurs :
   - `Project URL` → ce sera `SUPABASE_URL`
   - `service_role` key (⚠️ pas la clé `anon`) → ce sera `SUPABASE_SERVICE_ROLE_KEY`

## Étape 2 — Exécuter la migration

1. Dans Supabase : **SQL Editor → New query**.
2. Colle tout le contenu de `sql/001_init_fondation.sql`, clique "Run".
3. Vérifie dans **Table Editor** que les tables `app_users`, `fascicules`, `fascicule_attempts` existent, avec 2 fascicules de départ.

## Étape 3 — Configurer les variables d'environnement sur Vercel

Dans le projet Vercel EDGC237 : **Settings → Environment Variables**, ajoute :

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | l'URL notée à l'étape 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé `service_role` notée à l'étape 1 |

⚠️ Ne mets jamais cette clé `service_role` dans un fichier du site — elle reste uniquement dans les variables d'environnement Vercel, jamais dans le code HTML/JS public.

## Étape 4 — Déployer

Redéploie le site (le dossier `api/` est automatiquement reconnu par Vercel comme des fonctions serverless — rien d'autre à configurer).

## Étape 5 — Générer un lien d'auto-évaluation pour un fascicule

Pour chaque fascicule, récupère son `id` dans Supabase (**Table Editor → fascicules**), puis construis le lien à partager sur WhatsApp après le fascicule :

```
https://edgc237.vercel.app/evaluation?fascicule=ID_ICI&titre=DÉMASQUER%20—%20GÉO%20BEPC%20—%20Dossier%201
```

## Étape 6 — Ajouter tes futurs fascicules

Dans Supabase, **Table Editor → fascicules → Insert row**, renseigne `title`, `subject`, `level`. Récupère l'`id` généré pour construire le lien (étape 5).

## Étape 7 — Consulter les résultats (Phase Fondation, vue manuelle)

Pas encore de tableau de bord admin visuel — pour l'instant, consulte directement **Table Editor → fascicule_attempts** dans Supabase, ou exécute une requête SQL simple :

```sql
select u.full_name, u.phone, f.title, a.score, a.completed, a.created_at
from fascicule_attempts a
join app_users u on u.id = a.user_id
join fascicules f on f.id = a.fascicule_id
order by a.created_at desc;
```

Une vue Admin dédiée sur le site est prévue en Phase Accélération (voir le document de cadrage).

## Sécurité — ce qui est déjà en place

- La clé `service_role` ne quitte jamais le serveur (fonctions `/api/*` uniquement).
- Validation stricte des entrées côté serveur (score, confiance).
- Row Level Security activé sur toutes les tables.
- **Auth réelle par OTP SMS** — l'élève est identifié par un compte Supabase Auth vérifié, plus par simple déclaration. Impossible d'usurper le numéro de quelqu'un d'autre.

## Étape 8 — Activer l'authentification par OTP (obligatoire pour la sécurité)

1. Exécute `sql/002_auth_rbac.sql` dans Supabase SQL Editor (après le 001).
2. **Configurer l'envoi de SMS** : Supabase n'envoie pas de SMS lui-même — il faut connecter un fournisseur. Dans Supabase : **Authentication → Providers → Phone**, active "Phone" et configure Twilio (ou MessageBird/Vonage). Ça implique un compte chez ce fournisseur, avec un coût par SMS envoyé — à budgétiser avant d'ouvrir largement.
3. Dans **Project Settings → API**, note la clé **`anon` / `public`** (différente de `service_role` — celle-ci est faite pour être visible côté client).
4. Ouvre `evaluation.html`, remplace `SUPABASE_URL` et `SUPABASE_ANON_KEY` par tes vraies valeurs (lignes en haut du `<script>`).
5. Redéploie.

⚠️ Sans l'étape 2 (fournisseur SMS configuré), le bouton "Recevoir mon code" échouera — c'est la seule dépendance externe payante de ce module.

## Ce qui n'est PAS encore géré
- Pas de tableau de bord visuel — lecture directe dans Supabase pour l'instant.

Ces points sont à corriger avant d'ouvrir l'auto-évaluation à un public large (au-delà d'un groupe pilote de confiance comme le Club Réussite VIP).
