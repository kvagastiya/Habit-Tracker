/* ==========================================================================
   motivation-modal.js — the "I have no motivation" flow.

   Design rules baked into this file:
   - one suggestion at a time, always with an honest duration
   - a ladder: "make it even smaller" never runs out until the last rung
   - rest is offered as a legitimate answer, not a consolation prize
   - finishing records a small win; a habit is only marked complete when the
     user confirms that the action actually satisfied it
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};
  var dom = Afterglow.dom;
  var ui = Afterglow.ui;
  var h = dom.h;
  var icon = dom.icon;
  var D = Afterglow.dates;

  var flow = null;
  var dialog = null;
  var ticker = null;

  function open() {
    flow = {
      current: null,
      mode: 'suggest',   // suggest | running | done | declined
      startedAt: null,
      exclude: [],
      winText: ''
    };
    flow.current = Afterglow.motivation.suggestion({ exclude: [] });

    dialog = dom.openModal({
      title: null,
      ariaLabel: 'I have no motivation',
      variants: ['drawer', 'soft'],
      body: h('div', { class: 'motivation', id: 'motivation-body' }),
      footer: h('div', { class: 'modal__foot', id: 'motivation-foot' }),
      onClose: function () { stopTicker(); },
      onMount: function () { render(); }
    });
    return dialog;
  }

  function stopTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  function elapsedSeconds() {
    if (!flow.startedAt) return 0;
    return Math.floor((Date.now() - flow.startedAt) / 1000);
  }

  function setMode(mode) {
    flow.mode = mode;
    render();
  }

  function render() {
    if (!dialog) return;
    var body = dialog.modal.querySelector('#motivation-body');
    var foot = dialog.modal.querySelector('#motivation-foot');
    if (!body || !foot) return;

    stopTicker();
    dom.mount(body, bodyForMode());
    dom.mount(foot, footForMode());

    if (flow.mode === 'running') {
      startTicker();
    }
    var focusTarget = body.querySelector('[data-autofocus]');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function startTicker() {
    stopTicker();
    ticker = setInterval(function () {
      var node = dialog && dialog.modal.querySelector('#motivation-clock');
      if (!node) return;
      var left = Math.max(0, flow.current.seconds - elapsedSeconds());
      node.textContent = D.clockLabel(left);
      if (left <= 0) {
        stopTicker();
        var message = dialog.modal.querySelector('#motivation-run-note');
        if (message) message.textContent = 'That is the whole thing. You can stop here, or keep going if it is working.';
        dom.announce('Suggested time is up. You can stop here.');
      }
    }, 500);
  }

  function bodyForMode() {
    if (flow.mode === 'running') return runningBody();
    if (flow.mode === 'done') return doneBody();
    if (flow.mode === 'declined') return declinedBody();
    return suggestBody();
  }

  function suggestBody() {
    var current = flow.current;
    if (!current) {
      return h('div', { class: 'motivation' },
        h('span', { class: 'orb orb--small', 'aria-hidden': 'true' }),
        h('p', { class: 'motivation__lead', text: 'Nothing to suggest right now.' }),
        h('p', { class: 'muted', text: 'That is unusual — try reopening this from the dashboard.' })
      );
    }
    var category = Afterglow.data.categoryById(current.category);
    var rest = current.isRest;

    return h('div', { class: 'motivation' },
      h('span', { class: 'orb orb--small', 'aria-hidden': 'true' }),
      h('p', { class: 'motivation__lead', text: current.comfort }),
      h('div', { class: 'motivation__action' },
        h('div', { class: 'motivation__meta' },
          ui.badge(rest ? 'Rest' : category.label, rest ? 'moon' : 'amber', rest ? 'moon' : category.icon),
          ui.badge('about ' + D.humanDuration(current.seconds), 'quiet', 'clock'),
          current.rung > 0 ? ui.badge('shrunk ×' + current.rung, 'sage', 'restart') : null
        ),
        h('h2', { class: 'motivation__action-title', text: current.title, tabindex: '-1' }),
        h('p', { class: 'muted', style: { margin: '0 0 var(--s-3)' }, text: current.hint }),
        h('div', { class: 'motivation__steps' },
          ui.button({
            label: 'Let\'s do it', icon: 'play', variant: 'primary',
            onClick: function () {
              flow.startedAt = Date.now();
              setMode('running');
              dom.announce('Started: ' + current.title);
            }
          }),
          ui.button({
            label: Afterglow.motivation.isSmallest(current) ? 'Smallest option already' : 'Make it even smaller',
            icon: 'restart',
            variant: 'quiet',
            disabled: Afterglow.motivation.isSmallest(current),
            onClick: function () {
              var smaller = Afterglow.motivation.shrink(current);
              if (!smaller) return;
              flow.current = smaller;
              render();
              dom.announce('Smaller version: ' + smaller.title);
            }
          }),
          ui.button({
            label: 'Give me another idea', icon: 'spark', variant: 'quiet',
            onClick: function () {
              flow.exclude.push(current.id);
              var next = Afterglow.motivation.suggestion({ exclude: flow.exclude });
              if (!next) { flow.exclude = []; next = Afterglow.motivation.suggestion({ exclude: [current.id] }); }
              flow.current = next;
              render();
              dom.announce('New suggestion: ' + (next ? next.title : 'none available'));
            }
          }),
          ui.button({
            label: 'Not now', variant: 'quiet',
            onClick: function () { setMode('declined'); }
          })
        )
      ),
      h('p', { class: 'motivation__recent', text: 'Chosen from a local list of small actions, weighted by what you have open today. Nothing here is generated by an AI, and nothing is sent anywhere.' })
    );
  }

  function runningBody() {
    var current = flow.current;
    var left = Math.max(0, current.seconds - elapsedSeconds());
    var isRest = current.isRest;
    return h('div', { class: 'motivation-run' },
      h('span', { class: 'orb', 'aria-hidden': 'true' }),
      h('p', { class: 'eyebrow', text: isRest ? 'Resting' : 'In progress' }),
      h('p', { style: { fontSize: 'var(--step-1)', color: 'var(--text-strong)', margin: '0 0 var(--s-2)', fontFamily: 'var(--font-display)' }, text: current.title }),
      h('span', { class: 'motivation-run__time', id: 'motivation-clock', text: D.clockLabel(left), 'aria-hidden': 'true' }),
      h('p', { class: 'muted', id: 'motivation-run-note', text: 'Counting down softly. Stop whenever you like — nothing is being scored.' }),
      h('div', { class: 'motivation__steps', 'data-autofocus': 'true' },
        ui.button({
          label: 'Done', icon: 'check', variant: 'primary',
          onClick: function () { stopTicker(); setMode('done'); }
        }),
        ui.button({
          label: 'Stop for now', variant: 'quiet',
          onClick: function () {
            stopTicker();
            dom.toast('Stopped. Nothing recorded — and nothing lost either.', { icon: 'moon' });
            dialog.close('stopped');
          }
        })
      )
    );
  }

  function doneBody() {
    var current = flow.current;
    var options = Afterglow.motivation.recordingOptions(current);
    var winInput = ui.input({ value: flow.winText, maxlength: 300, placeholder: 'One line, optional', ariaLabel: 'Small win text' });
    var isRest = current.isRest;

    var recordButtons = [];
    if (options.canComplete.length) {
      var habit = options.canComplete[0];
      var isTick = habit.targetType === 'check' || !habit.targetAmount;
      recordButtons.push(ui.button({
        label: isTick ? 'Mark “' + habit.name + '” done' : 'Log ' + options.minutes + ' min to “' + habit.name + '”',
        icon: 'check',
        variant: 'primary',
        onClick: function () {
          if (isTick) Afterglow.habits.complete(habit.id);
          else Afterglow.habits.complete(habit.id, null, options.minutes);
          if (winInput.value.trim()) Afterglow.wins.add(winInput.value.trim(), 'motivation');
          dom.toast('Recorded against “' + habit.name + '”.', { icon: 'check' });
          dialog.close('recorded');
          Afterglow.app.refresh();
        }
      }));
    }
    if (options.partial) {
      var partialHabit = options.habits[0];
      recordButtons.push(ui.button({
        label: 'Log ' + options.minutes + ' min as progress',
        icon: 'clock',
        variant: 'quiet',
        onClick: function () {
          Afterglow.habits.complete(partialHabit.id, null, options.minutes);
          if (winInput.value.trim()) Afterglow.wins.add(winInput.value.trim(), 'motivation');
          dom.toast('Saved as progress toward “' + partialHabit.name + '”.', { icon: 'clock' });
          dialog.close('progress');
          Afterglow.app.refresh();
        }
      }));
    }

    return h('div', { class: 'motivation' },
      h('span', { class: 'orb orb--small', 'aria-hidden': 'true' }),
      h('p', { class: 'motivation__lead', text: isRest ? 'Rest counts as an answer.' : 'That was a real thing you just did.' }),
      h('p', { class: 'muted', text: isRest
        ? 'You chose rest deliberately instead of scrolling past the feeling. That is a decision, not a gap.'
        : 'Record it if it is useful — or close this and carry on with your day.' }),
      ui.field('Keep a small win?', winInput, { hint: 'Only saved if you record something below.' }),
      h('div', { class: 'motivation__steps' }, recordButtons.length ? recordButtons : null),
      h('div', { class: 'motivation__steps' },
        ui.button({
          label: 'Keep as a small win', icon: 'spark', variant: recordButtons.length ? 'quiet' : 'primary',
          onClick: function () {
            var text = winInput.value.trim() || defaultWinText(current);
            Afterglow.wins.add(text, 'motivation');
            dom.toast('Kept in your small wins.', { icon: 'spark' });
            dialog.close('win');
            Afterglow.app.refresh();
          }
        }),
        ui.button({
          label: 'Just close', variant: 'quiet',
          onClick: function () { dialog.close('closed'); }
        })
      ),
      !recordButtons.length && !isRest ? h('p', { class: 'motivation__recent', text: 'No habit in your list matches this closely enough to record automatically, so nothing has been marked complete for you.' }) : null
    );
  }

  function defaultWinText(current) {
    return 'Did the small version: ' + current.title.toLowerCase();
  }

  function declinedBody() {
    var line = dom.pick(Afterglow.data.MOTIVATION_DECLINES) || Afterglow.data.MOTIVATION_DECLINES[0];
    return h('div', { class: 'motivation' },
      h('span', { class: 'orb orb--small', 'aria-hidden': 'true' }),
      h('p', { class: 'motivation__lead', text: line }),
      h('p', { class: 'muted', text: 'Everything else in Afterglow still works. You can tick a habit, write a line in the journal, or close the tab entirely — all of those are fine.' }),
      h('div', { class: 'motivation__steps' },
        ui.button({ label: 'Choose rest instead', icon: 'moon', variant: 'quiet', onClick: function () {
          var restAction = Afterglow.motivation.suggestion({
            exclude: flow.exclude,
            context: { hour: 23 }
          });
          flow.current = restAction;
          setMode('suggest');
        } }),
        ui.button({ label: 'Close', variant: 'primary', onClick: function () { dialog.close('declined'); } })
      )
    );
  }

  function footForMode() {
    if (flow.mode === 'declined') return [ui.button({ label: 'Back to the dashboard', variant: 'quiet', onClick: function () { dialog.close('declined'); } })];
    return [
      h('span', { class: 'spacer' }),
      ui.button({
        label: 'Something different',
        variant: 'quiet',
        onClick: function () {
          flow.mode = 'suggest';
          flow.startedAt = null;
          flow.exclude.push(flow.current ? flow.current.id : '');
          var next = Afterglow.motivation.suggestion({ exclude: flow.exclude });
          flow.current = next || flow.current;
          render();
        }
      })
    ];
  }

  Afterglow.motivationFlow = { open: open };
})(typeof window !== 'undefined' ? window : this);
