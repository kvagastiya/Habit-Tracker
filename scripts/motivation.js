/* ==========================================================================
   motivation.js — the decision layer behind "I have no motivation".

   No network, no language model: a curated bank of tiny actions, weighted by
   what the user actually has open today, what time it is, and what they were
   shown recently. The engine never invents tasks that are not in the bank, and
   the ladder means there is always a smaller rung to step down to.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var D = Afterglow.dates;

  var FOCUS_CATEGORY = {
    studies: 'study',
    health: 'movement',
    confidence: 'confidence',
    routines: 'sleep',
    balanced: ''
  };

  function bank() { return Afterglow.data.TINY_ACTIONS; }
  function actionById(id) {
    var list = bank();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function recentIds() { return Afterglow.store.state.motivation.recent || []; }

  /** Habits that are still open today, with their category. */
  function openHabits() {
    var today = D.todayKey();
    return Afterglow.habits.ordered().filter(function (habit) {
      return Afterglow.habits.scheduledOn(habit, today) &&
        Afterglow.habits.statusFor(habit, today) !== 'done';
    });
  }

  function minutesAvailable() {
    return Afterglow.store.state.profile.budget || 20;
  }

  /**
   * Score every action for the current moment, then choose among the best.
   * Deterministic rules, random tie-break: the same context can yield a
   * different idea next time without ever feeling random.
   */
  function candidates(context) {
    var ctx = context || {};
    var hour = typeof ctx.hour === 'number' ? ctx.hour : new Date().getHours();
    var profile = Afterglow.store.state.profile;
    var focusCategory = FOCUS_CATEGORY[profile.focus] || '';
    var open = openHabits();
    var openCategories = open.map(function (habit) { return habit.category; });
    var recent = recentIds();
    var today = D.todayKey();
    var doneToday = Afterglow.habits.dayProgress(today).done;
    var completedAnythingToday = doneToday > 0 || Afterglow.habits.completionCount(today) > 0;

    return bank().map(function (action) {
      var score = 0;
      var reasons = [];
      if (openCategories.indexOf(action.category) > -1) { score += 6; reasons.push('habit-open'); }
      if (focusCategory && action.category === focusCategory) { score += 2; reasons.push('focus'); }
      if (hour >= 21 || hour < 5) {
        if (action.category === 'sleep') { score += 5; reasons.push('late'); }
        if (action.category === 'rest' || action.category === 'wellbeing') { score += 3; reasons.push('late-calm'); }
        if (action.category === 'movement' || action.category === 'study') { score -= 2; }
      } else if (hour >= 5 && hour < 12) {
        if (action.category === 'study' || action.category === 'movement') { score += 2; reasons.push('morning'); }
      } else if (hour >= 17 && hour < 21) {
        if (action.category === 'order' || action.category === 'wellbeing') { score += 1; }
      }
      if (!completedAnythingToday && (action.category === 'study' || action.category === 'movement')) {
        score += 1;
        reasons.push('nothing-yet');
      }
      if (action.seconds <= 180) score += 1;
      var recentIndex = recent.indexOf(action.id);
      if (recentIndex > -1) score -= 12 - recentIndex; // the newer it was shown, the harder to repeat
      if (recent[recent.length - 1] === action.id) score -= 20;
      return { action: action, score: score, reasons: reasons };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function weightedPick(list, rng) {
    if (!list.length) return null;
    var pool = list.slice(0, Math.min(4, list.length));
    var r = typeof rng === 'function' ? rng() : Math.random();
    var index = Math.floor(r * pool.length) % pool.length;
    return pool[index];
  }

  function recordShown(id) {
    Afterglow.store.update(function (state) {
      var recent = state.motivation.recent || [];
      recent = recent.filter(function (existing) { return existing !== id; });
      recent.push(id);
      state.motivation.recent = recent.slice(-8);
      state.motivation.lastShownAt = new Date().toISOString();
    }, 'motivation-shown');
  }

  function comfortLine(rng) {
    return Afterglow.dom.pick(Afterglow.data.COMFORT_LINES, rng) || Afterglow.data.COMFORT_LINES[0];
  }

  /**
   * Build one suggestion object:
   * {id, category, title, hint, rung, rungCount, seconds, comfort, reason, isRest}
   */
  function suggestion(options) {
    var opts = options || {};
    var list = candidates(opts.context);
    var exclude = opts.exclude || [];
    var filtered = list.filter(function (item) { return exclude.indexOf(item.action.id) === -1; });
    var chosen = weightedPick(filtered.length ? filtered : list, opts.rng);
    if (!chosen) return null;
    var action = chosen.action;
    var rung = 0;
    var entry = action.ladder[rung];
    if (opts.context && opts.context.forceSmall) {
      rung = action.ladder.length - 1;
      entry = action.ladder[rung];
    }
    recordShown(action.id);
    return {
      id: action.id,
      category: action.category,
      hint: action.hint,
      rung: rung,
      rungCount: action.ladder.length,
      title: entry.title,
      seconds: entry.seconds,
      comfort: comfortLine(opts.rng),
      reason: chosen.reasons,
      isRest: action.category === 'rest' || action.category === 'sleep',
      matchHabitId: matchHabit(action.category)
    };
  }

  /** Step one rung down the ladder. Returns null when there is no rung left. */
  function shrink(current) {
    if (!current) return null;
    var action = actionById(current.id);
    if (!action) return null;
    var nextRung = Math.min(current.rung + 1, action.ladder.length - 1);
    if (nextRung === current.rung && current.rung >= action.ladder.length - 1) return null;
    var entry = action.ladder[nextRung];
    return Object.assign({}, current, {
      rung: nextRung,
      title: entry.title,
      seconds: entry.seconds
    });
  }
  function isSmallest(current) {
    var action = actionById(current.id);
    return !!action && current.rung >= action.ladder.length - 1;
  }

  /** The best-matching open habit for a category, if one exists. */
  function matchHabit(category) {
    var open = openHabits();
    var exact = open.filter(function (h) { return h.category === category; });
    if (exact.length) return exact[0].id;
    return null;
  }

  /**
   * Can this action honestly be recorded against a habit?
   * A tick habit can be completed only if the action belongs to its category.
   * A measured habit is offered as a partial log when the duration falls short,
   * which is never treated as a completed habit.
   */
  function recordingOptions(current) {
    if (!current) return { habits: [], canComplete: [] };
    var habit = current.matchHabitId ? Afterglow.habits.byId(current.matchHabitId) : null;
    if (!habit) return { habits: [], canComplete: [] };
    var today = D.todayKey();
    if (Afterglow.habits.statusFor(habit, today) === 'done') return { habits: [], canComplete: [] };
    var minutes = Math.max(1, Math.round(current.seconds / 60));
    if (habit.targetType === 'check' || !habit.targetAmount) {
      return { habits: [habit], canComplete: [habit], minutes: minutes };
    }
    return {
      habits: [habit],
      canComplete: minutes >= habit.targetAmount ? [habit] : [],
      minutes: minutes,
      partial: minutes < habit.targetAmount
    };
  }

  Afterglow.motivation = {
    candidates: candidates,
    suggestion: suggestion,
    shrink: shrink,
    isSmallest: isSmallest,
    actionById: actionById,
    openHabits: openHabits,
    minutesAvailable: minutesAvailable,
    recordingOptions: recordingOptions,
    matchHabit: matchHabit
  };
})(typeof window !== 'undefined' ? window : this);
