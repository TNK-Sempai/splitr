# Splitr — Frontend

## Vue d'ensemble

Frontend en **HTML/CSS/JS vanilla** — aucun framework. Deux pages HTML. Identité visuelle **Tanuki Corporation** : dark, lime green, typographie éditoriale.

---

## Fichiers à créer

```
src/
├── index.html       # Login / Register
├── app.html         # Dashboard principal (route protégée)
└── assets/
    ├── style.css    # Design system global
    └── app.js       # Logique JS du dashboard
```

---

## Design System

### Couleurs (CSS variables)

```css
:root {
  --bg: #0e0e0e;
  --s1: #141414;
  --s2: #1a1a1a;
  --s3: #222222;
  --b1: rgba(255,255,255,0.055);
  --b2: rgba(255,255,255,0.10);
  --b3: rgba(255,255,255,0.18);

  --acc: #c8f060;          /* Tanuki lime */
  --acc-dim: rgba(200,240,96,0.08);
  --fox: #85b7eb;          /* Fox blue */
  --fox-dim: rgba(55,138,221,0.08);

  --txt: #ebebeb;
  --muted: #5a5a5a;
  --muted2: #3a3a3a;

  --ok: #4ecb8d;
  --ok-bg: rgba(78,203,141,0.08);
  --ok-b: rgba(78,203,141,0.18);

  --err: #ff5c5c;
  --err-bg: rgba(255,92,92,0.08);
  --err-b: rgba(255,92,92,0.18);

  --warn: #f5a623;
  --warn-bg: rgba(245,166,35,0.08);

  --r: 10px;
  --r-sm: 6px;
}
```

### Typographie

```css
/* Importer depuis Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');

--font-display: 'Bebas Neue', sans-serif;   /* titres, logo, montants */
--font-body:    'DM Sans', sans-serif;       /* texte courant */
--font-mono:    'JetBrains Mono', monospace; /* montants, labels techniques */
```

---

## Page 1 : index.html (Login / Register)

### Comportement
- Deux onglets : **Connexion** / **Créer un compte**
- Si l'utilisateur a un cookie JWT valide → rediriger vers `app.html`
- Après login/register réussi → rediriger vers `app.html`

### Appels API
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me` (pour vérifier si déjà connecté au chargement)

### Layout
- Centré verticalement et horizontalement
- Card unique ~440px max-width
- Logo "SPLITR" en Bebas Neue, couleur `--acc`
- Tagline : "Partagez les charges. Simplement."

---

## Page 2 : app.html (Dashboard)

### Guard d'authentification
Au chargement : `GET /api/auth/me`
- Si 401 → rediriger vers `index.html`
- Si OK → stocker `currentUser` en mémoire et charger le dashboard

### Layout général
```
┌─────────────────────────────────────────────┐
│  NAV : Logo | Sync status | [Données] [+Mois]│
├───────────┬─────────────────────────────────┤
│  SIDEBAR  │  MAIN                           │
│           │                                 │
│ Vue glob. │  [Contenu de la vue active]     │
│ ─────── │                                 │
│ Jun 2026 │                                 │
│ Mai 2026 │                                 │
│ ...      │                                 │
└───────────┴─────────────────────────────────┘
```

### Sidebar
- Lien "Vue globale" en haut
- Liste des mois triés du plus récent au plus ancien
- Badge rouge (montant dû) ou vert (OK) par mois
- Mois actif surligné avec `--acc-dim`

### Vue globale
- Grande bannière balance totale (rouge si Tanuki doit, vert si Fox doit)
- Stats : Total avancé / Tanuki / Fox / Nombre de mois
- Tableau de tous les mois : Mois | Total | Tanuki | Fox | Solde mois | Solde cumulé
- Clic sur une ligne → naviguer vers ce mois

### Vue mois
- En-tête : Nom du mois + boutons [Dupliquer] [Supprimer] [+ Charge]
- Bannière solde du mois
- Stats : Tanuki a avancé / Fox a avancé / Qui doit combien
- Liste des charges groupées par payeur (section Tanuki / section Fox)
- Chaque charge : avatar | label + catégorie + pct | montant + ce que l'autre doit

### Modale charge
- Champs : Libellé / Montant / Catégorie / Payé par (toggle Tanuki/Fox) / Part (boutons 0% 50% 100% + champ libre) / Note
- Hint en temps réel : "Fox assume 560€ — Tanuki doit 560€ à Fox"
- Ctrl+Entrée pour sauvegarder

---

## Appels API depuis app.js

```js
// Wrapper fetch centralisé
async function api(method, path, body = null) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null,
    credentials: 'include', // important pour les cookies
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Erreur serveur')
  return json.data
}
```

### Séquence de chargement
1. `GET /api/auth/me` → currentUser
2. `GET /api/groups/1/months` → liste des mois
3. `GET /api/groups/1/balance` → balance globale
4. Au clic sur un mois : `GET /api/months/:id` → détail + expenses

---

## Modale données (Export / Import)

### Export JSON
- Exporte toutes les données locales (state JS) en JSON téléchargeable

### Import JSON
- Avertissement rouge : "remplace toutes les données"
- Parse le JSON → appelle `POST /api/months/*/expenses/import` par mois

### Export CSV
- Format : `id,mois,label,montant,payeur,pct,categorie,note`
- Téléchargeable

---

## Responsive

- **Desktop** : sidebar 210px + main flex-1
- **Mobile** (< 600px) : sidebar devient une barre horizontale scrollable en haut
- Stats : 2 colonnes sur mobile
- Modales : padding réduit, max-height 90vh avec scroll

---

## État JS (app.js)

```js
let state = {
  currentUser: null,    // { id, name, color }
  groupId: 1,
  months: [],           // liste légère pour la sidebar
  balance: null,        // balance globale
  currentMonthId: null, // mois actif
  currentMonth: null,   // détail complet du mois actif
}
```

Pas de store externe — `state` est un objet global simple. Les fonctions `render*()` lisent `state` et mettent à jour le DOM.
