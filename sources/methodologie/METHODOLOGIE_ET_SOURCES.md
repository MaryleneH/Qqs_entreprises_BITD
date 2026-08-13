# Méthodologie & traçabilité des données — BITD France

**Version : 13 août 2026**  
**Périmètre : `entreprises.csv` (30 entreprises) + `etablissements.csv` (458 lignes)**

## 1. Principe de base

Le dashboard applique une règle simple : **une valeur affichée doit pouvoir être auditée**.

Pour chaque donnée, l'utilisateur doit pouvoir retrouver :

1. **la valeur affichée** ;
2. **son périmètre** (groupe, segment, France, unité légale, établissement...) ;
3. **sa période** ;
4. **son mode d'obtention** ;
5. **sa source primaire ou son registre public** ;
6. lorsqu'elle est calculée, **la formule et les données sources**.

Les fichiers `catalogue_sources.csv`, `provenance_entreprises.csv` et `provenance_etablissements.csv` constituent la couche d'audit du dashboard.

---

## 2. Les modes d'obtention

| Mode | Signification | Exemple |
|---|---|---|
| **Publié** | La valeur est reprise telle quelle d'une publication. | CA 2025 publié dans un communiqué de résultats. |
| **Registre public** | La donnée vient d'un registre public officiel. | SIRET, état ACTIF/FERMÉ, APE dans SIRENE. |
| **Calculé** | La valeur est calculée à partir de données publiées. | Book-to-bill = prises de commandes / CA. |
| **Proxy** | La donnée publiée est proche du concept recherché mais le périmètre n'est pas identique. | CA Airbus Defence and Space ≠ CA militaire pur. |
| **Géocodé** | La position est construite à partir d'un référentiel géographique. | Centre de la commune lorsque l'adresse exacte n'est pas géocodée. |
| **Synthèse documentaire** | Texte construit à partir de sources corporate/institutionnelles. | Spécialité ou description d'un groupe. |
| **Rapprochement / qualification** | Résultat d'un croisement ou d'une règle documentée. | Rattachement d'un site corporate à un SIRET. |

---

## 3. Hiérarchie des sources

1. **A1 — registre ou source publique officielle** : INSEE/SIRENE, data.gouv.fr, ministère, APE.
2. **A2 — source primaire corporate** : rapport annuel, résultats, page investisseurs, page officielle d'implantation.
3. **A2 — publication de marché** : Euronext ou publication réglementée.
4. **B — source secondaire de vérification** : utilisée seulement comme contrôle ou lorsque la source primaire n'est pas suffisamment exploitable.
5. **M — méthode interne** : uniquement pour un calcul ou une classification, avec renvoi aux sources amont.

Une source secondaire ne doit pas devenir la seule justification d'un KPI financier important si une source primaire existe.

---

## 4. Ce que contient réellement `etablissements.csv`

Le fichier établissement ne contient actuellement **aucun chiffre d'affaires par établissement** et **aucun effectif local renseigné de façon systématique**.

Conséquence : le dashboard ne doit jamais afficher un « CA du site Airbus de Toulouse » sauf ajout futur d'une source spécifique à ce site.

Les données financières de `entreprises.csv` sont au niveau **groupe ou segment**. Elles ne doivent pas être propagées aux établissements.

### Données SIRENE

Pour les lignes rapprochées de SIRENE :

- `siren`, `siret`, `raison_sociale_sirene`, `ape_sirene`, `activite_sirene`, `etat_sirene` et `date_stock_sirene` proviennent du répertoire SIRENE ;
- la source de référence est la **Base SIRENE des entreprises et de leurs établissements** ;
- l'API SIRENE peut être utilisée pour une vérification unitaire ou une mise à jour plus récente que le stock mensuel.

### Coordonnées

Lorsque `precision_coordonnees = centre_commune_2026`, la latitude et la longitude représentent **le centre de la commune**, pas l'entrée exacte de l'établissement.

---

## 5. Données calculées du dashboard

### Book-to-bill

**Formule :** `prises de commandes / chiffre d'affaires`.

Le ratio doit afficher :

- son périmètre ;
- la période ;
- le fait qu'il est **calculé** si la société ne publie pas directement le ratio ;
- les sources des deux valeurs utilisées.

### Carnet / CA

**Formule :** `carnet de commandes / chiffre d'affaires annuel`.

Il s'agit d'un indicateur de visibilité, pas du nombre exact d'années de production.

### Couverture cartographique

Lorsqu'elle est calculable : `nombre de sites cartographiés / nombre public comparable d'implantations`.

Le dénominateur doit être comparable : un nombre de SIRET administratifs ne doit pas être comparé sans précaution à un nombre de grands sites industriels.

---

## 6. Affichage recommandé dans le dashboard

### À côté d'un chiffre

Afficher une action discrète : **`Source ↗`** ou une icône d'information.

Au survol/focus :

> **13,405 Md€**  
> Airbus Defence and Space · FY 2025  
> **Publié** · Source primaire corporate

Au clic/tap, ouvrir une fiche :

- **Valeur**
- **Périmètre**
- **Période**
- **Mode d'obtention**
- **Formule**, si calculée
- **Source**
- bouton **Voir la source originale ↗**

Sur mobile, utiliser une fiche sous la donnée ou un bottom-sheet léger plutôt qu'un tooltip dépendant du survol.

### Page « Méthodologie & sources »

Elle doit proposer une recherche simple :

- Entreprise
- Indicateur / champ
- Type de source
- Statut d'audit

et afficher le tableau de provenance sans demander à l'utilisateur de comprendre la structure technique des CSV.

---

## 7. Statuts d'audit

- **documenté** : une source suffisamment précise est attachée ;
- **calculé** : formule documentée et source(s) amont identifiées ;
- **proxy_documenté** : source solide mais périmètre différent ;
- **approximation_documentée** : ordre de grandeur explicitement signalé ;
- **à revalider / à corriger** : la valeur ne doit pas être présentée comme sûre avant correction ;
- **non_disponible** : ne pas estimer pour remplir un vide.

Le fichier `AUDIT_CORRECTIONS_A_FAIRE.csv` recense les points déjà identifiés pendant cette passe de traçabilité.

---

## 8. Exemple : Airbus

Il faut distinguer au minimum :

- **CA consolidé Airbus 2025** ;
- **dont « defence »** au niveau consolidé ;
- **CA Airbus Defence and Space** ;
- **CA d'un établissement** : **non disponible dans le référentiel actuel**.

Une donnée de groupe ou de segment ne doit jamais être présentée comme donnée du site de Toulouse, Marignane ou Élancourt.

---

## 9. Règle de maintenance

Toute mise à jour d'une valeur du dashboard doit entraîner la mise à jour simultanée de sa ligne de provenance :

`valeur + période + périmètre + mode d'obtention + source + date de consultation`.

Si la source disparaît, conserver si possible :

- le titre du document ;
- l'organisme ;
- la date ;
- la référence du rapport ;
- éventuellement une copie locale autorisée ou une URL d'archive institutionnelle.

---

## 10. Fichiers de traçabilité

- `catalogue_sources.csv` : registre unique des sources.
- `provenance_entreprises.csv` : provenance champ par champ de `entreprises.csv`.
- `provenance_etablissements.csv` : provenance champ par champ de `etablissements.csv`.
- `AUDIT_CORRECTIONS_A_FAIRE.csv` : anomalies, ambiguïtés et valeurs à revalider.

Ces tables doivent être considérées comme la **couche de preuve** du dashboard.
