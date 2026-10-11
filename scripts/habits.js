/* ==========================================================================
   habits.js — habit records, scheduling, logging and streaks.

   Two ideas worth stating plainly:
   - A day is only ever "missed" if it was scheduled and the calendar has moved
     past it. Future days and unscheduled days can never be missed.
   - Skipping is a rest day, not a failure. Rest days interrupt a streak
     without erasing the record, which is why `streak()` returns them
     separately instead of folding them into a "punishment" counter.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var D = Afterglow.dates;
  var S = Afterglow.store;

  function all() { return S.state.habits; }
  function byId(id) {
    var list = all();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /** Habits in the user's chosen display order. */
  function ordered(includeArchived) {
    var state = S.state;
    var out = state.order.map(byId).filter(Boolean);
    all().forEach(function (h) { if (out.indexOf(h) === -1) out.push(h); });
    if (!includeArchived) out = out.filter(function (h) { return !h.archived; });
    return out;
  }
  function scheduledOn(habit, dayKey) {
    if (!habit) return false;
    if (habit.schedule && habit.schedule.type === 'weekdays') {
      return habit.schedule.days.indexOf(D.weekdayOf(dayKey)) > -1;
    }
    return true;
  }
  function logFor(id, dayKey) {
    var logs = (S.state.logs[id] || {})[dayKey];
    return logs || null;
  }
  function skipFor(id, dayKey) {
    var skips = (S.state.skips[id] || {})[dayKey];
    return skips || null;
  }
  function isFuture(dayKey) { return D.diffDays(D.todayKey(), dayKey) > 0; }

  function targetValue(habit) {
    if (!habit || habit.targetType === 'check' || !habit.targetAmount) return 1;
    return Number(habit.targetAmount) || 1;
  }

  /**
   * How far the day's log got toward the habit's target. A measured habit that
   * was only partly done stays "partial" — it is progress, but it is never
   * counted as a completed habit.
   */
  function entryProgress(habit, dayKey) {
    var entry = logFor(habit.id, dayKey);
    if (!entry || !habit) return null;
    var target = targetValue(habit);
    var amount = Number(entry.amount) || 0;
    if (habit.targetType === 'check') return { amount: amount, target: 1, complete: true, ratio: 1 };
    return { amount: amount, target: target, complete: amount >= target, ratio: Math.min(1, target ? amount / target : 1) };
  }

  /** One of: done | partial | skipped | pending | rest | future. */
  function statusFor(habit, dayKey) {
    if (!habit) return 'rest';
    if (isFuture(dayKey)) return 'future';
    var progress = entryProgress(habit, dayKey);
    if (progress) return progress.complete ? 'done' : 'partial';
    if (skipFor(habit.id, dayKey)) return 'skipped';
    if (!scheduledOn(habit, dayKey)) return 'rest';
    return 'pending';
  }

  function targetLabel(habit) {
    var type = Afterglow.data.targetTypeById(habit.targetType);
    if (habit.targetType === 'check' || !habit.targetAmount) return 'Just a tick';
    return habit.targetAmount + ' ' + type.unit;
  }

  /** Completions for a habit, newest first, as {date, amount, at}. */
  function history(id, limit) {
    var logs = S.state.logs[id] || {};
    var out = Object.keys(logs).map(function (day) {
      return { date: day, amount: logs[day].amount, at: logs[day].at };
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return typeof limit === 'number' ? out.slice(0, limit) : out;
  }

  /* --- streak maths --------------------------------------------------------
     Walking backwards from `endKey`:
       done      -> streak + 1
       skipped   -> rest day, scan continues, no streak credit
       pending   -> today (still open) is neutral; any older day ends the scan
       rest/unscheduled -> skipped over entirely
     */
  function streak(habit, endKey) {
    var today = endKey || D.todayKey();
    var current = 0;
    var restDays = 0;
    var cursor = today;
    var guard = 0;

    while (cursor && guard++ < 1500) {
      var state = statusFor(habit, cursor);
      if (state === 'done') current++;
      else if (state === 'skipped') restDays++;
      else if ((state === 'pending' || state === 'partial') && cursor !== today) break;
      else if (state === 'pending' || state === 'partial') { /* open day, keep scanning */ }
      cursor = D.addDays(cursor, -1);
    }
    return { current: current, restDays: restDays };
  }

  function longestStreak(habit) {
    var logs = S.state.logs[habit.id] || {};
    var days = Object.keys(logs).sort();
    if (!days.length) return 0;
    var start = days[0];
    var today = D.todayKey();
    var best = 0;
    var run = 0;
    var cursor = start;
    var guard = 0;
    while (cursor && D.diffDays(cursor, today) >= 0 && guard++ < 4000) {
      var state = statusFor(habit, cursor);
      if (state === 'done') { run++; best = Math.max(best, run); }
      else if (state === 'skipped' || state === 'rest') { /* neutral */ }
      else run = 0;
      cursor = D.addDays(cursor, 1);
    }
    return best;
  }

  function totalCompletions(id) { return Object.keys(S.state.logs[id] || {}).length; }

  function daysSinceLastDone(id) {
    var list = history(id, 1);
    if (!list.length) return null;
    return D.diffDays(list[0].date, D.todayKey());
  }

  /* --- today's plan -------------------------------------------------------- */
  /** Habits scheduled today, split into still-open and already-finished. */
  function todayList(habitList) {
    var today = D.todayKey();
    var list = (habitList || ordered()).map(function (habit) {
      return { habit: habit, status: statusFor(habit, today), scheduled: scheduledOn(habit, today) };
    });
    return list;
  }

  function dayProgress(dayKey, habitList) {
    var list = habitList || ordered();
    var scheduled = 0, done = 0, skipped = 0, optionalDone = 0, partial = 0;
    list.forEach(function (habit) {
      var wasScheduled = scheduledOn(habit, dayKey);
      var status = statusFor(habit, dayKey);
      if (wasScheduled) {
        scheduled++;
        if (status === 'done') done++;
        if (status === 'skipped') skipped++;
        if (status === 'partial') partial++;
      } else if (status === 'done') optionalDone++;
    });
    var open = Math.max(0, scheduled - done - skipped);
    return {
      date: dayKey,
      scheduled: scheduled,
      done: done,
      skipped: skipped,
      partial: partial,
      open: open,
      optionalDone: optionalDone,
      ratio: scheduled ? done / scheduled : 0,
      finishedRatio: scheduled ? (done + skipped) / scheduled : 0
    };
  }

  /* --- mutations ----------------------------------------------------------- */
  function create(input) {
    var stamp = new Date().toISOString();
    var category = input.category || 'custom';
    var habit = {
      id: Afterglow.dom.uid('habit'),
      name: (input.name || 'New habit').slice(0, 90),
      description: (input.description || '').slice(0, 180),
      category: category,
      icon: input.icon || Afterglow.data.categoryById(category).icon,
      accent: input.accent || Afterglow.data.categoryById(category).accent,
      targetType: input.targetType || 'check',
      targetAmount: input.targetAmount === undefined || input.targetAmount === '' ? null : Number(input.targetAmount),
      schedule: input.schedule || { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
      reminder: (input.reminder || '').slice(0, 120),
      archived: false,
      createdAt: stamp
    };
    S.update(function (state) {
      state.habits.push(habit);
      state.order.push(habit.id);
    }, 'habit-create');
    return habit;
  }

  function edit(id, patch) {
    S.update(function (state) {
      state.habits = state.habits.map(function (habit) {
        if (habit.id !== id) return habit;
        var next = Object.assign({}, habit, patch);
        next.name = String(next.name || '').slice(0, 90) || habit.name;
        next.description = String(next.description || '').slice(0, 180);
        if (next.targetType === 'check') next.targetAmount = null;
        return next;
      });
    }, 'habit-edit');
  }

  function setArchived(id, archived) {
    S.update(function (state) {
      state.habits = state.habits.map(function (habit) {
        return habit.id === id ? Object.assign({}, habit, { archived: !!archived }) : habit;
      });
    }, archived ? 'habit-archive' : 'habit-unarchive');
  }

  function remove(id) {
    S.update(function (state) {
      state.habits = state.habits.filter(function (habit) { return habit.id !== id; });
      state.order = state.order.filter(function (oid) { return oid !== id; });
      delete state.logs[id];
      delete state.skips[id];
    }, 'habit-remove');
  }

  function move(id, delta) {
    S.update(function (state) {
      var order = state.order.filter(function (oid) { return state.habits.some(function (h) { return h.id === oid; }); });
      var index = order.indexOf(id);
      if (index === -1) return;
      var next = index + delta;
      if (next < 0 || next >= order.length) return;
      order.splice(index, 1);
      order.splice(next, 0, id);
      state.order = order;
    }, 'habit-move');
  }

  function reorder(ids) {
    S.update(function (state) {
      var known = state.habits.map(function (h) { return h.id; });
      var next = ids.filter(function (id) { return known.indexOf(id) > -1; });
      known.forEach(function (id) { if (next.indexOf(id) === -1) next.push(id); });
      state.order = next;
    }, 'habit-reorder');
  }

  /**
   * Record a completion. Keys are dates, so a habit can never hold two entries
   * for the same day — a second tap is an update, not a duplicate.
   */
  function complete(id, dayKey, amount) {
    var day = dayKey || D.todayKey();
    if (isFuture(day)) return false;
    var habit = byId(id);
    if (!habit) return false;
    var value = amount;
    if (value === undefined || value === null || value === '') {
      value = targetValue(habit);
    }
    S.update(function (state) {
      if (!state.logs[id]) state.logs[id] = {};
      state.logs[id][day] = { amount: Number(value) || 0, at: new Date().toISOString() };
      if (state.skips[id]) delete state.skips[id][day];
    }, 'habit-complete');
    return true;
  }

  /** Add to a day's total without creating a second entry for that date. */
  function addAmount(id, dayKey, amount) {
    var day = dayKey || D.todayKey();
    var habit = byId(id);
    if (!habit || isFuture(day)) return false;
    var value = Number(amount) || 0;
    if (value <= 0) return false;
    S.update(function (state) {
      if (!state.logs[id]) state.logs[id] = {};
      var existing = state.logs[id][day] ? Number(state.logs[id][day].amount) || 0 : 0;
      state.logs[id][day] = { amount: existing + value, at: new Date().toISOString() };
      if (state.skips[id]) delete state.skips[id][day];
    }, 'habit-add-amount');
    return true;
  }

  function uncomplete(id, dayKey) {
    var day = dayKey || D.todayKey();
    S.update(function (state) {
      if (state.logs[id] && state.logs[id][day]) delete state.logs[id][day];
      if (state.logs[id] && !Object.keys(state.logs[id]).length) delete state.logs[id];
    }, 'habit-uncomplete');
  }

  function skip(id, dayKey) {
    var day = dayKey || D.todayKey();
    if (isFuture(day)) return false;
    S.update(function (state) {
      if (!state.skips[id]) state.skips[id] = {};
      state.skips[id][day] = new Date().toISOString();
      if (state.logs[id] && state.logs[id][day]) delete state.logs[id][day];
    }, 'habit-skip');
    return true;
  }

  function unskip(id, dayKey) {
    var day = dayKey || D.todayKey();
    S.update(function (state) {
      if (state.skips[id] && state.skips[id][day]) delete state.skips[id][day];
      if (state.skips[id] && !Object.keys(state.skips[id]).length) delete state.skips[id];
    }, 'habit-unskip');
  }

  /** Flip done/not-done, the action behind a checklist tick. */
  function toggle(id, dayKey) {
    var day = dayKey || D.todayKey();
    var habit = byId(id);
    if (!habit) return null;
    var progress = entryProgress(habit, day);
    if (progress && progress.complete) { uncomplete(id, day); return 'undone'; }
    if (habit.targetType !== 'check' && habit.targetAmount) return 'needs-amount';
    complete(id, day);
    return 'done';
  }

  /** Everything the user has recorded, for export and for the wins archive. */
  function completionCount(dayKey) {
    var total = 0;
    Object.keys(S.state.logs).forEach(function (id) {
      if (S.state.logs[id][dayKey]) total++;
    });
    return total;
  }

  /** Completions within a set of days, for charts and the constellation. */
  function rangeStats(dayKeys) {
    var map = {};
    dayKeys.forEach(function (day) { map[day] = 0; });
    Object.keys(S.state.logs).forEach(function (id) {
      Object.keys(S.state.logs[id]).forEach(function (day) {
        if (map[day] !== undefined) map[day] += 1;
      });
    });
    return map;
  }

  /* --- small wins ----------------------------------------------------------
     A quiet archive of things that actually happened, written by the user or
     offered after a tiny action. Nothing is invented. */
  var wins = {
    add: function (text, source, dateKey) {
      var clean = String(text || '').trim().slice(0, 300);
      if (!clean) return null;
      var win = {
        id: Afterglow.dom.uid('win'),
        date: dateKey || D.todayKey(),
        text: clean,
        source: source || 'manual',
        createdAt: new Date().toISOString()
      };
      S.update(function (state) { state.wins.push(win); }, 'win-add');
      return win;
    },
    remove: function (id) {
      S.update(function (state) { state.wins = state.wins.filter(function (w) { return w.id !== id; }); }, 'win-remove');
    },
    all: function () {
      return S.state.wins.slice().sort(function (a, b) {
        if (a.date === b.date) return a.createdAt < b.createdAt ? 1 : -1;
        return a.date < b.date ? 1 : -1;
      });
    },
    forDate: function (dayKey) {
      return wins.all().filter(function (w) { return w.date === dayKey; });
    },
    count: function () { return S.state.wins.length; }
  };

  Afterglow.habits = {
    all: all,
    byId: byId,
    ordered: ordered,
    scheduledOn: scheduledOn,
    statusFor: statusFor,
    targetLabel: targetLabel,
    targetValue: targetValue,
    entryProgress: entryProgress,
    history: history,
    streak: streak,
    longestStreak: longestStreak,
    totalCompletions: totalCompletions,
    daysSinceLastDone: daysSinceLastDone,
    todayList: todayList,
    dayProgress: dayProgress,
    completionCount: completionCount,
    rangeStats: rangeStats,
    create: create,
    edit: edit,
    setArchived: setArchived,
    remove: remove,
    move: move,
    reorder: reorder,
    complete: complete,
    addAmount: addAmount,
    uncomplete: uncomplete,
    skip: skip,
    unskip: unskip,
    toggle: toggle,
    logFor: logFor,
    skipFor: skipFor
  };
  Afterglow.wins = wins;
})(typeof window !== 'undefined' ? window : this);
