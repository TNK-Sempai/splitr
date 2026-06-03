# Splitr — Auth

## Vue d'ensemble

Authentification par **JWT** stocké en **httpOnly cookie** (sécurisé, inaccessible depuis JS).

- Pas de refresh token en v1 — token unique valable 7 jours
- Middleware `requireAuth` protège toutes les routes sauf `/api/auth/*`
- Mot de passe hashé avec **bcryptjs** (salt rounds : 10)

---

## Fichiers à créer

| Fichier | Rôle |
|---------|------|
| `api/auth.js` | Routes register / login / logout / me |
| `middleware/auth.js` | Middleware JWT — vérifie le cookie |

---

## Routes

### POST /api/auth/register

Crée un compte utilisateur et l'ajoute au groupe existant (groupId=1 en v1).

**Body JSON :**
```json
{
  "email": "tanuki@splitr.app",
  "name": "Tanuki",
  "password": "monmotdepasse"
}
```

**Validations :**
- `email` : format valide, unique en BDD
- `name` : 1-50 caractères, non vide
- `password` : minimum 8 caractères

**Succès (201) :**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "email": "tanuki@splitr.app",
    "name": "Tanuki",
    "color": "#c8f060"
  }
}
```

**Erreurs :**
- 400 : champs manquants ou invalides
- 409 : email déjà utilisé

**Effets :**
- Crée le `User` en BDD
- Crée un `GroupMember` (groupId=1, role="member")
- Set le cookie JWT

---

### POST /api/auth/login

**Body JSON :**
```json
{
  "email": "tanuki@splitr.app",
  "password": "monmotdepasse"
}
```

**Succès (200) :**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "email": "tanuki@splitr.app",
    "name": "Tanuki",
    "color": "#c8f060"
  }
}
```

**Erreurs :**
- 400 : champs manquants
- 401 : email ou mot de passe incorrect

**Effets :**
- Vérifie email + bcrypt.compare(password, hash)
- Set le cookie JWT (httpOnly, sameSite: lax, maxAge: 7j)

---

### POST /api/auth/logout

Aucun body requis.

**Succès (200) :**
```json
{ "ok": true }
```

**Effets :**
- Clear le cookie JWT (maxAge: 0)

---

### GET /api/auth/me

Route protégée — nécessite le cookie JWT.

**Succès (200) :**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "email": "tanuki@splitr.app",
    "name": "Tanuki",
    "color": "#c8f060",
    "groupId": 1
  }
}
```

**Erreurs :**
- 401 : pas de cookie ou token invalide/expiré

---

## Middleware auth.js

Fichier : `middleware/auth.js`

```js
// Pseudocode — Claude Code implémente
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  // 1. Lire le token depuis req.cookies.token
  // 2. Si absent → 401 { ok: false, error: 'Non authentifié' }
  // 3. jwt.verify(token, JWT_SECRET)
  // 4. Si invalide ou expiré → 401
  // 5. Charger le User depuis la BDD via Prisma (sans le password)
  // 6. Si user inexistant → 401
  // 7. req.user = user
  // 8. next()
}
```

---

## Cookie JWT

```js
res.cookie('token', jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }), {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours en ms
})
```

---

## Sécurité

- Jamais de mot de passe en clair dans les logs ou les réponses
- Le champ `password` est exclu de toutes les réponses API (`select: { password: false }`)
- En production : cookie `secure: true` (HTTPS uniquement)
- Rate limiting sur les routes auth (à ajouter en v2)
