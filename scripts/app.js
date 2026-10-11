/* ==========================================================================
   app.js — bootstrap, routing, navigation, theme and the small glue that keeps
   the views consistent.

   Rendering is a full re-render of the current view on every state change.
   That keeps views simple; keyboard focus is preserved by matching
   [data-focus-key] before and after the swap, and recursive renders are
   deferred with a flag so a view cannot loop.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var dom = Afterglow.dom;
  var ui = Afterglow.ui;
  var h = dom.h;
  var icon = dom.icon;

  var ROUTES = [
    { id: 'home', label: 'Home', icon: 'home', context: 'Today', mobile: true },
    { id: 'habits', label: 'Habits', icon: 'list', context: 'Habits', mobile: true },
    { id: 'flow', label: 'Daily flow', icon: 'flow', context: 'Daily flow', mobile: true },
    { id: 'focus', label: 'Focus timer', icon: 'clock', context: 'Focus', mobile: true },
    { id: 'journey', label: 'Journey', icon: 'journey', context: '30-day journey' },
    { id: 'progress', label: 'Progress', icon: 'chart', context: 'Progress' },
    { id: 'journal', label: 'Journal', icon: 'journal', context: 'Journal' },
    { id: 'tools', label: 'Toolkits', icon: 'tools', context: 'Toolkits' },
    { id: 'settings', label: 'Settings', icon: 'settings', context: 'Settings' }
  ];

  var MOBILE_BAR = ['home', 'habits', 'focus', 'progress'];

  var current = { route: 'home', params: {}, view: null };
  var rendering = false;
  var pendingRefresh = false;
  var started = false;
  var timerChip = null;
  var timerUnsubscribe = null;
  var quotaWarned = false;

  function routeById(id) {
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i].id === id) return ROUTES[i];
    return ROUTES[0];
  }

  function routeFromHash() {
    var hash = (global.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    var found = routeById(hash);
    return hash && found.id === hash ? found.id : 'home';
  }

  /* --- theme, motion, atmosphere ------------------------------------------ */
  function applyTheme() {
    var theme = Afterglow.store.state.settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5efe4' : '#0b0f10');
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      var goingTo = theme === 'light' ? 'dark' : 'light';
      toggle.setAttribute('aria-label', 'Switch to ' + goingTo + ' theme');
      var use = toggle.querySelector('use');
      if (use) {
        use.setAttribute('href', theme === 'light' ? '#i-moon' : '#i-sun');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', theme === 'light' ? '#i-moon' : '#i-sun');
      }
    }
  }

  function setTheme(theme) {
    Afterglow.store.update(function (state) { state.settings.theme = theme === 'light' ? 'light' : 'dark'; }, 'theme');
    applyTheme();
    dom.announce('Theme changed to ' + (theme === 'light' ? 'Dawnlight' : 'Afterglow') + '.');
    refresh();
  }

  function applyMotion() {
    var setting = Afterglow.store.state.settings.motion;
    var systemReduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var off = setting === 'off' || (setting === 'system' && systemReduced);
    document.documentElement.setAttribute('data-motion', off ? 'off' : 'on');
  }

  function applyAtmosphere() {
    var show = Afterglow.store.state.settings.showAtmosphere;
    var node = document.querySelector('.atmosphere');
    if (node) node.style.display = show ? '' : 'none';
  }

  /* --- navigation --------------------------------------------------------- */
  function buildNav() {
    var list = document.getElementById('nav-list');
    var mobile = document.getElementById('mobile-nav');
    if (list) {
      dom.mount(list, ROUTES.map(function (route) {
        return h('li', null,
          h('a', {
            class: 'nav__link',
            href: '#/' + route.id,
            dataset: { route: route.id, focusKey: 'nav-' + route.id },
            on: { click: function (event) { event.preventDefault(); go(route.id); } }
          }, icon(route.icon), h('span', { text: route.label }))
        );
      }));
    }
    if (mobile) {
      var items = MOBILE_BAR.map(function (id) { return routeById(id); });
      dom.mount(mobile, items.map(function (route) {
        return h('li', null,
          h('a', {
            class: 'mobilebar__link',
            href: '#/' + route.id,
            dataset: { route: route.id },
            on: { click: function (event) { event.preventDefault(); go(route.id); } }
          }, icon(route.icon), h('span', { text: route.label }))
        );
      }).concat([
        h('li', null,
          h('button', {
            class: 'mobilebar__link', type: 'button', 'aria-label': 'More sections',
            on: { click: openMoreSheet }
          }, icon('more'), h('span', { text: 'More' }))
        )
      ]));
    }
  }

  function openMoreSheet() {
    var links = ROUTES.filter(function (route) { return MOBILE_BAR.indexOf(route.id) === -1; });
    dom.openModal({
      title: 'More sections',
      variants: ['drawer'],
      body: h('div', { class: 'nav__list', style: { display: 'grid', gap: '6px' } }, links.map(function (route) {
        return h('a', {
          class: 'nav__link', href: '#/' + route.id,
          on: { click: function (event) { event.preventDefault(); dom.closeTopModal(); go(route.id); } }
        }, icon(route.icon), h('span', { text: route.label }));
      })),
      footer: [ui.button({ label: 'Close', variant: 'quiet', onClick: function () { dom.closeTopModal(); } })]
    });
  }

  function updateNavState() {
    dom.qsa('[data-route]').forEach(function (link) {
      if (link.dataset.route === current.route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    var context = document.getElementById('topbar-context');
    var route = routeById(current.route);
    if (context) context.textContent = route.context || route.label;
    document.title = 'Afterglow · ' + route.label;
  }

  function go(routeId, params) {
    var id = routeById(routeId).id;
    current.params = params || {};
    if (global.location.hash !== '#/' + id) {
      global.location.hash = '#/' + id;
      return; // hashchange handler performs the render
    }
    render(id, current.params);
  }

  /** Focus-preserving re-render; safe to call from any view or listener. */
  function refresh() {
    if (rendering) { pendingRefresh = true; return; }
    render(current.route, current.params);
  }

  function render(routeId, params) {
    var view = document.getElementById('view');
    if (!view) return;
    rendering = true;

    var active = document.activeElement;
    var focusHost = active && active.closest ? active.closest('[data-focus-key]') : null;
    var focusKey = focusHost ? focusHost.dataset.focusKey : null;
    var scrollY = global.scrollY;

    if (current.view && typeof current.view.destroy === 'function') {
      try { current.view.destroy(); } catch (err) { logError('destroy', err); }
    }

    var module = Afterglow.views[routeId] || Afterglow.views.home;
    current.route = routeId;
    current.view = module;

    dom.clear(view);
    try {
      module.render(view, params || {});
    } catch (err) {
      logError('render', err);
      dom.clear(view);
      view.appendChild(errorCard(err, routeId));
    }

    ui.revealAll(view);
    updateNavState();
    closeMobileNav();

    if (focusKey) {
      var target = dom.qs('[data-focus-key="' + focusKey + '"]', view);
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    } else if (global.scrollY !== scrollY) {
      global.scrollTo(0, scrollY);
    }

    rendering = false;
    if (pendingRefresh) { pendingRefresh = false; refresh(); }
  }

  function errorCard(error, routeId) {
    return h('section', { class: 'card card--quiet' },
      h('h2', { text: 'This section could not be drawn' }),
      h('p', { class: 'muted', text: 'Something went wrong while rendering “' + routeId + '”. Your saved data has not been touched.' }),
      h('p', { class: 'faint', style: { fontSize: 'var(--step--1)' }, text: String(error && error.message ? error.message : error) }),
      h('div', { class: 'actions-inline' },
        ui.button({ label: 'Try again', icon: 'restart', variant: 'primary', onClick: function () { refresh(); } }),
        ui.button({ label: 'Go home', icon: 'home', variant: 'quiet', onClick: function () { go('home'); } }),
        ui.button({ label: 'Open settings', icon: 'settings', variant: 'quiet', onClick: function () { go('settings'); } })
      )
    );
  }

  function logError(where, error) {
    if (global.console && console.error) console.error('Afterglow (' + where + '):', error);
  }

  /* --- habit ticking ------------------------------------------------------- */
  function toggleHabit(habit, dateKey) {
    var day = dateKey || Afterglow.dates.todayKey();
    var status = Afterglow.habits.statusFor(habit, day);
    var label = Afterglow.dates.relativeDay(day) === 'Today' ? 'today' : 'on ' + Afterglow.dates.formatShort(day, true);

    if (status === 'done') {
      Afterglow.habits.uncomplete(habit.id, day);
      dom.announce('Undone: ' + habit.name);
      dom.toast('Undone — “' + habit.name + '” is open again.', {
        icon: 'undo',
        actionLabel: 'Redo',
        onAction: function () { Afterglow.habits.complete(habit.id, day); refresh(); }
      });
      refresh();
      return;
    }

    if (habit.targetType !== 'check' && habit.targetAmount && status !== 'partial') {
      Afterglow.editor.askAmount(habit, day, function () {
        dom.announce('Recorded: ' + habit.name);
        refresh();
      });
      return;
    }

    Afterglow.habits.complete(habit.id, day);
    dom.announce('Recorded: ' + habit.name + ' ' + label);
    var progress = Afterglow.habits.dayProgress(day);
    if (progress.scheduled && progress.done === progress.scheduled) {
      dom.toast('Everything scheduled ' + (day === Afterglow.dates.todayKey() ? 'today' : 'that day') + ' is recorded. Quiet, solid progress.', { icon: 'spark' });
    }
    refresh();
    pulseRow(habit.id);
  }

  /** A restrained glow on the row that was just completed. */
  function pulseRow(habitId) {
    var row = dom.qs('[data-habit-id="' + habitId + '"]');
    if (!row) return;
    row.classList.add('just-done');
    setTimeout(function () { row.classList.remove('just-done'); }, 950);
  }

  /* --- running timer chip in the header ----------------------------------- */
  function buildTimerChip() {
    var actions = dom.qs('.topbar__actions');
    if (!actions || timerChip) return;
    timerChip = h('button', {
      class: 'btn btn--small btn--quiet',
      type: 'button',
      hidden: true,
      'aria-label': 'Open the focus timer',
      dataset: { focusKey: 'timer-chip' },
      on: { click: function () { go('focus'); } }
    }, icon('clock', 'icon--sm'), h('span', { id: 'timer-chip-label', text: '--:--' }));
    actions.insertBefore(timerChip, actions.firstChild);
    updateTimerChip(Afterglow.timer.snapshot());
  }

  function updateTimerChip(snapshot) {
    if (!timerChip) return;
    var active = snapshot.status === 'running' || snapshot.status === 'paused' || snapshot.status === 'finished';
    timerChip.hidden = !active;
    var label = document.getElementById('timer-chip-label');
    if (!label) return;
    if (!active) return;
    var left = Math.max(0, Math.round(snapshot.remainingSeconds));
    label.textContent = (snapshot.status === 'paused' ? 'paused · ' : '') + Afterglow.dates.clockLabel(left);
  }

  /* --- mobile navigation --------------------------------------------------- */
  function toggleMobileNav() {
    var sidebar = document.getElementById('sidebar');
    var button = dom.qs('[data-action="toggle-menu"]');
    if (!sidebar) return;
    var open = sidebar.classList.toggle('is-open');
    if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var firstLink = sidebar.querySelector('a, button');
      if (firstLink) firstLink.focus();
    }
  }
  function closeMobileNav() {
    var sidebar = document.getElementById('sidebar');
    var button = dom.qs('[data-action="toggle-menu"]');
    if (sidebar) sidebar.classList.remove('is-open');
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  /* --- wiring ------------------------------------------------------------- */
  function wireGlobal() {
    document.addEventListener('click', function (event) {
      var action = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!action) return;
      var name = action.dataset.action;
      if (name === 'open-motivation') { event.preventDefault(); openMotivation(); }
      else if (name === 'toggle-theme') { event.preventDefault(); setTheme(Afterglow.store.state.settings.theme === 'light' ? 'dark' : 'light'); }
      else if (name === 'toggle-menu') { event.preventDefault(); toggleMobileNav(); }
      else if (name === 'open-settings') { event.preventDefault(); go('settings'); }
    }, false);

    document.addEventListener('keydown', function (event) {
      if (event.altKey && (event.key === 'm' || event.key === 'M')) {
        event.preventDefault();
        openMotivation();
      }
      if (event.key === 'Escape') closeMobileNav();
    });

    global.addEventListener('hashchange', function () {
      var id = routeFromHash();
      current.params = {};
      render(id, current.params);
    });

    global.addEventListener('storage', function (event) {
      if (event.key !== Afterglow.store.KEY || !event.newValue) return;
      var result = Afterglow.store.init();
      if (result && result.state) {
        applyTheme();
        applyMotion();
        applyAtmosphere();
        refresh();
      }
    });

    if (global.matchMedia) {
      var query = global.matchMedia('(prefers-reduced-motion: reduce)');
      var handler = function () { applyMotion(); };
      if (query.addEventListener) query.addEventListener('change', handler);
      else if (query.addListener) query.addListener(handler);
    }
  }

  function openMotivation() {
    closeMobileNav();
    Afterglow.motivationFlow.open();
  }

  function motivationLabel() {
    return { label: 'I have no motivation', short: 'No motivation?' };
  }

  /* --- boot --------------------------------------------------------------- */
  function init() {
    /* Guarded so a double DOMContentLoaded (or a stray manual call) cannot
       subscribe the store twice or rebuild the navigation. */
    if (started) return;
    started = true;

    var result = Afterglow.store.init();
    var state = Afterglow.store.state;

    applyTheme();
    applyMotion();
    applyAtmosphere();
    buildNav();
    wireGlobal();
    Afterglow.timer.init();
    buildTimerChip();
    updateNavState();
    if (timerUnsubscribe) timerUnsubscribe();
    timerUnsubscribe = Afterglow.timer.subscribe(function (snapshot) { updateTimerChip(snapshot); });

    var badge = document.getElementById('schema-badge');
    if (badge) badge.textContent = 'schema v' + Afterglow.store.SCHEMA_VERSION;
    var storageBadge = document.getElementById('storage-badge');
    if (storageBadge) storageBadge.textContent = Afterglow.store.available ? 'local storage' : 'storage unavailable';

    Afterglow.store.subscribe(function (state, info) {
      if (info && info.reason === 'save-failed') {
        if (!quotaWarned) {
          quotaWarned = true;
          dom.toast('Your browser refused to save (storage may be full). Export a backup from Settings.', { icon: 'shield', duration: 12000 });
        }
        return;
      }
      refresh();
    });

    render(routeFromHash(), {});

    if (result && result.recovered) {
      setTimeout(function () {
        dom.toast(result.newerSchema
          ? 'Saved data was written by a newer version of Afterglow, so this session started fresh. Your original data was left untouched.'
          : 'Saved data could not be read, so this session started fresh. The unreadable copy was kept under a “:corrupt” key.', { icon: 'shield', duration: 12000 });
      }, 700);
    }
    if (!Afterglow.store.available) {
      setTimeout(function () {
        dom.toast('This browser is blocking local storage, so nothing will persist after a reload.', { icon: 'shield', duration: 12000 });
      }, 900);
    }

    if (!state.profile.onboarded) {
      setTimeout(function () { Afterglow.onboarding.open(); }, 420);
    }

    document.documentElement.setAttribute('data-boot', 'ready');
  }

  Afterglow.app = {
    ROUTES: ROUTES,
    init: init,
    go: go,
    render: render,
    refresh: refresh,
    rerender: refresh,
    toggleHabit: toggleHabit,
    setTheme: setTheme,
    applyTheme: applyTheme,
    applyMotion: applyMotion,
    applyAtmosphere: applyAtmosphere,
    openMotivation: openMotivation,
    motivationLabel: motivationLabel,
    currentRoute: function () { return current.route; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      try { init(); } catch (err) { logError('init', err); }
    });
  } else {
    try { init(); } catch (err) { logError('init', err); }
  }
})(typeof window !== 'undefined' ? window : this);
