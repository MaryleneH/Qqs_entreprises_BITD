(function () {
  let map;
  let nationalLayer;   // Layer for national view (siege markers)
  let focusLayer;      // Layer for focus view (all etablissements of one company)
  let constellationLayer; // Layer for constellation lines
  let panelInitialized = false;
  let activeMarker = null;

  function termHtml(termKey, label) {
    return window.BITDGlossary ? window.BITDGlossary.termHTML(termKey, label) : label;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Marker Factories
  // ──────────────────────────────────────────────────────────────────────────

  function siegeIcon(color, selected) {
    const size = selected ? 28 : 22;
    const ringSize = size + 8;
    return L.divIcon({
      className: '',
      html: `<div class="marker-siege ${selected ? 'marker-selected' : ''}" style="
        width:${size}px;height:${size}px;
        background:${color};
        box-shadow:0 0 0 3px rgba(255,255,255,0.9),0 0 0 5px ${color}55,0 3px 12px rgba(0,0,0,0.3);
        border:2px solid rgba(255,255,255,0.95);
        border-radius:50%;display:flex;align-items:center;justify-content:center;
        font-size:${size > 22 ? 11 : 9}px;color:#fff;font-weight:700;line-height:1;
      "><span>◎</span></div>`,
      iconSize: [ringSize, ringSize],
      iconAnchor: [ringSize / 2, ringSize / 2]
    });
  }

  function etablissementIcon(color, typeSite, selected) {
    const typeSymbols = {
      'production': '●',
      'R&D': '◆',
      'MCO': '▲',
      'essais': '★',
      'services': '◉',
      'autre': '●'
    };
    const symbol = typeSymbols[typeSite] || '●';
    const size = selected ? 20 : 15;
    return L.divIcon({
      className: '',
      html: `<div class="marker-etab ${selected ? 'marker-selected' : ''}" style="
        width:${size}px;height:${size}px;
        background:${color};
        border:2px solid rgba(255,255,255,0.85);
        border-radius:50%;display:flex;align-items:center;justify-content:center;
        font-size:${size > 15 ? 9 : 7}px;color:#fff;font-weight:700;line-height:1;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
      "><span style="font-size:7px">${symbol}</span></div>`,
      iconSize: [size + 4, size + 4],
      iconAnchor: [(size + 4) / 2, (size + 4) / 2]
    });
  }

  function nationalMarkerIcon(color, selected) {
    const size = selected ? 22 : 18;
    return L.divIcon({
      className: '',
      html: `<div class="bitd-marker ${selected ? 'selected' : ''}" style="
        width:${size}px;height:${size}px;
        background:${color};
        border:2.5px solid rgba(255,255,255,0.9);
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.22),0 0 0 3px rgba(255,255,255,0.3);
        cursor:pointer;
        ${selected ? 'box-shadow:0 0 0 4px rgba(201,154,74,0.5),0 4px 16px rgba(0,0,0,0.3);' : ''}
      "></div>`,
      iconSize: [size + 6, size + 6],
      iconAnchor: [(size + 6) / 2, (size + 6) / 2]
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Map init
  // ──────────────────────────────────────────────────────────────────────────

  function ensureMap() {
    const mapEl = document.getElementById('bitd-map');
    if (!mapEl || map || typeof L === 'undefined') return map;
    map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: true }).setView([46.603354, 1.888334], 5.6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    nationalLayer = L.layerGroup().addTo(map);
    focusLayer = L.layerGroup().addTo(map);
    constellationLayer = L.layerGroup().addTo(map);
    addLegend();
    return map;
  }

  function addLegend() {
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="legend-title">Secteurs</div>
        <div class="legend-items" id="legend-sectors"></div>
        <div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid rgba(255,255,255,0.15)">
          <div class="legend-item"><span style="font-size:10px;color:rgba(245,246,242,0.85);margin-right:6px">◎</span><span>Siège</span></div>
          <div class="legend-item"><span style="font-size:8px;color:rgba(245,246,242,0.85);margin-right:6px">●</span><span>Site industriel</span></div>
          <div class="legend-item"><span style="font-size:8px;color:rgba(245,246,242,0.85);margin-right:6px">◆</span><span>R&amp;D</span></div>
          <div class="legend-item"><span style="font-size:8px;color:rgba(245,246,242,0.85);margin-right:6px">▲</span><span>MCO</span></div>
          <div class="legend-item"><span style="font-size:8px;color:rgba(245,246,242,0.85);margin-right:6px">★</span><span>Essais</span></div>
        </div>`;
      setTimeout(() => {
        const sec = div.querySelector('#legend-sectors');
        if (sec && window.BITDData) {
          sec.innerHTML = Object.entries(window.BITDData.constants.sectorColors)
            .map(([s, c]) => `<div class="legend-item"><span class="legend-dot" style="background:${c}"></span><span>${s}</span></div>`)
            .join('');
        }
      }, 200);
      return div;
    };
    legend.addTo(map);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tooltip builders
  // ──────────────────────────────────────────────────────────────────────────

  function buildCompanyTooltip(row) {
    const { formatMillions, splitValues } = window.BITDData.helpers;
    const programs = splitValues(row.programmes).slice(0, 4).join(' · ');
    const etabCount = window.BITDData.getEtablissementsForCompany(row.id).length;
    return `<div class="tooltip-inner">
      <div class="tt-name">${row.entreprise}</div>
      <div class="tt-specialite">${row.specialite}</div>
      <div class="tt-location">📍 ${row.siege_ville} · ${row.siege_region}</div>
      <div class="tt-stats">
        <div><div class="tt-stat-label">Implantations</div><div class="tt-stat-value">${etabCount}</div></div>
        <div><div class="tt-stat-label">CA / Défense</div><div class="tt-stat-value">${row.ca_defense_num != null ? formatMillions(row.ca_defense_num) : 'n.c.'}</div></div>
        ${programs ? `<div style="grid-column:1/-1"><div class="tt-stat-label">Programmes</div><div class="tt-stat-value" style="font-size:0.68rem">${programs}</div></div>` : ''}
      </div>
    </div>`;
  }

  function buildEtabTooltip(etab, company) {
    const typeLabels = { 'siege': 'SIÈGE', 'production': 'Production', 'R&D': 'R&D', 'MCO': 'MCO', 'essais': 'Essais', 'services': 'Services', 'autre': 'Site' };
    const typeLabel = typeLabels[etab.type_site] || etab.type_site;
    const specs = (etab.specialites || []).slice(0, 3).join(' · ');
    const progs = (etab.programmes || []).slice(0, 4).join(' · ');
    const isSiege = etab.est_siege;

    return `<div class="tooltip-inner">
      <div class="tt-name" style="display:flex;align-items:center;gap:0.5rem">
        ${company ? `<span>${company.entreprise}</span>` : ''}
        ${isSiege ? '<span class="badge-siege-tt">SIÈGE</span>' : `<span class="badge-type-tt">${typeLabel}</span>`}
      </div>
      <div class="tt-specialite" style="font-weight:600;color:#162033;font-style:normal">${etab.ville}</div>
      ${specs ? `<div class="tt-specialite">${specs}</div>` : ''}
      <div class="tt-location">📍 ${etab.departement} · ${etab.region}</div>
      ${etab.activite ? `<div class="tt-stats"><div><div class="tt-stat-label">Activité</div><div class="tt-stat-value" style="font-size:0.7rem">${etab.activite}</div></div></div>` : ''}
      ${progs ? `<div class="tt-stats"><div style="grid-column:1/-1"><div class="tt-stat-label">Programmes</div><div class="tt-stat-value" style="font-size:0.68rem">${progs}</div></div></div>` : ''}
    </div>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // National view
  // ──────────────────────────────────────────────────────────────────────────

  function renderNationalMarkers(rows) {
    const currentMap = ensureMap();
    if (!currentMap) return;
    nationalLayer.clearLayers();
    focusLayer.clearLayers();
    constellationLayer.clearLayers();
    activeMarker = null;

    rows.forEach((row) => {
      if (row.latitude == null || row.longitude == null) return;
      const color = window.BITDData.constants.sectorColors[row.primarySector] || '#5F7F82';
      const marker = L.marker([row.latitude, row.longitude], { icon: nationalMarkerIcon(color, false) });
      marker.bindTooltip(buildCompanyTooltip(row), {
        className: 'bitd-tooltip', direction: 'top', offset: [0, -12]
      });
      marker.on('click', () => {
        window.BITDData.selectCompany(row.id);
        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('entreprise', row.id);
        window.history.pushState({}, '', url);
      });
      marker.addTo(nationalLayer);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Focus view
  // ──────────────────────────────────────────────────────────────────────────

  function renderFocusView(company, etabs) {
    const currentMap = ensureMap();
    if (!currentMap) return;
    nationalLayer.clearLayers();
    focusLayer.clearLayers();
    constellationLayer.clearLayers();
    activeMarker = null;

    const color = window.BITDData.constants.sectorColors[company.primarySector] || '#5F7F82';
    const bounds = [];
    const markerMap = {};
    let siegeLatLng = null;

    etabs.forEach((etab) => {
      if (etab.latitude == null || etab.longitude == null) return;
      const latlng = [etab.latitude, etab.longitude];
      bounds.push(latlng);

      const icon = etab.est_siege
        ? siegeIcon(color, false)
        : etablissementIcon(color, etab.type_site, false);

      const marker = L.marker(latlng, { icon });
      marker.bindTooltip(buildEtabTooltip(etab, company), {
        className: 'bitd-tooltip', direction: 'top', offset: [0, -12]
      });
      marker.on('click', () => {
        highlightMarker(marker, etab, color, company);
        document.dispatchEvent(new CustomEvent('bitd:etab-highlighted', { detail: { etab } }));
      });
      marker.addTo(focusLayer);
      markerMap[etab.site_id] = marker;

      if (etab.est_siege) siegeLatLng = latlng;
    });

    // Constellation lines from siège to each établissement
    if (siegeLatLng) {
      etabs.forEach((etab) => {
        if (etab.est_siege || etab.latitude == null) return;
        const line = L.polyline([siegeLatLng, [etab.latitude, etab.longitude]], {
          color: color,
          weight: 1,
          opacity: 0.22,
          dashArray: '4 6'
        });
        line.addTo(constellationLayer);
      });
    }

    // Store markerMap for external interactions
    window._bitdFocusMarkers = markerMap;

    if (bounds.length > 1) {
      currentMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 10, animate: true, duration: 0.5 });
    } else if (bounds.length === 1) {
      currentMap.setView(bounds[0], 8, { animate: true, duration: 0.5 });
    }
  }

  function highlightMarker(marker, etab, color, company) {
    // Reset previously active
    if (activeMarker && activeMarker !== marker) {
      const prevEtab = activeMarker._etabData;
      if (prevEtab) {
        const prevIcon = prevEtab.est_siege
          ? siegeIcon(color, false)
          : etablissementIcon(color, prevEtab.type_site, false);
        activeMarker.setIcon(prevIcon);
      }
    }
    activeMarker = marker;
    marker._etabData = etab;
    const newIcon = etab.est_siege
      ? siegeIcon(color, true)
      : etablissementIcon(color, etab.type_site, true);
    marker.setIcon(newIcon);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Panel management
  // ──────────────────────────────────────────────────────────────────────────

  function renderNationalPanel(row) {
    const panel = document.getElementById('map-side-panel');
    const content = document.getElementById('map-side-panel-content');
    if (!panel || !content || !row) return;
    const { makeSectorBadge, splitValues, formatMillions } = window.BITDData.helpers;
    const sectorBadges = row.sectors.map(makeSectorBadge).join(' ');
    const etabs = window.BITDData.getEtablissementsForCompany(row.id);
    content.innerHTML = `
      <h3>${row.entreprise}</h3>
      <p>${sectorBadges}</p>
      <p class="small-note">${row.specialite}</p>
      <div class="detail-list">
        <div class="detail-item"><strong>Siège</strong><span>${row.siege_ville}, ${row.siege_region}</span></div>
        <div class="detail-item"><strong>Empreinte territoriale</strong><span>${etabs.length} implantation(s) cartographiée(s) dans ${row.regions_count} région(s)</span></div>
        <div class="detail-item"><strong>Effectif</strong><span>${row.effectif_label}</span></div>
        <div class="detail-item"><strong>${termHtml('ca_defense', 'CA Défense')}</strong><span>${row.ca_defense_label}</span></div>
        <div class="detail-item"><strong>${termHtml('carnet_commandes', 'Carnet de commandes')}</strong><span>${row.carnet_num == null ? 'n.c.' : formatMillions(row.carnet_num)}</span></div>
        <div class="detail-item"><strong>Indicateur financier</strong><span>${row.financial_indicator.value === 'n.c.' ? 'n.c.' : `${row.financial_indicator.label} · ${row.financial_indicator.value} (${row.financial_indicator.type})`}</span></div>
        <div class="detail-item"><strong>Programmes</strong><span>${splitValues(row.programmes).join(' · ')}</span></div>
        <div class="detail-item"><strong>Sites principaux</strong><span>${splitValues(row.sites_industriels).join(' · ')}</span></div>
        <div class="detail-item"><strong>Actionnariat</strong><span>${row.actionnariat}</span></div>
        <div class="detail-item"><strong>Ressource</strong><span><a href="${row.site_web}" target="_blank" rel="noreferrer">${row.site_web.replace(/^https?:\/\//, '')}</a></span></div>
      </div>`;
    panel.classList.add('is-open');
    if (window.BITDGlossary) window.BITDGlossary.initRoot(content);
  }

  function renderFocusPanel(company, etabs) {
    const panel = document.getElementById('map-side-panel');
    const content = document.getElementById('map-side-panel-content');
    if (!panel || !content) return;
    const { makeSectorBadge, splitValues, formatMillions } = window.BITDData.helpers;

    const regions = [...new Set(etabs.map((e) => e.region).filter(Boolean))];
    const typeCounts = etabs.reduce((acc, e) => { acc[e.type_site] = (acc[e.type_site] || 0) + 1; return acc; }, {});
    const typeLabels = { 'siege': 'Siège', 'production': 'Production', 'R&D': 'R&D', 'MCO': 'MCO', 'essais': 'Essais', 'services': 'Services', 'autre': 'Autre' };

    const typeSummary = Object.entries(typeCounts)
      .map(([t, n]) => `<span class="etab-type-count"><span class="etab-type-dot type-${t}"></span>${n} ${typeLabels[t] || t}</span>`)
      .join('');

    const sectorBadges = company.sectors.map(makeSectorBadge).join(' ');

    const etabList = etabs.map((etab) => {
      const symbol = etab.est_siege ? '◎' : '●';
      const desc = etab.description_courte || etab.activite || '';
      return `<div class="etab-list-item" data-site="${etab.site_id}" role="button" tabindex="0"
        aria-label="${etab.nom_site}">
        <span class="etab-symbol">${symbol}</span>
        <div class="etab-item-body">
          <strong>${etab.ville}</strong>${etab.est_siege ? ' <span class="badge-siege-sm">SIÈGE</span>' : ''}
          ${desc ? `<div class="etab-item-desc">${desc}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    content.innerHTML = `
      <button class="btn-back-national" id="btn-back-national" type="button">← Retour aux 30 entreprises</button>
      <h3 style="margin-top:0.75rem">${company.entreprise}</h3>
      <p>${sectorBadges}</p>
      <p class="small-note">${company.specialite}</p>

      <div class="focus-kpi-grid">
        <div class="focus-kpi"><div class="focus-kpi-val">${etabs.length}</div><div class="focus-kpi-lbl">implantations</div></div>
        <div class="focus-kpi"><div class="focus-kpi-val">${regions.length}</div><div class="focus-kpi-lbl">régions</div></div>
      </div>
      <div class="etab-type-summary">${typeSummary}</div>

      <div class="detail-list detail-list--light">
        <div class="detail-item"><strong>${termHtml('ca_defense', 'CA Défense')}</strong><span>${company.ca_defense_label}</span></div>
        <div class="detail-item"><strong>${termHtml('carnet_commandes', 'Carnet de commandes')}</strong><span>${company.carnet_num == null ? 'n.c.' : formatMillions(company.carnet_num)}</span></div>
        <div class="detail-item"><strong>Indicateur financier</strong><span>${company.financial_indicator.value === 'n.c.' ? 'n.c.' : `${company.financial_indicator.label} · ${company.financial_indicator.value} (${company.financial_indicator.type})`}</span></div>
        <div class="detail-item"><strong>Programmes phares</strong><span>${splitValues(company.programmes).join(' · ') || 'n.c.'}</span></div>
        <div class="detail-item"><strong>Actionnariat</strong><span>${company.actionnariat}</span></div>
      </div>

      <div class="section-hand" style="font-size:0.7rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.07em;margin:0.85rem 0 0.4rem">Implantations</div>
      <div class="etab-list" id="etab-list">${etabList}</div>
      <div style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid var(--border)">
        <a href="${company.site_web}" target="_blank" rel="noreferrer" class="btn-site">${company.site_web.replace(/^https?:\/\//, '')} ↗</a>
      </div>`;

    panel.classList.add('is-open');
    if (window.BITDGlossary) window.BITDGlossary.initRoot(content);

    // Back button
    document.getElementById('btn-back-national').addEventListener('click', () => {
      window.BITDData.clearSelection();
      const url = new URL(window.location.href);
      url.searchParams.delete('entreprise');
      window.history.pushState({}, '', url);
    });

    // Click on list items → highlight map marker + pan
    panel.querySelectorAll('.etab-list-item').forEach((item) => {
      const handler = () => {
        const siteId = item.getAttribute('data-site');
        const marker = window._bitdFocusMarkers && window._bitdFocusMarkers[siteId];
        const etab = etabs.find((e) => e.site_id === siteId);
        if (!etab) return;
        if (marker) {
          const color = window.BITDData.constants.sectorColors[company.primarySector] || '#5F7F82';
          highlightMarker(marker, etab, color, company);
          if (etab.latitude != null && etab.longitude != null) {
            map.setView([etab.latitude, etab.longitude], Math.max(map.getZoom(), 9), { animate: true });
          }
          marker.openTooltip();
        }
        panel.querySelectorAll('.etab-list-item').forEach((el) => el.classList.remove('active'));
        item.classList.add('active');
      };
      item.addEventListener('click', handler);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler(); });
    });
  }

  function wirePanelClose() {
    if (panelInitialized) return;
    panelInitialized = true;
    const close = document.getElementById('close-map-panel');
    const panel = document.getElementById('map-side-panel');
    if (!close || !panel) return;
    close.addEventListener('click', () => panel.classList.remove('is-open'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mode control UI
  // ──────────────────────────────────────────────────────────────────────────

  function updateModeControl(mode) {
    const btnNational = document.getElementById('mode-national');
    const btnFocus = document.getElementById('mode-focus');
    if (!btnNational || !btnFocus) return;
    if (mode === 'national') {
      btnNational.classList.add('active');
      btnFocus.classList.remove('active');
    } else {
      btnFocus.classList.add('active');
      btnNational.classList.remove('active');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // URL param handling
  // ──────────────────────────────────────────────────────────────────────────

  function checkUrlParam() {
    const params = new URLSearchParams(window.location.search);
    const companyId = params.get('entreprise');
    if (companyId && window.BITDData.getState().allRows.length) {
      window.BITDData.selectCompany(companyId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Event listeners
  // ──────────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.BITDData || !document.getElementById('bitd-map')) return;
    ensureMap();
    wirePanelClose();

    // National mode: register as consumer
    window.BITDData.registerConsumer((rows) => {
      const st = window.BITDData.getState();
      if (st.mapMode === 'national') {
        renderNationalMarkers(rows);
        updateModeControl('national');
      }
    });

    // Company selected → focus mode
    document.addEventListener('bitd:company-selected', (evt) => {
      const { company, etablissements } = evt.detail;
      renderFocusView(company, etablissements);
      renderFocusPanel(company, etablissements);
      updateModeControl('focus');
    });

    // Company cleared → national mode
    document.addEventListener('bitd:company-cleared', () => {
      const st = window.BITDData.getState();
      renderNationalMarkers(st.filteredRows);
      updateModeControl('national');
      const panel = document.getElementById('map-side-panel');
      if (panel) {
        panel.classList.remove('is-open');
        const content = document.getElementById('map-side-panel-content');
        if (content) content.innerHTML = '<h3>Sélection carte</h3><p class="small-note">Cliquez sur un marqueur pour afficher le détail entreprise.</p>';
      }
      // Reset to France view
      if (map) map.setView([46.603354, 1.888334], 5.6, { animate: true });
    });

    // Etab highlighted from list → open tooltip on map
    document.addEventListener('bitd:etab-highlighted', (evt) => {
      const { etab } = evt.detail;
      const panel = document.getElementById('map-side-panel');
      if (!panel) return;
      panel.querySelectorAll('.etab-list-item').forEach((el) => el.classList.remove('active'));
      const item = panel.querySelector(`[data-site="${etab.site_id}"]`);
      if (item) item.classList.add('active');
    });

    // Mode control buttons
    document.addEventListener('click', (e) => {
      if (e.target.id === 'mode-national') {
        window.BITDData.clearSelection();
        const url = new URL(window.location.href);
        url.searchParams.delete('entreprise');
        window.history.pushState({}, '', url);
      }
      if (e.target.id === 'mode-focus') {
        // noop — mode focus is entered by clicking a company
      }
    });

    // Load data then check URL param
    window.BITDData.loadEntreprises().then(() => {
      setTimeout(checkUrlParam, 100);
    });
  });
})();
