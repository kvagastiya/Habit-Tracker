/* ==========================================================================
   views/progress.js — progress, patterns and honest summaries.

   Every figure on this page is derived from recorded entries. Where there is
   not enough data, the page says so instead of drawing an empty chart.
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
  var I = Afterglow.insights;

  var monthOffset = 0;

  function consistencyCard() {
    var days = D.lastNDays(28);
    var data = I.consistency(days);
    var heat = I.heatmap(days);

    return ui.card({
      title: 'Consistency, not perfection',
      subtitle: 'Days with at least one thing recorded, out of the last 28.',
      body: h('div', { class: 'stack' },
        h('div', { class: 'row', style: { alignItems: 'baseline', gap: 'var(--s-3)' } },
          h('span', { class: 'numeric', style: { fontSize: 'var(--step-3)' }, text: data.percent + '%' }),
          ui.badge(data.label, data.percent >= 60 ? 'sage' : 'quiet', 'chart')
        ),
        ui.bar({ value: data.percent / 100, label: 'Consistency over the last 28 days' }),
        h('p', { class: 'chart-card__caption', text: 'You recorded something on ' + data.activeDays + ' of the last ' + data.totalDays + ' days, and completed every scheduled habit on ' + data.fullDays + ' of them. Days without a record are counted as neither success nor failure — they simply have no entry.' }),
        ui.calendar({
          year: new Date().getFullYear(),
          monthIndex: new Date().getMonth(),
          days: I.monthly().days,
          ariaLabel: 'This month at a glance',
          summary: 'This month: ' + I.monthly().done + ' recorded completions.'
        })
      )
    });
  }

  function statsCard() {
    var week = I.weekly();
    var month = I.monthly();
    var totals = Afterglow.timer.totals();
    var streakData = I.streaks();
    return h('section', { class: 'reveal' },
      h('p', { class: 'eyebrow', text: 'Numbers' }),
      h('div', { class: 'grid grid--4' },
        ui.statTile({ value: week.done + '/' + (week.scheduled || 0), label: 'Recorded this week', hint: week.scheduled ? Math.round(week.ratio * 100) + '% of scheduled days' : 'no habits scheduled' }),
        ui.statTile({ value: D.durationLabel(week.minutes), label: 'Focused this week', hint: totals.count + ' sessions on this device' }),
        ui.statTile({ value: String(streakData.best), label: 'Longest run', hint: 'rest days do not break it' }),
        ui.statTile({ value: String(Afterglow.wins.count()), label: 'Small wins kept', hint: 'from your archive' })
      ),
      h('p', { class: 'chart-card__caption', text: month.label + ' so far: ' + month.done + ' recorded completions across ' + month.activeDays + ' days, with ' + D.durationLabel(month.minutes) + ' of focus time.' })
    );
  }

  function weeklyChartCard() {
    var weekStart = Afterglow.store.state.settings.weekStart;
    var cursor = D.startOfWeek(D.todayKey(), weekStart);
    var starts = [];
    for (var i = 0; i < 8; i++) { starts.unshift(cursor); cursor = D.addDays(cursor, -7); }

    var items = starts.map(function (start) {
      var weeks = I.series(D.weekKeys(start, weekStart));
      var done = weeks.reduce(function (sum, entry) { return sum + entry.done; }, 0);
      return { label: D.formatDayMonth(start), value: done, partial: start === D.startOfWeek(D.todayKey(), weekStart) };
    });

    var total = items.reduce(function (sum, item) { return sum + item.value; }, 0);

    return ui.card({
      title: 'Recorded habit days by week',
      subtitle: 'Eight weeks, oldest to newest. The final bar is the week in progress.',
      body: h('div', { class: 'stack' },
        ui.barChart({
          items: items,
          ariaLabel: 'Habit days recorded per week over the last eight weeks',
          max: Math.max(1, Math.max.apply(null, items.map(function (item) { return item.value; })))
        }),
        h('p', { class: 'chart-card__caption', text: 'Total across the eight weeks: ' + total + ' recorded habit days. The busiest week recorded ' + Math.max.apply(null, items.map(function (item) { return item.value; }).concat([0])) + '.' })
      )
    });
  }

  function heatmapCard() {
    var days = D.lastNDays(17 * 7);
    var heat = I.heatmap(days);

    var grid = h('div', { class: 'heatmap', role: 'presentation' }, heat.cells.map(function (cell) {
      return h('span', {
        class: 'heatmap__cell',
        dataset: { level: String(cell.level), today: String(cell.isToday) },
        title: D.formatShort(cell.date, true) + ': ' + (cell.done || 0) + ' recorded'
      });
    }));

    return ui.card({
      title: 'Activity over the last 17 weeks',
      subtitle: 'One square per day.',
      body: h('div', { class: 'stack' },
        h('div', { class: 'scroll-x' }, grid),
        h('div', { class: 'heatmap-key' },
          h('span', { text: 'Less' }),
          ['0', '1', '2', '3', '4'].map(function (level) {
            return h('i', { 'aria-hidden': 'true', style: { background: 'var(--heat-' + level + ')' } });
          }),
          h('span', { text: 'More' })
        ),
        h('p', { class: 'chart-card__caption' },
          heat.totalDone + ' completions across ' + heat.activeDays + ' active days in 17 weeks. ' +
          (heat.activeDays === 0 ? 'There is no history yet — this fills in as you record things.' : 'Darker squares mean more of that day\'s scheduled habits were recorded, not that the day mattered more.')
        )
      )
    });
  }

  function categoryCard() {
    var days = D.lastNDays(30);
    var totals = I.categoryTotals(days).filter(function (row) { return row.scheduled > 0; });

    if (!totals.length) {
      return ui.card({
        title: 'Where your effort goes',
        body: ui.emptyState({ icon: 'target', title: 'No category data yet', text: 'Once you have scheduled habits and recorded a few days, this shows which parts of your life are getting attention.' })
      });
    }

    var max = Math.max.apply(null, totals.map(function (row) { return row.done; }).concat([1]));
    return ui.card({
      title: 'Where your effort goes',
      subtitle: 'Last 30 days, by habit category.',
      body: h('div', { class: 'stack' },
        h('div', { class: 'insight-list' }, totals.map(function (row) {
          var category = Afterglow.data.categoryById(row.category);
          var ratio = row.scheduled ? row.done / row.scheduled : 0;
          return h('div', { class: 'insight' },
            h('span', { class: 'insight__mark', 'aria-hidden': 'true' }, icon(category.icon, 'icon--sm')),
            h('div', { style: { flex: '1', minWidth: '0' } },
              h('div', { class: 'row row--between' },
                h('strong', { text: category.label }),
                h('span', { class: 'faint numeric', text: row.done + ' of ' + row.scheduled + ' (' + Math.round(ratio * 100) + '%)' })
              ),
              ui.bar({ value: row.done / max, thin: true, variant: row.category === 'study' ? 'amber' : '' })
            )
          );
        })),
        h('p', { class: 'chart-card__caption', text: 'Percentages compare recorded days with scheduled days for each category. A category with a low number is not a weakness — it may simply be scheduled less often, or be the part of life that matters least right now.' })
      )
    });
  }

  function streaksCard() {
    var data = I.streaks();
    var rows = data.rows;

    return ui.card({
      title: 'Streaks and rest days',
      subtitle: 'Best and current runs, counting only scheduled days.',
      body: rows.length ? h('div', { class: 'plain-list divide' }, rows.map(function (row) {
        return h('div', { class: 'timeline-item' },
          h('span', { class: 'timeline-item__mark', 'aria-hidden': 'true' }, icon(Afterglow.data.categoryById(row.habit.category).icon, 'icon--sm')),
          h('div', { class: 'timeline-item__body', style: { flex: '1' } },
            h('div', { class: 'row row--between' },
              h('strong', { text: row.habit.name }),
              h('span', { class: 'muted numeric', text: 'now ' + row.current + ' · best ' + row.best })
            ),
            h('div', { class: 'habit-row__meta' },
              h('span', { class: 'faint', text: row.total + ' recorded days' }),
              row.restDays ? h('span', { class: 'streak-chip' }, icon('moon', 'icon--sm'), h('span', { text: row.restDays + ' rest' })) : null,
              row.sinceLast === null ? h('span', { class: 'faint', text: 'never recorded yet' }) : h('span', { class: 'faint', text: row.sinceLast === 0 ? 'recorded today' : 'last recorded ' + row.sinceLast + ' day' + (row.sinceLast === 1 ? '' : 's') + ' ago' })
            )
          )
        );
      })) : ui.emptyState({ icon: 'chart', title: 'No streaks to show', text: 'Streaks appear once you have recorded a habit on scheduled days at least once.' }),
      foot: h('p', { class: 'chart-card__caption', text: 'A rest day you marked on purpose does not break a run. Missing a day is information about the schedule, not a verdict on you.' })
    });
  }

  function constellationCard() {
    var days = D.lastNDays(90);
    var sky = I.constellation(days);
    return ui.card({
      title: 'Your constellation',
      subtitle: 'One point of light for every recorded action in the last 90 days.',
      body: h('div', { class: 'stack' },
        ui.constellationView({ points: sky.points, summary: sky.summary }),
        h('p', { class: 'chart-card__caption', text: sky.summary }),
        sky.points.length ? h('details', { class: 'disclosure' },
          h('summary', { text: 'Read the constellation as text' }),
          h('div', { class: 'disclosure__body' },
            h('ul', { class: 'plain-list' }, sky.points.slice(0, 60).map(function (point) {
              return h('li', { text: D.formatShort(point.date, true) + ' — ' + point.habit + (point.complete ? '' : ' (partly done)') });
            })),
            sky.points.length > 60 ? h('p', { class: 'faint', text: 'and ' + (sky.points.length - 60) + ' more in this period.' }) : null
          )
        ) : null
      )
    });
  }

  function insightsCard() {
    var list = I.insights(8);
    return ui.card({
      title: 'What the records say',
      subtitle: 'Statements built only from entries you made.',
      body: h('div', { class: 'insight-list' }, list.map(function (item) {
        return h('div', { class: 'insight' },
          h('span', { class: 'insight__mark', 'aria-hidden': 'true' }, icon(item.icon, 'icon--sm')),
          h('p', { style: { margin: '0' }, text: item.text })
        );
      }))
    });
  }

  function letterCard(section) {
    if (!section) return null;
    var letter = I.sundayLetter();
    return ui.card({
      title: 'Sunday letter',
      subtitle: 'Week of ' + D.formatDayMonth(letter.week.start, true) + ' to ' + D.formatDayMonth(D.addDays(letter.week.start, 6), true),
      body: h('div', { class: 'prose stack stack--tight' },
        letter.lines.map(function (line) { return h('p', { text: line }); }),
        h('hr'),
        h('p', { class: 'muted', text: 'Something to consider, if you want it: ' + letter.prompt }),
        h('div', { class: 'actions-inline' },
          ui.button({ label: 'Write it down', icon: 'journal', variant: 'primary', className: 'btn--small', onClick: function () { Afterglow.app.go('journal'); } }),
          ui.button({ label: 'Habits', icon: 'list', variant: 'quiet', className: 'btn--small', onClick: function () { Afterglow.app.go('habits'); } })
        ),
        h('p', { class: 'faint', style: { fontSize: 'var(--step--1)' }, text: letter.disclosure })
      )
    });
  }

  function winsCard(anchor) {
    var wins = Afterglow.wins.all();
    var grouped = {};
    wins.forEach(function (win) { (grouped[win.date] = grouped[win.date] || []).push(win); });
    var dates = Object.keys(grouped).sort().reverse().slice(0, 20);

    return ui.card({
      title: 'Small win archive',
      subtitle: wins.length ? wins.length + ' kept in this browser' : 'Nothing kept yet.',
      body: dates.length ? h('div', { class: 'stack' }, dates.map(function (date) {
        return h('div', null,
          h('p', { class: 'eyebrow', style: { marginBottom: '4px' }, text: D.relativeDay(date) + ' · ' + D.formatShort(date, true) }),
          h('div', { class: 'plain-list' }, grouped[date].map(function (win) {
            return h('div', { class: 'row row--between', style: { padding: '4px 0' } },
              h('span', { text: win.text }),
              ui.iconButton('trash', 'Remove this small win', function () {
                Afterglow.wins.remove(win.id);
                dom.toast('Removed from the archive.');
                Afterglow.app.refresh();
              }, { iconClass: 'icon--sm', title: 'Remove' })
            );
          }))
        );
      })) : ui.emptyState({
        icon: 'spark',
        title: 'The archive is empty',
        text: 'Small wins are the things that happened and nobody clapped for. One line is enough.',
        action: ui.button({ label: 'Back to the dashboard', variant: 'quiet', onClick: function () { Afterglow.app.go('home'); } })
      })
    });
  }

  function monthCard() {
    var base = new Date();
    var view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    var data = I.monthly(view.getFullYear(), view.getMonth());
    var isCurrentMonth = monthOffset === 0;

    return ui.card({
      title: D.monthLabel(view.getFullYear(), view.getMonth()),
      subtitle: data.done + ' recorded completions · ' + D.durationLabel(data.minutes) + ' focused',
      actions: [
        ui.iconButton('chevron', 'Previous month', function () { monthOffset -= 1; Afterglow.app.rerender(); }, { iconClass: 'icon--sm', className: 'rotate-180', title: 'Previous month' }),
        isCurrentMonth ? null : ui.button({ label: 'This month', variant: 'quiet', className: 'btn--small', onClick: function () { monthOffset = 0; Afterglow.app.rerender(); } }),
        ui.iconButton('chevron', 'Next month', function () { monthOffset = Math.min(0, monthOffset + 1); Afterglow.app.rerender(); }, { iconClass: 'icon--sm', disabled: isCurrentMonth, title: 'Next month' })
      ].filter(Boolean),
      body: h('div', { class: 'stack' },
        ui.calendar({
          year: view.getFullYear(),
          monthIndex: view.getMonth(),
          days: data.days,
          ariaLabel: 'Recorded activity in ' + data.label,
          summary: data.label + ': ' + data.done + ' recorded completions across ' + data.activeDays + ' days.'
        }),
        h('p', { class: 'chart-card__caption', text: data.trackedDays + ' days of ' + data.label + ' have happened. You recorded something on ' + data.activeDays + ' of them' + (data.scheduled ? ', completing ' + data.done + ' of ' + data.scheduled + ' scheduled habit days.' : '.') })
      )
    });
  }

  Afterglow.views.progress = {
    title: 'Progress',
    context: 'Progress',
    render: function (container, params) {
      container.appendChild(ui.pageHeader({
        eyebrow: 'Patterns',
        title: 'Progress',
        lead: 'A calm look at what has actually happened. Nothing here is designed to make you feel behind.'
      }));

      container.appendChild(h('div', { class: 'stack' },
        statsCard(),
        h('div', { class: 'grid grid--2' }, consistencyCard(), weeklyChartCard()),
        heatmapCard(),
        h('div', { class: 'grid grid--2' }, monthCard(), categoryCard()),
        streaksCard(),
        constellationCard(),
        insightsCard(),
        h('div', { id: 'letter', class: 'anchor-target' }, letterCard('letter')),
        h('div', { id: 'wins', class: 'anchor-target' }, winsCard('wins'))
      ));

      if (params && params.anchor) {
        var target = container.querySelector('#' + params.anchor);
        if (target) setTimeout(function () { target.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 120);
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);
