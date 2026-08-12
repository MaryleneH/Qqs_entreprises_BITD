(function () {
  function fillSelect(select, values, label) {
    if (!select) return;
    const current = select.value || 'all';
    const options = [`<option value="all">${label}</option>`]
      .concat(values.map((value) => `<option value="${value}">${value}</option>`));
    select.innerHTML = options.join('');
    select.value = values.includes(current) || current === 'all' ? current : 'all';
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.BITDData) return;
    const search = document.getElementById('filter-search');
    const sector = document.getElementById('filter-sector');
    const region = document.getElementById('filter-region');
    const reset = document.getElementById('filter-reset');
    if (!search || !sector || !region || !reset) return;

    Promise.all([
      window.BITDData.loadEntreprises(),
      window.BITDData.loadEtablissements()
    ]).then(([rows, etabs]) => {
      const sectorValues = [...new Set(rows.flatMap((row) => row.sectors))].sort((a, b) => a.localeCompare(b, 'fr'));
      const allRegions = [...new Set([
        ...rows.map((row) => row.siege_region),
        ...etabs.map((etab) => etab.region)
      ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));

      fillSelect(sector, sectorValues, 'Tous les secteurs');
      fillSelect(region, allRegions, "Toutes les régions d'implantation");
    });

    const sync = () => {
      window.BITDData.setFilters({
        search: search.value.trim(),
        sector: sector.value,
        region: region.value
      });
    };

    [search, sector, region].forEach((element) => {
      element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', sync);
    });

    search.addEventListener('change', () => {
      const query = search.value.trim();
      const { normalizeText } = window.BITDData.helpers;
      const rows = window.BITDData.getState().allRows;
      const match = rows.find((row) => normalizeText(row.entreprise) === normalizeText(query));
      if (match) {
        window.BITDData.selectCompany(match.id);
        const url = new URL(window.location.href);
        url.searchParams.set('entreprise', match.id);
        window.history.pushState({}, '', url);
      }
    });

    reset.addEventListener('click', () => {
      search.value = '';
      sector.value = 'all';
      region.value = 'all';
      sync();
    });
  });
})();
