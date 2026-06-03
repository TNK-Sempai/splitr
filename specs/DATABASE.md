# Splitr — Database

## Technologie

- **MariaDB** en local via MAMP (`localhost:3306`)
- **Prisma** comme ORM (migrations, client typé)
- Base de données : `splitr`

---

## Schéma Prisma complet

Fichier : `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id         Int      @id @default(autoincrement())
  email      String   @unique
  name       String
  password   String   // bcrypt hash
  color      String   @default("#c8f060") // couleur avatar
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  memberships GroupMember[]
  expenses    Expense[]     @relation("ExpensePayer")
}

model Group {
  id        Int      @id @default(autoincrement())
  name      String
  currency  String   @default("EUR")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members   GroupMember[]
  months    Month[]
}

model GroupMember {
  id       Int  @id @default(autoincrement())
  userId   Int
  groupId  Int
  role     String @default("member") // "owner" | "member"

  user     User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  group    Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
}

model Month {
  id        Int      @id @default(autoincrement())
  groupId   Int
  month     Int      // 1-12
  year      Int      // 2022-2099
  createdAt DateTime @default(now())

  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  expenses  Expense[]

  @@unique([groupId, month, year])
}

model Expense {
  id         Int      @id @default(autoincrement())
  monthId    Int
  payerId    Int
  label      String
  amount     Decimal  @db.Decimal(10, 2)
  pct        Int      @default(50) // 0-100 : part assumée par le payeur
  category   String   @default("autre")
  note       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  month      Month    @relation(fields: [monthId], references: [id], onDelete: Cascade)
  payer      User     @relation("ExpensePayer", fields: [payerId], references: [id])
}
```

---

## Migrations

### Créer la base de données

```sql
CREATE DATABASE IF NOT EXISTS splitr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Commandes Prisma

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations (dev)
npx prisma migrate dev --name init

# Appliquer en production
npx prisma migrate deploy

# Ouvrir Prisma Studio (interface visuelle)
npx prisma studio

# Reset complet (dev uniquement)
npx prisma migrate reset
```

---

## Seed

Fichier : `prisma/seed.js`

Crée deux utilisateurs (Tanuki + Fox) et un groupe partagé pour les tests.

```js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Créer les utilisateurs
  const tanuki = await prisma.user.upsert({
    where: { email: 'tanuki@splitr.app' },
    update: {},
    create: {
      email: 'tanuki@splitr.app',
      name: 'Tanuki',
      password: await bcrypt.hash('password123', 10),
      color: '#c8f060',
    },
  })

  const fox = await prisma.user.upsert({
    where: { email: 'fox@splitr.app' },
    update: {},
    create: {
      email: 'fox@splitr.app',
      name: 'Fox',
      password: await bcrypt.hash('password123', 10),
      color: '#85b7eb',
    },
  })

  // Créer le groupe
  const group = await prisma.group.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Foyer',
      currency: 'EUR',
    },
  })

  // Ajouter les membres
  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: tanuki.id, groupId: group.id } },
    update: {},
    create: { userId: tanuki.id, groupId: group.id, role: 'owner' },
  })

  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: fox.id, groupId: group.id } },
    update: {},
    create: { userId: fox.id, groupId: group.id, role: 'member' },
  })

  console.log('Seed OK — Tanuki:', tanuki.id, '/ Fox:', fox.id, '/ Group:', group.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Ajouter dans `package.json` :
```json
"prisma": {
  "seed": "node prisma/seed.js"
}
```

Lancer : `npx prisma db seed`

---

## Catégories valides

```
logement | energie | telecom | assurance | remboursement | courses | transport | loisirs | sante | autre
```

---

## Index recommandés

Prisma gère automatiquement les index sur les clés étrangères et les champs `@unique`. Aucun index manuel nécessaire en v1.

---

## Notes importantes

- `amount` est un `Decimal(10,2)` — toujours arrondir à 2 décimales côté API avant insertion
- `pct` est un entier entre 0 et 100 — valider côté API
- La suppression d'un `Month` supprime en cascade toutes ses `Expense`
- La suppression d'un `Group` supprime en cascade `Month`, `Expense`, `GroupMember`
