/* ==========================================================================
   views/journey.js — the optional 30-day journey.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  Afterglow.views = Afterglow.views || {};
  var dom = Afterglow.dom;
  var ui = Afterglow.ui;
  var h = dom.h;
  var icon = dom.icon;
  var D = Afterglow.dates;

  function statusStrip() {
    var state = Afterglow.store.state.journey;
    var progress = Afterglow.journey.progress();
    var today = Afterglow.journey.today();

    var actions = [];
    if (!state.startedAt) {
      actions.push(ui.button({
        label: 'Start the journey', icon: 'journey', variant: 'primary',
        onClick: function () {
          Afterglow.journey.start({ restart: true });
          dom.toast('Journey started. Day 1 is ready when you are.', { icon: 'journey' });
          Afterglow.app.refresh();
        }
      }));
    } else if (state.active) {
      actions.push(ui.button({ label: 'Pause', icon: 'pause', variant: 'quiet', onClick: function () { Afterglow.journey.pause(); dom.announce('Journey paused.'); Afterglow.app.refresh(); } }));
    } else {
      actions.push(ui.button({ label: 'Resume', icon: 'play', variant: 'primary', onClick: function () { Afterglow.journey.resume(); dom.announce('Journey resumed.'); Afterglow.app.refresh(); } }));
    }
    if (state.startedAt) {
      actions.push(ui.button({ label: 'Restart', icon: 'restart', variant: 'quiet', onClick: function () {
        dom.confirmAction({
          title: 'Restart the journey?',
          message: 'Your habit records, journal and focus history are untouched. Only the journey\'s own tick marks are cleared.',
          confirmLabel: 'Restart journey'
        }).then(function (ok) { if (ok) { Afterglow.journey.restart(); Afterglow.app.refresh(); } });
      } }));
      actions.push(ui.button({ label: 'Skip the journey', icon: 'skip', variant: 'quiet', onClick: function () {
        Afterglow.journey.skip();
        dom.toast('Journey set aside. Habit tracking carries on exactly as before.', { icon: 'moon' });
        Afterglow.app.refresh();
      } }));
    }

    var statusText = !state.startedAt
      ? 'Not started. It is completely optional and stays out of the way of normal tracking.'
      : state.active
        ? 'Running since ' + D.formatShort(state.startedAt, true) + '. Today is day ' + (today.index + 1) + ' of ' + Afterglow.journey.totalDays() + '.'
        : (state.pausedAt ? 'Paused since ' + D.formatShort(state.pausedAt, true) + '. The clock is stopped — nothing is being missed.' : 'Set aside for now.');

    return ui.card({
      title: 'Thirty days, four themes',
      subtitle: statusText,
      actions: actions,
      body: h('div', { class: 'stack' },
        h('div', { class: 'journey-progress' },
          ui.bar({ value: progress.percent / 100, variant: 'amber', label: 'Journey progress: ' + progress.percent + ' percent' }),
          h('span', { class: 'numeric', text: progress.done + '/' + progress.total })
        ),
        h('p', { class: 'muted', style: { fontSize: 'var(--step--1)' }, text: 'Missed journey days are not failures and do not reset anything. If a week goes sideways, pause it — or ignore it entirely and keep tracking habits.' })
      )
    });
  }

  function todayCard() {
    var today = Afterglow.journey.today();
    if (!today.day) return null;
    var noteInput = ui.textarea({
      value: (today.entry && today.entry.note) || '',
      rows: 3,
      maxlength: 400,
      placeholder: 'Optional: a sentence about how this went.'
    });

    return ui.card({
      className: 'card--accent',
      title: 'Today in the journey',
      subtitle: 'Week ' + today.day.week + ' · ' + today.day.weekTitle,
      body: h('div', { class: 'stack' },
        h('p', { class: 'eyebrow', text: 'Day ' + (today.index + 1) + ' of ' + Afterglow.journey.totalDays() }),
        h('h3', { style: { margin: '0' }, text: today.day.title }),
        h('p', { class: 'muted', text: today.day.prompt }),
        ui.field('Your note', noteInput, { hint: 'Saved only if you press save.' }),
        h('div', { class: 'actions-inline' },
          ui.button({
            label: today.entry && today.entry.done ? 'Mark as not done' : 'Mark this day done',
            icon: 'check',
            variant: today.entry && today.entry.done ? 'quiet' : 'primary',
            onClick: function () {
              Afterglow.journey.mark(today.index);
              dom.announce('Journey day updated.');
              Afterglow.app.refresh();
            }
          }),
          ui.button({
            label: 'Save note', icon: 'journal', variant: 'quiet',
            onClick: function () {
              Afterglow.journey.mark(today.index, undefined, noteInput.value.trim());
              dom.toast('Note saved.', { icon: 'journal' });
              Afterglow.app.refresh();
            }
          }),
          ui.button({ label: 'Write in journal', icon: 'chevron', variant: 'quiet', onClick: function () { Afterglow.app.go('journal'); } })
        )
      )
    });
  }

  function weeksCard() {
    var current = Afterglow.journey.today().index;
    var state = Afterglow.store.state.journey;
    var offset = 0;

    return h('div', { class: 'stack' }, Afterglow.journey.plan().map(function (week) {
      var startIndex = offset;
      offset += week.days.length;
      var doneCount = 0;

      var rows = week.days.map(function (day, indexInWeek) {
        var index = startIndex + indexInWeek;
        var entry = Afterglow.journey.entryFor(index);
        if (entry && entry.done) doneCount++;
        var isToday = !!state.startedAt && index === current;
        return h('div', { class: 'journey-day' },
          h('span', { class: 'journey-day__num', text: 'Day ' + (index + 1) + (isToday ? ' · today' : '') }),
          h('div', { class: 'journey-day__body' },
            h('p', { class: 'journey-day__title', text: day.title }),
            h('p', { class: 'journey-day__prompt', text: day.prompt }),
            entry && entry.note ? h('p', { class: 'faint', style: { fontSize: 'var(--step--1)', marginTop: '4px' }, text: 'Your note: ' + entry.note }) : null
          ),
          h('button', {
            class: 'check',
            type: 'button',
            'aria-pressed': entry && entry.done ? 'true' : 'false',
            'aria-label': (entry && entry.done ? 'Mark not done: ' : 'Mark done: ') + 'journey day ' + (index + 1) + ', ' + day.title,
            dataset: { focusKey: 'journey-' + index },
            on: {
              click: function () {
                Afterglow.journey.mark(index);
                Afterglow.app.refresh();
              }
            }
          }, entry && entry.done ? icon('check') : null)
        );
      });

      return h('section', { class: 'journey-week reveal' },
        h('div', { class: 'journey-week__head' },
          h('span', { class: 'journey-week__num', text: 'W' + week.week }),
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('h2', { style: { margin: '0', fontSize: 'var(--step-1)' }, text: week.title }),
            h('p', { class: 'muted', style: { margin: '2px 0 0', fontSize: 'var(--step--1)' }, text: week.theme })
          ),
          ui.badge(doneCount + '/' + week.days.length + ' done', doneCount === week.days.length ? 'sage' : 'quiet', doneCount === week.days.length ? 'check' : null)
        ),
        h('div', null, rows)
      );
    }));
  }

  Afterglow.views.journey = {
    title: 'Journey',
    context: '30-day journey',
    render: function (container) {
      container.appendChild(ui.pageHeader({
        eyebrow: 'Optional structure',
        title: 'Thirty-day journey',
        lead: 'Four gentle weeks with one small prompt a day. It is a scaffold, not a curriculum: pause it, skip it, or ignore it entirely and your habits keep working.',
        actions: [ui.button({ label: 'Habits instead', icon: 'list', variant: 'quiet', onClick: function () { Afterglow.app.go('habits'); } })]
      }));

      container.appendChild(h('div', { class: 'stack' },
        statusStrip(),
        todayCard(),
        weeksCard()
      ));
    }
  };
})(typeof window !== 'undefined' ? window : this);
