/**
 * cercle1-international.js
 * Vue analytique — Cercle 1 : implantations internationales & coopérations
 * Les CSV font foi. Le code présente les informations ; il n'invente pas l'analyse.
 */
(function () {
  'use strict';

  // ─── Chemins relatifs (GitHub Pages) ────────────────────────────────────────
  const CSV = {
    entreprises:    'data/cercle1/cercle1_entreprises.csv',
    implantations:  'data/cercle1/cercle1_implantations_internationales.csv',
    partenaires:    'data/cercle1/cercle1_partenaires_defense.csv',
    localisations:  'data/cercle1/cercle1_partenaires_localisation.csv',
    sources:        'data/cercle1/cercle1_sources.csv',
    entreprisesFR:  'data/entreprises.csv',
  };

  // ─── État global ─────────────────────────────────────────────────────────────
  const state = {
    mode: 'implantations',   // implantations | partenaires | reseau
    entreprise: 'all',
    pays: 'all',
    pertinence: 'all',
    type: 'all',
    statut: 'all',
    confiance: 'all',
    toggleAnnonces: false,
    toggleDual: false,
    toggleKNDS: false,
    selectedEntrepriseId: null,
    selectedItemId: null,
  };

  // ─── Données chargées ────────────────────────────────────────────────────────
  let data = {
    entreprises: [],
    implantations: [],
    partenaires: [],
    localisations: [],
    sources: [],
    entreprisesFR: [],
  };

  // ─── Carte Leaflet ──────────────────────────────────────────────────────────
  let leafletMap = null;
  let markersLayer = null;
  let linesLayer = null;

  // ─── Utilitaires CSV ────────────────────────────────────────────────────────

  function parseCsv(text) {
    // Gère UTF-8 BOM
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = splitCsvLine(lines[0]);
    return lines.slice(1).map(line => {
      const vals = splitCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
      return obj;
    });
  }

  function splitCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ';' && !inQuote) {
        result.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  async function loadCsv(key, url, required = true) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      return parseCsv(text);
    } catch (err) {
      if (required) throw err;
      console.warn(`[C1] Fichier optionnel non chargé (${key}): ${url} — ${err.message}`);
      showPartialError(`Le fichier ${url} n'a pas pu être chargé. Les données restantes sont affichées.`);
      return [];
    }
  }

  // ─── Initialisation ──────────────────────────────────────────────────────────

  async function init() {
    try {
      // Chargement des fichiers obligatoires en parallèle
      const [ent, impl, part, locs, srcs, entFR] = await Promise.all([
        loadCsv('entreprises',   CSV.entreprises,   true),
        loadCsv('implantations', CSV.implantations, true),
        loadCsv('partenaires',   CSV.partenaires,   false),
        loadCsv('localisations', CSV.localisations, false),
        loadCsv('sources',       CSV.sources,       false),
        loadCsv('entreprisesFR', CSV.entreprisesFR, false),
      ]);

      data.entreprises   = ent;
      data.implantations = impl;
      data.partenaires   = part;
      data.localisations = locs;
      data.sources       = srcs;
      data.entreprisesFR = entFR;

      runDataValidation();
      buildUi();
      initMap();
      render();

    } catch (err) {
      console.error('[C1] Erreur chargement données obligatoires:', err);
      showError('Impossible de charger le référentiel Cercle 1. Veuillez réessayer.');
    }
  }

  // ─── Validation des données ──────────────────────────────────────────────────

  function runDataValidation() {
    // 1. Exactement 9 entreprises_id uniques
    const ids = new Set(data.entreprises.map(e => e.entreprise_id));
    if (ids.size !== 9) {
      console.warn(`[C1][VALIDATION] Attendu 9 entreprise_id uniques, trouvé : ${ids.size}`);
    }

    // 2. Sources orphelines
    const srcIds = new Set(data.sources.map(s => s.source_id));
    data.implantations.forEach(i => {
      if (i.source_site_id && !srcIds.has(i.source_site_id)) {
        console.warn(`[C1][VALIDATION] source_site_id orphelin : ${i.source_site_id} (implantation ${i.site_intl_id})`);
      }
    });
    data.partenaires.forEach(p => {
      if (p.source_relation_id && !srcIds.has(p.source_relation_id)) {
        console.warn(`[C1][VALIDATION] source_relation_id orphelin : ${p.source_relation_id} (relation ${p.relation_id})`);
      }
    });

    // 3. partenaire_location_id orphelins
    const locIds = new Set(data.localisations.map(l => l.partner_location_id));
    data.partenaires.forEach(p => {
      if (p.partenaire_location_id && !locIds.has(p.partenaire_location_id)) {
        console.warn(`[C1][VALIDATION] partenaire_location_id orphelin : ${p.partenaire_location_id} (relation ${p.relation_id})`);
      }
    });

    // 4. Relations cartographiables sans point résolvable
    data.partenaires.filter(p => p.cartographiable === 'true').forEach(p => {
      const hasLoc = p.partenaire_location_id && locIds.has(p.partenaire_location_id);
      const hasFRSiege = p.partenaire_cercle1_entreprise_id && getEntrepriseFRSiege(p.partenaire_cercle1_entreprise_id);
      if (!hasLoc && !hasFRSiege) {
        console.warn(`[C1][VALIDATION] Relation cartographiable sans point résolvable : ${p.relation_id}`);
      }
    });

    // 5. Lat/lng numériques pour les points cartographiés
    data.implantations.forEach(i => {
      const lat = parseFloat(i.latitude);
      const lng = parseFloat(i.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`[C1][VALIDATION] Coordonnées invalides pour implantation ${i.site_intl_id}`);
      }
    });
    data.localisations.forEach(l => {
      const lat = parseFloat(l.latitude);
      const lng = parseFloat(l.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`[C1][VALIDATION] Coordonnées invalides pour localisation ${l.partner_location_id}`);
      }
    });
  }

  // ─── Construction de l'UI ────────────────────────────────────────────────────

  function buildUi() {
    // Populate entreprise select
    const selEnt = document.getElementById('c1-filter-entreprise');
    if (selEnt) {
      data.entreprises.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.entreprise_id;
        opt.textContent = e.entreprise;
        selEnt.appendChild(opt);
      });
      selEnt.addEventListener('change', e => {
        state.entreprise = e.target.value;
        state.selectedEntrepriseId = e.target.value === 'all' ? null : e.target.value;
        render();
      });
    }

    // Populate pays select dynamically
    updatePaysSelect();

    // Populate type & statut dynamically
    updateTypeSelect();
    updateStatutSelect();

    // Filter listeners
    ['c1-filter-pays','c1-filter-pertinence','c1-filter-type','c1-filter-statut','c1-filter-confiance'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        const field = id.replace('c1-filter-','');
        state[field] = el.value;
        render();
      });
    });

    // Toggle listeners
    ['toggle-annonces','toggle-dual','toggle-knds'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        if (id === 'toggle-annonces') state.toggleAnnonces = el.checked;
        if (id === 'toggle-dual')     state.toggleDual     = el.checked;
        if (id === 'toggle-knds')     state.toggleKNDS     = el.checked;
        render();
      });
    });

    // Mode tabs
    document.querySelectorAll('.c1-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.c1-tab').forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected','false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected','true');
        state.mode = btn.dataset.mode;
        updateTypeSelect();
        updateStatutSelect();
        render();
      });
    });

    // Reset
    const resetBtn = document.getElementById('c1-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetFilters();
        render();
      });
    }
  }

  function resetFilters() {
    state.entreprise = 'all';
    state.pays = 'all';
    state.pertinence = 'all';
    state.type = 'all';
    state.statut = 'all';
    state.confiance = 'all';
    state.toggleAnnonces = false;
    state.toggleDual = false;
    state.toggleKNDS = false;
    ['c1-filter-entreprise','c1-filter-pays','c1-filter-pertinence','c1-filter-type','c1-filter-statut','c1-filter-confiance'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 'all';
    });
    ['toggle-annonces','toggle-dual','toggle-knds'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
  }

  function updatePaysSelect() {
    const sel = document.getElementById('c1-filter-pays');
    if (!sel) return;
    const current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    const paysSet = new Set();
    data.implantations.forEach(i => i.pays && paysSet.add(i.pays));
    [...paysSet].sort().forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      sel.appendChild(opt);
    });
    if ([...paysSet].includes(current)) sel.value = current;
  }

  function updateTypeSelect() {
    const sel = document.getElementById('c1-filter-type');
    const label = document.getElementById('c1-label-type');
    if (!sel) return;
    const current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    const types = new Set();
    if (state.mode === 'implantations' || state.mode === 'reseau') {
      data.implantations.forEach(i => i.type_site && types.add(i.type_site));
      if (label) label.firstChild.textContent = 'Type de site ';
    } else {
      data.partenaires.forEach(p => p.type_relation && types.add(p.type_relation));
      if (label) label.firstChild.textContent = 'Type de relation ';
    }
    [...types].sort().forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.replace(/_/g,' ');
      sel.appendChild(opt);
    });
    if ([...types].includes(current)) sel.value = current;
    else sel.value = 'all';
  }

  function updateStatutSelect() {
    const sel = document.getElementById('c1-filter-statut');
    if (!sel) return;
    const current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    const statuts = new Set();
    if (state.mode === 'implantations' || state.mode === 'reseau') {
      data.implantations.forEach(i => i.statut && statuts.add(i.statut));
    } else {
      data.partenaires.forEach(p => p.statut_relation && statuts.add(p.statut_relation));
    }
    [...statuts].sort().forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s.replace(/_/g,' ');
      sel.appendChild(opt);
    });
    if ([...statuts].includes(current)) sel.value = current;
    else sel.value = 'all';
  }

  // ─── Filtres données ─────────────────────────────────────────────────────────

  function filterImplantations() {
    return data.implantations.filter(i => {
      if (state.entreprise !== 'all' && i.entreprise_id !== state.entreprise) return false;
      if (state.pays !== 'all' && i.pays !== state.pays) return false;
      if (state.pertinence !== 'all' && i.pertinence_defense !== state.pertinence) return false;
      if (state.type !== 'all' && i.type_site !== state.type) return false;
      if (state.statut !== 'all' && i.statut !== state.statut) return false;
      if (state.confiance !== 'all' && i.confiance_information !== state.confiance) return false;

      // Groupe KNDS masqué par défaut
      if (isKNDSGroupe(i) && !state.toggleKNDS) return false;

      // Annonces/LOI/démonstrateurs masqués par défaut
      const annonces = ['annoncee_industrialisation','LOI_2026','demonstration_2026','annonce_non_operationnel'];
      if (annonces.includes(i.statut) && !state.toggleAnnonces) return false;

      // Activités duales/civiles masquées si toggle off
      const dualPertinence = ['duale/indirecte','commerciale','faible/civile','mixte/duale'];
      if (dualPertinence.includes(i.pertinence_defense) && !state.toggleDual) {
        if (i.pertinence_defense !== 'directe') {
          // Pour pertinence non directe, respecter afficher_par_defaut
          if (i.afficher_par_defaut !== 'true') return false;
        }
      }

      // Respecter afficher_par_defaut
      if (i.afficher_par_defaut === 'false' && !isForceShown(i)) return false;

      return true;
    });
  }

  function isKNDSGroupe(i) {
    // entreprise_id 7 = KNDS France, et périmètre != KNDS France strict
    return i.entreprise_id === '7';
  }

  function isForceShown(i) {
    // KNDS group visible si toggle KNDS
    if (i.entreprise_id === '7' && state.toggleKNDS) return true;
    // Dassault Nagpur visible si toggle dual
    if (i.pertinence_defense === 'faible/civile' && state.toggleDual) return true;
    // Annonces visibles si toggle annonces
    const annonces = ['annoncee_industrialisation','LOI_2026','demonstration_2026'];
    if (annonces.includes(i.statut) && state.toggleAnnonces) return true;
    return false;
  }

  function filterPartenaires() {
    return data.partenaires.filter(p => {
      if (state.entreprise !== 'all' && p.entreprise_id !== state.entreprise) return false;
      if (state.type !== 'all' && p.type_relation !== state.type) return false;
      if (state.confiance !== 'all' && p.confiance_information !== state.confiance) return false;

      const annonces = ['annoncee_industrialisation','LOI_2026','demonstration_2026'];
      if (annonces.includes(p.statut_relation) && !state.toggleAnnonces) return false;

      if (p.afficher_par_defaut === 'false') return false;

      return true;
    });
  }

  // ─── Rendu principal ─────────────────────────────────────────────────────────

  function render() {
    updateKNDSMessage();
    updateResetBtn();

    if (state.mode === 'implantations') renderImplantations();
    else if (state.mode === 'partenaires') renderPartenaires();
    else renderReseau();

    updateKpis();
    updatePanel();
  }

  function updateKNDSMessage() {
    const msg = document.getElementById('c1-knds-msg');
    if (!msg) return;
    const kndsSelected = state.entreprise === '7';
    msg.hidden = !(kndsSelected && !state.toggleKNDS);
  }

  function updateResetBtn() {
    const btn = document.getElementById('c1-reset-filters');
    if (!btn) return;
    const active = state.entreprise !== 'all' || state.pays !== 'all' ||
      state.pertinence !== 'all' || state.type !== 'all' ||
      state.statut !== 'all' || state.confiance !== 'all' ||
      state.toggleAnnonces || state.toggleDual || state.toggleKNDS;
    btn.hidden = !active;
  }

  function updateKpis() {
    const impl = filterImplantations();
    const part = filterPartenaires();
    const paysSet = new Set(impl.map(i => i.pays));

    setKpi('kpi-implantations', impl.length);
    setKpi('kpi-pays', paysSet.size);
    setKpi('kpi-relations', part.length);

    const countEl = document.getElementById('c1-count-label');
    if (countEl) {
      if (state.mode === 'implantations') countEl.textContent = `${impl.length} implantation${impl.length > 1 ? 's' : ''} dans la sélection`;
      else if (state.mode === 'partenaires') countEl.textContent = `${part.length} relation${part.length > 1 ? 's' : ''} documentée${part.length > 1 ? 's' : ''}`;
      else countEl.textContent = `${impl.length} implantation${impl.length > 1 ? 's' : ''} · ${part.filter(p => p.cartographiable === 'true').length} partenaires cartographiables`;
    }
  }

  function setKpi(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val === 0 ? '0' : (val || '—');
  }

  // ─── Carte ───────────────────────────────────────────────────────────────────

  function initMap() {
    if (!window.L) { console.warn('[C1] Leaflet non chargé'); return; }
    const container = document.getElementById('c1-map');
    if (!container) return;

    leafletMap = L.map('c1-map', {
      scrollWheelZoom: false,
      center: [48, 5],
      zoom: 4,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);
    linesLayer   = L.layerGroup().addTo(leafletMap);

    // ResizeObserver unique pour éviter les cartes blanches
    const ro = new ResizeObserver(() => {
      if (leafletMap) leafletMap.invalidateSize({ animate: false });
    });
    ro.observe(container);
  }

  function clearMap() {
    if (markersLayer) markersLayer.clearLayers();
    if (linesLayer)   linesLayer.clearLayers();
  }

  function fitMapBounds(points) {
    if (!leafletMap || !points.length) return;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  }

  function renderImplantations() {
    if (!leafletMap) return;
    clearMap();
    const impl = filterImplantations();
    const visiblePoints = [];

    // Sièges français
    getSiegesFrancais().forEach(s => {
      const m = addSiegeFrancais(s);
      if (m) visiblePoints.push({ lat: s.lat, lng: s.lng });
    });

    impl.forEach(i => {
      const lat = parseFloat(i.latitude);
      const lng = parseFloat(i.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const marker = makeImplantationMarker(i, lat, lng);
      if (marker) {
        marker.addTo(markersLayer);
        visiblePoints.push({ lat, lng });
      }
    });

    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize({ animate: false });
      fitMapBounds(visiblePoints);
    }, 50);
  }

  function renderPartenaires() {
    if (!leafletMap) return;
    clearMap();
    const part = filterPartenaires();
    const visiblePoints = [];

    getSiegesFrancais().forEach(s => {
      addSiegeFrancais(s);
      visiblePoints.push({ lat: s.lat, lng: s.lng });
    });

    part.filter(p => p.cartographiable === 'true').forEach(p => {
      const pt = resolvePartenairePoint(p);
      if (!pt) return;
      const marker = makePartenaireMaker(p, pt.lat, pt.lng);
      if (marker) {
        marker.addTo(markersLayer);
        visiblePoints.push(pt);
      }
      // Ligne vers siège français de l'entreprise concernée
      const siege = getEntrepriseFRSiege(p.entreprise_id);
      if (siege) {
        addDocumentaryLine([siege.lat, siege.lng], [pt.lat, pt.lng], p.statut_relation);
      }
    });

    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize({ animate: false });
      fitMapBounds(visiblePoints);
    }, 50);
  }

  function renderReseau() {
    if (!leafletMap) return;
    clearMap();
    const impl = filterImplantations();
    const part = filterPartenaires().filter(p => p.cartographiable === 'true');
    const visiblePoints = [];

    // Sièges
    getSiegesFrancais().forEach(s => {
      addSiegeFrancais(s);
      visiblePoints.push({ lat: s.lat, lng: s.lng });
    });

    // Implantations
    impl.forEach(i => {
      const lat = parseFloat(i.latitude);
      const lng = parseFloat(i.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const marker = makeImplantationMarker(i, lat, lng);
      if (marker) {
        marker.addTo(markersLayer);
        visiblePoints.push({ lat, lng });
      }
    });

    // Partenaires cartographiables + lignes
    part.forEach(p => {
      const pt = resolvePartenairePoint(p);
      if (!pt) return;
      const marker = makePartenaireMaker(p, pt.lat, pt.lng);
      if (marker) {
        marker.addTo(markersLayer);
        visiblePoints.push(pt);
      }
      const siege = getEntrepriseFRSiege(p.entreprise_id);
      if (siege) {
        addDocumentaryLine([siege.lat, siege.lng], [pt.lat, pt.lng], p.statut_relation);
      }
    });

    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize({ animate: false });
      fitMapBounds(visiblePoints);
    }, 50);
  }

  // ─── Marqueurs ───────────────────────────────────────────────────────────────

  const COLOR_NAVY   = '#14263D';
  const COLOR_COPPER = '#C99A4A';
  const COLOR_TEAL   = '#5F7F82';

  function getSiegesFrancais() {
    const entIds = state.entreprise === 'all'
      ? data.entreprises.map(e => e.entreprise_id)
      : [state.entreprise];

    return entIds.map(id => {
      const c1Ent = data.entreprises.find(e => e.entreprise_id === id);
      if (!c1Ent) return null;
      const frEnt = data.entreprisesFR.find(e => String(e.id) === String(id));
      if (!frEnt) return null;
      const lat = parseFloat(frEnt.siege_latitude);
      const lng = parseFloat(frEnt.siege_longitude);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng, entreprise: c1Ent.entreprise, entreprise_id: id, siege_ville: frEnt.siege_ville };
    }).filter(Boolean);
  }

  function addSiegeFrancais(s) {
    if (!leafletMap) return null;
    const icon = L.divIcon({
      className: '',
      html: `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <polygon points="11,1 13.5,8 21,8 15,13 17,20 11,16 5,20 7,13 1,8 8.5,8" fill="${COLOR_NAVY}" stroke="#fff" stroke-width="1.2"/>
      </svg>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const marker = L.marker([s.lat, s.lng], { icon })
      .bindPopup(`<strong>${escHtml(s.entreprise)}</strong><br>Siège français — ${escHtml(s.siege_ville || '')}`)
      .addTo(markersLayer);
    marker.on('click', () => selectEntreprise(s.entreprise_id));
    return marker;
  }

  function makeImplantationMarker(i, lat, lng) {
    const isAnnonce = ['annoncee_industrialisation','LOI_2026','demonstration_2026'].includes(i.statut);
    const opacity = i.confiance_information === 'faible' ? 0.45 : 1;
    const fill = isAnnonce ? 'none' : COLOR_COPPER;
    const stroke = COLOR_COPPER;
    const icon = L.divIcon({
      className: '',
      html: `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
        <circle cx="8" cy="8" r="6" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      </svg>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    const entrepriseName = (data.entreprises.find(e => e.entreprise_id === i.entreprise_id) || {}).entreprise || i.entreprise;
    const popup = `<strong>${escHtml(i.entite_locale)}</strong><br>${escHtml(i.ville)}, ${escHtml(i.pays)}<br><em>${escHtml(i.pertinence_defense)}</em>`;
    const marker = L.marker([lat, lng], { icon })
      .bindPopup(popup)
      .bindTooltip(escHtml(i.entite_locale), { direction: 'top' });
    marker.on('click', () => showSiteFiche(i));
    return marker;
  }

  function makePartenaireMaker(p, lat, lng) {
    const isAnnonce = ['annoncee_industrialisation','LOI_2026','demonstration_2026'].includes(p.statut_relation);
    const opacity = p.confiance_information === 'faible' ? 0.45 : 1;
    const fill = isAnnonce ? 'none' : COLOR_TEAL;
    const icon = L.divIcon({
      className: '',
      html: `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
        <polygon points="8,2 14,8 8,14 2,8" fill="${fill}" stroke="${COLOR_TEAL}" stroke-width="2"/>
      </svg>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    const marker = L.marker([lat, lng], { icon })
      .bindTooltip(escHtml(p.partenaire), { direction: 'top' });
    marker.on('click', () => showRelationFiche(p));
    return marker;
  }

  function addDocumentaryLine(from, to, statut) {
    if (!linesLayer) return;
    const isLOI = statut === 'LOI_2026' || statut === 'demonstration_2026';
    const isAnnonce = statut === 'annoncee_industrialisation';
    const dash = isLOI ? '6,4' : (isAnnonce ? '4,4' : null);
    const opts = {
      color: COLOR_TEAL,
      weight: isLOI || isAnnonce ? 1.5 : 2,
      opacity: 0.55,
      dashArray: dash,
    };
    const line = L.polyline([from, to], opts)
      .bindTooltip('Relation industrielle documentée — ne représente pas un flux logistique.', { sticky: true });
    line.addTo(linesLayer);
  }

  function resolvePartenairePoint(p) {
    // 1. Via partenaire_location_id
    if (p.partenaire_location_id) {
      const loc = data.localisations.find(l => l.partner_location_id === p.partenaire_location_id);
      if (loc) {
        const lat = parseFloat(loc.latitude);
        const lng = parseFloat(loc.longitude);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
      }
    }
    // 2. Via siège français du partenaire Cercle 1
    if (p.partenaire_cercle1_entreprise_id) {
      return getEntrepriseFRSiege(p.partenaire_cercle1_entreprise_id);
    }
    return null;
  }

  function getEntrepriseFRSiege(entreprise_id) {
    const frEnt = data.entreprisesFR.find(e => String(e.id) === String(entreprise_id));
    if (!frEnt) return null;
    const lat = parseFloat(frEnt.siege_latitude);
    const lng = parseFloat(frEnt.siege_longitude);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  }

  // ─── Panneau analytique ──────────────────────────────────────────────────────

  function updatePanel() {
    if (state.selectedEntrepriseId && state.selectedEntrepriseId !== 'all') {
      showEntrepriseFiche(state.selectedEntrepriseId);
    }
  }

  function selectEntreprise(id) {
    state.selectedEntrepriseId = id;
    const sel = document.getElementById('c1-filter-entreprise');
    if (sel) sel.value = id;
    state.entreprise = id;
    render();
  }

  function showEntrepriseFiche(id) {
    const ent = data.entreprises.find(e => e.entreprise_id === String(id));
    if (!ent) return;

    const implFiltered = filterImplantations().filter(i => i.entreprise_id === String(id));
    const partFiltered = filterPartenaires().filter(p => p.entreprise_id === String(id));
    const paysSet = new Set(implFiltered.map(i => i.pays));

    const isKNDS = String(id) === '7';
    const kndsMsgHtml = isKNDS && !state.toggleKNDS
      ? `<div class="c1-knds-inline-msg">Dans cette sélection V1, aucune implantation étrangère n'est affichée dans le périmètre strict de KNDS France. Activez « Inclure périmètre groupe KNDS » pour explorer les implantations documentées du groupe.</div>`
      : '';

    // Source inclusion
    const srcIncl = resolveSource(ent.source_inclusion_id);
    const srcHtml = srcIncl
      ? `<div class="c1-source-card">${sourceCardHtml(srcIncl)}</div>`
      : '';

    const implHtml = implFiltered.length > 0
      ? implFiltered.map(i => siteListItemHtml(i)).join('')
      : `<li class="c1-list-empty">Aucune implantation dans la sélection active.</li>`;

    const partHtml = partFiltered.length > 0
      ? partFiltered.map(p => relationListItemHtml(p)).join('')
      : `<li class="c1-list-empty">Aucune relation documentée dans le référentiel.</li>`;

    const html = `
      <div class="c1-panel-header">
        <h2 class="c1-panel-title">${escHtml(ent.entreprise)}</h2>
        <p class="c1-panel-specialite">${escHtml(ent.specialite_cercle1)}</p>
      </div>
      ${kndsMsgHtml}
      <dl class="c1-panel-dl">
        <dt>Pourquoi dans le Cercle 1 ?</dt>
        <dd>${escHtml(ent.raison_inclusion)}</dd>
        <dt>Note de couverture</dt>
        <dd>${escHtml(ent.note_couverture)}</dd>
        <dt>Implantations dans la sélection documentée</dt>
        <dd>${implFiltered.length} implantation${implFiltered.length > 1 ? 's' : ''}</dd>
        <dt>Pays représentés dans la sélection</dt>
        <dd>${paysSet.size > 0 ? [...paysSet].sort().join(', ') : '—'}</dd>
        <dt>Relations documentées dans le référentiel</dt>
        <dd>${partFiltered.length} relation${partFiltered.length > 1 ? 's' : ''}</dd>
      </dl>
      <div class="c1-panel-section">
        <h3>Sites — sélection documentée</h3>
        <ul class="c1-panel-list">${implHtml}</ul>
      </div>
      <div class="c1-panel-section">
        <h3>Relations documentées</h3>
        <ul class="c1-panel-list">${partHtml}</ul>
      </div>
      ${srcHtml}
    `;

    setPanelContent(html);
  }

  function showSiteFiche(i) {
    const src = resolveSource(i.source_site_id);
    const statusBadge = statusBadgeHtml(i.statut);
    const html = `
      <div class="c1-panel-header">
        <button class="c1-btn-back" onclick="window._c1BackToEntreprise(${escHtml(i.entreprise_id)})">← Retour</button>
        <h2 class="c1-panel-title">${escHtml(i.entite_locale)}</h2>
        <p class="c1-panel-location">${escHtml(i.ville)}, ${escHtml(i.pays)}</p>
        ${statusBadge}
      </div>
      <dl class="c1-panel-dl">
        <dt>Type de site</dt><dd>${escHtml(i.type_site ? i.type_site.replace(/_/g,' ') : '—')}</dd>
        <dt>Activité documentée</dt><dd>${escHtml(i.activite_documentee)}</dd>
        <dt>Pertinence défense</dt><dd>${escHtml(i.pertinence_defense)}</dd>
        <dt>Périmètre</dt><dd>${escHtml(i.perimetre)}</dd>
        <dt>Statut</dt><dd>${escHtml(i.statut)}</dd>
        <dt>Confiance</dt><dd>${escHtml(i.confiance_information)}</dd>
        ${i.limites_interpretation ? `<dt>Limites d'interprétation</dt><dd>${escHtml(i.limites_interpretation)}</dd>` : ''}
        <dt>Dernière vérification</dt><dd>${escHtml(i.derniere_verification)}</dd>
      </dl>
      <p class="c1-coord-note">Localisation : centre-ville approximatif — à revalider pour une géolocalisation précise.</p>
      ${src ? `<div class="c1-source-card">${sourceCardHtml(src)}</div>` : ''}
    `;
    setPanelContent(html);
    window._c1BackToEntreprise = (eid) => showEntrepriseFiche(eid);
  }

  function showRelationFiche(p) {
    const src = resolveSource(p.source_relation_id);
    const statusBadge = statusBadgeHtml(p.statut_relation);
    const html = `
      <div class="c1-panel-header">
        <button class="c1-btn-back" onclick="window._c1BackToEntreprise(${escHtml(p.entreprise_id)})">← Retour</button>
        <h2 class="c1-panel-title">${escHtml(p.entreprise)} × ${escHtml(p.partenaire)}</h2>
        ${statusBadge}
      </div>
      <dl class="c1-panel-dl">
        <dt>Secteur partenaire</dt><dd>${escHtml(p.partenaire_secteur)}</dd>
        <dt>Type de relation</dt><dd>${escHtml(p.type_relation ? p.type_relation.replace(/_/g,' ') : '—')}</dd>
        <dt>Programme / projet</dt><dd>${escHtml(p.programme_projet)}</dd>
        <dt>Description de la preuve</dt><dd class="c1-preuve">${escHtml(p.description_preuve)}</dd>
        <dt>Périmètre</dt><dd>${escHtml(p.perimetre_relation)}</dd>
        <dt>Statut</dt><dd>${escHtml(p.statut_relation)}</dd>
        <dt>Confiance</dt><dd>${escHtml(p.confiance_information)}</dd>
        ${p.caveat ? `<dt>Caveat</dt><dd>${escHtml(p.caveat)}</dd>` : ''}
        <dt>Cartographiable</dt><dd>${p.cartographiable === 'true' ? 'Oui' : 'Non'}</dd>
        ${p.cartographiable !== 'true' ? '<dd class="c1-note-nocoords">Relation non cartographiée : aucune coordonnée inventée.</dd>' : ''}
        <dt>Dernière vérification</dt><dd>${escHtml(p.derniere_verification)}</dd>
      </dl>
      ${src ? `<div class="c1-source-card">${sourceCardHtml(src)}</div>` : ''}
    `;
    setPanelContent(html);
    window._c1BackToEntreprise = (eid) => showEntrepriseFiche(eid);
  }

  function setPanelContent(html) {
    const welcome = document.getElementById('c1-panel-welcome');
    const content = document.getElementById('c1-panel-content');
    if (welcome) welcome.hidden = true;
    if (content) { content.hidden = false; content.innerHTML = html; }
  }

  function siteListItemHtml(i) {
    const badge = statusBadgeHtml(i.statut);
    return `<li class="c1-list-item" tabindex="0" onclick="window._c1ShowSite('${escAttr(i.site_intl_id)}')">
      <span class="c1-list-name">${escHtml(i.entite_locale)}</span>
      <span class="c1-list-meta">${escHtml(i.ville)}, ${escHtml(i.pays)}</span>
      ${badge}
    </li>`;
  }

  function relationListItemHtml(p) {
    const badge = statusBadgeHtml(p.statut_relation);
    return `<li class="c1-list-item" tabindex="0" onclick="window._c1ShowRelation('${escAttr(p.relation_id)}')">
      <span class="c1-list-name">${escHtml(p.partenaire)}</span>
      <span class="c1-list-meta">${escHtml(p.programme_projet)}</span>
      ${badge}
    </li>`;
  }

  // Hook global pour les onclick dans le HTML injecté
  window._c1ShowSite = (siteId) => {
    const i = data.implantations.find(x => x.site_intl_id === siteId);
    if (i) showSiteFiche(i);
  };
  window._c1ShowRelation = (relId) => {
    const p = data.partenaires.find(x => x.relation_id === relId);
    if (p) showRelationFiche(p);
  };
  window._c1BackToEntreprise = (eid) => showEntrepriseFiche(eid);

  // ─── Sources ─────────────────────────────────────────────────────────────────

  function resolveSource(sourceId) {
    if (!sourceId) return null;
    const src = data.sources.find(s => s.source_id === sourceId);
    if (!src) {
      console.warn(`[C1] Source non résolue dans le référentiel : ${sourceId}`);
      return null;
    }
    return src;
  }

  function sourceCardHtml(src) {
    if (!src) return '<p class="c1-source-unresolved">Source non résolue dans le référentiel</p>';
    const urlHtml = src.url
      ? `<a href="${escAttr(src.url)}" target="_blank" rel="noopener noreferrer">${escHtml(src.titre || src.url)}</a>`
      : escHtml(src.titre || '—');
    return `<div class="c1-source-card-inner">
      <span class="c1-source-label">Source</span>
      <span class="c1-source-title">${urlHtml}</span>
      ${src.organisme ? `<span class="c1-source-org">${escHtml(src.organisme)}</span>` : ''}
      ${src.date_publication ? `<span class="c1-source-date">${escHtml(src.date_publication)}</span>` : ''}
    </div>`;
  }

  // ─── Badges statut ───────────────────────────────────────────────────────────

  function statusBadgeHtml(statut) {
    if (!statut || statut === 'actif' || statut === 'actuelle') return '';
    const cls = statut.includes('LOI') ? 'badge-loi' :
                statut.includes('demonstration') ? 'badge-demo' :
                statut.includes('annonce') ? 'badge-annonce' : 'badge-autre';
    const label = statut.replace(/_/g,' ');
    return `<span class="c1-badge ${cls}">${escHtml(label)}</span>`;
  }

  // ─── Utilitaires HTML ────────────────────────────────────────────────────────

  function escHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function escAttr(str) {
    return escHtml(str).replace(/'/g,'&#039;');
  }

  // ─── Erreurs ─────────────────────────────────────────────────────────────────

  function showError(msg) {
    const el = document.getElementById('c1-error');
    const msgEl = document.getElementById('c1-error-msg');
    if (el) { el.hidden = false; }
    if (msgEl) msgEl.textContent = msg;
  }

  function showPartialError(msg) {
    // Affiche un message discret sans cacher les données chargées
    const existing = document.getElementById('c1-partial-errors');
    if (!existing) {
      const container = document.querySelector('.c1-page');
      if (!container) return;
      const div = document.createElement('div');
      div.id = 'c1-partial-errors';
      div.className = 'c1-partial-error';
      container.prepend(div);
    }
    const div = document.getElementById('c1-partial-errors');
    if (div) {
      const p = document.createElement('p');
      p.textContent = msg;
      div.appendChild(p);
    }
  }

  // ─── Démarrage ───────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
