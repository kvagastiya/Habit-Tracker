/* ==========================================================================
   views/journal.js — low-friction journal and optional mood/energy check-ins.

   Entries are stored locally and never leave the browser. Mood is a plain
   1-5 self-report with no interpretation attached to it.
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

  var editingId = null;
  var showAll = false;

  function scaleRow(labels, value, onSelect, legend) {
    var node = h('div', { class: 'mood-row', role: 'group', 'aria-label': legend });
    labels.forEach(function (label, index) {
      var score = index + 1;
      node.appendChild(h('button', {
        type: 'button',
        class: 'mood-dot',
        'aria-pressed': value === score ? 'true' : 'false',
        'aria-label': label + ' (' + score + ' of 5)',
        title: label,
        dataset: { focusKey: legend.slice(0, 12) + '-' + score },
        text: String(score),
        on: { click: function () { onSelect(value === score ? null : score); } }
      }));
    });
    return node;
  }

  function editorCard() {
    var state = Afterglow.store.state;
    var editing = editingId ? state.journal.filter(function (entry) { return entry.id === editingId; })[0] : null;
    var drafts = editorCard.draft || (editorCard.draft = { prompt: '', text: '', mood: null, energy: null, date: D.todayKey() });

    if (editing) {
      drafts = { prompt: editing.prompt, text: editing.text, mood: editing.mood, energy: editing.energy, date: editing.date };
      editorCard.draft = drafts;
    } else if (!drafts.prompt) {
      drafts.prompt = Afterglow.data.JOURNAL_PROMPTS[new Date().getDate() % Afterglow.data.JOURNAL_PROMPTS.length];
    }

    var promptSelect = ui.select({
      value: drafts.prompt,
      options: ['A free entry (no prompt)'].concat(Afterglow.data.JOURNAL_PROMPTS).map(function (prompt) {
        return { value: prompt === 'A free entry (no prompt)' ? '' : prompt, label: prompt === 'A free entry (no prompt)' ? prompt : prompt };
      }),
      on: { change: function (event) { drafts.prompt = event.target.value; } }
    });

    var textArea = ui.textarea({
      value: drafts.text,
      rows: 7,
      maxlength: 8000,
      placeholder: 'A few sentences. No one else will read this.',
      on: { input: function (event) { drafts.text = event.target.value; } }
    });

    function save() {
      var text = textArea.value.trim();
      if (!text) { textArea.focus(); dom.announce('Write something first, even one line.'); return; }
      if (editing) {
        Afterglow.store.update(function (s) {
          s.journal = s.journal.map(function (entry) {
            if (entry.id !== editing.id) return entry;
            return Object.assign({}, entry, {
              prompt: promptSelect.value,
              text: text.slice(0, 8000),
              mood: drafts.mood,
              energy: drafts.energy,
              updatedAt: new Date().toISOString()
            });
          });
        }, 'journal-edit');
        dom.toast('Entry updated.', { icon: 'journal' });
        editingId = null;
      } else {
        var entry = {
          id: dom.uid('entry'),
          date: D.todayKey(),
          prompt: promptSelect.value,
          text: text.slice(0, 8000),
          mood: drafts.mood,
          energy: drafts.energy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        Afterglow.store.update(function (s) { s.journal.push(entry); }, 'journal-add');
        dom.toast('Entry saved locally.', { icon: 'journal' });
      }
      editorCard.draft = { prompt: '', text: '', mood: null, energy: null, date: D.todayKey() };
      Afterglow.app.refresh();
    }

    var body = h('div', { class: 'stack' },
      ui.field('Prompt', promptSelect, { hint: 'Choose one, leave it blank, or write your own heading in the text.' }),
      h('div', { class: 'field' },
        h('label', { for: textArea.id || (textArea.id = dom.uid('journal-text')), text: 'Entry' }),
        textArea
      ),
      h('fieldset', { class: 'fieldset' },
        h('legend', { class: 'fieldset__legend', text: 'Mood (optional)' }),
        scaleRow(Afterglow.data.MOOD_LABELS, drafts.mood, function (value) { drafts.mood = value; Afterglow.app.rerender(); }, 'How did today feel, from low to bright'),
        h('span', { class: 'field__hint', text: 'No explanation required. This is your own scale.' })
      ),
      h('fieldset', { class: 'fieldset' },
        h('legend', { class: 'fieldset__legend', text: 'Energy (optional)' }),
        scaleRow(Afterglow.data.ENERGY_LABELS, drafts.energy, function (value) { drafts.energy = value; Afterglow.app.rerender(); }, 'How much energy there was, from empty to plenty')
      ),
      h('div', { class: 'actions-inline' },
        ui.button({ label: editing ? 'Save changes' : 'Save entry', icon: 'check', variant: 'primary', onClick: save }),
        ui.button({
          label: 'Another prompt', icon: 'restart', variant: 'quiet',
          onClick: function () {
            var prompts = Afterglow.data.JOURNAL_PROMPTS;
            var next = prompts[(prompts.indexOf(promptSelect.value) + 1) % prompts.length];
            drafts.prompt = next;
            Afterglow.app.rerender();
          }
        }),
        editing ? ui.button({ label: 'Cancel edit', variant: 'quiet', onClick: function () { editingId = null; editorCard.draft = null; Afterglow.app.rerender(); } }) : null
      )
    );

    return ui.card({
      title: editing ? 'Editing entry from ' + D.formatShort(editing.date, true) : 'New entry',
      subtitle: 'Kept in this browser only — nothing is uploaded.',
      className: 'card--accent',
      body: body
    });
  }

  function entryCard(entry) {
    return h('article', { class: 'journal-entry reveal' },
      h('div', { class: 'row row--between' },
        h('span', { class: 'journal-entry__date', text: D.relativeDay(entry.date) + ' · ' + D.formatShort(entry.date, true) }),
        h('div', { class: 'row', style: { gap: '4px' } },
          entry.mood ? ui.badge('mood ' + entry.mood + '/5', 'quiet') : null,
          entry.energy ? ui.badge('energy ' + entry.energy + '/5', 'quiet') : null,
          ui.iconButton('edit', 'Edit entry from ' + D.formatShort(entry.date, true), function () {
            editingId = entry.id;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            Afterglow.app.rerender();
          }, { iconClass: 'icon--sm', title: 'Edit' }),
          ui.iconButton('trash', 'Delete entry from ' + D.formatShort(entry.date, true), function () { deleteEntry(entry); }, { iconClass: 'icon--sm', title: 'Delete' })
        )
      ),
      entry.prompt ? h('p', { class: 'journal-entry__prompt', text: entry.prompt }) : null,
      h('p', { class: 'journal-entry__text', text: entry.text })
    );
  }

  function deleteEntry(entry) {
    var snapshot = JSON.parse(JSON.stringify(entry));
    var run = function () {
      Afterglow.store.update(function (s) { s.journal = s.journal.filter(function (item) { return item.id !== entry.id; }); }, 'journal-delete');
      dom.toast('Entry deleted.', {
        icon: 'trash',
        actionLabel: 'Undo',
        duration: 10000,
        onAction: function () {
          Afterglow.store.update(function (s) { s.journal.push(snapshot); s.journal.sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }, 'journal-undo');
          Afterglow.app.refresh();
        }
      });
      Afterglow.app.refresh();
    };
    if (!Afterglow.store.state.settings.confirmDestructive) { run(); return; }
    dom.confirmAction({
      title: 'Delete this entry?',
      message: 'The text will be removed from this browser. There is a short undo window afterwards.',
      confirmLabel: 'Delete entry',
      danger: true
    }).then(function (ok) { if (ok) run(); });
  }

  Afterglow.views.journal = {
    title: 'Journal',
    context: 'Journal',
    render: function (container) {
      var entries = Afterglow.store.state.journal.slice().sort(function (a, b) {
        if (a.date === b.date) return a.createdAt < b.createdAt ? 1 : -1;
        return a.date < b.date ? 1 : -1;
      });
      var visible = showAll ? entries : entries.slice(0, 8);
      var streakish = entries.length;

      container.appendChild(ui.pageHeader({
        eyebrow: 'Reflection',
        title: 'Journal',
        lead: 'A private place to notice things. Prompts are suggestions, not requirements, and skipping days costs nothing.',
        actions: [ui.button({ label: 'Progress', icon: 'chart', variant: 'quiet', onClick: function () { Afterglow.app.go('progress'); } })]
      }));

      container.appendChild(h('div', { class: 'stack' },
        editorCard(),
        h('div', { class: 'grid grid--3' },
          ui.statTile({ value: String(streakish), label: 'Entries saved' }),
          ui.statTile({ value: String(entries.filter(function (entry) { return entry.mood; }).length), label: 'With a mood check-in' }),
          ui.statTile({ value: entries.length ? D.relativeDay(entries[0].date) : '—', label: 'Most recent entry' })
        ),
        h('section', { class: 'stack' },
          h('p', { class: 'eyebrow', text: 'Previous entries' }),
          visible.length ? h('div', { class: 'stack' }, visible.map(entryCard)) : ui.emptyState({
            icon: 'journal',
            title: 'No entries yet',
            text: 'One sentence counts. “What went a little better today?” is usually the easiest place to start.'
          }),
          entries.length > 8 ? h('div', { class: 'row' },
            ui.button({
              label: showAll ? 'Show fewer' : 'Show all ' + entries.length + ' entries',
              variant: 'quiet',
              onClick: function () { showAll = !showAll; Afterglow.app.rerender(); }
            })
          ) : null
        ),
        h('div', { class: 'notice' }, icon('shield'),
          h('div', null,
            h('strong', { text: 'Private by default. ' }),
            h('span', { text: 'Journal and mood data are stored only in this browser and are never sent anywhere. Clearing your browser data will erase them, so export a backup from Settings if they matter to you.' })
          )
        )
      ));
    }
  };
})(typeof window !== 'undefined' ? window : this);
