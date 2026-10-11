/* ==========================================================================
   timer.js — the focus timer.

   Remaining time is always derived from timestamps rather than counted from
   interval callbacks, so a throttled background tab, a sleeping laptop or a
   reopened page cannot make the clock drift. The live run is mirrored into
   localStorage so a reload does not lose a session in progress, and a session
   is only recorded when the user actually finishes it.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var KEY = 'afterglow:timer';
  var listeners = [];
  var interval = null;
  var runtime = null;

  function now() { return Date.now(); }

  function blank() {
    return {
      status: 'idle',       // idle | running | paused | finished
      durationMs: 20 * 60000,
      accumulatedMs: 0,     // time banked from previous running stretches
      startedAt: null,      // timestamp of the current running stretch
      label: '',
      habitId: null,
      startedClock: null,
      finishedWhileAway: false
    };
  }

  function loadRuntime() {
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (err) { raw = null; }
    if (!raw) return blank();
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return blank();
      var base = blank();
      return {
        status: ['idle', 'running', 'paused', 'finished'].indexOf(parsed.status) > -1 ? parsed.status : 'idle',
        durationMs: Math.max(60000, Number(parsed.durationMs) || base.durationMs),
        accumulatedMs: Math.max(0, Number(parsed.accumulatedMs) || 0),
        startedAt: Number(parsed.startedAt) || null,
        label: typeof parsed.label === 'string' ? parsed.label.slice(0, 90) : '',
        habitId: typeof parsed.habitId === 'string' ? parsed.habitId : null,
        startedClock: Number(parsed.startedClock) || null,
        finishedWhileAway: false
      };
    } catch (err) { return blank(); }
  }

  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(runtime)); } catch (err) { /* ignore */ }
  }
  function clearPersisted() {
    try { global.localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
  }

  function elapsedMs() {
    if (!runtime) return 0;
    var running = runtime.status === 'running' && runtime.startedAt ? (now() - runtime.startedAt) : 0;
    return Math.min(runtime.durationMs, runtime.accumulatedMs + running);
  }

  function snapshot() {
    if (!runtime) runtime = blank();
    var elapsed = elapsedMs();
    var remaining = Math.max(0, runtime.durationMs - elapsed);
    return {
      status: runtime.status,
      durationMs: runtime.durationMs,
      elapsedMs: elapsed,
      remainingMs: remaining,
      progress: runtime.durationMs ? elapsed / runtime.durationMs : 0,
      label: runtime.label,
      habitId: runtime.habitId,
      remainingSeconds: Math.ceil(remaining / 1000),
      elapsedMinutes: elapsed / 60000,
      finishedWhileAway: runtime.finishedWhileAway
    };
  }

  function emit(event) {
    var snap = snapshot();
    listeners.forEach(function (fn) {
      try { fn(snap, event || 'tick'); } catch (err) { if (global.console) console.error(err); }
    });
    return snap;
  }

  function startTicker() {
    stopTicker();
    interval = setInterval(function () {
      var snap = snapshot();
      if (snap.remainingMs <= 0) {
        stopTicker();
        runtime.accumulatedMs = runtime.durationMs;
        runtime.status = 'finished';
        runtime.startedAt = null;
        persist();
        emit('finished');
        return;
      }
      emit('tick');
    }, 1000);
  }
  function stopTicker() {
    if (interval) { clearInterval(interval); interval = null; }
  }

  /** Restore a run that was in progress when the page closed. */
  function init() {
    runtime = loadRuntime();
    if (runtime.status === 'running') {
      var snap = snapshot();
      if (snap.remainingMs <= 0) {
        runtime.accumulatedMs = runtime.durationMs;
        runtime.status = 'finished';
        runtime.startedAt = null;
        runtime.finishedWhileAway = true;
      } else {
        startTicker();
      }
    }
    if (runtime.status === 'idle' && runtime.accumulatedMs === 0) runtime = blank();
    return snapshot();
  }

  function setDuration(minutes) {
    var ms = Math.max(1, Number(minutes) || 20) * 60000;
    if (runtime.status === 'running') return snapshot();
    runtime.durationMs = ms;
    runtime.accumulatedMs = Math.min(runtime.accumulatedMs, ms);
    if (runtime.status === 'finished') runtime.status = 'idle';
    persist();
    return emit('duration');
  }

  function start(options) {
    var opts = options || {};
    if (opts.minutes) setDuration(opts.minutes);
    runtime.accumulatedMs = 0;
    runtime.startedAt = now();
    runtime.startedClock = runtime.startedAt;
    runtime.status = 'running';
    runtime.label = (opts.label !== undefined ? opts.label : runtime.label || '').slice(0, 90);
    runtime.habitId = opts.habitId !== undefined ? opts.habitId : runtime.habitId;
    runtime.finishedWhileAway = false;
    persist();
    startTicker();
    return emit('start');
  }

  function pause() {
    if (runtime.status !== 'running') return snapshot();
    runtime.accumulatedMs = elapsedMs();
    runtime.startedAt = null;
    runtime.status = 'paused';
    persist();
    stopTicker();
    return emit('pause');
  }

  function resume() {
    if (runtime.status === 'finished') return snapshot();
    runtime.status = 'running';
    runtime.startedAt = now();
    if (!runtime.startedClock) runtime.startedClock = runtime.startedAt;
    persist();
    startTicker();
    return emit('resume');
  }

  function reset() {
    var duration = runtime.durationMs;
    var label = runtime.label;
    runtime = blank();
    runtime.durationMs = duration;
    runtime.label = label;
    stopTicker();
    clearPersisted();
    return emit('reset');
  }

  /**
   * Finish a session. `consideredComplete` marks whether the planned length was
   * actually reached; a stopped-early session is recorded with its real minutes
   * and is not counted as a completed focus block.
   */
  function finish() {
    var snap = snapshot();
    var minutes = Math.round(snap.elapsedMs / 60000);
    var reached = snap.remainingMs <= 0 || snap.elapsedMs >= runtime.durationMs;
    if (minutes < 1 && !reached) {
      /* Too little time banked to be worth recording; keep it honest. */
      reset();
      return { recorded: false, minutes: 0, reached: false };
    }
    var session = {
      id: Afterglow.dom.uid('session'),
      label: runtime.label || '',
      habitId: runtime.habitId || null,
      plannedMinutes: Math.round(runtime.durationMs / 60000),
      minutes: Math.max(1, minutes),
      completed: reached,
      startedAt: runtime.startedClock ? new Date(runtime.startedClock).toISOString() : new Date().toISOString(),
      endedAt: new Date().toISOString()
    };
    Afterglow.store.update(function (state) {
      state.timer.sessions.push(session);
      state.timer.sessions = state.timer.sessions.slice(-500);
      state.timer.preset = session.plannedMinutes;
    }, 'timer-finish');
    runtime = blank();
    runtime.durationMs = session.plannedMinutes * 60000;
    stopTicker();
    clearPersisted();
    emit('saved');
    return { recorded: true, minutes: session.minutes, reached: reached, session: session };
  }

  function discard() {
    reset();
    return { recorded: false, discarded: true };
  }

  function sessions() {
    return Afterglow.store.state.timer.sessions.slice().sort(function (a, b) {
      return a.endedAt < b.endedAt ? 1 : -1;
    });
  }
  function totals() {
    return sessions().reduce(function (acc, session) {
      acc.minutes += session.minutes || 0;
      if (session.completed) acc.finished += 1;
      acc.count += 1;
      return acc;
    }, { minutes: 0, finished: 0, count: 0 });
  }
  /** Minutes logged for a given set of day keys (used by progress views). */
  function minutesByDay(dayKeys) {
    var map = {};
    dayKeys.forEach(function (day) { map[day] = 0; });
    sessions().forEach(function (session) {
      var day = session.endedAt ? Afterglow.dates.toKey(new Date(session.endedAt)) : null;
      if (day && map[day] !== undefined) map[day] += session.minutes || 0;
    });
    return map;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  Afterglow.timer = {
    init: init,
    snapshot: snapshot,
    elapsedMs: elapsedMs,
    start: start,
    pause: pause,
    resume: resume,
    reset: reset,
    finish: finish,
    discard: discard,
    setDuration: setDuration,
    sessions: sessions,
    totals: totals,
    minutesByDay: minutesByDay,
    subscribe: subscribe,
    isRunning: function () { return runtime && (runtime.status === 'running' || runtime.status === 'paused'); },
    isActive: function () { return runtime && runtime.status !== 'idle'; },
    preset: function () { return Math.round(runtime.durationMs / 60000); }
  };
})(typeof window !== 'undefined' ? window : this);
