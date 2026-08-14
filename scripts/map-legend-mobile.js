/* ============================================================
   Légendes de carte : repliables sur petit écran.
   Sur téléphone, la légende recouvrait jusqu'à la moitié de la carte.
   Elle devient un bouton « Légende » que l'on déplie d'une pression.
   Aucune modification de map.js : ce script agit sur le rendu Leaflet.
   ============================================================ */
(function () {
  'use strict';
  var SEUIL = 700;

  var css = document.createElement('style');
  css.textContent = [
    '@media (max-width: ' + SEUIL + 'px) {',
    '  .map-legend.is-collapsible { padding: 0; background: none; border: none; box-shadow: none; }',
    '  .map-legend.is-collapsible > .legend-toggle {',
    '    display: inline-flex; align-items: center; gap: .35rem; font: inherit; font-size: .7rem;',
    '    font-weight: 700; letter-spacing: .05em; text-transform: uppercase; cursor: pointer;',
    '    background: rgba(20, 36, 56, .92); color: rgba(245,246,242,.9); border: 0;',
    '    border-radius: 16px; padding: .35rem .7rem; box-shadow: 0 2px 8px rgba(0,0,0,.25); }',
    '  .map-legend.is-collapsible > .legend-body { display: none; margin-top: .35rem;',
    '    background: rgba(20, 36, 56, .94); border-radius: 8px; padding: .5rem .7rem;',
    '    box-shadow: 0 2px 10px rgba(0,0,0,.3); max-height: 42vh; overflow-y: auto; }',
    '  .map-legend.is-collapsible.is-open > .legend-body { display: block; }',
    '  .map-legend.is-collapsible .legend-item span { font-size: .68rem; }',
    '}',
    '@media (min-width: ' + (SEUIL + 1) + 'px) {',
    '  .map-legend.is-collapsible > .legend-toggle { display: none; }',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  function rendreRepliable(legende) {
    if (legende.classList.contains('is-collapsible')) return;
    legende.classList.add('is-collapsible');

    var corps = document.createElement('div');
    corps.className = 'legend-body';
    while (legende.firstChild) corps.appendChild(legende.firstChild);

    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'legend-toggle';
    bouton.setAttribute('aria-expanded', 'false');
    bouton.textContent = 'Légende';

    legende.appendChild(bouton);
    legende.appendChild(corps);

    function basculer(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var ouvert = legende.classList.toggle('is-open');
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    }
    bouton.addEventListener('click', basculer);
    // empêcher la carte de capter la pression sur le bouton
    ['mousedown', 'touchstart', 'dblclick'].forEach(function (t) {
      legende.addEventListener(t, function (ev) { ev.stopPropagation(); });
    });
  }

  function balayer() {
    var l = document.querySelectorAll('.map-legend');
    for (var i = 0; i < l.length; i++) rendreRepliable(l[i]);
  }

  function demarrer() {
    balayer();
    // les légendes sont ajoutées par Leaflet après le chargement des données
    var cible = document.body;
    if (!cible || !window.MutationObserver) return;
    var obs = new MutationObserver(function () { balayer(); });
    obs.observe(cible, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); balayer(); }, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
