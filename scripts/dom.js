/* ==========================================================================
   dom.js — tiny DOM toolkit shared by every view.
   User-authored text is always inserted with textContent (never innerHTML),
   so habit names, journal entries and tasks cannot inject markup.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';

  function isNode(v) {
    return v instanceof Element || v instanceof DocumentFragment ||
      (typeof v === 'object' && v !== null && v.nodeType === 1);
  }

  function appendChild(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { appendChild(parent, c); }); return; }
    if (isNode(child)) { parent.appendChild(child); return; }
    parent.appendChild(document.createTextNode(String(child)));
  }

  /**
   * h('div', {class:'x', on:{click:fn}, dataset:{id:3}}, child, 'text')
   * `html` is only for trusted, developer-authored markup.
   */
  function h(tag, props) {
    var el = document.createElement(tag);
    var rest = Array.prototype.slice.call(arguments, 2);
    if (props && typeof props === 'object' && !isNode(props) && !Array.isArray(props)) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class' || key === 'className') { el.className = String(value); }
        else if (key === 'text') { el.textContent = String(value); }
        else if (key === 'html') { el.innerHTML = String(value); }
        else if (key === 'dataset') { Object.keys(value).forEach(function (d) { el.dataset[d] = value[d]; }); }
        else if (key === 'style' && typeof value === 'object') { Object.assign(el.style, value); }
        else if (key === 'on' && typeof value === 'object') {
          Object.keys(value).forEach(function (evt) { el.addEventListener(evt, value[evt]); });
        }
        else if (key === 'value') { el.value = value; }
        else if (key === 'checked' || key === 'selected' || key === 'disabled' || key === 'open') { el[key] = !!value; }
        else if (/^on[A-Z]/.test(key)) { el.addEventListener(key.slice(2).toLowerCase(), value); }
        else { el.setAttribute(key, value === true ? '' : String(value)); }
      });
    } else if (props !== undefined) {
      rest.unshift(props);
    }
    rest.forEach(function (child) { appendChild(el, child); });
    return el;
  }

  function frag() {
    var f = document.createDocumentFragment();
    Array.prototype.slice.call(arguments).forEach(function (c) { appendChild(f, c); });
    return f;
  }

  function icon(name, extraClass) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (extraClass ? ' ' + extraClass : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#i-' + name);
    use.setAttributeNS(XLINK_NS, 'xlink:href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function mount(node, content) { clear(node); appendChild(node, content); return node; }
  function text(value) { return document.createTextNode(value === null || value === undefined ? '' : String(value)); }

  function uid(prefix) {
    var rand = Math.random().toString(36).slice(2, 8);
    return (prefix ? prefix + '-' : '') + Date.now().toString(36) + rand;
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function pick(list, rng) {
    if (!list || !list.length) return null;
    var r = typeof rng === 'function' ? rng() : Math.random();
    return list[Math.floor(r * list.length) % list.length];
  }
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait || 150);
    };
  }
  function throttle(fn, wait) {
    var last = 0, timer = null;
    return function () {
      var args = arguments, self = this, now = Date.now();
      var remaining = (wait || 100) - (now - last);
      if (remaining <= 0) { last = now; fn.apply(self, args); }
      else if (!timer) {
        timer = setTimeout(function () { timer = null; last = Date.now(); fn.apply(self, args); }, remaining);
      }
    };
  }

  /* --- Screen-reader announcements ---------------------------------------- */
  var announcer = null;
  function getAnnouncer() {
    if (announcer && announcer.isConnected) return announcer;
    announcer = document.getElementById('sr-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sr-announcer';
      announcer.className = 'visually-hidden';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    return announcer;
  }
  /**
   * Announce a change politely. Repeats of the same string are spaced out so
   * screen readers do not chatter when a user taps a habit repeatedly.
   */
  function announce(message) {
    var node = getAnnouncer();
    if (!message) { clear(node); return; }
    clear(node);
    setTimeout(function () { node.textContent = String(message); }, 60);
  }

  /* --- Toasts -------------------------------------------------------------- */
  function toastRegion() {
    return document.getElementById('toast-region') || document.body;
  }
  function toast(message, options) {
    var opts = options || {};
    var region = toastRegion();
    var node = h('div', { class: 'toast' + (opts.variant ? ' toast--' + opts.variant : '') });
    node.appendChild(icon(opts.icon || 'spark', 'icon--sm'));
    node.appendChild(h('span', { text: message }));
    var timer = null;
    function dismiss() {
      if (timer) clearTimeout(timer);
      node.classList.add('toast--leaving');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }
    if (opts.actionLabel && typeof opts.onAction === 'function') {
      node.appendChild(h('button', {
        class: 'btn btn--tiny btn--quiet toast__action', type: 'button',
        text: opts.actionLabel,
        on: { click: function () { dismiss(); opts.onAction(); } }
      }));
    }
    if (opts.dismissible !== false) {
      node.appendChild(h('button', {
        class: 'btn btn--icon btn--tiny', type: 'button', 'aria-label': 'Dismiss message',
        on: { click: dismiss }
      }, icon('close', 'icon--sm')));
    }
    region.appendChild(node);
    var duration = typeof opts.duration === 'number' ? opts.duration : 5000;
    if (duration > 0) timer = setTimeout(dismiss, duration);
    return { dismiss: dismiss, node: node };
  }

  /* --- Modal / drawer dialogs --------------------------------------------- */
  var openStack = [];
  var lastFocused = null;

  function focusables(root) {
    return qsa('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
      .filter(function (node) { return node.offsetParent !== null || node === document.activeElement; });
  }

  function lockScroll(locked) {
    document.body.classList.toggle('is-locked', locked);
  }

  /**
   * openModal({title, description, body, footer, variants:[], dismissible, initialFocus, onClose})
   * Returns { close, root, modal }. Restores focus to the opener on close.
   */
  function openModal(options) {
    var opts = options || {};
    var opener = document.activeElement;
    var labelledBy = 'dlg-title-' + uid();
    var root = h('div', { class: 'overlay' + (opts.variants || []).map(function (v) { return ' overlay--' + v; }).join('') });
    var modal = h('div', {
      class: 'modal' + (opts.variants || []).map(function (v) { return ' modal--' + v; }).join(''),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': opts.title ? labelledBy : null,
      'aria-label': opts.title ? null : (opts.ariaLabel || 'Dialog'),
      tabindex: '-1'
    });

    if (opts.title) {
      modal.appendChild(h('div', { class: 'modal__head' },
        h('h2', { id: labelledBy, text: opts.title }),
        opts.description ? h('p', { text: opts.description }) : null
      ));
    }
    if (opts.body) {
      if (typeof opts.body === 'string') modal.appendChild(h('p', { text: opts.body }));
      else modal.appendChild(opts.body);
    }
    if (opts.footer) modal.appendChild(h('div', { class: 'modal__foot' }, opts.footer));

    var dismissible = opts.dismissible !== false;
    function close(reason) {
      if (root.dataset.closing === 'true') return;
      root.dataset.closing = 'true';
      var index = openStack.indexOf(entry);
      if (index > -1) openStack.splice(index, 1);
      if (root.parentNode) root.parentNode.removeChild(root);
      lockScroll(openStack.length > 0);
      if (typeof opts.onClose === 'function') opts.onClose(reason || 'close');
      var returnTo = opts.returnFocus || opener;
      if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) {
        returnTo.focus({ preventScroll: true });
      } else if (lastFocused && document.contains(lastFocused)) {
        lastFocused.focus({ preventScroll: true });
      }
    }

    var entry = { root: root, close: close, label: opts.title || 'dialog', dismissible: dismissible };

    if (dismissible) {
      modal.appendChild(h('button', {
        class: 'btn btn--icon modal__close', type: 'button', 'aria-label': 'Close dialog',
        on: { click: function () { close('close-button'); } }
      }, icon('close')));
    }

    root.appendChild(modal);
    root.addEventListener('mousedown', function (event) {
      if (event.target === root && dismissible) close('backdrop');
    });
    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && dismissible &&
        openStack[openStack.length - 1] === entry) {
        event.__afterglowHandled = true;
        event.stopPropagation();
        close('escape');
        return;
      }
      if (event.key === 'Tab') {
        var list = focusables(modal);
        if (!list.length) { event.preventDefault(); modal.focus(); return; }
        var first = list[0], last = list[list.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });

    lastFocused = opener;
    openStack.push(entry);
    document.getElementById('dialog-root').appendChild(root);
    lockScroll(true);

    var focusTarget = opts.initialFocus && modal.querySelector(opts.initialFocus);
    setTimeout(function () {
      if (focusTarget) focusTarget.focus();
      else {
        var list = focusables(modal);
        if (list.length && !opts.preferContainer) list[0].focus();
        else modal.focus();
      }
      if (typeof opts.onMount === 'function') opts.onMount(modal);
    }, 20);

    return { close: close, root: root, modal: modal };
  }

  /** Promise-based confirmation. Resolves true only on explicit confirm. */
  function confirmAction(options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      var settled = false;
      var dialog = openModal({
        title: opts.title || 'Are you sure?',
        ariaLabel: opts.title,
        body: h('div', { class: 'prose' },
          h('p', { text: opts.message || '' }),
          opts.detail ? h('p', { class: 'muted', text: opts.detail }) : null
        ),
        footer: [
          h('button', {
            class: 'btn ' + (opts.danger ? 'btn--danger' : 'btn--primary'), type: 'button',
            text: opts.confirmLabel || 'Confirm',
            on: { click: function () { settled = true; dialog.close('confirm'); resolve(true); } }
          }),
          h('button', {
            class: 'btn btn--quiet', type: 'button', text: opts.cancelLabel || 'Cancel',
            on: { click: function () { dialog.close('cancel'); } }
          })
        ],
        onClose: function () { if (!settled) resolve(false); },
        initialFocus: '.modal__foot .btn',
        preferContainer: false
      });
    });
  }

  /* Fallback: if focus ended up outside the dialog, Escape still closes it. */
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || event.__afterglowHandled) return;
    var entry = openStack[openStack.length - 1];
    if (entry && entry.dismissible) {
      event.__afterglowHandled = true;
      entry.close('escape');
    }
  });

  function closeTopModal() {
    var entry = openStack[openStack.length - 1];
    if (entry) entry.close('escape');
    return !!entry;
  }
  function hasOpenModal() { return openStack.length > 0; }

  Afterglow.dom = {
    SVG_NS: SVG_NS,
    h: h,
    frag: frag,
    icon: icon,
    text: text,
    qs: qs,
    qsa: qsa,
    clear: clear,
    mount: mount,
    isNode: isNode,
    uid: uid,
    clamp: clamp,
    pick: pick,
    debounce: debounce,
    throttle: throttle,
    announce: announce,
    toast: toast,
    openModal: openModal,
    confirmAction: confirmAction,
    closeTopModal: closeTopModal,
    hasOpenModal: hasOpenModal
  };
})(typeof window !== 'undefined' ? window : this);
