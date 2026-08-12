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
    mapMode: 'national',
    filters: { search: '', sector: 'all', region: 'all' },
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
    const trimmed = String(value).trim().replace(',', '.');
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

  function makeSectorBadge(value) {
    const color = sectorColors[value] || '#5F7F82';
    return `<span class="badge badge--sector" style="background:${color}">${value}</span>`;
  }

  function splitValues(value) {
    return (value || '').split(';').map((item) => item.trim()).filter(Boolean);
  }

  function getCompanyRegions(row) {
    const regions = new Set();
    if (row.siege_region) regions.add(row.siege_region);
    state.allEtablissements
      .filter((e) => e.entreprise_id === row.id && e.region)
      .forEach((e) => regions.add(e.region));
    return [...regions];
  }

  function computeFinancialIndicator(row) {
    if (row.book_to_bill_num != null) {
      return {
        label: 'Book-to-bill',
        value: `${row.book_to_bill_num.toFixed(2)}x`,
        type: 'publié',
        term: 'book_to_bill',
        sort: row.book_to_bill_num
      };
    }
    if (row.ratio_carnet_ca_num != null) {
      return {
        label: 'Carnet / CA',
        value: `${row.ratio_carnet_ca_num.toFixed(2)}x`,
        type: 'calculé',
        term: 'carnet_ca',
        sort: row.ratio_carnet_ca_num
      };
    }
    if (row.marge_num != null) {
      return {
        label: 'Marge EBITDA',
        value: `${row.marge_num.toFixed(1)} %`,
        type: 'publié',
        term: 'marge_ebitda',
        sort: row.marge_num
      };
    }
    return {
      label: 'Indicateur',
      value: 'n.c.',
      type: 'non disponible',
      term: null,
      sort: -Infinity
    };
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
      primarySector: sectors[0] || 'services/MCO'
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

  function enrichRows() {
    state.allRows = state.allRows.map((row) => {
      const regions = getCompanyRegions(row);
      const etabs = getEtablissementsForCompany(row.id);
      const indicator = computeFinancialIndicator(row);
      const searchIndex = normalizeText([
        row.entreprise,
        row.specialite,
        row.secteurs,
        row.siege_ville,
        row.siege_region,
        row.programmes,
        row.sites_industriels,
        row.actionnariat,
        etabs.map((etab) => `${etab.nom_site} ${etab.ville} ${etab.activite || ''}`).join(' ')
      ].join(' '));

      return {
        ...row,
        regions,
        regions_count: regions.length,
        implantations_count: etabs.length,
        financial_indicator: indicator,
        financial_indicator_sort: indicator.sort,
        searchIndex
      };
    });
  }

  function getEtablissementsForCompany(companyId) {
    return state.allEtablissements.filter((e) => e.entreprise_id === companyId);
  }

  function getVisibleEtablissements(rows) {
    const visibleIds = new Set(rows.map((row) => row.id));
    return state.allEtablissements.filter((e) => visibleIds.has(e.entreprise_id));
  }

  function applyFilters() {
    const { search, sector, region } = state.filters;
    state.filteredRows = state.allRows.filter((row) => {
      const matchesSearch = !search || row.searchIndex.includes(normalizeText(search));
      const matchesSector = sector === 'all' || row.sectors.includes(sector);

      let matchesRegion = region === 'all';
      if (!matchesRegion) {
        matchesRegion = row.regions.includes(region);
      }

      return matchesSearch && matchesSector && matchesRegion;
    });

    updateKpis(state.filteredRows, state.allRows);
    updateAnalysis(state.filteredRows, state.filters);
    state.consumers.forEach((consumer) => consumer(state.filteredRows, state));
    document.dispatchEvent(new CustomEvent('bitd:data-updated', { detail: { rows: state.filteredRows, state } }));
  }

  function accumulateCounts(list, getter) {
    return list.reduce((acc, item) => {
      const key = getter(item);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function topEntries(counts, limit = 5) {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
      .slice(0, limit);
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

    const visibleEtabs = getVisibleEtablissements(rows);
    const visibleRegions = new Set();
    const visibleSectors = new Set();
    let multiregionalCount = 0;

    rows.forEach((row) => {
      row.regions.forEach((region) => visibleRegions.add(region));
      row.sectors.forEach((sector) => visibleSectors.add(sector));
      if (row.regions_count > 1) multiregionalCount += 1;
    });

    visibleEtabs.forEach((etab) => {
      if (etab.region) visibleRegions.add(etab.region);
    });

    totalEl.textContent = String(rows.length);
    document.getElementById('kpi-total-note').textContent = `${rows.length} sur ${allRows.length} entreprises visibles`;
    document.getElementById('kpi-sites').textContent = String(visibleEtabs.length);
    document.getElementById('kpi-sites-note').textContent = `${visibleEtabs.length} sièges et établissements cartographiés`;
    document.getElementById('kpi-regions').textContent = String(visibleRegions.size);
    document.getElementById('kpi-regions-note').textContent = `${visibleRegions.size} régions couvertes par la sélection`;
    document.getElementById('kpi-sectors').textContent = String(visibleSectors.size);
    document.getElementById('kpi-sectors-note').textContent = `${visibleSectors.size} familles industrielles représentées`;
    document.getElementById('kpi-multiregional').textContent = String(multiregionalCount);
    document.getElementById('kpi-multiregional-note').textContent = `${multiregionalCount} entreprises présentes dans plusieurs régions`;
  }

  function updateAnalysis(rows, filters) {
    const summary = document.getElementById('analysis-summary');
    if (!summary) return;

    const visibleEtabs = getVisibleEtablissements(rows);
    const uniqueRegions = new Set();
    rows.forEach((row) => row.regions.forEach((region) => uniqueRegions.add(region)));
    const multiRegional = rows.filter((row) => row.regions_count > 1).length;

    summary.innerHTML = `<strong>${rows.length}</strong> entreprises affichées, <strong>${visibleEtabs.length}</strong> implantations cartographiées et <strong>${multiRegional}</strong> groupes présents dans plusieurs régions.`;

    const sectorCounts = {};
    rows.forEach((row) => row.sectors.forEach((sector) => {
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    }));
    renderCountList('analysis-sectors', topEntries(sectorCounts, 6), (label, count) => `<div class="row"><span>${makeSectorBadge(label)}</span><strong>${count}</strong></div>`);

    const regionCounts = {};
    visibleEtabs.forEach((etab) => {
      if (etab.region) regionCounts[etab.region] = (regionCounts[etab.region] || 0) + 1;
    });
    rows.forEach((row) => {
      if (row.siege_region) regionCounts[row.siege_region] = (regionCounts[row.siege_region] || 0) + 1;
    });
    renderCountList('analysis-regions', topEntries(regionCounts, 6), (label, count) => `<div class="row"><span>${label}</span><strong>${count}</strong></div>`);

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
      if (filters.region !== 'all') chips.push(`<span class="chip">Région · ${filters.region}</span>`);
      activeFilters.innerHTML = chips.length ? chips.join('') : '<span class="chip">Aucun filtre actif</span>';
    }
  }

  async function loadEtablissements() {
    if (!state.etablissementsPromise) {
      const url = new URL('data/etablissements.csv', document.baseURI);
      state.etablissementsPromise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Impossible de charger ${url}`);
          return response.text();
        })
        .then((text) => parseCSV(text).map(hydrateEtablissement))
        .then((rows) => {
          state.allEtablissements = rows;
          return rows;
        })
        .catch((error) => {
          console.warn('etablissements.csv non disponible:', error.message);
          return [];
        });
    }
    return state.etablissementsPromise;
  }

  async function loadEntreprises() {
    if (!state.dataPromise) {
      const url = new URL('data/entreprises.csv', document.baseURI);
      state.dataPromise = Promise.all([
        fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error(`Impossible de charger ${url}`);
            return response.text();
          })
          .then((text) => parseCSV(text).map(hydrateRow)),
        loadEtablissements()
      ])
        .then(([rows]) => {
          state.allRows = rows;
          enrichRows();
          state.filteredRows = state.allRows.slice();
          applyFilters();
          document.dispatchEvent(new CustomEvent('bitd:data-ready', { detail: { rows: state.allRows, state } }));
          return state.allRows;
        })
        .catch((error) => {
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
    const company = state.allRows.find((row) => row.id === companyId);
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
      makeSectorBadge,
      splitValues
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadEntreprises().catch(() => {});
  });
})();
