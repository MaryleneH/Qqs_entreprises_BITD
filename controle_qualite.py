#!/usr/bin/env python3
"""Contrôle qualité des données du dashboard BITD — lecture seule, aucun fichier modifié.
Rejoue les contrôles internes de l'audit du 13/08/2026. Code de sortie 0 si tout est vert.
Usage : python3 controle_qualite.py   (à la racine du dépôt)
"""
import csv
import io, io, re, sys
from collections import Counter, defaultdict

def load(path):
    raw = open(path, encoding='utf-8-sig').read()
    d = ';' if raw.split('\n')[0].count(';') > raw.split('\n')[0].count(',') else ','
    return list(csv.DictReader(io.StringIO(raw), delimiter=d))

def luhn(num):
    total = 0
    for i, c in enumerate(reversed(num)):
        x = int(c)
        if i % 2 == 1:
            x *= 2
            if x > 9: x -= 9
        total += x
    return total % 10 == 0

REG = {'84':'Auvergne-Rhône-Alpes','27':'Bourgogne-Franche-Comté','53':'Bretagne','24':'Centre-Val de Loire',
       '94':'Corse','44':'Grand Est','32':'Hauts-de-France','11':'Île-de-France','28':'Normandie',
       '75':'Nouvelle-Aquitaine','76':'Occitanie','52':'Pays de la Loire','93':"Provence-Alpes-Côte d'Azur",
       '03':'Guyane'}
D2R = {}
for r, ds in {'84':'01 03 07 15 26 38 42 43 63 69 73 74','27':'21 25 39 58 70 71 89 90','53':'22 29 35 56',
              '24':'18 28 36 37 41 45','94':'2A 2B','44':'08 10 51 52 54 55 57 67 68 88','32':'02 59 60 62 80',
              '11':'75 77 78 91 92 93 94 95','28':'14 27 50 61 76','75':'16 17 19 23 24 33 40 47 64 79 86 87',
              '76':'09 11 12 30 31 32 34 46 48 65 66 81 82','52':'44 49 53 72 85','93':'04 05 06 13 83 84',
              '03':'973'}.items():
    for d in ds.split(): D2R[d] = r

def in_bounds(lat, lng):
    return (41.0 <= lat <= 51.3 and -5.5 <= lng <= 9.8) or (2.0 <= lat <= 6.1 and -55.0 <= lng <= -51.5)  # métropole ou Guyane

errors, warns = [], []
ent = load('data/entreprises.csv'); eta = load('data/etablissements.csv')

# 0. Hygiène des fichiers CSV : en-têtes et encodage (avant tout accès par clé)
# --------------------------------------------------
# Un espace parasite dans un nom de colonne suffit à casser silencieusement toute
# lecture par clé (cas rencontré : «  site_id » au lieu de « site_id »). Ces
# contrôles portent sur TOUS les CSV du dépôt, y compris ceux ajoutés plus tard.
import glob
import unicodedata

INVISIBLES = {'\u00a0': 'espace insécable', '\u200b': 'espace de largeur nulle',
              '\u200e': 'marque gauche-à-droite', '\ufeff': 'BOM en milieu de ligne',
              '\t': 'tabulation'}

for chemin in sorted(glob.glob('data/**/*.csv', recursive=True) + glob.glob('sources/**/*.csv', recursive=True)):
    with open(chemin, 'rb') as f:
        brut = f.read()
    if not brut.strip():
        errors.append(f"{chemin} : fichier vide")
        continue
    texte = brut.decode('utf-8-sig', errors='replace')
    if '\ufffd' in texte:
        errors.append(f"{chemin} : caractères non décodables — le fichier n'est pas en UTF-8")
        continue
    entete = texte.split('\n')[0].rstrip('\r')
    sep = ';' if entete.count(';') > entete.count(',') else ','
    colonnes = next(csv.reader([entete], delimiter=sep))
    for c in colonnes:
        if c != c.strip():
            errors.append(f"{chemin} : nom de colonne « {c} » entouré d'espaces — "
                          f"toute lecture par clé échouera silencieusement")
        for car, libelle in INVISIBLES.items():
            if car in c:
                errors.append(f"{chemin} : nom de colonne « {c.strip()} » contient un caractère invisible ({libelle})")
        if not c.strip():
            errors.append(f"{chemin} : colonne sans nom")
    doublons = [c for c in set(colonnes) if colonnes.count(c) > 1]
    if doublons:
        errors.append(f"{chemin} : colonnes en double {sorted(doublons)}")
    # largeur constante des lignes
    lignes = list(csv.reader(io.StringIO(texte), delimiter=sep))
    mauvaises = [i + 1 for i, l in enumerate(lignes[1:], start=1) if l and len(l) != len(colonnes)]
    if mauvaises:
        errors.append(f"{chemin} : {len(mauvaises)} ligne(s) au nombre de colonnes incorrect "
                      f"(première : ligne {mauvaises[0] + 1}) — souvent une virgule non protégée")

# Un en-tête corrompu rend tous les contrôles suivants ininterprétables : on s'arrête ici.
if errors:
    print("Contrôle qualité — arrêt : structure de fichier invalide")
    for e in errors: print(f"  [ERREUR] {e}")
    sys.exit(1)

# 1. Références et unicité
ids = {e['id'] for e in ent}
for r in eta:
    if r['entreprise_id'] not in ids: errors.append(f"établissement orphelin: {r['site_id']}")
for k, v in Counter(r['site_id'] for r in eta).items():
    if v > 1: errors.append(f"site_id dupliqué: {k} (×{v})")
for k, v in Counter(r['siret'] for r in eta if r['siret']).items():
    if v > 1: errors.append(f"SIRET dupliqué: {k} (×{v})")

# 2. Sièges
sieges = defaultdict(list)
for r in eta:
    if r['est_siege'].lower() == 'true': sieges[r['entreprise_id']].append(r)
for e in ent:
    s = sieges.get(e['id'], [])
    if len(s) != 1: errors.append(f"{e['entreprise']}: {len(s)} site(s) siège")
    elif s[0]['ville'].strip().lower() != e['siege_ville'].strip().lower():
        errors.append(f"{e['entreprise']}: siege_ville incohérent ({e['siege_ville']} / {s[0]['ville']})")

# 3. SIREN / SIRET
for r in eta:
    if r['siren'] and (not re.fullmatch(r'\d{9}', r['siren']) or not luhn(r['siren'])):
        errors.append(f"SIREN invalide: {r['site_id']}")
    if r['siret'] and (not re.fullmatch(r'\d{14}', r['siret']) or not luhn(r['siret'])):
        errors.append(f"SIRET invalide: {r['site_id']}")
    if r['siren'] and r['siret'] and not r['siret'].startswith(r['siren']):
        errors.append(f"SIRET ≠ SIREN: {r['site_id']}")

# 4. Géographie
for r in eta:
    cd, reg = r['code_departement'].strip(), r['region'].strip()
    exp = REG.get(D2R.get(cd, ''), None)
    if exp and reg and reg != exp:
        errors.append(f"{r['site_id']}: dépt {cd} → région attendue « {exp} », trouvée « {reg} »")
    try:
        if not in_bounds(float(r['latitude']), float(r['longitude'])):
            errors.append(f"{r['site_id']}: coordonnées hors bornes France")
    except ValueError:
        errors.append(f"{r['site_id']}: coordonnées non numériques")
    m = re.search(r'\b(\d{5})\b', r['adresse'] or '')
    if m and cd and cd not in ('2A', '2B') and not m.group(1).startswith(cd.zfill(2)[:2]) and not m.group(1).startswith(cd):
        warns.append(f"{r['site_id']}: CP {m.group(1)} ≠ dépt {cd}")

# 5. Compteurs entreprises
by_ent = defaultdict(list)
for r in eta: by_ent[r['entreprise_id']].append(r)
for e in ent:
    sites = by_ent.get(e['id'], [])
    if e['nb_sites_cartographies'] and int(e['nb_sites_cartographies']) != len(sites):
        errors.append(f"{e['entreprise']}: nb_sites_cartographies={e['nb_sites_cartographies']} vs {len(sites)}")
    regs = {r['region'] for r in sites if r['region']}
    if e['nb_regions_cartographiees'] and int(e['nb_regions_cartographiees']) != len(regs):
        errors.append(f"{e['entreprise']}: nb_regions={e['nb_regions_cartographiees']} vs {len(regs)}")
    if e.get('nb_etablissements_v2_total') and int(e['nb_etablissements_v2_total']) != len(sites):
        errors.append(f"{e['entreprise']}: nb_etablissements_v2_total incohérent")

# 6. Programmes et provenance
prog = load('data/programmes.csv'); ep = load('data/entreprise_programme.csv')
pids = {p['programme_id'] for p in prog}
for r in ep:
    if r['programme_id'] not in pids: errors.append(f"entreprise_programme: programme inconnu {r['programme_id']}")
    if r['entreprise_id'] not in ids: errors.append(f"entreprise_programme: entreprise inconnue {r['entreprise_id']}")
pe = load('data/provenance/provenance_etablissements.csv')
sids = {r['site_id'] for r in eta}
orph = sorted({r['site_id'] for r in pe if r['site_id'] not in sids})
for o in orph: errors.append(f"provenance: site_id inconnu {o}")

# 6bis. Cohérence de l'unité légale : détecter les homonymies SIRENE
# ------------------------------------------------------------------
# Cas rencontré : une société financière homonyme immatriculée en 2023 avait été
# rattachée à un groupe industriel créé en 1988. Trois signaux la trahissaient.

# a) Familles d'activité incompatibles avec un site industriel ou un siège de groupe BITD.
DATE_CONTROLE = '2026-08-14'
alertes_ul = []
APE_A_RISQUE = {
    '64.19': 'autres intermédiations monétaires', '64.30': 'fonds de placement',
    '64.91': 'crédit-bail', '64.92': 'autre distribution de crédit', '64.99': 'autres services financiers',
    '65.11': 'assurance vie', '65.12': 'autres assurances', '65.20': 'réassurance',
    '66.19': 'auxiliaires de services financiers', '66.22': 'courtage d’assurance',
    '66.30': 'gestion de fonds',
    '68.10': 'marchands de biens', '68.20': 'location immobilière', '68.31': 'agences immobilières',
    '68.32': 'administration de biens', '70.21': 'conseil en relations publiques',
    '79.11': 'agences de voyage', '82.99': 'services de soutien divers',
    '85.59': 'enseignement divers', '94.99': 'organisations associatives',
}
for r in eta:
    ape = (r.get('ape_sirene') or '').strip()
    if not ape:
        continue
    famille = ape[:5]
    if famille in APE_A_RISQUE:
        libelle = APE_A_RISQUE[famille]
        warns.append(
            f"{r['entreprise']} ({r['site_id']}) : APE SIRENE {ape} — {libelle} — "
            f"incompatible avec une activité industrielle ; vérifier qu'il ne s'agit pas d'une société homonyme")
        siege_ul = r.get('est_siege_unite_legale_sirene') == 'true'
        lieu = r.get('nom_site') or r.get('ville') or r['site_id']
        portee = "l'unité légale (siège)" if siege_ul else "cet établissement uniquement"
        if siege_ul:
            constat = (f"Le siège de l'unité légale rattachée à cette ligne — {lieu} — est enregistré à l'INSEE "
                       f"sous l'activité « {libelle} » (code {ape}).")
            pourquoi = ("L'activité de l'unité légale décrit l'entité juridique de tête. Une classification "
                        "financière peut être légitime pour une holding, mais elle peut aussi révéler qu'une "
                        "société homonyme a été rattachée par erreur.")
            pas_signifier = ("Cela ne signifie pas que le groupe n'est pas industriel : beaucoup de têtes de "
                             "groupe cotées ou familiales sont classées en gestion de fonds ou en holding, "
                             "leurs filiales portant les codes industriels.")
            verif = ("Comparer la date de création, l'effectif et l'adresse de l'unité légale avec ceux du "
                     "groupe industriel connu ; vérifier que les filiales industrielles lui sont bien rattachées.")
        else:
            constat = (f"L'établissement de {lieu} porte à l'INSEE l'activité « {libelle} » (code {ape}), "
                       f"alors que la fiche le décrit comme un site de type « {r.get('type_site') or 'non précisé'} ».")
            pourquoi = ("Dans SIRENE, chaque établissement possède son propre code d'activité, distinct de celui "
                        "de l'entreprise. Un écart peut désigner un site annexe (centre de formation, entité "
                        "immobilière) plutôt qu'un site industriel — ou un mauvais rapprochement de SIRET.")
            pas_signifier = ("Cela ne dit rien de l'activité de l'entreprise elle-même, qui conserve son propre "
                             "code d'activité industriel : seul cet établissement est concerné.")
            verif = (f"Ouvrir la fiche SIRET {r.get('siret') or ''} et vérifier ce que le site abrite réellement, "
                     f"puis décider s'il relève du périmètre cartographié.")
        alertes_ul.append({
            'site_id': r['site_id'], 'entreprise_id': r['entreprise_id'], 'entreprise': r['entreprise'],
            'type': 'activite_non_industrielle', 'valeur': f"APE {ape} — {libelle}",
            'portee': portee, 'lieu': lieu,
            'constat': constat, 'pourquoi': pourquoi, 'pas_signifier': pas_signifier, 'verification': verif})

# b) SIREN récent sur un siège : les numéros commençant par 9 sont attribués
#    aux immatriculations les plus récentes, improbable pour un groupe historique.
for r in eta:
    siren = (r.get('siren') or '').strip()
    if siren.startswith('9') and (r.get('est_siege') == 'true' or r.get('est_siege_unite_legale_sirene') == 'true'):
        warns.append(
            f"{r['entreprise']} ({r['site_id']}) : SIREN {siren} correspond à une immatriculation récente "
            f"alors que la ligne est un siège ; vérifier l'ancienneté de l'unité légale")
        alertes_ul.append({
            'site_id': r['site_id'], 'entreprise_id': r['entreprise_id'], 'entreprise': r['entreprise'],
            'type': 'immatriculation_recente', 'valeur': f"SIREN {siren}",
            'portee': "l'unité légale (siège)", 'lieu': r.get('nom_site') or r.get('ville') or r['site_id'],
            'constat': "Le numéro SIREN rattaché à ce siège appartient aux tranches les plus récemment attribuées.",
            'pourquoi': "Un groupe industriel ancien possède normalement une unité légale de tête immatriculée "
                        "de longue date ; un numéro récent peut désigner une société homonyme créée depuis peu.",
            'pas_signifier': "Une immatriculation récente peut être parfaitement légitime : réorganisation "
                             "juridique, création d'une nouvelle holding, filialisation d'activités.",
            'verification': "Comparer la date de création de l'unité légale avec l'ancienneté du groupe."})

# c) Siège d'unité légale dont la raison sociale ne partage aucun mot avec le nom du panel.
MOTS_VIDES = {'sas', 'sa', 'sarl', 'sasu', 'group', 'groupe', 'france', 'holding', 'soc', 'societe', 'société', 'de', 'du', 'des', 'la', 'le', 'les', 'et'}
def mots(x):
    x = x.lower().replace('-', ' ').replace("'", ' ')
    return {m for m in re.findall(r"[a-zàâäéèêëîïôöùûüç]+", x) if m not in MOTS_VIDES and len(m) > 2}
for r in eta:
    rs = (r.get('raison_sociale_sirene') or '').strip()
    if not rs or r.get('est_siege_unite_legale_sirene') != 'true':
        continue
    if not (mots(rs) & mots(r['entreprise'])) and not (mots(rs) & mots(r.get('entite') or '')):
        warns.append(
            f"{r['entreprise']} ({r['site_id']}) : raison sociale SIRENE « {rs} » sans mot commun "
            f"avec le nom du panel ; vérifier le rattachement")
        alertes_ul.append({
            'site_id': r['site_id'], 'entreprise_id': r['entreprise_id'], 'entreprise': r['entreprise'],
            'type': 'raison_sociale_divergente', 'valeur': f"SIRENE : {rs}",
            'portee': "l'unité légale (siège)", 'lieu': r.get('nom_site') or r.get('ville') or r['site_id'],
            'constat': f"La raison sociale enregistrée à l'INSEE (« {rs} ») ne partage aucun mot avec le nom "
                       f"retenu dans le panel.",
            'pourquoi': "Le rattachement d'un établissement à une entreprise repose sur son unité légale ; "
                        "des noms totalement différents peuvent signaler une erreur d'appariement.",
            'pas_signifier': "Beaucoup de filiales portent légitimement un nom sans rapport avec leur maison mère.",
            'verification': "Vérifier le lien capitalistique entre l'unité légale et le groupe du panel."})

# 6ter. Export des alertes d'unité légale pour affichage dans le dashboard
# ------------------------------------------------------------------------
# Le fichier produit alimente la fiche entreprise : une alerte qui ne vit que
# dans la console n'est lue par personne.
import os
os.makedirs('data/qualite', exist_ok=True)
with open('data/qualite/alertes_unite_legale.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';', lineterminator='\r\n')
    w.writerow(['site_id', 'entreprise_id', 'entreprise', 'type_alerte', 'valeur_constatee',
                'portee', 'lieu', 'ce_qui_est_constate', 'pourquoi_cela_alerte',
                'ce_que_cela_ne_signifie_pas', 'verification_a_faire', 'date_controle'])
    for a in sorted(alertes_ul, key=lambda x: (int(x['entreprise_id']), x['site_id'])):
        w.writerow([a['site_id'], a['entreprise_id'], a['entreprise'], a['type'], a['valeur'],
                    a.get('portee', ''), a.get('lieu', ''),
                    a['constat'], a['pourquoi'], a['pas_signifier'], a['verification'], DATE_CONTROLE])
print(f"  → data/qualite/alertes_unite_legale.csv : {len(alertes_ul)} alerte(s) d'unité légale")

# 7. Cercle 1 — International, fiches groupes et catalogue de sources
c1_ent = load('data/cercle1/cercle1_entreprises.csv')
c1_imp = load('data/cercle1/cercle1_implantations_internationales.csv')
c1_par = load('data/cercle1/cercle1_partenaires_defense.csv')
c1_loc = load('data/cercle1/cercle1_partenaires_localisation.csv')
c1_src = load('data/cercle1/cercle1_sources.csv')
c1_pro = load('data/cercle1/cercle1_profils.csv')

c1_ids = {e['entreprise_id']: e['entreprise'] for e in c1_ent}
c1_sids = {s['source_id'] for s in c1_src}
c1_lids = {l['partner_location_id'] for l in c1_loc}

# 7a. rattachement au panel principal (mêmes identifiants, mêmes libellés)
noms_panel = {e['id']: e['entreprise'] for e in ent}
for i, nom in c1_ids.items():
    if i not in noms_panel:
        errors.append(f"cercle1: entreprise_id {i} absent du panel principal")
    elif noms_panel[i] != nom:
        errors.append(f"cercle1: « {nom} » ≠ panel « {noms_panel[i]} » (id {i})")

# 7b. intégrité référentielle
for r in c1_imp:
    if r['entreprise_id'] not in c1_ids:
        errors.append(f"cercle1 implantation {r['site_intl_id']}: entreprise inconnue")
    elif r['entreprise'] != c1_ids[r['entreprise_id']]:
        errors.append(f"cercle1 implantation {r['site_intl_id']}: nom ≠ identifiant")
    for col in ('source_site_id', 'source_coord_id'):
        if r.get(col) and r[col] not in c1_sids:
            errors.append(f"cercle1 implantation {r['site_intl_id']}: {col} absent du catalogue")
for r in c1_par:
    if r['entreprise_id'] not in c1_ids:
        errors.append(f"cercle1 relation {r['relation_id']}: entreprise inconnue")
    b = r.get('partenaire_cercle1_entreprise_id')
    if b and b not in c1_ids:
        errors.append(f"cercle1 relation {r['relation_id']}: partenaire interne inconnu {b}")
    if r.get('source_relation_id') and r['source_relation_id'] not in c1_sids:
        errors.append(f"cercle1 relation {r['relation_id']}: source absente du catalogue")
    if r.get('partenaire_location_id') and r['partenaire_location_id'] not in c1_lids:
        errors.append(f"cercle1 relation {r['relation_id']}: localisation absente")
for e in c1_ent:
    if e.get('source_inclusion_id') and e['source_inclusion_id'] not in c1_sids:
        errors.append(f"cercle1: source d'inclusion absente pour {e['entreprise']}")
for s_ in c1_src:
    if s_.get('entreprise_id') and s_['entreprise_id'] not in c1_ids:
        errors.append(f"cercle1 source {s_['source_id']}: entreprise inconnue")

# 7c. profils : une ligne par entreprise du Cercle 1, vocabulaire contrôlé
MESURABILITE = {'isolable_publie', 'isolable_par_nature', 'partiellement_isolable', 'non_isolable'}
if len(c1_pro) != len(c1_ent):
    errors.append(f"cercle1 profils: {len(c1_pro)} lignes pour {len(c1_ent)} entreprises")
vus = set()
for r in c1_pro:
    if r['entreprise_id'] in vus:
        errors.append(f"cercle1 profils: entreprise_id {r['entreprise_id']} en double")
    vus.add(r['entreprise_id'])
    if r['entreprise_id'] not in c1_ids:
        errors.append(f"cercle1 profils: entreprise_id {r['entreprise_id']} hors Cercle 1")
    if r['mesurabilite_defense'] not in MESURABILITE:
        errors.append(f"cercle1 profils: mesurabilité inconnue « {r['mesurabilite_defense'] }» ({r['entreprise']})")
    if r['mesurabilite_defense'] == 'isolable_publie' and not r['ca_defense_mdeur']:
        errors.append(f"cercle1 profils: {r['entreprise']} déclarée isolable sans chiffre d'affaires défense")
    if r['part_defense_pct'] and not r['part_defense_methode']:
        errors.append(f"cercle1 profils: {r['entreprise']} part défense sans méthode")
    if not r['source_profil_url'].startswith('https://'):
        errors.append(f"cercle1 profils: source non https pour {r['entreprise']}")

# 7d. domaines de valeurs, dates, URL, coordonnées
for nom, lignes, col, dom in (
        ('implantations', c1_imp, 'confiance_information', {'haute', 'moyenne', 'faible'}),
        ('relations', c1_par, 'confiance_information', {'haute', 'moyenne', 'faible'}),
        ('profils', c1_pro, 'confiance_information', {'haute', 'moyenne', 'faible'})):
    hors = {r[col] for r in lignes if r.get(col) and r[col] not in dom}
    if hors: errors.append(f"cercle1 {nom}: {col} hors domaine {sorted(hors)}")
for nom, lignes, col in (('implantations', c1_imp, 'derniere_verification'),
                         ('relations', c1_par, 'derniere_verification'),
                         ('sources', c1_src, 'date_acces'),
                         ('profils', c1_pro, 'derniere_verification')):
    mauvaises = [r[col] for r in lignes if r.get(col) and not re.fullmatch(r'\d{4}-\d{2}(-\d{2})?', r[col])]
    if mauvaises: errors.append(f"cercle1 {nom}: dates mal formées {mauvaises[:3]}")
for nom, lignes, col in (('sources', c1_src, 'url'),
                         ('implantations', c1_imp, 'source_site_url'),
                         ('relations', c1_par, 'source_relation_url')):
    n = sum(1 for r in lignes if r.get(col) and not r[col].startswith('https://'))
    if n: errors.append(f"cercle1 {nom}: {n} URL non https")
for r in c1_imp:
    try:
        lat, lng = float(r['latitude']), float(r['longitude'])
        if not (-60 <= lat <= 75 and -180 <= lng <= 180):
            errors.append(f"cercle1 {r['site_intl_id']}: coordonnées hors plage")
    except ValueError:
        errors.append(f"cercle1 {r['site_intl_id']}: coordonnées non numériques")

# 7e. sources jamais référencées (non bloquant)
utilisees = ({r[c] for r in c1_imp for c in ('source_site_id', 'source_coord_id') if r.get(c)}
             | {r['source_relation_id'] for r in c1_par if r.get('source_relation_id')}
             | {e['source_inclusion_id'] for e in c1_ent if e.get('source_inclusion_id')}
             | {l.get('source_location_id') for l in c1_loc if l.get('source_location_id')})
for o in sorted(c1_sids - utilisees):
    warns.append(f"cercle1: source jamais référencée {o}")

# Bilan
print(f"Contrôle qualité — {len(ent)} entreprises, {len(eta)} établissements, {len(prog)} programmes")
print(f"                   Cercle 1 : {len(c1_ent)} entreprises, {len(c1_imp)} implantations, {len(c1_par)} relations, {len(c1_pro)} profils, {len(c1_src)} sources")
for w in warns: print(f"  [AVERTISSEMENT] {w}")
if errors:
    print(f"\n{len(errors)} ERREUR(S) :")
    for e in errors: print(f"  [ERREUR] {e}")
    sys.exit(1)
print(f"\n✔ Aucun défaut détecté ({len(warns)} avertissement(s) non bloquant(s)).")
