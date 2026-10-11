/* ==========================================================================
   onboarding.js — a short welcome flow.

   Optional, skippable, and no personal information beyond a nickname the user
   chooses to give. Whatever is chosen here only shapes starter habits, the
   suggested plan and the theme.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var dom = Afterglow.dom;
  var ui = Afterglow.ui;
  var h = dom.h;
  var icon = dom.icon;

  var STEPS = ['Welcome', 'Focus', 'Time', 'Look'];

  function open(options) {
    var opts = options || {};
    var draft = {
      step: 0,
      name: Afterglow.store.state.profile.name || '',
      focus: Afterglow.store.state.profile.focus || 'balanced',
      budget: Afterglow.store.state.profile.budget || 20,
      dayStart: Afterglow.store.state.profile.dayStart || '07:00',
      theme: Afterglow.store.state.settings.theme || 'dark'
    };

    var dialog = null;

    function progressBar() {
      return h('div', { class: 'onboarding-steps', 'aria-hidden': 'true' },
        STEPS.map(function (label, index) {
          return h('span', { dataset: { active: String(index <= draft.step) }, title: label });
        })
      );
    }

    function stepBody() {
      if (draft.step === 0) {
        var nameInput = ui.input({ value: draft.name, maxlength: 60, placeholder: 'Optional', ariaLabel: 'What should Afterglow call you' });
        nameInput.addEventListener('input', function () { draft.name = nameInput.value; });
        return h('div', null,
          h('span', { class: 'orb orb--small', 'aria-hidden': 'true', style: { marginBottom: 'var(--s-4)' } }),
          h('h2', { text: opts.revisit ? 'Welcome back' : 'Welcome to Afterglow' }),
          h('p', { class: 'muted', text: 'This is a small, private dashboard for improving a little at a time. It runs entirely in your browser: no account, no email, no password, and nothing sent anywhere.' }),
          ui.field('What should Afterglow call you?', nameInput, { hint: 'Optional. Any nickname works, and you can change it later.' }),
          h('div', { class: 'notice' }, icon('shield'),
            h('div', null,
              h('strong', { text: 'Stored locally. ' }),
              h('span', { text: 'Your habits and notes live on this device only. Clearing browser data removes them, so exports are available in Settings.' })
            )
          )
        );
      }
      if (draft.step === 1) {
        return h('div', null,
          h('h2', { text: 'Where would you like to start?' }),
          h('p', { class: 'muted', text: 'This only shapes the handful of sample habits you begin with. Everything is editable, and “a balanced mix” is a perfectly good answer.' }),
          h('div', { class: 'onboarding-choice' }, [
            { value: 'studies', label: 'Studies', hint: 'Focus sessions, notes and revision' },
            { value: 'health', label: 'Health and movement', hint: 'Short movement and steady basics' },
            { value: 'confidence', label: 'Confidence', hint: 'Small brave actions, privately marked' },
            { value: 'routines', label: 'Routines and sleep', hint: 'Timing, wind-down and resets' },
            { value: 'balanced', label: 'A balanced mix', hint: 'A little of everything, unstressfully' }
          ].map(function (choice) {
            return h('button', {
              class: 'choice-card', type: 'button',
              'aria-pressed': draft.focus === choice.value ? 'true' : 'false',
              on: { click: function () { draft.focus = choice.value; refresh(); } }
            }, h('strong', { text: choice.label }), h('small', { text: choice.hint }));
          }))
        );
      }
      if (draft.step === 2) {
        var timeInput = ui.input({ type: 'time', value: draft.dayStart, ariaLabel: 'Typical day start' });
        timeInput.addEventListener('change', function () { draft.dayStart = timeInput.value; });
        return h('div', null,
          h('h2', { text: 'How much time is realistic?' }),
          h('p', { class: 'muted', text: 'Not how much you wish you had — how much an ordinary weekday can hold. Fifteen minutes kept is better than thirty abandoned.' }),
          h('div', { class: 'field' },
            h('span', { class: 'field__hint', text: 'Daily budget' }),
            ui.segmented({
              ariaLabel: 'Daily budget',
              value: draft.budget,
              items: [{ value: 15, label: '15 minutes' }, { value: 20, label: '20 minutes' }, { value: 30, label: '30 minutes' }],
              onSelect: function (value) { draft.budget = Number(value); refresh(); }
            })
          ),
          ui.field('When does your day usually start?', timeInput, { hint: 'Used only as a rough anchor for the plans you write yourself.' })
        );
      }
      return h('div', null,
        h('h2', { text: 'Which room would you rather sit in?' }),
        h('p', { class: 'muted', text: 'You can switch instantly at any time from the header or in Settings.' }),
        h('div', { class: 'onboarding-choice' },
          h('button', {
            class: 'choice-card', type: 'button',
            'aria-pressed': draft.theme === 'dark' ? 'true' : 'false',
            on: { click: function () { draft.theme = 'dark'; Afterglow.app.setTheme('dark'); refresh(); } }
          }, h('strong', { text: 'Afterglow (dark)' }), h('small', { text: 'Ink, sage and candlelight. The default.' })),
          h('button', {
            class: 'choice-card', type: 'button',
            'aria-pressed': draft.theme === 'light' ? 'true' : 'false',
            on: { click: function () { draft.theme = 'light'; Afterglow.app.setTheme('light'); refresh(); } }
          }, h('strong', { text: 'Dawnlight (light)' }), h('small', { text: 'Warm parchment with forest green.' }))
        ),
        h('p', { class: 'faint', style: { fontSize: 'var(--step--1)', marginTop: 'var(--s-4)' }, text: 'Next you will land on your dashboard with a few sample habits ready to edit or delete.' })
      );
    }

    function footer() {
      var buttons = [];
      if (draft.step > 0) {
        buttons.push(ui.button({ label: 'Back', variant: 'quiet', onClick: function () { draft.step--; refresh(); } }));
      }
      buttons.push(ui.button({
        label: 'Skip for now',
        variant: 'quiet',
        onClick: function () {
          finish({ skipped: true });
        }
      }));
      buttons.push(h('span', { class: 'spacer' }));
      buttons.push(ui.button({
        label: draft.step === STEPS.length - 1 ? (opts.revisit ? 'Save preferences' : 'Open my dashboard') : 'Continue',
        icon: draft.step === STEPS.length - 1 ? 'spark' : 'chevron',
        variant: 'primary',
        onClick: function () {
          if (draft.step === STEPS.length - 1) finish({ skipped: false });
          else { draft.step++; refresh(); }
        }
      }));
      return buttons;
    }

    function refresh() {
      if (!dialog) return;
      var body = h('div', null, progressBar(), stepBody());
      dom.mount(dialog.modal.querySelector('.onboarding-body'), body);
      var foot = dialog.modal.querySelector('.modal__foot');
      dom.mount(foot, footer());
      var heading = dialog.modal.querySelector('.onboarding-body h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }

    function finish(result) {
      var state = Afterglow.store.state;
      var profile = {
        onboarded: true,
        name: draft.name.trim().slice(0, 60),
        focus: draft.focus,
        budget: draft.budget,
        dayStart: draft.dayStart
      };
      Afterglow.store.update(function (s) {
        s.profile = Object.assign({}, s.profile, profile);
        s.settings.theme = draft.theme;
      }, 'onboarding');

      if (!opts.revisit && !state.meta.seeded) {
        Afterglow.store.seedContent(profile);
      }
      if (opts.revisit) {
        dom.toast('Preferences saved.', { icon: 'check' });
      } else if (result && result.skipped) {
        dom.toast('Skipped. Nothing is required — the sample habits are there when you want them.', { icon: 'spark' });
      } else {
        dom.toast('Welcome. Start with one thing, and make it small.', { icon: 'spark' });
      }
      if (dialog) dialog.close('finished');
      Afterglow.app.applyTheme();
      Afterglow.app.refresh();
    }

    dialog = dom.openModal({
      title: null,
      ariaLabel: 'Welcome to Afterglow',
      variants: ['wide'],
      dismissible: false,
      body: h('div', { class: 'onboarding-body' }),
      footer: h('div', { class: 'modal__foot' }),
      onMount: function () { refresh(); }
    });
  }

  Afterglow.onboarding = { open: open };
})(typeof window !== 'undefined' ? window : this);
