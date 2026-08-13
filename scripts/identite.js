// =============================================================================
// BITD France — Identité industrielle
// Charge les 4 CSV de la couche identité industrielle, construit des index
// et expose window.BITDIdentite pour le reste du dashboard.
//
// Sources de vérité :
//   data/identite/identite_industrielle.csv
//   data/identite/chaine_valeur_referentiel.csv
//   data/identite/entreprise_capacites.csv
//   data/identite/identite_industrielle_sources.csv
//
// Fail-soft : toute erreur de chargement est silencieuse pour le reste du site.
// =============================================================================
(function () {
  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const state = {
    promise: null,
    loaded: false,
    industrialIdentityByCompanyId: {},  // entreprise_id → row identite_industrielle
    capabilitiesByCompanyId: {},         // entreprise_id → [capacite strings]
    valueChainById: {},                  // CV01…CV08 → row chaine_valeur_referentiel
    sourceById: {},                      // source_id → row identite_industrielle_sources
    allIdentites: [],
    allCapacites: [],
    allChainValues: [],
    allSources: []
  };

  // ---------------------------------------------------------------------------
  // CSV parser — same minimal parser as table.js
  // ---------------------------------------------------------------------------
  function parseCSV(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        if (current.length || row.length) {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.length || row.length) {
      row.push(current);
      rows.push(row);
    }

    const [header, ...body] = rows;
    if (!header) return [];
    const cleanHeader = header.map((h) => h.replace(/^\uFEFF/, '').trim());
    return body.map((cells) => Object.fromEntries(cleanHeader.map((key, idx) => [key, cells[idx] ?? ''])));
  }

  function splitValues(value) {
    return String(value || '')
      .split(/[;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function fetchCSV(path) {
    const url = new URL(path, document.baseURI);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[BITDIdentite] Impossible de charger ${url}`);
    return parseCSV(await res.text());
  }

  // ---------------------------------------------------------------------------
  // Load & build indexes
  // ---------------------------------------------------------------------------
  async function loadAll() {
    if (state.promise) return state.promise;

    state.promise = Promise.all([
      fetchCSV('data/identite/identite_industrielle.csv'),
      fetchCSV('data/identite/chaine_valeur_referentiel.csv'),
      fetchCSV('data/identite/entreprise_capacites.csv'),
      fetchCSV('data/identite/identite_industrielle_sources.csv')
    ]).then(([identites, chainValues, capacites, sources]) => {
      state.allIdentites = identites;
      state.allChainValues = chainValues;
      state.allCapacites = capacites;
      state.allSources = sources;

      // industrialIdentityByCompanyId
      identites.forEach((row) => {
        if (row.afficher_dashboard !== 'true') return;
        const key = String(row.entreprise_id || '').trim();
        if (key) state.industrialIdentityByCompanyId[key] = row;
      });

      // valueChainById — chaine_valeur_id is canonical, row.id kept as fallback
      chainValues.forEach((row) => {
        const id = String(
          row.chaine_valeur_id || row.id || ''
        ).trim();
        if (id) state.valueChainById[id] = row;
      });

      // capabilitiesByCompanyId
      capacites.forEach((row) => {
        const key = String(row.entreprise_id || '').trim();
        if (!key) return;
        if (!state.capabilitiesByCompanyId[key]) state.capabilitiesByCompanyId[key] = [];
        state.capabilitiesByCompanyId[key].push(row.capacite || '');
      });
      // Sort by ordre
      capacites.forEach((row) => {});
      // Actually build sorted arrays
      const tempByKey = {};
      capacites.forEach((row) => {
        const key = String(row.entreprise_id || '').trim();
        if (!key || !row.capacite) return;
        if (!tempByKey[key]) tempByKey[key] = [];
        tempByKey[key].push({ cap: row.capacite, ordre: parseInt(row.ordre_affichage || row.ordre, 10) || 999 });
      });
      Object.entries(tempByKey).forEach(([key, arr]) => {
        arr.sort((a, b) => a.ordre - b.ordre);
        state.capabilitiesByCompanyId[key] = arr.map((item) => item.cap);
      });

      // sourceById
      sources.forEach((row) => {
        if (row.source_id) state.sourceById[row.source_id.trim()] = row;
      });

      state.loaded = true;

      // Data validation checks (console only)
      const uniqueIds = new Set(identites.filter((r) => r.afficher_dashboard === 'true').map((r) => r.entreprise_id));
      const uniqueChainIds = new Set(chainValues.map((r) => String(r.chaine_valeur_id || r.id || '').trim()).filter(Boolean));
      const knownCompanyIds = new Set(identites.map((r) => String(r.entreprise_id || '').trim()));
      const orphanCaps = capacites.filter((r) => !knownCompanyIds.has(String(r.entreprise_id || '').trim()));
      const missingSource = identites.filter((r) => !r.source_industrielle_id);

      console.info('[BITD][IDENTITE_DATA_CHECK]', {
        entreprises_identite: uniqueIds.size,
        attendu: 30,
        ok_30: uniqueIds.size === 30,
        categories_chaine_valeur: uniqueChainIds.size,
        attendu_8: uniqueChainIds.size === 8,
        ok_8: uniqueChainIds.size === 8,
        capacites_total: capacites.length,
        capacites_orphelines: orphanCaps.length,
        entreprises_sans_source: missingSource.length
      });
    }).catch((err) => {
      console.warn('[BITDIdentite] Chargement identité industrielle échoué (fail-soft) :', err);
      state.loaded = false;
    });

    return state.promise;
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------
  function getIdentite(companyId) {
    return state.industrialIdentityByCompanyId[String(companyId)] || null;
  }

  function getCapabilities(companyId) {
    return state.capabilitiesByCompanyId[String(companyId)] || [];
  }

  function getChainValue(cvId) {
    return state.valueChainById[cvId] || null;
  }

  function getSource(sourceId) {
    return state.sourceById[sourceId] || null;
  }

  function getChainValueLabel(cvId) {
    const cv = getChainValue(cvId);
    return cv ? cv.libelle : cvId;
  }

  function getPrimaryChainValue(companyId) {
    const identite = getIdentite(companyId);
    if (!identite) return null;
    return getChainValue(identite.chaine_valeur_principale_id);
  }

  function getSecondaryChainValues(companyId) {
    const identite = getIdentite(companyId);
    if (!identite) return [];
    return splitValues(identite.chaine_valeur_secondaire_ids)
      .map((id) => getChainValue(id))
      .filter(Boolean);
  }

  function getAllChainValues() {
    return state.allChainValues;
  }

  // ---------------------------------------------------------------------------
  // Search index contribution
  // ---------------------------------------------------------------------------
  function buildSearchIndexContribution(companyId) {
    const id = String(companyId);
    const identite = getIdentite(id);
    const caps = getCapabilities(id);
    const parts = [];
    if (identite) {
      parts.push(identite.secteur_principal || '');
      parts.push(identite.specialite || '');
      parts.push(identite.positionnement_industriel || '');
      const primaryCV = getPrimaryChainValue(id);
      if (primaryCV) parts.push(primaryCV.libelle);
      getSecondaryChainValues(id).forEach((cv) => parts.push(cv.libelle));
    }
    caps.forEach((cap) => parts.push(cap));
    return parts.filter(Boolean).join(' ');
  }

  // ---------------------------------------------------------------------------
  // Methodology page: render CV grid
  // ---------------------------------------------------------------------------
  function getChainValueId(cv) {
    return String(
      cv?.chaine_valeur_id || cv?.id || ''
    ).trim();
  }

  function renderMethodologieCVGrid() {
    const grid = document.getElementById('cv-methodo-grid');
    if (!grid) return;
    const cvs = getAllChainValues();
    if (!cvs.length) {
      grid.innerHTML = '<p style="color:var(--text-secondary);font-size:0.82rem">Référentiel non disponible.</p>';
      return;
    }
    grid.innerHTML = cvs.map((cv) => `
      <div class="cv-referentiel-card">
        <span class="cv-referentiel-code">${escHtml(getChainValueId(cv))}</span>
        <p class="cv-referentiel-libelle">${escHtml(cv.libelle)}</p>
        <p class="cv-referentiel-definition">${escHtml(cv.definition || '')}</p>
        ${cv.exemples ? `<p class="cv-referentiel-exemples">Ex.&nbsp;: ${escHtml(cv.exemples)}</p>` : ''}
      </div>
    `).join('');
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.BITDIdentite = {
    loadAll,
    getIdentite,
    getCapabilities,
    getChainValue,
    getChainValueLabel,
    getSource,
    getPrimaryChainValue,
    getSecondaryChainValues,
    getAllChainValues,
    buildSearchIndexContribution,
    renderMethodologieCVGrid,
    getState: () => state
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadAll().then(() => {
      renderMethodologieCVGrid();
    }).catch(() => {});
  });
})();
