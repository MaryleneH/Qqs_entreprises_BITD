# Panel BITD — méthodologie de sélection

Ces fichiers sont rédigés et maintenus comme source méthodologique du dashboard. Copilot doit les **lire et les afficher**, mais ne doit ni inventer ni réécrire les justifications.

## Placement recommandé

```text
data/panel/
├── panel_selection.csv
├── panel_selection_sources.csv
└── panel_methodologie.csv
```

- `panel_selection.csv` : 30 décisions d'inclusion et justifications individuelles.
- `panel_selection_sources.csv` : preuves documentaires de la sélection.
- `panel_methodologie.csv` : textes officiels de la méthode, titre, tooltip, deux cercles et critères.

Le dashboard doit joindre les sources par `source_selection_id`.
