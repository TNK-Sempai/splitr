# Splitr

Application web open source de partage de dépenses entre deux personnes. Inspirée de Tricount, identité visuelle Tanuki Corporation.

## Stack

| Couche | Technologie |
|--------|-------------|
| Runtime | Node.js 20+ |
| API | Express 4 |
| ORM | Prisma |
| Base de données | MariaDB (local) / Railway (prod) |
| Auth | JWT httpOnly cookie |
| Frontend | HTML/CSS/JS vanilla |
| Déploiement | Vercel |

## Setup local

### Prérequis

- Node.js 20+
- MAMP avec MariaDB sur `localhost:3306`

### Installation

```bash
git clone https://github.com/TNK-Sempai/splitr.git
cd splitr
npm install
cp .env.example .env
# Éditer .env avec vos valeurs
```

### Base de données

```sql
CREATE DATABASE IF NOT EXISTS splitr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed    # Crée Tanuki + Fox + groupe Foyer
```

### Lancer

```bash
npm run dev
# → http://localhost:3000
```

Comptes de test après seed :
- `tanuki@splitr.app` / `password123`
- `fox@splitr.app` / `password123`

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement (hot reload) |
| `npm start` | Serveur de production |
| `npm run db:migrate` | Créer une migration |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Insérer les données de test |
| `npm run db:reset` | Réinitialiser la BDD |

## Déploiement Vercel

1. [Railway](https://railway.app) → New Project → Provision MySQL → copier `DATABASE_URL`
2. Vercel → Import repo → ajouter les variables d'environnement :
   - `DATABASE_URL` : URL Railway
   - `JWT_SECRET` : chaîne aléatoire 32+ chars
   - `NODE_ENV` : `production`
3. `npx prisma migrate deploy` (une fois, avec la DATABASE_URL de prod)

## Licence

MIT — Tanuki Corporation
