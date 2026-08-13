// =============================================================================
// BITD France — Panel Methodology module
// Charge les 3 CSV du panel, construit des index en mémoire,
// et expose window.BITDPanel pour le dashboard.
// =============================================================================
(function () {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const state = {
    promise: null,
    selectionById: {},      // entreprise_id → row
    selectionByName: {},    // normalised name → row
    sourcesById: {},        // source_selection_id → row
    sourcesByEntreprise: {},// entreprise (name) → [rows]
    methodologieByType: {}, // type_element → [rows]
    methodologieById: {},   // element_id → row
    allSelection: [],
    allSources: [],
    allMethodologie: []
  };

  // ---------------------------------------------------------------------------
  // CSV parser (minimal, same logic as dashboard.js)
  // ---------------------------------------------------------------------------
  function parseCSV(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current); current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++;
        if (current.length || row.length) { row.push(current); rows.push(row); row = []; current = ''; }
      } else { current += char; }
    }
    if (current.length || row.length) { row.push(current); rows.push(row); }
    const [header, ...body] = rows;
    if (!header) return [];
    // Strip BOM from first key
    const cleanHeader = header.map((k, idx) => (idx === 0 ? k.replace(/^\uFEFF/, '') : k));
    return body.map((cells) => Object.fromEntries(cleanHeader.map((k, i) => [k, cells[i] ?? ''])));
  }

  function fetchCSV(relativePath) {
    const url = new URL(relativePath, document.baseURI);
    return fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`CSV ${relativePath} indisponible (${r.status})`);
        return r.text();
      })
      .then(parseCSV);
  }

  // ---------------------------------------------------------------------------
  // Load & index
  // ---------------------------------------------------------------------------
  function load() {
    if (state.promise) return state.promise;

    state.promise = Promise.all([
      fetchCSV('data/panel/panel_selection.csv'),
      fetchCSV('data/panel/panel_selection_sources.csv'),
      fetchCSV('data/panel/panel_methodologie.csv')
    ]).then(([selection, sources, methodologie]) => {
      state.allSelection = selection;
      state.allSources = sources;
      state.allMethodologie = methodologie;

      // Index selection
      selection.forEach((row) => {
        if (row.entreprise_id) state.selectionById[String(row.entreprise_id)] = row;
        if (row.entreprise) state.selectionByName[row.entreprise.trim().toUpperCase()] = row;
      });

      // Index sources
      sources.forEach((row) => {
        if (row.source_selection_id) state.sourcesById[row.source_selection_id] = row;
        const name = (row.entreprise || '').trim().toUpperCase();
        if (name) {
          if (!state.sourcesByEntreprise[name]) state.sourcesByEntreprise[name] = [];
          state.sourcesByEntreprise[name].push(row);
        }
      });

      // Index methodologie
      methodologie.forEach((row) => {
        if (row.element_id) state.methodologieById[row.element_id] = row;
        if (row.type_element) {
          if (!state.methodologieByType[row.type_element]) state.methodologieByType[row.type_element] = [];
          state.methodologieByType[row.type_element].push(row);
        }
      });

      // Dev coherence checks (only in non-production or if console visible)
      if (typeof console !== 'undefined') {
        const n = selection.length;
        const c1 = selection.filter((r) => r.cercle === '1').length;
        const c2 = selection.filter((r) => r.cercle === '2').length;
        const ids = new Set(selection.map((r) => r.entreprise_id));
        if (n !== 30) console.warn(`[BITDPanel] panel_selection.csv : ${n} lignes (attendu 30)`);
        if (c1 !== 9) console.warn(`[BITDPanel] Cercle 1 : ${c1} (attendu 9)`);
        if (c2 !== 21) console.warn(`[BITDPanel] Cercle 2 : ${c2} (attendu 21)`);
        if (ids.size !== 30) console.warn(`[BITDPanel] IDs non uniques dans panel_selection.csv`);
      }

      return { selection, sources, methodologie };
    });

    return state.promise;
  }

  // ---------------------------------------------------------------------------
  // Lookup helpers
  // ---------------------------------------------------------------------------
  function getByCompanyId(id) {
    return state.selectionById[String(id)] || null;
  }

  function getMethodologie(elementId) {
    return state.methodologieById[elementId] || null;
  }

  function getMethodologieByType(type) {
    return state.methodologieByType[type] || [];
  }

  // Resolve sources for a selection row (pipe-separated source_selection_ids)
  function resolveSourcesForRow(row) {
    if (!row) return [];
    const ids = (row.source_selection_ids || '').split('|').map((s) => s.trim()).filter(Boolean);
    return ids.map((id) => state.sourcesById[id] || null);
  }

  // Resolve sources by entreprise name (fallback for Cercle 1 shared source)
  function resolveSourcesForName(name) {
    const upper = (name || '').trim().toUpperCase();
    return state.sourcesByEntreprise[upper] || [];
  }

  // ---------------------------------------------------------------------------
  // Escape helper
  // ---------------------------------------------------------------------------
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // Build the ⓘ tooltip for the title + interactivity
  // ---------------------------------------------------------------------------
  function buildTitleTooltip() {
    const tooltipEl = document.getElementById('panel-title-tooltip');
    const btn = document.getElementById('panel-title-info-btn');
    if (!tooltipEl || !btn) return;

    load().then(() => {
      const tooltipRow = getMethodologie('dashboard_tooltip');
      const text = tooltipRow ? tooltipRow.texte : '';

      tooltipEl.innerHTML = `
        <div class="panel-tooltip__header">À propos du panel</div>
        <div class="panel-tooltip__body">${esc(text)}</div>
        <a href="methodologie.html#constitution-du-panel" class="panel-tooltip__link">Voir la méthodologie →</a>
      `;

      let hoverOpen = false;
      let clickOpen = false;

      function show() {
        tooltipEl.classList.add('is-visible');
        tooltipEl.removeAttribute('aria-hidden');
        btn.setAttribute('aria-expanded', 'true');
      }

      function hide() {
        tooltipEl.classList.remove('is-visible');
        tooltipEl.setAttribute('aria-hidden', 'true');
        btn.setAttribute('aria-expanded', 'false');
      }

      function toggle() {
        clickOpen = !clickOpen;
        if (clickOpen || hoverOpen) show(); else hide();
      }

      // Hover (desktop)
      btn.addEventListener('mouseenter', () => { hoverOpen = true; show(); });
      btn.addEventListener('mouseleave', () => { hoverOpen = false; if (!clickOpen) hide(); });
      tooltipEl.addEventListener('mouseenter', () => { hoverOpen = true; });
      tooltipEl.addEventListener('mouseleave', () => { hoverOpen = false; if (!clickOpen) hide(); });

      // Click / tap
      btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });

      // Focus/blur keyboard
      btn.addEventListener('focus', () => { show(); });
      btn.addEventListener('blur', (e) => {
        // Don't hide if focus moves into tooltip
        setTimeout(() => {
          if (!tooltipEl.contains(document.activeElement)) {
            if (!clickOpen) hide();
          }
        }, 100);
      });

      // Keyboard Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tooltipEl.classList.contains('is-visible')) {
          clickOpen = false;
          hoverOpen = false;
          hide();
          btn.focus();
        }
      });

      // Click outside
      document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !tooltipEl.contains(e.target)) {
          clickOpen = false;
          if (!hoverOpen) hide();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Build the "Pourquoi dans le panel ?" fiche (overlay)
  // ---------------------------------------------------------------------------
  function buildWhyFiche(companyId) {
    const row = getByCompanyId(companyId);
    if (!row) return '<p>Données méthodologiques indisponibles pour cette entreprise.</p>';

    const cercle = row.cercle;
    const cercleLabel = cercle === '1' ? 'Cercle 1' : 'Cercle 2';
    const cercleSub = cercle === '1'
      ? 'Grand maître d\'œuvre industriel — identification DGA'
      : 'Acteur industriel structurant — sélection éditoriale documentée';
    const cercleBadgeClass = cercle === '1' ? 'panel-cercle-badge--c1' : 'panel-cercle-badge--c2';

    // Criteria pills
    const criteriaRaw = (row.criteres_selection || '').split(';').map((s) => s.trim()).filter(Boolean);
    const criteriaMap = {
      presence_defense_averee: 'A. Présence Défense avérée',
      capacites_industrielles_france: 'B. Capacités industrielles en France',
      position_chaine_valeur: 'C. Position dans la chaîne de valeur',
      programmes_structurants: 'D. Programmes structurants',
      representativite_panel: 'E. Représentativité du panel'
    };
    const pillsHtml = criteriaRaw.length
      ? criteriaRaw.map((c) => `<span class="panel-criteria-pill">${esc(criteriaMap[c] || c)}</span>`).join('')
      : '';

    // Sources
    const sources = resolveSourcesForRow(row);
    // For Cercle 1, if no corporate sources in row, add DGA source
    const dgaSource = state.sourcesById['PANEL_SRC_DGA_GMO_2026'];
    const allSources = sources.filter(Boolean);
    if (cercle === '1' && dgaSource && !allSources.find((s) => s.source_selection_id === 'PANEL_SRC_DGA_GMO_2026')) {
      allSources.unshift(dgaSource);
    }

    const sourcesHtml = allSources.length
      ? allSources.map((s) => {
        if (!s) return '<li class="panel-source-item"><em>Source documentaire indisponible</em></li>';
        const url = s.url || '';
        const title = s.source_title || s.publisher || 'Source';
        const linkHtml = url
          ? `<a href="${esc(url)}" target="_blank" rel="noreferrer" class="panel-source-link">${esc(title)} ↗</a>`
          : `<span class="panel-source-unavailable">${esc(title)} — lien indisponible</span>`;
        return `<li class="panel-source-item">${linkHtml}</li>`;
      }).join('')
      : '<li class="panel-source-item"><em>Source documentaire indisponible</em></li>';

    const modeSelectionHtml = cercle === '1'
      ? '<span class="panel-mode-label">Identification institutionnelle DGA</span>'
      : '<span class="panel-mode-label">Sélection éditoriale documentée</span>';

    return `
      <div class="panel-why-fiche">
        <div class="panel-why-fiche__header">
          <div class="panel-cercle-badge ${cercleBadgeClass}">${esc(cercleLabel)}</div>
          <h3 class="panel-why-fiche__name">${esc(row.entreprise)}</h3>
          <p class="panel-why-fiche__cerclsub">${esc(cercleSub)}</p>
        </div>
        <div class="panel-why-fiche__section">
          <h4 class="panel-why-fiche__section-title">Pourquoi cette entreprise ?</h4>
          <p class="panel-why-fiche__justification">${esc(row.justification_selection)}</p>
        </div>
        <div class="panel-why-fiche__section">
          <h4 class="panel-why-fiche__section-title">Mode de sélection</h4>
          ${modeSelectionHtml}
        </div>
        ${criteriaRaw.length ? `
        <div class="panel-why-fiche__section">
          <h4 class="panel-why-fiche__section-title">Critères mobilisés</h4>
          <div class="panel-criteria-pills">${pillsHtml}</div>
        </div>` : ''}
        <div class="panel-why-fiche__section">
          <h4 class="panel-why-fiche__section-title">Sources documentaires</h4>
          <ul class="panel-sources-list">${sourcesHtml}</ul>
        </div>
        <a href="methodologie.html#constitution-du-panel" class="panel-why-fiche__methodo-link">Méthodologie complète →</a>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Overlay management
  // ---------------------------------------------------------------------------
  function openWhyOverlay(companyId, anchorEl) {
    let overlay = document.getElementById('panel-why-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'panel-why-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Pourquoi cette entreprise est-elle dans le panel ?');
      overlay.innerHTML = `
        <div class="panel-why-backdrop" id="panel-why-backdrop"></div>
        <div class="panel-why-dialog" id="panel-why-dialog">
          <button class="panel-why-close" id="panel-why-close" aria-label="Fermer">✕</button>
          <div id="panel-why-content"></div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('panel-why-backdrop').addEventListener('click', closeWhyOverlay);
      document.getElementById('panel-why-close').addEventListener('click', closeWhyOverlay);
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeWhyOverlay();
      });
    }

    const content = document.getElementById('panel-why-content');
    if (content) {
      load().then(() => {
        content.innerHTML = buildWhyFiche(companyId);
        overlay.classList.add('is-open');
        document.getElementById('panel-why-close').focus();
      });
    }
  }

  function closeWhyOverlay() {
    const overlay = document.getElementById('panel-why-overlay');
    if (overlay) overlay.classList.remove('is-open');
  }

  // ---------------------------------------------------------------------------
  // Inject cercle badge + "Pourquoi dans le panel ?" into company panel
  // ---------------------------------------------------------------------------
  function injectIntoPanelContent(companyId, panelEl) {
    if (!panelEl) return;
    // Remove any existing injection
    const existing = panelEl.querySelector('.panel-why-injection');
    if (existing) existing.remove();

    load().then(() => {
      const row = getByCompanyId(companyId);
      if (!row) return;
      const cercle = row.cercle;
      const cercleBadge = cercle === '1'
        ? '<span class="panel-cercle-inline panel-cercle-inline--c1">Cercle 1 · Grand maître d\'œuvre DGA</span>'
        : '<span class="panel-cercle-inline panel-cercle-inline--c2">Cercle 2 · Acteur industriel structurant</span>';

      const injection = document.createElement('div');
      injection.className = 'panel-why-injection';
      injection.innerHTML = `
        ${cercleBadge}
        <button type="button" class="panel-why-trigger" data-company-id="${esc(String(companyId))}" aria-expanded="false">
          Pourquoi dans le panel ? <span class="panel-why-icon" aria-hidden="true">ⓘ</span>
        </button>
      `;

      // Insert after h3
      const h3 = panelEl.querySelector('h3');
      if (h3 && h3.nextSibling) {
        h3.parentNode.insertBefore(injection, h3.nextSibling);
      } else if (h3) {
        h3.parentNode.appendChild(injection);
      } else {
        panelEl.prepend(injection);
      }

      injection.querySelector('.panel-why-trigger').addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-company-id');
        openWhyOverlay(id, e.currentTarget);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Methodologie page — build panel section
  // ---------------------------------------------------------------------------
  function buildMethodologieSection() {
    const container = document.getElementById('panel-methodo-section');
    if (!container) return;

    load().then(() => {
      const disclaimer = state.methodologieById['panel_disclaimer'];
      const methodIntro = state.methodologieById['method_intro'];
      const circle1 = state.methodologieById['circle_1'];
      const circle2 = state.methodologieById['circle_2'];
      const noScore = state.methodologieById['no_score'];
      const notHierarchy = state.methodologieById['circle_not_hierarchy'];
      const criteria = (state.methodologieByType['critere'] || []).sort((a, b) => Number(a.ordre) - Number(b.ordre));

      const cercle1Rows = state.allSelection.filter((r) => r.cercle === '1');
      const cercle2Rows = state.allSelection.filter((r) => r.cercle === '2');

      const cercle1Names = cercle1Rows.map((r) => `<li>${esc(r.entreprise)}</li>`).join('');
      const cercle2Names = cercle2Rows.map((r) => `<li>${esc(r.entreprise)}</li>`).join('');

      const criteriaHtml = criteria.map((c) => `
        <div class="panel-criteria-card">
          <h5 class="panel-criteria-card__title">${esc(c.titre)}</h5>
          <p class="panel-criteria-card__text">${esc(c.texte)}</p>
        </div>
      `).join('');

      const companyOptions = state.allSelection.map((r) =>
        `<option value="${esc(r.entreprise_id)}">${esc(r.entreprise)}</option>`
      ).join('');

      container.innerHTML = `
        <div class="panel-methodo-disclaimer">
          <p class="panel-methodo-disclaimer__text">${esc(disclaimer ? disclaimer.texte : '')}</p>
        </div>

        <h3 class="panel-methodo-subtitle">Méthode de sélection</h3>
        <p class="panel-methodo-intro">${esc(methodIntro ? methodIntro.texte : '')}</p>

        <div class="panel-circles-visual" aria-label="Organisation du panel en deux cercles">
          <div class="panel-circles-header">
            <div class="panel-circles-total">
              <strong>PANEL</strong>
              <span>30 ACTEURS</span>
            </div>
          </div>
          <div class="panel-circles-grid">
            <div class="panel-circle-block panel-circle-block--c1">
              <div class="panel-circle-block__badge">CERCLE 1</div>
              <div class="panel-circle-block__count">${cercle1Rows.length} entreprises</div>
              <div class="panel-circle-block__title">
                <span class="term-circle-tooltip" data-circle="1">${esc(circle1 ? circle1.titre : 'Grands maîtres d\'œuvre industriels')}</span>
              </div>
              <p class="panel-circle-block__method">Base institutionnelle DGA</p>
              <p class="panel-circle-block__desc">${esc(circle1 ? circle1.texte : '')}</p>
              <ul class="panel-circle-block__list">${cercle1Names}</ul>
            </div>
            <div class="panel-circle-block panel-circle-block--c2">
              <div class="panel-circle-block__badge">CERCLE 2</div>
              <div class="panel-circle-block__count">${cercle2Rows.length} entreprises</div>
              <div class="panel-circle-block__title">
                <span class="term-circle-tooltip" data-circle="2">${esc(circle2 ? circle2.titre : 'Équipementiers et acteurs industriels structurants')}</span>
              </div>
              <p class="panel-circle-block__method">Sélection éditoriale documentée</p>
              <p class="panel-circle-block__desc">${esc(circle2 ? circle2.texte : '')}</p>
              <ul class="panel-circle-block__list">${cercle2Names}</ul>
            </div>
          </div>
          <p class="panel-circles-note">${esc(notHierarchy ? notHierarchy.texte : '')}</p>
        </div>

        <h3 class="panel-methodo-subtitle" id="criteres-cercle-2">Critères de sélection — Cercle 2</h3>
        <p class="panel-no-score-note">${esc(noScore ? noScore.texte : '')}</p>
        <div class="panel-criteria-grid">${criteriaHtml}</div>
      `;

      // Bind circle tooltips
      container.querySelectorAll('.term-circle-tooltip').forEach((el) => {
        const circle = el.getAttribute('data-circle');
        const tooltip = circle === '1'
          ? (circle1 ? circle1.texte : '')
          : (circle2 ? circle2.texte : '');
        if (tooltip) setupSimpleTooltip(el, tooltip);
      });
    });
  }

  function buildCompanySelector() {
    const select = document.getElementById('panel-company-select');
    const ficheContainer = document.getElementById('panel-company-fiche');
    if (!select || !ficheContainer) return;

    load().then(() => {
      // Fill select
      const options = ['<option value="">— Choisir une entreprise —</option>']
        .concat(state.allSelection.map((r) =>
          `<option value="${esc(r.entreprise_id)}">${esc(r.entreprise)}</option>`
        ));
      select.innerHTML = options.join('');

      select.addEventListener('change', () => {
        const id = select.value;
        if (!id) {
          ficheContainer.innerHTML = '';
          return;
        }
        ficheContainer.innerHTML = buildWhyFiche(id);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Simple inline tooltip (non-hover alternative to title=)
  // ---------------------------------------------------------------------------
  function setupSimpleTooltip(triggerEl, text) {
    // Just add title for now, main tooltips are handled by glossary.js pattern
    triggerEl.title = text;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.BITDPanel = {
    load,
    getByCompanyId,
    getMethodologie,
    getMethodologieByType,
    resolveSourcesForRow,
    resolveSourcesForName,
    injectIntoPanelContent,
    openWhyOverlay,
    closeWhyOverlay,
    buildTitleTooltip,
    buildWhyFiche,
    buildMethodologieSection,
    buildCompanySelector
  };

  // ---------------------------------------------------------------------------
  // Auto-init
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    load().catch((err) => console.error('[BITDPanel] Erreur chargement:', err));
    buildTitleTooltip();
    buildMethodologieSection();
    buildCompanySelector();
  });
})();
