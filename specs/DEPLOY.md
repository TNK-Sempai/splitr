# Splitr — Deploy

## Architecture de déploiement

```
GitHub repo
    │
    ├── Vercel (frontend + API serverless)
    │       └── compte-de-la-crypte.vercel.app
    │
    └── Railway (MariaDB/MySQL managé)
            └── connexion via DATABASE_URL
```

---

## Développement local

### Prérequis
- Node.js 20+
- MAMP avec MariaDB sur `localhost:3306`
- Base de données `splitr` créée manuellement

### Setup initial

```bash
# Cloner le repo
git clone https://github.com/TNK-Sempai/splitr.git
cd splitr

# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env
# → éditer .env avec les vraies valeurs

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev --name init

# Seeder la BDD (optionnel)
npx prisma db seed

# Lancer le serveur de dev
npm run dev
```

### Scripts npm

```json
{
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset"
  }
}
```

---

## Variables d'environnement

### .env.example

```env
# Base de données
DATABASE_URL="mysql://root:root@localhost:3306/splitr"

# JWT
JWT_SECRET="changeme_minimum_32_chars_random_string"

# Environnement
NODE_ENV="development"
PORT=3000
```

### En production (Vercel)

Configurer dans Vercel → Settings → Environment Variables :

| Nom | Valeur |
|-----|--------|
| `DATABASE_URL` | URL Railway (mysql://...) |
| `JWT_SECRET` | Chaîne aléatoire sécurisée (32+ chars) |
| `NODE_ENV` | `production` |

---

## vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "src/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/app", "dest": "/src/app.html" },
    { "src": "/", "dest": "/src/index.html" }
  ]
}
```

---

## Base de données en production : Railway

### Setup

1. Aller sur [railway.app](https://railway.app)
2. New Project → Provision MySQL
3. Copier la `DATABASE_URL` dans les variables Vercel
4. Lancer `npx prisma migrate deploy` (une seule fois)

### Commande migration prod

```bash
# Depuis le terminal local avec la DATABASE_URL de prod
DATABASE_URL="mysql://..." npx prisma migrate deploy
```

---

## Déploiement Vercel

### Setup initial

```bash
# Installer Vercel CLI
npm i -g vercel

# Login
vercel login

# Premier déploiement
vercel

# Lier le repo GitHub pour auto-deploy
vercel link
```

### Auto-deploy

Chaque `git push` sur `main` → Vercel redéploie automatiquement.

---

## server.js (dev local uniquement)

```js
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import authRouter from './api/auth.js'
import monthsRouter from './api/months.js'
import expensesRouter from './api/expenses.js'
import balanceRouter from './api/balance.js'

const app = express()

app.use(cors({ origin: 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(express.static('src'))

app.use('/api/auth', authRouter)
app.use('/api', monthsRouter)
app.use('/api', expensesRouter)
app.use('/api', balanceRouter)

app.listen(process.env.PORT || 3000, () => {
  console.log('Splitr running on http://localhost:3000')
})
```

---

## package.json

```json
{
  "name": "splitr",
  "version": "1.0.0",
  "description": "Open source expense sharing app",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "node prisma/seed.js",
    "db:reset": "prisma migrate reset"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0"
  },
  "prisma": {
    "seed": "node prisma/seed.js"
  }
}
```

---

## .gitignore

```
node_modules/
.env
.env.local
prisma/migrations/
dist/
.vercel/
```

---

## README.md (à créer)

Le README doit contenir :
- Description du projet
- Stack technique
- Instructions de setup local
- Instructions de déploiement
- Licence MIT
- Lien vers la démo live
