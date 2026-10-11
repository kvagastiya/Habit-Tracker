/* ==========================================================================
   editor.js — the habit editor and the small "how much?" dialog.

   One editor for creating and editing, with everything that matters in one
   scroll: name, category, icon, accent, target, schedule and a reminder note.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var dom = Afterglow.dom;
  var ui = Afterglow.ui;
  var h = dom.h;
  var icon = dom.icon;
  var D = Afterglow.dates;

  var ICONS = ['book', 'leaf', 'moon', 'heart', 'spark', 'shield', 'target', 'tools', 'clock', 'journal', 'check', 'journey'];

  function openHabit(habitId) {
    var habit = habitId ? Afterglow.habits.byId(habitId) : null;
    var model = habit ? {
      name: habit.name,
      description: habit.description,
      category: habit.category,
      icon: habit.icon,
      accent: habit.accent,
      targetType: habit.targetType,
      targetAmount: habit.targetAmount,
      scheduleType: habit.schedule.type,
      days: habit.schedule.days.slice(),
      reminder: habit.reminder
    } : {
      name: '',
      description: '',
      category: 'study',
      icon: 'book',
      accent: 'amber',
      targetType: 'check',
      targetAmount: 20,
      scheduleType: 'daily',
      days: [0, 1, 2, 3, 4, 5, 6],
      reminder: ''
    };

    var amountField = null;
    var dialog = null;

    function renderForm() {
      var nameInput = ui.input({ value: model.name, maxlength: 90, placeholder: 'e.g. Study with focus' });
      nameInput.addEventListener('input', function () { model.name = nameInput.value; });

      var descriptionInput = ui.input({ value: model.description, maxlength: 180, placeholder: 'One short line, optional' });
      descriptionInput.addEventListener('input', function () { model.description = descriptionInput.value; });

      var amountInput = ui.input({
        type: 'number',
        value: model.targetAmount || 1,
        min: 1,
        max: 100000,
        step: model.targetType === 'pages' ? 1 : 1
      });
      amountInput.addEventListener('input', function () { model.targetAmount = Number(amountInput.value) || 1; });

      var typeSelect = ui.select({
        value: model.targetType,
        options: Afterglow.data.TARGET_TYPES.map(function (type) { return { value: type.id, label: type.label }; }),
        on: {
          change: function (event) {
            model.targetType = event.target.value;
            if (model.targetType !== 'check' && (!model.targetAmount || model.targetAmount < 1)) model.targetAmount = 5;
            renderForm();
          }
        }
      });

      var amountWrap = h('div', { class: 'field' });
      if (model.targetType !== 'check') {
        amountWrap.appendChild(h('label', { for: amountInput.id || (amountInput.id = dom.uid('amount')), text: 'Target amount (' + Afterglow.data.targetTypeById(model.targetType).unit + ')' }));
        amountWrap.appendChild(amountInput);
        amountWrap.appendChild(h('span', { class: 'field__hint', text: Afterglow.data.targetTypeById(model.targetType).hint }));
      }

      var scheduleSegmented = ui.segmented({
        ariaLabel: 'Schedule',
        value: model.scheduleType,
        items: [{ value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Chosen days' }],
        onSelect: function (value) {
          model.scheduleType = value;
          if (value === 'weekdays' && model.days.length === 7) model.days = [1, 2, 3, 4, 5];
          renderForm();
        }
      });

      var dayPicker = model.scheduleType === 'weekdays'
        ? ui.dayPicker({ value: model.days, onChange: function (days) { model.days = days.length ? days : [1, 2, 3, 4, 5]; renderForm(); } })
        : null;

      var reminderInput = ui.input({ value: model.reminder, maxlength: 120, placeholder: 'e.g. straight after dinner' });
      reminderInput.addEventListener('input', function () { model.reminder = reminderInput.value; });

      var preview = ui.habitDot({ accent: model.accent });

      var body = h('div', null,
        h('div', { class: 'editor-section' },
          h('h3', { text: 'The habit' }),
          ui.field('Name', nameInput, { hint: 'Name it the way you would say it out loud.' }),
          ui.field('Description', descriptionInput),
          h('div', { class: 'field' },
            h('span', { class: 'fieldset__legend', text: 'Category' }),
            ui.chipSelect({
              items: Afterglow.data.CATEGORIES.map(function (category) {
                return { value: category.id, label: category.label, icon: category.icon };
              }),
              isSelected: function (value) { return model.category === value; },
              onSelect: function (value) {
                model.category = value;
                model.icon = Afterglow.data.categoryById(value).icon;
                model.accent = Afterglow.data.categoryById(value).accent;
                renderForm();
              }
            })
          )
        ),
        h('div', { class: 'editor-section' },
          h('h3', { text: 'Target' }),
          h('div', { class: 'field-row' }, ui.field('Type', typeSelect), amountWrap),
          h('p', { class: 'field__hint', text: 'A measured target is logged as a number. Partial amounts are saved as progress and never counted as a completed habit.' })
        ),
        h('div', { class: 'editor-section' },
          h('h3', { text: 'Schedule' }),
          h('div', { class: 'field' }, h('span', { class: 'fieldset__legend', text: 'How often' }), scheduleSegmented),
          dayPicker ? h('div', { class: 'field' }, h('span', { class: 'fieldset__legend', text: 'Days' }), dayPicker) : null,
          ui.field('Reminder note', reminderInput, { hint: 'Text for you — Afterglow does not send browser notifications.' })
        ),
        h('div', { class: 'editor-section' },
          h('h3', { text: 'Look' }),
          h('div', { class: 'field' },
            h('span', { class: 'fieldset__legend', text: 'Symbol' }),
            ui.chipSelect({
              ariaLabel: 'Habit symbol',
              items: ICONS.map(function (name) { return { value: name, label: name, icon: name }; }),
              isSelected: function (value) { return model.icon === value; },
              onSelect: function (value) { model.icon = value; renderForm(); }
            })
          ),
          h('div', { class: 'field' },
            h('span', { class: 'fieldset__legend', text: 'Accent' }),
            ui.chipSelect({
              ariaLabel: 'Habit accent colour',
              items: Afterglow.data.ACCENTS.map(function (accent) { return { value: accent.id, label: accent.label, icon: 'spark' }; }),
              isSelected: function (value) { return model.accent === value; },
              onSelect: function (value) { model.accent = value; renderForm(); }
            })
          ),
          h('div', { class: 'row' }, h('span', { class: 'faint', text: 'Preview' }), preview, h('strong', { text: model.name || 'Your habit' }))
        )
      );

      dom.mount(dialog.modal.querySelector('#habit-editor-body'), body);
      var foot = dialog.modal.querySelector('.modal__foot');
      dom.mount(foot, [
        ui.button({
          label: habit ? 'Save changes' : 'Create habit',
          icon: 'check',
          variant: 'primary',
          onClick: function () {
            var name = nameInput.value.trim();
            if (!name) { nameInput.focus(); dom.announce('A habit needs a name.'); nameInput.setAttribute('aria-invalid', 'true'); return; }
            var payload = {
              name: name,
              description: descriptionInput.value.trim(),
              category: model.category,
              icon: model.icon,
              accent: model.accent,
              targetType: model.targetType,
              targetAmount: model.targetType === 'check' ? null : Math.max(1, Number(model.targetAmount) || 1),
              schedule: { type: model.scheduleType, days: model.days.slice().sort() },
              reminder: reminderInput.value.trim()
            };
            if (habit) {
              Afterglow.habits.edit(habit.id, payload);
              dom.toast('“' + payload.name + '” updated.', { icon: 'check' });
            } else {
              Afterglow.habits.create(payload);
              dom.toast('“' + payload.name + '” added.', { icon: 'plus' });
            }
            dialog.close('saved');
            Afterglow.app.refresh();
          }
        }),
        ui.button({ label: 'Cancel', variant: 'quiet', onClick: function () { dialog.close('cancel'); } }),
        habit ? h('span', { class: 'spacer' }) : null,
        habit ? ui.button({
          label: habit.archived ? 'Restore habit' : 'Archive habit',
          icon: 'archive',
          variant: 'quiet',
          onClick: function () {
            Afterglow.habits.setArchived(habit.id, !habit.archived);
            dom.toast(habit.archived ? 'Habit restored.' : 'Habit archived — history kept.', { icon: 'archive' });
            dialog.close('archived');
            Afterglow.app.refresh();
          }
        }) : null,
        habit ? ui.button({
          label: 'Delete', icon: 'trash', variant: 'danger',
          onClick: function () {
            dialog.close('delete-request');
            dom.confirmAction({
              title: 'Delete “' + habit.name + '”?',
              message: 'The habit and its ' + Afterglow.habits.totalCompletions(habit.id) + ' recorded days will be removed.',
              confirmLabel: 'Delete habit',
              danger: true
            }).then(function (ok) {
              if (!ok) return;
              Afterglow.habits.remove(habit.id);
              dom.toast('“' + habit.name + '” deleted.', { icon: 'trash' });
              Afterglow.app.refresh();
            });
          }
        }) : null
      ]);
    }

    dialog = dom.openModal({
      title: habit ? 'Edit habit' : 'New habit',
      description: 'Everything here can be changed later. Smaller targets are easier to keep.',
      variants: ['wide'],
      body: h('div', { id: 'habit-editor-body' }),
      footer: h('div', { class: 'modal__foot' }),
      onMount: function () {
        renderForm();
        var first = dialog.modal.querySelector('input');
        if (first) first.focus();
      }
    });
    return dialog;
  }

  /** Ask for a measured amount for a habit, then record it. */
  function askAmount(habit, date, onDone) {
    var type = Afterglow.data.targetTypeById(habit.targetType);
    var amountInput = ui.input({ type: 'number', value: habit.targetAmount || 1, min: 0.1, max: 100000, step: 1, ariaLabel: 'Amount' });
    var target = habit.targetAmount || 1;
    var presets = [Math.round(target / 2), target, target * 2].filter(function (value, index, list) {
      return value > 0 && list.indexOf(value) === index;
    });

    dom.openModal({
      title: 'How much for “' + habit.name + '”?',
      description: 'Target: ' + target + ' ' + type.unit + '. Anything less is saved as progress, not as a completed habit.',
      body: h('div', null,
        ui.field('Amount (' + type.unit + ')', amountInput),
        h('div', { class: 'chip-select' }, presets.map(function (value) {
          return h('button', {
            class: 'chip', type: 'button',
            on: { click: function () { amountInput.value = value; amountInput.focus(); } }
          }, h('span', { text: value + ' ' + type.unit }));
        }))
      ),
      footer: [
        ui.button({
          label: 'Record',
          icon: 'check',
          variant: 'primary',
          onClick: function () {
            var value = Number(amountInput.value);
            if (!value || value <= 0) { amountInput.focus(); return; }
            Afterglow.habits.complete(habit.id, date, value);
            var progress = Afterglow.habits.entryProgress(habit, date);
            dom.toast(progress && progress.complete
              ? 'Recorded ' + value + ' ' + type.unit + ' — target reached.'
              : 'Saved ' + value + ' ' + type.unit + ' as progress.', { icon: 'check' });
            dom.closeTopModal();
            if (onDone) onDone();
          }
        }),
        ui.button({ label: 'Cancel', variant: 'quiet', onClick: function () { dom.closeTopModal(); } })
      ],
      initialFocus: '#dialog-root input'
    });
  }

  Afterglow.editor = { openHabit: openHabit, askAmount: askAmount };
  Afterglow.editor.openHabit = openHabit;
})(typeof window !== 'undefined' ? window : this);
