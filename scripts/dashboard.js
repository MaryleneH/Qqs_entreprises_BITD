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
    allEtablissements: [],
    entrepriseId: null,
    statutEtablissements: 'actifs',
    explorerMode: 'entreprise',
    selectedProgrammeId: null,
    selectedRegion: null,
    subscribers: [],
    schema: {
      statusColumn: null,
      bitdColumn: null,
      precisionColumn: null,
      siretColumn: null,
      apeLabelColumn: null,
      apeCodeColumn: null
    }
  };

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function isTrue(value) {
    return normalizeText(value) === 'true';
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
    if (!header) return [];
    return body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));
  }

  function numberOrNull(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim().replace(',', '.');
    if (!trimmed || trimmed === 'n.c.') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  function splitValues(value) {
    return String(value || '').split(';').map((item) => item.trim()).filter(Boolean);
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

  function detectSchema(rows) {
    const keys = Object.keys(rows[0] || {});
    const normalizedMap = Object.fromEntries(keys.map((k) => [normalizeText(k), k]));
    const pick = (candidates) => {
      for (const candidate of candidates) {
        if (normalizedMap[candidate]) return normalizedMap[candidate];
      }
      return null;
    };

    state.schema.statusColumn = pick([
      'etat_sirene',
      'etat_administratif',
      'et_at_administratif',
      'etatadministratifetablissement',
      'etablissement_actif',
      'statut_sirene',
      'statut_etablissement',
      'sirene_statut'
    ]);

    state.schema.bitdColumn = pick([
      'signe_activite_bitd',
      'qualification_activite_bitd',
      'niveau_activite_bitd'
    ]);

    state.schema.precisionColumn = pick([
      'precision_coordonnees',
      'niveau_precision',
      'precision_localisation'
    ]);

    state.schema.siretColumn = pick(['siret', 'siret_etablissement', 'siret_site']);
    state.schema.apeLabelColumn = pick(['libelle_ape', 'activite_principale_sirene', 'libelle_activite_principale']);
    state.schema.apeCodeColumn = pick(['code_ape', 'activite_principale_ape', 'naf']);
  }

  function normalizeSireneLabel(rawStatus) {
    const label = String(rawStatus ?? '').trim();
    return label || 'Statut SIRENE non rapproché';
  }

  function isSireneClosedStatus(normalizedStatus) {
    if (!normalizedStatus) return false;
    return (
      normalizedStatus.includes('ferme')
      || normalizedStatus.includes('fermeture')
      || normalizedStatus.includes('inactif')
      || normalizedStatus.includes('historique')
      || normalizedStatus.includes('cesse')
      || normalizedStatus.includes('radie')
      || normalizedStatus === 'false'
      || normalizedStatus === '0'
    );
  }

  function isActiveEstablishment(site) {
    const etatSirene = normalizeText(site.etat_sirene);
    if (['actif', 'active', 'ouvert', 'true', '1'].includes(etatSirene)) return true;
    if (isSireneClosedStatus(etatSirene)) return false;
    if (isTrue(site.preuve_activite_corporate) && normalizeText(site.statut_validation).includes('valide')) return true;
    return false;
  }

  function parseBitdStatus(value) {
    const raw = normalizeText(value);
    if (!raw) return null;
    if (raw.includes('confirm')) return 'confirme';
    if (raw.includes('document') || raw.includes('a_confirmer') || raw.includes('a confirmer')) return 'a_confirmer';
    if (raw.includes('non_ident')) return 'non_identifie';
    return null;
  }

  function computeFinancialIndicator(row) {
    if (row.book_to_bill_num != null) {
      return { label: 'Book-to-bill', value: `${row.book_to_bill_num.toFixed(2)}x`, type: 'publié', term: 'book_to_bill', sort: row.book_to_bill_num };
    }
    if (row.ratio_carnet_ca_num != null) {
      return { label: 'Carnet / CA', value: `${row.ratio_carnet_ca_num.toFixed(2)}x`, type: 'calculé', term: 'carnet_ca', sort: row.ratio_carnet_ca_num };
    }
    if (row.marge_num != null) {
      return { label: 'Marge EBITDA', value: `${row.marge_num.toFixed(1)} %`, type: 'publié', term: 'marge_ebitda', sort: row.marge_num };
    }
    return { label: 'Indicateur', value: 'n.c.', type: 'non disponible', term: null, sort: -Infinity };
  }

  function hydrateRow(row, index) {
    const sectors = splitValues(row.secteurs);
    return {
      ...row,
      _order: index,
      latitude: numberOrNull(row.latitude ?? row.siege_latitude),
      longitude: numberOrNull(row.longitude ?? row.siege_longitude),
      effectif_num: numberOrNull(row.effectif),
      ca_defense_num: numberOrNull(row.ca_defense),
      carnet_num: numberOrNull(row.carnet_commandes),
      ratio_carnet_ca_num: numberOrNull(row.ratio_carnet_ca),
      book_to_bill_num: numberOrNull(row.book_to_bill),
      marge_num: numberOrNull(row.marge ?? row.marge_pct),
      sectors,
      primarySector: sectors[0] || 'services/MCO'
    };
  }

  function hydrateEtablissement(row, index) {
    const statusRaw = state.schema.statusColumn ? row[state.schema.statusColumn] : (row.etat_sirene || '');
    const bitdRaw = state.schema.bitdColumn ? row[state.schema.bitdColumn] : '';
    const precision = state.schema.precisionColumn ? (row[state.schema.precisionColumn] || '').trim() : '';
    const hydrated = {
      ...row,
      _order: index,
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      est_siege: isTrue(row.est_siege),
      est_siege_unite_legale_sirene: isTrue(row.est_siege_unite_legale_sirene),
      preuve_activite_corporate_bool: isTrue(row.preuve_activite_corporate),
      affichage_carte_defaut_bool: isTrue(row.affichage_carte_defaut),
      rattachement_siret_trouve_bool: isTrue(row.rattachement_siret_trouve),
      deja_dans_referentiel_initial_bool: isTrue(row.deja_dans_referentiel_initial),
      specialites: splitValues(row.specialites),
      programmes: splitValues(row.programmes_associes),
      sirene_status_raw: statusRaw,
      sirene_status_label: normalizeSireneLabel(statusRaw),
      bitd_status: parseBitdStatus(bitdRaw),
      bitd_status_raw: bitdRaw,
      precision_coordonnees: precision,
      siret_value: state.schema.siretColumn ? (row[state.schema.siretColumn] || '').trim() : '',
      ape_label: state.schema.apeLabelColumn ? (row[state.schema.apeLabelColumn] || '').trim() : '',
      ape_code: state.schema.apeCodeColumn ? (row[state.schema.apeCodeColumn] || '').trim() : ''
    };

    return {
      ...hydrated,
      sirene_is_active: isActiveEstablishment(hydrated)
    };
  }

  function enrichRows() {
    const byCompany = buildEtablissementsByCompany();

    state.allRows = state.allRows.map((row) => {
      const etabs = byCompany.get(row.id) || [];
      const activeEtabs = getVisibleEstablishments(row.id, 'actifs');
      const regions = new Set();
      if (row.siege_region) regions.add(row.siege_region);
      etabs.forEach((e) => { if (e.region) regions.add(e.region); });

      const searchIndex = normalizeText([
        row.entreprise,
        row.categorie,
        row.secteur_principal,
        row.specialite,
        row.description,
        row.siege_ville,
        row.siege_region,
        row.programmes,
        etabs.map((e) => `${e.nom_site || ''} ${e.ville || ''} ${e.activite || ''}`).join(' ')
      ].join(' '));

      return {
        ...row,
        regions: [...regions],
        regions_count: regions.size,
        implantations_count: etabs.length,
        implantations_actives_count: activeEtabs.length,
        financial_indicator: computeFinancialIndicator(row),
        searchIndex
      };
    });
  }

  function buildEtablissementsByCompany() {
    const map = new Map();
    state.allEtablissements.forEach((etab) => {
      const key = etab.entreprise_id;
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(etab);
    });
    return map;
  }

  function getCompanyById(companyId) {
    if (!companyId) return null;
    return state.allRows.find((row) => row.id === companyId) || null;
  }

  function getEtablissementsForCompany(companyId) {
    return state.allEtablissements
      .filter((e) => String(e.entreprise_id) === String(companyId))
      .sort((a, b) => Number(b.est_siege) - Number(a.est_siege) || String(a.ville || '').localeCompare(String(b.ville || ''), 'fr'));
  }

  function getVisibleEstablishments(companyId = state.entrepriseId, mode = state.statutEtablissements) {
    if (!companyId) return [];
    const companySites = getEtablissementsForCompany(companyId);
    if (mode === 'tous') return companySites;
    return companySites.filter((site) => isActiveEstablishment(site));
  }

  function getMapNationalCompanies() {
    return state.allRows.slice().sort((a, b) => a._order - b._order);
  }

  function getState() {
    return {
      ...state,
      selectedCompany: getCompanyById(state.entrepriseId),
      mapMode: state.entrepriseId ? 'focus' : 'national'
    };
  }

  function setExplorerMode(mode) {
    const validMode = ['programme', 'region'].includes(mode) ? mode : 'entreprise';
    state.explorerMode = validMode;
    if (validMode !== 'region') state.selectedRegion = null;
    if (validMode !== 'programme') state.selectedProgrammeId = null;
    if (validMode !== 'entreprise') state.entrepriseId = null;
    notify();
  }

  function setRegion(regionName) {
    state.selectedRegion = regionName || null;
    state.explorerMode = 'region';
    state.entrepriseId = null;
    state.selectedProgrammeId = null;
    notify();
  }

  function getVisibleRegionEstablishments(regionName, mode) {
    if (!regionName) return [];
    const normalizedTarget = normalizeText(regionName);
    const filtered = state.allEtablissements.filter((e) => normalizeText(e.region || '') === normalizedTarget);
    if (mode === 'tous') return filtered;
    return filtered.filter((e) => isActiveEstablishment(e));
  }

  function getUniqueRegions() {
    const seen = new Set();
    const regions = [];
    state.allEtablissements.forEach((e) => {
      const raw = String(e.region || '').trim();
      if (!raw) return;
      const normalized = normalizeText(raw);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        regions.push(raw);
      }
    });
    return regions.sort((a, b) => a.localeCompare(b, 'fr'));
  }

  function setProgramme(programmeId) {
    state.selectedProgrammeId = programmeId || null;
    state.explorerMode = 'programme';
    state.entrepriseId = null;
    notify();
  }

  function switchToEntreprise(companyId) {
    state.explorerMode = 'entreprise';
    state.selectedProgrammeId = null;
    state.entrepriseId = companyId || null;
    notify();
  }

  function notify() {
    const snapshot = getState();
    state.subscribers.forEach((subscriber) => subscriber(snapshot));
    document.dispatchEvent(new CustomEvent('bitd:state-changed', { detail: snapshot }));
  }

  function subscribe(subscriber) {
    state.subscribers.push(subscriber);
    if (state.allRows.length) subscriber(getState());
  }

  function setEntreprise(companyId) {
    state.entrepriseId = companyId || null;
    notify();
  }

  function setStatutEtablissements(mode) {
    state.statutEtablissements = mode === 'tous' ? 'tous' : 'actifs';
    notify();
  }

  function setFilters() {
    // Compatibility no-op for legacy filters script.
  }

  function clearSelection() {
    state.entrepriseId = null;
    notify();
  }

  function selectCompany(companyId) {
    setEntreprise(companyId);
  }

  function runDataAudit() {
    const missingCoords = state.allEtablissements.filter((e) => e.latitude == null || e.longitude == null).length;
    const missingCompanyId = state.allEtablissements.filter((e) => !String(e.entreprise_id || '').trim()).length;
    const companyCounts = state.allRows.map((row) => ({
      id: row.id,
      entreprise: row.entreprise,
      total: getEtablissementsForCompany(row.id).length,
      actifs: getVisibleEstablishments(row.id, 'actifs').length
    }));
    const noSites = companyCounts.filter((item) => item.total === 0).map((item) => item.entreprise);

    const totalActifs = state.allEtablissements.filter((e) => isActiveEstablishment(e)).length;
    const totalInactifs = state.allEtablissements.length - totalActifs;
    const totalSansStatutSirene = state.allEtablissements.filter((e) => !normalizeText(e.etat_sirene)).length;
    const totalSansStatutSireneAvecPreuveCorporate = state.allEtablissements.filter(
      (e) => !normalizeText(e.etat_sirene) && isTrue(e.preuve_activite_corporate)
    ).length;
    const totalStatutsFermes = state.allEtablissements.filter((e) => isSireneClosedStatus(normalizeText(e.etat_sirene))).length;

    console.info('[BITD][DATA_CHECK]', {
      entreprises: state.allRows.length,
      etablissements_total: state.allEtablissements.length,
      etablissements_actifs: totalActifs,
      etablissements_inactifs: totalInactifs,
      etablissements_statut_ferme: totalStatutsFermes,
      etablissements_sans_statut_sirene: totalSansStatutSirene,
      etablissements_sans_statut_sirene_avec_preuve_corporate: totalSansStatutSireneAvecPreuveCorporate,
      entreprises_sans_etablissement: noSites,
      lignes_sans_coordonnees: missingCoords,
      lignes_sans_entreprise_id: missingCompanyId,
      colonnes_detectees: state.schema
    });
    console.table(companyCounts);
  }

  async function loadEtablissements() {
    if (!state.etablissementsPromise) {
      const url = new URL('data/etablissements.csv', document.baseURI);
      state.etablissementsPromise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Impossible de charger ${url}`);
          return response.text();
        })
        .then((text) => parseCSV(text))
        .then((rows) => {
          detectSchema(rows);
          state.allEtablissements = rows.map((row, index) => hydrateEtablissement(row, index));
          return state.allEtablissements;
        });
    }
    return state.etablissementsPromise;
  }

  async function loadEntreprises() {
    if (!state.dataPromise) {
      const url = new URL('data/entreprises.csv', document.baseURI);
      state.dataPromise = fetch(url)
        .then((response) => {
          if (!response.ok) {
            console.error(
              'Impossible de charger data/entreprises.csv',
              response.status,
              response.url
            );
            throw new Error(`Impossible de charger ${url} (HTTP ${response.status})`);
          }
          return response.text();
        })
        .then((text) => parseCSV(text).map((row, index) => hydrateRow(row, index)))
        .then((rows) => {
          state.allRows = rows;
          // Établissements are optional enrichment — failure must not block the core load.
          return loadEtablissements().catch((err) => {
            console.warn('[BITDData] Établissements indisponibles (fail-soft) :', err);
          }).then(() => {
            enrichRows();
            runDataAudit();
            notify();
            document.dispatchEvent(new CustomEvent('bitd:data-ready', { detail: getState() }));
            return state.allRows;
          });
        });
    }
    return state.dataPromise;
  }

  function registerConsumer(consumer) {
    subscribe((snapshot) => consumer(snapshot.allRows, snapshot));
  }

  window.BITDData = {
    loadEntreprises,
    loadEtablissements,
    registerConsumer,
    subscribe,
    setFilters,
    selectCompany,
    setEntreprise,
    setStatutEtablissements,
    clearSelection,
    getCompanyById,
    getEtablissementsForCompany,
    getVisibleEstablishments,
    getMapNationalCompanies,
    getState,
    setExplorerMode,
    setProgramme,
    switchToEntreprise,
    setRegion,
    getVisibleRegionEstablishments,
    getUniqueRegions,
    constants: { sectorColors },
    helpers: {
      normalizeText,
      isTrue,
      isActiveEstablishment,
      numberOrNull,
      splitValues,
      formatMillions,
      formatInteger
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadEntreprises().catch((error) => console.error(error));
  });
})();
