# Cercle 1 — International : méthode, périmètre et traçabilité

**Dernière vérification : 2026-08-13**

Ce paquet alimente une future vue du dashboard **BITD France** centrée sur les neuf entreprises du **Cercle 1**.

## 1. Pourquoi ces neuf entreprises ?

La source institutionnelle de référence est la Direction générale de l'armement (DGA), qui cite neuf maîtres d'œuvre industriels (MOI) :
**Airbus, Dassault, Thales, Safran, Naval Group, MBDA, KNDS, Arquus et ArianeGroup**.

Source :
https://armement.defense.gouv.fr/lindustrie-de-defense-au-service-des-ambitions-francaises-de-la-maitrise-la-superiorite

Le fichier `cercle1_entreprises.csv` conserve les identifiants du panel existant du dashboard.

## 2. Ce que signifie « international »

La V1 **n'est pas un recensement exhaustif de toutes les filiales et bureaux mondiaux**.

Une implantation est retenue lorsqu'une source publique primaire permet de documenter suffisamment :
- son existence ;
- sa ville/pays ou son adresse ;
- son rattachement ;
- et, autant que possible, sa fonction.

Les cartes doivent afficher le libellé **« sélection documentée — non exhaustive »**.

## 3. Pertinence Défense

- `directe` : activité explicitement reliée à la défense.
- `mixte/duale` ou `duale/indirecte` : activité duale ou défense non isolable dans la source.
- `commerciale` : bureau/représentation sans fonction industrielle démontrée.
- `faible/civile` : présence du groupe documentée mais principalement civile ; normalement masquée par défaut.

## 4. Cas sensibles de périmètre

### KNDS France
L'entreprise du panel est **KNDS France**. Les sites étrangers de Munich, Stockport, Santa Maria ou Singapour proviennent de publications du **groupe KNDS**, de KNDS Deutschland ou d'autres sociétés du groupe.
Ils ne sont **pas** des implantations juridiques de KNDS France. Ils sont marqués explicitement et `afficher_par_defaut=false`.

### Dassault Aviation
La présence DRAL à Nagpur est publiée, mais les éléments récents utilisés la décrivent principalement comme un centre Falcon. Elle est donc qualifiée `faible/civile` dans la vue Défense et masquée par défaut.
Le site Rafale d'Hyderabad est une installation **Tata Advanced Systems** partenaire ; il figure dans les relations et localisations partenaires, pas dans les implantations Dassault.

### ArianeGroup
Les sites allemands sont documentés mais plusieurs fonctions publiées sont principalement spatiales/duales.
Trauen est qualifié Défense directe car ArianeGroup y documente la conception/fabrication du système RESUS pour sous-marins.

### Arquus – John Cockerill Defense
Le panel actuel regroupe Arquus et John Cockerill Defense. Les implantations étrangères de cette V1 sont celles de **John Cockerill Defense** et ne doivent jamais être présentées comme des sites Arquus France.

## 5. Règle stricte pour « travaille avec »

Une relation n'est intégrée que si une source primaire documente explicitement au moins un des éléments suivants :
- partenariat ou coopération industrielle ;
- consortium ou joint-venture ;
- intégration d'un équipement/système ;
- transfert de production ;
- contrat de fourniture ;
- actionnariat structurant ;
- démonstration/intégration présentée explicitement comme telle.

**Le simple fait que deux entreprises participent au même programme ne suffit jamais.**

`statut_relation` distingue notamment :
- `actuelle`
- `annoncee_industrialisation`
- `LOI_2026`
- `demonstration_2026`

Une LOI ou un démonstrateur ne doit pas être présenté comme un contrat d'acquisition.

## 6. Géolocalisation

Les coordonnées de cette V1 sont des **coordonnées approximatives de centre-ville**, utilisées uniquement pour permettre la visualisation cartographique.

Elles ne sont pas des coordonnées officielles d'entrée d'établissement.

Champs :
- `precision_coordonnees = centre_ville_approx`
- `coordonnees_statut = approximation_cartographique_a_revalider`
- `source_coord_id = METH_COORD_001`

La preuve de l'existence du site, de son adresse/ville et de sa fonction repose sur `source_site_id` et `source_site_url`.

## 7. Localisation des partenaires

`cercle1_partenaires_localisation.csv` ne cartographie pas « le siège de chaque partenaire ».
Chaque point représente précisément ce que dit `entite_ou_site` :
site de programme, JV, ligne industrielle ou consortium.

Les relations entre deux membres du Cercle 1 doivent réutiliser les sièges français déjà présents dans `data/entreprises.csv`, plutôt que dupliquer des points.

## 8. Niveau de confiance

- `haute` : source primaire claire sur l'existence, la relation ou le périmètre.
- `moyenne` : information principale documentée mais statut opérationnel, périmètre ou localisation exacte à revalider.
- `faible` : à éviter en affichage par défaut.

Ce niveau de confiance n'est **pas un score de risque**.

## 9. Affichage recommandé

Par défaut :
- implantations `valide_public` ;
- `afficher_par_defaut=true` ;
- relations `actuelle`.

Toggles recommandés :
- **Inclure annonces / LOI / démonstrateurs**
- **Inclure activités duales / civiles**
- **Inclure périmètre groupe KNDS**
- **Afficher toutes les relations documentées**

Toute fiche doit afficher :
- source ;
- organisme ;
- date de publication si disponible ;
- dernière vérification ;
- niveau de confiance ;
- périmètre ;
- caveat ;
- lien cliquable.

**Pas de source identifiable = pas de donnée présentée comme établie.**

## 10. Fichiers

- `cercle1_entreprises.csv` : les 9 acteurs et leur justification d'inclusion.
- `cercle1_implantations_internationales.csv` : implantations étrangères sélectionnées.
- `cercle1_partenaires_defense.csv` : relations industrielles explicitement documentées.
- `cercle1_partenaires_localisation.csv` : points cartographiables des partenaires/JV/sites de programme.
- `cercle1_sources.csv` : catalogue de provenance.
