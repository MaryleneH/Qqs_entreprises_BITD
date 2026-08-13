// =============================================================================
// BITD France — Page Méthodologie
// Source search, dynamic source list by company
// =============================================================================
(function () {
  function escapeHtml(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function sourceCard(s) {
    const url = s.url || '';
    const usageLabel = s.usage_principal || s.type_source || '';
    const dateLabel = s.date_consultation ? `· ${s.date_consultation}` : '';
    const linkHtml = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="source-card__link">${escapeHtml(s.libelle || url)} <svg class="ext-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1h7.5v7.5M11 1 4 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg></a>`
      : `<span class="source-card__link source-card__link--noop">${escapeHtml(s.libelle || '—')}</span>`;
    return `
      <div class="source-card">
        ${linkHtml}
        <div class="source-card__meta">
          <span class="source-card__type">${escapeHtml(s.type_source || '—')}</span>
          <span class="source-card__usage">${escapeHtml(usageLabel)} ${dateLabel}</span>
        </div>
      </div>`;
  }

  function renderSourceResults(sources, container) {
    if (!sources || sources.length === 0) {
      container.innerHTML = '<p class="methodo-empty">Aucun résultat pour cette recherche.</p>';
      return;
    }
    container.innerHTML = sources.map(sourceCard).join('');
  }

  // ---------------------------------------------------------------------------
  // Source search
  // ---------------------------------------------------------------------------
  function initSourceSearch() {
    const form = document.getElementById('source-search-form');
    const resultContainer = document.getElementById('source-search-results');
    if (!form || !resultContainer) return;

    const entrepriseSelect = document.getElementById('source-search-entreprise');
    const typeSelect = document.getElementById('source-search-type');
    const queryInput = document.getElementById('source-search-query');

    if (!window.BITDProvenance) return;

    window.BITDProvenance.load().then(() => {
      // Populate entreprise select
      if (entrepriseSelect) {
        const companies = window.BITDProvenance.getSourceEntreprises().sort((a, b) => a.localeCompare(b, 'fr'));
        entrepriseSelect.innerHTML = '<option value="all">Toutes les entreprises</option>' +
          companies.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      }

      // Populate type select with unique types
      if (typeSelect) {
        const allSrc = window.BITDProvenance.getAllSources();
        const types = [...new Set(allSrc.map((s) => s.type_source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
        typeSelect.innerHTML = '<option value="all">Tous les types</option>' +
          types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
      }
    });

    function doSearch() {
      if (!window.BITDProvenance) return;
      const entreprise = (entrepriseSelect && entrepriseSelect.value !== 'all') ? entrepriseSelect.value : null;
      const type = (typeSelect && typeSelect.value !== 'all') ? typeSelect.value : null;
      const query = ((queryInput && queryInput.value) || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let sources = window.BITDProvenance.getAllSources();

      if (entreprise) sources = sources.filter((s) => s.entreprise === entreprise);
      if (type) sources = sources.filter((s) => s.type_source === type);
      if (query) {
        sources = sources.filter((s) => {
          const haystack = [s.libelle, s.entreprise, s.usage_principal, s.type_source, s.commentaire]
            .join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return haystack.includes(query);
        });
      }

      renderSourceResults(sources, resultContainer);
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); doSearch(); });
    [entrepriseSelect, typeSelect].forEach((el) => el && el.addEventListener('change', doSearch));
    if (queryInput) queryInput.addEventListener('input', doSearch);

    // Show all sources initially
    window.BITDProvenance.load().then(() => doSearch());
  }

  // ---------------------------------------------------------------------------
  // Sources par entreprise
  // ---------------------------------------------------------------------------
  function initSourcesByCompany() {
    const companySelect = document.getElementById('sources-entreprise-select');
    const sourcesList = document.getElementById('sources-entreprise-list');
    if (!companySelect || !sourcesList) return;
    if (!window.BITDProvenance) return;

    window.BITDProvenance.load().then(() => {
      const companies = window.BITDProvenance.getSourceEntreprises().sort((a, b) => a.localeCompare(b, 'fr'));
      companySelect.innerHTML = '<option value="">— Choisir une entreprise —</option>' +
        companies.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

      companySelect.addEventListener('change', () => {
        const name = companySelect.value;
        if (!name) { sourcesList.innerHTML = ''; return; }

        const sources = window.BITDProvenance.getSourcesForEntreprise(name);
        if (sources.length === 0) {
          sourcesList.innerHTML = '<p class="methodo-empty">Aucune source documentée pour cette entreprise.</p>';
          return;
        }

        // Group by type
        const groups = {};
        sources.forEach((s) => {
          const t = s.type_source || 'Autre';
          if (!groups[t]) groups[t] = [];
          groups[t].push(s);
        });

        sourcesList.innerHTML = Object.entries(groups).map(([type, srcs]) =>
          `<div class="source-group">
            <h4 class="source-group__title">${escapeHtml(type)}</h4>
            ${srcs.map(sourceCard).join('')}
          </div>`
        ).join('');
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Book-to-bill example (dynamically from provenance)
  // ---------------------------------------------------------------------------
  function initBtbExample() {
    const container = document.getElementById('btb-example-container');
    if (!container) return;
    if (!window.BITDProvenance) return;

    window.BITDProvenance.load().then(() => {
      // Find Airbus (id=5) book_to_bill
      const prov = window.BITDProvenance.getCompanyFieldProvenance('5', 'book_to_bill');
      if (!prov || prov.length === 0) return;
      const r = prov[0];
      const src = r.source_id ? window.BITDProvenance.getSource(r.source_id) : null;
      const srcLabel = (src && src.libelle) || 'Source non disponible';
      const srcUrl = (src && src.url) || r.source_url || '';
      const srcLink = srcUrl
        ? `<a href="${escapeHtml(srcUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(srcLabel)} <svg class="ext-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1h7.5v7.5M11 1 4 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg></a>`
        : escapeHtml(srcLabel);

      container.innerHTML = `
        <div class="btb-example">
          <div class="btb-example__header">
            <span class="btb-example__label">Book-to-bill</span>
            <span class="btb-example__value">${escapeHtml(r.valeur || '—')}×</span>
            <span class="mode-badge mode-badge--calcule">Calculé</span>
          </div>
          <div class="btb-example__formula">
            <div class="btb-formula-row"><span>Prises de commandes</span></div>
            <div class="btb-formula-divider">÷</div>
            <div class="btb-formula-row"><span>Chiffre d'affaires</span></div>
          </div>
          <dl class="btb-example__meta">
            <dt>Périmètre</dt><dd>${escapeHtml(r.perimetre || '—')}</dd>
            <dt>Période</dt><dd>${escapeHtml(r.periode || '—')}</dd>
            <dt>Source</dt><dd>${srcLink}</dd>
          </dl>
        </div>`;
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('methodo-page')) return;
    initSourceSearch();
    initSourcesByCompany();
    initBtbExample();
  });
})();
