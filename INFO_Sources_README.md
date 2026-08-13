# Qualité des informations et des données — Dashboard BITD France

> **Objet.** Ce document décrit l'origine, le modèle, les garanties de qualité, les limites et la
> gouvernance des données présentées par le dashboard *BITD France* (panel de 30 acteurs
> industriels de la Base industrielle et technologique de défense).
>
> **Date de référence des données :** 12 août 2026 · **Dernier audit qualité :** 13 août 2026 ·
> **Version du document :** 1.0

---

## 1. Portée et avertissement d'usage

Le panel présenté **ne constitue ni un classement officiel, ni une liste exhaustive** de la BITD
française. Il s'agit d'un panel documenté de 30 acteurs, construit selon la méthode décrite sur la
page [Méthodologie & sources](methodologie.qmd) du site, à des fins d'exploration et de
visualisation. Les indicateurs financiers sont présentés **au niveau auquel ils sont effectivement
publiés** (groupe, société ou segment) et ne sont jamais estimés à un niveau plus fin — principe de
traçabilité : *pas de source identifiable = pas de chiffre présenté comme établi*.

## 2. Origine des données et mode de collecte

| Étape | Description |
|---|---|
| Collecte initiale | Compilation assistée par IA générative à partir de sources publiques (communiqués et rapports financiers, sites corporate, presse spécialisée défense, publications DGA/ministère). Chaque valeur structurante est adossée à une source du catalogue (`data/provenance/catalogue_sources.csv`). |
| Enrichissement administratif | Croisement avec le répertoire **SIRENE** (stock du 31 juillet 2026) : SIREN/SIRET, raisons sociales, codes APE, états administratifs, qualité « siège d'unité légale ». Les établissements ajoutés par cette voie portent le suffixe `— SIRENE` et l'origine `sirene` dans `etablissements.csv`. |
| Qualification | Chaque établissement SIRENE est qualifié (signe d'activité BITD, preuve corporate, affichage par défaut) ; les lignes sans signe d'activité défense sont conservées mais non affichées par défaut. |
| Audit qualité | Audit interne programmatique complet + vérification externe ciblée des faits saillants (13 août 2026, détail en §5). Corrections appliquées le même jour (§6). |

Les coordonnées géographiques sont majoritairement des **centres de commune** (champ
`precision_coordonnees`) : elles positionnent l'établissement dans la bonne commune, pas à
l'adresse exacte.

## 3. Modèle de données

| Fichier | Contenu | Clé | Volumétrie |
|---|---|---|---|
| `data/entreprises.csv` | Fiches des 30 entreprises (identité, siège, effectifs, indicateurs financiers datés, compteurs) | `id` | 30 lignes |
| `data/etablissements.csv` | Implantations géolocalisées, données SIRENE, qualification | `site_id` | 458 lignes |
| `data/programmes.csv` | Programmes d'armement suivis, statut daté et sourcé, niveau de vigilance | `programme_id` | 16 lignes |
| `data/entreprise_programme.csv` | Rôles des entreprises du panel dans les programmes | (`programme_id`, `entreprise_id`) | 28 lignes |
| `data/programme_composantes.csv` / `programme_sources.csv` / `site_programme.csv` | Composantes de programmes, sources associées, liens site↔programme | — | 23 / 21 / 8 lignes |
| `data/panel/` | Méthode de constitution du panel, sélection (cercles 1 et 2), sources de sélection | `entreprise_id` | 3 fichiers |
| `data/identite/` | Identité industrielle, capacités, référentiel de chaîne de valeur, sources | `entreprise_id` | 4 fichiers |
| `data/provenance/` | **Traçabilité champ par champ** : catalogue des sources, provenance des valeurs entreprises et établissements | (`*_id`, `champ`) | 3 fichiers |
| `data/glossaire.json` | Définitions des notions affichées (page *Comprendre les données*) | terme | — |

Intégrité référentielle vérifiée entre tous les fichiers (aucune référence orpheline au 13/08/2026).

## 4. Dimensions de qualité (grille inspirée du cadre qualité de la statistique publique)

| Dimension | État constaté (audit du 13/08/2026) |
|---|---|
| **Exactitude** | Faits saillants confirmés contre sources primaires (§5). Une erreur factuelle détectée et corrigée (fiche Thales, §6). Ratios financiers publiés : 100 % recalculés exacts depuis leurs composantes. |
| **Cohérence interne** | Intégrité référentielle totale ; 458/458 SIREN et SIRET valides (format + clé de Luhn) ; sièges cohérents entre `entreprises.csv` et `etablissements.csv` ; géographie département/région/code postal/coordonnées cohérente ligne à ligne (bornes France métropolitaine + Guyane). |
| **Actualité** | Indicateurs financiers : exercice **2025** (publications février–mars 2026), millésime explicite dans chaque libellé. Stock SIRENE : 31/07/2026. Statuts de programmes : datés, avec `derniere_verification`. |
| **Complétude** | Assumée partielle et documentée : effectifs ou CA « défense » non publiés = indiqués comme tels, jamais estimés ; couverture cartographique qualifiée par entreprise (`statut_couverture`). |
| **Traçabilité** | Système de provenance champ par champ (`data/provenance/`), exposé dans l'interface (boutons « Source »), avec distinction publié / calculé / non communiqué. |

## 5. Vérifications externes réalisées (13 août 2026)

Faits saillants confrontés à des sources primaires ou officielles :

| Donnée vérifiée | Valeur du dashboard | Source de vérification | Verdict |
|---|---|---|---|
| Siège social Thales | Meudon, 4 rue de la Verrerie | Annonce légale (transfert au 01/09/2023) ; SIRENE via Annuaire des entreprises (SIRET 552 059 024 01909) | ✅ Confirmé |
| Thales FY2025 | Carnet 53,3 Md€ ; 85 000 collaborateurs ; marge d'EBIT ajusté 12,4 % | Communiqué de résultats du 3 mars 2026 | ✅ Confirmé |
| Airbus Defence and Space FY2025 | Commandes 17,729 Md€ ; CA 13,405 Md€ ; carnet 50,771 Md€ (book-to-bill 1,32) | Résultats annuels Airbus du 19 février 2026 | ✅ Confirmé |
| MBDA FY2025 | CA 5,8 Md€ ; commandes 13,2 Md€ ; carnet 44,4 Md€ ; > 22 000 salariés | Publication annuelle MBDA du 26 mars 2026 | ✅ Confirmé |
| Safran — effectifs | > 110 000 collaborateurs au 31/12/2025 | Rapport intégré 2025 Safran | ✅ Confirmé |
| Arquus / John Cockerill Defense | Intégration au 2 juillet 2024 ; identité unifiée présentée à Eurosatory 2026 | Communications Arquus et John Cockerill | ✅ Confirmé |
| Cercle 1 — 9 acteurs | Thales, Dassault Aviation, Safran, Naval Group, Airbus, MBDA, KNDS France, ArianeGroup, Arquus–JCD | Liste DGA des grands maîtres d'œuvre industriels | ✅ Conforme |
| SCAF — statut | Arrêt de l'avion de combat commun ; poursuite du Combat Cloud | Presse spécialisée, avril–juillet 2026 | ✅ Résumé long conforme (voir §7) |
| Siège TechnicAtome | Plateau de Saclay (Essonne) | SIRENE : commune exacte **Villiers-le-Bâcle** | ⚠️ Précision de commune apportée (§6) |

## 6. Corrections appliquées le 13 août 2026 (journal)

96 corrections, en quatre catégories, appliquées directement dans les fichiers `data/` :

1. **Identifiants d'établissements dédoublonnés (4 lignes).** Deux paires d'établissements
   distincts (SIREN différents) partageaient le même `site_id`, construit sur le seul suffixe NIC
   (`01-sirene-00037` : Thales Élancourt / Thales Toulouse ; `07-sirene-00018` : KNDS Versailles × 2),
   ce qui masquait un établissement sur deux dans l'interface. Les identifiants intègrent désormais
   le SIREN (ex. `01-sirene-00037-383475092`), garantissant l'unicité.
2. **Compteurs recalculés (38 valeurs).** `nb_sites_cartographies` et `nb_regions_cartographiees`
   dataient d'avant l'enrichissement SIRENE ; ils sont recalculés depuis `etablissements.csv`
   (ex. Thales : 27 → 51 sites ; Daher : 5 → 25).
3. **Libellés financiers corrigés (2 fiches).** Thales : « 25,3 Md€ » était le montant des prises de
   commandes 2025, non le chiffre d'affaires (22,136 Md€) — libellé reformulé avec les deux
   valeurs. TechnicAtome : chiffre d'affaires harmonisé sur la valeur 2025 (683 M€).
4. **Lien source réparé (audit des liens du 13/08/2026).** L'URL DGA de la livraison du SNA
   *De Grasse* portait un suffixe `-0` étranger à l'URL canonique du ministère (vérifiée en
   ligne, HTTP 200) ; suffixe retiré. Le sondage dirigé du même jour (liens officiels
   defense.gouv.fr, elysee.fr) n'a révélé aucun autre lien mort parmi les URL testées — y
   compris des slugs d'apparence suspecte (`marin-nucleaire`, `m514`) qui sont les slugs
   authentiques du CMS ministériel.
5. **Provenance re-routée (52 lignes).** Propagation des nouveaux `site_id` dans
   `provenance_etablissements.csv`, par jointure sur le nom de site puis sur la valeur du champ ;
   les lignes à valeur commune aux deux établissements ont été dupliquées pour préserver la
   traçabilité de chacun.

## 7. Limites connues et points de vigilance

- **Libellés courts de statut.** Pour le SCAF, le libellé « Reconfiguré » affiché seul euphémise
  l'arrêt de l'avion de combat commun acté en juin–juillet 2026 (le résumé détaillé, lui, est
  exact). Pour le MGCS, la formulation d'une décision conjointe de recentrage est plus affirmative
  que la presse consultée ; le niveau de vigilance « élevée » porté par la donnée est justifié.
- **Maîtres d'œuvre non renseignés** sur certains programmes où ils sont documentables
  (Barracuda et SNLE 3G : Naval Group, avec TechnicAtome pour les chaufferies ; A330 MRTT :
  Airbus DS ; PA-Ng : co-maîtrise Naval Group / Chantiers de l'Atlantique) ou portés par des
  consortiums hors panel (SAMP/T : Eurosam ; NH90 : NHIndustries).
- **Deux valeurs plausibles non retrouvées telles quelles** dans les sources consultées :
  effectif groupe Airbus de 165 294 (fin 2025) et 55 300 collaborateurs de la branche
  Équipements & Défense de Safran. À sourcer depuis les documents d'enregistrement universel.
- **SIRENE non reconfronté ligne à ligne** à la base officielle (l'échantillon vérifié, la validité
  formelle, l'unicité et la cohérence géographique rendent le risque résiduel faible).
- **Textes descriptifs longs** (identité industrielle, chaîne de valeur) relus mais non audités
  phrase à phrase.
- **« 14 régions couvertes »** = 13 régions métropolitaines + la Guyane (Centre spatial guyanais,
  Kourou).

## 8. Contrôle continu

Le script `controle_qualite.py` (racine du dépôt) rejoue l'ensemble des contrôles internes de
l'audit — intégrité référentielle, unicité, Luhn SIREN/SIRET, géographie, compteurs, provenance —
sans rien modifier, et retourne un code de sortie non nul en cas d'anomalie :

```bash
python3 controle_qualite.py
```

À exécuter avant toute publication après modification des fichiers `data/`. Toute nouvelle collecte
assistée par IA doit repasser ce contrôle **puis** une vérification externe des faits saillants
contre sources primaires datées, selon la grille du §5.

**Validité des liens externes.** Le workflow `.github/workflows/verification-liens.yml` vérifie
automatiquement l'ensemble des URL présentes dans `data/` et les pages (233 URL uniques au
13/08/2026) à chaque modification des données, chaque lundi, et à la demande (onglet *Actions* →
*Vérification des liens externes* → *Run workflow*). En cas de lien mort, une issue GitHub est
ouverte avec le rapport détaillé ; les URL de remplacement sont alors recherchées et corrigées
dans les données, avec mention au journal du §6. Les motifs templatés (fiches Pappers construites
sur le SIREN) sont couverts par le même contrôle.

---

*Document maintenu avec le dépôt. Toute correction de données doit être répercutée dans le journal
du §6 avec sa date et sa justification.*
