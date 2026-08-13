# Référentiel des programmes BITD — statuts vérifiés au 2026-08-13

Ce dossier contient la couche **programmes** du dashboard BITD France.

## Principe méthodologique

Le statut d'un programme est une donnée volatile. Chaque programme possède donc :

- un `statut_code` normalisé ;
- un `statut_libelle` lisible ;
- un court `resume_statut` destiné au dashboard ;
- une date d'événement de référence ;
- une date de `derniere_verification` ;
- au moins une source permettant de vérifier le statut.

La règle est :

> **pas de statut sans source identifiable.**

## Fichiers

### `programmes.csv`

Table principale des 16 objets actuellement retenus dans l'explorateur.

Elle distingue volontairement plusieurs types d'objets :

- `programme`
- `programme_cooperation`
- `plateforme_et_programme`
- `famille_missile`
- `systeme_missile`
- `programme_modernisation`

Cela évite de présenter SCORPION, le SCAF, Rafale et M51 comme des objets institutionnels strictement identiques.

### `programme_sources.csv`

Catalogue des sources utilisées pour vérifier les statuts.

Les liens sont des liens directs vers des sources officielles ou industrielles primaires.

### `programme_composantes.csv`

Permet de traiter les programmes dont le statut global masque plusieurs réalités.

Exemple SCAF :

- avion unique : arrêté ;
- moteurs associés : arrêtés ;
- Combat Cloud : poursuivi ;
- autres systèmes : poursuivis.

Le dashboard doit donc afficher **SCAF — Reconfiguré** et non simplement **Abandonné**.

Exemple MGCS :

- programme poursuivi ;
- recentrage sur R&D et démonstrateurs ;
- approche indépendante d'une plateforme unique ;
- architectures ouvertes.

### `entreprise_programme.csv`

Relations minimales entre les entreprises du panel et les programmes.

**Important : cette table est volontairement non exhaustive.**

Une relation n'y est intégrée que lorsqu'une source du présent référentiel nomme directement l'acteur ou documente explicitement son rôle.  
Il est préférable de montrer moins de relations mais de pouvoir les vérifier.

## Vigilance

Le champ `niveau_vigilance` signale les programmes dont le statut mérite une surveillance plus rapprochée.

- `faible` : trajectoire actuelle claire ;
- `moyenne` : source actuelle mais jalons susceptibles d'évoluer ;
- `elevee` : reconfiguration politique ou industrielle récente.

Au 2026-08-13, le SCAF et le MGCS sont classés en vigilance élevée.

## Affichage recommandé

Dans le dashboard :

**SCAF / FCAS**  
`Reconfiguré`  
*Le projet d'avion unique et les moteurs associés ont été arrêtés en 2026 ; le Combat Cloud et les autres systèmes se poursuivent.*  
`Statut vérifié le 13 août 2026`  
`Voir la source ↗`

Ne jamais afficher uniquement un badge sans le paragraphe explicatif pour un programme reconfiguré.

## Mise à jour

Lorsqu'un nouveau jalon est publié :

1. vérifier une source officielle récente ;
2. mettre à jour `programmes.csv` ;
3. ajouter la source dans `programme_sources.csv` ;
4. modifier `programme_composantes.csv` si le changement ne concerne qu'une composante ;
5. mettre à jour `derniere_verification`.

Copilot ne doit pas inventer ou mettre à jour les statuts de sa propre initiative.


## Cas SCAF et MGCS : relations industrielles

Les statuts politiques et programmatiques du SCAF et du MGCS ont été reconfigurés en 2026.

Le fichier `entreprise_programme.csv` **ne recycle donc pas automatiquement les anciennes répartitions industrielles** pour ces deux programmes.

Tant que les rôles post-reconfiguration ne sont pas redocumentés par des sources primaires suffisamment précises, le dashboard doit afficher :

> **Répartition industrielle actuelle à revalider après la reconfiguration de 2026.**

Cette absence volontaire est une mesure de qualité des données, et non un oubli.
