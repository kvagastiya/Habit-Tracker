/* ==========================================================================
   views/focus.js — the focus timer.

   The ring and clock are updated from timer snapshots (which are derived from
   timestamps), so background tabs, sleeping screens and reopened pages stay
   accurate. Nothing is recorded until the user finishes a session.
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

  var unsubscribe = null;
  var nodes = {};

  function buildDial() {
    var size = 244;
    var stroke = 10;
    var radius = (size - stroke) / 2;
    var circumference = 2 * Math.PI * radius;

    var track = document.createElementNS(dom.SVG_NS, 'circle');
    track.setAttribute('class', 'ring__track');
    track.setAttribute('cx', String(size / 2));
    track.setAttribute('cy', String(size / 2));
    track.setAttribute('r', String(radius));
    track.setAttribute('stroke-width', String(stroke));

    var value = document.createElementNS(dom.SVG_NS, 'circle');
    value.setAttribute('class', 'ring__value');
    value.setAttribute('cx', String(size / 2));
    value.setAttribute('cy', String(size / 2));
    value.setAttribute('r', String(radius));
    value.setAttribute('stroke-width', String(stroke));
    value.setAttribute('stroke', 'var(--amber)');
    value.setAttribute('stroke-dasharray', String(circumference));
    value.setAttribute('stroke-dashoffset', String(circumference));

    var svg = document.createElementNS(dom.SVG_NS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.appendChild(track);
    svg.appendChild(value);
    nodes.valueCircle = value;
    nodes.circumference = circumference;

    nodes.clock = h('span', { class: 'timer__time', text: '20:00' });
    nodes.clockSr = h('span', { class: 'visually-hidden', 'aria-live': 'polite', text: '' });
    nodes.label = h('p', { class: 'timer__label', text: 'Ready when you are.' });

    var dial = h('div', { class: 'timer__dial', role: 'img', 'aria-label': 'Focus timer' },
      svg,
      h('div', { class: 'ring__center' }, nodes.clock, h('span', { class: 'ring__caption', text: 'remaining' })),
      nodes.clockSr
    );
    return dial;
  }

  function paint(snapshot) {
    var percent = snapshot.progress;
    if (nodes.valueCircle) {
      nodes.valueCircle.setAttribute('stroke-dashoffset', String(nodes.circumference * (1 - percent)));
      nodes.valueCircle.setAttribute('stroke', snapshot.status === 'finished' ? 'var(--sage)' : (snapshot.status === 'paused' ? 'var(--moon)' : 'var(--amber)'));
    }
    if (nodes.clock) nodes.clock.textContent = formatRemaining(snapshot);
    return snapshot;
  }

  function formatRemaining(snapshot) {
    var seconds = Math.max(0, Math.round(snapshot.remainingSeconds));
    var minutes = Math.floor(seconds / 60);
    if (minutes > 99) minutes = 99;
    return D.pad2(minutes) + ':' + D.pad2(seconds % 60);
  }

  function controls(snapshot) {
    var wrap = h('div', { class: 'timer__controls' });
    if (snapshot.status === 'running') {
      wrap.appendChild(ui.button({ label: 'Pause', icon: 'pause', variant: 'primary', onClick: function () { Afterglow.timer.pause(); Afterglow.app.rerender(); } }));
    } else if (snapshot.status === 'paused') {
      wrap.appendChild(ui.button({ label: 'Resume', icon: 'play', variant: 'primary', onClick: function () { Afterglow.timer.resume(); Afterglow.app.rerender(); } }));
    } else if (snapshot.status === 'finished') {
      wrap.appendChild(ui.button({
        label: 'Finish and record', icon: 'check', variant: 'primary',
        onClick: function () { finishSession(); }
      }));
    } else {
      wrap.appendChild(ui.button({ label: 'Start', icon: 'play', variant: 'primary', onClick: function () { startSession(); } }));
    }
    wrap.appendChild(ui.button({
      label: 'Reset', icon: 'restart', variant: 'quiet',
      onClick: function () {
        var wasActive = Afterglow.timer.isActive();
        Afterglow.timer.reset();
        if (wasActive) dom.toast('Timer reset. Nothing was recorded.', { icon: 'restart' });
        Afterglow.app.rerender();
      }
    }));
    if (snapshot.status !== 'idle' && snapshot.status !== 'finished') {
      wrap.appendChild(ui.button({
        label: snapshot.elapsedMs > 60000 ? 'Finish now' : 'Stop', icon: 'undo', variant: 'quiet',
        onClick: function () {
          var snap = Afterglow.timer.snapshot();
          var result = Afterglow.timer.finish();
          if (result.recorded) {
            dom.toast('Saved ' + D.durationLabel(result.minutes) + ' — not counted as a completed block.', { icon: 'clock' });
          } else {
            dom.toast('Session was under a minute, so nothing was recorded.', { icon: 'clock' });
          }
          void snap;
          Afterglow.app.rerender();
        }
      }));
    }
    return wrap;
  }

  function startSession() {
    var labelField = dom.qs('#focus-label');
    var habitField = dom.qs('#focus-habit');
    Afterglow.timer.start({
      label: labelField ? labelField.value.trim() : '',
      habitId: habitField && habitField.value ? habitField.value : null
    });
    dom.announce('Focus session started.');
    Afterglow.app.rerender();
  }

  function finishSession() {
    var result = Afterglow.timer.finish();
    if (!result.recorded) { Afterglow.app.rerender(); return; }
    dom.toast('Session recorded: ' + D.durationLabel(result.minutes) + '.', { icon: 'spark' });
    var habitId = result.session ? result.session.habitId : null;
    if (habitId && result.reached) offerHabitLog(habitId, result.minutes);
    else Afterglow.app.rerender();
  }

  /** Never marks the habit complete on its own: the user confirms. */
  function offerHabitLog(habitId, minutes) {
    var habit = Afterglow.habits.byId(habitId);
    if (!habit) { Afterglow.app.rerender(); return; }
    var isTick = habit.targetType === 'check' || !habit.targetAmount;
    var enough = isTick || minutes >= habit.targetAmount;
    dom.openModal({
      title: 'Log this against “' + habit.name + '”?',
      description: enough
        ? 'The session covered this habit\'s target.'
        : 'The session was shorter than this habit\'s target, so it will be saved as progress rather than a completed day.',
      body: h('p', { class: 'muted', text: 'You can leave it out and the session still stays in your focus history.' }),
      footer: [
        ui.button({
          label: enough ? 'Record habit' : 'Log ' + minutes + ' min',
          variant: 'primary',
          onClick: function () {
            if (enough && isTick) Afterglow.habits.complete(habit.id);
            else if (isTick) Afterglow.habits.complete(habit.id);
            else Afterglow.habits.complete(habit.id, null, minutes);
            dom.closeTopModal();
            Afterglow.app.rerender();
          }
        }),
        ui.button({ label: 'Not this time', variant: 'quiet', onClick: function () { dom.closeTopModal(); Afterglow.app.rerender(); } })
      ]
    });
  }

  function sessionCard() {
    var snapshot = Afterglow.timer.snapshot();
    var habits = Afterglow.habits.ordered();
    var labelInput = ui.input({ id: 'focus-label', value: snapshot.label || '', placeholder: 'What are you focusing on?', maxlength: 90 });
    var habitSelect = ui.select({
      id: 'focus-habit',
      value: snapshot.habitId || '',
      options: [{ value: '', label: 'No habit linked' }].concat(habits.map(function (habit) {
        return { value: habit.id, label: habit.name };
      }))
    });

    var presets = [5, 10, 15, 20, 25];
    var presetRow = h('div', { class: 'timer__presets' }, presets.map(function (minutes) {
      return ui.button({
        label: minutes + ' min',
        variant: 'quiet',
        className: 'btn--small',
        pressed: Afterglow.timer.preset() === minutes,
        disabled: snapshot.status === 'running' || snapshot.status === 'paused',
        onClick: function () {
          Afterglow.timer.setDuration(minutes);
          Afterglow.store.update(function (s) { s.timer.preset = minutes; }, 'timer-preset');
          Afterglow.app.rerender();
        }
      });
    }));

    var statusLine = h('p', { class: 'timer__label' });
    if (snapshot.status === 'running') {
      statusLine.textContent = snapshot.label ? 'Working on: ' + snapshot.label : 'Focusing. The clock keeps time even if you switch tabs.';
    } else if (snapshot.status === 'paused') {
      statusLine.textContent = 'Paused — the time you already spent is safe.';
    } else if (snapshot.status === 'finished') {
      statusLine.textContent = 'That session reached its planned length. Record it if you want it in your history.';
    } else if (snapshot.finishedWhileAway) {
      statusLine.textContent = 'The session finished while this page was closed. Nothing has been recorded yet — your choice.';
    } else {
      statusLine.textContent = 'Ready when you are. Stopping early records the real minutes and is not counted as a finished block.';
    }

    var breakNote = snapshot.status === 'finished'
      ? h('div', { class: 'notice notice--rest' }, icon('leaf'),
        h('div', null,
          h('strong', { text: 'A five-minute break is a good next step. ' }),
          h('span', { text: 'Stand up, drink water, look at something far away.' })
        ))
      : null;

    var body = h('div', { class: 'timer' + (snapshot.status === 'running' ? ' is-running' : '') },
      buildDial(),
      statusLine,
      controls(snapshot),
      presetRow,
      h('div', { class: 'grid grid--2', style: { width: '100%' } },
        ui.field('Session label', labelInput, { hint: 'Optional. Appears in your history.' }),
        ui.field('Linked habit', habitSelect, { hint: 'Used when you finish the session.' })
      ),
      breakNote
    );
    paint(snapshot);
    return ui.card({
      title: 'Focus session',
      subtitle: 'A timer for one thing at a time.',
      reveal: false,
      body: body,
      foot: h('p', { class: 'faint', style: { fontSize: 'var(--step--1)' }, text: 'Timing is derived from timestamps, so a background tab or a sleeping screen cannot make it drift. The run is remembered locally if you reload the page.' })
    });
  }

  function historyCard() {
    var sessions = Afterglow.timer.sessions();
    var totals = Afterglow.timer.totals();
    var last14 = D.lastNDays(14);
    var byDay = Afterglow.timer.minutesByDay(last14);
    var items = last14.map(function (day) {
      return { label: D.dayName(D.weekdayOf(day), 'short').slice(0, 1), value: byDay[day] || 0 };
    });

    var activeDayKeys = {};
    sessions.forEach(function (session) {
      if (!session.endedAt) return;
      activeDayKeys[D.toKey(new Date(session.endedAt))] = true;
    });
    var activeDayCount = Object.keys(activeDayKeys).length;
    var average = activeDayCount ? Math.round(totals.minutes / activeDayCount) : 0;

    var list = sessions.slice(0, 10).map(function (session) {
      var day = session.endedAt ? D.toKey(new Date(session.endedAt)) : D.todayKey();
      var linked = session.habitId ? Afterglow.habits.byId(session.habitId) : null;
      return h('div', { class: 'timer-session' },
        h('span', { class: 'timer-session__min', text: D.durationLabel(session.minutes) }),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { text: session.label || (linked ? linked.name : 'Focus session') }),
          h('div', { class: 'faint', style: { fontSize: 'var(--step--1)' }, text: D.relativeDay(day) + ' · planned ' + D.durationLabel(session.plannedMinutes) })
        ),
        session.completed ? ui.badge('finished', 'sage', 'check') : ui.badge('stopped early', 'quiet', 'moon')
      );
    });

    return ui.card({
      title: 'Focus history',
      subtitle: totals.count ? totals.finished + ' of ' + totals.count + ' sessions run to their planned length.' : 'Nothing recorded yet.',
      body: h('div', { class: 'stack' },
        h('div', { class: 'grid grid--3' },
          ui.statTile({ value: D.durationLabel(totals.minutes), label: 'Total focused time' }),
          ui.statTile({ value: String(totals.finished), label: 'Sessions finished', hint: 'run to the planned length' }),
          ui.statTile({ value: activeDayCount ? D.durationLabel(average) : '—', label: 'Average per active day', hint: activeDayCount ? 'over ' + activeDayCount + ' day' + (activeDayCount === 1 ? '' : 's') : 'once there is data' })
        ),
        ui.barChart({
          items: items,
          ariaLabel: 'Minutes focused on each of the last 14 days',
          max: Math.max(1, Math.max.apply(null, items.map(function (item) { return item.value; })))
        }),
        h('p', { class: 'chart-card__caption', text: 'Last 14 days: ' + D.durationLabel(items.reduce(function (sum, item) { return sum + item.value; }, 0)) + ' focused in total, with a busiest day of ' + D.durationLabel(Math.max.apply(null, items.map(function (item) { return item.value; }).concat([0]))) + '.' }),
        sessions.length ? h('div', { class: 'plain-list divide' }, list) : ui.emptyState({
          icon: 'clock',
          title: 'No sessions yet',
          text: 'Start with five minutes. A short session that happened is worth more than a long one that did not.'
        })
      )
    });
  }

  Afterglow.views.focus = {
    title: 'Focus',
    context: 'Focus timer',
    render: function (container) {
      container.appendChild(ui.pageHeader({
        eyebrow: 'Attention',
        title: 'Focus timer',
        lead: 'One session, one intention. The timer is honest about what it records: unfinished sessions are saved with their real length and are never counted as finished blocks.',
        actions: [
          ui.button({ label: 'Open no-motivation flow', icon: 'spark', variant: 'glow', onClick: function () { Afterglow.app.openMotivation(); } })
        ]
      }));

      container.appendChild(h('div', { class: 'stack' },
        sessionCard(),
        historyCard()
      ));

      if (unsubscribe) unsubscribe();
      unsubscribe = Afterglow.timer.subscribe(function (snapshot, event) {
        paint(snapshot);
        if (nodes.label) {
          nodes.label.textContent = snapshot.status === 'running'
            ? 'Time remaining: ' + formatRemaining(snapshot) + (snapshot.label ? ', ' + snapshot.label : '')
            : '';
        }
        if (nodes.clockSr && (event === 'finished' || event === 'start' || event === 'pause' || event === 'resume')) {
          if (event === 'finished') {
            nodes.clockSr.textContent = 'Session complete. ' + (snapshot.label ? snapshot.label + '. ' : '') + 'Ready to record.';
            Afterglow.app.rerender();
          } else {
            nodes.clockSr.textContent = event === 'start' ? 'Timer started.' : (event === 'pause' ? 'Timer paused.' : 'Timer resumed.');
          }
        }
      });
    },
    destroy: function () {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      nodes = {};
    }
  };
})(typeof window !== 'undefined' ? window : this);
