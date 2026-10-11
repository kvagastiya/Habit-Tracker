/* ==========================================================================
   views/habits.js — manage habits: create, edit, reorder, complete, skip,
   archive, delete and inspect history.
   Ordering uses explicit move buttons rather than drag-and-drop so the whole
   list stays keyboard-operable.
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

  var filter = 'active';
  var query = '';

  function toolbar() {
    var search = ui.input({
      value: query,
      placeholder: 'Find a habit',
      ariaLabel: 'Search habits',
      dataset: { focusKey: 'habit-search' },
      on: {
        input: dom.debounce(function (event) {
          query = event.target.value.trim().toLowerCase();
          Afterglow.app.rerender();
        }, 180)
      }
    });

    return h('div', { class: 'habits-toolbar' },
      ui.segmented({
        ariaLabel: 'Filter habits',
        value: filter,
        items: [
          { value: 'active', label: 'Active' },
          { value: 'today', label: 'Today' },
          { value: 'archived', label: 'Archived' },
          { value: 'all', label: 'All' }
        ],
        onSelect: function (value) { filter = value; Afterglow.app.rerender(); }
      }),
      h('div', { class: 'spacer', style: { flex: '1 1 160px', minWidth: '160px' } }, search),
      ui.button({ label: 'New habit', icon: 'plus', variant: 'primary', onClick: function () { Afterglow.editor.openHabit(null); } })
    );
  }

  function matches(habit) {
    if (query && habit.name.toLowerCase().indexOf(query) === -1 && (habit.description || '').toLowerCase().indexOf(query) === -1) return false;
    var today = D.todayKey();
    if (filter === 'active') return !habit.archived;
    if (filter === 'archived') return habit.archived;
    if (filter === 'today') return !habit.archived && H.scheduledOn(habit, today);
    return true;
  }

  function habitActions(habit, index, listLength) {
    var today = D.todayKey();
    var status = H.statusFor(habit, today);
    var actions = [];

    actions.push(ui.iconButton('chevron', 'Move ' + habit.name + ' up', function () { H.move(habit.id, -1); Afterglow.app.refresh(); }, { className: 'is-rotated-up', disabled: index === 0, iconClass: 'icon--sm', title: 'Move up' }));
    actions.push(ui.iconButton('chevron', 'Move ' + habit.name + ' down', function () { H.move(habit.id, 1); Afterglow.app.refresh(); }, { disabled: index === listLength - 1, iconClass: 'icon--sm', title: 'Move down' }));

    if (status === 'pending' || status === 'partial') {
      actions.push(ui.button({
        label: 'Rest day', variant: 'quiet', className: 'btn--tiny', icon: 'moon',
        onClick: function () {
          H.skip(habit.id, today);
          dom.toast('Marked as a rest day. It will not count as missed.', { icon: 'moon', actionLabel: 'Undo', onAction: function () { H.unskip(habit.id, today); Afterglow.app.refresh(); } });
          Afterglow.app.refresh();
        }
      }));
    } else if (status === 'skipped') {
      actions.push(ui.button({
        label: 'Not resting', variant: 'quiet', className: 'btn--tiny', icon: 'undo',
        onClick: function () { H.unskip(habit.id, today); Afterglow.app.refresh(); }
      }));
    }

    actions.push(ui.iconButton('journal', 'History for ' + habit.name, function () { historyDialog(habit); }, { iconClass: 'icon--sm', title: 'History' }));
    actions.push(ui.iconButton('edit', 'Edit ' + habit.name, function () { Afterglow.editor.openHabit(habit.id); }, { iconClass: 'icon--sm', title: 'Edit' }));

    if (habit.archived) {
      actions.push(ui.button({
        label: 'Restore', variant: 'quiet', className: 'btn--tiny', icon: 'undo',
        onClick: function () { H.setArchived(habit.id, false); dom.toast('Moved back to your active habits.'); Afterglow.app.refresh(); }
      }));
    } else {
      actions.push(ui.iconButton('archive', 'Archive ' + habit.name, function () { archiveHabit(habit); }, { iconClass: 'icon--sm', title: 'Archive' }));
    }
    actions.push(ui.iconButton('trash', 'Delete ' + habit.name, function () { deleteHabit(habit); }, { iconClass: 'icon--sm', title: 'Delete' }));

    return h('div', { class: 'icon-btn-row' }, actions);
  }

  function archiveHabit(habit) {
    H.setArchived(habit.id, true);
    dom.toast('“' + habit.name + '” archived. Its history is kept.', {
      icon: 'archive',
      actionLabel: 'Undo',
      onAction: function () { H.setArchived(habit.id, false); Afterglow.app.refresh(); }
    });
    Afterglow.app.refresh();
  }

  function deleteHabit(habit) {
    var confirmFirst = Afterglow.store.state.settings.confirmDestructive;
    var total = H.totalCompletions(habit.id);
    if (!confirmFirst) { doDelete(habit.id, habit.name); return; }
    dom.confirmAction({
      title: 'Delete “' + habit.name + '”?',
      message: 'This removes the habit and its ' + total + ' recorded ' + (total === 1 ? 'day' : 'days') + '. Archiving keeps the history instead.',
      detail: 'You can undo this straight afterwards.',
      confirmLabel: 'Delete habit',
      danger: true
    }).then(function (ok) { if (ok) doDelete(habit.id, habit.name); });
  }

  function doDelete(id, name) {
    var snapshot = {
      habit: H.byId(id),
      logs: JSON.parse(JSON.stringify(Afterglow.store.state.logs[id] || {})),
      skips: JSON.parse(JSON.stringify(Afterglow.store.state.skips[id] || {}))
    };
    H.remove(id);
    dom.toast('“' + name + '” deleted.', {
      icon: 'trash',
      duration: 10000,
      actionLabel: 'Undo',
      onAction: function () {
        Afterglow.store.update(function (state) {
          if (snapshot.habit) { state.habits.push(snapshot.habit); state.order.push(snapshot.habit.id); }
          state.logs[snapshot.habit.id] = snapshot.logs;
          state.skips[snapshot.habit.id] = snapshot.skips;
        }, 'habit-undo-delete');
        Afterglow.app.refresh();
      }
    });
    Afterglow.app.refresh();
  }

  function historyDialog(habit) {
    var today = D.todayKey();
    var days = D.lastNDays(35, today);
    var streak = H.streak(habit);
    var best = H.longestStreak(habit);
    var total = H.totalCompletions(habit.id);

    var dayRows = days.slice().reverse().map(function (day) {
      var status = H.statusFor(habit, day);
      var progress = H.entryProgress(habit, day);
      var label = status === 'done' ? 'Recorded' :
        status === 'partial' ? 'Partly recorded (' + progress.amount + '/' + progress.target + ')' :
        status === 'skipped' ? 'Rest day' :
        H.scheduledOn(habit, day) ? 'Not recorded' : 'Not scheduled';
      return h('div', { class: 'timeline-item' },
        h('span', { class: 'timeline-item__mark', 'aria-hidden': 'true', text: D.dayName(D.weekdayOf(day), 'short').slice(0, 2) }),
        h('div', { class: 'timeline-item__body' },
          h('div', { class: 'row row--between' },
            h('span', null,
              h('strong', { text: D.formatShort(day, true) }),
              h('span', { class: 'faint', text: ' · ' + label })
            ),
            (status === 'done' || status === 'skipped' || status === 'partial') ? ui.button({
              label: status === 'skipped' ? 'Un-rest' : 'Undo',
              variant: 'quiet',
              className: 'btn--tiny',
              onClick: function () {
                if (status === 'skipped') H.unskip(habit.id, day); else H.uncomplete(habit.id, day);
                Afterglow.app.refresh();
                dom.announce('Record for ' + D.formatShort(day, true) + ' removed.');
              }
            }) : ui.button({
              label: 'Record',
              variant: 'quiet',
              className: 'btn--tiny',
              onClick: function () {
                if (habit.targetType === 'check' || !habit.targetAmount) { H.complete(habit.id, day); Afterglow.app.refresh(); }
                else Afterglow.editor.askAmount(habit, day, function () { Afterglow.app.refresh(); });
              }
            })
          )
        )
      );
    });

    dom.openModal({
      title: habit.name,
      description: D.scheduleText ? ui.scheduleText(habit) + ' · target: ' + ui.targetText(habit) : '',
      variants: ['wide'],
      body: h('div', { class: 'stack' },
        h('div', { class: 'grid grid--3' },
          ui.statTile({ value: String(streak.current), label: 'Current run', hint: streak.restDays ? streak.restDays + ' rest days included' : 'scheduled days in a row' }),
          ui.statTile({ value: String(best), label: 'Best run' }),
          ui.statTile({ value: String(total), label: 'Days recorded' })
        ),
        ui.weekStrip(habit),
        h('p', { class: 'muted', style: { fontSize: 'var(--step--1)' }, text: 'Recent days, newest first. Anything older stays in your data and in exports.' }),
        h('div', { class: 'plain-list divide' }, dayRows)
      ),
      footer: [
        ui.button({ label: 'Edit habit', icon: 'edit', variant: 'quiet', onClick: function () { Afterglow.editor.openHabit(habit.id); } }),
        ui.button({ label: 'Close', variant: 'primary', onClick: function () { dom.closeTopModal(); } })
      ]
    });
  }

  Afterglow.views.habits = {
    title: 'Habits',
    context: 'Habits',
    render: function (container) {
      var list = H.ordered(true);
      var visible = list.filter(matches);

      container.appendChild(ui.pageHeader({
        eyebrow: 'Structure',
        title: 'Habits',
        lead: 'Create, reorder and edit anything here. Fewer habits repeated is worth more than a long list abandoned, and every habit can be made smaller.',
        actions: [ui.button({ label: 'New habit', icon: 'plus', variant: 'primary', onClick: function () { Afterglow.editor.openHabit(null); } })]
      }));

      container.appendChild(h('div', { class: 'reveal', style: { marginBottom: 'var(--s-4)' } }, toolbar()));

      var today = D.todayKey();
      var groups = [];
      if (filter === 'active' || filter === 'all' || filter === 'today') {
        groups.push({
          label: 'Open today',
          items: visible.filter(function (habit) {
            var status = H.statusFor(habit, today);
            return !habit.archived && H.scheduledOn(habit, today) && (status === 'pending' || status === 'partial');
          })
        });
        groups.push({
          label: 'Recorded today',
          items: visible.filter(function (habit) {
            var status = H.statusFor(habit, today);
            return !habit.archived && H.scheduledOn(habit, today) && (status === 'done' || status === 'skipped');
          })
        });
        groups.push({
          label: 'Not scheduled today',
          items: visible.filter(function (habit) {
            return !habit.archived && !H.scheduledOn(habit, today);
          })
        });
      }
      if (filter === 'archived' || filter === 'all') {
        groups.push({ label: 'Archived', items: visible.filter(function (habit) { return habit.archived; }) });
      }

      var hasAnything = visible.length > 0;
      groups = groups.filter(function (group) { return group.items.length; });

      if (!hasAnything) {
        container.appendChild(ui.card({
          reveal: true,
          body: ui.emptyState({
            icon: 'list',
            title: list.length ? 'Nothing matches that filter' : 'No habits yet',
            text: list.length ? 'Try a different filter or clear the search box.' : 'Start with one habit. Something small enough that a busy day cannot stop it.',
            action: ui.button({ label: 'Create a habit', variant: 'primary', icon: 'plus', onClick: function () { Afterglow.editor.openHabit(null); } })
          })
        }));
        return;
      }

      groups.forEach(function (group) {
        var section = h('section', { class: 'reveal' },
          h('h2', { class: 'habit-group__title', text: group.label + ' · ' + group.items.length }),
          h('div', { class: 'card', style: { padding: 'var(--s-2) var(--s-3)' } },
            group.items.map(function (habit) {
              var globalIndex = list.indexOf(habit);
              return ui.habitRow(habit, {
                date: today,
                actions: habitActions(habit, globalIndex, list.length),
                onToggle: function (target) { Afterglow.app.toggleHabit(target, today); }
              });
            })
          )
        );
        container.appendChild(section);
      });

      container.appendChild(h('div', { class: 'reveal', style: { marginTop: 'var(--s-5)' } },
        h('div', { class: 'notice' },
          icon('undo'),
          h('div', null,
            h('strong', { text: 'Reordering: ' }),
            h('span', { text: 'use the arrow buttons on each habit. Archived habits keep their history and can be restored at any time.' })
          )
        )
      ));
    }
  };
})(typeof window !== 'undefined' ? window : this);
