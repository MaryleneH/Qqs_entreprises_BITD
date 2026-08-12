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
    const risk = document.getElementById('filter-risk');
    const criticality = document.getElementById('filter-criticality');
    const region = document.getElementById('filter-region');
    const reset = document.getElementById('filter-reset');
    if (!search || !sector || !risk || !criticality || !region || !reset) return;

    window.BITDData.loadEntreprises().then((rows) => {
      const sectorValues = [...new Set(rows.flatMap((row) => row.sectors))].sort((a, b) => a.localeCompare(b, 'fr'));
      const riskValues = [...new Set(rows.map((row) => row.risque_fournisseur))].sort((a, b) => (window.BITDData.helpers.riskScore(a) || 0) - (window.BITDData.helpers.riskScore(b) || 0));
      const criticalityValues = [...new Set(rows.map((row) => row.criticite_souveraine))].sort((a, b) => (window.BITDData.helpers.sovereigntyScore(a) || 0) - (window.BITDData.helpers.sovereigntyScore(b) || 0));
      const regionValues = [...new Set(rows.map((row) => row.siege_region))].sort((a, b) => a.localeCompare(b, 'fr'));
      fillSelect(sector, sectorValues, 'Tous les secteurs');
      fillSelect(risk, riskValues, 'Tous les risques fournisseur');
      fillSelect(criticality, criticalityValues, 'Toutes les criticités');
      fillSelect(region, regionValues, 'Toutes les régions');
    });

    const sync = () => {
      window.BITDData.setFilters({
        search: search.value.trim(),
        sector: sector.value,
        risk: risk.value,
        criticality: criticality.value,
        region: region.value
      });
    };

    [search, sector, risk, criticality, region].forEach((element) => {
      element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', sync);
    });

    reset.addEventListener('click', () => {
      search.value = '';
      sector.value = 'all';
      risk.value = 'all';
      criticality.value = 'all';
      region.value = 'all';
      sync();
    });
  });
})();
