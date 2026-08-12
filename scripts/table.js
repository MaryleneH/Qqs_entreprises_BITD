(function () {
  const tableState = { rows: [], filtered: [], sortKey: 'entreprise', sortDirection: 'asc' };

  function compareValues(a, b, key) {
    const aNum = window.BITDData.helpers.numberOrNull(a[key]);
    const bNum = window.BITDData.helpers.numberOrNull(b[key]);
    if (aNum != null || bNum != null) return (aNum ?? -Infinity) - (bNum ?? -Infinity);
    return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr');
  }

  function getBaseUrl() {
    // Resolve path to index.html relative to current page
    const path = window.location.pathname;
    // If we're on /entreprises.html, index is at ./index.html
    return 'index.html';
  }

  function renderRows(rows) {
    const body = document.getElementById('entreprises-table-body');
    const count = document.getElementById('table-count');
    if (!body || !count) return;
    const { makeBadge, makeSectorBadge, splitValues, formatMillions, formatInteger } = window.BITDData.helpers;
    body.innerHTML = rows.map((row) => {
      const etabs = window.BITDData.getEtablissementsForCompany(row.id);
      const etabCount = etabs.length;
      const etabCell = etabCount > 0
        ? `<a class="etab-link" href="${getBaseUrl()}?entreprise=${encodeURIComponent(row.id)}" title="Voir les implantations de ${row.entreprise} sur la carte">${etabCount} site${etabCount > 1 ? 's' : ''} →</a>`
        : '<span class="small-note">—</span>';
      return `
      <tr>
        <td><strong>${row.entreprise}</strong><br><span class="small-note">${row.specialite}</span></td>
        <td>${row.categorie}</td>
        <td>${row.sectors.map(makeSectorBadge).join(' ')}</td>
        <td>${row.siege_region}</td>
        <td>${row.effectif_num == null ? row.effectif_label : formatInteger(row.effectif_num)}</td>
        <td>${row.ca_defense_num == null ? row.ca_defense_label : `${formatMillions(row.ca_defense_num)}<br><span class="small-note">${row.ca_defense_label}</span>`}</td>
        <td>${makeBadge(row.risque_fournisseur)}</td>
        <td>${makeBadge(row.criticite_souveraine)}</td>
        <td>${splitValues(row.programmes).slice(0, 4).join(' · ')}</td>
        <td>${etabCell}</td>
      </tr>`;
    }).join('');
    count.textContent = `${rows.length} entreprise(s) affichée(s)`;
  }

  function applyTableFilters() {
    const search = document.getElementById('table-search');
    const sector = document.getElementById('table-sector');
    const risk = document.getElementById('table-risk');
    if (!search || !sector || !risk) return;
    const query = window.BITDData.helpers.normalizeText(search.value);
    tableState.filtered = tableState.rows.filter((row) => {
      const matchSearch = !query || row.searchIndex.includes(query);
      const matchSector = sector.value === 'all' || row.sectors.includes(sector.value);
      const matchRisk = risk.value === 'all' || row.risque_fournisseur === risk.value;
      return matchSearch && matchSector && matchRisk;
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
    const risk = document.getElementById('table-risk');

    Promise.all([
      window.BITDData.loadEntreprises(),
      window.BITDData.loadEtablissements()
    ]).then(([rows]) => {
      tableState.rows = rows.slice();
      const sectors = [...new Set(rows.flatMap((row) => row.sectors))].sort((a, b) => a.localeCompare(b, 'fr'));
      const risks = [...new Set(rows.map((row) => row.risque_fournisseur))].sort((a, b) => (window.BITDData.helpers.riskScore(a) || 0) - (window.BITDData.helpers.riskScore(b) || 0));
      sector.innerHTML = ['<option value="all">Tous les secteurs</option>', ...sectors.map((value) => `<option value="${value}">${value}</option>`)].join('');
      risk.innerHTML = ['<option value="all">Tous les niveaux de risque</option>', ...risks.map((value) => `<option value="${value}">${value}</option>`)].join('');
      applyTableFilters();
    });

    [search, sector, risk].forEach((element) => element && element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', applyTableFilters));

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
