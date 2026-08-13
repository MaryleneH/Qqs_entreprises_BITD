/**
 * BITD France — Mode Programme
 * Gestion du chargement des données, du rendu carte et du panneau programme.
 */
(function () {
  // -------------------------------------------------------------------------
  // État interne
  // -------------------------------------------------------------------------
  const progState = {
    programmes: [],
    entrepriseProgramme: [],
    siteProgramme: [],
    loaded: false,
    loadPromise: null
  };

  // -------------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------------
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
        if (inQuotes && next === '"') { current += '"'; i += 1; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        row.push(current); current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        if (current.length || row.length) { row.push(current); rows.push(row); row = []; current = ''; }
      } else {
        current += char;
      }
    }
    if (current.length || row.length) { row.push(current); rows.push(row); }

    const [header, ...body] = rows;
    if (!header) return [];
    const cleanHeader = header.map((h) => h.replace(/^\uFEFF/, '').trim());
    return body.map((cells) => Object.fromEntries(cleanHeader.map((key, idx) => [key, cells[idx] ?? ''])));
  }

  async function loadCSV(filename) {
    const url = new URL(filename, document.baseURI);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossible de charger ${filename}`);
    return parseCSV(await res.text());
  }

  async function loadAll() {
    if (progState.loadPromise) return progState.loadPromise;
    progState.loadPromise = Promise.all([
      loadCSV('data/programmes.csv'),
      loadCSV('data/entreprise_programme.csv'),
      loadCSV('data/site_programme.csv')
    ]).then(([progs, ep, sp]) => {
      progState.programmes = progs;
      progState.entrepriseProgramme = ep;
      progState.siteProgramme = sp;
      progState.loaded = true;
    });
    return progState.loadPromise;
  }

  function getProgramme(id) {
    return progState.programmes.find((p) => p.programme_id === id) || null;
  }

  function getAllProgrammes() {
    return progState.programmes.slice();
  }

  function getEntreprisesProgramme(programmeId) {
    return progState.entrepriseProgramme.filter((r) => r.programme_id === programmeId);
  }

  function getSitesProgramme(programmeId) {
    return progState.siteProgramme.filter((r) => r.programme_id === programmeId);
  }

  function getProgrammesForEntreprise(entrepriseId) {
    const id = String(entrepriseId);
    return progState.entrepriseProgramme
      .filter((r) => String(r.entreprise_id) === id)
      .map((r) => {
        const prog = getProgramme(r.programme_id);
        return prog ? { ...r, nom: prog.nom, acronyme: prog.acronyme } : null;
      })
      .filter(Boolean);
  }

  // -------------------------------------------------------------------------
  // Rendu panneau programme
  // -------------------------------------------------------------------------
  function renderProgrammeEmpty() {
    const panel = document.getElementById('company-panel-content');
    if (!panel) return;
    panel.innerHTML = `
      <div class="programme-panel-empty">
        <div class="programme-panel-empty-icon">
          <svg viewBox="0 0 32 32" width="40" height="40" fill="none" stroke="var(--navy-secondary)" stroke-width="1.5">
            <circle cx="16" cy="16" r="13"/>
            <path d="M16 9v7l4 4"/>
          </svg>
        </div>
        <h3>Explorer un programme</h3>
        <p class="small-note">Sélectionnez un programme dans le menu pour découvrir les entreprises du référentiel qui y participent.</p>
      </div>
    `;
  }

  function renderProgrammePanel(programme, relations, siteLinks, allCompanies) {
    const panel = document.getElementById('company-panel-content');
    if (!panel) return;

    const moe = relations.find((r) => r.role && r.role.toLowerCase().includes('maître'));
    const autres = relations.filter((r) => r !== moe);

    const totalSites = siteLinks.length;
    const roles = [...new Set(relations.map((r) => r.role).filter(Boolean))];

    const moeHtml = moe ? `
      <div class="programme-moe">
        <span class="programme-moe-label">Maître d'œuvre</span>
        <button type="button" class="programme-company-link" data-entreprise-id="${esc(moe.entreprise_id)}">
          <strong>${esc(moe.entreprise)}</strong>
        </button>
        ${moe.sous_systeme ? `<span class="programme-tag">${esc(moe.sous_systeme)}</span>` : ''}
      </div>
    ` : '';

    const autresHtml = autres.map((r) => {
      const company = allCompanies.find((c) => String(c.id) === String(r.entreprise_id));
      const siteCount = siteLinks.filter((s) => String(s.entreprise_id) === String(r.entreprise_id)).length;
      const confirmation = r.niveau_confirmation === 'confirme'
        ? '<span class="prog-badge prog-badge--confirme">Documenté</span>'
        : '<span class="prog-badge prog-badge--partial">Documenté partiellement</span>';
      return `
        <div class="programme-participant">
          <button type="button" class="programme-company-link" data-entreprise-id="${esc(r.entreprise_id)}">
            <strong>${esc(r.entreprise)}</strong>
          </button>
          ${confirmation}
          <div class="programme-participant-role">${esc(r.role)}${r.sous_systeme ? ` · <em>${esc(r.sous_systeme)}</em>` : ''}</div>
          ${siteCount > 0 ? `<div class="programme-participant-sites">${siteCount} site${siteCount > 1 ? 's' : ''} documenté${siteCount > 1 ? 's' : ''}</div>` : '<div class="programme-participant-sites programme-participant-sites--none">Site précis non identifié dans les sources</div>'}
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="programme-panel">
        <div class="programme-panel-header">
          <span class="programme-panel-domaine">${esc(programme.domaine)}</span>
          <h3 class="programme-panel-titre">${esc(programme.acronyme || programme.nom)}</h3>
          <p class="programme-panel-desc">${esc(programme.description_courte)}</p>
          <div class="programme-panel-statut">
            <span class="programme-statut-badge">${esc(programme.statut)}</span>
          </div>
        </div>

        <div class="programme-kpis">
          <div><strong>${relations.length}</strong><span>entreprise${relations.length > 1 ? 's' : ''} référencée${relations.length > 1 ? 's' : ''}</span></div>
          <div><strong>${totalSites}</strong><span>site${totalSites > 1 ? 's' : ''} documenté${totalSites > 1 ? 's' : ''}</span></div>
          <div><strong>${roles.length}</strong><span>rôle${roles.length > 1 ? 's' : ''}</span></div>
        </div>

        ${moeHtml}

        ${autres.length > 0 ? `
          <h4 class="programme-section-title">Entreprises participantes</h4>
          <div class="programme-participants-list">${autresHtml}</div>
        ` : ''}

        <p class="programme-panel-source-note">
          Données issues de sources publiques documentées. Seules les participations explicitement référencées sont affichées.
        </p>
      </div>
    `;

    // Bind company links
    panel.querySelectorAll('.programme-company-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        const eid = btn.getAttribute('data-entreprise-id');
        if (eid && window.BITDData) {
          window.BITDData.switchToEntreprise(String(eid));
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // Rendu panneau entreprise — section Programmes associés
  // -------------------------------------------------------------------------
  function renderProgrammesForEntreprise(entrepriseId) {
    const container = document.getElementById('company-programmes-section');
    if (!container || !progState.loaded) return;

    const progs = getProgrammesForEntreprise(entrepriseId);
    if (!progs.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <h4>Programmes associés</h4>
      <div class="company-prog-list">
        ${progs.map((p) => `
          <button type="button" class="company-prog-link" data-programme-id="${esc(p.programme_id)}">
            ${esc(p.acronyme || p.nom)}
          </button>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('.company-prog-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-programme-id');
        if (pid && window.BITDData) {
          window.BITDData.setProgramme(pid);
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // Remplissage du sélecteur programme
  // -------------------------------------------------------------------------
  function fillProgrammeSelect() {
    const select = document.getElementById('programme-select');
    if (!select) return;
    const current = select.value;
    const options = ['<option value="">Tous les programmes</option>']
      .concat(progState.programmes.map((p) => `<option value="${esc(p.programme_id)}">${esc(p.nom)}</option>`));
    select.innerHTML = options.join('');
    if (current) select.value = current;
  }

  // -------------------------------------------------------------------------
  // Exposition publique
  // -------------------------------------------------------------------------
  window.BITDProgramme = {
    loadAll,
    getProgramme,
    getAllProgrammes,
    getEntreprisesProgramme,
    getSitesProgramme,
    getProgrammesForEntreprise,
    fillProgrammeSelect,
    renderProgrammeEmpty,
    renderProgrammePanel,
    renderProgrammesForEntreprise
  };
})();
