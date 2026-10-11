/* ==========================================================================
   views/tools.js — small modular toolkits.

   Each module is deliberately shallow: enough to lower the effort of starting,
   not a second app to maintain. Everything can be ignored without breaking the
   rest of Afterglow.
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

  function today() { return D.todayKey(); }
  function checkedItems(listId, day) {
    var state = Afterglow.store.state;
    return ((state.checklists[listId] || {})[day || today()]) || [];
  }
  function toggleItem(listId, day, key) {
    Afterglow.store.update(function (state) {
      if (!state.checklists[listId]) state.checklists[listId] = {};
      var list = state.checklists[listId][day] || [];
      var at = list.indexOf(key);
      if (at > -1) list.splice(at, 1); else list.push(key);
      state.checklists[listId][day] = list;
    }, 'checklist-toggle');
  }
  function note(key, value) {
    Afterglow.store.update(function (state) {
      if (value) state.notes[key] = String(value).slice(0, 2000);
      else delete state.notes[key];
    }, 'note-set');
  }
  function noteValue(key) { return Afterglow.store.state.notes[key] || ''; }

  function checklist(opts) {
    var items = opts.items || [];
    var done = checkedItems(opts.id);
    var node = h('div', { class: 'checklist' });
    items.forEach(function (item) {
      var isDone = done.indexOf(item.key) > -1;
      node.appendChild(h('div', { class: 'checklist__item' + (isDone ? ' is-done' : '') },
        h('button', {
          class: 'check', type: 'button',
          'aria-pressed': isDone ? 'true' : 'false',
          'aria-label': (isDone ? 'Uncheck: ' : 'Check: ') + item.label,
          dataset: { focusKey: opts.id + '-' + item.key },
          on: { click: function () { toggleItem(opts.id, today(), item.key); Afterglow.app.refresh(); } }
        }, isDone ? icon('check') : null),
        h('span', { class: 'checklist__text', text: item.label }),
        item.removable ? ui.iconButton('close', 'Remove ' + item.label, function () {
          var remaining = (noteValue(opts.id + '.custom') || '').split('\n').filter(function (line) { return line.trim() && line.trim() !== item.label; });
          note(opts.id + '.custom', remaining.join('\n'));
          Afterglow.app.refresh();
        }, { iconClass: 'icon--sm', title: 'Remove' }) : null
      ));
    });
    return node;
  }

  function customItems(listId) {
    return (noteValue(listId + '.custom') || '').split('\n').map(function (line) { return line.trim(); }).filter(Boolean)
      .map(function (label, index) { return { key: 'custom-' + index + '-' + label.slice(0, 12), label: label, removable: true }; });
  }

  function addItemRow(listId, placeholder) {
    var input = ui.input({ placeholder: placeholder, maxlength: 60, ariaLabel: 'Add an item' });
    var form = h('form', { class: 'row', style: { marginTop: 'var(--s-3)' }, on: { submit: function (event) {
      event.preventDefault();
      var value = input.value.trim();
      if (!value) return;
      var existing = noteValue(listId + '.custom') || '';
      if (existing.split('\n').map(function (line) { return line.trim(); }).indexOf(value) === -1) {
        note(listId + '.custom', (existing ? existing + '\n' : '') + value);
      }
      input.value = '';
      Afterglow.app.refresh();
    } } }, input, ui.button({ label: 'Add', variant: 'quiet', className: 'btn--small', onClick: function () { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } }));
    return form;
  }

  /* --- Study --------------------------------------------------------------- */
  function studyCard() {
    var intention = ui.input({ value: noteValue('studyIntention'), placeholder: 'One thing to get through', maxlength: 120, ariaLabel: 'Study intention' });
    intention.addEventListener('change', function () { note('studyIntention', intention.value.trim()); });

    var tasks = Afterglow.store.state.tasks;
    var taskInput = ui.input({ placeholder: 'Break it into a next action', maxlength: 240, ariaLabel: 'New study task' });
    var taskForm = h('form', { class: 'row', on: { submit: function (event) {
      event.preventDefault();
      var text = taskInput.value.trim();
      if (!text) return;
      Afterglow.store.update(function (state) {
        state.tasks.push({ id: dom.uid('task'), text: text.slice(0, 240), done: false, createdAt: new Date().toISOString() });
      }, 'task-add');
      dom.announce('Task added.');
      Afterglow.app.refresh();
    } } }, taskInput, ui.button({ label: 'Add task', variant: 'quiet', className: 'btn--small', onClick: function () { taskForm.requestSubmit ? taskForm.requestSubmit() : taskForm.dispatchEvent(new Event('submit')); } }));

    var list = tasks.length ? h('div', { class: 'plain-list' }, tasks.map(function (task) {
      return h('div', { class: 'task-row' + (task.done ? ' is-done' : '') },
        h('button', {
          class: 'check', type: 'button',
          'aria-pressed': task.done ? 'true' : 'false',
          'aria-label': (task.done ? 'Mark not done: ' : 'Mark done: ') + task.text,
          dataset: { focusKey: 'task-' + task.id },
          on: { click: function () {
            Afterglow.store.update(function (state) {
              state.tasks = state.tasks.map(function (item) { return item.id === task.id ? Object.assign({}, item, { done: !item.done }) : item; });
            }, 'task-toggle');
            Afterglow.app.refresh();
          } }
        }, task.done ? icon('check') : null),
        h('span', { class: 'task-row__text', text: task.text }),
        ui.iconButton('trash', 'Delete task: ' + task.text, function () {
          Afterglow.store.update(function (state) { state.tasks = state.tasks.filter(function (item) { return item.id !== task.id; }); }, 'task-delete');
          Afterglow.app.refresh();
        }, { iconClass: 'icon--sm', title: 'Delete' })
      );
    })) : null;

    return ui.card({
      className: 'tool-card',
      title: 'Study',
      subtitle: 'One intention, broken into the next small action.',
      body: h('div', { class: 'stack' },
        ui.field('Today\'s intention', intention, { hint: 'Written down, not promised.' }),
        taskForm,
        list,
        tasks.some(function (task) { return task.done; }) ? h('p', { class: 'faint', style: { fontSize: 'var(--step--1)' }, text: tasks.filter(function (t) { return t.done; }).length + ' of ' + tasks.length + ' tasks done. You can clear finished ones above.' }) : null,
        h('details', { class: 'disclosure' },
          h('summary', { text: 'Still stuck? Try one of these starter steps' }),
          h('div', { class: 'disclosure__body' },
            h('div', { class: 'chip-select' }, Afterglow.data.STUDY_MICRO_STEPS.map(function (step) {
              return h('button', {
                class: 'chip', type: 'button',
                on: { click: function () {
                  Afterglow.store.update(function (state) {
                    state.tasks.push({ id: dom.uid('task'), text: step, done: false, createdAt: new Date().toISOString() });
                  }, 'task-from-step');
                  dom.toast('Added: ' + step, { icon: 'plus' });
                  Afterglow.app.refresh();
                } }
              }, icon('plus', 'icon--sm'), h('span', { text: step }));
            }))
          )
        )
      ),
      foot: h('div', { class: 'actions-inline' },
        ui.button({ label: 'Start with five minutes', icon: 'clock', variant: 'primary', className: 'btn--small', onClick: function () {
          Afterglow.timer.setDuration(5);
          Afterglow.timer.start({ minutes: 5, label: intention.value.trim() || 'Five minutes of study' });
          dom.toast('Five-minute session started.', { icon: 'play' });
          Afterglow.app.go('focus');
        } }),
        ui.button({ label: 'No motivation', icon: 'spark', variant: 'glow', className: 'btn--small', onClick: function () { Afterglow.app.openMotivation(); } })
      )
    });
  }

  /* --- Movement ------------------------------------------------------------ */
  function movementCard() {
    var minutes = 5;
    var routine = Afterglow.data.MOVEMENT_ROUTINE;

    var body = h('div', { class: 'stack' },
      h('div', { class: 'notice notice--rest' }, icon('leaf'),
        h('div', null,
          h('strong', { text: 'Skip anything uncomfortable. ' }),
          h('span', { text: 'These are gentle starting points, not a programme. Chair and wall alternatives are listed for every movement.' })
        )
      ),
      h('div', { class: 'stack stack--tight' }, routine.map(function (item) {
        return h('div', { class: 'move-item' },
          h('span', { class: 'insight__mark', 'aria-hidden': 'true' }, icon('leaf', 'icon--sm')),
          h('div', { style: { minWidth: '0' } },
            h('span', { class: 'move-item__label', text: item.name }),
            h('p', { class: 'muted', style: { margin: '2px 0 0', fontSize: 'var(--step--1)' }, text: item.detail }),
            h('p', { class: 'faint', style: { margin: '2px 0 0', fontSize: 'var(--step--1)' }, text: 'Easier option: ' + item.alt })
          )
        );
      }))
    );

    return ui.card({
      className: 'tool-card',
      title: 'Beginner movement',
      subtitle: 'No equipment, no scores, no promises about your body.',
      body: body,
      foot: h('div', { class: 'stack stack--tight' },
        ui.segmented({
          ariaLabel: 'Movement break length',
          value: 5,
          items: [{ value: 3, label: '3 min' }, { value: 5, label: '5 min' }, { value: 10, label: '10 min' }],
          onSelect: function (value) { minutes = Number(value); startMovement(minutes); }
        }),
        h('p', { class: 'faint', style: { fontSize: 'var(--step--1)' }, text: 'Choosing a length starts a focus timer labelled “Movement” — a timer, not a workout plan.' })
      )
    });
  }
  function startMovement(minutes) {
    Afterglow.timer.setDuration(minutes);
    Afterglow.timer.start({ minutes: minutes, label: 'Movement break' });
    dom.toast('Movement break started: ' + minutes + ' minutes.', { icon: 'leaf' });
    Afterglow.app.go('focus');
  }

  /* --- Sleep --------------------------------------------------------------- */
  function sleepCard() {
    var intention = ui.input({ value: noteValue('sleepIntention'), placeholder: 'e.g. lights out by 23:00', maxlength: 80, ariaLabel: 'Sleep intention' });
    intention.addEventListener('change', function () { note('sleepIntention', intention.value.trim()); });
    var items = Afterglow.data.WIND_DOWN_CHECKS.map(function (label, index) { return { key: 'w' + index, label: label }; })
      .concat(customItems('winddown'));

    return ui.card({
      className: 'tool-card',
      title: 'Sleep and wind-down',
      subtitle: 'A short checklist and one intention. No sleep scoring.',
      body: h('div', { class: 'stack' },
        h('p', { class: 'muted', text: 'Afterglow cannot measure your sleep and does not pretend to. This is a reminder list for the last half hour of the day.' }),
        ui.field('Sleep intention', intention, { hint: 'A repeatable time is more useful than a perfect one.' }),
        checklist({ id: 'winddown', items: items }),
        addItemRow('winddown', 'Add your own step')
      ),
      foot: h('div', { class: 'actions-inline' },
        ui.button({ label: 'Minimum Day plan', icon: 'moon', variant: 'quiet', className: 'btn--small', onClick: function () { Afterglow.app.go('flow'); } })
      )
    });
  }

  /* --- Grooming ------------------------------------------------------------ */
  function groomingCard() {
    var morning = Afterglow.data.GROOMING_MORNING.map(function (label, index) { return { key: 'm' + index, label: label }; })
      .concat(customItems('groomMorning'));
    var evening = Afterglow.data.GROOMING_EVENING.map(function (label, index) { return { key: 'e' + index, label: label }; })
      .concat(customItems('groomEvening'));

    return ui.card({
      className: 'tool-card',
      title: 'Grooming and basics',
      subtitle: 'Two short lists you can edit freely.',
      body: h('div', { class: 'stack' },
        h('p', { class: 'muted', text: 'Basic self-care is a practical routine, not a judgement about how you look. Edit these lists to match your own habits.' }),
        h('h3', { style: { fontSize: 'var(--step-0)' }, text: 'Morning' }),
        checklist({ id: 'groomMorning', items: morning }),
        addItemRow('groomMorning', 'Add a morning step'),
        h('h3', { style: { fontSize: 'var(--step-0)', marginTop: 'var(--s-4)' }, text: 'Evening' }),
        checklist({ id: 'groomEvening', items: evening }),
        addItemRow('groomEvening', 'Add an evening step')
      )
    });
  }

  /* --- Confidence ---------------------------------------------------------- */
  function confidenceCard() {
    var challenges = Afterglow.data.CONFIDENCE_CHALLENGES;
    var day = today();
    var state = Afterglow.store.state;
    var doneToday = state.confidence[day] || null;
    var index = (new Date().getDate() + new Date().getMonth()) % challenges.length;
    var current = challenges[index];
    if (doneToday) current = challenges.filter(function (item) { return item.id === doneToday; })[0] || current;

    var history = Object.keys(state.confidence).sort().reverse().slice(0, 8);

    return ui.card({
      className: 'tool-card',
      title: 'Confidence',
      subtitle: 'Small challenges, marked privately.',
      body: h('div', { class: 'stack' },
        h('div', { class: 'motivation__action' },
          h('p', { class: 'eyebrow', text: 'Today\'s suggestion' }),
          h('p', { class: 'motivation__action-title', text: current.text }),
          h('p', { class: 'muted', style: { fontSize: 'var(--step--1)' }, text: 'Nobody is told about this. There is no sharing, no leaderboard and no rating.' })
        ),
        h('div', { class: 'actions-inline' },
          ui.button({
            label: doneToday ? 'Marked as done' : 'I did this',
            icon: 'check',
            variant: doneToday ? 'quiet' : 'primary',
            className: 'btn--small',
            onClick: function () {
              Afterglow.store.update(function (s) {
                if (s.confidence[day]) delete s.confidence[day];
                else s.confidence[day] = current.id;
              }, 'confidence-toggle');
              dom.announce(doneToday ? 'Cleared for today.' : 'Marked done for today.');
              Afterglow.app.refresh();
            }
          }),
          ui.button({ label: 'Another idea', icon: 'restart', variant: 'quiet', className: 'btn--small', onClick: function () {
            var next = challenges[(challenges.indexOf(current) + 1 + Math.floor(Math.random() * 3)) % challenges.length];
            var tmp = Afterglow.store.state.confidence;
            void tmp;
            Afterglow.store.update(function () {}, 'noop');
            current = next;
            Afterglow.app.rerender();
            dom.announce('Different challenge shown: ' + next.text);
          } }),
          ui.button({ label: 'Record as small win', icon: 'spark', variant: 'quiet', className: 'btn--small', onClick: function () {
            Afterglow.wins.add('Confidence: ' + current.text.toLowerCase(), 'confidence');
            dom.toast('Kept in your small wins.', { icon: 'spark' });
            Afterglow.app.refresh();
          } })
        ),
        history.length ? h('details', { class: 'disclosure' },
          h('summary', { text: 'Previous challenges (' + Object.keys(state.confidence).length + ')' }),
          h('div', { class: 'disclosure__body' },
            h('ul', { class: 'plain-list' }, history.map(function (date) {
              var item = challenges.filter(function (challenge) { return challenge.id === state.confidence[date]; })[0];
              return h('li', { text: D.formatShort(date, true) + ' — ' + (item ? item.text : 'recorded') });
            }))
          )
        ) : null
      )
    });
  }

  /* --- Future me ----------------------------------------------------------- */
  function futureCard() {
    var goals = Afterglow.store.state.goals;
    var titleInput = ui.input({ placeholder: 'Something you would like to move toward', maxlength: 160, ariaLabel: 'Goal' });
    var horizonInput = ui.input({ placeholder: 'Rough horizon (optional)', maxlength: 60, ariaLabel: 'Horizon' });
    var nextInput = ui.input({ placeholder: 'Smallest next step', maxlength: 200, ariaLabel: 'Next step' });

    var form = h('form', { class: 'stack stack--tight', on: { submit: function (event) {
      event.preventDefault();
      var title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      Afterglow.store.update(function (state) {
        state.goals.push({
          id: dom.uid('goal'),
          title: title.slice(0, 160),
          horizon: horizonInput.value.trim().slice(0, 60),
          next: nextInput.value.trim().slice(0, 200),
          createdAt: new Date().toISOString()
        });
      }, 'goal-add');
      dom.toast('Added to Future Me.', { icon: 'target' });
      Afterglow.app.refresh();
    } } },
      titleInput,
      h('div', { class: 'field-row' }, horizonInput, nextInput),
      h('div', { class: 'actions-inline' },
        ui.button({ label: 'Add goal', icon: 'plus', variant: 'primary', className: 'btn--small', onClick: function () { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } }),
        ui.button({ label: 'Use a sample', variant: 'quiet', className: 'btn--small', onClick: function () {
          var seed = Afterglow.data.FUTURE_SEEDS[goals.length % Afterglow.data.FUTURE_SEEDS.length];
          titleInput.value = seed.title;
          horizonInput.value = seed.horizon;
          nextInput.value = seed.next;
        } })
      )
    );

    var list = goals.length ? h('div', { class: 'stack stack--tight' }, goals.map(function (goal) {
      var nextField = ui.input({ value: goal.next, maxlength: 200, ariaLabel: 'Next step for ' + goal.title, placeholder: 'Next small step' });
      nextField.addEventListener('change', function () {
        Afterglow.store.update(function (state) {
          state.goals = state.goals.map(function (item) { return item.id === goal.id ? Object.assign({}, item, { next: nextField.value.trim() }) : item; });
        }, 'goal-next');
        dom.toast('Next step saved.', { icon: 'check' });
      });
      return h('div', { class: 'goal-card' },
        h('div', { class: 'row row--between' },
          h('p', { class: 'goal-card__title', text: goal.title }),
          h('div', { class: 'row', style: { gap: '2px' } },
            goal.horizon ? ui.badge(goal.horizon, 'quiet') : null,
            ui.iconButton('trash', 'Delete goal: ' + goal.title, function () {
              Afterglow.store.update(function (state) { state.goals = state.goals.filter(function (item) { return item.id !== goal.id; }); }, 'goal-delete');
              Afterglow.app.refresh();
            }, { iconClass: 'icon--sm', title: 'Delete' })
          )
        ),
        h('div', { class: 'field', style: { margin: '0' } },
          h('label', { for: nextField.id || (nextField.id = dom.uid('goal-next')), text: 'Next small step' }),
          nextField
        )
      );
    })) : null;

    var notes = ui.textarea({ value: noteValue('futureMe'), rows: 5, maxlength: 4000, placeholder: 'Interests, skills to try, things to look into. Half-formed is fine.' });
    var notesForm = h('form', { on: { submit: function (event) {
      event.preventDefault();
      note('futureMe', notes.value.trim());
      dom.toast('Notes saved.', { icon: 'journal' });
      Afterglow.app.refresh();
    } } },
      ui.field('Notes and half-formed ideas', notes, { hint: 'You do not need to choose a life path today.' }),
      ui.button({ label: 'Save notes', icon: 'check', variant: 'quiet', className: 'btn--small', onClick: function () { notesForm.requestSubmit ? notesForm.requestSubmit() : notesForm.dispatchEvent(new Event('submit')); } })
    );

    return ui.card({
      className: 'tool-card',
      title: 'Future me',
      subtitle: 'Goals, interests and the next small step for each.',
      body: h('div', { class: 'stack' }, form, list, h('hr'), notesForm)
    });
  }

  Afterglow.views.tools = {
    title: 'Tools',
    context: 'Toolkits',
    render: function (container) {
      container.appendChild(ui.pageHeader({
        eyebrow: 'Companions',
        title: 'Toolkits',
        lead: 'Six small modules for the parts of life that are easy to postpone. Use one, use none — the dashboard does not depend on any of them.'
      }));
      container.appendChild(h('div', { class: 'tool-grid' },
        studyCard(),
        movementCard(),
        sleepCard(),
        groomingCard(),
        confidenceCard(),
        futureCard()
      ));
    }
  };
})(typeof window !== 'undefined' ? window : this);
