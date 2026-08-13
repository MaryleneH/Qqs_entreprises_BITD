# README — Provenance et traçabilité des données

Ce dossier documente la **provenance des données utilisées dans le dashboard BITD France**.

L’objectif est de pouvoir répondre simplement et rigoureusement à une question comme :

> **D’où vient cette donnée ?**

Pour chaque information importante affichée dans le dashboard, la couche de provenance permet, lorsque l’information est disponible, d’identifier :

- la valeur concernée ;
- son périmètre ;
- sa période de référence ;
- son mode d’obtention ;
- la source utilisée ;
- le lien vers la publication, le registre ou le document d’origine ;
- les éventuelles limites méthodologiques.

---

## Principe général

Le projet applique la règle suivante :

> **Pas de source identifiable = pas de donnée présentée comme établie.**

Lorsqu’une donnée est calculée, la formule et la provenance des valeurs utilisées doivent pouvoir être retrouvées.

Lorsqu’une donnée est issue d’un registre public, d’un rapprochement ou d’un géocodage, cette nature doit être explicite.

La provenance est donc considérée comme une **couche de données à part entière**.

---

# 1. Architecture générale

Les données métier et leur provenance sont volontairement séparées.

```text
data/
├── entreprises.csv
├── etablissements.csv
│
└── provenance/
    ├── catalogue_sources.csv
    ├── provenance_entreprises.csv
    └── provenance_etablissements.csv
```

La logique est la suivante :

```text
DONNÉE MÉTIER
      ↓
PROVENANCE
      ↓
SOURCE
      ↓
DOCUMENT / URL / REGISTRE ORIGINAL
```

Exemple :

```text
entreprises.csv
book_to_bill = 1,32
      ↓
provenance_entreprises.csv
mode = calculé
périmètre = Airbus Defence and Space
formule = commandes / chiffre d'affaires
      ↓
catalogue_sources.csv
Airbus — FY 2025 Results
      ↓
publication originale
```

---

# 2. Fichiers de provenance

## `catalogue_sources.csv`

Ce fichier constitue le **répertoire central des sources** utilisées par le projet.

Il contient notamment :

- un identifiant de source ;
- l’entreprise ou le périmètre concerné ;
- le niveau de source ;
- le type de source ;
- un libellé lisible ;
- une URL ;
- l’usage principal ;
- éventuellement une date de consultation ;
- des commentaires méthodologiques.

Il doit être utilisé comme table de référence pour générer les liens :

**Voir la source ↗**

Les URL ne doivent pas être dupliquées manuellement dans le JavaScript du dashboard.

---

## `provenance_entreprises.csv`

Ce fichier relie les informations de `entreprises.csv` à leur provenance.

Une même entreprise peut avoir plusieurs sources pour des champs différents.

Exemples de données concernées :

- chiffre d’affaires ;
- chiffre d’affaires Défense ;
- effectifs ;
- carnet de commandes ;
- prises de commandes ;
- book-to-bill ;
- carnet / chiffre d’affaires ;
- marges ;
- actionnariat ;
- nombre de sites annoncé ;
- autres indicateurs économiques ou industriels.

L’objectif est de pouvoir retrouver, pour chaque champ important :

```text
entreprise
champ
valeur
périmètre
période
mode d'obtention
formule éventuelle
source
statut de validation
```

---

## `provenance_etablissements.csv`

Ce fichier relie les informations de `etablissements.csv` à leur provenance.

La provenance doit être gérée **champ par champ**.

Un même établissement peut par exemple avoir :

- son activité locale documentée par une source corporate ;
- son SIRET provenant de SIRENE ;
- son état administratif provenant de SIRENE ;
- ses coordonnées provenant d’un référentiel géographique ;
- un rattachement à un programme provenant d’une autre source.

Il ne faut donc jamais considérer qu’**une seule source justifie automatiquement toute la ligne établissement**.

---

# 3. Typologie des modes d’obtention

La couche de provenance distingue plusieurs types de données.

## Publié

Donnée reprise directement d’une publication officielle.

Exemples :

- chiffre d’affaires publié dans un rapport annuel ;
- effectif publié sur le site corporate ;
- carnet de commandes annoncé dans un communiqué financier.

---

## Registre public

Donnée issue d’un registre ou référentiel public.

Exemple principal :

- Insee / SIRENE pour les SIREN, SIRET et états administratifs.

---

## Calculé

Donnée obtenue à partir de valeurs publiées.

Exemple :

```text
book-to-bill =
prises de commandes
÷
chiffre d'affaires
```

Une donnée calculée doit toujours conserver :

- sa formule ;
- les données utilisées ;
- leurs unités ;
- leur période ;
- leur périmètre ;
- leurs sources.

---

## Proxy

Donnée publiée et réelle, utilisée comme approximation d’un indicateur plus précis qui n’est pas disponible publiquement.

Le périmètre du proxy doit être indiqué clairement.

Une valeur proxy ne doit jamais être présentée comme parfaitement équivalente au concept recherché.

---

## Géocodé

Donnée géographique produite à partir d’un référentiel.

Exemple :

- centre d’une commune lorsque l’emplacement exact du site n’est pas suffisamment documenté.

Le niveau de précision doit rester accessible dans le dashboard.

---

## Synthèse documentaire

Information construite à partir de plusieurs documents.

Elle doit être identifiable comme une synthèse et non comme une citation directe d’une source unique.

---

## Rapproché / qualifié

Information obtenue par croisement de plusieurs sources.

Exemple :

```text
site corporate
+
SIRENE
+
adresse
+
raison sociale
→ rattachement d'un SIRET à un établissement
```

Un rapprochement est une opération méthodologique : il ne doit pas être confondu avec une donnée directement publiée.

---

# 4. Granularité financière

Les indicateurs financiers sont conservés uniquement au niveau auquel ils sont effectivement publiés.

Ils peuvent concerner :

- un groupe ;
- une société ;
- un segment d’activité ;
- éventuellement un autre périmètre explicitement documenté.

## Aucun chiffre d’affaires par établissement

Le référentiel ne calcule ni n’estime de chiffre d’affaires au niveau des établissements lorsque cette donnée n’est pas publiée.

Par exemple :

un chiffre d’affaires publié pour Airbus ou Airbus Defence and Space ne devient pas automatiquement le chiffre d’affaires d’un établissement Airbus à Toulouse, Marignane ou ailleurs.

La règle est :

> **Une donnée groupe ne doit jamais être présentée comme une donnée locale d’établissement.**

---

# 5. Données établissements et SIRENE

Les données SIRENE servent notamment à documenter :

- SIREN ;
- SIRET ;
- raison sociale ;
- activité principale ;
- code APE ;
- état administratif ;
- certaines adresses ;
- l’existence d’établissements.

Cependant :

> **Un établissement administrativement actif dans SIRENE ne signifie pas automatiquement qu’une activité BITD locale y est documentée.**

Le statut administratif et la qualification de l’activité Défense sont deux dimensions différentes.

---

# 6. Activité BITD locale

Le référentiel distingue la présence administrative d’un établissement et la connaissance de son activité BITD.

Les formulations du dashboard doivent rester prudentes.

Exemples :

### `confirmé`

**Activité BITD documentée**

### `à_confirmer`

**Activité BITD locale à documenter**

### `non_identifié`

**Activité BITD locale non identifiée dans les sources disponibles.**

Ne jamais transformer `non_identifié` en :

- « aucun activité » ;
- « site non BITD » ;
- « site sans activité Défense ».

L’absence de preuve dans le référentiel n’est pas une preuve d’absence.

---

# 7. Coordonnées géographiques

Les coordonnées des établissements n’ont pas toujours le même niveau de précision.

Elles peuvent correspondre :

- à une position précise ;
- à une adresse géocodée ;
- à une commune ;
- au centre de la commune.

Le champ de précision géographique doit être conservé et, lorsque nécessaire, expliqué dans l’interface.

Un marqueur situé au centre d’une commune ne doit pas être présenté comme l’entrée exacte du site industriel.

---

# 8. Sources primaires et secondaires

## Source primaire

Source produite directement par l’acteur ou l’institution concernée.

Exemples :

- rapport annuel ;
- communiqué financier officiel ;
- site de l’entreprise ;
- ministère des Armées ;
- DGA ;
- Insee / SIRENE.

Les sources primaires sont privilégiées.

---

## Source secondaire

Source qui reprend ou analyse une information produite ailleurs.

Une source secondaire peut être utilisée lorsqu’aucune source primaire suffisamment précise n’est disponible, mais cette situation doit rester identifiable.

---

# 9. Sources des données calculées

Une donnée calculée ne possède pas seulement une source : elle possède une **chaîne de provenance**.

Exemple :

```text
ratio carnet / CA
      ↓
carnet publié
+
CA publié
      ↓
source financière officielle
      ↓
formule documentée
```

Le dashboard doit pouvoir expliquer :

1. la formule ;
2. les valeurs utilisées ;
3. leur période ;
4. leur périmètre ;
5. leurs sources.

---

# 10. Périmètre des indicateurs

Le périmètre doit toujours être conservé.

Exemples :

- groupe ;
- France ;
- segment Défense ;
- Airbus Defence and Space ;
- société juridique ;
- établissement.

Deux chiffres ne doivent pas être comparés sans vérifier leur périmètre.

> *Toujours vérifier le périmètre avant de comparer deux indicateurs.*

---

# 11. Période de référence

Une valeur financière, un effectif ou un statut administratif doit être rattaché à une période ou une date lorsque celle-ci est connue.

Exemples :

```text
FY 2025
31 décembre 2025
31 juillet 2026
stock SIRENE août 2026
```

Une valeur ancienne ne doit pas être présentée comme une donnée actuelle sans indication de millésime.

---

# 12. Valeurs à revalider

Certaines informations peuvent nécessiter une nouvelle vérification documentaire.

Ces situations doivent être signalées dans les données de provenance.

Elles ne doivent pas être masquées par une source générique choisie arbitrairement.

Le projet préfère :

> **une donnée explicitement à revalider**

à :

> **une fausse précision.**

---

# 13. Audit interne

Un fichier peut être utilisé pour suivre les corrections et revalidations :

```text
audit/
└── AUDIT_CORRECTIONS_A_FAIRE.csv
```

Ce fichier est destiné au contrôle qualité interne.

Il ne constitue pas une source métier et ne doit pas être exposé comme contenu public du dashboard.

---

# 14. Utilisation dans le dashboard

La provenance peut être présentée via un bouton discret :

```text
Source ↗
```

ou :

```text
ⓘ Source
```

Le clic peut ouvrir une fiche contenant :

```text
Indicateur
Valeur
Entreprise
Période
Périmètre
Mode d'obtention
Formule éventuelle
Source
Voir la source originale ↗
```

Pour un établissement, la fiche peut distinguer :

```text
Existence / activité
SIRET
État administratif
Localisation
Programme
```

et leur attribuer des sources différentes.

---

# 15. Principe d’implémentation

Les fichiers de provenance sont des **sources de vérité**.

Ils ne doivent pas être copiés manuellement dans le JavaScript.

Exemple recommandé :

```text
entreprise_id + champ
→ provenance_entreprises.csv
→ source_id
→ catalogue_sources.csv
```

et :

```text
site_id + champ
→ provenance_etablissements.csv
→ source_id
→ catalogue_sources.csv
```

Le code du dashboard doit lire ces fichiers et construire les index nécessaires.

---

# 16. Règles de qualité

Toute nouvelle donnée ajoutée au projet devrait respecter les règles suivantes :

1. identifier la source ;
2. conserver l’URL ou la référence documentaire ;
3. conserver le périmètre ;
4. conserver la période ;
5. identifier le mode d’obtention ;
6. documenter la formule si la valeur est calculée ;
7. ne jamais propager une donnée groupe au niveau établissement ;
8. ne jamais transformer une absence de documentation en preuve d’absence ;
9. privilégier les sources primaires ;
10. signaler les valeurs nécessitant une revalidation.

---

# 17. Articulation avec la méthodologie du panel

La provenance des **données** et la provenance de la **sélection des entreprises** sont deux couches distinctes.

La sélection du panel est documentée dans :

```text
data/panel/
├── panel_selection.csv
├── panel_selection_sources.csv
└── panel_methodologie.csv
```

La logique est alors :

```text
ENTREPRISE DU PANEL
      ↓
mode de sélection
      ↓
justification
      ↓
source documentaire
```

alors que la couche présente dans ce dossier concerne :

```text
DONNÉE AFFICHÉE
      ↓
provenance
      ↓
source
```

Les deux mécanismes suivent néanmoins le même principe général de traçabilité.

---

# 18. Finalité

La couche de provenance permet au dashboard BITD France de ne pas seulement montrer des informations, mais de permettre à l’utilisateur de :

- comprendre leur origine ;
- vérifier leur périmètre ;
- distinguer publication et calcul ;
- ouvrir la source originale ;
- identifier les limites ;
- réutiliser les données avec davantage de confiance.

La traçabilité fait donc partie intégrante du modèle de données du projet, et non d’une simple bibliographie ajoutée a posteriori.
