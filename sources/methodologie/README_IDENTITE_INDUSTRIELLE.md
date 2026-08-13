# Identité industrielle — Documentation méthodologique

## Objet

La couche « Identité industrielle » enrichit chaque fiche entreprise du dashboard BITD France
d'une lecture analytique de la position de l'entreprise dans la chaîne de valeur de la défense,
de ses capacités clés et d'un résumé éditorial synthétique.

Cette couche ne se substitue **pas** aux données financières, aux programmes ou aux implantations :
elle les complète pour permettre une lecture industrielle cohérente.

---

## Fichiers

| Fichier | Contenu | Lignes attendues |
|---|---|---|
| `data/identite/identite_industrielle.csv` | Identité industrielle des 30 entreprises du panel | 30 |
| `data/identite/chaine_valeur_referentiel.csv` | Nomenclature des 8 positions dans la chaîne de valeur | 8 |
| `data/identite/entreprise_capacites.csv` | Capacités clés par entreprise | ≥ 150 |
| `data/identite/identite_industrielle_sources.csv` | Sources méthodologiques de la couche identité | ≥ 2 |

---

## Chaîne de valeur — nomenclature

La nomenclature comprend **8 positions**, identifiées CV01 à CV08 :

| Code | Libellé |
|---|---|
| CV01 | Ensemblier / systémier / intégrateur |
| CV02 | Maître d'œuvre spécialisé |
| CV03 | Équipementier / fournisseur de systèmes |
| CV04 | Composants & matériaux critiques |
| CV05 | Munitions, énergétiques & pyrotechnie |
| CV06 | MCO & services industriels |
| CV07 | Ingénierie, essais & qualification |
| CV08 | Production industrielle de précision |

### Principe fondamental : pas de hiérarchie

Ces huit catégories ne constituent **ni un classement, ni une note, ni un niveau d'importance,
ni un niveau de souveraineté**. Une position amont (CV04 : composants & matériaux) n'est pas
« inférieure » à une position d'intégration (CV01). La criticité industrielle peut être aussi
élevée, voire plus élevée, dans les positions amont.

### Source méthodologique

Cette classification est une lecture analytique propre au dashboard BITD France, construite
pour rendre lisible la position des entreprises dans la chaîne de valeur. Elle s'appuie notamment
sur les travaux **EcoDef Statistiques n°279** consacrés aux fonctions industrielles des entreprises
de défense. Elle **ne constitue pas une nomenclature officielle**.

---

## Distinction type d'acteur / chaîne de valeur

Le champ `type_acteur_panel` reflète l'identification **institutionnelle** de l'entreprise dans
le panel (ex. : « Grand maître d'œuvre industriel — identification DGA »).

Le champ `chaine_valeur_principale_id` reflète sa **position fonctionnelle** dans la chaîne
de valeur selon notre lecture analytique.

Ces deux informations peuvent différer. Exemple : une entreprise peut être identifiée
institutionnellement comme grand maître d'œuvre DGA tout en ayant, dans notre lecture
fonctionnelle, une position principale d'équipementier de systèmes (CV03). Les deux
informations coexistent dans la fiche et sont présentées sans hiérarchisation.

---

## Champs de `identite_industrielle.csv`

| Champ | Description |
|---|---|
| `entreprise_id` | Identifiant numérique de l'entreprise (clé vers `entreprises.csv`) |
| `slug` | Identifiant URL de l'entreprise |
| `entreprise` | Nom de l'entreprise |
| `cercle` | Cercle du panel (1 ou 2) |
| `type_acteur_panel` | Libellé du statut institutionnel dans le panel |
| `chaine_valeur_principale_id` | Code CV de la position principale (CV01 à CV08) |
| `chaine_valeur_secondaire_ids` | Codes CV secondaires, séparés par `;` |
| `secteur_principal` | Secteur industriel principal |
| `specialite` | Spécialité industrielle résumée |
| `positionnement_industriel` | Description analytique documentée de la position (ne pas reformuler) |
| `ce_qu_il_faut_retenir` | Synthèse analytique éditoriale (ne pas reformuler) |
| `capacites_cles` | Capacités clés, séparées par `;` (cohérence avec `entreprise_capacites.csv`) |
| `nature_analyse` | `synthese_analytique_documentee` — signifie que le positionnement et le résumé sont des synthèses construites à partir de sources documentées |
| `source_industrielle_id` | Référence vers `data/provenance/catalogue_sources.csv` |
| `source_methodologie_chaine_valeur` | Référence vers `data/identite/identite_industrielle_sources.csv` |
| `derniere_verification` | Date de dernière vérification (YYYY-MM-DD) |
| `afficher_dashboard` | `true` / `false` — pilote l'affichage dans le dashboard |

---

## Principes d'utilisation

1. **Ne jamais reformuler** les champs `positionnement_industriel` et `ce_qu_il_faut_retenir`.
2. **Ne jamais inventer** une capacité ou une position non documentée.
3. **Ne jamais dupliquer** les données financières depuis `entreprises.csv`.
4. **Ne pas attribuer** une entreprise à une catégorie par déduction : toute position
   doit être documentée dans ce fichier.
5. **Fail-soft** : si une entreprise n'est pas dans ce fichier, la fiche continue de
   fonctionner avec `entreprises.csv` seul.

---

## Validation au chargement

Le dashboard vérifie au chargement :

- `identite_industrielle.csv` → 30 entreprises uniques
- `chaine_valeur_referentiel.csv` → 8 catégories
- `entreprise_capacites.csv` → capacités rattachées uniquement à des `entreprise_id` connus
- 0 entreprise sans `source_industrielle_id`
