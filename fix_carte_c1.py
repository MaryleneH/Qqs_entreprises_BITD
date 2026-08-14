import sys

def remplacer(chemin, old, new, libelle, marqueur=None):
    s = open(chemin, encoding="utf-8").read()
    if marqueur is not None and marqueur in s:
        print("  = " + libelle + " : deja applique")
        return
    if new in s and old not in s:
        print("  = " + libelle + " : deja applique")
        return
    if s.count(old) != 1:
        print("ERREUR: " + libelle + " - ancre trouvee " + str(s.count(old)) + " fois dans " + chemin)
        sys.exit(1)
    open(chemin, "w", encoding="utf-8", newline="").write(s.replace(old, new))
    print("  + " + libelle)

LF = chr(10)

# 1. supprimer la double inclusion de Leaflet
remplacer("cercle1-international.qmd",
  '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">' + LF
  + '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>' + LF,
  "<!-- Leaflet est charge globalement par _quarto.yml (include-in-header) : ne pas le recharger ici. -->" + LF,
  "doublon Leaflet supprime")

# 2. hauteur de secours en ligne sur le conteneur de carte
remplacer("cercle1-international.qmd",
  '<div id="c1x-map" aria-label=',
  '<div id="c1x-map" style="min-height:620px" aria-label=',
  "hauteur de secours")

# 3. jeton de cache
remplacer("cercle1-international.qmd", "v=20260814c", "v=20260814d", "jeton de cache")

# 4. message explicite si Leaflet est absent
Q = chr(39)
ancien_js = "  function buildMap() {" + LF + "    if (!window.L) return;"
nouveau_js = (
  "  function buildMap() {" + LF
  + "    if (!window.L) {" + LF
  + "      const el = document.getElementById(" + Q + "c1x-map" + Q + ");" + LF
  + "      if (el) el.innerHTML = " + Q + '<p class="c1x-mapfail">La bibliothèque cartographique (Leaflet) n' + Q
  + " + " + chr(34) + Q + chr(34) + " + " + Q + "a pas pu être chargée : " + Q + " +" + LF
  + "        " + Q + "la carte ne peut pas s" + Q + " + " + chr(34) + Q + chr(34) + " + " + Q + "afficher. "
  + "Les implantations restent consultables dans le panneau ci-contre. " + Q + " +" + LF
  + "        " + Q + "Si le problème persiste, le réseau bloque peut-être unpkg.com.</p>" + Q + ";" + LF
  + "      return;" + LF
  + "    }"
)
remplacer("scripts/cercle1-international.js", ancien_js, nouveau_js, "message d'echec cartographique")

# 5. style du message
remplacer("styles/cercle1.css",
  "#c1x-map { height: 620px;",
  ".c1x-mapfail { font-size: .82rem; color: #A03B3B; background: #FDEEEE; border: 1px solid #EBC6C6;" + LF
  + "  border-radius: 8px; padding: .9rem 1.1rem; margin: 1rem; line-height: 1.5; }" + LF
  + "#c1x-map { height: 620px;",
  "style du message", marqueur="c1x-mapfail")

# 6. verifications
v = open("cercle1-international.qmd", encoding="utf-8").read()
n = v.count("leaflet@1.9.4/dist/leaflet.js")
if n != 0:
    print("ERREUR: " + str(n) + " inclusion(s) Leaflet subsistent dans la page"); sys.exit(1)
if "min-height:620px" not in v or "v=20260814d" not in v:
    print("ERREUR: secours ou jeton absent"); sys.exit(1)
j = open("scripts/cercle1-international.js", encoding="utf-8").read()
if "c1x-mapfail" not in j:
    print("ERREUR: message d'echec absent du script"); sys.exit(1)
if "c1x-mapfail" not in open("styles/cercle1.css", encoding="utf-8").read():
    print("ERREUR: style du message absent"); sys.exit(1)
print("OK - correctif carte applique")
