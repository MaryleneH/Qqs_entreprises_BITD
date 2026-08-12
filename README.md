# BITD France — Cartographie industrielle & souveraineté

Dashboard d'intelligence économique sur les **30 principaux acteurs de la Base Industrielle et Technologique de Défense française**.

> Sources publiques — situation au 12 août 2026

## 🗺 Aperçu

Le dashboard comprend :
- **Vue d'ensemble** : carte interactive Leaflet, filtres, KPI, panneau analytique
- **Entreprises** : tableau filtrable et triable des 30 acteurs
- **Risque & souveraineté** : matrice croisée risque fournisseur / criticité souveraine
- **Méthodologie** : sources, définitions et limites analytiques

## 🏗 Architecture

```
.
├── _quarto.yml           # Configuration Quarto
├── index.qmd             # Page d'accueil — Dashboard
├── entreprises.qmd       # Tableau des 30 acteurs
├── risques.qmd           # Matrice risque & souveraineté
├── methodologie.qmd      # Méthodologie & sources
├── data/
│   └── entreprises.csv   # Source de données centrale (30 entreprises)
├── styles/
│   └── dashboard.scss    # Design premium
├── scripts/
│   ├── dashboard.js      # Chargement CSV, KPI
│   ├── map.js            # Carte Leaflet
│   ├── filters.js        # Filtres interactifs
│   └── table.js          # Tableau
├── assets/
│   └── favicon.svg
├── sources/              # Référentiel documentaire source (ne pas modifier)
│   ├── Guide_30_grands_acteurs_BITD_francaise_ENRICHI_2026.md
│   ├── 01_Matrice_RISQUE_SOUVERAINETE.md
│   └── 00_SOURCES_ET_METHODOLOGIE.md
└── .github/
    └── workflows/
        └── pages.yml     # GitHub Actions → GitHub Pages
```

## 🚀 Lancement local

**Prérequis** : [Quarto](https://quarto.org/docs/get-started/) installé.

```bash
# Prévisualisation locale
quarto preview

# Rendu statique
quarto render
```

Le site est généré dans `_site/`.

## 🌐 GitHub Pages

Le déploiement est automatique à chaque push sur `main`.

**Activation manuelle** :  
`Repository → Settings → Pages → Build and deployment → Source → GitHub Actions`

URL du site : `https://<username>.github.io/Qqs_entreprises_BITD/`

## 📊 Mise à jour des données

Toutes les données sont centralisées dans **`data/entreprises.csv`**.

Pour mettre à jour un indicateur, modifier la ligne correspondante dans le CSV. Les cartes, tableaux, KPI et filtres se mettent à jour automatiquement.

**Colonnes clés :**
- `risque_fournisseur` : FAIBLE / MODÉRÉ / SIGNIFICATIF / ÉLEVÉ
- `criticite_souveraine` : IMPORTANTE / TRÈS ÉLEVÉE / CRITIQUE
- `marge` : indicateur de marge publié
- `ratio_carnet_ca` : ratio numérique (ex: 6.30)

## ➕ Ajouter une entreprise

1. Ajouter une ligne dans `data/entreprises.csv` en respectant la structure
2. Utiliser `n.c.` pour les données non disponibles
3. Vérifier les coordonnées géographiques (latitude/longitude)
4. Pousser sur `main` — le déploiement est automatique

## 📚 Sources

- [DGA — armement.defense.gouv.fr](https://armement.defense.gouv.fr/)
- Rapports annuels et communiqués d'entreprise (2025)
- L'Annuaire des Entreprises — [annuaire-entreprises.data.gouv.fr](https://annuaire-entreprises.data.gouv.fr/)

---

*Données : sources publiques exclusivement. Cette analyse ne représente pas une position officielle de la DGA.*
