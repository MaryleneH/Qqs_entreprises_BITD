(function () {
  const state = {
    dataPromise: null,
    entries: null,
    uid: 0,
    openContainer: null
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadGlossary() {
    if (!state.dataPromise) {
      const url = new URL('data/glossaire.json', document.baseURI);
      state.dataPromise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Impossible de charger ${url}`);
          return response.json();
        })
        .then((entries) => {
          state.entries = entries;
          return entries;
        })
        .catch((error) => {
          console.warn('Glossaire indisponible:', error.message);
          return {};
        });
    }
    return state.dataPromise;
  }

  function getTerm(termKey) {
    return state.entries?.[termKey] || null;
  }

  function termHTML(termKey, label = '', options = {}) {
    const classes = ['term-definition'];
    if (options.compact) classes.push('term-definition--compact');
    if (options.noIcon) classes.push('term-definition--noicon');
    const content = escapeHtml(label);
    return `<span class="${classes.join(' ')}" data-term="${escapeHtml(termKey)}">${content}</span>`;
  }

  function buildTooltipHtml(entry) {
    const parts = [
      `<div class="term-definition__title">${escapeHtml(entry.term)}</div>`
    ];
    if (entry.formula) {
      parts.push(`<div class="term-definition__formula">${escapeHtml(entry.formula)}</div>`);
    }
    if (entry.short) {
      parts.push(`<div class="term-definition__body">${escapeHtml(entry.short)}</div>`);
    }
    if (entry.long) {
      parts.push(`<div class="term-definition__body">${escapeHtml(entry.long)}</div>`);
    }
    return parts.join('');
  }

  function positionTooltip(container, tooltip, button) {
    tooltip.classList.remove('is-floating');
    tooltip.style.removeProperty('left');
    tooltip.style.removeProperty('top');
    tooltip.style.removeProperty('width');

    const touchMode = window.innerWidth < 760 || window.matchMedia('(hover: none)').matches;
    if (!touchMode) return;

    const rect = button.getBoundingClientRect();
    const maxWidth = Math.min(320, window.innerWidth - 32);
    let left = rect.left;
    if (left + maxWidth > window.innerWidth - 16) left = window.innerWidth - maxWidth - 16;
    if (left < 16) left = 16;

    tooltip.classList.add('is-floating');
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - 24, rect.bottom + 10)}px`;
    tooltip.style.width = `${maxWidth}px`;
  }

  function showTooltip(container) {
    const button = container.querySelector('.term-definition__button');
    const tooltip = container.querySelector('.term-definition__tooltip');
    if (!button || !tooltip) return;

    if (state.openContainer && state.openContainer !== container) {
      hideTooltip(state.openContainer);
    }

    tooltip.hidden = false;
    container.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    positionTooltip(container, tooltip, button);
    state.openContainer = container;
  }

  function hideTooltip(container) {
    const button = container?.querySelector('.term-definition__button');
    const tooltip = container?.querySelector('.term-definition__tooltip');
    if (!button || !tooltip) return;
    tooltip.hidden = true;
    tooltip.classList.remove('is-floating');
    tooltip.style.removeProperty('left');
    tooltip.style.removeProperty('top');
    tooltip.style.removeProperty('width');
    container.classList.remove('is-open');
    container.dataset.pinned = 'false';
    button.setAttribute('aria-expanded', 'false');
    if (state.openContainer === container) state.openContainer = null;
  }

  function togglePinned(container) {
    const isPinned = container.dataset.pinned === 'true';
    if (isPinned) {
      hideTooltip(container);
    } else {
      container.dataset.pinned = 'true';
      showTooltip(container);
    }
  }

  function hydrateTerm(container) {
    if (container.dataset.glossaryReady === 'true') return;
    const termKey = container.dataset.term;
    const entry = getTerm(termKey);
    if (!entry) return;

    const label = (container.dataset.label || container.textContent || entry.term).trim() || entry.term;
    const tooltipId = `term-definition-tooltip-${++state.uid}`;
    const noIcon = container.classList.contains('term-definition--noicon');

    container.dataset.glossaryReady = 'true';
    container.innerHTML = `
      <button type="button" class="term-definition__button" aria-describedby="${tooltipId}" aria-expanded="false">
        <span class="term-definition__label">${escapeHtml(label)}</span>
        ${noIcon ? '' : '<span class="term-definition__icon" aria-hidden="true">ⓘ</span>'}
      </button>
      <span class="term-definition__tooltip" id="${tooltipId}" role="tooltip" hidden>
        ${buildTooltipHtml(entry)}
      </span>
    `;

    const button = container.querySelector('.term-definition__button');
    button.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: hover)').matches) showTooltip(container);
    });
    container.addEventListener('mouseleave', () => {
      if (container.dataset.pinned !== 'true') hideTooltip(container);
    });
    button.addEventListener('focus', () => showTooltip(container));
    button.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (container.dataset.pinned !== 'true' && !container.contains(document.activeElement)) {
          hideTooltip(container);
        }
      }, 0);
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      togglePinned(container);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideTooltip(container);
        button.blur();
      }
    });
  }

  function initRoot(root = document) {
    return loadGlossary().then(() => {
      root.querySelectorAll('.term-definition[data-term]').forEach(hydrateTerm);
    });
  }

  document.addEventListener('click', (event) => {
    if (state.openContainer && !state.openContainer.contains(event.target)) {
      hideTooltip(state.openContainer);
    }
  });

  window.addEventListener('resize', () => {
    if (state.openContainer) {
      const tooltip = state.openContainer.querySelector('.term-definition__tooltip');
      const button = state.openContainer.querySelector('.term-definition__button');
      if (tooltip && button && !tooltip.hidden) {
        positionTooltip(state.openContainer, tooltip, button);
      }
    }
  });

  window.BITDGlossary = {
    loadGlossary,
    getTerm,
    termHTML,
    initRoot
  };

  document.addEventListener('DOMContentLoaded', () => {
    initRoot(document);
  });
})();
