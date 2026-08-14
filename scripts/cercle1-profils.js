/* ============================================================
   Cercle 1 — Fiches groupes.
   Vue de synthèse (les 9) + fiche détaillée par groupe.
   Sources : data/entreprises.csv, data/identite/identite_industrielle.csv,
             data/cercle1/*.csv — aucune donnée calculée ici.
   ============================================================ */
(function () {
  'use strict';
  if (!document.getElementById('c1p-app')) return;

  const FILES = {
    panel:        ['data/entreprises.csv', ','],
    identite:     ['data/identite/identite_industrielle.csv', ','],
    profils:      ['data/cercle1/cercle1_profils.csv', ';'],
    c1:           ['data/cercle1/cercle1_entreprises.csv', ';'],
    implantations:['data/cercle1/cercle1_implantations_internationales.csv', ';'],
    partenaires:  ['data/cercle1/cercle1_partenaires_defense.csv', ';'],
    mainOeuvre:   ['data/cercle1/cercle1_main_oeuvre.csv', ';']
  };
  const COLORS = ['#1F5FA8', '#B33A3A', '#C89B3C', '#2F5D3A', '#6C3483',
                  '#0E7C7B', '#8A4B12', '#5D6D7E', '#A03B70'];
  const SHORT = { 'ARQUUS – JOHN COCKERILL DEFENSE': 'ARQUUS – JCD', 'DASSAULT AVIATION': 'DASSAULT AV.' };

  const MESUR = {
    isolable_publie:        { lib: 'Isolable et publié',    cls: 'ok',
      tip: "L'entreprise publie un chiffre d'affaires défense distinct : la part défense se lit directement dans ses comptes." },
    isolable_par_nature:    { lib: 'Isolable par nature',   cls: 'nat',
      tip: "L'activité est entièrement ou quasi entièrement de défense : le chiffre groupe vaut mesure de l'activité défense, faute de ventilation publiée." },
    partiellement_isolable: { lib: 'Partiellement isolable', cls: 'part',
      tip: "Seul un montant de branche ou de segment est disponible : il approche la défense mais inclut ou exclut des activités qui la débordent." },
    non_isolable:           { lib: 'Non isolable',          cls: 'non',
      tip: "Aucun montant défense n'est publié et aucun périmètre publié ne s'en approche : la part défense n'est pas mesurable à partir des sources publiques." }
  };
  const LIENS = {
    capitalistique: { lib: 'Liens capitalistiques', types: ['actionnariat', 'joint_venture'] },
    consortium:     { lib: 'Consortiums et programmes conjoints', types: ['consortium', 'consortium_loi', 'cooperation_programme'] },
    industriel:     { lib: 'Coopérations industrielles et contractuelles', types: null }
  };

  const state = { ent: 'all' };
  const data = {};

  function splitLine(line, d) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === d && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out;
  }
  function parseCsv(text, d) {
    // Le séparateur déclaré peut ne pas correspondre au fichier réellement déposé :
    // on fait confiance à la ligne d'en-tête plutôt qu'à la déclaration.
    const premiere = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0] || '';
    if (premiere.split(';').length !== premiere.split(',').length) {
      d = (premiere.split(';').length > premiere.split(',').length) ? ';' : ',';
    }
    const rows = []; let cur = '', q = false, lines = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { q = !q; cur += c; }
      else if ((c === '\n') && !q) { lines.push(cur.replace(/\r$/, '')); cur = ''; }
      else cur += c;
    }
    if (cur.trim()) lines.push(cur.replace(/\r$/, ''));
    lines = lines.filter(l => l.trim());
    const head = splitLine(lines[0].replace(/^\uFEFF/, ''), d);
    lines.slice(1).forEach(l => {
      const cells = splitLine(l, d), o = {};
      head.forEach((h, i) => { o[h.trim()] = (cells[i] || '').trim(); });
      rows.push(o);
    });
    return rows;
  }

  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const colorOf = id => COLORS[(parseInt(id, 10) - 1) % COLORS.length];
  const shortName = n => SHORT[n] || n;
  const byId = (arr, id, k) => arr.find(r => r[k || 'entreprise_id'] === id);
  const num = v => (v && !isNaN(parseFloat(v))) ? parseFloat(v) : null;

  function badgeMesur(m) {
    const d = MESUR[m] || { lib: m, cls: 'non', tip: '' };
    return `<span class="c1p-mes c1p-mes--${d.cls}" title="${esc(d.tip)}">${esc(d.lib)}</span>`;
  }
  function lien(url, txt) {
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${txt || 'source ↗'}</a>` : '';
  }

  /* ---------- bandeau ---------- */
  function buildChips() {
    const wrap = document.getElementById('c1p-chips');
    let html = `<button class="c1x-chip is-active" data-ent="all" style="--chip-color:#1F3A5F">
      <span class="c1x-chip-name"><span class="c1x-chip-dot"></span>Les 9 en un coup d'œil</span>
      <span class="c1x-chip-meta">synthèse comparée</span></button>`;
    data.c1.forEach(e => {
      const p = byId(data.profils, e.entreprise_id);
      html += `<button class="c1x-chip" data-ent="${e.entreprise_id}" style="--chip-color:${colorOf(e.entreprise_id)}">
        <span class="c1x-chip-name"><span class="c1x-chip-dot"></span>${esc(shortName(e.entreprise))}</span>
        <span class="c1x-chip-meta">${esc((MESUR[p && p.mesurabilite_defense] || {}).lib || '—')}</span></button>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.c1x-chip').forEach(b => b.addEventListener('click', () => {
      state.ent = b.dataset.ent;
      wrap.querySelectorAll('.c1x-chip').forEach(x => x.classList.toggle('is-active', x === b));
      render();
      document.getElementById('c1p-body').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  /* ---------- synthèse ---------- */
  function renderSynthese() {
    const groupes = {};
    data.profils.forEach(p => { (groupes[p.mesurabilite_defense] = groupes[p.mesurabilite_defense] || []).push(p); });
    const ordre = ['isolable_publie', 'isolable_par_nature', 'partiellement_isolable', 'non_isolable'];

    let html = `<div class="c1p-lead">
      <h2>Une seule entreprise sur neuf publie sa part défense</h2>
      <p>La question « quelle part de l'activité relève de la défense ? » paraît simple. Appliquée aux neuf
      maîtres d'œuvre, elle ne reçoit une réponse publique directe que dans un cas. Ailleurs, il faut se
      contenter d'un périmètre approchant, ou constater qu'aucune mesure n'existe. Cette page décrit, pour
      chaque groupe, ce que les sources publiques permettent de dire — et ce qu'elles ne permettent pas.</p>
    </div><div class="c1p-mes-grid">`;
    ordre.forEach(k => {
      const l = groupes[k] || [];
      html += `<div class="c1p-mes-card c1p-mes-card--${MESUR[k].cls}">
        <div class="c1p-mes-count">${l.length}</div>
        <div class="c1p-mes-lib">${esc(MESUR[k].lib)}</div>
        <p>${esc(MESUR[k].tip)}</p>
        <ul>${l.map(p => `<li><button class="c1p-link" data-goto="${p.entreprise_id}">${esc(shortName(p.entreprise))}</button></li>`).join('')}</ul>
      </div>`;
    });
    html += '</div>';

    html += `<h2 class="c1p-h2">Comparer les neuf</h2>
      <p class="c1p-scrollhint">Tableau défilable horizontalement →</p>
      <div class="c1p-table-wrap"><table class="c1p-table">
      <thead><tr><th>Groupe</th><th>Chiffre d'affaires de référence</th><th>Part défense</th>
      <th>Effectif</th><th>Pays</th><th>Coop.</th></tr></thead><tbody>`;
    data.c1.forEach(e => {
      const id = e.entreprise_id, p = byId(data.profils, id) || {};
      const pays = new Set(data.implantations.filter(s => s.entreprise_id === id).map(s => s.pays)).size;
      const coop = data.partenaires.filter(r => r.entreprise_id === id || r.partenaire_cercle1_entreprise_id === id).length;
      const ca = num(p.ca_defense_mdeur) || num(p.proxy_valeur_mdeur) || num(p.ca_groupe_mdeur);
      const caPer = p.ca_defense_perimetre || p.proxy_perimetre || p.ca_groupe_perimetre;
      html += `<tr><td><button class="c1p-link" data-goto="${id}"><span class="c1p-dot" style="background:${colorOf(id)}"></span>${esc(shortName(e.entreprise))}</button></td>
        <td>${ca !== null ? ca.toFixed(ca < 10 ? 2 : 1).replace('.', ',') + '&nbsp;Md€' : '—'}
            <span class="c1p-per">${esc((caPer || '').slice(0, 62))}</span></td>
        <td>${p.part_defense_pct ? esc(p.part_defense_pct.replace('.', ',')) + '&nbsp;%' : badgeMesur(p.mesurabilite_defense)}</td>
        <td>${p.effectif_groupe ? parseInt(p.effectif_groupe, 10).toLocaleString('fr-FR') : '—'}
            <span class="c1p-per">${esc((p.effectif_perimetre || '').slice(0, 40))}</span></td>
        <td>${pays}</td><td>${coop}</td></tr>`;
    });
    html += `</tbody></table></div>
      <p class="c1p-note">Les chiffres d'affaires ne sont pas comparables entre eux : chaque cellule indique le
      périmètre exact du montant retenu. Un chiffre de groupe, un chiffre de branche et un chiffre défense
      isolé ne mesurent pas la même chose.</p>`;
    return html;
  }

  /* ---------- fiche ---------- */
  function ligne(lib, val, per) {
    if (!val) return '';
    return `<div class="c1p-row"><span class="c1p-row-lib">${lib}</span>
      <span class="c1p-row-val">${val}${per ? `<span class="c1p-per">${esc(per)}</span>` : ''}</span></div>`;
  }
  /* ---------- besoins en main-d'œuvre ---------- */
  const PREUVE = {
    A: { lib: 'Preuve A', tip: "Chiffre lu dans une publication de l'entreprise elle-même, datée et explicite." },
    B: { lib: 'Preuve B', tip: "Chiffre publié hors du domaine corporate de l'entreprise (plateforme partenaire, presse) : plus fragile." },
    ND: { lib: 'Non disponible', tip: "Aucun chiffre prospectif publié n'a été identifié pour cette entreprise." }
  };
  const VERIF = {
    verifie_independamment: { lib: 'Vérifié', cls: 'ok',
      tip: "Chiffre retrouvé dans au moins une source indépendante de l'entreprise." },
    non_verifie: { lib: 'Non revérifié', cls: 'part',
      tip: "Chiffre repris de la source citée, sans confirmation par une source indépendante." },
    a_reverifier: { lib: 'À revérifier', cls: 'non',
      tip: "Un doute documenté existe sur ce chiffre : lisez la note avant de vous en servir." }
  };

  const SLUGS = { '1': 'thales', '2': 'dassault_aviation', '3': 'safran', '4': 'naval_group',
                  '5': 'airbus', '6': 'mbda', '7': 'knds_france', '8': 'arianegroup', '9': 'arquus' };
  function renderMainOeuvre(id) {
    // Tolère les deux schémas : entreprise_id numérique, ou slug hérité du fichier source.
    const m = byId(data.mainOeuvre, id) ||
              data.mainOeuvre.find(r => r.id_entreprise === SLUGS[id] || r.id_entreprise_source === SLUGS[id]);
    if (!m) return '';
    const publie = /^publie/.test(m.statut_chiffrage_futur);
    const pr = PREUVE[m.niveau_preuve_futur] || null;
    const vf = VERIF[m.statut_verification] || null;
    const defenseSeule = /défense|missile|naval|terrestre|spatial/i.test(m.perimetre_activite) &&
                         !/toutes activités|non séparées|civil/i.test(m.perimetre_activite);

    let h = `<section class="c1p-bloc c1p-bloc--emploi"><h3>Besoins en main-d'œuvre
      ${vf ? `<span class="c1p-mes c1p-mes--${vf.cls}" title="${esc(vf.tip)}">${esc(vf.lib)}</span>` : ''}</h3>`;

    if (publie) {
      h += `<p class="c1p-chiffre">${esc(m.chiffre_futur_affichable)}</p>`;
      h += `<p class="c1p-couvre"><strong>Ce que ce chiffre couvre :</strong> ${esc(m.perimetre_geographique)}
        — ${esc(m.perimetre_activite)}.</p>`;
      if (!defenseSeule) {
        h += `<p class="c1p-alerte">Ce chiffre porte sur l'ensemble des activités du groupe, défense comprise
          mais pas seulement. Le présenter comme un besoin de la base industrielle de défense serait inexact.</p>`;
      }
      if (m.decomposition_chiffre) h += `<p class="c1p-detail"><strong>Décomposition :</strong> ${esc(m.decomposition_chiffre)}</p>`;
    } else {
      h += `<p class="c1p-vide">${esc(m.chiffre_futur_affichable)}. ${esc(m.perimetre_activite)}.</p>`;
    }
    if (m.chiffre_complementaire_affichable) {
      h += `<p class="c1p-detail"><strong>Repère chiffré disponible :</strong> ${esc(m.chiffre_complementaire_affichable)}
        ${m.annee_chiffre_complementaire ? `(${esc(m.annee_chiffre_complementaire)})` : ''}</p>`;
    }
    if (m.metiers_competences_signales) {
      h += `<p class="c1p-detail"><strong>Métiers signalés :</strong> ${esc(m.metiers_competences_signales)}</p>`;
    }

    /* le mode d'emploi : retrouver le chiffre soi-même */
    h += `<details class="c1p-verif"><summary>Retrouver ce chiffre par vous-même</summary>
      <ol class="c1p-etapes">
        <li>Ouvrez la source : ${lien(m.source_principale_url,
            esc([m.source_principale_editeur, m.source_principale_titre].filter(Boolean).join(' — ')) + ' ↗')}
            ${m.source_principale_date ? `<span class="c1p-per">${esc(m.source_principale_date)}</span>` : ''}</li>
        ${m.repere_exact_source ? `<li>Rendez-vous à&nbsp;: <em>${esc(m.repere_exact_source)}</em></li>` : ''}
        ${m.phrase_cle_a_rechercher ? `<li>Cherchez cette phrase dans la page (Ctrl+F)&nbsp;:
            <span class="c1p-phrase">${esc(m.phrase_cle_a_rechercher)}</span></li>` : ''}
        ${m.source_secondaire_url ? `<li>Recoupement possible&nbsp;: ${lien(m.source_secondaire_url,
            esc(m.source_secondaire_editeur || 'seconde source') + ' ↗')}</li>` : ''}
      </ol>
      ${m.limite_interpretation ? `<p class="c1p-limite"><strong>Limite d'interprétation&nbsp;:</strong>
        ${esc(m.limite_interpretation)}</p>` : ''}
      ${m.note_verification ? `<p class="c1p-limite"><strong>Contrôle indépendant&nbsp;:</strong>
        ${esc(m.note_verification)}</p>` : ''}
      <p class="c1p-per">${pr ? esc(pr.lib) + ' — ' + esc(pr.tip) + ' ' : ''}
        Vérifié le ${esc(m.date_verification_independante || m.date_verification || '')}.</p>
    </details></section>`;
    return h;
  }

  function renderFiche(id) {
    const e = byId(data.c1, id), p = byId(data.profils, id) || {},
          x = byId(data.panel, id, 'id') || {}, idn = byId(data.identite, id) || {};
    const tous = data.implantations.filter(s => s.entreprise_id === id);
    const horsPerim = tous.filter(s => /PAS KNDS France|hors Arquus France/i.test(s.perimetre));
    const sites = tous.filter(s => horsPerim.indexOf(s) === -1);
    const pays = {};
    sites.forEach(s => { pays[s.pays] = (pays[s.pays] || 0) + 1; });
    const rels = data.partenaires.filter(r => r.entreprise_id === id || r.partenaire_cercle1_entreprise_id === id);

    let html = `<div class="c1p-fiche-head" style="--chip-color:${colorOf(id)}">
      <h2>${esc(e.entreprise)}</h2>
      <p class="c1p-spec">${esc(x.specialite || e.specialite_cercle1)}</p>
      <p class="c1p-type">${esc(idn.type_acteur_panel || x.categorie || '')}</p></div>`;

    html += `<div class="c1p-blocs">`;

    /* 1. ce qu'il fait */
    html += `<section class="c1p-bloc"><h3>Ce qu'il fait</h3>`;
    if (idn.ce_qu_il_faut_retenir) html += `<p class="c1p-retenir">${esc(idn.ce_qu_il_faut_retenir)}</p>`;
    if (idn.positionnement_industriel) html += `<p>${esc(idn.positionnement_industriel)}</p>`;
    else if (x.description) html += `<p>${esc(x.description)}</p>`;
    if (idn.capacites_cles) {
      html += `<div class="c1p-tags">` + idn.capacites_cles.split(';')
        .filter(Boolean).map(c => `<span class="c1p-tag">${esc(c.trim())}</span>`).join('') + `</div>`;
    }
    if (x.programmes) html += `<p class="c1p-prog"><strong>Programmes :</strong> ${esc(x.programmes)}</p>`;
    html += `</section>`;

    /* 2. mesurer la part défense */
    html += `<section class="c1p-bloc c1p-bloc--focus"><h3>Mesurer la part défense ${badgeMesur(p.mesurabilite_defense)}</h3>
      <p>${esc(p.mesurabilite_justification)}</p>`;
    html += ligne("Chiffre d'affaires groupe", p.ca_groupe_mdeur ? esc(p.ca_groupe_mdeur.replace('.', ',')) + '&nbsp;Md€' : '', p.ca_groupe_perimetre);
    html += ligne("Chiffre d'affaires défense", p.ca_defense_mdeur ? esc(p.ca_defense_mdeur.replace('.', ',')) + '&nbsp;Md€' : '', p.ca_defense_perimetre);
    html += ligne("Périmètre approchant", p.proxy_valeur_mdeur ? esc(p.proxy_valeur_mdeur.replace('.', ',')) + '&nbsp;Md€' : '', p.proxy_perimetre);
    html += ligne("Part défense", p.part_defense_pct ? esc(p.part_defense_pct.replace('.', ',')) + '&nbsp;%' : '', p.part_defense_methode);
    if (p.activites_hors_defense) html += `<p class="c1p-hors"><strong>Activités hors défense :</strong> ${esc(p.activites_hors_defense)}</p>`;
    html += `<p class="c1p-src">${lien(p.source_profil_url, 'source du groupe ↗')}</p></section>`;

    /* 3. réalité économique */
    const fr = v => esc(String(v).replace('.', ','));
    const eco = [
      ['Marge', x.marge_pct ? fr(x.marge_pct) + '&nbsp;%' : '', x.marge_type],
      ['Book-to-bill', x.book_to_bill ? fr(x.book_to_bill) + 'x' : '', x.book_to_bill_perimetre],
      ['Carnet / chiffre d’affaires', x.ratio_carnet_ca ? fr(x.ratio_carnet_ca) + '&nbsp;années' : '', x.ratio_carnet_ca_perimetre]
    ].map(r => ligne(r[0], r[1], r[2])).join('');
    if (eco.trim() || x.carnet_commandes_label) {
      html += `<section class="c1p-bloc"><h3>Réalité économique</h3>${eco}`;
      if (x.carnet_commandes_label) html += `<p class="c1p-detail">${esc(x.carnet_commandes_label)}</p>`;
      html += `</section>`;
    }

    /* 4. empreinte internationale */
    const listePays = Object.keys(pays).sort((a, b) => pays[b] - pays[a]);
    html += `<section class="c1p-bloc"><h3>Empreinte internationale</h3>`;
    if (listePays.length) {
      html += `<p>${sites.length} implantation${sites.length > 1 ? 's' : ''} documentée${sites.length > 1 ? 's' : ''}
        dans ${listePays.length} pays.</p><div class="c1p-tags">` +
        listePays.map(k => `<span class="c1p-tag">${esc(k)} · ${pays[k]}</span>`).join('') + `</div>
        <p class="c1p-src"><a href="cercle1-international.html">Voir sur la carte →</a></p>`;
    } else {
      html += `<p class="c1p-vide">Aucune implantation étrangère documentée dans ce référentiel pour le
        périmètre juridique retenu. Cette absence décrit la sélection documentée, pas une absence réelle
        de présence internationale du groupe.</p>`;
    }
    if (horsPerim.length) {
      const p2 = [...new Set(horsPerim.map(s => s.pays))];
      html += `<p class="c1p-detail"><strong>Hors périmètre juridique de l'entité du panel :</strong>
        ${horsPerim.length} implantation${horsPerim.length > 1 ? 's' : ''} documentée${horsPerim.length > 1 ? 's' : ''}
        au titre du groupe (${esc(p2.join(', '))}), rattachée${horsPerim.length > 1 ? 's' : ''} à d'autres sociétés
        que celle retenue dans le panel. Elles ne sont pas comptées ci-dessus.</p>`;
    }
    const PERIM = {
      selection_documentee_non_exhaustive: "sélection documentée, non exhaustive",
      selection_documentee: "sélection documentée",
      groupe_hors_entite_panel: "périmètre du groupe, au-delà de l'entité du panel"
    };
    if (e.perimetre_international) html += `<p class="c1p-detail"><strong>Périmètre retenu :</strong>
      ${esc(PERIM[e.perimetre_international] || e.perimetre_international.replace(/_/g, ' '))}</p>`;
    html += `</section>`;

    /* 5. liens juridiques */
    html += `<section class="c1p-bloc"><h3>Avec qui travaille-t-il, et à quel titre&nbsp;?</h3>`;
    if (x.actionnariat) html += `<p class="c1p-detail"><strong>Actionnariat :</strong> ${esc(x.actionnariat)}</p>`;
    const vus = new Set();
    Object.keys(LIENS).forEach(k => {
      const g = LIENS[k];
      const l = rels.filter(r => {
        if (vus.has(r.relation_id)) return false;
        const ok = g.types ? g.types.indexOf(r.type_relation) !== -1 : true;
        if (ok) vus.add(r.relation_id);
        return ok;
      });
      if (!l.length) return;
      html += `<h4>${esc(g.lib)}</h4><ul class="c1p-rels">`;
      l.forEach(r => {
        const autre = r.entreprise_id === id ? r.partenaire : r.entreprise;
        html += `<li><strong>${esc(autre)}</strong> — ${esc(r.programme_projet)}
          <span class="c1p-per">${esc(r.type_relation.replace(/_/g, ' '))}${r.partenaire_cercle1_entreprise_id ? ' · membre du Cercle 1' : ' · ' + esc(r.partenaire_secteur || 'partenaire externe')}</span></li>`;
      });
      html += `</ul>`;
    });
    if (!rels.length) html += `<p class="c1p-vide">Aucune relation documentée dans ce référentiel.</p>`;
    html += `</section>`;

    /* 6. emploi + 7. besoins : empilés dans une même case de la grille,
       pour que les besoins suivent immédiatement l'effectif sans défilement. */
    html += `<div class="c1p-pile">`;
    html += `<section class="c1p-bloc"><h3>Emploi</h3>`;
    html += ligne('Effectif', p.effectif_groupe ? parseInt(p.effectif_groupe, 10).toLocaleString('fr-FR') : '', p.effectif_perimetre);
    if (p.emploi_note) html += `<p>${esc(p.emploi_note)}</p>`;
    html += `</section>`;

    html += renderMainOeuvre(id);
    html += `</div>`;

    html += `</div><p class="c1p-note">${esc(p.limites_interpretation || '')}
      Dernière vérification&nbsp;: ${esc(p.derniere_verification || '')}.</p>`;
    return html;
  }

  function render() {
    const body = document.getElementById('c1p-body');
    body.innerHTML = state.ent === 'all' ? renderSynthese() : renderFiche(state.ent);
    body.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
      const chip = document.querySelector(`.c1x-chip[data-ent="${b.dataset.goto}"]`);
      if (chip) chip.click();
    }));
  }

  const OPTIONNELS = ['mainOeuvre'];
  Promise.all(Object.entries(FILES).map(([k, [u, d]]) =>
    fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.text(); })
      .then(t => { data[k] = parseCsv(t, d); })
      .catch(err => {
        if (OPTIONNELS.indexOf(k) === -1) throw err;
        data[k] = [];   // section absente plutôt que page cassée
        console.warn('cercle1-profils : ' + u + ' indisponible, section ignorée');
      })
  )).then(() => { buildChips(); render(); })
    .catch(err => {
      document.getElementById('c1p-body').innerHTML =
        `<p class="c1x-empty">Erreur de chargement des données (${esc(String(err.message || err))}).</p>`;
    });
})();
