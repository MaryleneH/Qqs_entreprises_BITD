(function () {
  let map;
  let nationalLayer;
  let focusLayer;
  let activeSiteId = null;
  const markerIndex = new Map();
  const markerData = new Map();
  let currentFocusColor = null;

  const FRANCE_VIEW = { center: [46.603354, 1.888334], zoom: 5.6 };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isMobileViewport() {
    return window.innerWidth <= 900;
  }

  function normalizeStatusLabel(label) {
    const raw = (label || '').toString().trim();
    if (!raw) return 'actif';
    return raw;
  }

  function bitdMessage(etab) {
    if (etab.bitd_status === 'confirme') return '✓ Activité BITD documentée';
    if (etab.bitd_status === 'a_confirmer') return '◎ Activité BITD locale à documenter';
    if (etab.bitd_status === 'non_identifie') return 'Activité BITD locale non identifiée dans les sources disponibles.';
    return '';
  }

  function precisionMessage(etab) {
    const precision = (etab.precision_coordonnees || '').toLowerCase();
    if (precision.includes('ville') || precision.includes('commune')) {
      return "Localisation approximative à l\u2019échelle de la commune";
    }
    return '';
  }

  // --- SVG icons for site types ---
  const SVG_ICONS = {
    production: '<svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor"><path d="M1 10V5l3-2v2l3-2v2l3-2v7H1zm1-1h8V6.5L8 8V6L5 8V6L2 7.5V9z"/></svg>',
    recherche: '<svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor"><path d="M5 2a3 3 0 100 6 3 3 0 000-6zm-1 3a2 2 0 114 0 2 2 0 01-4 0zm5.3 2.3l2.4 2.4-.7.7-2.4-2.4.7-.7z"/></svg>',
    mco: '<svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor"><path d="M8.5 1.5a1.5 1.5 0 00-1.06.44L6 3.38 2.5 6.88 2 10l3.12-.5 3.5-3.5 1.44-1.44A1.5 1.5 0 008.5 1.5zm-4.4 6.25l-.6.6-.9.15.15-.9.6-.6.75.75z"/></svg>',
    essais: '<svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="6" r="0.8"/></svg>',
    services: '<svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor"><path d="M2 10V5.5L6 2l4 3.5V10H7.5V7h-3v3H2z"/></svg>',
    default: ''
  };

  function getTypeSvg(typeSite) {
    const t = (typeSite || '').toLowerCase();
    if (t.includes('production') || t.includes('fabrication') || t.includes('usine')) return SVG_ICONS.production;
    if (t.includes('r&d') || t.includes('recherche') || t.includes('bureau') || t.includes('labo')) return SVG_ICONS.recherche;
    if (t.includes('mco') || t.includes('maintenance') || t.includes('entretien')) return SVG_ICONS.mco;
    if (t.includes('essai') || t.includes('test')) return SVG_ICONS.essais;
    if (t.includes('service') || t.includes('siège') || t.includes('siege') || t.includes('quartier')) return SVG_ICONS.services;
    return SVG_ICONS.default;
  }

  function ensureMap() {
    const mapEl = document.getElementById('bitd-map');
    if (!mapEl || map || typeof L === 'undefined') return map;

    map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: true }).setView(FRANCE_VIEW.center, FRANCE_VIEW.zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    nationalLayer = L.layerGroup().addTo(map);
    focusLayer = L.layerGroup().addTo(map);
    addLegend();
    return map;
  }

  function addLegend() {
    if (!map) return;
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend map-legend--simple');
      div.innerHTML = `
        <div class="legend-title">Légende</div>
        <div class="legend-item">
          <span class="legend-symbol legend-symbol--siege">
            <svg viewBox="0 0 14 14" width="12" height="12" fill="rgba(245,246,242,0.9)"><path d="M7 1l1.6 4.4H14l-3.7 2.7 1.4 4.4L7 9.8 2.3 12.5l1.4-4.4L0 5.4h5.4z"/></svg>
          </span>
          <span>Siège</span>
        </div>
        <div class="legend-item"><span class="legend-symbol legend-symbol--active">●</span><span>Établissement actif</span></div>
        <div class="legend-item"><span class="legend-symbol legend-symbol--inactive">○</span><span>Établissement inactif</span></div>
      `;
      return div;
    };
    legend.addTo(map);
  }

  function companyIcon(color, selected) {
    const size = selected ? 24 : 20;
    return L.divIcon({
      className: '',
      html: `<span class="marker-company ${selected ? 'is-selected' : ''}" style="--marker-color:${color};width:${size}px;height:${size}px"></span>`,
      iconSize: [size + 8, size + 8],
      iconAnchor: [(size + 8) / 2, (size + 8) / 2]
    });
  }

  function siegeIcon(color, selected) {
    const outer = selected ? 44 : 36;
    const svgSize = selected ? 15 : 12;
    return L.divIcon({
      className: '',
      html: `<div class="marker-siege${selected ? ' is-selected' : ''}" style="--mc:${color};width:${outer}px;height:${outer}px"><svg viewBox="0 0 20 20" width="${svgSize}" height="${svgSize}" fill="white" stroke="none"><path d="M10 1l2.4 6.6H19l-5.5 4 2.1 6.6L10 14 4.4 18.2l2.1-6.6L1 7.6h6.6z"/></svg></div>`,
      iconSize: [outer, outer],
      iconAnchor: [outer / 2, outer / 2]
    });
  }

  function etabIcon(color, etab, selected) {
    const isInactive = !etab.sirene_is_active;
    const typeSvg = getTypeSvg(etab.type_site);
    const cls = isInactive ? 'marker-etab--inactive' : 'marker-etab--active';
    const size = isInactive ? (selected ? 18 : 14) : (selected ? 22 : 18);
    const style = isInactive ? `width:${size}px;height:${size}px` : `--mc:${color};width:${size}px;height:${size}px`;
    return L.divIcon({
      className: '',
      html: `<div class="${cls}${selected ? ' is-selected' : ''}" style="${style}">${typeSvg}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  // Keep legacy siteIcon for any remaining references
  function siteIcon(color, etab, selected) {
    if (etab.est_siege) return siegeIcon(color, selected);
    return etabIcon(color, etab, selected);
  }

  function getPopupHtml(etab, company) {
    const title = escapeHtml(company?.entreprise || etab.entreprise || 'Entreprise');
    const city = escapeHtml(etab.ville || etab.nom_site || 'Ville non renseignée');
    const type = escapeHtml(etab.type_site || (etab.est_siege ? 'Siège' : 'Établissement SIRENE'));
    const region = escapeHtml(etab.region || 'Région non renseignée');
    const dep = escapeHtml(etab.departement || '');
    const activityLabel = escapeHtml(etab.activite || etab.ape_label || 'Non documentée');
    const programmes = (etab.programmes || []).slice(0, 4).map(escapeHtml).join(' · ');
    const sireneLabel = normalizeStatusLabel(etab.sirene_status_label);
    const sireneLine = etab.sirene_is_active ? '● Établissement actif' : `○ ${escapeHtml(sireneLabel)}`;
    const bitdLine = bitdMessage(etab);
    const precisionLine = precisionMessage(etab);
    const inactiveBadge = etab.sirene_is_active ? '' : '<div class="popup-badge popup-badge--inactive">ÉTABLISSEMENT FERMÉ / INACTIF</div>';

    return `
      <article class="site-popup">
        <h3>${title}${etab.est_siege ? ' <span class="popup-badge popup-badge--siege">★ SIÈGE</span>' : ''}</h3>
        <p class="site-popup__city">${city}</p>
        <p class="site-popup__type">${type}</p>
        <p class="site-popup__geo">📍 ${dep ? `${dep} · ` : ''}${region}</p>
        ${inactiveBadge}
        <div class="site-popup__section"><strong>Activité</strong>${activityLabel}</div>
        ${programmes ? `<div class="site-popup__section"><strong>Programmes</strong>${programmes}</div>` : ''}
        <div class="site-popup__meta">${escapeHtml(sireneLine)}</div>
        ${bitdLine ? `<div class="site-popup__meta">${escapeHtml(bitdLine)}</div>` : ''}
        ${precisionLine ? `<div class="site-popup__meta">${escapeHtml(precisionLine)}</div>` : ''}
      </article>
    `;
  }

  function getNationalPopupHtml(company, activeCount, totalCount) {
    return `
      <article class="site-popup">
        <h3>${escapeHtml(company.entreprise)}</h3>
        <p class="site-popup__city">${escapeHtml(company.siege_ville || 'Siège')}</p>
        <p class="site-popup__geo">📍 ${escapeHtml(company.siege_region || '')}</p>
        <div class="site-popup__section"><strong>Implantations</strong>${activeCount} établissement${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}${totalCount !== activeCount ? ` · ${totalCount} au total` : ''}</div>
        <div class="site-popup__meta" style="margin-top:0.5rem;font-style:italic;">Cliquez pour explorer les établissements</div>
      </article>
    `;
  }

  function setContext(snapshot, visibleEtabs, allCompanyEtabs) {
    const title = document.getElementById('map-context-title');
    const subtitle = document.getElementById('map-context-subtitle');
    const note = document.getElementById('map-context-note');
    const counter = document.getElementById('site-count');

    if (!title || !subtitle || !counter || !snapshot) return;

    if (!snapshot.entrepriseId || !snapshot.selectedCompany) {
      title.textContent = '30 entreprises de la BITD';
      subtitle.textContent = 'Sélectionnez une entreprise pour explorer ses établissements.';
      counter.textContent = `${snapshot.allRows.length} entreprises · Vue nationale`;
      if (note) note.textContent = '';
      return;
    }

    const company = snapshot.selectedCompany;
    const regions = new Set(visibleEtabs.map((e) => e.region).filter(Boolean));
    title.textContent = company.entreprise;

    if (snapshot.statutEtablissements === 'tous') {
      subtitle.textContent = `${allCompanyEtabs.length} établissements au total · ${regions.size} régions`;
      counter.textContent = `${company.entreprise} · ${allCompanyEtabs.length} établissements au total`;
    } else {
      subtitle.textContent = `${visibleEtabs.length} établissements actifs affichés · ${regions.size} régions`;
      counter.textContent = `${company.entreprise} · ${visibleEtabs.length} établissements actifs affichés`;
    }

    if (note) {
      note.innerHTML = `Statut <span class="term-definition" data-term="etablissement_actif">établissement actif</span> basé sur les colonnes SIRENE disponibles.`;
      if (window.BITDGlossary) window.BITDGlossary.initRoot(note);
    }
  }

  function updateUrl(snapshot) {
    const url = new URL(window.location.href);
    if (snapshot.entrepriseId) url.searchParams.set('entreprise', snapshot.entrepriseId);
    else url.searchParams.delete('entreprise');

    if (snapshot.statutEtablissements === 'tous') url.searchParams.set('etablissements', 'tous');
    else url.searchParams.delete('etablissements');

    window.history.replaceState({}, '', url);
  }

  function selectEntreprise(companyId) {
    if (!window.BITDData) return;
    window.BITDData.setEntreprise(companyId || null);
  }

  function setEtabFilter(mode) {
    if (!window.BITDData) return;
    window.BITDData.setStatutEtablissements(mode);
  }

  function syncControlValues(snapshot) {
    const select = document.getElementById('entreprise-select');
    const buttons = document.querySelectorAll('.segmented-btn[data-etab-filter]');
    if (select) select.value = snapshot.entrepriseId || '';

    buttons.forEach((button) => {
      const isActive = button.getAttribute('data-etab-filter') === snapshot.statutEtablissements;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function setActiveSite(siteId) {
    const prevId = activeSiteId;
    activeSiteId = siteId || null;

    // Refresh icon for previous and new active marker
    [prevId, activeSiteId].forEach((sid) => {
      if (!sid) return;
      const marker = markerIndex.get(sid);
      const etab = markerData.get(sid);
      if (!marker || !etab || !currentFocusColor) return;
      const isSelected = sid === activeSiteId;
      marker.setIcon(etab.est_siege ? siegeIcon(currentFocusColor, isSelected) : etabIcon(currentFocusColor, etab, isSelected));
    });

    const panel = document.getElementById('company-panel-content');
    if (!panel) return;
    panel.querySelectorAll('.site-list-item').forEach((item) => {
      item.classList.toggle('is-active', item.getAttribute('data-site-id') === activeSiteId);
    });
  }

  function renderNational(snapshot) {
    ensureMap();
    if (!map) return;
    markerIndex.clear();
    markerData.clear();
    activeSiteId = null;
    currentFocusColor = null;
    nationalLayer.clearLayers();
    focusLayer.clearLayers();

    const companies = window.BITDData.getMapNationalCompanies();
    const bounds = [];

    companies.forEach((company) => {
      if (company.latitude == null || company.longitude == null) return;
      const color = window.BITDData.constants.sectorColors[company.primarySector] || '#5F7F82';
      const marker = L.marker([company.latitude, company.longitude], { icon: companyIcon(color, false) });
      const allEtabs = window.BITDData.getEtablissementsForCompany(company.id);
      const activeEtabs = allEtabs.filter((etab) => etab.sirene_is_active);
      marker.bindPopup(getNationalPopupHtml(company, activeEtabs.length, allEtabs.length), {
        className: 'bitd-popup',
        maxWidth: 320
      });
      marker.on('click', () => {
        selectEntreprise(company.id);
      });
      marker.addTo(nationalLayer);
      bounds.push([company.latitude, company.longitude]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6, animate: true });
    } else {
      map.setView(FRANCE_VIEW.center, FRANCE_VIEW.zoom, { animate: true });
    }

    const panel = document.getElementById('company-panel-content');
    if (panel) {
      panel.innerHTML = `
        <h3>Vue nationale</h3>
        <p class="small-note">30 sièges d'entreprise affichés pour garder une lecture claire du territoire.</p>
        <p class="small-note">Cliquez sur un siège ou utilisez le menu pour passer en focus entreprise.</p>
      `;
    }
  }

  function renderCompanyPanel(company, visibleEtabs, allEtabs, statutMode) {
    const panel = document.getElementById('company-panel-content');
    if (!panel) return;

    const regions = new Set(visibleEtabs.map((e) => e.region).filter(Boolean));
    const secteurs = (company.sectors || []).slice(0, 3).join(' · ');

    const companyInfos = [
      company.specialite ? `<li><strong>Spécialité :</strong> ${escapeHtml(company.specialite)}</li>` : '',
      company.siege_ville ? `<li><strong>Siège :</strong> ${escapeHtml(company.siege_ville)}${company.siege_region ? `, ${escapeHtml(company.siege_region)}` : ''}</li>` : '',
      company.effectif_label ? `<li><strong>Effectif :</strong> ${escapeHtml(company.effectif_label)}</li>` : '',
      company.programmes ? `<li><strong>Programmes :</strong> ${escapeHtml(company.programmes)}</li>` : '',
      company.site_web ? `<li><strong>Site :</strong> <a href="${escapeHtml(company.site_web)}" target="_blank" rel="noreferrer">${escapeHtml(company.site_web.replace(/^https?:\/\//, ''))}</a></li>` : ''
    ].filter(Boolean).join('');

    const listRows = visibleEtabs.map((etab) => {
      const statusText = etab.sirene_is_active ? 'Actif' : 'Inactif';
      const role = etab.est_siege ? 'Siège' : (etab.type_site || 'Établissement');
      return `
        <button type="button" class="site-list-item ${!etab.sirene_is_active ? 'is-inactive' : ''}" data-site-id="${escapeHtml(etab.site_id)}">
          <span class="site-list-symbol">${etab.est_siege ? '★' : (etab.sirene_is_active ? '●' : '○')}</span>
          <span class="site-list-main">
            <strong>${escapeHtml(etab.ville || etab.nom_site || 'Site')}</strong>
            <span>${escapeHtml(role)} · ${statusText}</span>
            <span>${escapeHtml(etab.region || 'Région non renseignée')}</span>
          </span>
        </button>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="panel-top-actions">
        <button type="button" id="back-to-national" class="back-to-national">← Vue des 30 entreprises</button>
      </div>
      <h3>${escapeHtml(company.entreprise)}</h3>
      <p class="small-note">${escapeHtml(secteurs || company.specialite || '')}</p>
      <div class="panel-kpis">
        <div><strong>${statutMode === 'tous' ? allEtabs.length : visibleEtabs.length}</strong><span>${statutMode === 'tous' ? 'établissements affichés' : 'établissements actifs'}</span></div>
        <div><strong>${regions.size}</strong><span>régions</span></div>
      </div>
      <ul class="panel-company-infos">${companyInfos}</ul>
      <h4>Implantations</h4>
      <div class="site-list" id="site-list">${listRows || '<p class="small-note">Aucun site avec coordonnées pour ce filtre.</p>'}</div>
    `;

    const back = document.getElementById('back-to-national');
    if (back) {
      back.addEventListener('click', () => {
        selectEntreprise(null);
      });
    }

    panel.querySelectorAll('.site-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        const siteId = item.getAttribute('data-site-id');
        const marker = markerIndex.get(siteId);
        if (!marker) return;
        const latLng = marker.getLatLng();
        map.setView(latLng, Math.max(map.getZoom(), 8), { animate: true });
        marker.openPopup();
        setActiveSite(siteId);
      });
    });
  }

  function renderFocus(snapshot) {
    ensureMap();
    if (!map || !snapshot.selectedCompany) return;

    markerIndex.clear();
    markerData.clear();
    activeSiteId = null;
    nationalLayer.clearLayers();
    focusLayer.clearLayers();

    const company = snapshot.selectedCompany;
    const allEtabs = window.BITDData.getEtablissementsForCompany(company.id);
    const visibleEtabs = window.BITDData.getVisibleEstablishments();
    const color = window.BITDData.constants.sectorColors[company.primarySector] || '#5F7F82';
    currentFocusColor = color;
    const bounds = [];

    // Find siege
    const siegeEtab = visibleEtabs.find((e) => e.est_siege);

    // Draw constellation lines FIRST (so markers appear on top)
    if (siegeEtab && siegeEtab.latitude != null && siegeEtab.longitude != null) {
      visibleEtabs.forEach((etab) => {
        if (etab === siegeEtab || etab.latitude == null || etab.longitude == null) return;
        const lineOpacity = etab.sirene_is_active ? 0.28 : 0.13;
        L.polyline(
          [[siegeEtab.latitude, siegeEtab.longitude], [etab.latitude, etab.longitude]],
          {
            color: color,
            weight: 1.2,
            opacity: lineOpacity,
            dashArray: '4 6',
            interactive: false
          }
        ).addTo(focusLayer);
      });
    }

    // Draw establishment markers
    visibleEtabs.forEach((etab) => {
      if (etab.latitude == null || etab.longitude == null) return;
      const icon = etab.est_siege ? siegeIcon(color, false) : etabIcon(color, etab, false);
      const marker = L.marker([etab.latitude, etab.longitude], { icon, zIndexOffset: etab.est_siege ? 1000 : 0 });
      marker.bindPopup(getPopupHtml(etab, company), {
        className: 'bitd-popup',
        maxWidth: 360,
        autoPanPadding: [16, 16]
      });
      marker.on('click', () => {
        setActiveSite(etab.site_id);
      });
      marker.addTo(focusLayer);
      markerIndex.set(etab.site_id, marker);
      markerData.set(etab.site_id, etab);
      bounds.push([etab.latitude, etab.longitude]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: isMobileViewport() ? [32, 32] : [46, 46], maxZoom: 10, animate: true });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 9, { animate: true });
    } else if (company.latitude != null && company.longitude != null) {
      map.setView([company.latitude, company.longitude], 7.5, { animate: true });
    }

    renderCompanyPanel(company, visibleEtabs, allEtabs, snapshot.statutEtablissements);
  }

  function fillEntrepriseSelect(snapshot) {
    const select = document.getElementById('entreprise-select');
    if (!select) return;
    const current = snapshot.entrepriseId || '';
    const options = ['<option value="">Toutes les entreprises</option>']
      .concat(snapshot.allRows
        .slice()
        .sort((a, b) => a._order - b._order)
        .map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.entreprise)}</option>`));
    select.innerHTML = options.join('');
    select.value = current;
  }

  function applyUrlStateWhenReady(snapshot) {
    if (!snapshot.allRows.length) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrlEntreprise = params.get('entreprise');
    const fromUrlEtabs = params.get('etablissements');

    if (fromUrlEtabs === 'tous') {
      window.BITDData.setStatutEtablissements('tous');
    }

    if (fromUrlEntreprise && snapshot.allRows.some((row) => row.id === fromUrlEntreprise)) {
      window.BITDData.setEntreprise(fromUrlEntreprise);
    }
  }

  function render(snapshot) {
    fillEntrepriseSelect(snapshot);
    syncControlValues(snapshot);

    const visibleEtabs = snapshot.entrepriseId ? window.BITDData.getVisibleEstablishments() : [];
    const allCompanyEtabs = snapshot.entrepriseId ? window.BITDData.getEtablissementsForCompany(snapshot.entrepriseId) : [];
    setContext(snapshot, visibleEtabs, allCompanyEtabs);

    if (snapshot.entrepriseId && snapshot.selectedCompany) {
      renderFocus(snapshot);
    } else {
      renderNational(snapshot);
    }

    updateUrl(snapshot);
  }

  function bindControls() {
    const select = document.getElementById('entreprise-select');
    const buttons = document.querySelectorAll('.segmented-btn[data-etab-filter]');
    if (select) {
      select.addEventListener('change', () => {
        selectEntreprise(select.value || null);
      });
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        setEtabFilter(button.getAttribute('data-etab-filter'));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.BITDData || !document.getElementById('bitd-map')) return;
    ensureMap();
    bindControls();

    let urlApplied = false;
    window.BITDData.subscribe((snapshot) => {
      if (!urlApplied && snapshot.allRows.length) {
        urlApplied = true;
        applyUrlStateWhenReady(snapshot);
      }
      render(snapshot);
      if (window.BITDGlossary) window.BITDGlossary.initRoot(document);
    });

    window.BITDData.loadEntreprises().catch((error) => console.error(error));
  });
})();
