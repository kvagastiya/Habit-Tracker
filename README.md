# Afterglow

**A little better, every day.**

Afterglow is a calm, private personal dashboard for a student who wants to improve
a little at a time without turning self-improvement into punishment. It is a plain
static website: HTML, CSS and JavaScript, no build step, no server, no account, no
API keys, no tracking. Everything you type stays in your own browser.

The one feature it is built around is a warm, slightly magical answer to a bad day:
**“I have no motivation”** — a button that gives you one tiny, honest next step
(30 seconds to 5 minutes), lets you make it even smaller, and never shames you for
closing the window instead.

---

## 1. What it does

| Area | What you get |
| --- | --- |
| **Dashboard** | Time-aware greeting (never presumptuous), full local date, a rotating gentle headline, an animated completion ring, today's habit checklist, one “smallest next step” card, a small-win pad, and quick access to the timer, the daily flow and the no-motivation flow. |
| **Habits** | Create, edit, reorder, complete, undo, skip as a rest day, archive, delete, and inspect history per habit. Targets: tick, minutes, pages or sessions. Schedules: every day or chosen weekdays. Streaks count scheduled days, treat rest days as neutral, and never count future days as missed. |
| **“I have no motivation”** | A curated local bank of ~31 tiny actions with a shrinkable ladder, weighted by what you actually have open today and what time it is. One suggestion at a time, an honest duration, “make it even smaller”, “give me another idea”, “not now”, a soft countdown if you start, and honest recording on completion. Rest is offered as a real answer, not a consolation. |
| **Daily flow** | An editable sequence of blocks sized to a 15-, 20- or 30-minute budget, plus a **Minimum Day** plan (one tiny study action, a short stretch, one basic reset). Rearrange, retime, delete, rebuild. |
| **Focus timer** | Start/pause/resume/reset/finish, presets (5/10/15/20/25 min), a session label, an optional linked habit, a visual ring, session history and totals. Timing is derived from timestamps, so background tabs and reloads stay accurate, and an unfinished session is never recorded as a completed one. |
| **30-day journey** | Four weekly themes with one small prompt a day. Start, pause, resume, restart or skip — habit tracking works completely without it. |
| **Progress** | Consistency indicator (“consistency over perfection”), weekly and monthly views, a 17-week heat map, a calendar, category trends, streaks with rest days, a **progress constellation** of real completions (with a text alternative), short factual insights and a locally-composed **Sunday letter**. |
| **Journal** | Prompts, free writing, optional 1–5 mood and energy check-ins, edit and delete, all local. |
| **Toolkits** | Study (intention, next-action tasks, micro steps, “start with five minutes”), beginner movement (no equipment, chair/wall alternatives, skip anything uncomfortable), sleep wind-down checklist and intention, grooming checklists you can extend, private confidence challenges, and a “Future me” section for goals and half-formed ideas. |
| **Settings** | Theme, motion, atmosphere, week start, destructive-action confirmations, preferences, JSON export, validated JSON import (merge or replace), separate “clear records” and “delete all data”, plus plain-language storage explainers. |

### What it deliberately does not do

- No account, email, password, analytics, location or third-party requests of any kind.
- No AI service: the tiny actions, the journey prompts and the Sunday letter are
  authored content and fixed templates, and the letter says so itself.
- No medical or diagnostic claims, no sleep monitoring, no body-transformation promises.
- No streak that breaks permanently, no red failure states, no shaming copy.
- No cross-device sync — your data lives in the browser you are using until you export it.

---

## 2. Project structure

```
afterglow/
├── index.html                  # the single page: shell, icon sprite, atmosphere
├── manifest.webmanifest        # installable-app metadata (no service worker)
├── .nojekyll                   # tells GitHub Pages to skip Jekyll processing
├── LICENSE                     # MIT
├── README.md
├── assets/
│   └── favicon.svg             # hand-written SVG mark, also the app icon
├── styles/
│   ├── tokens.css              # design tokens for both themes
│   ├── base.css                # reset, typography, atmosphere, reduced motion
│   ├── layout.css              # sidebar/topbar/mobile navigation, responsive grid
│   ├── components.css          # buttons, cards, rings, forms, modals, charts
│   └── views.css               # per-view composition
└── scripts/
    ├── dates.js                # local-calendar date helpers (no UTC day keys)
    ├── store.js                # versioned localStorage state, migration, import/export
    ├── dom.js                  # tiny DOM toolkit, dialogs, focus trap, toasts
    ├── ui.js                   # shared building blocks (ring, heat map, habit row…)
    ├── data.js                 # authored content: starter habits, tiny-action bank, prompts
    ├── habits.js               # habit records, schedules, streaks, logging, small wins
    ├── motivation.js           # the decision layer behind the no-motivation flow
    ├── timer.js                # timestamp-derived focus timer
    ├── journey.js              # 30-day journey state
    ├── insights.js             # all derived numbers, insights, Sunday letter, constellation
    ├── onboarding.js           # the short, skippable welcome flow
    ├── motivation-modal.js     # the no-motivation experience itself
    ├── editor.js               # habit editor + “how much?” dialog
    ├── views/                  # one file per route: home, habits, flow, focus,
    │                           # journey, progress, journal, tools, settings
    └── app.js                  # boot, routing, navigation, theme, error boundary
```

**Why plain scripts instead of ES modules or a framework?** The site must open
correctly from `file://` as well as from GitHub Pages. ES `import` is blocked on
`file://`, and a bundler would add a build step for a project that needs none.
Each script is an IIFE that registers itself on a single `window.Afterglow`
namespace, and `index.html` loads them in dependency order.

---

## 3. Run it locally

### Option A — just open it

Double-click `index.html` (or drag it into a browser). Everything works, including
habit tracking, the timer and export, because there is no build step and no fetch.

### Option B — a local server (recommended for testing)

Some browsers restrict `localStorage` on `file://`, so a tiny local server gives you
the same behaviour as the deployed site:

```bash
# from inside the afterglow folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve .`, `php -S localhost:8000`, VS Code Live Server…).

---

## 4. Customising afterglow

| I want to change… | Edit |
| --- | --- |
| Colours, spacing, type scale, both themes | `styles/tokens.css` (the `:root` / `[data-theme]` blocks) |
| The starter habits a new user begins with | `scripts/data.js` → `generateStarterHabits()` |
| Suggested daily-flow plans | `scripts/data.js` → `FLOW_PLANS` and `MINIMUM_DAY` |
| The tiny actions behind “I have no motivation” | `scripts/data.js` → `TINY_ACTIONS` (each entry is a `ladder` from small to smallest) |
| Journey prompts | `scripts/data.js` → `JOURNEY` |
| Journal prompts, mood/energy labels, headlines, small-win prompts | `scripts/data.js` |
| Movement routine, wind-down list, grooming lists, confidence challenges | `scripts/data.js` |
| The accent palette offered on habits | `scripts/data.js` → `ACCENTS` (plus a matching token if you want a new CSS variable) |

**Adding a tiny action** is the most valuable edit. Copy one `TINY_ACTIONS` entry and
keep the ladder ordered longest → smallest, with honest durations:

```js
{ id: 'study-flashcards', category: 'study', title: 'Review five flashcards', hint: 'Five is a real amount.',
  ladder: [
    { title: 'Review five flashcards', seconds: 120 },
    { title: 'Review one flashcard', seconds: 30 },
    { title: 'Open the flashcard app', seconds: 10 }] },
```

Nothing else needs changing: the engine weights actions by category and time of day
automatically, and it will only offer to record a habit when the action actually
satisfies that habit's target.

---

## 5. Your data, and what “private” means here

- Everything is stored in **one localStorage key**: `afterglow:data`, as a single
  versioned JSON document. Key-value runtime state for the timer lives in
  `afterglow:timer`, and an unreadable backup (if one ever appears) is preserved as
  `afterglow:data:corrupt`.
- **Nothing is uploaded.** There are no analytics, no fonts or scripts from a CDN,
  and no network requests at all after the page loads. Journal and mood entries never
  leave the browser.
- **It does not sync.** Your data is tied to this browser on this device. Using a
  different browser, device or profile means starting from an empty dashboard.
- **Clearing browser data deletes it.** So does “Clear site data”. Use
  **Settings → Download backup** to keep a JSON copy; restore it with
  **Settings → Import** (choose *Add to my data* or *Replace everything*, and the file
  is validated and upgraded before anything is written).
- **Storage can be refused** (private windows, strict privacy settings). Afterglow
  detects this, keeps working for the session and tells you clearly that nothing will
  persist.
- **Schema versions.** The document carries `schemaVersion`. `scripts/store.js` holds a
  `MIGRATIONS` map keyed by the version being upgraded *from*, so a future format is one
  new function plus a bumped `SCHEMA_VERSION`. Documents without a version are treated
  as the earliest format; documents from a *newer* version are refused rather than
  silently mangled. Every document is passed through `sanitize()` on the way in, which
  drops unknown keys and repairs bad values.

---

## 6. Publish it with GitHub Pages

1. **Create a repository.** On GitHub: *New repository* → give it a name (for example
   `afterglow`) → Public → **do not** add a README or .gitignore → *Create repository*.
2. **Upload the files.** Either drag the whole `afterglow` folder contents into the
   repository page (Add file → *Upload files*, then commit), or from a terminal:

   ```bash
   cd afterglow
   git init
   git add .
   git commit -m "Add Afterglow"
   git branch -M main
   git remote add origin https://github.com/<your-username>/afterglow.git
   git push -u origin main
   ```

   Make sure `index.html` sits at the **top level** of the repository, not inside a
   nested folder — otherwise the site will 404 at its root.
3. **Turn on Pages.** In the repository: **Settings → Pages**. Under *Build and
   deployment*, set *Source* to **Deploy from a branch**, choose branch **main** and
   folder **/ (root)**, then **Save**.
4. **Wait a moment.** GitHub runs a short deployment job (usually under a minute, and
   the Pages screen shows its progress). When it finishes, your site is at
   `https://<your-username>.github.io/afterglow/`.
5. **Check it.** Open that URL, tick a habit, reload, and confirm the habit is still
   ticked. Because the site uses only relative paths, it works identically from a
   project sub-path like `/afterglow/`.

> GitHub occasionally renames menu items (for example “Deploy from a branch” has been
> called other things in older UIs). The concept is unchanged: **Settings → Pages →
> source: branch → `main` → `/ (root)`**.

### Updating a published version

Edit or replace the files and commit again (`git add . && git commit -m "Update" &&
git push`). Pages redeploys automatically, usually within a minute. No build step, no
cache-busting required, but if you see stale CSS/JS, hard-reload the page
(Ctrl/Cmd + Shift + R).

### Publishing as a “user site” instead

If you name the repository `<your-username>.github.io`, the site is served from the
root URL `https://<your-username>.github.io/` with the same steps. Nothing in the
project needs to change.

---

## 7. Accessibility, motion and performance notes

- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per view, a skip link.
- Every interactive element is a real `button`, `a`, `input`, `select` or `textarea`
  with a visible focus ring and an accessible name; icon-only buttons carry `aria-label`.
- Dialogs trap focus, close on `Escape`, return focus to the element that opened them,
  and mark themselves `aria-modal` with a labelled title.
- Completion is never communicated by colour alone (icon + text + `aria-pressed`).
- State changes are announced through a polite live region, throttled so it never
  becomes chatty.
- `prefers-reduced-motion: reduce` disables ambient animation, reveals and transitions,
  and **Settings → Motion** lets you force it either way. The whole atmosphere layer
  can be switched off.
- All visuals are CSS or inline SVG (a hand-written favicon and a single inline icon
  sprite). No external images, fonts or scripts, so nothing can 404 or slow the first paint.
- User text is inserted with `textContent` everywhere; there is no `innerHTML` path for
  habits, journal entries, tasks or goals, and the sanitiser strips unknown keys on import.

## 8. Known limitations (read this honestly)

- **Single-browser storage only.** No accounts or sync, by design in this version.
- **Reminders are notes, not notifications.** Afterglow never requests browser
  notification permission; the reminder field is text for you to read.
- **The Sunday letter and insights are arithmetic over your own records**, not analysis
  and not generated by a model. They describe counts and ratios only.
- **Testing performed:** a jsdom-driven behavioural suite (32 checks) covering routing,
  onboarding, habit CRUD, duplicate prevention, partial logging, rest-day streaks,
  future-date handling, timer behaviour across reloads, the no-motivation flow, journey
  control, theme persistence, export/import validation, corrupt-data recovery, schema
  migration, sanitising, escaping, focus preservation and the absence of console errors.
  Click-through behaviour was also verified over HTTP.
- **Not verified:** real assistive-technology testing (NVDA/JAWS/VoiceOver), iOS Safari
  and older browsers, printed output, and multi-tab editing at the same time. Treat
  these as untested rather than as passing.
- The heat map and calendar show *recorded* activity, not time spent — a day with no
  entry looks empty by design rather than being filled with a guess.

---

## 9. License

MIT — see `LICENSE`. Use it, change it, ship it; keep the copyright notice.

Built to feel like opening a quiet room at the end of a long day: a little light, a
little structure, and no judgement.
