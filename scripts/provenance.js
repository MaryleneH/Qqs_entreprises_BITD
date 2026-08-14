// =============================================================================
// BITD France — Provenance module
// Charge les 3 CSV de traçabilité, construit des index en mémoire,
// et expose window.BITDProvenance pour le reste du dashboard.
// =============================================================================
(function () {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const state = {
    promise: null,
    sourcesById: {},       // source_id → row
    companyIndex: {},      // "entreprise_id|champ" → [rows]
    siteIndex: {},         // "site_id|champ" → [rows]
    allSources: [],
    allCompanyProv: [],
    allSiteProv: [],
    panelEl: null
  };

  // ---------------------------------------------------------------------------
  // CSV parser (minimal, same logic as dashboard.js)
  // ---------------------------------------------------------------------------
  function parseCSV(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;
    // Séparateur déduit de la ligne d'en-tête : le dépôt mêle des CSV à virgule
    // (panel, provenance) et à point-virgule (Cercle 1, programmes).
    const entete = text.split(/\r?\n/)[0] || '';
    const sep = (entete.split(';').length > entete.split(',').length) ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === sep && !inQuotes) {
        row.push(current); current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++;
        if (current.length || row.length) { row.push(current); rows.push(row); row = []; current = ''; }
      } else { current += char; }
    }
    if (current.length || row.length) { row.push(current); rows.push(row); }
    const [header, ...body] = rows;
    if (!header) return [];
    return body.map((cells) => Object.fromEntries(header.map((k, i) => [k.replace(/^\uFEFF/, ''), cells[i] ?? ''])));
  }

  // ---------------------------------------------------------------------------
  // Fédération du catalogue Cercle 1
  // ---------------------------------------------------------------------------
  // Les deux catalogues n'ont ni le même schéma ni le même vocabulaire de niveau
  // de source (grille A1/A2/B2 d'un côté, « primaire »/« méthode » de l'autre).
  // On projette le second sur le schéma du premier SANS traduire les valeurs :
  // le champ `catalogue` permet de les distinguer à l'affichage.
  function normaliserCercle1(sources, companies) {
    if (!Array.isArray(sources) || !sources.length) return [];
    const noms = {};
    (companies || []).forEach((c) => { if (c.entreprise_id) noms[c.entreprise_id] = c.entreprise; });
    const CATEGORIES = {
      constitution_panel: 'constitution du panel',
      implantations: 'implantations internationales',
      relation_industrielle: 'relation industrielle',
      implantations_relation: 'implantations et relations',
      localisation_partenaire: 'localisation de partenaire',
      methodologie: 'méthodologie'
    };
    return sources.map((s) => ({
      source_id: s.source_id,
      entreprise: noms[s.entreprise_id] || '',
      niveau_source: s.niveau_source || '',
      type_source: s.type_source || '',
      libelle: s.titre || s.source_id,
      url: s.url || '',
      usage_principal: CATEGORIES[s.categorie] || (s.categorie || '').replace(/_/g, ' '),
      date_consultation: s.date_acces || '',
      commentaire: [s.objet, s.perimetre, s.notes].filter(Boolean).join(' — '),
      organisme: s.organisme || '',
      catalogue: 'Cercle 1'
    }));
  }

  function fetchCSV(relativePath) {
    const url = new URL(relativePath, document.baseURI);
    return fetch(url).then((r) => { if (!r.ok) throw new Error(`CSV ${relativePath} indisponible`); return r.text(); }).then(parseCSV);
  }

  // ---------------------------------------------------------------------------
  // Load & index
  // ---------------------------------------------------------------------------
  function load() {
    if (state.promise) return state.promise;
    state.promise = Promise.all([
      fetchCSV('data/provenance/catalogue_sources.csv'),
      fetchCSV('data/provenance/provenance_entreprises.csv'),
      fetchCSV('data/provenance/provenance_etablissements.csv'),
      // Catalogue Cercle 1 : fédéré au catalogue principal, sans réécriture de ses valeurs.
      fetchCSV('data/cercle1/cercle1_sources.csv').catch(() => []),
      fetchCSV('data/cercle1/cercle1_entreprises.csv').catch(() => [])
    ]).then(([sources, companyProv, siteProv, c1Sources, c1Companies]) => {
      state.allSources = sources.concat(normaliserCercle1(c1Sources, c1Companies));
      state.allCompanyProv = companyProv;
      state.allSiteProv = siteProv;

      sources.forEach((s) => { if (s.source_id) state.sourcesById[s.source_id] = s; });

      companyProv.forEach((r) => {
        const key = `${r.entreprise_id}|${r.champ}`;
        if (!state.companyIndex[key]) state.companyIndex[key] = [];
        state.companyIndex[key].push(r);
      });

      siteProv.forEach((r) => {
        const key = `${r.site_id}|${r.champ}`;
        if (!state.siteIndex[key]) state.siteIndex[key] = [];
        state.siteIndex[key].push(r);

        const allKey = `${r.site_id}|__all__`;
        if (!state.siteIndex[allKey]) state.siteIndex[allKey] = [];
        state.siteIndex[allKey].push(r);
      });
    }).catch((err) => {
      console.warn('BITDProvenance: chargement impossible', err);
    });
    return state.promise;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------
  function getSource(sourceId) { return state.sourcesById[sourceId] || null; }
  function getAllSources() { return state.allSources; }

  function getCompanyFieldProvenance(entrepriseId, champ) {
    return state.companyIndex[`${entrepriseId}|${champ}`] || [];
  }

  function getSiteFieldProvenance(siteId, champ) {
    return state.siteIndex[`${siteId}|${champ}`] || [];
  }

  function getAllSiteProvenance(siteId) {
    return state.siteIndex[`${siteId}|__all__`] || [];
  }

  // Return all sources matching an optional filter {entreprise, type}
  function filterSources(filter) {
    return state.allSources.filter((s) => {
      if (filter.entreprise && filter.entreprise !== 'all' && s.entreprise !== filter.entreprise) return false;
      if (filter.type && filter.type !== 'all' && s.type_source !== filter.type) return false;
      return true;
    });
  }

  // Return all unique entreprise names with at least one source
  function getSourceEntreprises() {
    const seen = new Set();
    return state.allSources.filter((s) => s.entreprise && !seen.has(s.entreprise) && seen.add(s.entreprise)).map((s) => s.entreprise);
  }

  // Return sources for one company by usage_principal type
  function getSourcesForEntreprise(entrepriseName) {
    return state.allSources.filter((s) => s.entreprise === entrepriseName);
  }

  // ---------------------------------------------------------------------------
  // HTML helpers
  // ---------------------------------------------------------------------------
  function escapeHtml(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function modeLabel(mode) {
    const map = {
      publie: 'Publié',
      publie_corporate_ou_synthese: 'Publié',
      publie_ou_calcule_selon_publication: 'Publié / Calculé',
      calcule: 'Calculé',
      synthese_documentaire: 'Synthèse documentaire',
      proxy: 'Proxy',
      geocode: 'Géocodé',
      georeference: 'Géocodé',
      rapproche: 'Rapproché',
      qualifie: 'Qualifié',
      metadonnee_perimetre: 'Métadonnée périmètre'
    };
    const key = (mode || '').toLowerCase().trim().replace(/ /g, '_').replace(/[éè]/g, 'e').replace(/â/g, 'a');
    return map[key] || mode || '—';
  }

  function modeBadgeClass(mode) {
    const key = (mode || '').toLowerCase();
    if (key.includes('calcule') || key.includes('calculé')) return 'mode-badge--calcule';
    if (key.includes('publie') || key.includes('publié')) return 'mode-badge--publie';
    if (key.includes('proxy')) return 'mode-badge--proxy';
    if (key.includes('geocode') || key.includes('georeference')) return 'mode-badge--geocode';
    return 'mode-badge--autre';
  }

  function statut_warn(statut) {
    if (!statut) return '';
    const s = statut.toLowerCase();
    if (s.includes('revalider') || s.includes('actualiser')) return 'revalidation';
    return '';
  }

  function buildSourceLink(prov) {
    const src = prov.source_id ? getSource(prov.source_id) : null;
    const url = (src && src.url) || prov.source_url || prov.source_verification_url || '';
    const label = (src && src.libelle) || 'Voir la source originale';
    if (!url) return `<span class="prov-no-source">Source détaillée non documentée</span>`;
    if (statut_warn(prov.statut_audit)) {
      return `<span class="prov-revalidation">Source en cours de revalidation</span>`;
    }
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="prov-source-link">${escapeHtml(label)} <svg class="ext-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1h7.5v7.5M11 1 4 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg></a>`;
  }

  // ---------------------------------------------------------------------------
  // Provenance panel (modal / bottom-sheet)
  // ---------------------------------------------------------------------------
  function ensurePanel() {
    if (state.panelEl) return state.panelEl;

    const overlay = document.createElement('div');
    overlay.id = 'prov-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'prov-title');
    overlay.innerHTML = `
      <div id="prov-panel">
        <button type="button" id="prov-close" aria-label="Fermer la fiche de provenance">×</button>
        <div id="prov-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    state.panelEl = overlay;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
    overlay.querySelector('#prov-close').addEventListener('click', closePanel);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closePanel();
    });

    return overlay;
  }

  function closePanel() {
    const el = state.panelEl;
    if (el) el.classList.remove('is-open');
  }

  function openCompanyFieldPanel(entrepriseId, entrepriseName, champ, displayLabel, displayValue) {
    load().then(() => {
      const records = getCompanyFieldProvenance(entrepriseId, champ);
      const el = ensurePanel();
      const content = el.querySelector('#prov-content');
      content.innerHTML = buildCompanyFieldHtml(records, entrepriseName, champ, displayLabel, displayValue);
      el.classList.add('is-open');
      el.querySelector('#prov-close').focus();
    });
  }

  function openSitePanel(siteId, siteName) {
    load().then(() => {
      const records = getAllSiteProvenance(siteId);
      const el = ensurePanel();
      const content = el.querySelector('#prov-content');
      content.innerHTML = buildSiteHtml(records, siteName);
      el.classList.add('is-open');
      el.querySelector('#prov-close').focus();
    });
  }

  // ---------------------------------------------------------------------------
  // HTML builders for panel content
  // ---------------------------------------------------------------------------
  function buildCompanyFieldHtml(records, entrepriseName, champ, displayLabel, displayValue) {
    if (!records || records.length === 0) {
      return `<h2 id="prov-title" class="prov-title">${escapeHtml(displayLabel || champ)}</h2>
        <p class="prov-company">${escapeHtml(entrepriseName)}</p>
        <p class="prov-no-source">Aucune provenance documentée pour cet indicateur.</p>`;
    }

    const r = records[0];
    const warn = statut_warn(r.statut_audit);
    const modeLbl = modeLabel(r.mode_obtention);
    const badgeCls = modeBadgeClass(r.mode_obtention);

    let formulaBlock = '';
    if (r.formule && r.formule.trim()) {
      formulaBlock = `<div class="prov-row"><span class="prov-label">Formule</span><code class="prov-formula">${escapeHtml(r.formule)}</code></div>`;
    }

    let commentBlock = '';
    if (r.commentaire_audit && r.commentaire_audit.trim()) {
      commentBlock = `<p class="prov-comment">${escapeHtml(r.commentaire_audit)}</p>`;
    }

    const warnBlock = warn === 'revalidation'
      ? `<div class="prov-warn">⚠ Source en cours de revalidation</div>`
      : '';

    return `
      <h2 id="prov-title" class="prov-title">${escapeHtml(displayLabel || champ)}</h2>
      <p class="prov-company">${escapeHtml(entrepriseName)}</p>
      ${displayValue ? `<div class="prov-value">${escapeHtml(displayValue)}</div>` : ''}
      <span class="mode-badge ${badgeCls}">${escapeHtml(modeLbl)}</span>
      ${warnBlock}
      <div class="prov-details">
        ${r.periode ? `<div class="prov-row"><span class="prov-label">Période</span><span>${escapeHtml(r.periode)}</span></div>` : ''}
        ${r.perimetre ? `<div class="prov-row"><span class="prov-label">Périmètre</span><span>${escapeHtml(r.perimetre)}</span></div>` : ''}
        ${formulaBlock}
      </div>
      ${commentBlock}
      <div class="prov-source-block">
        <span class="prov-label">Source</span>
        ${buildSourceLink(r)}
      </div>
    `;
  }

  function buildSiteHtml(records, siteName) {
    if (!records || records.length === 0) {
      return `<h2 id="prov-title" class="prov-title">${escapeHtml(siteName || 'Établissement')}</h2>
        <p class="prov-no-source">Aucune provenance documentée pour cet établissement.</p>`;
    }

    // Group by champ
    const groups = {};
    const champOrder = [];
    records.forEach((r) => {
      if (!groups[r.champ]) { groups[r.champ] = []; champOrder.push(r.champ); }
      groups[r.champ].push(r);
    });

    const fieldLabels = {
      nom_site: 'Nom du site',
      type_site: 'Type de site',
      est_siege: 'Siège',
      entite: 'Entité juridique',
      ville: 'Ville',
      region: 'Région',
      departement: 'Département',
      activite: 'Activité',
      statut_validation: 'Statut',
      siret: 'SIRET',
      statut_sirene: 'État administratif',
      etat_administratif: 'État administratif',
      latitude: 'Latitude',
      longitude: 'Longitude',
      precision_coordonnees: 'Précision coordonnées',
      programmes_associes: 'Programmes associés',
      effectif_site_label: 'Effectif du site',
      source_etablissement: 'Source établissement',
      source_implantation: 'Source implantation'
    };

    // Only show a selection of meaningful fields
    const importantFields = ['nom_site', 'activite', 'type_site', 'siret', 'statut_sirene', 'etat_administratif', 'statut_validation', 'precision_coordonnees', 'latitude', 'longitude', 'programmes_associes', 'effectif_site_label', 'source_etablissement'];
    const orderedFields = [...importantFields, ...champOrder.filter((c) => !importantFields.includes(c))].filter((c) => groups[c]);

    const rowsHtml = orderedFields.map((champ) => {
      const r = groups[champ][0];
      const warn = statut_warn(r.statut_audit);
      const modeLbl = modeLabel(r.mode_obtention);
      const badgeCls = modeBadgeClass(r.mode_obtention);
      const label = fieldLabels[champ] || champ;
      const warnBadge = warn === 'revalidation' ? '<span class="prov-warn-inline">en cours de revalidation</span>' : '';
      return `
        <div class="prov-site-field">
          <div class="prov-site-field__header">
            <strong>${escapeHtml(label)}</strong>
            <span class="mode-badge mode-badge--sm ${badgeCls}">${escapeHtml(modeLbl)}</span>
            ${warnBadge}
          </div>
          <div class="prov-site-field__source">${buildSourceLink(r)}</div>
        </div>`;
    }).join('');

    return `
      <h2 id="prov-title" class="prov-title">Sources — ${escapeHtml(siteName || 'Établissement')}</h2>
      <div class="prov-site-fields">${rowsHtml}</div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Source button factory
  // ---------------------------------------------------------------------------
  function sourceButton(opts) {
    // opts: { entrepriseId, entrepriseName, champ, label, value, ariaLabel }
    const ariaLabel = opts.ariaLabel || `Voir la source de l'indicateur ${opts.label} pour ${opts.entrepriseName || ''}`;
    return `<button type="button" class="source-btn" data-prov-company="${escapeHtml(String(opts.entrepriseId))}" data-prov-champ="${escapeHtml(opts.champ)}" data-prov-label="${escapeHtml(opts.label)}" data-prov-value="${escapeHtml(opts.value || '')}" data-prov-name="${escapeHtml(opts.entrepriseName || '')}" aria-label="${escapeHtml(ariaLabel)}">Source <svg class="ext-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1h7.5v7.5M11 1 4 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg></button>`;
  }

  function siteSourceButton(siteId, siteName) {
    return `<button type="button" class="source-btn source-btn--site" data-prov-site="${escapeHtml(siteId)}" data-prov-site-name="${escapeHtml(siteName || '')}" aria-label="Voir les sources de cet établissement">Sources</button>`;
  }

  // ---------------------------------------------------------------------------
  // Global click delegation for source buttons
  // ---------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.source-btn');
    if (!btn) return;
    e.stopPropagation();

    const siteId = btn.dataset.provSite;
    if (siteId) {
      openSitePanel(siteId, btn.dataset.provSiteName || siteId);
      return;
    }

    const entrepriseId = btn.dataset.provCompany;
    const champ = btn.dataset.provChamp;
    const label = btn.dataset.provLabel;
    const value = btn.dataset.provValue;
    const name = btn.dataset.provName;
    if (entrepriseId && champ) {
      openCompanyFieldPanel(entrepriseId, name, champ, label, value);
    }
  });

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.BITDProvenance = {
    load,
    getSource,
    getAllSources,
    filterSources,
    getSourceEntreprises,
    getSourcesForEntreprise,
    getCompanyFieldProvenance,
    getSiteFieldProvenance,
    getAllSiteProvenance,
    sourceButton,
    siteSourceButton,
    openCompanyFieldPanel,
    openSitePanel,
    closePanel,
    escapeHtml
  };

  // Pre-load on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => { load(); });
})();
