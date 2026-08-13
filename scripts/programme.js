/**
 * BITD France — Mode Programme
 * Gestion du chargement des données, du rendu carte et du panneau programme.
 *
 * Sources de vérité :
 *   data/programmes.csv
 *   data/entreprise_programme.csv
 *   data/programme_sources.csv     (enrichissement — fail-soft)
 *   data/programme_composantes.csv (enrichissement — fail-soft)
 */
(function () {
  // -------------------------------------------------------------------------
  // État interne
  // -------------------------------------------------------------------------
  const progState = {
    programmes: [],
    entrepriseProgramme: [],
    siteProgramme: [],
    sources: [],
    composantes: [],
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

  function isTrue(value) {
    return String(value ?? '').trim().toLowerCase() === 'true';
  }

  /** Parse a delimited text file. Delimiter is auto-detected (first header char search). */
  function parseDelimitedCSV(text, sep) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;

    const delimiter = sep || (text.indexOf(';') !== -1 && text.indexOf(';') < (text.indexOf(',') === -1 ? Infinity : text.indexOf(',')) ? ';' : ',');

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') { current += '"'; i += 1; }
        else { inQuotes = !inQuotes; }
      } else if (char === delimiter && !inQuotes) {
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
    return parseDelimitedCSV(await res.text());
  }

  async function loadCSVOptional(filename) {
    try {
      return await loadCSV(filename);
    } catch (err) {
      console.warn(`[BITD][Programme] Enrichissement non chargé : ${filename}`, err);
      return [];
    }
  }

  async function loadAll() {
    if (progState.loadPromise) return progState.loadPromise;
    progState.loadPromise = Promise.all([
      loadCSV('data/programmes.csv'),
      loadCSV('data/entreprise_programme.csv'),
      loadCSV('data/site_programme.csv'),
      loadCSVOptional('data/programme_sources.csv'),
      loadCSVOptional('data/programme_composantes.csv')
    ]).then(([progs, ep, sp, srcs, comps]) => {
      progState.programmes = progs;
      progState.entrepriseProgramme = ep;
      progState.siteProgramme = sp;
      progState.sources = srcs;
      progState.composantes = comps;
      progState.loaded = true;
    });
    return progState.loadPromise;
  }

  // -------------------------------------------------------------------------
  // Accesseurs
  // -------------------------------------------------------------------------
  function getProgramme(id) {
    return progState.programmes.find((p) => p.programme_id === id) || null;
  }

  function getAllProgrammes() {
    return progState.programmes.slice();
  }

  /** Returns only currently active relations (relation_actuelle = true). */
  function getEntreprisesProgramme(programmeId) {
    return progState.entrepriseProgramme.filter(
      (r) => r.programme_id === programmeId && isTrue(r.relation_actuelle)
    );
  }

  function getSitesProgramme(programmeId) {
    return progState.siteProgramme.filter((r) => r.programme_id === programmeId);
  }

  function getComposantes(programmeId) {
    return progState.composantes.filter((c) => c.programme_id === programmeId);
  }

  function getSource(sourceId) {
    if (!sourceId) return null;
    return progState.sources.find((s) => s.source_id === sourceId) || null;
  }

  /** Returns programmes associated with an entreprise (current relations only). */
  function getProgrammesForEntreprise(entrepriseId) {
    const id = String(entrepriseId);
    return progState.entrepriseProgramme
      .filter((r) => String(r.entreprise_id) === id && isTrue(r.relation_actuelle))
      .map((r) => {
        const prog = getProgramme(r.programme_id);
        return prog ? { ...r, nom: prog.nom, acronyme: prog.acronyme } : null;
      })
      .filter(Boolean);
  }

  // -------------------------------------------------------------------------
  // Helpers de rendu
  // -------------------------------------------------------------------------
  function formatDate(isoDate) {
    if (!isoDate) return '';
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const parts = String(isoDate).split('-');
    if (parts.length !== 3) return isoDate;
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10) - 1;
    if (m < 0 || m > 11) return isoDate;
    return `${d} ${months[m]} ${parts[0]}`;
  }

  const TYPE_LABELS = {
    plateforme_et_programme_evolutif: 'Plateforme / programme évolutif',
    programme: 'Programme',
    programme_cooperation: 'Programme de coopération',
    famille_missile: 'Famille de missiles',
    famille_missile_et_systeme: 'Famille de missiles et systèmes',
    systeme_missile: 'Système missile',
    plateforme_et_programme: 'Plateforme / programme',
    programme_et_plateforme: 'Programme et plateforme',
    programme_modernisation: 'Programme de modernisation'
  };

  function getTypeLabel(typeObjet) {
    return TYPE_LABELS[typeObjet] || typeObjet || '';
  }

  /** Returns CSS modifier class for a statut_code (used on both programme and composante). */
  function statutClass(statut_code) {
    const code = String(statut_code || '').toUpperCase();
    if (code === 'ARRETE') return 'arrete';
    if (code === 'RECONFIGURE' || code === 'REFORMULE') return 'reconfigure';
    if (code === 'LIVRE' || code === 'COMMANDE') return 'livre';
    if (code === 'EN_SERVICE') return 'en-service';
    return 'actif'; // ACTIF_* and everything else
  }

  function buildSourceLink(sourceId, ariaLabel) {
    const src = getSource(sourceId);
    if (!src || !src.url) return '';
    const label = src.organisme ? `${esc(src.organisme)} — ${esc(src.titre)}` : esc(src.titre);
    const aria = ariaLabel ? ` aria-label="${esc(ariaLabel)}"` : '';
    return `<a class="prog-source-link" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"${aria}>${label} ↗</a>`;
  }

  // -------------------------------------------------------------------------
  // Rendu panneau programme (vide)
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
        <p class="small-note">Sélectionnez un programme dans le menu pour explorer son statut et les acteurs documentés.</p>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Rendu panneau programme (fiche complète)
  // -------------------------------------------------------------------------
  function renderProgrammePanel(programme) {
    const panel = document.getElementById('company-panel-content');
    if (!panel) return;

    const programmeId = programme.programme_id;

    // --- Statut ---
    const statutCode = programme.statut_code || '';
    const statutLibelle = programme.statut_libelle || programme.statut || '';
    const resumeStatut = programme.resume_statut || '';
    const derniereVerif = formatDate(programme.derniere_verification);
    const vigilance = String(programme.niveau_vigilance || '').toLowerCase();
    const cssClass = statutClass(statutCode);

    // --- Vigilance badge ---
    const vigilanceHtml = vigilance === 'elevee' ? `
      <span class="prog-vigilance" title="Ce programme a connu une évolution politique ou industrielle récente. Son statut doit être revalidé régulièrement." aria-label="Niveau de vigilance élevé : statut récemment reconfiguré">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M8 6v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="8" cy="11.5" r="0.6" fill="currentColor"/>
        </svg>
        Statut récemment reconfiguré
      </span>
    ` : '';

    // --- Sources ---
    const srcPrincHtml = buildSourceLink(
      programme.source_statut_principale_id,
      `Voir la source du statut du programme ${programme.acronyme || programme.nom}`
    );
    const srcSeconHtml = programme.source_statut_secondaire_id
      ? buildSourceLink(programme.source_statut_secondaire_id, `Source complémentaire pour ${programme.acronyme || programme.nom}`)
      : '';

    const sourcesHtml = (srcPrincHtml || srcSeconHtml) ? `
      <div class="prog-sources">
        ${srcPrincHtml ? `<div class="prog-source-row"><span class="prog-source-label">Source</span>${srcPrincHtml}</div>` : ''}
        ${srcSeconHtml ? `<div class="prog-source-row prog-source-row--secondary"><span class="prog-source-label">Source complémentaire</span>${srcSeconHtml}</div>` : ''}
      </div>
    ` : '';

    // --- Composantes ---
    const composantes = getComposantes(programmeId);
    let composantesHtml = '';
    if (composantes.length > 0) {
      const items = composantes.map((c) => {
        const cClass = statutClass(c.statut_code);
        const cSrcHtml = c.source_id ? buildSourceLink(c.source_id, `Source de la composante ${c.composante}`) : '';
        return `
          <div class="prog-composante">
            <div class="prog-composante-header">
              <span class="prog-composante-nom">${esc(c.composante)}</span>
              <span class="prog-statut-badge prog-statut-badge--${cClass}">${esc(c.statut_libelle)}</span>
            </div>
            ${c.resume_court ? `<p class="prog-composante-resume">${esc(c.resume_court)}</p>` : ''}
            ${cSrcHtml ? `<div class="prog-composante-source">${cSrcHtml}</div>` : ''}
          </div>
        `;
      }).join('');
      composantesHtml = `
        <div class="prog-section">
          <div class="prog-section-separator" aria-hidden="true"></div>
          <h4 class="prog-section-title">État des composantes</h4>
          <div class="prog-composantes-list">${items}</div>
        </div>
      `;
    }

    // --- Entreprises documentées ---
    const relations = getEntreprisesProgramme(programmeId);
    let entreprisesHtml = '';
    if (relations.length > 0) {
      const items = relations.map((r) => {
        const rSrcHtml = r.source_id ? buildSourceLink(r.source_id, `Source pour ${r.entreprise} sur ${programme.acronyme || programme.nom}`) : '';
        const roleLabel = String(r.role || '').replace(/_/g, ' ');
        return `
          <div class="prog-entreprise">
            <div class="prog-entreprise-header">
              <button type="button" class="programme-company-link" data-entreprise-id="${esc(r.entreprise_id)}">
                <strong>${esc(r.entreprise)}</strong>
              </button>
            </div>
            ${roleLabel ? `<div class="prog-entreprise-role">${esc(roleLabel)}</div>` : ''}
            ${r.description_role ? `<p class="prog-entreprise-desc">${esc(r.description_role)}</p>` : ''}
            ${rSrcHtml ? `<div class="prog-entreprise-source">${rSrcHtml}</div>` : ''}
          </div>
        `;
      }).join('');
      entreprisesHtml = `
        <div class="prog-section">
          <div class="prog-section-separator" aria-hidden="true"></div>
          <h4 class="prog-section-title">Entreprises documentées</h4>
          <div class="prog-entreprises-list">${items}</div>
        </div>
      `;
    } else {
      entreprisesHtml = `
        <div class="prog-section">
          <div class="prog-section-separator" aria-hidden="true"></div>
          <h4 class="prog-section-title">Entreprises documentées</h4>
          <p class="prog-no-data">Répartition industrielle actuelle à revalider après la reconfiguration de 2026.</p>
        </div>
      `;
    }

    const typeLabel = getTypeLabel(programme.type_objet);

    panel.innerHTML = `
      <div class="programme-panel">
        <div class="programme-panel-header">
          <span class="programme-panel-domaine">${esc(programme.domaine)}</span>
          <h3 class="programme-panel-titre">${esc(programme.acronyme || programme.nom)}</h3>
          ${programme.acronyme && programme.nom !== programme.acronyme ? `<p class="prog-nom-complet">${esc(programme.nom)}</p>` : ''}
          ${typeLabel ? `<span class="prog-type-label">${esc(typeLabel)}</span>` : ''}
        </div>

        <div class="prog-statut-block">
          <span class="prog-statut-badge prog-statut-badge--${cssClass}">${esc(statutLibelle)}</span>
          ${vigilanceHtml}
        </div>

        ${resumeStatut ? `<p class="prog-resume-statut">${esc(resumeStatut)}</p>` : ''}

        <div class="prog-verif-block">
          ${derniereVerif ? `<span class="prog-verif-date">Statut vérifié le ${derniereVerif}</span>` : ''}
          ${sourcesHtml}
        </div>

        ${composantesHtml}
        ${entreprisesHtml}
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
    const visible = progState.programmes.filter((p) => isTrue(p.afficher_dashboard));
    const options = ['<option value="">Tous les programmes</option>']
      .concat(visible.map((p) => `<option value="${esc(p.programme_id)}">${esc(p.nom)}</option>`));
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
    getComposantes,
    getSource,
    getProgrammesForEntreprise,
    fillProgrammeSelect,
    renderProgrammeEmpty,
    renderProgrammePanel,
    renderProgrammesForEntreprise
  };
})();
