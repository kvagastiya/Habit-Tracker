/* ==========================================================================
   views/flow.js — the daily plan and the Minimum Day.

   The flow is a suggestion the user owns: blocks can be retimed, reordered,
   removed, or swapped wholesale for a version that fits a 15-minute day.
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

  function state() { return Afterglow.store.state; }
  function doneSet(day) { return state().flow.done[day] || []; }

  function toggleBlockDone(day, blockId) {
    Afterglow.store.update(function (s) {
      var list = s.flow.done[day] || [];
      var at = list.indexOf(blockId);
      if (at > -1) list.splice(at, 1); else list.push(blockId);
      s.flow.done[day] = list;
    }, 'flow-toggle');
  }

  function moveBlock(list, index, delta, key) {
    return Afterglow.store.update(function (s) {
      var target = s.flow[key];
      var next = index + delta;
      if (next < 0 || next >= target.length) return;
      var item = target.splice(index, 1)[0];
      target.splice(next, 0, item);
    }, 'flow-move');
  }

  function removeBlock(block, key) {
    var snapshot = JSON.parse(JSON.stringify(block));
    var index = state().flow[key].findIndex(function (item) { return item.id === block.id; });
    Afterglow.store.update(function (s) {
      s.flow[key] = s.flow[key].filter(function (item) { return item.id !== block.id; });
    }, 'flow-remove');
    dom.toast('“' + block.title + '” removed from the plan.', {
      actionLabel: 'Undo',
      onAction: function () {
        Afterglow.store.update(function (s) { s.flow[key].splice(Math.max(0, index), 0, snapshot); }, 'flow-restore');
        Afterglow.app.refresh();
      }
    });
    Afterglow.app.refresh();
  }

  function blockDialog(block, key, onSave) {
    var isNew = !block;
    var model = block || { title: '', text: '', minutes: 5, category: 'custom' };

    var titleInput = ui.input({ value: model.title, maxlength: 80, placeholder: 'e.g. Focus study' });
    var textInput = ui.input({ value: model.text, maxlength: 200, placeholder: 'What actually happens in this block?' });
    var minutesInput = ui.input({ type: 'number', value: model.minutes, min: 1, max: 120, step: 1 });
    var categorySelect = ui.select({
      value: model.category,
      options: Afterglow.data.CATEGORIES.map(function (category) { return { value: category.id, label: category.label }; })
    });

    dom.openModal({
      title: isNew ? 'Add a block' : 'Edit block',
      description: key === 'plan' ? 'Part of your daily flow.' : 'Part of the Minimum Day plan.',
      body: h('div', null,
        ui.field('Name', titleInput, { hint: 'Short labels are easier to start.' }),
        ui.field('What it involves', textInput),
        h('div', { class: 'field-row' },
          ui.field('Minutes', minutesInput, { hint: 'Be honest — shorter is more likely to happen.' }),
          ui.field('Category', categorySelect)
        )
      ),
      footer: [
        ui.button({
          label: isNew ? 'Add block' : 'Save block',
          variant: 'primary',
          onClick: function () {
            var title = titleInput.value.trim();
            if (!title) { titleInput.focus(); dom.announce('Please give the block a name.'); return; }
            onSave({
              title: title,
              text: textInput.value.trim(),
              minutes: Math.max(1, Math.min(120, Number(minutesInput.value) || 5)),
              category: categorySelect.value
            });
            dom.closeTopModal();
          }
        }),
        ui.button({ label: 'Cancel', variant: 'quiet', onClick: function () { dom.closeTopModal(); } })
      ],
      initialFocus: '#dialog-root input'
    });
  }

  function planCard() {
    var flow = state().flow;
    var day = D.todayKey();
    var done = doneSet(day);
    var total = flow.plan.reduce(function (sum, block) { return sum + block.minutes; }, 0);
    var spent = flow.plan.filter(function (block) { return done.indexOf(block.id) > -1; })
      .reduce(function (sum, block) { return sum + block.minutes; }, 0);

    var list = h('div', { class: 'flow-list' }, flow.plan.map(function (block, index) {
      var complete = done.indexOf(block.id) > -1;
      return h('div', { class: 'flow-block' + (complete ? ' is-done' : '') },
        h('span', { class: 'flow-block__time', text: block.minutes + 'm', 'aria-hidden': 'true' }),
        h('div', { class: 'flow-block__body' },
          h('p', { class: 'flow-block__title' },
            block.title,
            h('span', { class: 'visually-hidden', text: ': ' + block.minutes + ' minutes' })
          ),
          h('p', { class: 'flow-block__text', text: block.text || Afterglow.data.categoryById(block.category).label })
        ),
        h('div', { class: 'flow-block__tools' },
          h('button', {
            class: 'check',
            type: 'button',
            'aria-pressed': complete ? 'true' : 'false',
            'aria-label': (complete ? 'Undo ' : 'Mark done: ') + block.title,
            dataset: { focusKey: 'flow-' + block.id },
            on: {
              click: function () {
                toggleBlockDone(day, block.id);
                if (!complete) dom.announce('Block recorded.');
                Afterglow.app.refresh();
              }
            }
          }, complete ? icon('check') : null),
          ui.iconButton('chevron', 'Move ' + block.title + ' up', function () { moveBlock(flow.plan, index, -1, 'plan'); Afterglow.app.refresh(); }, {
            disabled: index === 0, iconClass: 'icon--sm', className: 'flow-up', title: 'Move up'
          }),
          ui.iconButton('edit', 'Edit ' + block.title, function () {
            blockDialog(block, 'plan', function (patch) {
              Afterglow.store.update(function (s) {
                s.flow.plan = s.flow.plan.map(function (item) { return item.id === block.id ? Object.assign({}, item, patch) : item; });
              }, 'flow-edit');
              Afterglow.app.refresh();
            });
          }, { iconClass: 'icon--sm', title: 'Edit' }),
          ui.iconButton('trash', 'Remove ' + block.title, function () { removeBlock(block, 'plan'); }, { iconClass: 'icon--sm', title: 'Remove' })
        )
      );
    }));

    if (!flow.plan.length) {
      list = ui.emptyState({
        icon: 'flow',
        title: 'The plan is empty',
        text: 'Add two or three realistic blocks, or rebuild a suggested plan for your time budget.',
        action: ui.button({
          label: 'Build a ' + state().profile.budget + '-minute plan', variant: 'primary', icon: 'restart',
          onClick: function () { rebuildPlan(); }
        })
      });
    }

    return ui.card({
      title: 'Today\'s flow',
      subtitle: 'Approximate totals, not a timetable. Move through it in any order.',
      actions: [
        ui.button({ label: 'Add block', icon: 'plus', variant: 'quiet', className: 'btn--small', onClick: function () {
          blockDialog(null, 'plan', function (block) {
            Afterglow.store.update(function (s) { s.flow.plan.push(Object.assign({ id: dom.uid('block') }, block)); }, 'flow-add');
            Afterglow.app.refresh();
          });
        } })
      ],
      body: h('div', { class: 'stack' },
        h('div', { class: 'flow-total' },
          h('strong', { text: D.durationLabel(total) }),
          h('span', { class: 'muted', text: 'in the plan' }),
          spent ? h('span', { class: 'badge badge--sage', text: D.durationLabel(spent) + ' recorded today' }) : null
        ),
        ui.bar({ value: total ? spent / total : 0, variant: 'amber', label: 'Recorded part of today\'s flow' }),
        h('p', { class: 'muted', style: { fontSize: 'var(--step--1)' }, text: 'School, family and rest come first. A block that does not happen today is not a debt.' }),
        list
      ),
      foot: h('div', { class: 'stack stack--tight' },
        h('p', { class: 'eyebrow', text: 'Time budget' }),
        h('div', { class: 'row' },
          ui.segmented({
            ariaLabel: 'Time budget',
            value: state().profile.budget,
            items: [{ value: 15, label: '15 min' }, { value: 20, label: '20 min' }, { value: 30, label: '30 min' }],
            onSelect: function (value) {
              Afterglow.store.update(function (s) { s.profile.budget = Number(value); }, 'budget');
              dom.confirmAction({
                title: 'Rebuild the flow for ' + value + ' minutes?',
                message: 'This replaces the current blocks with a suggested plan for that budget.',
                confirmLabel: 'Rebuild',
                cancelLabel: 'Keep my blocks'
              }).then(function (ok) {
                if (ok) rebuildPlan(Number(value));
                else Afterglow.app.refresh();
              });
            }
          }),
          h('span', { class: 'faint', style: { fontSize: 'var(--step--1)' }, text: 'Suggested plans are editable immediately.' })
        )
      )
    });
  }

  function rebuildPlan(minutes) {
    var budget = minutes || state().profile.budget || 20;
    Afterglow.store.update(function (s) {
      s.flow.plan = Afterglow.store.flowPlanFor(budget);
      s.flow.planBudget = budget;
      s.profile.budget = budget;
    }, 'flow-rebuild');
    dom.toast('Rebuilt the plan for ' + budget + ' minutes. It is yours to edit.', { icon: 'flow' });
    Afterglow.app.refresh();
  }

  function minimumCard() {
    var flow = state().flow;
    var day = D.todayKey();
    var done = doneSet(day);
    var total = flow.minimum.blocks.reduce(function (sum, block) { return sum + block.minutes; }, 0);

    var body = h('div', { class: 'stack' },
      h('p', { class: 'muted', text: 'Some days there is no room for a real routine. This plan asks for almost nothing: one tiny study action, a brief stretch or walk, and one basic reset. It exists so an ordinary bad day still has a low bar, not a lowered one.' }),
      flow.minimum.blocks.length ? h('div', { class: 'flow-list' }, flow.minimum.blocks.map(function (block, index) {
        var complete = done.indexOf(block.id) > -1;
        return h('div', { class: 'flow-block' + (complete ? ' is-done' : '') },
          h('span', { class: 'flow-block__time', text: block.minutes + 'm', 'aria-hidden': 'true' }),
          h('div', { class: 'flow-block__body' },
            h('p', { class: 'flow-block__title', text: block.title }),
            h('p', { class: 'flow-block__text', text: block.text })
          ),
          h('div', { class: 'flow-block__tools' },
            h('button', {
              class: 'check', type: 'button',
              'aria-pressed': complete ? 'true' : 'false',
              'aria-label': (complete ? 'Undo ' : 'Mark done: ') + block.title,
              dataset: { focusKey: 'minimum-' + block.id },
              on: { click: function () { toggleBlockDone(day, block.id); Afterglow.app.refresh(); } }
            }, complete ? icon('check') : null),
            ui.iconButton('chevron', 'Move ' + block.title + ' up', function () { moveBlock(flow.minimum.blocks, index, -1, 'minimum.blocks'); Afterglow.app.refresh(); }, { disabled: index === 0, iconClass: 'icon--sm', title: 'Move up' }),
            ui.iconButton('edit', 'Edit ' + block.title, function () {
              blockDialog(block, 'minimum.blocks', function (patch) {
                Afterglow.store.update(function (s) {
                  s.flow.minimum.blocks = s.flow.minimum.blocks.map(function (item) { return item.id === block.id ? Object.assign({}, item, patch) : item; });
                }, 'flow-min-edit');
                Afterglow.app.refresh();
              });
            }, { iconClass: 'icon--sm', title: 'Edit' }),
            ui.iconButton('trash', 'Remove ' + block.title, function () { removeBlock(block, 'minimum.blocks'); }, { iconClass: 'icon--sm', title: 'Remove' })
          )
        );
      })) : ui.emptyState({ icon: 'moon', title: 'Minimum Day is turned off', text: 'Nothing is required. You can switch it back on whenever a low day needs a plan that fits it.' })
    );

    return ui.card({
      className: 'minimum-card',
      title: 'Minimum Day',
      subtitle: total ? 'About ' + D.durationLabel(total) + ' in total' : null,
      actions: [
        h('label', { class: 'switch', style: { marginLeft: 'auto' } },
          h('input', {
            type: 'checkbox', checked: flow.minimum.enabled,
            on: {
              change: function (event) {
                var checked = event.target.checked;
                Afterglow.store.update(function (s) { s.flow.minimum.enabled = checked; }, 'minimum-toggle');
                dom.announce(checked ? 'Minimum Day enabled.' : 'Minimum Day disabled.');
                Afterglow.app.refresh();
              }
            }
          }),
          h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
          h('span', { text: 'Enabled' })
        ),
        ui.button({ label: 'Add', icon: 'plus', variant: 'quiet', className: 'btn--small', onClick: function () {
          blockDialog(null, 'minimum.blocks', function (block) {
            Afterglow.store.update(function (s) {
              s.flow.minimum.blocks.push(Object.assign({ id: dom.uid('min') }, block));
              s.flow.minimum.enabled = true;
            }, 'flow-min-add');
            Afterglow.app.refresh();
          });
        } })
      ],
      body: flow.minimum.enabled ? body : h('p', { class: 'muted', text: 'Minimum Day is off. Turn it on to keep a three-block plan ready for a busy or low day. Nothing is required while it is off.' })
    });
  }

  Afterglow.views.flow = {
    title: 'Daily flow',
    context: 'Daily flow',
    render: function (container) {
      var budget = state().profile.budget;
      container.appendChild(ui.pageHeader({
        eyebrow: 'Rhythm',
        title: 'Daily flow',
        lead: 'A short sequence sized to what you actually have. Rearrange it, delete blocks, or switch to Minimum Day — none of it is a contract.',
        actions: [
          ui.button({ label: 'Start a focus session', icon: 'clock', variant: 'primary', onClick: function () { Afterglow.app.go('focus'); } }),
          ui.button({ label: 'No motivation', icon: 'spark', variant: 'glow', onClick: function () { Afterglow.app.openMotivation(); } })
        ]
      }));

      container.appendChild(h('div', { class: 'stack' },
        h('div', { class: 'grid grid--2' },
          h('div', { class: 'stack' }, planCard()),
          h('div', { class: 'stack' }, minimumCard(),
            ui.card({
              title: 'Why this is short',
              body: h('div', { class: 'prose' },
                h('p', { class: 'muted', text: 'Fifteen focused minutes on most days beats a two-hour plan attempted twice. Your current budget is ' + budget + ' minutes; you can change it in Settings whenever it stops fitting.' }),
                ui.button({ label: 'Open settings', variant: 'quiet', className: 'btn--small', icon: 'settings', onClick: function () { Afterglow.app.go('settings'); } })
              )
            })
          )
        )
      ));
    }
  };
})(typeof window !== 'undefined' ? window : this);
