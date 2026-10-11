/* ==========================================================================
   views/home.js — the dashboard.
   Goal: the next small step should be obvious in three seconds, and the page
   should still feel calm when nothing has been done yet.
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
  var H = Afterglow.habits;

  /** Headline rotates by date, not by random, so it is stable on reload. */
  function headline() {
    var list = Afterglow.data.HEADLINES;
    var today = D.todayKey();
    var seed = 0;
    for (var i = 0; i < today.length; i++) seed += today.charCodeAt(i) * (i + 3);
    return list[seed % list.length];
  }

  function greetingText() {
    var name = (Afterglow.store.state.profile.name || '').trim();
    var base = D.greeting();
    if (!name) return base + '.';
    var safe = name.replace(/[<>]/g, '');
    return base + ', ' + safe + '.';
  }

  function rolloverNotice() {
    var state = Afterglow.store.state;
    var today = D.todayKey();
    if (state.meta.lastSessionDay === today) return null;
    if (!state.meta.lastSessionDay) {
      Afterglow.store.update(function (s) { s.meta.lastSessionDay = today; }, 'session-day');
      return null;
    }
    var gap = D.diffDays(state.meta.lastSessionDay, today);
    Afterglow.store.update(function (s) { s.meta.lastSessionDay = today; }, 'session-day');
    if (gap <= 1) return null;
    return h('div', { class: 'notice notice--rest reveal' },
      icon('moon'),
      h('div', null,
        h('strong', { text: 'It has been ' + gap + ' days since this device last opened Afterglow. ' }),
        h('span', { text: 'Nothing was missed that you can fix by feeling bad about it. Today is a clean slate — one small thing is enough.' })
      )
    );
  }

  function heroSection() {
    var state = Afterglow.store.state;
    var list = H.ordered();
    var progress = H.dayProgress(D.todayKey(), list);
    var scheduled = list.filter(function (habit) { return H.scheduledOn(habit, D.todayKey()); });
    var caption = scheduled.length
      ? progress.done + ' of ' + progress.scheduled + ' recorded'
      : 'No habits scheduled today';
    var aria = scheduled.length
      ? progress.done + ' of ' + progress.scheduled + ' habits recorded today'
      : 'No habits scheduled for today';

    var ring = ui.progressRing({
      value: progress.scheduled ? progress.done / progress.scheduled : 0,
      size: 168,
      ariaLabel: aria,
      valueText: progress.scheduled ? String(progress.done) + '/' + String(progress.scheduled) : '—',
      caption: 'today'
    });

    var note = progress.scheduled
      ? (progress.done === progress.scheduled
        ? 'Everything scheduled is recorded. Nothing more is required.'
        : progress.done === 0
          ? 'Starting anywhere is allowed, including the smallest step.'
          : 'Steady counts. The rest can wait.')
      : 'No habits scheduled today — that is a legitimate plan.';

    var config = Afterglow.app.motivationLabel();

    return h('section', { class: 'hero reveal' },
      h('div', { class: 'hero__inner' },
        h('div', null,
          h('p', { class: 'hero__greeting', text: greetingText() }),
          h('p', { class: 'hero__date', text: D.formatLong(D.todayKey()) }),
          h('h1', { class: 'hero__headline', text: headline() }),
          h('p', { class: 'hero__sub', text: 'Today holds ' + scheduled.length + (scheduled.length === 1 ? ' habit' : ' habits') + ' and about ' + state.profile.budget + ' minutes of self-improvement. Anything beyond that is a bonus, not a requirement.' }),
          h('div', { class: 'actions-inline', style: { marginTop: 'var(--s-4)' } },
            ui.button({ label: 'Focus timer', icon: 'clock', variant: 'primary', onClick: function () { Afterglow.app.go('focus'); } }),
            ui.button({ label: config.label, icon: 'spark', variant: 'glow', onClick: function () { Afterglow.app.openMotivation(); } }),
            ui.button({ label: 'Daily flow', icon: 'flow', variant: 'quiet', onClick: function () { Afterglow.app.go('flow'); } })
          )
        ),
        h('div', { class: 'hero__ring' }, ring, h('p', { class: 'hero__ringnote', text: note }))
      )
    );
  }

  function todayCard() {
    var today = D.todayKey();
    var list = H.ordered();
    var scheduled = list.filter(function (habit) { return H.scheduledOn(habit, today); });
    var rest = list.filter(function (habit) { return !H.scheduledOn(habit, today); });

    var body;
    if (!list.length) {
      body = ui.emptyState({
        icon: 'plus',
        title: 'No habits yet',
        text: 'One habit is a better start than six. Pick something you would genuinely like to repeat, and make it small.',
        action: ui.button({ label: 'Create my first habit', variant: 'primary', icon: 'plus', onClick: function () { Afterglow.editor.openHabit(null); } })
      });
    } else if (!scheduled.length) {
      body = ui.emptyState({
        icon: 'moon',
        title: 'Nothing is scheduled today',
        text: 'Today is a rest day for every habit you have. Rest days are part of a schedule, not a gap in one.',
        action: ui.button({ label: 'See all habits', variant: 'quiet', onClick: function () { Afterglow.app.go('habits'); } })
      });
    } else {
      body = h('div', { class: 'today-list' }, scheduled.map(function (habit) {
        return ui.habitRow(habit, {
          date: today,
          showWeek: false,
          onToggle: function (target) { Afterglow.app.toggleHabit(target, today); }
        });
      }));
      if (rest.length) {
        body.appendChild(h('details', { class: 'disclosure', style: { marginTop: 'var(--s-4)' } },
          h('summary', { text: 'Not scheduled today (' + rest.length + ')' }),
          h('div', { class: 'disclosure__body' },
            h('p', { text: 'These are optional today. Ticking one records it as a bonus, and it will not affect today\'s percentage.' }),
            rest.map(function (habit) {
              return ui.habitRow(habit, {
                date: today,
                showWeek: false,
                className: 'is-optional',
                onToggle: function (target) { Afterglow.app.toggleHabit(target, today); }
              });
            })
          )
        ));
      }
    }

    return ui.card({
      title: 'Today',
      subtitle: scheduled.length ? 'Tap the circle to record. Tapping again undoes it.' : null,
      className: 'card--flush',
      actions: [
        ui.button({ label: 'Add habit', icon: 'plus', variant: 'quiet', className: 'btn--small', onClick: function () { Afterglow.editor.openHabit(null); } })
      ],
      body: h('div', { style: { padding: scheduled.length ? '0' : '0' } }, body)
    });
  }

  function nextStepCard() {
    var next = Afterglow.insights.nextAction();
    var actions = [];
    if (next.habitId) {
      actions.push(ui.button({
        label: 'Open in habits', icon: 'chevron', variant: 'quiet', className: 'btn--small',
        onClick: function () { Afterglow.app.go('habits'); }
      }));
    } else if (next.action === 'open-habit-editor') {
      actions.push(ui.button({ label: 'Create a habit', icon: 'plus', variant: 'primary', className: 'btn--small', onClick: function () { Afterglow.editor.openHabit(null); } }));
    }

    return ui.card({
      className: 'card--accent',
      title: 'Smallest next step',
      body: h('div', { class: 'next-card' },
        h('p', { class: 'next-card__action', text: next.title }),
        h('p', { class: 'muted', text: next.detail }),
        h('div', { class: 'row' },
          next.minutes ? ui.badge('about ' + next.minutes + ' min', 'amber', 'clock') : ui.badge('nothing required', 'moon', 'moon'),
          actions.length ? h('div', { class: 'actions-inline' }, actions) : null
        )
      )
    });
  }

  function smallWinCard() {
    var win = Afterglow.insights.smallWin();
    var prompt = Afterglow.data.WIN_PROMPTS[(new Date().getDate() + new Date().getMonth()) % Afterglow.data.WIN_PROMPTS.length];
    var input = ui.input({ placeholder: 'One sentence is plenty', maxlength: 300, ariaLabel: 'Small win text' });
    var form = h('form', {
      class: 'row', style: { gap: 'var(--s-2)' },
      on: {
        submit: function (event) {
          event.preventDefault();
          var value = input.value.trim();
          if (!value) return;
          Afterglow.wins.add(value, 'dashboard');
          input.value = '';
          dom.announce('Small win saved.');
          dom.toast('Saved to your small wins.', { icon: 'spark' });
          Afterglow.app.refresh();
        }
      }
    }, input, ui.button({ label: 'Keep it', variant: 'primary', className: 'btn--small', onClick: function () { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } }));

    return ui.card({
      title: 'Small win',
      subtitle: win ? null : prompt,
      body: h('div', { class: 'stack stack--tight' },
        win ? h('p', { class: 'quote', style: { fontFamily: 'var(--font-display)', fontSize: 'var(--step-1)', color: 'var(--text-strong)', margin: 0 }, text: '“' + win.text + '”' }) : h('p', { class: 'muted', text: 'Nothing recorded yet today. If something small went right, it is worth one line — the archive is for days like this.' }),
        form,
        h('p', { class: 'faint', style: { fontSize: '0.72rem' }, text: 'Kept locally in this browser only.' })
      ),
      foot: h('div', { class: 'row row--between' },
        h('span', { class: 'muted', style: { fontSize: 'var(--step--1)' }, text: Afterglow.wins.count() + ' kept in the archive' }),
        ui.button({ label: 'View archive', variant: 'quiet', className: 'btn--tiny', onClick: function () { Afterglow.app.go('progress', { anchor: 'wins' }); } })
      )
    });
  }

  function overviewSection() {
    var state = Afterglow.store.state;
    var today = D.todayKey();
    var week = Afterglow.insights.weekly();
    var totals = Afterglow.timer.totals();
    var progress = H.dayProgress(today);
    var journey = Afterglow.journey.today();
    var journeyProgress = Afterglow.journey.progress();

    var tiles = [
      { label: 'Today', value: progress.scheduled ? progress.done + '/' + progress.scheduled : '—', hint: 'habits recorded', route: 'habits' },
      { label: 'Focus', value: D.durationLabel(week.minutes), hint: 'this week', route: 'focus' },
      { label: 'Journey', value: journey.state.active || journey.state.startedAt ? (journeyProgress.done + '/' + journeyProgress.total) : 'not started', hint: journey.state.active ? 'day ' + (journey.index + 1) : 'optional', route: 'journey' },
      { label: 'Reflection', value: String(state.journal.length), hint: 'journal entries', route: 'journal' }
    ];

    return h('section', { class: 'reveal' },
      h('p', { class: 'eyebrow', text: 'Overview' }),
      h('div', { class: 'jump-grid' }, tiles.map(function (tile) {
        return h('button', {
          class: 'jump', type: 'button',
          on: { click: function () { Afterglow.app.go(tile.route); } }
        },
          h('span', { class: 'jump__label', text: tile.label }),
          h('span', { class: 'jump__value', text: tile.value }),
          h('span', { class: 'jump__hint', text: tile.hint })
        );
      }))
    );
  }

  function sundayTeaser() {
    var state = Afterglow.store.state;
    var today = D.todayKey();
    var isSunday = D.weekdayOf(today) === 0;
    if (!isSunday) return null;
    if (state.sunday.dismissedFor === today) return null;
    if (D.diffDays(state.createdAt.slice(0, 10), today) < 3) return null;

    var card = ui.card({
      className: 'card--calm',
      title: 'Sunday letter',
      subtitle: 'A short summary written from your own records.',
      body: h('p', { class: 'muted', text: 'One quiet look at the week, composed locally from what you logged. It has no opinions about how much that should have been.' }),
      actions: [
        ui.button({ label: 'Read it', variant: 'primary', className: 'btn--small', onClick: function () { Afterglow.app.go('progress', { anchor: 'letter' }); } }),
        ui.button({
          label: 'Not today', variant: 'quiet', className: 'btn--small',
          onClick: function () {
            Afterglow.store.update(function (s) { s.sunday.dismissedFor = today; }, 'sunday-dismiss');
            Afterglow.app.refresh();
          }
        })
      ]
    });
    return card;
  }

  Afterglow.views.home = {
    title: 'Home',
    context: 'Today',
    render: function (container) {
      var notice = rolloverNotice();
      var stack = h('div', { class: 'stack' });
      stack.appendChild(heroSection());
      stack.appendChild(h('div', { class: 'grid grid--2' },
        h('div', { class: 'stack' }, todayCard(), overviewSection()),
        h('div', { class: 'stack' }, nextStepCard(), smallWinCard(), sundayTeaser())
      ));
      if (notice) stack.insertBefore(notice, stack.firstChild);
      container.appendChild(stack);
    }
  };
})(typeof window !== 'undefined' ? window : this);
