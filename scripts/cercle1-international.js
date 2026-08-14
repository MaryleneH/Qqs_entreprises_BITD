/* ============================================================
   Cercle 1 — International : vue refondue.
   Une entreprise à la fois, le reste en contexte.
   Données inchangées : data/cercle1/*.csv (délimiteur ;).
   ============================================================ */
(function () {
  'use strict';
  if (!document.getElementById('c1x-app')) return;

  const FILES = {
    entreprises: 'data/cercle1/cercle1_entreprises.csv',
    implantations: 'data/cercle1/cercle1_implantations_internationales.csv',
    partenaires: 'data/cercle1/cercle1_partenaires_defense.csv',
    sources: 'data/cercle1/cercle1_sources.csv'
  };

  const COLORS = ['#1F5FA8', '#B33A3A', '#C89B3C', '#2F5D3A', '#6C3483',
                  '#0E7C7B', '#8A4B12', '#5D6D7E', '#A03B70'];
  const SHORT = { 'ARQUUS – JOHN COCKERILL DEFENSE': 'ARQUUS – JCD', 'DASSAULT AVIATION': 'DASSAULT AV.' };

  const state = { ent: 'all', tab: 'implantations', pert: 'dual', annonces: false, knds: false, pair: null };
  const data = {};
  let map = null, layer = null;

  /* ---------- CSV ; ---------- */
  function splitLine(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === ';' && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out;
  }
  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    const head = splitLine(lines[0]);
    return lines.slice(1).map(l => {
      const cells = splitLine(l), o = {};
      head.forEach((h, i) => { o[h] = (cells[i] || '').trim(); });
      return o;
    });
  }

  /* ---------- filtres ---------- */
  function pertOk(p) {
    if (state.pert === 'tout') return true;
    if (state.pert === 'directe') return p === 'directe';
    return p === 'directe' || p === 'mixte/duale' || p === 'duale/indirecte' || p === 'commerciale/defense';
  }
  function siteVisible(s) {
    if (state.ent !== 'all' && s.entreprise_id !== state.ent) return false;
    if (!pertOk(s.pertinence_defense)) return false;
    if (!state.annonces && s.statut !== 'actif') return false;
    if (!state.knds && /PAS KNDS France/i.test(s.perimetre)) return false;
    if (!state.annonces && s.afficher_par_defaut === 'false' && !/PAS KNDS France/i.test(s.perimetre)) return false;
    if (state.knds && /PAS KNDS France/i.test(s.perimetre)) return true;
    return true;
  }
  function relVisible(r) {
    if (state.ent !== 'all' && r.entreprise_id !== state.ent &&
        r.partenaire_cercle1_entreprise_id !== state.ent) return false;
    if (!state.annonces && r.statut_relation !== 'actuelle') return false;
    return true;
  }

  /* ---------- helpers ---------- */
  const entById = id => data.entreprises.find(e => e.entreprise_id === id);
  const colorOf = id => COLORS[(parseInt(id, 10) - 1) % COLORS.length];
  const shortName = e => SHORT[e.entreprise] || e.entreprise;
  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function badgePert(p) {
    const cls = p === 'directe' ? 'directe' : (/dual|mixte|defense/.test(p) ? 'duale' : 'autre');
    return `<span class="c1x-badge c1x-badge--${cls}">${esc(p)}</span>`;
  }
  const STATUT_TIP = {
    'LOI_2026': "Lettre d'intention (Letter of Intent) signée en 2026 : engagement politique ou industriel préalable, pas encore un contrat.",
    'demonstration_2026': "Phase de démonstrateur en 2026 : validation technique, pas une production en série.",
    'annoncee_industrialisation': "Industrialisation annoncée publiquement, mise en œuvre non encore vérifiée.",
    'annonce': "Implantation annoncée publiquement, ouverture non encore vérifiée."
  };
  function badgeStatut(s) {
    if (!s || s === 'actif' || s === 'actuelle') return '';
    const tip = STATUT_TIP[s] ? ` title="${STATUT_TIP[s]}"` : '';
    return `<span class="c1x-badge c1x-badge--annonce"${tip}>${esc(s.replace(/_/g, ' '))}</span>`;
  }
  function srcLink(url) {
    return url ? ` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">source ↗</a>` : '';
  }

  /* ---------- bandeau entreprises ---------- */
  function buildChips() {
    const wrap = document.getElementById('c1x-chips');
    const stats = id => {
      const pays = new Set(data.implantations.filter(s => s.entreprise_id === id).map(s => s.pays)).size;
      const coop = data.partenaires.filter(r => r.entreprise_id === id || r.partenaire_cercle1_entreprise_id === id).length;
      return `${pays} pays · ${coop} coop.`;
    };
    let html = `<button class="c1x-chip is-active" data-ent="all" style="--chip-color:#1F3A5F">
      <span class="c1x-chip-name"><span class="c1x-chip-dot"></span>Tout le Cercle 1</span>
      <span class="c1x-chip-meta">9 maîtres d'œuvre · vue d'ensemble</span></button>`;
    data.entreprises.forEach(e => {
      html += `<button class="c1x-chip" data-ent="${e.entreprise_id}" style="--chip-color:${colorOf(e.entreprise_id)}">
        <span class="c1x-chip-name"><span class="c1x-chip-dot"></span>${esc(shortName(e))}</span>
        <span class="c1x-chip-meta">${stats(e.entreprise_id)}</span></button>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.c1x-chip').forEach(b => b.addEventListener('click', () => {
      state.ent = b.dataset.ent; state.pair = null;
      wrap.querySelectorAll('.c1x-chip').forEach(x => x.classList.toggle('is-active', x === b));
      render();
    }));
  }

  /* ---------- carte ---------- */
  function buildMap() {
    if (!window.L) return;
    map = L.map('c1x-map', { worldCopyJump: true }).setView([28, 10], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 12 }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  function renderMap(sites) {
    if (!map) return;
    layer.clearLayers();
    const bounds = [];
    sites.forEach(s => {
      const lat = parseFloat(s.latitude), lng = parseFloat(s.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;
      const c = colorOf(s.entreprise_id);
      L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 1.5, fillColor: c, fillOpacity: .92 })
        .bindPopup(`<strong>${esc(s.entite_locale || s.entreprise)}</strong><br>
          ${esc(s.ville)}, ${esc(s.pays)}<br>
          <em>${esc(s.activite_documentee).slice(0, 140)}</em><br>
          ${badgePert(s.pertinence_defense)} ${badgeStatut(s.statut)}${srcLink(s.source_site_url)}`)
        .addTo(layer);
      bounds.push([lat, lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 6 });
  }

  /* ---------- panneau : implantations ---------- */
  function renderImplantations(sites) {
    let html = '';
    if (state.ent !== 'all') html += fiche();
    const byPays = {};
    sites.forEach(s => { (byPays[s.pays] = byPays[s.pays] || []).push(s); });
    const pays = Object.keys(byPays).sort((a, b) => byPays[b].length - byPays[a].length);
    if (!pays.length) return html + `<p class="c1x-empty">Aucune implantation dans la sélection courante. Élargissez la pertinence ou les options « Affiner ».</p>`;
    const max = byPays[pays[0]].length;
    html += `<div class="c1x-group-title">Pays d'implantation</div><div class="c1x-bars">`;
    pays.forEach(p => {
      html += `<div class="c1x-bar-row"><span>${esc(p)}</span>
        <span class="c1x-bar"><span style="width:${Math.round(100 * byPays[p].length / max)}%"></span></span>
        <span>${byPays[p].length}</span></div>`;
    });
    html += `</div><div class="c1x-group-title">Sites documentés</div>`;
    pays.forEach(p => {
      byPays[p].forEach(s => {
        html += `<div class="c1x-item">
          <div class="c1x-item-head"><span class="c1x-item-title">${esc(s.entite_locale || s.entreprise)}</span>
            <span class="c1x-item-sub">${esc(s.ville)}, ${esc(p)}</span>
            ${state.ent === 'all' ? `<span class="c1x-item-sub" style="color:${colorOf(s.entreprise_id)}">●&nbsp;${esc(shortName(entById(s.entreprise_id)))}</span>` : ''}</div>
          <p>${esc(s.activite_documentee)}</p>
          <p>${badgePert(s.pertinence_defense)} ${badgeStatut(s.statut)}
             ${/PAS KNDS France/i.test(s.perimetre) ? '<span class="c1x-badge c1x-badge--groupe">périmètre groupe</span>' : ''}
             ${srcLink(s.source_site_url)}</p></div>`;
      });
    });
    return html;
  }

  /* ---------- panneau : coopérations ---------- */
  function initials(e) { return shortName(e).split(/[\s–-]+/).map(w => w[0]).join('').slice(0, 3); }
  function renderMatrix(rels) {
    const n = data.entreprises.length;
    const count = {}, seen = new Set();
    rels.forEach(r => {
      const a = r.entreprise_id, b = r.partenaire_cercle1_entreprise_id;
      if (!b) return;
      const k = [a, b].sort((x, y) => x - y).join('-');
      // Une même relation saisie dans les deux sens (gouvernance) ne compte qu'une fois.
      const sig = k + '|' + (r.programme_projet || '').toLowerCase().replace(/gouvernance /, '');
      if (seen.has(sig)) return;
      seen.add(sig);
      count[k] = (count[k] || 0) + 1;
    });
    let html = `<div class="c1x-group-title">Coopérations croisées au sein du Cercle 1</div>
      <table class="c1x-matrix"><tr><th></th>`;
    data.entreprises.forEach(e => { html += `<th title="${esc(e.entreprise)}">${initials(e)}</th>`; });
    html += '</tr>';
    data.entreprises.forEach((a, i) => {
      html += `<tr><th title="${esc(a.entreprise)}">${initials(a)}</th>`;
      data.entreprises.forEach((b, j) => {
        if (j <= i) { html += '<td></td>'; return; }
        const k = [a.entreprise_id, b.entreprise_id].sort((x, y) => x - y).join('-');
        const c = count[k] || 0;
        const sel = state.pair === k ? ' sel' : '';
        html += c ? `<td class="has${sel}" data-pair="${k}">${c}</td>` : '<td>·</td>';
      });
      html += '</tr>';
    });
    html += '</table>';
    return html;
  }
  function renderCooperations(rels) {
    let html = '';
    if (state.ent !== 'all') html += fiche();
    if (state.ent === 'all') html += renderMatrix(rels);
    let list = rels;
    if (state.pair) {
      const [a, b] = state.pair.split('-');
      list = rels.filter(r => {
        const p = [r.entreprise_id, r.partenaire_cercle1_entreprise_id].sort((x, y) => x - y).join('-');
        return p === state.pair;
      });
      html += `<div class="c1x-group-title">Coopérations ${esc(shortName(entById(a)))} ↔ ${esc(shortName(entById(b)))}
        <a href="#" id="c1x-pair-reset" style="font-weight:400;text-transform:none;letter-spacing:0">(tout réafficher)</a></div>`;
    } else {
      html += `<div class="c1x-group-title">${state.ent === 'all' ? 'Toutes les relations documentées' : 'Coopérations documentées'}</div>`;
    }
    if (!list.length) return html + '<p class="c1x-empty">Aucune coopération dans la sélection courante.</p>';
    list.forEach(r => {
      const intra = r.partenaire_cercle1_entreprise_id;
      html += `<div class="c1x-item">
        <div class="c1x-item-head"><span class="c1x-item-title">${esc(r.entreprise)} ↔ ${esc(r.partenaire)}</span>
          <span class="c1x-item-sub">${esc(r.programme_projet)}</span></div>
        <p>${esc(r.description_preuve)}</p>
        <p><span class="c1x-badge c1x-badge--autre">${esc(r.type_relation.replace(/_/g, ' '))}</span>
           ${badgeStatut(r.statut_relation)}
           ${intra ? '' : `<span class="c1x-badge c1x-badge--duale">${esc(r.partenaire_secteur || 'partenaire externe')}</span>`}
           ${srcLink(r.source_relation_url)}</p></div>`;
    });
    return html;
  }

  function fiche() {
    const e = entById(state.ent);
    if (!e) return '';
    return `<div class="c1x-fiche"><h3>${esc(e.entreprise)}</h3>
      <p class="c1x-spec">${esc(e.specialite_cercle1)}</p>
      <p>${esc(e.raison_inclusion)}</p>
      <p><strong>Périmètre international :</strong> ${esc(e.perimetre_international)}</p>
      ${e.note_couverture ? `<p><em>${esc(e.note_couverture)}</em></p>` : ''}</div>`;
  }

  /* ---------- rendu global ---------- */
  function render() {
    const sites = data.implantations.filter(siteVisible);
    const rels = data.partenaires.filter(relVisible);
    renderMap(sites);
    const body = document.getElementById('c1x-panel-body');
    body.innerHTML = state.tab === 'implantations' ? renderImplantations(sites) : renderCooperations(rels);
    body.querySelectorAll('[data-pair]').forEach(td => td.addEventListener('click', () => {
      state.pair = state.pair === td.dataset.pair ? null : td.dataset.pair; render();
    }));
    const pr = document.getElementById('c1x-pair-reset');
    if (pr) pr.addEventListener('click', ev => { ev.preventDefault(); state.pair = null; render(); });
    document.getElementById('c1x-count').textContent =
      `${sites.length} implantation${sites.length > 1 ? 's' : ''} · ${rels.length} relation${rels.length > 1 ? 's' : ''} dans la sélection`;
  }

  /* ---------- init ---------- */
  function wire() {
    document.querySelectorAll('#c1x-tabs button').forEach(b => b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      document.querySelectorAll('#c1x-tabs button').forEach(x => x.classList.toggle('is-active', x === b));
      render();
    }));
    document.querySelectorAll('#c1x-seg button').forEach(b => b.addEventListener('click', () => {
      state.pert = b.dataset.pert;
      document.querySelectorAll('#c1x-seg button').forEach(x => x.classList.toggle('is-active', x === b));
      render();
    }));
    const t1 = document.getElementById('c1x-annonces'), t2 = document.getElementById('c1x-knds');
    if (t1) t1.addEventListener('change', () => { state.annonces = t1.checked; render(); });
    if (t2) t2.addEventListener('change', () => { state.knds = t2.checked; render(); });
  }

  Promise.all(Object.entries(FILES).map(([k, u]) =>
    fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.text(); }).then(t => { data[k] = parseCsv(t); })
  )).then(() => { buildChips(); buildMap(); wire(); render(); })
    .catch(err => {
      document.getElementById('c1x-panel-body').innerHTML =
        `<p class="c1x-empty">Erreur de chargement des données (${esc(String(err.message || err))}).</p>`;
    });
})();
