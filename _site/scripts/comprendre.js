(function () {
  const categoryOrder = [
    'Industrie de Défense',
    'Finance',
    'Production',
    'Programmes'
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildCard(key, entry) {
    return `
      <article class="glossary-card" data-key="${escapeHtml(key)}" data-search="${escapeHtml(`${entry.term} ${entry.short || ''} ${entry.long || ''} ${entry.category || ''}`.toLowerCase())}">
        <div class="glossary-card__meta">${escapeHtml(entry.category || '')}</div>
        <h2 class="glossary-card__title">${escapeHtml(entry.term)}</h2>
        ${entry.formula ? `<div class="glossary-card__formula">${escapeHtml(entry.formula)}</div>` : ''}
        ${entry.short ? `<p class="glossary-card__short">${escapeHtml(entry.short)}</p>` : ''}
        ${entry.long ? `<p class="glossary-card__long">${escapeHtml(entry.long)}</p>` : ''}
      </article>
    `;
  }

  function buildGroup(title, items) {
    return `
      <section class="glossary-group" data-category="${escapeHtml(title)}">
        <div class="glossary-group__header">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="glossary-grid">
          ${items.join('')}
        </div>
      </section>
    `;
  }

  function renderGlossary(entries) {
    const groupsContainer = document.getElementById('glossary-groups');
    if (!groupsContainer) return;

    const grouped = categoryOrder.map((category) => {
      const items = Object.entries(entries)
        .filter(([, entry]) => entry.category === category)
        .sort((a, b) => a[1].term.localeCompare(b[1].term, 'fr'))
        .map(([key, entry]) => buildCard(key, entry));
      return items.length ? buildGroup(category, items) : '';
    }).join('');

    groupsContainer.innerHTML = grouped;
  }

  function filterGlossary(query) {
    const normalized = query.trim().toLowerCase();
    const cards = [...document.querySelectorAll('.glossary-card')];
    let visibleCount = 0;

    cards.forEach((card) => {
      const matches = !normalized || card.dataset.search.includes(normalized);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    document.querySelectorAll('.glossary-group').forEach((group) => {
      const hasVisible = [...group.querySelectorAll('.glossary-card')].some((card) => !card.hidden);
      group.hidden = !hasVisible;
    });

    const empty = document.getElementById('glossary-empty');
    if (empty) empty.hidden = visibleCount > 0;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('glossary-search');
    const groupsContainer = document.getElementById('glossary-groups');
    if (!search || !groupsContainer || !window.BITDGlossary) return;

    window.BITDGlossary.loadGlossary().then((entries) => {
      renderGlossary(entries);
      filterGlossary('');
    });

    search.addEventListener('input', () => {
      filterGlossary(search.value);
    });
  });
})();
