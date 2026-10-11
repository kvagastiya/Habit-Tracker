/* ==========================================================================
   journey.js — the optional 30-day journey.

   The journey is a gentle scaffold, never a gate: habit tracking works with or
   without it, days can be skipped, and pausing simply stops the clock. Journey
   positions are stored by day index (0–29) so restarting is clean.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var D = Afterglow.dates;
  var S = Afterglow.store;

  function plan() { return Afterglow.data.JOURNEY; }
  function totalDays() {
    return plan().reduce(function (sum, week) { return sum + week.days.length; }, 0);
  }

  /** Flattened list of all 30 entries with their week. */
  function flat() {
    var out = [];
    plan().forEach(function (week) {
      week.days.forEach(function (day, indexInWeek) {
        out.push({
          index: out.length,
          dayOfWeek: indexInWeek + 1,
          week: week.week,
          weekTitle: week.title,
          theme: week.theme,
          title: day.title,
          prompt: day.prompt
        });
      });
    });
    return out;
  }

  function dayByIndex(index) {
    var list = flat();
    if (index < 0 || index >= list.length) return null;
    return list[index];
  }

  /** Which day of the journey "today" is, based on the start date. */
  function currentIndex() {
    var state = S.state.journey;
    if (!state.startedAt) return 0;
    var elapsed = D.diffDays(state.startedAt, D.todayKey());
    if (state.pausedAt) {
      var untilPause = Math.max(0, D.diffDays(state.startedAt, state.pausedAt));
      elapsed = Math.min(elapsed, untilPause);
    }
    return Math.max(0, Math.min(totalDays() - 1, elapsed));
  }

  function entryFor(index) {
    var state = S.state.journey;
    return state.days[String(index)] || null;
  }

  function today() {
    var index = currentIndex();
    return { index: index, day: dayByIndex(index), entry: entryFor(index), state: S.state.journey };
  }

  function progress() {
    var state = S.state.journey;
    var done = Object.keys(state.days).filter(function (key) { return state.days[key] && state.days[key].done; }).length;
    var total = totalDays();
    return { done: done, total: total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function start(options) {
    var opts = options || {};
    S.update(function (state) {
      state.journey.active = true;
      state.journey.skipped = false;
      state.journey.pausedAt = null;
      if (!state.journey.startedAt || opts.restart) {
        state.journey.startedAt = D.todayKey();
        state.journey.days = {};
      }
    }, 'journey-start');
    return today();
  }

  function pause() {
    S.update(function (state) {
      if (!state.journey.active) return;
      state.journey.active = false;
      state.journey.pausedAt = D.todayKey();
    }, 'journey-pause');
  }

  function resume() {
    S.update(function (state) {
      if (!state.journey.startedAt) return;
      var paused = state.journey.pausedAt;
      if (paused) {
        /* Keep the paused length from consuming journey days. */
        var today = D.todayKey();
        var pausedFor = Math.max(0, D.diffDays(paused, today));
        if (pausedFor > 0) state.journey.startedAt = D.addDays(state.journey.startedAt, pausedFor);
      }
      state.journey.active = true;
      state.journey.pausedAt = null;
    }, 'journey-resume');
  }

  function restart() {
    S.update(function (state) {
      state.journey = { active: true, startedAt: D.todayKey(), pausedAt: null, days: {}, skipped: false };
    }, 'journey-restart');
  }

  function skip() {
    S.update(function (state) {
      state.journey.active = false;
      state.journey.skipped = true;
    }, 'journey-skip');
    return today();
  }

  function mark(index, done, note) {
    S.update(function (state) {
      var key = String(index);
      var existing = state.journey.days[key] || {};
      state.journey.days[key] = {
        done: done === undefined ? !existing.done : !!done,
        date: existing.date || D.todayKey(),
        note: note !== undefined ? String(note).slice(0, 400) : (existing.note || '')
      };
    }, 'journey-mark');
    return today();
  }

  Afterglow.journey = {
    plan: plan,
    flat: flat,
    totalDays: totalDays,
    dayByIndex: dayByIndex,
    currentIndex: currentIndex,
    today: today,
    entryFor: entryFor,
    progress: progress,
    start: start,
    pause: pause,
    resume: resume,
    restart: restart,
    skip: skip,
    mark: mark,
    isActive: function () { return !!S.state.journey.active; }
  };
})(typeof window !== 'undefined' ? window : this);
