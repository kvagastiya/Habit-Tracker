/* ==========================================================================
   insights.js — everything derived from real records.

   Rules followed here:
   - never invent a data point, never dress an empty state up as an achievement
   - describe what was recorded rather than claiming why it happened
   - return text alongside every visual so the charts are not the only channel
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var D = Afterglow.dates;
  var H = Afterglow.habits;

  function dayStats(habitList) {
    var list = habitList || H.ordered();
    var progress = H.dayProgress(D.todayKey(), list);
    var doneToday = H.completionCount(D.todayKey());
    var minutesToday = Afterglow.timer.minutesByDay([D.todayKey()])[D.todayKey()] || 0;
    return { progress: progress, doneToday: doneToday, minutesToday: minutesToday };
  }

  /** Daily series with completion ratios and focus minutes. */
  function series(dayKeys) {
    var list = H.ordered();
    var completions = H.rangeStats(dayKeys);
    var minutes = Afterglow.timer.minutesByDay(dayKeys);
    return dayKeys.map(function (day) {
      var progress = H.dayProgress(day, list);
      return {
        date: day,
        count: completions[day] || 0,
        minutes: minutes[day] || 0,
        scheduled: progress.scheduled,
        done: progress.done,
        skipped: progress.skipped,
        partial: progress.partial,
        total: list.length,
        ratio: progress.ratio
      };
    });
  }

  function levelFor(entry) {
    if (!entry) return 0;
    if (entry.scheduled === 0) return entry.count > 0 ? 2 : 0;
    if (entry.done === 0) return entry.count > 0 ? 1 : 0;
    var ratio = entry.ratio;
    if (ratio >= 1) return 4;
    if (ratio >= 0.67) return 3;
    if (ratio >= 0.34) return 2;
    return 1;
  }

  function heatmap(days) {
    var data = series(days);
    var maxMinutes = data.reduce(function (max, entry) { return Math.max(max, entry.minutes); }, 0);
    return {
      cells: data.map(function (entry) {
        return {
          date: entry.date,
          count: entry.count,
          minutes: entry.minutes,
          done: entry.done,
          scheduled: entry.scheduled,
          level: levelFor(entry),
          isToday: entry.date === D.todayKey()
        };
      }),
      maxMinutes: maxMinutes,
      totalDone: data.reduce(function (sum, entry) { return sum + entry.done; }, 0),
      activeDays: data.filter(function (entry) { return entry.count > 0; }).length,
      elementCount: data.length
    };
  }

  function weekly(weekStartKey) {
    var start = weekStartKey || D.startOfWeek(D.todayKey(), Afterglow.store.state.settings.weekStart);
    var days = D.weekKeys(start, Afterglow.store.state.settings.weekStart);
    var data = series(days);
    var done = data.reduce(function (s, e) { return s + e.done; }, 0);
    var scheduled = data.reduce(function (s, e) { return s + e.scheduled; }, 0);
    var minutes = data.reduce(function (s, e) { return s + e.minutes; }, 0);
    return {
      start: start,
      days: data,
      done: done,
      scheduled: scheduled,
      minutes: minutes,
      ratio: scheduled ? done / scheduled : 0,
      activeDays: data.filter(function (e) { return e.count > 0; }).length
    };
  }

  function monthly(year, monthIndex) {
    var today = new Date();
    var y = typeof year === 'number' ? year : today.getFullYear();
    var m = typeof monthIndex === 'number' ? monthIndex : today.getMonth();
    var keys = D.monthKeys(y, m).filter(function (key) { return !D.isFutureKey(key); });
    var data = series(keys);
    var done = data.reduce(function (s, e) { return s + e.done; }, 0);
    var scheduled = data.reduce(function (s, e) { return s + e.scheduled; }, 0);
    return {
      year: y,
      monthIndex: m,
      label: D.monthLabel(y, m),
      days: data,
      done: done,
      scheduled: scheduled,
      minutes: data.reduce(function (s, e) { return s + e.minutes; }, 0),
      ratio: scheduled ? done / scheduled : 0,
      activeDays: data.filter(function (e) { return e.count > 0; }).length,
      trackedDays: data.length
    };
  }

  function categoryTotals(days) {
    var list = H.ordered();
    var totals = {};
    list.forEach(function (habit) {
      var bucket = totals[habit.category] || (totals[habit.category] = { category: habit.category, done: 0, scheduled: 0, minutes: 0 });
      days.forEach(function (day) {
        if (H.scheduledOn(habit, day)) {
          bucket.scheduled++;
          var status = H.statusFor(habit, day);
          if (status === 'done') {
            bucket.done++;
            var progress = H.entryProgress(habit, day);
            if (progress && habit.targetType === 'minutes') bucket.minutes += progress.amount;
          }
        }
      });
    });
    return Object.keys(totals).map(function (key) { return totals[key]; })
      .sort(function (a, b) { return b.done - a.done; });
  }

  /** "Consistency over perfection": how often something was recorded at all. */
  function consistency(days) {
    var data = series(days);
    var tracked = data.filter(function (entry) { return entry.scheduled > 0; });
    var active = data.filter(function (entry) { return entry.count > 0; });
    var full = data.filter(function (entry) { return entry.scheduled > 0 && entry.ratio >= 1; });
    var percent = data.length ? Math.round((active.length / data.length) * 100) : 0;
    var label = 'Just starting';
    if (percent >= 85) label = 'Very steady';
    else if (percent >= 60) label = 'Steady';
    else if (percent >= 35) label = 'Finding a rhythm';
    else if (percent > 0) label = 'Just starting';
    return {
      percent: percent,
      label: label,
      activeDays: active.length,
      trackedDays: tracked.length,
      fullDays: full.length,
      totalDays: data.length
    };
  }

  /** Streaks across habits, rest days included and reported separately. */
  function streaks() {
    var list = H.ordered();
    var rows = list.map(function (habit) {
      var current = H.streak(habit);
      return {
        habit: habit,
        current: current.current,
        restDays: current.restDays,
        best: H.longestStreak(habit),
        total: H.totalCompletions(habit.id),
        sinceLast: H.daysSinceLastDone(habit.id)
      };
    });
    var withData = rows.filter(function (row) { return row.total > 0; });
    return {
      rows: rows.sort(function (a, b) { return b.current - a.current || b.total - a.total; }),
      best: withData.reduce(function (max, row) { return Math.max(max, row.best); }, 0),
      longestCurrent: withData.reduce(function (max, row) { return Math.max(max, row.current); }, 0),
      activeHabits: withData.length
    };
  }

  /**
   * Short factual observations. Each one states a number that exists in the
   * records; none of them claim a cause.
   */
  function insights(limit) {
    var out = [];
    var days30 = D.lastNDays(30);
    var days14 = D.lastNDays(14);
    var hist = heatmap(days30);
    var totals = Afterglow.timer.totals();
    var week = weekly();
    var month = monthly();
    var streakData = streaks();
    var wins = Afterglow.wins.all();

    if (!hist.totalDone && !totals.count && !wins.length) {
      return [{
        icon: 'spark',
        text: 'There is nothing to summarise yet. After two or three days of ticking things off, this page will describe what actually happened.'
      }];
    }

    if (hist.totalDone) {
      out.push({ icon: 'check', text: 'You recorded ' + hist.totalDone + ' completion' + (hist.totalDone === 1 ? '' : 's') + ' on ' + hist.activeDays + ' day' + (hist.activeDays === 1 ? '' : 's') + ' in the last 30 days.' });
    }
    if (totals.minutes) {
      out.push({ icon: 'clock', text: 'Focused time totals ' + D.durationLabel(totals.minutes) + ' across ' + totals.count + ' timer session' + (totals.count === 1 ? '' : 's') + ', ' + totals.finished + ' of them run to the planned length.' });
    }
    var steadiest = streakData.rows.filter(function (row) { return row.total > 2; })[0];
    if (steadiest) {
      out.push({ icon: 'chart', text: 'Your steadiest habit so far is “' + steadiest.habit.name + '” with ' + steadiest.total + ' recorded days and a best run of ' + steadiest.best + '.' });
    }
    if (week.scheduled) {
      out.push({ icon: 'flow', text: 'This week: ' + week.done + ' of ' + week.scheduled + ' scheduled habit days recorded' + (week.minutes ? ', and ' + D.durationLabel(week.minutes) + ' of focus time.' : '.') });
    }
    var categories = categoryTotals(days14).filter(function (row) { return row.scheduled; });
    if (categories.length) {
      var top = categories[0];
      var label = Afterglow.data.categoryById(top.category).label.toLowerCase();
      out.push({ icon: 'target', text: 'Over the last 14 days, ' + label + ' is the category you logged most often (' + top.done + ' of ' + top.scheduled + ' scheduled days).' });
    }
    var restDays = streakData.rows.reduce(function (sum, row) { return sum + row.restDays; }, 0);
    if (restDays > 0) {
      out.push({ icon: 'moon', text: 'You logged ' + restDays + ' rest day' + (restDays === 1 ? '' : 's') + '. Those are counted as rest, not as missed.' });
    }
    if (wins.length) {
      out.push({ icon: 'spark', text: 'You have kept ' + wins.length + ' small win' + (wins.length === 1 ? '' : 's') + ' in the archive. The oldest is from ' + D.formatShort(wins[wins.length - 1].date, true) + '.' });
    }
    if (month.done && month.trackedDays >= 5) {
      out.push({ icon: 'journey', text: month.label + ' so far: ' + month.done + ' recorded completions on ' + month.activeDays + ' of ' + month.trackedDays + ' days that have happened.' });
    }
    return typeof limit === 'number' ? out.slice(0, limit) : out;
  }

  /** A concrete next step for the home card, based on today's real state. */
  function nextAction() {
    var today = D.todayKey();
    var list = H.ordered();
    var open = list.filter(function (habit) {
      var status = H.statusFor(habit, today);
      return H.scheduledOn(habit, today) && (status === 'pending' || status === 'partial');
    });
    var budget = Afterglow.store.state.profile.budget || 20;
    var progress = H.dayProgress(today, list);

    if (!list.length) {
      return {
        title: 'Add one habit you would actually like to keep',
        detail: 'Starting with a single habit is easier to repeat than a full routine.',
        minutes: 2,
        route: 'habits',
        action: 'open-habit-editor'
      };
    }
    if (open.length) {
      var habit = open[0];
      var entry = H.entryProgress(habit, today);
      var minutes = habit.targetType === 'minutes' ? (habit.targetAmount || 10) : Math.min(15, Math.max(2, Math.round(budget / Math.max(open.length, 1))));
      var detail = entry
        ? 'Partly logged at ' + entry.amount + ' of ' + entry.target + '. The rest can wait.'
        : (habit.description || 'Start with the smallest version of this one.');
      return { title: habit.name, detail: detail, minutes: minutes, habitId: habit.id, route: 'home' };
    }
    if (progress.scheduled && progress.done === progress.scheduled) {
      return {
        title: 'Nothing is required of you now',
        detail: 'Everything scheduled today is recorded. Adding one small extra is optional.',
        minutes: 0,
        route: 'home',
        optional: true
      };
    }
    return {
      title: 'Rest counts as a plan',
      detail: 'No habits scheduled for today. You can rest, or do one small optional thing.',
      minutes: 0,
      route: 'flow'
    };
  }

  /** Small win surfaced from the user's own records (never fabricated). */
  function smallWin() {
    var today = D.todayKey();
    var todayWins = Afterglow.wins.forDate(today);
    if (todayWins.length) return { kind: 'win', text: todayWins[0].text };
    var doneToday = H.dayProgress(today).done;
    if (doneToday > 0) return { kind: 'count', text: 'You have already recorded ' + doneToday + ' habit' + (doneToday === 1 ? '' : 's') + ' today. That is on the board for today.' };
    var sessions = Afterglow.timer.sessions();
    if (sessions.length) return { kind: 'focus', text: 'Your last focus session was ' + D.durationLabel(sessions[0].minutes) + ' on ' + D.formatShort(sessions[0].endedAt ? D.toKey(new Date(sessions[0].endedAt)) : today) + '.' };
    var wins = Afterglow.wins.all();
    if (wins.length) return { kind: 'win', text: 'From your archive: “' + wins[0].text + '” (' + D.relativeDay(wins[0].date) + ').' };
    return null;
  }

  /**
   * The Sunday letter. Composed locally from recorded data with fixed sentence
   * templates — it is honest about what it does not know, and it is never
   * generated by a model or a server.
   */
  function sundayLetter(weekStartKey) {
    var week = weekly(weekStartKey);
    var prev = weekly(D.addDays(week.start, -7));
    var streakData = streaks();
    var totals = Afterglow.timer.totals();
    var wins = Afterglow.wins.all().filter(function (win) {
      return D.diffDays(week.start, win.date) >= 0 && D.diffDays(week.start, win.date) < 7;
    });
    var journalThisWeek = Afterglow.store.state.journal.filter(function (entry) {
      return D.diffDays(week.start, entry.date) >= 0 && D.diffDays(week.start, entry.date) < 7;
    });
    var lines = [];

    if (week.done === 0 && week.minutes === 0) {
      lines.push('This week has no recorded completions. That can mean a hard week, a busy week, or simply a week where keeping records was not the priority. Nothing has been lost, and nothing needs to be repaired.');
    } else {
      lines.push('This week you recorded ' + week.done + ' habit day' + (week.done === 1 ? '' : 's') +
        (week.scheduled ? ' out of ' + week.scheduled + ' that were scheduled' : '') + '.');
      if (week.minutes) lines.push('Focus time came to ' + D.durationLabel(week.minutes) + '.');
      if (prev.scheduled && week.scheduled) {
        var diff = week.done - prev.done;
        if (diff > 0) lines.push('That is ' + diff + ' more than last week, which is worth noticing without turning it into a rule.');
        else if (diff === 0) lines.push('Last week ended with the same number, so the rhythm is holding rather than climbing.');
        else lines.push('That is ' + Math.abs(diff) + ' fewer than last week. Weeks move like that; the record is still there.');
      }
    }

    var restful = streakData.rows.filter(function (row) { return row.restDays > 0; });
    if (restful.length) {
      lines.push('You marked ' + restful.reduce(function (s, r) { return s + r.restDays; }, 0) + ' rest day' + (restful.length === 1 && restful[0].restDays === 1 ? '' : 's') + ' on purpose, which kept those days out of the missed column.');
    }
    var steady = streakData.rows[0];
    if (steady && steady.total > 0) {
      lines.push('“' + steady.habit.name + '” is your most consistent habit right now' + (steady.current ? ', currently on ' + steady.current + ' in a row' : '') + '.');
    }
    if (wins.length) {
      lines.push('Small wins kept this week: ' + wins.slice(0, 3).map(function (win) { return '“' + win.text + '”'; }).join(', ') + (wins.length > 3 ? ', and ' + (wins.length - 3) + ' more.' : '.'));
    }
    if (journalThisWeek.length) {
      lines.push('You wrote ' + journalThisWeek.length + ' journal ' + (journalThisWeek.length === 1 ? 'entry' : 'entries') + ' this week. Re-reading one of them is usually more useful than starting a fresh one.');
    } else {
      lines.push('No journal entries this week. One line is enough if you want to leave a trace.');
    }
    if (totals.count) {
      lines.push('Total focused time on this device is ' + D.durationLabel(totals.minutes) + '.');
    }
    var prompt = Afterglow.dom.pick(Afterglow.data.WIN_PROMPTS) || Afterglow.data.WIN_PROMPTS[0];

    return {
      week: week,
      lines: lines,
      prompt: prompt,
      generatedAt: new Date().toISOString(),
      disclosure: 'This letter is written locally from your own records using fixed templates. No server and no AI wrote it, and it only knows what you logged.'
    };
  }

  /**
   * Constellation points: one dot per recorded completion, positioned from a
   * stable hash of its date so the sky does not jump around on every render.
   * An accessible text alternative is returned alongside.
   */
  function constellation(days) {
    var data = series(days);
    var points = [];
    var habitsById = {};
    H.ordered(true).forEach(function (habit) { habitsById[habit.id] = habit; });
    var maxCount = data.reduce(function (max, entry) { return Math.max(max, entry.count); }, 0);
    Object.keys(Afterglow.store.state.logs).forEach(function (id) {
      var habit = habitsById[id];
      if (!habit) return;
      var daysLogged = Afterglow.store.state.logs[id];
      Object.keys(daysLogged).forEach(function (day) {
        if (days.indexOf(day) === -1) return;
        var entry = daysLogged[day];
        var progress = H.entryProgress(habit, day);
        var seed = hash(day + id);
        points.push({
          id: id + ':' + day,
          habit: habit.name,
          date: day,
          amount: entry ? entry.amount : 1,
          complete: progress ? progress.complete : true,
          x: 0.06 + ((seed % 1000) / 1000) * 0.88,
          y: 0.12 + (((seed >> 10) % 1000) / 1000) * 0.76,
          radius: 1.6 + (progress && progress.ratio ? progress.ratio : 1) * 1.5,
          accent: habit.accent
        });
      });
    });
    var summary = points.length
      ? points.length + ' recorded actions from ' + data.filter(function (e) { return e.count > 0; }).length + ' day' + (data.filter(function (e) { return e.count > 0; }).length === 1 ? '' : 's') + ' between ' + D.formatShort(days[0]) + ' and ' + D.formatShort(days[days.length - 1]) + '.'
      : 'No points of light yet. Each completed habit adds one.';
    return { points: points, maxCount: maxCount, summary: summary };
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  Afterglow.insights = {
    series: series,
    heatmap: heatmap,
    weekly: weekly,
    monthly: monthly,
    categoryTotals: categoryTotals,
    consistency: consistency,
    streaks: streaks,
    insights: insights,
    nextAction: nextAction,
    smallWin: smallWin,
    sundayLetter: sundayLetter,
    constellation: constellation,
    dayStats: dayStats,
    levelFor: levelFor
  };
})(typeof window !== 'undefined' ? window : this);
