(function () {
  let map;
  let markersLayer;
  let panelInitialized = false;

  function markerIcon(color) {
    return L.divIcon({
      className: 'leaflet-div-icon',
      html: `<div class="custom-marker" style="background:${color}; color:${color}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function ensureMap() {
    const mapEl = document.getElementById('bitd-map');
    if (!mapEl || map || typeof L === 'undefined') return map;
    map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: true }).setView([46.603354, 1.888334], 5.6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend-card surface-card');
      const items = Object.entries(window.BITDData.constants.sectorColors)
        .map(([sector, color]) => `<div class="legend-item"><span class="legend-swatch" style="background:${color}"></span><span>${sector}</span></div>`)
        .join('');
      div.innerHTML = `<strong style="display:block; margin-bottom:0.55rem; color:#14263D;">Secteurs</strong><div class="legend-stack">${items}</div>`;
      return div;
    };
    legend.addTo(map);
    return map;
  }

  function renderPanel(row) {
    const panel = document.getElementById('map-side-panel');
    const content = document.getElementById('map-side-panel-content');
    if (!panel || !content || !row) return;
    const { makeBadge, makeSectorBadge, splitValues, formatMillions } = window.BITDData.helpers;
    const sectorBadges = row.sectors.map(makeSectorBadge).join(' ');
    content.innerHTML = `
      <h3>${row.entreprise}</h3>
      <p>${sectorBadges}</p>
      <p>${makeBadge(row.risque_fournisseur)} ${makeBadge(row.criticite_souveraine)}</p>
      <p class="small-note">${row.specialite}</p>
      <div class="detail-list">
        <div class="detail-item"><strong>Siège</strong><span>${row.siege_ville}, ${row.siege_region}</span></div>
        <div class="detail-item"><strong>Effectif</strong><span>${row.effectif_label}</span></div>
        <div class="detail-item"><strong>CA Défense / proxy</strong><span>${row.ca_defense_label}</span></div>
        <div class="detail-item"><strong>Carnet / visibilité</strong><span>${row.carnet_num == null ? 'n.c.' : formatMillions(row.carnet_num)}${row.ratio_carnet_ca_num == null ? '' : ` · ${row.ratio_carnet_ca_num.toFixed(2)}x CA`}</span></div>
        <div class="detail-item"><strong>Programmes</strong><span>${splitValues(row.programmes).join(' · ')}</span></div>
        <div class="detail-item"><strong>Sites industriels</strong><span>${splitValues(row.sites_industriels).join(' · ')}</span></div>
        <div class="detail-item"><strong>Actionnariat</strong><span>${row.actionnariat}</span></div>
        <div class="detail-item"><strong>Dépendances critiques</strong><span>${splitValues(row.dependances_critiques).join(' · ')}</span></div>
        <div class="detail-item"><strong>Point de vigilance</strong><span>${row.point_vigilance}</span></div>
        <div class="detail-item"><strong>Ressource</strong><span><a href="${row.site_web}" target="_blank" rel="noreferrer">${row.site_web.replace(/^https?:\/\//, '')}</a></span></div>
      </div>`;
    panel.classList.add('is-open');
  }

  function wirePanelClose() {
    if (panelInitialized) return;
    panelInitialized = true;
    const close = document.getElementById('close-map-panel');
    const panel = document.getElementById('map-side-panel');
    if (!close || !panel) return;
    close.addEventListener('click', () => panel.classList.remove('is-open'));
  }

  function renderMarkers(rows) {
    const currentMap = ensureMap();
    if (!currentMap || !markersLayer) return;
    wirePanelClose();
    markersLayer.clearLayers();
    const bounds = [];
    rows.forEach((row) => {
      if (row.latitude == null || row.longitude == null) return;
      const color = window.BITDData.constants.sectorColors[row.primarySector] || '#5F7F82';
      const marker = L.marker([row.latitude, row.longitude], { icon: markerIcon(color) });
      marker.bindTooltip(`<strong>${row.entreprise}</strong><br>${row.specialite}<br>${row.siege_ville}`, { className: 'map-tooltip', direction: 'top', offset: [0, -10] });
      marker.on('click', () => renderPanel(row));
      marker.addTo(markersLayer);
      bounds.push([row.latitude, row.longitude]);
    });
    if (bounds.length > 1) currentMap.fitBounds(bounds, { padding: [28, 28] });
    else if (bounds.length === 1) currentMap.setView(bounds[0], 7);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.BITDData || !document.getElementById('bitd-map')) return;
    ensureMap();
    window.BITDData.registerConsumer((rows) => renderMarkers(rows));
  });
})();
