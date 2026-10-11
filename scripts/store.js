/* ==========================================================================
   store.js — the single source of truth.

   Everything Afterglow knows lives in one versioned JSON document under the
   localStorage key "afterglow:data". Nothing leaves the browser.

   Migration strategy
   ------------------
   `state.schemaVersion` marks the shape of the document. `MIGRATIONS` is keyed
   by the version being upgraded *from*, so adding a future schema is a matter
   of writing one function and bumping SCHEMA_VERSION. Anything stored without a
   version (or a version newer than this build understands) is either upgraded
   step by step or — for newer documents — refused rather than silently mangled.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var SCHEMA_VERSION = 1;
  var KEY = 'afterglow:data';

  /* Upgrade steps. Each receives the raw stored object and returns a new one. */
  var MIGRATIONS = {
    /* 0 -> 1: pre-versioned development builds kept completions in a flat
       `completed` map instead of per-habit logs. Normalise it. */
    0: function (legacy) {
      var next = legacy || {};
      if (next.completed && typeof next.completed === 'object' && !next.logs) {
        var logs = {};
        Object.keys(next.completed).forEach(function (habitId) {
          var days = next.completed[habitId] || {};
          logs[habitId] = {};
          Object.keys(days).forEach(function (day) {
            logs[habitId][day] = { amount: typeof days[day] === 'number' ? days[day] : 1, at: new Date().toISOString() };
          });
        });
        next.logs = logs;
        delete next.completed;
      }
      if (next.order && next.habits && !next.order.length) next.order = next.habits.map(function (h) { return h.id; });
      next.schemaVersion = 1;
      return next;
    }
  };

  var listeners = [];
  var saveTimer = null;
  var storageWorks = true;

  try {
    var probe = '__afterglow_probe__';
    global.localStorage.setItem(probe, '1');
    global.localStorage.removeItem(probe);
  } catch (err) {
    storageWorks = false;
  }

  /* --- small helpers ------------------------------------------------------- */
  function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return isObject(v) ? v : {}; }
  function str(v, fallback) { return typeof v === 'string' ? v : (fallback || ''); }
  function num(v, fallback, min, max) {
    var n = typeof v === 'number' && isFinite(v) ? v : parseFloat(v);
    if (!isFinite(n)) n = fallback;
    if (typeof min === 'number') n = Math.max(min, n);
    if (typeof max === 'number') n = Math.min(max, n);
    return n;
  }
  function bool(v, fallback) { return typeof v === 'boolean' ? v : fallback; }
  function isDayKey(key) { return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key); }

  var DATE_OK = Afterglow.dates ? Afterglow.dates.isValidKey : function () { return true; };
  function saneDay(key) { return isDayKey(key) && DATE_OK(key); }

  /* --- sanitising ---------------------------------------------------------
     Any document coming from storage or an imported file passes through here.
     Unknown keys are dropped so a corrupted file cannot inject surprises. */
  function sanitize(raw) {
    var base = Afterglow.data.defaultState();
    var input = obj(raw);
    var out = base;

    out.schemaVersion = SCHEMA_VERSION;
    out.createdAt = str(input.createdAt, base.createdAt);
    out.updatedAt = new Date().toISOString();

    var profile = obj(input.profile);
    out.profile = {
      onboarded: bool(profile.onboarded, false),
      name: str(profile.name, '').slice(0, 60),
      focus: ['balanced', 'studies', 'health', 'confidence', 'routines'].indexOf(profile.focus) > -1 ? profile.focus : 'balanced',
      budget: num(profile.budget, 20, 5, 120),
      dayStart: /^\d{2}:\d{2}$/.test(str(profile.dayStart)) ? profile.dayStart : '07:00'
    };

    var settings = obj(input.settings);
    out.settings = {
      theme: settings.theme === 'light' ? 'light' : 'dark',
      motion: ['system', 'on', 'off'].indexOf(settings.motion) > -1 ? settings.motion : 'system',
      weekStart: settings.weekStart === 0 ? 0 : 1,
      confirmDestructive: bool(settings.confirmDestructive, true),
      showAtmosphere: bool(settings.showAtmosphere, true)
    };

    /* Habits: keep only well-formed entries, and never trust ids to be unique. */
    var seenIds = {};
    out.habits = arr(input.habits).map(function (rawHabit) {
      var habit = obj(rawHabit);
      var id = str(habit.id) || (Afterglow.dom ? Afterglow.dom.uid('habit') : 'habit-' + Math.random().toString(36).slice(2));
      if (seenIds[id]) id = id + '-' + Math.random().toString(36).slice(2, 6);
      seenIds[id] = true;
      var schedule = obj(habit.schedule);
      var days = arr(schedule.days).map(function (d) { return num(d, 0, 0, 6); })
        .filter(function (d, i, list) { return list.indexOf(d) === i; });
      var categoryIds = Afterglow.data.CATEGORIES.map(function (c) { return c.id; });
      var typeIds = Afterglow.data.TARGET_TYPES.map(function (t) { return t.id; });
      return {
        id: id,
        name: str(habit.name, 'Untitled habit').slice(0, 90),
        description: str(habit.description, '').slice(0, 180),
        category: categoryIds.indexOf(habit.category) > -1 ? habit.category : 'custom',
        icon: str(habit.icon, 'spark').slice(0, 24),
        accent: str(habit.accent, 'amber').slice(0, 16),
        targetType: typeIds.indexOf(habit.targetType) > -1 ? habit.targetType : 'check',
        targetAmount: habit.targetAmount === null || habit.targetAmount === undefined ? null : num(habit.targetAmount, 1, 0.1, 100000),
        schedule: {
          type: schedule.type === 'weekdays' ? 'weekdays' : 'daily',
          days: days.length ? days : [0, 1, 2, 3, 4, 5, 6]
        },
        reminder: str(habit.reminder, '').slice(0, 120),
        archived: bool(habit.archived, false),
        createdAt: str(habit.createdAt, new Date().toISOString())
      };
    });

    var habitIds = out.habits.map(function (h) { return h.id; });
    var ordered = arr(input.order).filter(function (id) { return habitIds.indexOf(id) > -1; });
    habitIds.forEach(function (id) { if (ordered.indexOf(id) === -1) ordered.push(id); });
    out.order = ordered;

    /* Logs and skips: only real dates, only known habits, no orphan data. */
    var rawLogs = obj(input.logs);
    out.logs = {};
    habitIds.forEach(function (id) {
      var days = obj(rawLogs[id]);
      var clean = {};
      Object.keys(days).forEach(function (day) {
        if (!saneDay(day)) return;
        var entry = obj(days[day]);
        clean[day] = {
          amount: num(entry.amount, 1, 0, 100000),
          at: str(entry.at, new Date().toISOString())
        };
      });
      if (Object.keys(clean).length) out.logs[id] = clean;
    });

    var rawSkips = obj(input.skips);
    out.skips = {};
    habitIds.forEach(function (id) {
      var days = obj(rawSkips[id]);
      var clean = {};
      Object.keys(days).forEach(function (day) { if (saneDay(day)) clean[day] = str(days[day], new Date().toISOString()); });
      if (Object.keys(clean).length) out.skips[id] = clean;
    });

    /* Daily flow */
    var flow = obj(input.flow);
    out.flow = {
      plan: arr(flow.plan).map(function (rawBlock) {
        var block = obj(rawBlock);
        return {
          id: str(block.id) || (Afterglow.dom ? Afterglow.dom.uid('block') : 'block-' + Math.random().toString(36).slice(2)),
          title: str(block.title, 'Block').slice(0, 80),
          text: str(block.text, '').slice(0, 200),
          minutes: num(block.minutes, 5, 1, 240),
          category: str(block.category, 'custom').slice(0, 24)
        };
      }),
      planBudget: num(flow.planBudget, out.profile.budget, 5, 120),
      minimum: {
        enabled: bool(obj(flow.minimum).enabled, true),
        blocks: arr(obj(flow.minimum).blocks).map(function (rawBlock) {
          var block = obj(rawBlock);
          return {
            id: str(block.id) || (Afterglow.dom ? Afterglow.dom.uid('min') : 'min-' + Math.random().toString(36).slice(2)),
            title: str(block.title, 'Small block').slice(0, 80),
            text: str(block.text, '').slice(0, 200),
            minutes: num(block.minutes, 3, 1, 60),
            category: str(block.category, 'custom').slice(0, 24)
          };
        })
      },
      done: (function () {
        var done = obj(flow.done);
        var clean = {};
        Object.keys(done).forEach(function (day) {
          if (!saneDay(day)) return;
          clean[day] = arr(done[day]).filter(function (v) { return typeof v === 'string'; });
        });
        return clean;
      })()
    };

    /* Timer sessions */
    var timer = obj(input.timer);
    out.timer = {
      preset: num(timer.preset, 20, 1, 240),
      sessions: arr(timer.sessions).slice(-500).map(function (rawSession) {
        var session = obj(rawSession);
        return {
          id: str(session.id) || (Afterglow.dom ? Afterglow.dom.uid('session') : 'session-' + Math.random().toString(36).slice(2)),
          label: str(session.label, '').slice(0, 90),
          habitId: typeof session.habitId === 'string' ? session.habitId : null,
          plannedMinutes: num(session.plannedMinutes, 20, 1, 600),
          minutes: num(session.minutes, 0, 0, 1440),
          completed: bool(session.completed, false),
          startedAt: str(session.startedAt, ''),
          endedAt: str(session.endedAt, '')
        };
      }).filter(function (s) { return s.minutes >= 0; })
    };

    /* Journey */
    var journey = obj(input.journey);
    out.journey = {
      active: bool(journey.active, false),
      startedAt: saneDay(journey.startedAt) ? journey.startedAt : null,
      pausedAt: saneDay(journey.pausedAt) ? journey.pausedAt : null,
      skipped: bool(journey.skipped, false),
      days: (function () {
        /* Keyed by journey day index (0-29), not by calendar date, so a restart
           starts clean while the calendar keeps its own records. */
        var days = obj(journey.days);
        var clean = {};
        Object.keys(days).forEach(function (key) {
          if (!/^\d{1,2}$/.test(key)) return;
          var index = Number(key);
          if (index < 0 || index > 29) return;
          var entry = obj(days[key]);
          clean[key] = {
            done: bool(entry.done, false),
            date: saneDay(entry.date) ? entry.date : '',
            note: str(entry.note, '').slice(0, 400)
          };
        });
        return clean;
      })()
    };

    /* Journal */
    out.journal = arr(input.journal).slice(-1000).map(function (rawEntry) {
      var entry = obj(rawEntry);
      return {
        id: str(entry.id) || (Afterglow.dom ? Afterglow.dom.uid('entry') : 'entry-' + Math.random().toString(36).slice(2)),
        date: saneDay(entry.date) ? entry.date : (Afterglow.dates ? Afterglow.dates.todayKey() : '1970-01-01'),
        prompt: str(entry.prompt, '').slice(0, 200),
        text: str(entry.text, '').slice(0, 8000),
        mood: entry.mood === null || entry.mood === undefined ? null : num(entry.mood, 3, 1, 5),
        energy: entry.energy === null || entry.energy === undefined ? null : num(entry.energy, 3, 1, 5),
        createdAt: str(entry.createdAt, new Date().toISOString()),
        updatedAt: str(entry.updatedAt, new Date().toISOString())
      };
    });

    /* Small wins */
    out.wins = arr(input.wins).slice(-1000).map(function (rawWin) {
      var win = obj(rawWin);
      return {
        id: str(win.id) || (Afterglow.dom ? Afterglow.dom.uid('win') : 'win-' + Math.random().toString(36).slice(2)),
        date: saneDay(win.date) ? win.date : (Afterglow.dates ? Afterglow.dates.todayKey() : '1970-01-01'),
        text: str(win.text, '').slice(0, 300),
        source: str(win.source, 'manual').slice(0, 40),
        createdAt: str(win.createdAt, new Date().toISOString())
      };
    });

    /* Motivation memory (which ideas were shown recently) */
    var motivation = obj(input.motivation);
    out.motivation = {
      recent: arr(motivation.recent).filter(function (v) { return typeof v === 'string'; }).slice(-12),
      lastShownAt: str(motivation.lastShownAt, '') || null
    };

    /* Checklists: id -> day -> array of item ids */
    var checklists = obj(input.checklists);
    out.checklists = {};
    Object.keys(checklists).forEach(function (listId) {
      var days = obj(checklists[listId]);
      var clean = {};
      Object.keys(days).forEach(function (day) {
        if (!saneDay(day)) return;
        clean[day] = arr(days[day]).filter(function (v) { return typeof v === 'string'; });
      });
      if (Object.keys(clean).length) out.checklists[listId] = clean;
    });

    /* Study tasks */
    out.tasks = arr(input.tasks).slice(-300).map(function (rawTask) {
      var task = obj(rawTask);
      return {
        id: str(task.id) || (Afterglow.dom ? Afterglow.dom.uid('task') : 'task-' + Math.random().toString(36).slice(2)),
        text: str(task.text, '').slice(0, 240),
        done: bool(task.done, false),
        createdAt: str(task.createdAt, new Date().toISOString())
      };
    }).filter(function (t) { return t.text.trim().length > 0; });

    /* Future-me goals */
    out.goals = arr(input.goals).slice(-200).map(function (rawGoal) {
      var goal = obj(rawGoal);
      return {
        id: str(goal.id) || (Afterglow.dom ? Afterglow.dom.uid('goal') : 'goal-' + Math.random().toString(36).slice(2)),
        title: str(goal.title, '').slice(0, 160),
        horizon: str(goal.horizon, '').slice(0, 60),
        next: str(goal.next, '').slice(0, 200),
        createdAt: str(goal.createdAt, new Date().toISOString())
      };
    }).filter(function (g) { return g.title.trim().length > 0; });

    /* Small free-text notes (sleep intention, study intention, future-me notes) */
    var notes = obj(input.notes);
    out.notes = {};
    Object.keys(notes).slice(0, 24).forEach(function (key) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(key)) return;
      var value = str(notes[key], '').slice(0, 2000);
      if (value) out.notes[key] = value;
    });

    /* Confidence challenges completed per day */
    var confidence = obj(input.confidence);
    out.confidence = {};
    Object.keys(confidence).forEach(function (day) {
      if (saneDay(day)) out.confidence[day] = str(confidence[day], '');
    });

    out.future = { notes: str(obj(input.future).notes, '').slice(0, 4000) };
    out.sunday = { dismissedFor: saneDay(obj(input.sunday).dismissedFor) ? obj(input.sunday).dismissedFor : '' };
    out.meta = {
      seeded: bool(obj(input.meta).seeded, false),
      storageNoteSeen: bool(obj(input.meta).storageNoteSeen, false)
    };
    return out;
  }

  /* --- loading and saving -------------------------------------------------- */
  function applyMigrations(raw) {
    var doc = obj(raw);
    var version = num(doc.schemaVersion, 0, 0, 9999);
    if (version > SCHEMA_VERSION) {
      return { ok: false, reason: 'newer', version: version, doc: doc };
    }
    var guard = 0;
    while (version < SCHEMA_VERSION && guard++ < 50) {
      var step = MIGRATIONS[version];
      if (!step) break;
      doc = step(doc) || doc;
      version = num(doc.schemaVersion, version + 1, version, 9999);
    }
    return { ok: true, version: version, doc: doc };
  }

  var state = null;

  function load() {
    var raw = null;
    if (storageWorks) {
      try { raw = global.localStorage.getItem(KEY); } catch (err) { raw = null; }
    }
    if (!raw) { state = Afterglow.data.defaultState(); return { state: state, fresh: true, recovered: false }; }

    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (err) { parsed = null; }

    if (!parsed || typeof parsed !== 'object') {
      /* Keep a copy of unreadable data instead of destroying it silently. */
      try { global.localStorage.setItem(KEY + ':corrupt', raw); } catch (e) {}
      state = Afterglow.data.defaultState();
      return { state: state, fresh: true, recovered: true };
    }

    var result = applyMigrations(parsed);
    if (!result.ok) {
      state = Afterglow.data.defaultState();
      return { state: state, fresh: true, recovered: true, newerSchema: result.version };
    }
    state = sanitize(result.doc);
    return { state: state, fresh: false, recovered: false };
  }

  function persist() {
    state.updatedAt = new Date().toISOString();
    if (!storageWorks) return false;
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      /* Most likely QuotaExceededError — surface it once per failure. */
      notify({ reason: 'save-failed', error: err });
      return false;
    }
  }

  function save(options) {
    var opts = options || {};
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (opts.immediate) return persist();
    saveTimer = setTimeout(function () { saveTimer = null; persist(); }, 160);
    return true;
  }

  function notify(info) {
    listeners.forEach(function (fn) {
      try { fn(state, info || {}); } catch (err) {
        if (global.console && console.error) console.error('Afterglow: listener failed', err);
      }
    });
  }

  /** Mutate the state through a function, then save and notify. */
  function update(mutator, reason) {
    if (typeof mutator === 'function') {
      var result = mutator(state);
      if (result && result !== state) state = result;
    }
    save();
    notify({ reason: reason || 'update' });
    return state;
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  /* --- first-run seeding --------------------------------------------------- */
  function seedContent(profile) {
    var prefs = profile || state.profile;
    var stamp = new Date().toISOString();
    var starters = Afterglow.data.generateStarterHabits(prefs);
    var habits = starters.map(function (raw, index) {
      return sanitizeHabit(raw, index, stamp);
    });
    state.habits = habits;
    state.order = habits.map(function (h) { return h.id; });
    state.flow.plan = flowPlanFor(prefs.budget);
    state.flow.planBudget = prefs.budget;
    state.flow.minimum.blocks = Afterglow.data.MINIMUM_DAY.map(function (block) {
      return { id: block.id, title: block.title, text: block.text, minutes: block.minutes, category: block.category };
    });
    state.goals = [];
    state.meta.seeded = true;
    save({ immediate: true });
    return habits;
  }

  function sanitizeHabit(raw, index, stamp) {
    var category = raw.category || 'custom';
    var accent = raw.accent || (Afterglow.data.categoryById(category).accent);
    return {
      id: (Afterglow.dom ? Afterglow.dom.uid('habit') : 'habit-' + Date.now().toString(36) + index),
      name: raw.name,
      description: raw.description || '',
      category: category,
      icon: raw.icon || Afterglow.data.categoryById(category).icon,
      accent: accent,
      targetType: raw.targetType || 'check',
      targetAmount: raw.targetAmount === undefined ? null : raw.targetAmount,
      schedule: raw.schedule || { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
      reminder: raw.reminder || '',
      archived: false,
      createdAt: stamp
    };
  }

  function flowPlanFor(budget) {
    var plan = Afterglow.data.FLOW_PLANS[budget] || Afterglow.data.FLOW_PLANS[20];
    return plan.map(function (block) {
      return {
        id: Afterglow.dom ? Afterglow.dom.uid('block') : 'block-' + Math.random().toString(36).slice(2),
        title: block.title,
        text: block.text,
        minutes: block.minutes,
        category: block.category
      };
    });
  }

  /* --- import / export ----------------------------------------------------- */
  function exportDocument() {
    return {
      app: 'afterglow',
      appVersion: '1.0.0',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      note: 'Local Afterglow backup. Contains personal notes — keep it private.',
      data: state
    };
  }

  /**
   * Validate an imported file. Returns {ok, data, error, warnings}.
   * A document is accepted whole and sanitised before it touches the app.
   */
  function parseImport(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (err) { return { ok: false, error: 'That file is not valid JSON, so nothing was imported.' }; }
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'That file does not look like an Afterglow backup.' };

    var payload = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (parsed.app && parsed.app !== 'afterglow') return { ok: false, error: 'That backup was made by a different app.' };
    if (!Array.isArray(payload.habits) && !Array.isArray(payload.journal) && !Array.isArray(payload.wins)) {
      return { ok: false, error: 'This backup has no habits, journal or small wins to restore.' };
    }

    /* The version may sit on the wrapper (exported files) or on the payload
       itself (a raw data dump). Check both before touching anything. */
    var declared = parsed.schemaVersion !== undefined ? parsed.schemaVersion : payload.schemaVersion;
    var declaredVersion = num(declared, 0, 0, 9999);
    if (declaredVersion > SCHEMA_VERSION) {
      return { ok: false, error: 'This backup was written by a newer version of Afterglow, so it was not imported. Update the site, then try again.' };
    }

    var migrated = applyMigrations(payload);
    if (!migrated.ok) return { ok: false, error: 'This backup could not be upgraded to the current format, so nothing was imported.' };

    var warnings = [];
    if (declaredVersion && declaredVersion !== SCHEMA_VERSION) warnings.push('The backup used schema v' + declaredVersion + ' and was upgraded to v' + SCHEMA_VERSION + '.');
    if (typeof declared !== 'number') warnings.push('The backup had no schema version and was treated as the earliest format.');

    return { ok: true, data: sanitize(migrated.doc), warnings: warnings };
  }

  function replaceWith(data) {
    state = sanitize(data);
    state.meta.seeded = true;
    save({ immediate: true });
    notify({ reason: 'import' });
    return state;
  }

  function mergeWith(data) {
    var incoming = sanitize(data);
    var existingIds = {};
    state.habits.forEach(function (h) { existingIds[h.id] = true; });
    incoming.habits.forEach(function (habit) {
      if (existingIds[habit.id]) {
        habit.id = Afterglow.dom ? Afterglow.dom.uid('habit') : 'habit-' + Math.random().toString(36).slice(2);
        habit.name += ' (imported)';
      }
      state.habits.push(habit);
      state.order.push(habit.id);
    });
    Object.keys(incoming.logs).forEach(function (id) {
      if (!state.logs[id]) state.logs[id] = {};
      Object.keys(incoming.logs[id]).forEach(function (day) {
        if (!state.logs[id][day]) state.logs[id][day] = incoming.logs[id][day];
      });
    });
    Object.keys(incoming.skips).forEach(function (id) {
      if (!state.skips[id]) state.skips[id] = {};
      Object.keys(incoming.skips[id]).forEach(function (day) {
        if (!state.skips[id][day]) state.skips[id][day] = incoming.skips[id][day];
      });
    });
    var journalKeys = {};
    state.journal.forEach(function (e) { journalKeys[e.id] = true; });
    incoming.journal.forEach(function (e) { if (!journalKeys[e.id]) state.journal.push(e); });
    var winKeys = {};
    state.wins.forEach(function (w) { winKeys[w.id] = true; });
    incoming.wins.forEach(function (w) { if (!winKeys[w.id]) state.wins.push(w); });
    var taskKeys = {};
    state.tasks.forEach(function (t) { taskKeys[t.id] = true; });
    incoming.tasks.forEach(function (t) { if (!taskKeys[t.id]) state.tasks.push(t); });
    incoming.goals.forEach(function (g) { state.goals.push(g); });
    incoming.timer.sessions.forEach(function (session) {
      if (!state.timer.sessions.some(function (s) { return s.id === session.id; })) state.timer.sessions.push(session);
    });
    Object.keys(incoming.confidence).forEach(function (day) {
      if (!state.confidence[day]) state.confidence[day] = incoming.confidence[day];
    });
    state.journal.sort(function (a, b) { return (a.date < b.date ? -1 : 1); });
    save({ immediate: true });
    notify({ reason: 'import-merge' });
    return state;
  }

  function clearAll() {
    state = Afterglow.data.defaultState();
    safeRemove(KEY);
    save({ immediate: true });
    notify({ reason: 'clear-all' });
    return state;
  }

  function clearSamples() {
    state.habits = [];
    state.order = [];
    state.logs = {};
    state.skips = {};
    state.flow.plan = flowPlanFor(state.profile.budget);
    state.flow.done = {};
    state.timer.sessions = [];
    state.journey = { active: false, startedAt: null, pausedAt: null, days: {}, skipped: false };
    state.meta.seeded = false;
    save({ immediate: true });
    notify({ reason: 'clear-samples' });
    return state;
  }

  function safeRemove(key) {
    try { global.localStorage.removeItem(key); } catch (err) { /* ignore */ }
  }

  /* Flush pending writes when the tab is hidden or closed. */
  global.addEventListener('visibilitychange', function () {
    if (global.document.visibilityState === 'hidden') save({ immediate: true });
  });
  global.addEventListener('beforeunload', function () { if (saveTimer) save({ immediate: true }); });

  Afterglow.store = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    KEY: KEY,
    MIGRATIONS: MIGRATIONS,
    available: storageWorks,
    get state() { return state; },
    init: function () { return load(); },
    sanitize: sanitize,
    applyMigrations: applyMigrations,
    save: save,
    update: update,
    subscribe: subscribe,
    seedContent: seedContent,
    flowPlanFor: flowPlanFor,
    exportDocument: exportDocument,
    parseImport: parseImport,
    replaceWith: replaceWith,
    mergeWith: mergeWith,
    clearAll: clearAll,
    clearSamples: clearSamples
  };
})(typeof window !== 'undefined' ? window : this);
