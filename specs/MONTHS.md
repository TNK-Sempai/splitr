# Splitr — Months

## Vue d'ensemble

Les mois sont les conteneurs de dépenses. Un mois appartient à un groupe. On ne peut pas avoir deux mois identiques (même mois/année) dans le même groupe.

Toutes les routes sont protégées par `requireAuth`.

---

## Fichier à créer

`api/months.js`

---

## Routes

### GET /api/groups/:groupId/months

Retourne tous les mois du groupe, triés du plus récent au plus ancien, avec le solde calculé de chaque mois.

**Succès (200) :**
```json
{
  "ok": true,
  "data": [
    {
      "id": 12,
      "month": 6,
      "year": 2026,
      "expenseCount": 5,
      "totalFoyer": 1607.99,
      "avT": 141.99,
      "avF": 1466.00,
      "solde": 662.01
    }
  ]
}
```

**Notes :**
- `solde > 0` → Tanuki doit à Fox
- `solde < 0` → Fox doit à Tanuki
- Le calcul est fait en SQL ou en JS selon ce qui est plus simple

---

### GET /api/months/:id

Retourne un mois avec toutes ses dépenses et le calcul détaillé.

**Succès (200) :**
```json
{
  "ok": true,
  "data": {
    "id": 12,
    "month": 6,
    "year": 2026,
    "expenses": [ /* voir EXPENSES.md */ ],
    "balance": {
      "totalFoyer": 1607.99,
      "avT": 141.99,
      "avF": 1466.00,
      "solde": 662.01,
      "soldeLabel": "Tanuki doit 662,01 € à Fox"
    }
  }
}
```

---

### POST /api/groups/:groupId/months

Crée un nouveau mois.

**Body JSON :**
```json
{
  "month": 6,
  "year": 2026
}
```

**Validations :**
- `month` : entier 1-12
- `year` : entier 2000-2099
- Combinaison month/year unique par groupe

**Succès (201) :**
```json
{
  "ok": true,
  "data": {
    "id": 12,
    "month": 6,
    "year": 2026,
    "expenseCount": 0
  }
}
```

**Erreurs :**
- 400 : validation échouée
- 409 : mois déjà existant pour ce groupe

---

### DELETE /api/months/:id

Supprime un mois et toutes ses dépenses (cascade).

**Succès (200) :**
```json
{ "ok": true }
```

**Erreurs :**
- 403 : le mois n'appartient pas au groupe de l'utilisateur
- 404 : mois introuvable

---

### POST /api/months/:id/duplicate

Duplique toutes les dépenses d'un mois vers un mois cible.

**Body JSON :**
```json
{
  "targetMonth": 7,
  "targetYear": 2026
}
```

**Comportement :**
- Si le mois cible n'existe pas, il est créé automatiquement
- Si le mois cible existe, les dépenses sont ajoutées (pas de remplacement)
- Les dépenses sont copiées avec de nouveaux IDs et `createdAt` actualisé
- Le `payerId` est conservé tel quel

**Succès (200) :**
```json
{
  "ok": true,
  "data": {
    "targetMonthId": 13,
    "copied": 5
  }
}
```

**Erreurs :**
- 400 : mois cible invalide
- 403 : accès refusé
- 404 : mois source introuvable

---

## Notes importantes

- Un mois sans dépenses est valide (expenseCount = 0)
- Le tri par défaut est `year DESC, month DESC`
- Le calcul du solde est toujours fait côté serveur dans `lib/calc.js`, jamais côté client
