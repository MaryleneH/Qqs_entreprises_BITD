(function () {
  const sectorColors = {
    'aéronautique': '#4A90D9',
    'naval': '#2C6E8A',
    'terrestre': '#6B8E5E',
    'missiles/munitions': '#C0392B',
    'électronique/capteurs': '#8E44AD',
    'spatial': '#1A6B6B',
    'matériaux/équipements': '#C47D0E',
    'services/MCO': '#5F7F82'
  };

  const state = {
    dataPromise: null,
    etablissementsPromise: null,
    allRows: [],
    filteredRows: [],
    allEtablissements: [],
    selectedCompany: null,
    mapMode: 'national', // 'national' | 'focus'
    filters: { search: '', sector: 'all', risk: 'all', criticality: 'all', region: 'all' },
    consumers: []
  };

  function normalizeText(value) {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

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
    return body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));
  }

  function numberOrNull(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed === 'n.c.') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  function formatMillions(value) {
    if (value == null) return 'n.c.';
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)} Md€`;
    return `${(value / 1e6).toFixed(0)} M€`;
  }

  function formatInteger(value) {
    if (value == null) return 'n.c.';
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  function riskScore(value) {
    const mapping = {
      'FAIBLE': 1,
      'FAIBLE À MODÉRÉ': 1.5,
      'MODÉRÉ': 2,
      'MODÉRÉ À SIGNIFICATIF': 2.5,
      'SIGNIFICATIF': 3,
      'SIGNIFICATIF À ÉLEVÉ': 3.5,
      'ÉLEVÉ': 4
    };
    return mapping[value] ?? null;
  }

  function sovereigntyScore(value) {
    const mapping = {
      'IMPORTANTE': 1,
      'IMPORTANTE À TRÈS ÉLEVÉE': 1.5,
      'TRÈS ÉLEVÉE': 2,
      'CRITIQUE': 3
    };
    return mapping[value] ?? null;
  }

  function badgeClass(value) {
    return `badge--${String(value).replace(/\s+/g, '_')}`;
  }

  function makeBadge(value, extra = '') {
    return `<span class="badge ${badgeClass(value)} ${extra}">${value}</span>`;
  }

  function makeSectorBadge(value) {
    const color = sectorColors[value] || '#5F7F82';
    return `<span class="badge badge--sector" style="background:${color}">${value}</span>`;
  }

  function splitValues(value) {
    return (value || '').split(';').map((item) => item.trim()).filter(Boolean);
  }

  function hydrateRow(row) {
    const sectors = splitValues(row.secteurs);
    return {
      ...row,
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      effectif_num: numberOrNull(row.effectif),
      ca_defense_num: numberOrNull(row.ca_defense),
      carnet_num: numberOrNull(row.carnet_commandes),
      ratio_carnet_ca_num: numberOrNull(row.ratio_carnet_ca),
      book_to_bill_num: numberOrNull(row.book_to_bill),
      marge_num: numberOrNull(row.marge),
      sectors,
      primarySector: sectors[0] || 'services/MCO',
      searchIndex: normalizeText([
        row.entreprise,
        row.categorie,
        row.specialite,
        row.secteurs,
        row.siege_ville,
        row.siege_region,
        row.programmes,
        row.sites_industriels,
        row.actionnariat,
        row.dependances_critiques,
        row.point_vigilance
      ].join(' '))
    };
  }

  function hydrateEtablissement(row) {
    return {
      ...row,
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      est_siege: row.est_siege === 'true',
      specialites: splitValues(row.specialites),
      programmes: splitValues(row.programmes_associes)
    };
  }

  function getEtablissementsForCompany(companyId) {
    return state.allEtablissements.filter((e) => e.entreprise_id === companyId);
  }

  function applyFilters() {
    const { search, sector, risk, criticality, region } = state.filters;
    state.filteredRows = state.allRows.filter((row) => {
      const matchesSearch = !search || row.searchIndex.includes(normalizeText(search));
      const matchesSector = sector === 'all' || row.sectors.includes(sector);
      const matchesRisk = risk === 'all' || row.risque_fournisseur === risk;
      const matchesCriticality = criticality === 'all' || row.criticite_souveraine === criticality;
      // Filter by region of any établissement, not just siege
      let matchesRegion = region === 'all';
      if (!matchesRegion) {
        matchesRegion = row.siege_region === region;
        if (!matchesRegion) {
          const etabs = getEtablissementsForCompany(row.id);
          matchesRegion = etabs.some((e) => e.region === region);
        }
      }
      return matchesSearch && matchesSector && matchesRisk && matchesCriticality && matchesRegion;
    });

    updateKpis(state.filteredRows, state.allRows);
    updateAnalysis(state.filteredRows, state.filters);
    state.consumers.forEach((consumer) => consumer(state.filteredRows, state));
    document.dispatchEvent(new CustomEvent('bitd:data-updated', { detail: { rows: state.filteredRows, state } }));
  }

  function accumulateCounts(rows, getter) {
    return rows.reduce((acc, row) => {
      const key = getter(row);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function topEntries(counts, limit = 5) {
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  function renderCountList(containerId, entries, formatter) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = entries.length
      ? entries.map(([label, count]) => formatter(label, count)).join('')
      : '<p class="small-note">Aucun résultat pour la sélection.</p>';
  }

  function updateKpis(rows, allRows) {
    const totalEl = document.getElementById('kpi-total');
    if (!totalEl) return;

    const critical = rows.filter((row) => row.criticite_souveraine === 'CRITIQUE').length;
    const risky = rows.filter((row) => (riskScore(row.risque_fournisseur) || 0) >= 3).length;
    const caKnown = rows.filter((row) => row.ca_defense_num != null);
    const revenueSum = caKnown.reduce((sum, row) => sum + row.ca_defense_num, 0);
    const bookRows = rows.filter((row) => row.book_to_bill_num != null);
    const bookAverage = bookRows.length ? (bookRows.reduce((sum, row) => sum + row.book_to_bill_num, 0) / bookRows.length) : null;

    totalEl.textContent = String(rows.length);
    document.getElementById('kpi-total-note').textContent = `${rows.length} sur ${allRows.length} entreprises visibles`;
    document.getElementById('kpi-critical').textContent = String(critical);
    document.getElementById('kpi-revenue').textContent = formatMillions(revenueSum);
    document.getElementById('kpi-revenue-note').textContent = `${caKnown.length} entreprises avec CA renseigné`;
    document.getElementById('kpi-risky').textContent = String(risky);
    document.getElementById('kpi-book').textContent = bookAverage == null ? 'n.c.' : `${bookAverage.toFixed(2)}x`;
    document.getElementById('kpi-book-note').textContent = `${bookRows.length} ratios publiés`;
  }

  function updateAnalysis(rows, filters) {
    const summary = document.getElementById('analysis-summary');
    if (!summary) return;

    const critical = rows.filter((row) => row.criticite_souveraine === 'CRITIQUE').length;
    const severe = rows.filter((row) => (riskScore(row.risque_fournisseur) || 0) >= 3).length;
    summary.innerHTML = `<strong>${rows.length}</strong> entreprises affichées, dont <strong>${critical}</strong> en criticité critique et <strong>${severe}</strong> en risque fournisseur au moins significatif.`;

    const sectorCounts = {};
    rows.forEach((row) => row.sectors.forEach((sector) => {
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    }));
    renderCountList('analysis-sectors', topEntries(sectorCounts, 6), (label, count) => `<div class="row"><span>${makeSectorBadge(label)}</span><strong>${count}</strong></div>`);

    const riskCounts = accumulateCounts(rows, (row) => row.risque_fournisseur);
    renderCountList('analysis-risks', topEntries(riskCounts, 6), (label, count) => `<div class="row"><span>${makeBadge(label)}</span><strong>${count}</strong></div>`);

    const programCounts = {};
    rows.forEach((row) => splitValues(row.programmes).forEach((program) => {
      programCounts[program] = (programCounts[program] || 0) + 1;
    }));
    renderCountList('analysis-programs', topEntries(programCounts, 6), (label, count) => `<div class="row"><span>${label}</span><strong>${count}</strong></div>`);

    const activeFilters = document.getElementById('analysis-filters');
    if (activeFilters) {
      const chips = [];
      if (filters.search) chips.push(`<span class="chip">Recherche · ${filters.search}</span>`);
      if (filters.sector !== 'all') chips.push(`<span class="chip">Secteur · ${filters.sector}</span>`);
      if (filters.risk !== 'all') chips.push(`<span class="chip">Risque · ${filters.risk}</span>`);
      if (filters.criticality !== 'all') chips.push(`<span class="chip">Criticité · ${filters.criticality}</span>`);
      if (filters.region !== 'all') chips.push(`<span class="chip">Région d'implantation · ${filters.region}</span>`);
      activeFilters.innerHTML = chips.length ? chips.join('') : '<span class="chip">Aucun filtre actif</span>';
    }
  }

  async function loadEtablissements() {
    if (!state.etablissementsPromise) {
      const url = new URL('data/etablissements.csv', document.baseURI);
      state.etablissementsPromise = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Impossible de charger ${url}`);
          return r.text();
        })
        .then((text) => parseCSV(text).map(hydrateEtablissement))
        .then((rows) => {
          state.allEtablissements = rows;
          return rows;
        })
        .catch((err) => {
          console.warn('etablissements.csv non disponible:', err.message);
          return [];
        });
    }
    return state.etablissementsPromise;
  }

  async function loadEntreprises() {
    if (!state.dataPromise) {
      const url = new URL('data/entreprises.csv', document.baseURI);
      state.dataPromise = Promise.all([
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(`Impossible de charger ${url}`);
          return r.text();
        }).then((text) => parseCSV(text).map(hydrateRow)),
        loadEtablissements()
      ]).then(([rows]) => {
        state.allRows = rows;
        state.filteredRows = rows.slice();
        applyFilters();
        document.dispatchEvent(new CustomEvent('bitd:data-ready', { detail: { rows, state } }));
        return rows;
      }).catch((error) => {
        console.error(error);
        document.querySelectorAll('#kpi-grid .kpi-value').forEach((el) => {
          el.textContent = 'Erreur';
        });
        throw error;
      });
    }
    return state.dataPromise;
  }

  function registerConsumer(consumer) {
    state.consumers.push(consumer);
    if (state.filteredRows.length) consumer(state.filteredRows, state);
  }

  function setFilters(nextFilters) {
    state.filters = { ...state.filters, ...nextFilters };
    applyFilters();
  }

  function selectCompany(companyId) {
    const company = state.allRows.find((r) => r.id === companyId);
    if (!company) return;
    state.selectedCompany = company;
    state.mapMode = 'focus';
    const etabs = getEtablissementsForCompany(companyId);
    document.dispatchEvent(new CustomEvent('bitd:company-selected', {
      detail: { company, etablissements: etabs, state }
    }));
  }

  function clearSelection() {
    state.selectedCompany = null;
    state.mapMode = 'national';
    document.dispatchEvent(new CustomEvent('bitd:company-cleared', { detail: { state } }));
    applyFilters();
  }

  function getState() {
    return state;
  }

  window.BITDData = {
    loadEntreprises,
    loadEtablissements,
    registerConsumer,
    setFilters,
    selectCompany,
    clearSelection,
    getEtablissementsForCompany,
    getState,
    constants: { sectorColors },
    helpers: {
      normalizeText,
      numberOrNull,
      formatMillions,
      formatInteger,
      riskScore,
      sovereigntyScore,
      makeBadge,
      makeSectorBadge,
      splitValues,
      badgeClass
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadEntreprises().catch(() => {});
  });
})();
