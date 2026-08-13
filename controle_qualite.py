#!/usr/bin/env python3
"""Contrôle qualité des données du dashboard BITD — lecture seule, aucun fichier modifié.
Rejoue les contrôles internes de l'audit du 13/08/2026. Code de sortie 0 si tout est vert.
Usage : python3 controle_qualite.py   (à la racine du dépôt)
"""
import csv, io, re, sys
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

# Bilan
print(f"Contrôle qualité — {len(ent)} entreprises, {len(eta)} établissements, {len(prog)} programmes")
for w in warns: print(f"  [AVERTISSEMENT] {w}")
if errors:
    print(f"\n{len(errors)} ERREUR(S) :")
    for e in errors: print(f"  [ERREUR] {e}")
    sys.exit(1)
print(f"\n✔ Aucun défaut détecté ({len(warns)} avertissement(s) non bloquant(s)).")
