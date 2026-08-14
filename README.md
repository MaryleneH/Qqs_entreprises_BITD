# BITD France — Panel de 30 acteurs industriels majeurs

Dashboard documentaire et cartographique consacré à un **panel de 30 acteurs industriels majeurs de la Base industrielle et technologique de défense (BITD) française**.

Le projet permet d'explorer les entreprises, leurs implantations, certains grands programmes de défense et leur présence territoriale, tout en rendant **la méthodologie et les sources vérifiables**.

> **Important**  
> Ce panel ne constitue ni un classement officiel, ni une liste exhaustive de la BITD française.  
> La méthode de sélection est explicitée dans la rubrique **Méthodologie & sources** du dashboard.


Lien vers le [Tableaau de bord](https://maryleneh.github.io/Qqs_entreprises_BITD/)
---

## Objectifs

Le dashboard vise à répondre simplement à plusieurs questions :

- Quelles sont les entreprises du panel ?
- Où sont implantés leurs établissements en France ?
- Quels sont les établissements actifs ou historiques ?
- Quels grands programmes sont associés aux entreprises du référentiel ?
- Quels acteurs sont présents dans une région donnée ?
- Pourquoi une entreprise figure-t-elle dans le panel ?
- D'où vient chaque donnée importante affichée ?
- Une valeur est-elle publiée, calculée, issue de SIRENE ou rapprochée à partir de plusieurs sources ?

Le projet est conçu comme un **outil pédagogique d'analyse industrielle et territoriale de la BITD**.

---

## Principales fonctionnalités

### Explorer par entreprise

Le mode **Entreprise** permet de :

- sélectionner l'une des 30 entreprises ;
- visualiser son siège et ses établissements ;
- distinguer les établissements actifs et historiques ;
- afficher les principales informations disponibles sur chaque implantation ;
- naviguer entre la fiche de l'entreprise et ses implantations ;
- consulter les sources associées aux principales données.

La vue entreprise utilise une représentation de type **constellation** reliant visuellement le siège aux établissements référencés.

---

### Explorer par programme

Le mode **Programme** permet d'explorer les relations documentées entre les entreprises du panel et certains grands programmes de défense.

La logique repose sur des relations explicites :

- programme → entreprise ;
- entreprise → rôle dans le programme ;
- programme → établissement uniquement lorsque le lien avec un site précis est documenté.

Le dashboard ne suppose jamais que tous les établissements d'une entreprise travaillent sur un programme donné.

---

### Explorer par région

Le mode **Région** permet d'observer l'empreinte territoriale des 30 groupes du panel :

- établissements présents dans la région ;
- entreprises représentées ;
- types d'activités recensés ;
- navigation directe vers une entreprise.

Les résultats portent uniquement sur les acteurs et établissements du référentiel et **ne constituent pas un recensement exhaustif de la BITD régionale**.

---

## Le panel de 30 entreprises

Le panel est construit selon une méthode en **deux cercles**.

### Cercle 1 — Grands maîtres d'œuvre industriels

Le premier cercle comprend **9 grands maîtres d'œuvre industriels identifiés institutionnellement par la DGA**.

Il constitue le noyau institutionnel du panel.

### Cercle 2 — Équipementiers et acteurs industriels structurants

Le second cercle comprend **21 entreprises sélectionnées selon une méthode éditoriale documentée**.

Les principaux critères mobilisés sont :

1. présence Défense avérée ;
2. importance industrielle en France ;
3. position dans la chaîne de valeur ;
4. participation à des programmes structurants ;
5. représentativité du panel.

La sélection ne produit **aucun score, rang ou classement**.

Chaque entreprise dispose d'une justification individuelle accessible dans le dashboard via :

**Pourquoi cette entreprise est-elle dans le panel ?**

Les données correspondantes sont stockées dans :

```text
data/panel/
├── panel_selection.csv
├── panel_selection_sources.csv
└── panel_methodologie.csv
```

---

## Traçabilité des données

Le projet applique le principe suivant :

> **Pas de source identifiable = pas de donnée présentée comme établie.**

Les données métier sont séparées de leur provenance.

### Données métier

```text
data/
├── entreprises.csv
├── etablissements.csv
├── programmes.csv
├── entreprise_programme.csv
└── site_programme.csv
```

Selon l'état du projet, certaines tables liées aux programmes peuvent être enrichies progressivement.

### Provenance

```text
data/provenance/
├── catalogue_sources.csv
├── provenance_entreprises.csv
└── provenance_etablissements.csv
```

Cette architecture permet de relier :

```text
donnée
   ↓
provenance
   ↓
source
   ↓
publication ou référentiel original
```

Le dashboard peut ainsi afficher une fiche **Source** précisant, lorsque l'information existe :

- la valeur ;
- la période ;
- le périmètre ;
- le mode d'obtention ;
- la formule éventuelle ;
- la source primaire ;
- un lien vers la publication originale.

---

## Typologie des données

Le dashboard distingue notamment :

- **Publié** : donnée reprise directement d'une publication ;
- **Registre public** : donnée provenant par exemple de SIRENE/Insee ;
- **Calculé** : donnée obtenue à partir d'autres valeurs publiées ;
- **Proxy** : valeur utilisée comme approximation d'un concept plus précis ;
- **Géocodé** : donnée géographique issue d'un référentiel ;
- **Synthèse documentaire** : synthèse de plusieurs sources ;
- **Rapproché / qualifié** : résultat d'un croisement entre plusieurs référentiels.

---

## Granularité financière

Les données financières sont présentées uniquement au niveau auquel elles sont publiées :

- groupe ;
- société ;
- segment d'activité.

**Aucun chiffre d'affaires n'est calculé ou estimé au niveau d'un établissement lorsqu'il n'est pas publié à ce niveau.**

Une donnée financière concernant un groupe ou un segment ne doit donc jamais être présentée comme le chiffre d'affaires d'un site industriel particulier.

---

## Établissements et SIRENE

Le référentiel des établissements combine plusieurs sources :

- informations corporate ;
- données SIRENE ;
- sources institutionnelles ;
- référentiels géographiques.

Les variables peuvent notamment documenter :

- SIREN ;
- SIRET ;
- raison sociale ;
- code APE ;
- état administratif ;
- adresse ;
- région ;
- coordonnées ;
- type de site ;
- activité locale ;
- niveau de validation ;
- preuve d'activité BITD lorsqu'elle existe.

### Actif / inactif

Le statut administratif SIRENE et le niveau de documentation de l'activité BITD sont deux notions distinctes.

Un établissement peut être administrativement actif sans que son activité BITD locale soit documentée.

Inversement, une présence industrielle peut être documentée par une source corporate sans qu'un rapprochement SIRET fiable ait encore été réalisé.

---

## Coordonnées géographiques

Certaines coordonnées correspondent à la position précise d'un site.

D'autres utilisent un niveau de précision plus faible, par exemple le **centre de la commune** lorsque l'adresse exacte n'a pas été géocodée avec suffisamment de fiabilité.

Le niveau de précision est conservé dans les données et doit être pris en compte lors de l'interprétation de la carte.

---

## Sources et méthodologie

La documentation méthodologique est regroupée dans :

```text
sources/methodologie/
├── METHODOLOGIE_ET_SOURCES.md
├── SOURCES_PAR_ENTREPRISE.md
├── README_PROVENANCE.md
└── README_PANEL.md
```

Le dossier peut évoluer avec l'enrichissement du référentiel.

Un dossier `audit/` peut également contenir des contrôles internes :

```text
audit/
└── AUDIT_CORRECTIONS_A_FAIRE.csv
```

Ce contenu est destiné au contrôle qualité et **ne doit pas être exposé comme donnée publique du dashboard**.

---

## Structure du dépôt

Structure indicative actuelle :

```text
.
├── _quarto.yml
├── index.qmd
├── entreprises.qmd
├── comprendre.qmd
├── methodologie.qmd
├── README.md
│
├── data/
│   ├── entreprises.csv
│   ├── etablissements.csv
│   ├── programmes.csv
│   ├── entreprise_programme.csv
│   ├── site_programme.csv
│   │
│   ├── provenance/
│   │   ├── catalogue_sources.csv
│   │   ├── provenance_entreprises.csv
│   │   └── provenance_etablissements.csv
│   │
│   └── panel/
│       ├── panel_selection.csv
│       ├── panel_selection_sources.csv
│       └── panel_methodologie.csv
│
├── sources/
│   └── methodologie/
│       ├── METHODOLOGIE_ET_SOURCES.md
│       ├── SOURCES_PAR_ENTREPRISE.md
│       ├── README_PROVENANCE.md
│       └── README_PANEL.md
│
├── audit/
│   └── AUDIT_CORRECTIONS_A_FAIRE.csv
│
├── scripts/
├── styles/
├── assets/
│
└── .github/
    └── workflows/
        └── pages.yml
```

Certains fichiers peuvent être absents selon l'avancement des différentes fonctionnalités.

---

## Technologies

Le projet repose principalement sur :

- **Quarto** pour la génération du site ;
- **HTML / CSS / JavaScript** pour les interactions ;
- **Leaflet** pour la cartographie ;
- **CSV** pour les données métier et leur provenance ;
- **GitHub Pages** pour le déploiement.

Le site est volontairement statique : les explorations et filtrages sont effectués côté navigateur.

---

## Lancer le projet localement

Avec Quarto installé :

```bash
quarto preview
```

Pour reconstruire entièrement le site :

```bash
quarto clean
quarto render
```

Le site généré est produit dans le répertoire configuré par `_quarto.yml`, généralement :

```text
_site/
```

---

## Déploiement

Le projet est destiné à être publié avec **GitHub Pages**, via le workflow présent dans :

```text
.github/workflows/pages.yml
```

Les ressources doivent utiliser des chemins compatibles avec un déploiement dans un sous-répertoire GitHub Pages.

---

## Principes de qualité

Le projet suit plusieurs règles :

1. **ne pas inventer une donnée manquante** ;
2. **distinguer clairement donnée publiée et donnée calculée** ;
3. **conserver le périmètre exact d'un indicateur financier** ;
4. **ne pas attribuer une donnée groupe à un établissement** ;
5. **ne pas associer un site à un programme sans preuve documentaire** ;
6. **distinguer statut administratif et activité BITD documentée** ;
7. **conserver la provenance des informations importantes** ;
8. **rendre la sélection des entreprises elle-même explicable** ;
9. **signaler les limites et approximations du référentiel** ;
10. **préférer une donnée absente à une donnée faussement précise**.

---

## Statut du projet

Le dashboard est un projet évolutif.

Les principales dimensions actuellement développées sont :

- entreprises ;
- établissements ;
- programmes ;
- territoires ;
- méthodologie du panel ;
- provenance et sources.

Les données peuvent être enrichies ou corrigées au fil des nouvelles publications, des mises à jour SIRENE et des vérifications documentaires.

---

## Avertissement

Ce projet est un outil documentaire et pédagogique construit à partir de sources ouvertes.

Il ne constitue :

- ni une base officielle de la DGA ;
- ni une liste exhaustive des entreprises de la BITD ;
- ni un classement financier ;
- ni une appréciation de criticité stratégique ou de risque fournisseur.

Les sources, périmètres et limites doivent être consultés avant toute comparaison ou réutilisation d'un indicateur.
