# Splitr — Expenses

## Vue d'ensemble

Les dépenses (expenses) sont les lignes de charges rattachées à un mois. Chaque dépense a un payeur, un montant, et un pourcentage définissant la répartition.

Toutes les routes sont protégées par `requireAuth`. L'utilisateur doit être membre du groupe auquel appartient le mois.

---

## Fichier à créer

`api/expenses.js`

---

## Routes

### GET /api/months/:monthId/expenses

Retourne toutes les dépenses d'un mois, avec les infos du payeur.

**Succès (200) :**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "label": "Loyer + charges",
      "amount": "1120.00",
      "pct": 50,
      "category": "logement",
      "note": "",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "payer": {
        "id": 2,
        "name": "Fox",
        "color": "#85b7eb"
      }
    }
  ]
}
```

**Erreurs :**
- 401 : non authentifié
- 403 : le mois n'appartient pas au groupe de l'utilisateur
- 404 : mois introuvable

---

### POST /api/months/:monthId/expenses

Crée une nouvelle dépense.

**Body JSON :**
```json
{
  "label": "Loyer + charges",
  "amount": 1120.00,
  "payerId": 2,
  "pct": 50,
  "category": "logement",
  "note": ""
}
```

**Validations :**
- `label` : non vide, max 100 caractères
- `amount` : nombre > 0, arrondi à 2 décimales
- `payerId` : doit être membre du groupe
- `pct` : entier entre 0 et 100
- `category` : valeur parmi la liste autorisée

**Succès (201) :**
```json
{
  "ok": true,
  "data": { /* expense complète avec payer */ }
}
```

**Erreurs :**
- 400 : validation échouée
- 403 : accès refusé
- 404 : mois introuvable

---

### PUT /api/expenses/:id

Modifie une dépense existante. Seuls les champs fournis sont mis à jour.

**Body JSON (tous optionnels) :**
```json
{
  "label": "Loyer",
  "amount": 1150.00,
  "payerId": 2,
  "pct": 50,
  "category": "logement",
  "note": "Charges comprises"
}
```

**Validations :** identiques au POST pour les champs fournis.

**Succès (200) :**
```json
{
  "ok": true,
  "data": { /* expense mise à jour avec payer */ }
}
```

**Erreurs :**
- 400 : validation échouée
- 403 : l'expense n'appartient pas au groupe de l'utilisateur
- 404 : expense introuvable

---

### DELETE /api/expenses/:id

Supprime une dépense.

**Succès (200) :**
```json
{ "ok": true }
```

**Erreurs :**
- 403 : accès refusé
- 404 : expense introuvable

---

## Catégories valides

```js
const VALID_CATEGORIES = [
  'logement', 'energie', 'telecom', 'assurance',
  'remboursement', 'courses', 'transport', 'loisirs',
  'sante', 'autre'
]
```

---

## Logique de calcul pct (rappel)

```js
// lib/calc.js — fonction calcExpense
function calcExpense(expense) {
  const amount = parseFloat(expense.amount)
  const pct = parseInt(expense.pct)         // 0 à 100
  const partPayeur = round2(amount * pct / 100)
  const partAutre  = round2(amount - partPayeur)

  // dueT = ce que Tanuki doit à Fox (positif) ou Fox doit à Tanuki (négatif)
  const dueT = expense.payer.name === 'Fox' ? partAutre : -partAutre

  return { partPayeur, partAutre, dueT }
}
```

---

## Import CSV

### POST /api/months/:monthId/expenses/import

Permet d'importer un lot de dépenses depuis un CSV.

**Body JSON :**
```json
{
  "rows": [
    {
      "label": "Loyer",
      "amount": 1120,
      "payerName": "fox",
      "pct": 50,
      "category": "logement",
      "note": ""
    }
  ]
}
```

- `payerName` : "tanuki" ou "fox" (insensible à la casse) → résolu en `payerId`
- Les erreurs de lignes individuelles sont ignorées (on insère ce qui est valide)
- Retourne le nombre de lignes insérées

**Succès (200) :**
```json
{
  "ok": true,
  "data": { "inserted": 6, "skipped": 0 }
}
```
