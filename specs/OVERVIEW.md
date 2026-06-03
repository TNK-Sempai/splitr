# Splitr — Overview

## Vision

Splitr est une application web open source de partage de dépenses entre deux personnes (ou plus à terme), inspirée de Tricount. Elle permet de suivre les charges mensuelles, calculer les soldes et voir la balance globale sur toute la période.

Projet personnel de Tanuki Corporation — identité visuelle Tanuki (dark, lime green #c8f060, Bebas Neue).

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Runtime | Node.js 20+ |
| Framework API | Express 4 |
| ORM | Prisma |
| Base de données | MariaDB (local MAMP) → PlanetScale ou Railway (prod) |
| Auth | JWT (access token 7j, httpOnly cookie) |
| Frontend | HTML/CSS/JS vanilla — aucun framework |
| Déploiement | Vercel (API serverless + frontend statique) |
| Versioning | GitHub |

---

## Structure du projet

```
splitr/
├── api/                    # Handlers Express (serverless sur Vercel)
│   ├── auth.js
│   ├── months.js
│   ├── expenses.js
│   └── balance.js
├── src/                    # Frontend statique
│   ├── index.html          # Page login / register
│   ├── app.html            # Dashboard principal
│   └── assets/
│       ├── style.css
│       └── app.js
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── middleware/
│   └── auth.js             # Vérification JWT
├── lib/
│   ├── db.js               # Instance Prisma singleton
│   └── calc.js             # Logique de calcul des soldes
├── server.js               # Serveur dev local
├── vercel.json
├── .env.example
└── package.json
```

---

## Conventions de code

- **ES Modules** (`import/export`) partout
- **async/await** — pas de callbacks
- **Réponses API** toujours au format :
  ```json
  { "ok": true, "data": ... }
  { "ok": false, "error": "message lisible" }
  ```
- **Codes HTTP** : 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error
- **Variables d'environnement** via `.env` (jamais hardcodées)
- **Nommage** : camelCase JS, snake_case BDD

---

## Règles métier fondamentales

### Logique du pourcentage (pct)

`pct` = part assumée par le **payeur** lui-même (0 à 100).

| pct | Signification | Exemple |
|-----|--------------|---------|
| 50 | Partage équitable | Fox paie 1120€ loyer → chacun doit 560€ |
| 100 | Le payeur assume tout | Fox paie une dépense personnelle → l'autre ne doit rien |
| 0 | Remboursement pur | Tanuki vire 450€ à Fox → Fox reçoit 450€, Tanuki doit 0 en retour |

### Calcul du solde

```
partPayeur = amount * pct / 100
partAutre  = amount - partPayeur

si payer = fox  → dueT = +partAutre  (Tanuki doit à Fox)
si payer = tanuki → dueT = -partAutre  (Fox doit à Tanuki)
```

`solde > 0` → Tanuki doit à Fox
`solde < 0` → Fox doit à Tanuki

---

## Variables d'environnement

```env
DATABASE_URL="mysql://root:root@localhost:3306/splitr"
JWT_SECRET="changeme_in_production"
NODE_ENV="development"
PORT=3000
```

---

## Participants (v1)

- Deux utilisateurs fixes par groupe : **Tanuki** et **Fox**
- Chaque utilisateur a un compte (email + mot de passe)
- Un seul groupe partagé entre les deux
- Architecture prête pour des groupes dynamiques (v2)
