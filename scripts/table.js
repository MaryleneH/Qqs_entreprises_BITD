(function () {
  const tableState = { rows: [], filtered: [], sortKey: 'entreprise', sortDirection: 'asc' };

  function compareValues(a, b, key) {
    const aNum = window.BITDData.helpers.numberOrNull(a[key]);
    const bNum = window.BITDData.helpers.numberOrNull(b[key]);
    if (aNum != null || bNum != null) return (aNum ?? -Infinity) - (bNum ?? -Infinity);
    return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr');
  }

  function getBaseUrl() {
    return 'index.html';
  }

  function termHtml(termKey, label) {
    return window.BITDGlossary ? window.BITDGlossary.termHTML(termKey, label) : label;
  }

  function renderFinancialIndicator(row) {
    const indicator = row.financial_indicator;
    if (!indicator || indicator.value === 'n.c.') return '<span class="small-note">n.c.</span>';
    const title = indicator.term ? termHtml(indicator.term, indicator.label) : indicator.label;
    return `
      <div class="financial-indicator-cell">
        <div class="financial-indicator-cell__title">${title}</div>
        <div class="financial-indicator-cell__value">${indicator.value}</div>
        <div class="financial-indicator-cell__meta">${indicator.type}</div>
      </div>
    `;
  }

  function renderRows(rows) {
    const body = document.getElementById('entreprises-table-body');
    const count = document.getElementById('table-count');
    if (!body || !count) return;
    const { makeSectorBadge, splitValues, formatMillions, formatInteger } = window.BITDData.helpers;

    body.innerHTML = rows.map((row) => {
      const etabs = window.BITDData.getEtablissementsForCompany(row.id);
      const totalCount = etabs.length;
      const activeCount = etabs.filter((etab) => etab.sirene_is_active).length;
      const etabLabel = `${activeCount} site${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`;
      const etabCell = totalCount > 0
        ? `<a class="etab-link" href="${getBaseUrl()}?entreprise=${encodeURIComponent(row.id)}" title="Voir les implantations de ${row.entreprise} sur la carte">${etabLabel} →</a><br><span class="small-note">${row.regions_count} région${row.regions_count > 1 ? 's' : ''}${totalCount !== activeCount ? ` · ${totalCount} total` : ''}</span>`
        : '<span class="small-note">—</span>';
      const caCell = row.ca_defense_num == null
        ? `<span class="small-note">${row.ca_defense_label}</span>`
        : `${formatMillions(row.ca_defense_num)}<br><span class="small-note">${row.ca_defense_label}</span>`;
      const carnetCell = row.carnet_num == null
        ? '<span class="small-note">n.c.</span>'
        : `${formatMillions(row.carnet_num)}${row.ratio_carnet_ca_num == null ? '' : `<br><span class="small-note">ratio <span class="term-definition" data-term="carnet_ca">Carnet / CA</span> calculé</span>`}`;

      return `
        <tr>
          <td><strong>${row.entreprise}</strong></td>
          <td>${row.specialite}</td>
          <td>${row.sectors.map(makeSectorBadge).join(' ')}</td>
          <td>${row.siege_ville}<br><span class="small-note">${row.siege_region}</span></td>
          <td>${etabCell}</td>
          <td>${row.effectif_num == null ? row.effectif_label : formatInteger(row.effectif_num)}</td>
          <td>${caCell}</td>
          <td>${carnetCell}</td>
          <td>${renderFinancialIndicator(row)}</td>
          <td>${splitValues(row.programmes).slice(0, 4).join(' · ') || '<span class="small-note">n.c.</span>'}</td>
          <td><a href="${row.site_web}" target="_blank" rel="noreferrer">${row.site_web.replace(/^https?:\/\//, '')}</a></td>
        </tr>`;
    }).join('');

    count.textContent = `${rows.length} entreprise(s) affichée(s)`;
    if (window.BITDGlossary) window.BITDGlossary.initRoot(body);
  }

  function applyTableFilters() {
    const search = document.getElementById('table-search');
    const sector = document.getElementById('table-sector');
    if (!search || !sector) return;

    const query = window.BITDData.helpers.normalizeText(search.value);
    tableState.filtered = tableState.rows.filter((row) => {
      const matchSearch = !query || row.searchIndex.includes(query);
      const matchSector = sector.value === 'all' || row.sectors.includes(sector.value);
      return matchSearch && matchSector;
    });

    tableState.filtered.sort((a, b) => {
      const result = compareValues(a, b, tableState.sortKey);
      return tableState.sortDirection === 'asc' ? result : -result;
    });

    renderRows(tableState.filtered);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.BITDData || !document.getElementById('entreprises-table')) return;
    const search = document.getElementById('table-search');
    const sector = document.getElementById('table-sector');

    Promise.all([
      window.BITDData.loadEntreprises(),
      window.BITDData.loadEtablissements()
    ]).then(([rows]) => {
      tableState.rows = rows.slice();
      const sectors = [...new Set(rows.flatMap((row) => row.sectors))].sort((a, b) => a.localeCompare(b, 'fr'));
      sector.innerHTML = ['<option value="all">Tous les secteurs</option>', ...sectors.map((value) => `<option value="${value}">${value}</option>`)].join('');
      applyTableFilters();
    });

    [search, sector].forEach((element) => element && element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', applyTableFilters));

    document.querySelectorAll('#entreprises-table thead th[data-sort]').forEach((header) => {
      header.addEventListener('click', () => {
        const key = header.getAttribute('data-sort');
        if (tableState.sortKey === key) {
          tableState.sortDirection = tableState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          tableState.sortKey = key;
          tableState.sortDirection = 'asc';
        }
        applyTableFilters();
      });
    });
  });
})();
