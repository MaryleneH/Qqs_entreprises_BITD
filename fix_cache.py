import sys, re

VERSION = "20260813b"   # incrémenter à chaque livraison qui touche scripts/ ou styles/

def remplacer(s, old, new, attendu=1):
    n = s.count(old)
    if n == 0 and new in s: return s
    if n != attendu:
        print(f"ERREUR: ancre trouvée {n} fois (attendu {attendu}): {old[:70]!r}"); sys.exit(1)
    return s.replace(old, new)

# --- _quarto.yml : les 11 scripts locaux ---
y = open("_quarto.yml", encoding="utf-8").read()
if 'scripts/glossary.js?v=' in y:
    print("déjà versionné : mise à jour du jeton")
    y = re.sub(r'(scripts/[a-z-]+\.js)\?v=[0-9a-z]+', rf'\1?v={VERSION}', y)
else:
    n = len(re.findall(r'src="scripts/[a-z-]+\.js"', y))
    if n != 11:
        print(f"ERREUR: {n} balises script trouvées (attendu 11)"); sys.exit(1)
    y = re.sub(r'src="(scripts/[a-z-]+\.js)"', rf'src="\1?v={VERSION}"', y)
open("_quarto.yml", "w", encoding="utf-8", newline="").write(y)

# --- index.qmd : la feuille de style de l'accueil ---
i = open("index.qmd", encoding="utf-8").read()
if "css: styles/home.css?v=" in i:
    i = re.sub(r'(css: styles/home\.css)\?v=[0-9a-z]+', rf'\1?v={VERSION}', i)
else:
    i = remplacer(i, "css: styles/home.css", f"css: styles/home.css?v={VERSION}")
open("index.qmd", "w", encoding="utf-8", newline="").write(i)
print("OK — version", VERSION)
