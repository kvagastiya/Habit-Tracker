/* ==========================================================================
   ui.js — shared building blocks for every view.
   Kept deliberately small and boring: plain DOM nodes, no templating engine,
   no innerHTML with user text.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var dom = Afterglow.dom;
  var h = dom.h;
  var icon = dom.icon;
  var D = Afterglow.dates;

  function button(opts) {
    var options = opts || {};
    var node = h('button', {
      class: 'btn' + (options.variant ? ' btn--' + options.variant : '') + (options.className ? ' ' + options.className : ''),
      type: 'button',
      title: options.title || null,
      'aria-label': options.label ? null : options.ariaLabel || null,
      'aria-pressed': options.pressed === undefined ? null : String(!!options.pressed),
      disabled: options.disabled || false,
      dataset: options.dataset || null,
      on: options.onClick ? { click: options.onClick } : null
    });
    if (options.icon) node.appendChild(icon(options.icon, options.iconClass));
    if (options.label) node.appendChild(h('span', { text: options.label }));
    if (options.children) options.children.forEach(function (child) { node.appendChild(child); });
    return node;
  }

  function iconButton(name, label, onClick, opts) {
    var options = opts || {};
    return h('button', {
      class: 'btn btn--icon' + (options.className ? ' ' + options.className : ''),
      type: 'button',
      'aria-label': label,
      title: options.title || label,
      'aria-pressed': options.pressed === undefined ? null : String(!!options.pressed),
      disabled: options.disabled || null,
      dataset: options.dataset || null,
      on: { click: onClick }
    }, icon(name, options.iconClass));
  }

  function pageHeader(opts) {
    var options = opts || {};
    var actions = options.actions || [];
    return h('header', { class: 'page-head reveal' },
      options.eyebrow ? h('p', { class: 'eyebrow', text: options.eyebrow }) : null,
      h('div', { class: 'row row--between' },
        h('div', { style: { minWidth: '0' } },
          h('h1', { text: options.title }),
          options.lead ? h('p', { class: 'muted', style: { maxWidth: '62ch' }, text: options.lead }) : null
        ),
        actions.length ? h('div', { class: 'actions-inline' }, actions) : null
      )
    );
  }

  function card(opts) {
    var options = opts || {};
    var node = h('section', { class: 'card' + (options.className ? ' ' + options.className : '') + (options.reveal === false ? '' : ' reveal') });
    if (options.title || options.actions) {
      node.appendChild(h('div', { class: 'card__head' },
        h('div', { style: { minWidth: '0' } },
          options.title ? h(options.headingLevel || 'h2', { text: options.title, style: { fontSize: 'var(--step-1)' } }) : null,
          options.subtitle ? h('p', { text: options.subtitle }) : null
        ),
        options.actions ? h('div', { class: 'actions-inline' }, options.actions) : null
      ));
    }
    if (options.body) node.appendChild(options.body);
    if (options.foot) node.appendChild(h('div', { class: 'card__foot' }, options.foot));
    return node;
  }

  function statTile(opts) {
    var options = opts || {};
    return h('div', { class: 'stat' },
      h('span', { class: 'stat__value', text: options.value }),
      h('span', { class: 'stat__label', text: options.label }),
      options.hint ? h('span', { class: 'stat__hint', text: options.hint }) : null
    );
  }

  /**
   * Animated progress ring. The wrapper carries the accessible label so screen
   * readers hear "3 of 5 habits recorded today" rather than an empty graphic.
   */
  function progressRing(opts) {
    var options = opts || {};
    var size = options.size || 150;
    var stroke = options.stroke || 9;
    var value = Math.max(0, Math.min(1, options.value || 0));
    var radius = (size - stroke) / 2;
    var circumference = 2 * Math.PI * radius;
    var target = circumference * (1 - value);
    var tone = options.tone || (value >= 1 ? 'var(--sage)' : 'var(--amber)');

    var circle = document.createElementNS(dom.SVG_NS, 'circle');
    circle.setAttribute('class', 'ring__value');
    circle.setAttribute('cx', String(size / 2));
    circle.setAttribute('cy', String(size / 2));
    circle.setAttribute('r', String(radius));
    circle.setAttribute('stroke-width', String(stroke));
    circle.setAttribute('stroke', tone);
    circle.setAttribute('stroke-dasharray', String(circumference));
    circle.setAttribute('stroke-dashoffset', String(circumference));

    var track = document.createElementNS(dom.SVG_NS, 'circle');
    track.setAttribute('class', 'ring__track');
    track.setAttribute('cx', String(size / 2));
    track.setAttribute('cy', String(size / 2));
    track.setAttribute('r', String(radius));
    track.setAttribute('stroke-width', String(stroke));

    var svg = document.createElementNS(dom.SVG_NS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.appendChild(track);
    svg.appendChild(circle);

    var center = h('div', { class: 'ring__center' },
      h('span', { class: 'ring__number', text: options.valueText || String(Math.round(value * 100)) + '%' }),
      options.caption ? h('span', { class: 'ring__caption', text: options.caption }) : null
    );

    var wrap = h('div', {
      class: 'ring',
      role: 'img',
      'aria-label': options.ariaLabel || ((options.caption || 'Progress') + ': ' + Math.round(value * 100) + ' percent')
    }, svg, center);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { circle.setAttribute('stroke-dashoffset', String(target)); });
    });
    return wrap;
  }

  function bar(opts) {
    var options = opts || {};
    var value = Math.max(0, Math.min(1, options.value || 0));
    var fill = h('span', { class: 'bar__fill', style: { width: '0%' } });
    var node = h('div', {
      class: 'bar' + (options.variant === 'amber' ? ' bar--amber' : '') + (options.thin ? ' bar--thin' : ''),
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(Math.round(value * 100)),
      'aria-label': options.label || null
    }, fill);
    requestAnimationFrame(function () { fill.style.width = (value * 100).toFixed(1) + '%'; });
    return node;
  }

  function emptyState(opts) {
    var options = opts || {};
    return h('div', { class: 'empty' },
      h('span', { class: 'empty__mark' }, icon(options.icon || 'spark')),
      h('h3', { text: options.title || 'Nothing here yet' }),
      h('p', { text: options.text || '' }),
      options.action ? options.action : null
    );
  }

  function badge(label, variant, iconName) {
    return h('span', { class: 'badge' + (variant ? ' badge--' + variant : '') },
      iconName ? icon(iconName, 'icon--sm') : null,
      h('span', { text: label })
    );
  }

  function habitDot(habit) {
    var color = Afterglow.data.accentColor(habit.accent);
    return h('span', { class: 'habit-dot', style: { background: color, color: color }, 'aria-hidden': 'true' });
  }

  function targetText(habit) {
    var type = Afterglow.data.targetTypeById(habit.targetType);
    if (habit.targetType === 'check' || !habit.targetAmount) return 'Once a day';
    return habit.targetAmount + ' ' + type.unit;
  }

  function scheduleText(habit) {
    if (habit.schedule.type === 'daily') return 'Every day';
    var days = habit.schedule.days.slice().sort();
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && days.join(',') === '1,2,3,4,5') return 'Weekdays';
    if (days.length === 2 && days.join(',') === '0,6') return 'Weekends';
    return days.map(function (d) { return D.dayName(d, 'short'); }).join(', ');
  }

  /** Small seven-day dot strip used inside habit rows. */
  function weekStrip(habit) {
    var weekStart = Afterglow.store.state.settings.weekStart;
    var keys = D.weekKeys(D.todayKey(), weekStart);
    return h('div', { class: 'week-strip', role: 'img', 'aria-label': 'Last seven days for ' + habit.name },
      keys.map(function (day) {
        var status = Afterglow.habits.statusFor(habit, day);
        var state = status === 'done' ? 'done' : (status === 'skipped' ? 'skip' : (day === D.todayKey() ? 'today' : 'plain'));
        return h('span', { class: 'week-strip__day', 'aria-hidden': 'true' },
          h('span', { class: 'week-strip__dot', dataset: { state: state } }),
          h('span', { text: D.dayName(D.weekdayOf(day), 'short').slice(0, 1) })
        );
      })
    );
  }

  /**
   * One habit line, shared by the dashboard and the habits page.
   * states: done | partial | pending | skipped | rest | future
   */
  function habitRow(habit, opts) {
    var options = opts || {};
    var date = options.date || D.todayKey();
    var status = Afterglow.habits.statusFor(habit, date);
    var progress = Afterglow.habits.entryProgress(habit, date);
    var interactive = options.interactive !== false;

    var check = h('button', {
      class: 'check',
      type: 'button',
      'aria-pressed': status === 'done' ? 'true' : 'false',
      dataset: { state: status },
      disabled: interactive && status === 'future' ? true : null,
      'aria-label': (status === 'done' ? 'Undo completion of ' : 'Mark complete: ') + habit.name,
      dataset: { focusKey: 'check-' + habit.id, habitId: habit.id },
      on: interactive ? {
        click: function () { options.onToggle ? options.onToggle(habit, status) : null; }
      } : null
    }, status === 'done' ? icon('check') : (status === 'skipped' ? icon('skip') : null));

    var meta = [
      h('span', { class: 'badge badge--quiet', text: status === 'skipped' ? 'Rest day' : (status === 'partial' ? (progress.amount + ' of ' + progress.target + ' ' + Afterglow.data.targetTypeById(habit.targetType).unit) : Afterglow.data.categoryById(habit.category).label) }),
      h('span', { class: 'faint', text: scheduleText(habit) })
    ];
    if (options.showStreak !== false) {
      var streak = Afterglow.habits.streak(habit);
      if (streak.current > 0) meta.push(h('span', { class: 'streak-chip' }, icon('spark', 'icon--sm'), h('span', { text: streak.current + ' in a row' })));
      if (streak.restDays > 0) meta.push(h('span', { class: 'streak-chip' }, icon('moon', 'icon--sm'), h('span', { text: streak.restDays + ' rest' })));
    }

    var titleRow = h('div', { class: 'habit-row__title' },
      habitDot(habit),
      h('span', { text: habit.name }),
      status === 'done' ? h('span', { class: 'visually-hidden', text: '(completed)' }) : null,
      status === 'partial' ? h('span', { class: 'visually-hidden', text: '(partly done)' }) : null
    );

    var main = h('div', { class: 'habit-row__main' },
      titleRow,
      habit.description ? h('p', { class: 'habit-row__desc', text: habit.description }) : null,
      h('div', { class: 'habit-row__meta' }, meta),
      options.showWeek === false ? null : weekStrip(habit)
    );

    var actions = options.actions ? h('div', { class: 'habit-row__actions' }, options.actions) : null;

    return h('div', {
      class: 'habit-row' + (status === 'done' ? ' is-done' : '') + (habit.archived ? ' is-archived' : '') + (options.className ? ' ' + options.className : ''),
      dataset: { habitId: habit.id, focusKey: 'row-' + habit.id }
    }, check, main, actions);
  }

  /** Horizontal bar chart with a text summary supplied by the caller. */
  function barChart(opts) {
    var options = opts || {};
    var items = options.items || [];
    var max = Math.max(options.max || 0, items.reduce(function (m, item) { return Math.max(m, item.value); }, 0), 1);
    return h('div', {
      class: 'barchart',
      role: 'img',
      'aria-label': options.ariaLabel || 'Bar chart'
    }, items.map(function (item) {
      var ratio = item.value / max;
      return h('div', { class: 'barchart__col', 'aria-hidden': 'true' },
        h('div', { class: 'barchart__stack' },
          h('div', {
            class: 'barchart__fill' + (item.partial ? ' barchart__fill--partial' : ''),
            style: { height: Math.max(item.value > 0 ? 4 : 0, ratio * 100).toFixed(0) + '%' }
          })
        ),
        h('span', { class: 'barchart__label', text: item.label })
      );
    }));
  }

  /** Calendar month grid with per-day intensity. */
  function calendar(opts) {
    var options = opts || {};
    var year = options.year;
    var monthIndex = options.monthIndex;
    var weekStart = Afterglow.store.state.settings.weekStart;
    var first = new Date(year, monthIndex, 1);
    var lead = (first.getDay() - weekStart + 7) % 7;
    var total = D.daysInMonth(year, monthIndex);
    var byDate = {};
    (options.days || []).forEach(function (entry) { byDate[entry.date] = entry; });

    var heads = [];
    for (var i = 0; i < 7; i++) {
      heads.push(h('span', { class: 'calendar__head', text: D.dayName((weekStart + i) % 7, 'short').slice(0, 2) }));
    }
    var cells = [];
    for (var l = 0; l < lead; l++) cells.push(h('span', { class: 'calendar__day', dataset: { empty: 'true' } }));
    for (var day = 1; day <= total; day++) {
      var key = D.toKey(new Date(year, monthIndex, day));
      var entry = byDate[key];
      var level = entry && !D.isFutureKey(key) ? Afterglow.insights.levelFor(entry) : 0;
      cells.push(h('span', {
        class: 'calendar__day',
        dataset: { level: String(level), today: String(key === D.todayKey()) },
        title: D.formatShort(key, true) + (entry ? ': ' + entry.done + ' recorded' : ': nothing recorded'),
        text: String(day)
      }));
    }
    return h('div', { class: 'calendar', role: 'img', 'aria-label': options.ariaLabel || 'Calendar of recorded activity' },
      h('div', { class: 'visually-hidden' }, h('p', { text: options.summary || '' })),
      dom.frag.apply(null, heads.concat(cells))
    );
  }

  /** Night-sky visualisation; every dot is one real completion. */
  function constellationView(opts) {
    var options = opts || {};
    var points = options.points || [];
    var width = 640, height = 260;
    var svg = document.createElementNS(dom.SVG_NS, 'svg');
    svg.setAttribute('class', 'constellation');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', options.summary || 'Constellation of completed actions');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    points.forEach(function (point, index) {
      var circle = document.createElementNS(dom.SVG_NS, 'circle');
      circle.setAttribute('cx', String(Math.round(point.x * width)));
      circle.setAttribute('cy', String(Math.round(point.y * height)));
      circle.setAttribute('r', String(point.radius));
      circle.setAttribute('fill', Afterglow.data.accentColor(point.accent));
      circle.setAttribute('opacity', point.complete ? '0.9' : '0.45');
      circle.setAttribute('class', 'constellation__point');
      circle.style.animationDelay = (index % 24) * 40 + 'ms';
      svg.appendChild(circle);
    });
    return svg;
  }

  /* --- form field builders ------------------------------------------------- */
  function field(label, control, opts) {
    var options = opts || {};
    var id = control.id || dom.uid('field');
    control.id = id;
    if (options.hint) control.setAttribute('aria-describedby', id + '-hint');
    return h('div', { class: 'field' },
      h('label', { for: id, text: label }),
      control,
      options.hint ? h('span', { class: 'field__hint', id: id + '-hint', text: options.hint }) : null
    );
  }

  function input(opts) {
    var options = opts || {};
    return h('input', {
      class: 'input',
      type: options.type || 'text',
      id: options.id || null,
      value: options.value === undefined || options.value === null ? '' : String(options.value),
      placeholder: options.placeholder || null,
      maxlength: options.maxlength || null,
      min: options.min === undefined ? null : options.min,
      max: options.max === undefined ? null : options.max,
      step: options.step || null,
      autocomplete: options.autocomplete || 'off',
      'aria-label': options.ariaLabel || null,
      dataset: options.dataset || null,
      on: options.on || null
    });
  }

  function textarea(opts) {
    var options = opts || {};
    return h('textarea', {
      class: 'textarea',
      id: options.id || null,
      rows: options.rows || 6,
      maxlength: options.maxlength || null,
      placeholder: options.placeholder || null,
      'aria-label': options.ariaLabel || null,
      value: options.value || ''
    });
  }

  function select(opts) {
    var options = opts || {};
    var node = h('select', {
      class: 'select',
      id: options.id || null,
      'aria-label': options.ariaLabel || null,
      on: options.on || null
    });
    (options.options || []).forEach(function (item) {
      node.appendChild(h('option', { value: item.value, text: item.label, selected: String(options.value) === String(item.value) }));
    });
    return node;
  }

  function segmented(opts) {
    var options = opts || {};
    var node = h('div', { class: 'segmented', role: 'group', 'aria-label': options.ariaLabel || 'Options' });
    (options.items || []).forEach(function (item) {
      node.appendChild(h('button', {
        type: 'button',
        text: item.label,
        'aria-pressed': String(options.value) === String(item.value) ? 'true' : 'false',
        dataset: { value: String(item.value) },
        on: { click: function () { options.onSelect(item.value); } }
      }));
    });
    return node;
  }

  function chipSelect(opts) {
    var options = opts || {};
    var node = h('div', { class: 'chip-select', role: 'group', 'aria-label': options.ariaLabel || 'Choices' });
    (options.items || []).forEach(function (item) {
      var selected = options.isSelected ? options.isSelected(item.value) : false;
      node.appendChild(h('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': selected ? 'true' : 'false',
        on: { click: function () { options.onSelect(item.value); } }
      }, icon(item.icon || 'spark', 'icon--sm'), h('span', { text: item.label })));
    });
    return node;
  }

  function dayPicker(opts) {
    var options = opts || {};
    var selected = options.value || [];
    var node = h('div', { class: 'day-picker', role: 'group', 'aria-label': options.ariaLabel || 'Days of the week' });
    for (var i = 0; i < 7; i++) {
      (function (dayIndex) {
        var isOn = selected.indexOf(dayIndex) > -1;
        node.appendChild(h('button', {
          type: 'button',
          text: D.dayName(dayIndex, 'short').slice(0, 2),
          'aria-pressed': isOn ? 'true' : 'false',
          'aria-label': D.dayName(dayIndex),
          on: {
            click: function () {
              var next = selected.slice();
              var at = next.indexOf(dayIndex);
              if (at > -1) next.splice(at, 1); else next.push(dayIndex);
              next.sort(function (a, b) { return a - b; });
              selected = next;
              options.onChange(next);
            }
          }
        }));
      })(i);
    }
    return node;
  }

  /* --- animation ----------------------------------------------------------- */
  var observer = null;
  function revealAll(container) {
    var nodes = dom.qsa('.reveal', container || document);
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var motionOff = document.documentElement.getAttribute('data-motion') === 'off';
    if (reduced || motionOff || typeof IntersectionObserver === 'undefined') {
      nodes.forEach(function (node) { node.classList.add('is-in'); });
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    }
    nodes.forEach(function (node, index) {
      if (node.classList.contains('is-in')) return;
      node.style.animationDelay = Math.min(index * 45, 260) + 'ms';
      observer.observe(node);
    });
  }

  Afterglow.ui = {
    button: button,
    iconButton: iconButton,
    pageHeader: pageHeader,
    card: card,
    statTile: statTile,
    progressRing: progressRing,
    bar: bar,
    emptyState: emptyState,
    badge: badge,
    habitRow: habitRow,
    habitDot: habitDot,
    targetText: targetText,
    scheduleText: scheduleText,
    weekStrip: weekStrip,
    barChart: barChart,
    calendar: calendar,
    constellationView: constellationView,
    field: field,
    input: input,
    textarea: textarea,
    select: select,
    segmented: segmented,
    chipSelect: chipSelect,
    dayPicker: dayPicker,
    revealAll: revealAll
  };
})(typeof window !== 'undefined' ? window : this);
