/* ==========================================================================
   views/settings.js — user control: appearance, preferences, data ownership.
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

  function row(title, hint, control) {
    return h('div', { class: 'settings-row' },
      h('div', { class: 'settings-row__body' },
        h('p', { class: 'settings-row__title', text: title }),
        hint ? h('p', { class: 'settings-row__hint', text: hint }) : null
      ),
      h('div', { class: 'row' }, control)
    );
  }

  function appearanceCard() {
    var settings = Afterglow.store.state.settings;

    return ui.card({
      title: 'Appearance',
      subtitle: 'The dark theme is the default; the light theme is a warm parchment palette.',
      body: h('div', null,
        row('Theme', 'Saved in this browser.', ui.segmented({
          ariaLabel: 'Theme',
          value: settings.theme,
          items: [{ value: 'dark', label: 'Afterglow' }, { value: 'light', label: 'Dawnlight' }],
          onSelect: function (value) { Afterglow.app.setTheme(value); }
        })),
        row('Motion', 'Ambient animation, reveals and transitions.', ui.segmented({
          ariaLabel: 'Motion preference',
          value: settings.motion,
          items: [{ value: 'system', label: 'Follow system' }, { value: 'on', label: 'Full' }, { value: 'off', label: 'Reduced' }],
          onSelect: function (value) {
            Afterglow.store.update(function (s) { s.settings.motion = value; }, 'motion');
            Afterglow.app.applyMotion();
            dom.announce('Motion set to ' + value + '.');
            Afterglow.app.rerender();
          }
        })),
        row('Night sky', 'The horizon glow, drifting orb and dust motes.', h('label', { class: 'switch' },
          h('input', {
            type: 'checkbox', checked: settings.showAtmosphere,
            on: { change: function (event) {
              Afterglow.store.update(function (s) { s.settings.showAtmosphere = event.target.checked; }, 'atmosphere');
              Afterglow.app.applyAtmosphere();
              Afterglow.app.rerender();
            } }
          }),
          h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
          h('span', { text: settings.showAtmosphere ? 'Visible' : 'Hidden' })
        )),
        row('Week starts on', 'Affects weekly charts and the week strip.', ui.select({
          value: settings.weekStart,
          options: [{ value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }],
          on: { change: function (event) {
            Afterglow.store.update(function (s) { s.settings.weekStart = Number(event.target.value); }, 'week-start');
            Afterglow.app.refresh();
          } }
        })),
        row('Confirm destructive actions', 'Ask before deleting habits, entries and goals.', h('label', { class: 'switch' },
          h('input', {
            type: 'checkbox', checked: settings.confirmDestructive,
            on: { change: function (event) {
              Afterglow.store.update(function (s) { s.settings.confirmDestructive = event.target.checked; }, 'confirm-setting');
            } }
          }),
          h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
          h('span', { text: settings.confirmDestructive ? 'On' : 'Off' })
        ))
      )
    });
  }

  function preferencesCard() {
    var profile = Afterglow.store.state.profile;
    var nameInput = ui.input({ value: profile.name, maxlength: 60, placeholder: 'Optional', ariaLabel: 'Display name' });
    nameInput.addEventListener('change', function () {
      Afterglow.store.update(function (s) { s.profile.name = nameInput.value.trim().slice(0, 60); }, 'profile-name');
      dom.toast('Name updated.', { icon: 'check' });
      Afterglow.app.refresh();
    });

    var dayStart = ui.input({ type: 'time', value: profile.dayStart, ariaLabel: 'Typical day start' });
    dayStart.addEventListener('change', function () {
      Afterglow.store.update(function (s) { s.profile.dayStart = dayStart.value || '07:00'; }, 'day-start');
    });

    return ui.card({
      title: 'Preferences',
      subtitle: 'These shape the starter habits and the suggested daily plan.',
      body: h('div', null,
        row('Display name', 'Only used in the greeting. Any short name works.', nameInput),
        row('Primary focus', null, ui.select({
          value: profile.focus,
          options: [
            { value: 'balanced', label: 'A balanced mix' },
            { value: 'studies', label: 'Studies' },
            { value: 'health', label: 'Health and movement' },
            { value: 'confidence', label: 'Confidence' },
            { value: 'routines', label: 'Routines and sleep' }
          ],
          on: { change: function (event) {
            Afterglow.store.update(function (s) { s.profile.focus = event.target.value; }, 'profile-focus');
          } }
        })),
        row('Daily time budget', 'Used for suggested plans. Nothing enforces it.', ui.segmented({
          ariaLabel: 'Daily time budget',
          value: profile.budget,
          items: [{ value: 15, label: '15 min' }, { value: 20, label: '20 min' }, { value: 30, label: '30 min' }],
          onSelect: function (value) {
            Afterglow.store.update(function (s) { s.profile.budget = Number(value); }, 'profile-budget');
            dom.announce('Daily budget set to ' + value + ' minutes.');
            Afterglow.app.refresh();
          }
        })),
        row('Typical day start', 'A rough anchor for reminders you write yourself.', dayStart),
        row('Onboarding', 'Run the welcome flow again to change focus and budget together.', ui.button({
          label: 'Revisit onboarding', icon: 'restart', variant: 'quiet',
          onClick: function () { Afterglow.onboarding.open({ revisit: true }); }
        }))
      )
    });
  }

  function formatBytes(count) {
    if (count < 1024) return count + ' bytes';
    if (count < 1024 * 1024) return (count / 1024).toFixed(1) + ' KB';
    return (count / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function exportData() {
    var doc = Afterglow.store.exportDocument();
    var text = JSON.stringify(doc, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var stamp = D.todayKey();
    var link = h('a', { href: url, download: 'afterglow-backup-' + stamp + '.json' });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    dom.toast('Backup downloaded (' + formatBytes(text.length) + '). Keep it private.', { icon: 'download' });
  }

  function importData(file, mode, onDone) {
    var reader = new FileReader();
    reader.onerror = function () { dom.toast('That file could not be read.', { icon: 'close' }); onDone(); };
    reader.onload = function () {
      var result = Afterglow.store.parseImport(String(reader.result || ''));
      if (!result.ok) {
        dom.openModal({
          title: 'Import failed',
          body: h('p', { text: result.error }),
          footer: [ui.button({ label: 'Close', variant: 'primary', onClick: function () { dom.closeTopModal(); onDone(); } })]
        });
        return;
      }
      var warnings = result.warnings || [];
      dom.confirmAction({
        title: mode === 'replace' ? 'Replace everything with this backup?' : 'Add this backup to your data?',
        message: mode === 'replace'
          ? 'Your current habits, records, journal entries and focus history will be replaced by the file.'
          : 'Habits and entries from the file will be added. Anything that already exists is kept.',
        detail: warnings.length ? warnings.join(' ') : 'The file was checked and upgraded where needed before importing.',
        confirmLabel: mode === 'replace' ? 'Replace everything' : 'Add to my data',
        danger: mode === 'replace'
      }).then(function (ok) {
        if (ok) {
          if (mode === 'replace') Afterglow.store.replaceWith(result.data);
          else Afterglow.store.mergeWith(result.data);
          dom.toast('Import complete.', { icon: 'upload' });
        }
        onDone();
      });
    };
    reader.readAsText(file);
  }

  function dataCard() {
    var state = Afterglow.store.state;
    var size = 0;
    try { size = JSON.stringify(state).length; } catch (err) { size = 0; }
    var fileInput = h('input', {
      type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'import-file',
      on: { change: function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        var mode = dom.qs('#import-mode') ? dom.qs('#import-mode').value : 'merge';
        importData(file, mode, function () { event.target.value = ''; Afterglow.app.refresh(); });
      } }
    });

    return ui.card({
      title: 'Your data',
      subtitle: 'Everything lives in this browser under one key. Nothing is uploaded.',
      body: h('div', null,
        h('div', { class: 'grid grid--3' },
          ui.statTile({ value: formatBytes(size), label: 'Stored locally', hint: Afterglow.store.available ? 'localStorage available' : 'storage blocked — data will not persist' }),
          ui.statTile({ value: 'v' + Afterglow.store.SCHEMA_VERSION, label: 'Schema version' }),
          ui.statTile({ value: String(state.habits.length), label: 'Habits', hint: state.journal.length + ' journal entries' })
        ),
        h('div', { class: 'stack', style: { marginTop: 'var(--s-4)' } },
          !Afterglow.store.available ? h('div', { class: 'notice notice--warn' }, icon('shield'),
            h('div', null,
              h('strong', { text: 'This browser is blocking local storage. ' }),
              h('span', { text: 'Afterglow still works while the tab is open, but anything you record will disappear when you reload. Private windows and strict privacy settings often cause this.' })
            )
          ) : null,
          row('Export', 'Downloads a JSON file with all habits, records, notes and settings.', ui.button({
            label: 'Download backup', icon: 'download', variant: 'primary', onClick: exportData
          })),
          row('Import', 'Restore from a backup you exported earlier.',
            h('div', { class: 'row' },
              ui.select({ id: 'import-mode', value: 'merge', ariaLabel: 'Import mode', options: [
                { value: 'merge', label: 'Add to my data' },
                { value: 'replace', label: 'Replace everything' }
              ] }),
              ui.button({ label: 'Choose file', icon: 'upload', variant: 'quiet', onClick: function () { fileInput.click(); } }),
              fileInput
            )
          ),
          row('Restore the sample habits', 'Rebuilds the starter habit list and suggested flow. Your records are untouched.', ui.button({
            label: 'Recreate samples', icon: 'restart', variant: 'quiet',
            onClick: function () {
              dom.confirmAction({
                title: 'Recreate the starter habits?',
                message: 'This adds a fresh set of sample habits and rebuilds the suggested daily flow. Existing habits and records are not deleted, and the current list stays in place.',
                confirmLabel: 'Recreate samples'
              }).then(function (ok) {
                if (!ok) return;
                var starters = Afterglow.data.generateStarterHabits(state.profile);
                Afterglow.store.update(function (s) {
                  starters.forEach(function (raw, index) {
                    var category = raw.category || 'custom';
                    var habit = {
                      id: dom.uid('habit'),
                      name: raw.name,
                      description: raw.description || '',
                      category: category,
                      icon: raw.icon || Afterglow.data.categoryById(category).icon,
                      accent: raw.accent || Afterglow.data.categoryById(category).accent,
                      targetType: raw.targetType || 'check',
                      targetAmount: raw.targetAmount === undefined ? null : raw.targetAmount,
                      schedule: { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
                      reminder: '',
                      archived: false,
                      createdAt: new Date().toISOString()
                    };
                    void index;
                    s.habits.push(habit);
                    s.order.push(habit.id);
                  });
                  s.flow.plan = Afterglow.store.flowPlanFor(s.profile.budget);
                  s.flow.minimum.blocks = Afterglow.data.MINIMUM_DAY.map(function (block) {
                    return { id: block.id, title: block.title, text: block.text, minutes: block.minutes, category: block.category };
                  });
                }, 'samples-recreate');
                dom.toast('Sample habits added. Edit or delete anything you do not want.', { icon: 'spark' });
                Afterglow.app.refresh();
              });
            }
          }))
        )
      )
    });
  }

  function dangerCard() {
    return ui.card({
      className: 'danger-zone',
      title: 'Clear data',
      subtitle: 'Two different actions, because they mean different things.',
      body: h('div', null,
        row('Clear sample records only', 'Empties the history of the sample habits and resets the journey. Your own additions stay.',
          ui.button({
            label: 'Clear records', icon: 'restart', variant: 'quiet',
            onClick: function () {
              dom.confirmAction({
                title: 'Clear sample records?',
                message: 'Habit tick marks, focus sessions and journey progress will be removed. Habits, journal entries and small wins stay.',
                confirmLabel: 'Clear records',
                danger: true
              }).then(function (ok) {
                if (!ok) return;
                Afterglow.store.clearSamples();
                dom.toast('Records cleared. Habits and notes are still here.', { icon: 'restart' });
                Afterglow.app.refresh();
              });
            }
          })),
        row('Delete everything', 'Removes every habit, record, journal entry, win and setting from this browser.',
          ui.button({
            label: 'Delete all data', icon: 'trash', variant: 'danger',
            onClick: function () {
              dom.confirmAction({
                title: 'Delete all Afterglow data?',
                message: 'This cannot be undone unless you exported a backup first.',
                detail: 'Everything is stored only in this browser, so there is no copy anywhere else.',
                confirmLabel: 'Continue',
                danger: true
              }).then(function (ok) {
                if (!ok) return;
                dom.confirmAction({
                  title: 'Last confirmation',
                  message: 'Delete all habits, records, journal entries, small wins and settings?',
                  confirmLabel: 'Yes, delete everything',
                  cancelLabel: 'Keep my data',
                  danger: true
                }).then(function (confirmed) {
                  if (!confirmed) return;
                  Afterglow.store.clearAll();
                  dom.toast('All local data deleted.', { icon: 'trash' });
                  Afterglow.app.go('home');
                });
              });
            }
          }))
      )
    });
  }

  function aboutCard() {
    return ui.card({
      title: 'About Afterglow',
      subtitle: 'Version 1.0.0 · static site, no server, no account, no tracking.',
      body: h('div', { class: 'prose' },
        h('p', { class: 'muted', text: 'Afterglow is a small, self-contained website. It does not collect analytics, does not require an email address, does not call any external API, and cannot see anything you have not typed into it.' }),
        h('p', { class: 'muted', text: 'Your data is stored in this browser under the key “' + Afterglow.store.KEY + '”. It does not sync between devices or browsers on its own — export a backup to move it.' }),
        h('h3', { text: 'Keyboard and shortcuts' }),
        h('ul', { class: 'muted' },
          h('li', { text: 'Tab / Shift+Tab — move through controls, with a visible focus ring.' }),
          h('li', { text: 'Escape — close a dialog and return focus to the button that opened it.' }),
          h('li', { text: 'Space or Enter — activate the focused control, including habit ticks.' }),
          h('li', { text: 'Alt+M — open the “I have no motivation” flow from anywhere.' })
        ),
        h('h3', { text: 'Not a medical tool' }),
        h('p', { class: 'muted', text: 'Afterglow is a reflection and habit tool, not a clinical one. It does not diagnose anything, does not measure sleep, and makes no claims about your health. If you are struggling, a person is better than a website.' })
      )
    });
  }

  Afterglow.views.settings = {
    title: 'Settings',
    context: 'Settings',
    render: function (container) {
      container.appendChild(ui.pageHeader({
        eyebrow: 'Control',
        title: 'Settings',
        lead: 'Appearance, preferences and full ownership of your data. Nothing here is required to use the rest of Afterglow.'
      }));
      container.appendChild(h('div', { class: 'settings-section' }, appearanceCard()));
      container.appendChild(h('div', { class: 'settings-section' }, preferencesCard()));
      container.appendChild(h('div', { class: 'settings-section' }, dataCard()));
      container.appendChild(h('div', { class: 'settings-section' }, dangerCard()));
      container.appendChild(h('div', { class: 'settings-section' }, aboutCard()));
    }
  };
})(typeof window !== 'undefined' ? window : this);
