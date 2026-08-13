(function () {
  const shell = document.querySelector('.entreprises-shell');
  if (!shell) return;

  const state = {
    rows: [],
    filtered: [],
    selectedId: null,
    view: 'explorer',
    panelLoaded: false,
    programmeLoaded: false,
    provenanceLoaded: false,
    identiteLoaded: false
  };


  function getChainValueId(cv) {
    return String(
      cv?.chaine_valeur_id || cv?.id || ''
    ).trim();
  }

  const dom = {
    loading: document.getElementById('entreprises-loading'),
    error: document.getElementById('entreprises-error'),
    retry: document.getElementById('entreprises-retry'),
    meta: document.getElementById('entreprises-meta'),
    search: document.getElementById('entreprises-search'),
    filterCircle: document.getElementById('entreprises-filter-circle'),
    filterDomain: document.getElementById('entreprises-filter-domain'),
    filterRole: document.getElementById('entreprises-filter-role'),
    filterProgramme: document.getElementById('entreprises-filter-programme'),
    count: document.getElementById('entreprises-count'),
    reset: document.getElementById('entreprises-reset'),
    emptyReset: document.getElementById('entreprises-empty-reset'),
    list: document.getElementById('entreprises-list'),
    empty: document.getElementById('entreprises-empty'),
    detail: document.getElementById('entreprises-detail'),
    explorer: document.getElementById('entreprises-explorer'),
    tableau: document.getElementById('entreprises-tableau'),
    tableBody: document.getElementById('entreprises-compact-table-body'),
    mobileDetail: document.getElementById('entreprises-mobile-detail'),
    mobileDetailContent: document.getElementById('entreprises-mobile-detail-content')
  };

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function parseCSV(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        if (current.length || row.length) {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.length || row.length) {
      row.push(current);
      rows.push(row);
    }

    const [header, ...body] = rows;
    if (!header) return [];
    const cleanHeader = header.map((h) => h.replace(/^\uFEFF/, '').trim());
    return body.map((cells) => Object.fromEntries(cleanHeader.map((key, idx) => [key, cells[idx] ?? ''])));
  }

  function splitValues(value) {
    return String(value || '')
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function compactText(value, max = 120) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trim()}…`;
  }

  function formatCount(value, label) {
    if (value == null || Number.isNaN(value)) return '';
    return `${new Intl.NumberFormat('fr-FR').format(value)} ${label}`;
  }

  function toNumber(value) {
    if (value == null) return null;
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  async function loadCoreRows() {
    const url = new URL('data/entreprises.csv', document.baseURI);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(
        'Impossible de charger data/entreprises.csv',
        res.status,
        res.url
      );
      throw new Error(`Impossible de charger ${res.url} (HTTP ${res.status})`);
    }
    const rows = parseCSV(await res.text());
    return rows.map((row, index) => {
      const sectors = splitValues(row.secteurs);
      const programmesRaw = splitValues(row.programmes);
      const implantsFallback = toNumber(row.nb_sites_referentiel_initial) ?? toNumber(row.nb_sites_cartographies);
      return {
        ...row,
        _order: index,
        id: String(row.id),
        slug: row.slug || String(row.id),
        secteurPrincipal: row.secteur_principal || sectors[0] || '',
        role: row.categorie || '',
        sectors,
        programmesList: programmesRaw,
        programmesDoc: [],
        implantationsCount: implantsFallback,
        regionsCount: toNumber(row.nb_regions_cartographiees),
        cercle: '',
        modeSelection: '',
        libelleModeSelection: '',
        justificationSelection: '',
        criteresSelection: '',
        panelSources: [],
        searchIndex: normalizeText([
          row.entreprise,
          row.secteur_principal,
          row.categorie,
          row.specialite,
          row.description,
          row.programmes,
          programmesRaw.join(' ')
        ].join(' '))
      };
    });
  }

  async function enrichOptionalData() {
    const optionalTasks = [];

    if (window.BITDData && window.BITDData.loadEtablissements) {
      optionalTasks.push(
        window.BITDData.loadEtablissements().then((etabs) => {
          const byCompany = new Map();
          etabs.forEach((etab) => {
            const key = String(etab.entreprise_id || '');
            if (!key) return;
            if (!byCompany.has(key)) byCompany.set(key, []);
            byCompany.get(key).push(etab);
          });
          state.rows = state.rows.map((row) => {
            const sites = byCompany.get(row.id) || [];
            const regions = new Set(sites.map((s) => s.region).filter(Boolean));
            return {
              ...row,
              implantationsCount: sites.length || row.implantationsCount,
              regionsCount: regions.size || row.regionsCount
            };
          });
        }).catch((err) => {
          console.warn('[BITD][Entreprises] Établissements indisponibles :', err);
        })
      );
    }

    if (window.BITDPanel && window.BITDPanel.load) {
      optionalTasks.push(
        window.BITDPanel.load().then(() => {
          state.panelLoaded = true;
          state.rows = state.rows.map((row) => {
            const panelRow = window.BITDPanel.getByCompanyId(row.id);
            if (!panelRow) return row;
            return {
              ...row,
              cercle: String(panelRow.cercle || ''),
              modeSelection: panelRow.mode_selection || '',
              libelleModeSelection: panelRow.libelle_mode_selection || '',
              justificationSelection: panelRow.justification_selection || '',
              criteresSelection: panelRow.criteres_selection || '',
              panelSources: window.BITDPanel.resolveSourcesForRow(panelRow).filter(Boolean)
            };
          });
        }).catch((err) => {
          console.warn('[BITD][Entreprises] Panel indisponible :', err);
        })
      );
    }

    if (window.BITDProgramme && window.BITDProgramme.loadAll) {
      optionalTasks.push(
        window.BITDProgramme.loadAll().then(() => {
          state.programmeLoaded = true;
          state.rows = state.rows.map((row) => {
            const docs = window.BITDProgramme.getProgrammesForEntreprise(row.id) || [];
            const docPrograms = docs.map((p) => ({ id: p.programme_id, label: p.acronyme || p.nom || p.programme_id })).filter((p) => p.label);
            const fallback = row.programmesList.map((label) => ({ id: null, label }));
            return { ...row, programmesDoc: docPrograms.length ? docPrograms : fallback };
          });
        }).catch((err) => {
          console.warn('[BITD][Entreprises] Programmes indisponibles :', err);
        })
      );
    }

    if (window.BITDProvenance && window.BITDProvenance.load) {
      optionalTasks.push(
        window.BITDProvenance.load().then(() => {
          state.provenanceLoaded = true;
        }).catch((err) => {
          console.warn('[BITD][Entreprises] Provenance indisponible :', err);
        })
      );
    }

    if (window.BITDIdentite && window.BITDIdentite.loadAll) {
      optionalTasks.push(
        window.BITDIdentite.loadAll().then(() => {
          state.identiteLoaded = true;
          state.rows = state.rows.map((row) => {
            const identite = window.BITDIdentite.getIdentite(row.id);
            const caps = window.BITDIdentite.getCapabilities(row.id);
            const primaryCV = window.BITDIdentite.getPrimaryChainValue(row.id);
            const secondaryCVs = window.BITDIdentite.getSecondaryChainValues(row.id);
            return {
              ...row,
              identite: identite || null,
              capacites: caps,
              primaryChainValueId: identite ? identite.chaine_valeur_principale_id : '',
              primaryChainValueLabel: primaryCV ? primaryCV.libelle : '',
              secondaryChainValues: secondaryCVs
            };
          });
        }).catch((err) => {
          console.warn('[BITD][Entreprises] Identité industrielle indisponible (fail-soft) :', err);
        })
      );
    }

    await Promise.all(optionalTasks);

    state.rows = state.rows.map((row) => {
      const programmeNames = (row.programmesDoc || []).map((p) => p.label);
      const identiteContrib = (state.identiteLoaded && window.BITDIdentite)
        ? window.BITDIdentite.buildSearchIndexContribution(row.id)
        : '';
      return {
        ...row,
        searchIndex: normalizeText(`${row.searchIndex} ${programmeNames.join(' ')} ${identiteContrib}`)
      };
    });
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  }

  function fillFilterSelect(select, values, defaultLabel) {
    const current = select.value;
    const options = [`<option value="all">${defaultLabel}</option>`]
      .concat(values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`));
    select.innerHTML = options.join('');
    select.value = values.includes(current) ? current : 'all';
  }

  function filtersActive() {
    return Boolean(
      dom.search.value.trim()
      || dom.filterCircle.value !== 'all'
      || dom.filterDomain.value !== 'all'
      || dom.filterRole.value !== 'all'
      || dom.filterProgramme.value !== 'all'
    );
  }

  function applyFilters() {
    const q = normalizeText(dom.search.value);
    const circle = dom.filterCircle.value;
    const domain = dom.filterDomain.value;
    const role = dom.filterRole.value;
    const programme = dom.filterProgramme.value;

    state.filtered = state.rows.filter((row) => {
      if (q && !row.searchIndex.includes(q)) return false;
      if (circle !== 'all' && String(row.cercle || '') !== String(circle)) return false;
      if (domain !== 'all' && row.secteurPrincipal !== domain) return false;
      if (role !== 'all') {
        // Filter by chain of value label (primary or secondary)
        const cvLabel = row.primaryChainValueLabel || row.role;
        const secondaryLabels = (row.secondaryChainValues || []).map((cv) => cv.libelle);
        const allLabels = [cvLabel, ...secondaryLabels];
        if (!allLabels.includes(role)) return false;
      }
      if (programme !== 'all') {
        const names = (row.programmesDoc || []).map((p) => p.label);
        if (!names.includes(programme)) return false;
      }
      return true;
    });

    dom.count.textContent = `${state.filtered.length} entreprise${state.filtered.length > 1 ? 's' : ''}`;
    dom.reset.hidden = !filtersActive();

    if (!state.filtered.length) {
      dom.list.innerHTML = '';
      dom.tableBody.innerHTML = '';
      dom.empty.hidden = false;
      dom.detail.innerHTML = '';
      return;
    }

    dom.empty.hidden = true;

    if (!state.filtered.some((row) => row.id === state.selectedId)) {
      state.selectedId = state.filtered[0].id;
    }

    renderCards();
    renderDetail();
    renderCompactTable();
  }

  function circleLabel(row) {
    if (String(row.cercle) === '1') return 'Cercle 1 · Grand maître d’œuvre';
    if (String(row.cercle) === '2') return 'Cercle 2 · Acteur industriel structurant';
    return 'Panel BITD';
  }

  function renderCards() {
    const cards = state.filtered.map((row) => {
      const isActive = row.id === state.selectedId;
      const cvLabel = row.primaryChainValueLabel || '';
      const caps = (row.capacites || []).slice(0, 3);
      const capTags = caps.map((c) => `<span class="chip chip-cap">${esc(c)}</span>`).join('');
      return `
        <article class="entreprise-card ${isActive ? 'is-active' : ''}" data-company-id="${esc(row.id)}">
          <button type="button" class="entreprise-card-btn" data-company-id="${esc(row.id)}">
            <h3>${esc(row.entreprise)}</h3>
            <p class="entreprise-card-role">${esc(circleLabel(row))}</p>
            <p class="entreprise-card-domain">${esc(row.secteurPrincipal || 'Domaine non renseigné')}</p>
            ${cvLabel ? `<p class="entreprise-card-cv"><span class="cv-badge">${esc(cvLabel)}</span></p>` : ''}
            ${capTags ? `<div class="entreprise-card-tags">${capTags}</div>` : ''}
            <span class="entreprise-card-link">Voir la fiche →</span>
          </button>
        </article>
      `;
    }).join('');

    dom.list.innerHTML = cards;

    dom.list.querySelectorAll('[data-company-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const companyId = el.getAttribute('data-company-id');
        selectCompany(companyId);
      });
    });
  }

  function provenanceLink(entrepriseId, entrepriseName, champ, label, value = '') {
    if (!window.BITDProvenance || !state.provenanceLoaded) return '';
    return window.BITDProvenance.sourceButton({ entrepriseId, entrepriseName, champ, label, value });
  }

  function keyFigures(row) {
    const figures = [];

    if (row.ca_defense_label) {
      figures.push({
        title: 'CA / activité Défense',
        value: compactText(row.ca_defense_label, 160),
        meta: row.date_reference ? `Référence ${row.date_reference}` : '',
        champ: 'ca_defense_label'
      });
    }

    if (row.effectif_label) {
      figures.push({
        title: 'Effectif',
        value: compactText(row.effectif_label, 130),
        meta: row.date_reference ? `Référence ${row.date_reference}` : '',
        champ: 'effectif_label'
      });
    }

    const btb = toNumber(row.book_to_bill);
    if (btb != null) {
      figures.push({
        title: 'Book-to-bill',
        value: `${btb.toFixed(2)}x`,
        meta: row.book_to_bill_perimetre || '',
        champ: 'book_to_bill'
      });
    }

    const ratio = toNumber(row.ratio_carnet_ca);
    if (ratio != null) {
      figures.push({
        title: 'Carnet / CA',
        value: `${ratio.toFixed(2)}x`,
        meta: row.ratio_carnet_ca_perimetre || '',
        champ: 'ratio_carnet_ca'
      });
    }

    if (row.carnet_commandes_label) {
      figures.push({
        title: 'Carnet de commandes',
        value: compactText(row.carnet_commandes_label, 160),
        meta: '',
        champ: 'carnet_commandes_label'
      });
    }

    return figures.slice(0, 5);
  }

  function renderProgrammeChips(row) {
    const programmes = (row.programmesDoc || []).slice(0, 8);
    if (!programmes.length) return '<p class="small-note">Aucun programme documenté pour cette entreprise.</p>';

    return `<div class="detail-programmes">${programmes.map((p) => {
      if (p.id) {
        return `<a class="chip chip-link" href="index.html?programme=${encodeURIComponent(p.id)}">${esc(p.label)}</a>`;
      }
      return `<span class="chip">${esc(p.label)}</span>`;
    }).join('')}</div>`;
  }

  function renderPanelSources(row) {
    if (!row.panelSources || !row.panelSources.length) return '<p class="small-note">Sources de sélection indisponibles.</p>';
    return `<ul class="detail-source-list">${row.panelSources.slice(0, 5).map((s) => {
      const title = s.source_title || s.publisher || 'Source';
      return s.url
        ? `<li><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(title)} ↗</a></li>`
        : `<li>${esc(title)}</li>`;
    }).join('')}</ul>`;
  }

  function renderMainSources(row, identite = null) {
    const items = [];

    // Add identity source if available
    if (identite && identite.source_industrielle_id && window.BITDProvenance && state.provenanceLoaded) {
      const src = window.BITDProvenance.getSource(identite.source_industrielle_id);
      if (src && src.url) {
        items.push({ key: src.url, title: src.libelle || 'Source industrielle', url: src.url, priority: 0 });
      }
    }

    if (window.BITDProvenance && state.provenanceLoaded) {
      const srcs = window.BITDProvenance.getSourcesForEntreprise(row.entreprise) || [];
      srcs.forEach((src) => {
        if (!src.url) return;
        const key = `${src.libelle}|${src.url}`;
        if (items.some((it) => it.key === key)) return;
        const type = String(src.type_source || '').toLowerCase();
        const priority = type.includes('financier') ? 1
          : type.includes('implant') ? 2
            : type.includes('corporate') ? 3
              : 4;
        items.push({ key, title: src.libelle || src.usage_principal || 'Source', url: src.url, priority });
      });
    }

    if (row.panelSources && row.panelSources.length) {
      row.panelSources.forEach((s) => {
        if (!s.url) return;
        const key = `${s.source_title || s.publisher}|${s.url}`;
        if (items.some((it) => it.key === key)) return;
        items.push({ key, title: s.source_title || s.publisher || 'Source sélection panel', url: s.url, priority: 5 });
      });
    }

    const htmlItems = items
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)
      .map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)} ↗</a></li>`)
      .join('');

    return htmlItems || '<li class="small-note">Aucune source disponible.</li>';
  }

  // ---------------------------------------------------------------------------
  // Chain of value visualization helpers
  // ---------------------------------------------------------------------------

  // Conceptual zones for the chain of value visualization
  const CV_ZONES = [
    {
      label: 'Amont',
      ids: ['CV04', 'CV05', 'CV08'],
      description: 'Composants, matériaux, munitions & production'
    },
    {
      label: 'Équipements',
      ids: ['CV03'],
      description: 'Équipementiers & fournisseurs de systèmes'
    },
    {
      label: 'Intégration',
      ids: ['CV01', 'CV02'],
      description: 'Maîtres d\'œuvre & ensembliers'
    },
    {
      label: 'Soutien & expertise',
      ids: ['CV06', 'CV07'],
      description: 'MCO, services, ingénierie & qualification'
    }
  ];

  function renderChainValueViz(row, mobile = false) {
    const primaryId = row.primaryChainValueId || '';
    const secondaryIds = (row.secondaryChainValues || []).map(getChainValueId);

    if (!primaryId) return '';

    if (mobile) {
      // Mobile: simple text display
      const primaryLabel = row.primaryChainValueLabel || primaryId;
      const secondaryLabels = (row.secondaryChainValues || []).map((cv) => cv.libelle);
      return `
        <div class="cv-mobile">
          <div class="cv-mobile-primary">
            <span class="cv-mobile-label">Rôle principal</span>
            <span class="cv-badge cv-badge--primary">${esc(primaryLabel)}</span>
          </div>
          ${secondaryLabels.length ? `
            <div class="cv-mobile-secondary">
              <span class="cv-mobile-label">Rôles complémentaires</span>
              <div class="cv-mobile-secondary-list">
                ${secondaryLabels.map((l) => `<span class="cv-badge cv-badge--secondary">${esc(l)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          <button type="button" class="cv-info-btn" data-cv-id="${esc(primaryId)}">Comprendre cette position ⓘ</button>
        </div>
      `;
    }

    // Desktop: 4-zone visualization
    const zonesHtml = CV_ZONES.map((zone) => {
      const cvRows = zone.ids.map((id) => {
        if (!window.BITDIdentite) return null;
        const cv = window.BITDIdentite.getChainValue(id);
        if (!cv) return null;
        const isPrimary = id === primaryId;
        const isSecondary = secondaryIds.includes(id);
        const cls = isPrimary ? 'cv-node cv-node--primary'
          : isSecondary ? 'cv-node cv-node--secondary'
            : 'cv-node cv-node--inactive';
        return `
          <div class="${cls}" data-cv-id="${esc(id)}" tabindex="0" role="button" aria-label="${esc(cv.libelle)}">
            <span class="cv-node-label">${esc(cv.libelle)}</span>
            <div class="cv-tooltip" role="tooltip">
              <strong>${esc(cv.libelle)}</strong>
              <p>${esc(cv.definition)}</p>
            </div>
          </div>
        `;
      }).filter(Boolean).join('');
      return `
        <div class="cv-zone">
          <span class="cv-zone-label">${esc(zone.label)}</span>
          <div class="cv-zone-nodes">${cvRows}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="cv-viz" aria-label="Position dans la chaîne de valeur">
        <div class="cv-zones">${zonesHtml}</div>
        <p class="cv-annotation">Lecture analytique de la chaîne de valeur</p>
        <p class="cv-methodo-link">
          <button type="button" class="cv-methodo-btn" data-cv-methodo>Comment cette classification est-elle construite ? ⓘ</button>
        </p>
      </div>
    `;
  }

  function buildDetailHtml(row, mobile = false) {
    const identite = row.identite || null;
    const figures = keyFigures(row);
    const figureHtml = figures.length
      ? `<div class="detail-figures-grid">${figures.map((fig) => `
          <article class="detail-figure-card">
            <h4>${esc(fig.title)}</h4>
            <p>${esc(fig.value)}</p>
            ${fig.meta ? `<span>${esc(fig.meta)}</span>` : ''}
            ${provenanceLink(row.id, row.entreprise, fig.champ, fig.title, fig.value)}
          </article>
        `).join('')}</div>`
      : '<p class="small-note">Aucun indicateur clé publiquement comparable.</p>';

    const criteria = splitValues(row.criteresSelection).join(' · ');
    const programs = renderProgrammeChips(row);
    const sourceItems = renderMainSources(row, identite);

    // Industrial identity sections
    const hasIdentite = Boolean(identite);

    const headerSectorLine = hasIdentite
      ? esc(identite.secteur_principal || row.secteurPrincipal || 'Domaine non renseigné')
      : esc([row.secteurPrincipal, ...row.sectors.filter((s) => s !== row.secteurPrincipal)].filter(Boolean).slice(0, 3).join(' · ') || 'Domaine non renseigné');

    const cvMainLabel = row.primaryChainValueLabel || (hasIdentite ? identite.type_acteur_panel : row.role) || '';

    const positionnementHtml = hasIdentite
      ? `<section class="detail-section">
          <h3>Positionnement industriel</h3>
          <p class="positionnement-text">${esc(identite.positionnement_industriel || '')}</p>
          ${identite.type_acteur_panel && identite.primaryChainValueLabel !== identite.type_acteur_panel ? `
            <p class="small-note type-acteur-note">
              <em>Type d'acteur panel (institutionnel) :</em> ${esc(identite.type_acteur_panel)}<br>
              <em>Position fonctionnelle (chaîne de valeur) :</em> ${esc(row.primaryChainValueLabel || '')}
            </p>
          ` : ''}
        </section>`
      : `<section class="detail-section">
          <h3>Positionnement industriel</h3>
          <p><strong>Spécialité :</strong> ${esc(row.specialite || 'Non renseignée')}</p>
        </section>`;

    const retenir = hasIdentite && identite.ce_qu_il_faut_retenir
      ? `<section class="detail-section detail-retenir">
          <div class="retenir-block">
            <span class="retenir-label">Ce qu'il faut retenir</span>
            <p class="retenir-text">${esc(identite.ce_qu_il_faut_retenir)}</p>
          </div>
        </section>`
      : '';

    const cvSection = (hasIdentite && row.primaryChainValueId)
      ? `<section class="detail-section">
          <h3>Position dans la chaîne de valeur</h3>
          <div class="cv-roles">
            <div class="cv-role-primary">
              <span class="cv-role-label">Rôle principal</span>
              <span class="cv-badge cv-badge--primary">${esc(row.primaryChainValueLabel || row.primaryChainValueId)}</span>
            </div>
            ${(row.secondaryChainValues || []).length ? `
              <div class="cv-role-secondary">
                <span class="cv-role-label">Rôles complémentaires</span>
                <div class="cv-role-secondary-list">
                  ${(row.secondaryChainValues || []).map((cv) => `<span class="cv-badge cv-badge--secondary">${esc(cv.libelle)}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
          ${renderChainValueViz(row, mobile)}
        </section>`
      : '';

    const capsSection = (hasIdentite && row.capacites && row.capacites.length)
      ? `<section class="detail-section">
          <h3>Capacités clés</h3>
          <div class="detail-capacites">${row.capacites.slice(0, 6).map((c) => `<span class="chip chip-cap">${esc(c)}</span>`).join('')}</div>
        </section>`
      : '';

    const identiteUnavailableNote = !hasIdentite
      ? '<p class="small-note identite-unavailable">Analyse industrielle détaillée non disponible.</p>'
      : '';

    return `
      <div class="entreprise-detail-content ${mobile ? 'is-mobile' : ''}">
        <header class="detail-identity">
          <h2>${esc(row.entreprise)}</h2>
          <p class="detail-sector">${headerSectorLine}</p>
          <p class="detail-circle">${esc(circleLabel(row))}${cvMainLabel ? ` · <span class="detail-cv-header">${esc(cvMainLabel)}</span>` : ''}</p>
          <div class="detail-actions">
            <a href="index.html?entreprise=${encodeURIComponent(row.slug || row.id)}" class="detail-map-link">Voir sur la carte →</a>
            ${state.panelLoaded ? `<button type="button" class="detail-why-btn" data-why-company="${esc(row.id)}">Pourquoi dans le panel ? ⓘ</button>` : ''}
          </div>
        </header>

        ${identiteUnavailableNote}
        ${retenir}
        ${positionnementHtml}
        ${cvSection}
        ${capsSection}

        <section class="detail-section">
          <h3>Quelques chiffres</h3>
          ${figureHtml}
        </section>

        <section class="detail-section">
          <h3>Programmes documentés</h3>
          ${programs}
        </section>

        <section class="detail-section">
          <h3>Implantation en France</h3>
          <p>${row.implantationsCount != null ? `${esc(formatCount(row.implantationsCount, `établissement${row.implantationsCount > 1 ? 's' : ''} référencé${row.implantationsCount > 1 ? 's' : ''}`))}` : 'Implantations non disponibles.'}</p>
          ${row.regionsCount != null ? `<p>${esc(formatCount(row.regionsCount, `région${row.regionsCount > 1 ? 's' : ''} représentée${row.regionsCount > 1 ? 's' : ''}`))}</p>` : ''}
          <a href="index.html?entreprise=${encodeURIComponent(row.slug || row.id)}" class="detail-map-link">Voir les implantations sur la carte →</a>
        </section>

        <section class="detail-section">
          <h3>Pourquoi dans le panel ?</h3>
          ${row.justificationSelection ? `<p>${esc(row.justificationSelection)}</p>` : '<p class="small-note">Justification indisponible.</p>'}
          ${row.libelleModeSelection ? `<p class="panel-meta"><strong>Nature :</strong> ${esc(row.libelleModeSelection)}</p>` : ''}
          ${criteria ? `<p class="panel-meta"><strong>Critères :</strong> ${esc(criteria)}</p>` : ''}
          ${renderPanelSources(row)}
        </section>

        <section class="detail-section">
          <h3>Sources</h3>
          ${hasIdentite ? `<p class="panel-meta"><strong>Nature de l'analyse :</strong> Synthèse analytique documentée</p>` : ''}
          <ul class="detail-source-list">${sourceItems}</ul>
          <a href="methodologie.html#lire-la-chaine-de-valeur" class="detail-map-link">Voir la méthodologie →</a>
        </section>
      </div>
    `;
  }

  function bindDetailActions(root) {
    if (!root) return;
    root.querySelectorAll('[data-why-company]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-why-company');
        if (window.BITDPanel && id) window.BITDPanel.openWhyOverlay(id, btn);
      });
    });

    // CV node tooltip on click/focus for mobile
    root.querySelectorAll('.cv-node').forEach((node) => {
      node.addEventListener('click', () => {
        root.querySelectorAll('.cv-node').forEach((n) => n.classList.remove('cv-node--open'));
        node.classList.toggle('cv-node--open');
      });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          root.querySelectorAll('.cv-node').forEach((n) => n.classList.remove('cv-node--open'));
          node.classList.toggle('cv-node--open');
        }
      });
    });

    // CV methodo button
    root.querySelectorAll('[data-cv-methodo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = 'Cette classification est une lecture analytique propre au dashboard BITD France, construite pour rendre lisible la position des entreprises dans la chaîne de valeur. Elle s\'appuie notamment sur les travaux EcoDef consacrés aux fonctions industrielles des entreprises de défense ; elle ne constitue pas une nomenclature officielle.';
        // Simple alert-like overlay
        const overlay = document.createElement('div');
        overlay.className = 'cv-methodo-overlay';
        overlay.innerHTML = `<div class="cv-methodo-overlay-box"><p>${esc(msg)}</p><button type="button" class="cv-methodo-close">Fermer</button></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.cv-methodo-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      });
    });

    // CV info button (mobile)
    root.querySelectorAll('.cv-info-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cvId = btn.getAttribute('data-cv-id');
        if (!cvId || !window.BITDIdentite) return;
        const cv = window.BITDIdentite.getChainValue(cvId);
        if (!cv) return;
        const overlay = document.createElement('div');
        overlay.className = 'cv-methodo-overlay';
        overlay.innerHTML = `<div class="cv-methodo-overlay-box"><strong>${esc(cv.libelle)}</strong><p>${esc(cv.definition)}</p><button type="button" class="cv-methodo-close">Fermer</button></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.cv-methodo-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      });
    });
  }

  function isDesktopLayout() {
    return window.innerWidth >= 1100;
  }

  function selectCompany(companyId) {
    state.selectedId = companyId;
    renderCards();
    if (isDesktopLayout()) {
      renderDetail();
    } else {
      openMobileDetail();
    }
  }

  function renderDetail() {
    const selected = state.rows.find((row) => row.id === state.selectedId);
    if (!selected) {
      dom.detail.innerHTML = '';
      return;
    }

    dom.detail.innerHTML = buildDetailHtml(selected, false);
    bindDetailActions(dom.detail);
  }

  function openMobileDetail() {
    const selected = state.rows.find((row) => row.id === state.selectedId);
    if (!selected) return;
    dom.mobileDetailContent.innerHTML = buildDetailHtml(selected, true);
    bindDetailActions(dom.mobileDetailContent);
    dom.mobileDetail.hidden = false;
    document.body.classList.add('mobile-detail-open');
  }

  function closeMobileDetail() {
    dom.mobileDetail.hidden = true;
    document.body.classList.remove('mobile-detail-open');
  }

  function renderCompactTable() {
    const html = state.filtered.map((row) => `
      <tr>
        <td><button type="button" class="table-company-link" data-company-id="${esc(row.id)}">${esc(row.entreprise)}</button></td>
        <td>${esc(row.cercle ? `Cercle ${row.cercle}` : '—')}</td>
        <td>${esc(row.secteurPrincipal || '—')}</td>
        <td>${esc(compactText(row.ca_defense_label, 70) || '—')}</td>
        <td>${esc(compactText(row.effectif_label, 60) || '—')}</td>
        <td>${row.implantationsCount != null ? esc(String(row.implantationsCount)) : '—'}</td>
      </tr>
    `).join('');
    dom.tableBody.innerHTML = html;

    dom.tableBody.querySelectorAll('.table-company-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-company-id');
        state.view = 'explorer';
        updateViewButtons();
        dom.explorer.hidden = false;
        dom.tableau.hidden = true;
        selectCompany(id);
      });
    });
  }

  function updateViewButtons() {
    document.querySelectorAll('.entreprises-view-toggle button').forEach((btn) => {
      const active = btn.getAttribute('data-view') === state.view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function parseCompanyFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('entreprise') || '').trim();
    if (!raw) return null;
    const lowered = raw.toLowerCase();
    return state.rows.find((row) => row.id === raw || String(row.slug || '').toLowerCase() === lowered) || null;
  }

  function updateMeta() {
    const total = state.rows.length;
    const c1 = state.rows.filter((r) => String(r.cercle) === '1').length;
    const c2 = state.rows.filter((r) => String(r.cercle) === '2').length;
    dom.meta.textContent = c1 || c2
      ? `${total} acteurs · ${c1} Cercle 1 · ${c2} Cercle 2`
      : `${total} acteurs`;
  }

  function resetFilters() {
    dom.search.value = '';
    dom.filterCircle.value = 'all';
    dom.filterDomain.value = 'all';
    dom.filterRole.value = 'all';
    dom.filterProgramme.value = 'all';
    applyFilters();
  }

  async function init() {
    dom.loading.hidden = false;
    dom.error.hidden = true;
    dom.explorer.hidden = true;
    dom.tableau.hidden = true;

    // 1. CORE — only here do we show "référentiel impossible à charger"
    try {
      state.rows = await loadCoreRows();
    } catch (err) {
      console.error('[BITD][Entreprises][CORE] entreprises.csv impossible à charger', err);
      dom.loading.hidden = true;
      dom.error.hidden = false;
      dom.explorer.hidden = true;
      dom.tableau.hidden = true;
      return;
    }

    // 2. ENRICHISSEMENTS — fail-soft
    try {
      await enrichOptionalData();
    } catch (err) {
      console.warn('[BITD][Entreprises][ENRICHISSEMENT]', err);
    }

    // 3. RENDU
    try {
      fillFilterSelect(dom.filterDomain, uniqueSorted(state.rows.map((row) => row.secteurPrincipal)), 'Tous');

      // Chain of value filter: prefer identity data, fall back to row.role
      const cvLabels = state.identiteLoaded && window.BITDIdentite
        ? window.BITDIdentite.getAllChainValues().map((cv) => cv.libelle)
        : uniqueSorted(state.rows.flatMap((row) => {
          const labels = [];
          if (row.primaryChainValueLabel) labels.push(row.primaryChainValueLabel);
          (row.secondaryChainValues || []).forEach((cv) => labels.push(cv.libelle));
          if (!labels.length) labels.push(row.role);
          return labels;
        }));
      fillFilterSelect(dom.filterRole, cvLabels.filter(Boolean), 'Toutes les positions');
      fillFilterSelect(
        dom.filterProgramme,
        uniqueSorted(state.rows.flatMap((row) => (row.programmesDoc || []).map((p) => p.label))),
        'Tous'
      );

      updateMeta();

      const fromUrl = parseCompanyFromUrl();
      state.selectedId = fromUrl ? fromUrl.id : (state.rows[0] ? state.rows[0].id : null);

      applyFilters();
      dom.loading.hidden = true;
      dom.explorer.hidden = false;
      dom.tableau.hidden = true;
    } catch (err) {
      console.error('[BITD][Entreprises][RENDER]', err);
      // state.rows is loaded — show explorer with whatever data we have
      dom.loading.hidden = true;
      if (state.rows.length) {
        applyFilters();
        dom.explorer.hidden = false;
        dom.tableau.hidden = true;
      } else {
        dom.error.hidden = false;
      }
    }
  }

  [dom.search, dom.filterCircle, dom.filterDomain, dom.filterRole, dom.filterProgramme].forEach((el) => {
    if (!el) return;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', applyFilters);
  });

  if (dom.reset) dom.reset.addEventListener('click', resetFilters);
  if (dom.emptyReset) dom.emptyReset.addEventListener('click', resetFilters);
  if (dom.retry) dom.retry.addEventListener('click', init);

  document.querySelectorAll('.entreprises-view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.getAttribute('data-view') === 'tableau' ? 'tableau' : 'explorer';
      updateViewButtons();
      dom.explorer.hidden = state.view !== 'explorer';
      dom.tableau.hidden = state.view !== 'tableau';
      if (state.view === 'explorer') renderDetail();
    });
  });

  if (dom.mobileDetail) {
    dom.mobileDetail.querySelectorAll('[data-close-mobile-detail]').forEach((el) => {
      el.addEventListener('click', closeMobileDetail);
    });
  }

  window.addEventListener('resize', () => {
    if (dom.mobileDetail && isDesktopLayout() && !dom.mobileDetail.hidden) closeMobileDetail();
  });

  init();
})();
