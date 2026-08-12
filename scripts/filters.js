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

    // Update region label to "Région d'implantation"
    const regionLabel = region.closest('.filter-group');
    if (regionLabel) {
      const lbl = regionLabel.querySelector('label');
      if (lbl) lbl.textContent = "Région d'implantation";
    }

    Promise.all([
      window.BITDData.loadEntreprises(),
      window.BITDData.loadEtablissements()
    ]).then(([rows, etabs]) => {
      const sectorValues = [...new Set(rows.flatMap((row) => row.sectors))].sort((a, b) => a.localeCompare(b, 'fr'));
      const riskValues = [...new Set(rows.map((row) => row.risque_fournisseur))].sort((a, b) => (window.BITDData.helpers.riskScore(a) || 0) - (window.BITDData.helpers.riskScore(b) || 0));
      const criticalityValues = [...new Set(rows.map((row) => row.criticite_souveraine))].sort((a, b) => (window.BITDData.helpers.sovereigntyScore(a) || 0) - (window.BITDData.helpers.sovereigntyScore(b) || 0));
      // Regions from both sieges and établissements
      const allRegions = [...new Set([
        ...rows.map((row) => row.siege_region),
        ...etabs.map((e) => e.region)
      ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
      fillSelect(sector, sectorValues, 'Tous les secteurs');
      fillSelect(risk, riskValues, 'Tous les risques fournisseur');
      fillSelect(criticality, criticalityValues, 'Toutes les criticités');
      fillSelect(region, allRegions, "Toutes les régions d'implantation");
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

    // Also trigger focus on search selection of company
    search.addEventListener('change', () => {
      const query = search.value.trim();
      const { normalizeText } = window.BITDData.helpers;
      const rows = window.BITDData.getState().allRows;
      const match = rows.find((r) => normalizeText(r.entreprise) === normalizeText(query));
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
      risk.value = 'all';
      criticality.value = 'all';
      region.value = 'all';
      sync();
    });
  });
})();
