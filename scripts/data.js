/* ==========================================================================
   data.js — curated local content: categories, starter habits, the tiny-action
   bank behind "I have no motivation", the daily flow, the 30-day journey and
   the small toolkits. Everything here is authored for this project; nothing is
   fetched from the network.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};

  /* --- Categories and accent palette -------------------------------------- */
  var CATEGORIES = [
    { id: 'study', label: 'Study', icon: 'book', accent: 'amber' },
    { id: 'fitness', label: 'Fitness', icon: 'leaf', accent: 'sage' },
    { id: 'sleep', label: 'Sleep', icon: 'moon', accent: 'moon' },
    { id: 'wellbeing', label: 'Wellbeing', icon: 'heart', accent: 'clay' },
    { id: 'confidence', label: 'Confidence', icon: 'spark', accent: 'quartz' },
    { id: 'digital', label: 'Digital balance', icon: 'shield', accent: 'moon' },
    { id: 'grooming', label: 'Grooming', icon: 'target', accent: 'sage' },
    { id: 'custom', label: 'Something else', icon: 'tools', accent: 'amber' }
  ];

  var ACCENTS = [
    { id: 'sage', label: 'Sage', dark: '#93b39a', light: '#4f6d56' },
    { id: 'moon', label: 'Moonlight', dark: '#9ab3c9', light: '#4f6479' },
    { id: 'amber', label: 'Candlelight', dark: '#e5aa67', light: '#9a6a24' },
    { id: 'clay', label: 'Clay', dark: '#cf9b7d', light: '#96603f' },
    { id: 'quartz', label: 'Quartz', dark: '#b7a6c9', light: '#6b5b86' }
  ];

  var TARGET_TYPES = [
    { id: 'check', label: 'Just a tick', unit: '', hint: 'Done or not done.' },
    { id: 'minutes', label: 'Minutes', unit: 'min', hint: 'Log how long it took.' },
    { id: 'pages', label: 'Pages', unit: 'pages', hint: 'Reading or revision pages.' },
    { id: 'sessions', label: 'Sessions', unit: 'sessions', hint: 'Counts of a repeated action.' }
  ];

  function categoryById(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return CATEGORIES[CATEGORIES.length - 1];
  }
  function accentColor(id) {
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    for (var i = 0; i < ACCENTS.length; i++) {
      if (ACCENTS[i].id === id) return theme === 'light' ? ACCENTS[i].light : ACCENTS[i].dark;
    }
    return theme === 'light' ? ACCENTS[0].light : ACCENTS[0].dark;
  }
  function targetTypeById(id) {
    for (var i = 0; i < TARGET_TYPES.length; i++) if (TARGET_TYPES[i].id === id) return TARGET_TYPES[i];
    return TARGET_TYPES[0];
  }

  /* --- Starter habits ------------------------------------------------------
     Never a prescription: the first run seeds a handful of realistic habits and
     onboarding lets people start with fewer. All of them stay editable. */
  function generateStarterHabits(profile) {
    var prefs = profile || {};
    var budget = prefs.budget || 20;
    var studyMinutes = budget >= 30 ? 25 : (budget >= 20 ? 20 : 10);
    var focus = prefs.focus || 'balanced';

    var base = [
      { name: 'Study with focus', description: 'One subject, one tab, no notifications.', category: 'study', icon: 'book', targetType: 'minutes', targetAmount: studyMinutes, accent: 'amber' },
      { name: 'Move for ten minutes', description: 'Walk, stretch, march in place — anything counts.', category: 'fitness', icon: 'leaf', targetType: 'minutes', targetAmount: 10, accent: 'sage' },
      { name: 'Read a few pages', description: 'Notes, a textbook page, or something you enjoy.', category: 'study', icon: 'book', targetType: 'pages', targetAmount: 5, accent: 'amber' },
      { name: 'Prepare for sleep on time', description: 'Screens down, lights low, bag ready.', category: 'sleep', icon: 'moon', targetType: 'check', targetAmount: null, accent: 'moon' },
      { name: 'Phone away for one focus block', description: 'Out of reach for a single session.', category: 'digital', icon: 'shield', targetType: 'check', targetAmount: null, accent: 'moon' }
    ];

    if (focus === 'confidence') {
      base.push({ name: 'One small brave thing', description: 'A question asked, a hello, a clear sentence.', category: 'confidence', icon: 'spark', targetType: 'check', targetAmount: null, accent: 'quartz' });
    } else if (focus === 'health') {
      base.push({ name: 'Water with every meal', description: 'Simple, repeatable, easy to forget.', category: 'wellbeing', icon: 'heart', targetType: 'check', targetAmount: null, accent: 'clay' });
    } else if (focus === 'routines') {
      base.push({ name: 'Basic grooming reset', description: 'Teeth, face, hair — two minutes.', category: 'grooming', icon: 'target', targetType: 'check', targetAmount: null, accent: 'sage' });
    } else if (focus === 'studies') {
      base.push({ name: 'Review today\'s notes', description: 'Ten quiet minutes before the day ends.', category: 'study', icon: 'book', targetType: 'minutes', targetAmount: 10, accent: 'amber' });
    } else {
      base.push({ name: 'One small confidence-building action', description: 'Tiny counts. Private is fine.', category: 'confidence', icon: 'spark', targetType: 'check', targetAmount: null, accent: 'quartz' });
    }
    return base;
  }

  /* --- "I have no motivation" tiny-action bank -----------------------------
     Each action has a ladder: rung 0 is already small, and "make it even
     smaller" walks down to something almost impossible to refuse. Rungs are
     honest durations, and the last rung is allowed to be trivial. */
  var TINY_ACTIONS = [
    { id: 'study-notebook', category: 'study', title: 'Open your notebook to the next blank page', hint: 'Nothing has to be written yet.', ladder: [
      { title: 'Open your notebook to the next blank page', seconds: 60 },
      { title: 'Put the notebook on your desk and open it', seconds: 25 },
      { title: 'Pick up the notebook', seconds: 10 }] },
    { id: 'study-one-question', category: 'study', title: 'Answer one question from your notes', hint: 'Only one. Then you can stop.', ladder: [
      { title: 'Answer one question from your notes', seconds: 180 },
      { title: 'Reread one line of your notes', seconds: 60 },
      { title: 'Open the page with your notes', seconds: 20 }] },
    { id: 'study-one-sentence', category: 'study', title: 'Write one sentence about what you learned', hint: 'Rough is fine. Grammar is optional.', ladder: [
      { title: 'Write one sentence about what you learned', seconds: 120 },
      { title: 'Write five words about it', seconds: 45 },
      { title: 'Write the date at the top of a page', seconds: 15 }] },
    { id: 'study-five', category: 'study', title: 'Start a five-minute study block', hint: 'You can stop when it ends.', ladder: [
      { title: 'Start a five-minute study block', seconds: 300 },
      { title: 'Study for two minutes', seconds: 120 },
      { title: 'Read one paragraph slowly', seconds: 60 }] },
    { id: 'study-review', category: 'study', title: 'Reread the last thing you studied', hint: 'Recognition is real studying.', ladder: [
      { title: 'Reread the last thing you studied', seconds: 300 },
      { title: 'Find the page', seconds: 60 },
      { title: 'Open your notes app or folder', seconds: 20 }] },
    { id: 'move-stand', category: 'movement', title: 'Stand up and stretch your arms overhead', hint: 'Your body has been in one shape too long.', ladder: [
      { title: 'Stand up and stretch your arms overhead', seconds: 60 },
      { title: 'Just stand up for a moment', seconds: 15 },
      { title: 'Sit up straighter and roll your shoulders', seconds: 20 }] },
    { id: 'move-march', category: 'movement', title: 'March in place for 90 seconds', hint: 'Knees as high as feels fine.', ladder: [
      { title: 'March in place for 90 seconds', seconds: 90 },
      { title: 'March in place for 30 seconds', seconds: 30 },
      { title: 'Tap your feet while seated for 20 seconds', seconds: 20 }] },
    { id: 'move-wallpush', category: 'movement', title: 'Ten slow wall push-ups', hint: 'Lean on the wall and push gently.', ladder: [
      { title: 'Ten slow wall push-ups', seconds: 90 },
      { title: 'Three wall push-ups', seconds: 40 },
      { title: 'Two wall push-ups, very slow', seconds: 25 }] },
    { id: 'move-walk', category: 'movement', title: 'Walk to the end of the street and back', hint: 'Fresh air does a lot of quiet work.', ladder: [
      { title: 'Walk to the end of the street and back', seconds: 300 },
      { title: 'Step outside for one minute', seconds: 60 },
      { title: 'Open a door or window and take a breath', seconds: 20 }] },
    { id: 'move-sitstand', category: 'movement', title: 'Five sit-to-stands from a chair', hint: 'Use your hands for support if you like.', ladder: [
      { title: 'Five sit-to-stands from a chair', seconds: 90 },
      { title: 'Two sit-to-stands', seconds: 40 },
      { title: 'One sit-to-stand, slowly', seconds: 20 }] },
    { id: 'well-breathe', category: 'wellbeing', title: 'Six slow breaths, out for longer than in', hint: 'No counting rules. Just slower than usual.', ladder: [
      { title: 'Six slow breaths, out for longer than in', seconds: 90 },
      { title: 'Three slow breaths', seconds: 30 },
      { title: 'One long breath out', seconds: 10 }] },
    { id: 'well-water', category: 'wellbeing', title: 'Fill a glass of water and drink it', hint: 'Being thirsty makes everything feel harder.', ladder: [
      { title: 'Fill a glass of water and drink it', seconds: 120 },
      { title: 'Fill a glass of water', seconds: 45 },
      { title: 'Take one sip of water', seconds: 10 }] },
    { id: 'well-window', category: 'wellbeing', title: 'Stand near a window or outside for two minutes', hint: 'Light and distance help more than scrolling.', ladder: [
      { title: 'Stand near a window or outside for two minutes', seconds: 120 },
      { title: 'Open a window and look outside', seconds: 30 },
      { title: 'Look at something far away for ten seconds', seconds: 10 }] },
    { id: 'well-unclench', category: 'wellbeing', title: 'Unclench your jaw and drop your shoulders', hint: 'Notice what your body is holding.', ladder: [
      { title: 'Unclench your jaw and drop your shoulders', seconds: 30 },
      { title: 'Take one full breath out through your mouth', seconds: 12 }] },
    { id: 'order-one', category: 'order', title: 'Put one item back where it belongs', hint: 'One. Not the whole room.', ladder: [
      { title: 'Put one item back where it belongs', seconds: 45 },
      { title: 'Pick up one item', seconds: 15 },
      { title: 'Straighten the one thing closest to you', seconds: 10 }] },
    { id: 'order-desk', category: 'order', title: 'Clear a hand-sized space on your desk', hint: 'A small clear patch is enough to work in.', ladder: [
      { title: 'Clear a hand-sized space on your desk', seconds: 120 },
      { title: 'Move one thing off your desk', seconds: 30 },
      { title: 'Push one object to the edge', seconds: 10 }] },
    { id: 'order-bag', category: 'order', title: 'Put tomorrow\'s essentials in your bag', hint: 'Keys, notes, charger, whatever it is.', ladder: [
      { title: 'Put tomorrow\'s essentials in your bag', seconds: 180 },
      { title: 'Set out one item for tomorrow', seconds: 40 },
      { title: 'Think of one thing you will need', seconds: 15 }] },
    { id: 'digital-away', category: 'digital', title: 'Put your phone in another room for five minutes', hint: 'Distance beats willpower.', ladder: [
      { title: 'Put your phone in another room for five minutes', seconds: 300 },
      { title: 'Turn your phone face down', seconds: 15 },
      { title: 'Put your phone down where you cannot see it', seconds: 5 }] },
    { id: 'digital-silence', category: 'digital', title: 'Silence one noisy app for an hour', hint: 'You can leave the rest as it is.', ladder: [
      { title: 'Silence one noisy app for an hour', seconds: 90 },
      { title: 'Close the app you were just in', seconds: 15 }] },
    { id: 'digital-quiet', category: 'digital', title: 'Start a ten-minute do-not-disturb block', hint: 'The world can wait ten minutes.', ladder: [
      { title: 'Start a ten-minute do-not-disturb block', seconds: 60 },
      { title: 'Turn the screen brightness down', seconds: 15 }] },
    { id: 'sleep-lights', category: 'sleep', title: 'Dim the lights and step away from bright screens', hint: 'The room can start to feel like evening.', ladder: [
      { title: 'Dim the lights and step away from bright screens', seconds: 120 },
      { title: 'Lower your screen brightness', seconds: 20 }] },
    { id: 'sleep-clothes', category: 'sleep', title: 'Set out tomorrow\'s clothes', hint: 'Tomorrow-you saves five minutes of deciding.', ladder: [
      { title: 'Set out tomorrow\'s clothes', seconds: 180 },
      { title: 'Choose tomorrow\'s top', seconds: 60 },
      { title: 'Open the drawer and look', seconds: 20 }] },
    { id: 'sleep-wind', category: 'sleep', title: 'Do one calm thing for three minutes before bed', hint: 'Stretch, breathe, or read a page of anything.', ladder: [
      { title: 'Do one calm thing for three minutes before bed', seconds: 180 },
      { title: 'Take three slow breaths with your eyes closed', seconds: 40 }] },
    { id: 'conf-hello', category: 'confidence', title: 'Say hello to one person', hint: 'A nod and a smile counts too.', ladder: [
      { title: 'Say hello to one person', seconds: 60 },
      { title: 'Make eye contact and nod at one person', seconds: 30 },
      { title: 'Smile at one person', seconds: 10 }] },
    { id: 'conf-question', category: 'confidence', title: 'Ask one question out loud', hint: 'Small and specific is easier than grand.', ladder: [
      { title: 'Ask one question out loud', seconds: 120 },
      { title: 'Write down one question to ask later', seconds: 60 },
      { title: 'Note the one confusing word', seconds: 25 }] },
    { id: 'conf-note', category: 'confidence', title: 'Write down one thing you handled well today', hint: 'Evidence, not flattery.', ladder: [
      { title: 'Write down one thing you handled well today', seconds: 120 },
      { title: 'Think of one thing you handled and say it quietly', seconds: 30 }] },
    { id: 'conf-clear', category: 'confidence', title: 'Say one sentence a little more clearly than usual', hint: 'Slower and louder is allowed.', ladder: [
      { title: 'Say one sentence a little more clearly than usual', seconds: 30 },
      { title: 'Read one sentence out loud', seconds: 20 }] },
    { id: 'groom-basics', category: 'grooming', title: 'Do one quick grooming step', hint: 'Teeth, face, or hair — only one is needed.', ladder: [
      { title: 'Do one quick grooming step', seconds: 120 },
      { title: 'Wash your face or brush your teeth', seconds: 90 },
      { title: 'Wash your hands and tidy your hair', seconds: 30 }] },
    { id: 'rest-lie', category: 'rest', title: 'Lie down and rest for three minutes', hint: 'Rest is a legitimate answer.', ladder: [
      { title: 'Lie down and rest for three minutes', seconds: 180 },
      { title: 'Close your eyes for sixty seconds', seconds: 60 },
      { title: 'Take one slow breath with your eyes shut', seconds: 10 }] },
    { id: 'rest-air', category: 'rest', title: 'Step outside for two quiet minutes', hint: 'No phone, nothing to achieve.', ladder: [
      { title: 'Step outside for two quiet minutes', seconds: 120 },
      { title: 'Open a window and listen for a moment', seconds: 30 }] },
    { id: 'rest-drink', category: 'rest', title: 'Make a warm drink and just sit with it', hint: 'Sitting counts. Five minutes of nothing.', ladder: [
      { title: 'Make a warm drink and just sit with it', seconds: 300 },
      { title: 'Boil the kettle and take a breath', seconds: 90 }] }
  ];

  var COMFORT_LINES = [
    'You do not have to feel ready.',
    'Let\'s make this smaller.',
    'Nothing has to be fixed right now.',
    'We can start from exactly here.',
    'Low days still count as days.'
  ];
  var MOTIVATION_DECLINES = [
    'That is a fine answer. The door stays open.',
    'Not now is allowed. Nothing is lost.',
    'Rest is a real option. Come back whenever.'
  ];
  var MOTIVATION_WINS = [
    'That was smaller than a habit and still real.',
    'Recorded. Quiet progress is still progress.',
    'Noted — that one goes in the archive.'
  ];

  /* --- Daily flow --------------------------------------------------------- */
  var FLOW_PLANS = {
    15: [
      { title: 'Focus study', text: 'One page or one question. Nothing ambitious.', minutes: 5, category: 'study' },
      { title: 'Movement', text: 'March, stretch, or step outside.', minutes: 4, category: 'fitness' },
      { title: 'Reset', text: 'Water, one tidy surface, tomorrow\'s bag.', minutes: 3, category: 'custom' },
      { title: 'Wind down', text: 'Dim the screens. Note one thing that went okay.', minutes: 3, category: 'sleep' }
    ],
    20: [
      { title: 'Focus study', text: 'One topic, one tab, phone out of reach.', minutes: 8, category: 'study' },
      { title: 'Movement', text: 'Anything that changes your shape for a few minutes.', minutes: 5, category: 'fitness' },
      { title: 'Reset', text: 'Tidy one surface and prepare tomorrow.', minutes: 4, category: 'custom' },
      { title: 'Reflect', text: 'One line in the journal, or one small win.', minutes: 3, category: 'wellbeing' }
    ],
    30: [
      { title: 'Focus study', text: 'One intention, written at the top of the page.', minutes: 10, category: 'study' },
      { title: 'Movement', text: 'Beginner routine, or a walk. Skip anything uncomfortable.', minutes: 8, category: 'fitness' },
      { title: 'Digital quiet', text: 'Phone in another room while you work.', minutes: 5, category: 'digital' },
      { title: 'Reset', text: 'Bag packed, desk cleared, clothes out.', minutes: 4, category: 'custom' },
      { title: 'Reflect', text: 'Two lines: what helped, what to make easier.', minutes: 3, category: 'wellbeing' }
    ]
  };

  var MINIMUM_DAY = [
    { id: 'min-study', title: 'One tiny study action', text: 'Open the notebook. Read one line. That is the whole task.', minutes: 5, category: 'study' },
    { id: 'min-move', title: 'A short stretch or walk', text: 'Stand, stretch, or step outside for three minutes.', minutes: 3, category: 'fitness' },
    { id: 'min-reset', title: 'One basic reset', text: 'Put tomorrow\'s essentials somewhere you will find them.', minutes: 2, category: 'custom' }
  ];

  /* --- 30-day journey ----------------------------------------------------- */
  var JOURNEY = [
    { week: 1, title: 'Make it easy', theme: 'One habit, made small enough to repeat.',
      days: [
        { title: 'Pick one habit', prompt: 'Choose a single habit to focus on this week. One is plenty.' },
        { title: 'Shrink it', prompt: 'What is the smallest version you would still count? Write it down.' },
        { title: 'Attach it to something', prompt: 'After brushing your teeth, after dinner, after sitting down — pick a cue.' },
        { title: 'Do it badly', prompt: 'Do the smallest version today even if it feels too easy. Easy is the point.' },
        { title: 'Notice the friction', prompt: 'What got in the way? Remove one small obstacle for tomorrow.' },
        { title: 'Two in a row', prompt: 'Repeat the same small version. Two days is a rhythm starting.' },
        { title: 'Look back for a minute', prompt: 'What made this week easier than you expected?' }
      ] },
    { week: 2, title: 'Build a rhythm', theme: 'Add a little, protect your rest.',
      days: [
        { title: 'Add one thing', prompt: 'Add movement or rest — whichever you are missing more.' },
        { title: 'Plan for a busy day', prompt: 'Write the minimum-day version of today before it starts.' },
        { title: 'Protect your sleep', prompt: 'Set one cue thirty minutes before bed and keep it.' },
        { title: 'Move for ten', prompt: 'Ten minutes of anything counts as movement today.' },
        { title: 'One screen boundary', prompt: 'Pick one place, or one hour, that stays phone-free.' },
        { title: 'Ask for nothing', prompt: 'Notice one thing that went fine without being forced.' },
        { title: 'Rest on purpose', prompt: 'Log a rest day deliberately instead of by accident.' }
      ] },
    { week: 3, title: 'Strengthen focus and confidence', theme: 'Small courage, honest focus.',
      days: [
        { title: 'One full session', prompt: 'Try a full focus session with a single written intention.' },
        { title: 'Say one thing out loud', prompt: 'Answer, ask, or explain something to another person.' },
        { title: 'Name the hard part', prompt: 'Write down the exact step you have been avoiding.' },
        { title: 'Do the first minute', prompt: 'Only the first minute of that step. Then decide.' },
        { title: 'Sleep earlier than usual', prompt: 'Aim for a bedtime you could repeat tomorrow.' },
        { title: 'One small brave thing', prompt: 'Something slightly outside your usual — kept small.' },
        { title: 'Notice the shift', prompt: 'What feels lighter than three weeks ago?' }
      ] },
    { week: 4, title: 'Review, adjust, keep what works', theme: 'Keep three, drop one, stay flexible.',
      days: [
        { title: 'Keep three', prompt: 'Choose the three habits worth keeping.' },
        { title: 'Drop one', prompt: 'Pause or drop something that is not working. That is maintenance, not failure.' },
        { title: 'Make it fit', prompt: 'Adjust one target so it survives an ordinary Tuesday.' },
        { title: 'Teach it back', prompt: 'Explain one thing you learned this month, out loud or on paper.' },
        { title: 'Plan a soft week', prompt: 'Write the minimum version of your coming week.' },
        { title: 'Write the honest summary', prompt: 'What actually helped? What was noise?' },
        { title: 'Set the next small step', prompt: 'One thing to continue, one thing to try next.' },
        { title: 'Credit yourself', prompt: 'Name one effort this month that deserved credit.' },
        { title: 'Begin again', prompt: 'Start the next month with one habit, not ten.' }
      ] }
  ];

  /* --- Journal ----------------------------------------------------------- */
  var JOURNAL_PROMPTS = [
    'What went a little better today?',
    'What made focusing difficult?',
    'What is one thing I want to make easier tomorrow?',
    'What is one thing I did even though it was hard?',
    'What did I notice that I usually rush past?',
    'What would make tomorrow a good enough day?',
    'What am I carrying that I could put down?',
    'Who or what helped today?'
  ];
  var MOOD_LABELS = ['Low', 'Flat', 'Okay', 'Good', 'Bright'];
  var ENERGY_LABELS = ['Empty', 'Low', 'Steady', 'Ready', 'Plenty'];
  var WIN_PROMPTS = [
    'What went a little better today?',
    'What did you do even though it was hard?',
    'What did you finish that nobody noticed?',
    'What did you handle better than last week?'
  ];

  /* --- Toolkits ----------------------------------------------------------- */
  var STUDY_MICRO_STEPS = [
    'Rewrite the question in your own words',
    'Solve only the first line',
    'Find one worked example',
    'Explain it out loud in thirty seconds',
    'Write the confusing part as a question',
    'Redo one solved question without looking'
  ];
  var MOVEMENT_ROUTINE = [
    { name: 'Sit-to-stand', detail: 'From a sturdy chair, stand and sit five times at your own pace.', alt: 'Hold the chair back for support, or stay seated and press your feet down.' },
    { name: 'Wall push-ups', detail: 'Hands on the wall, six slow push-aways.', alt: 'Use a counter instead of a wall for a gentler angle.' },
    { name: 'March in place', detail: 'Lift your knees gently for sixty seconds.', alt: 'Tap your feet while seated.' },
    { name: 'Bird-dog', detail: 'On hands and knees, reach one arm forward, four times each side.', alt: 'Seated, lift one arm at a time.' },
    { name: 'Standing stretch', detail: 'Reach overhead, then fold forward softly for thirty seconds.', alt: 'Roll your shoulders from a chair.' },
    { name: 'Easy squat', detail: 'Five comfortable squats down to a chair.', alt: 'Two squats, or just stand and sit once.' }
  ];
  var WIND_DOWN_CHECKS = [
    'Screens dimmed or put away',
    'Two minutes of stretching or slow breathing',
    'Tomorrow\'s first task written down',
    'Water bottle refilled',
    'Phone out of reach of the bed',
    'Lights out near your target time'
  ];
  var GROOMING_MORNING = ['Brush teeth', 'Wash face', 'Hair tidy', 'Deodorant', 'Clothes that feel comfortable'];
  var GROOMING_EVENING = ['Brush teeth', 'Wash face', 'Clothes out for tomorrow', 'Bag or notes packed', 'Screens down before bed'];
  var CONFIDENCE_CHALLENGES = [
    { id: 'c1', text: 'Say hello to someone you do not usually talk to' },
    { id: 'c2', text: 'Ask one question out loud instead of saving it for later' },
    { id: 'c3', text: 'Share an idea without softening it first' },
    { id: 'c4', text: 'Answer with one more sentence than usual' },
    { id: 'c5', text: 'Give someone a specific, honest compliment' },
    { id: 'c6', text: 'Say one full sentence more slowly than you normally would' },
    { id: 'c7', text: 'Sit somewhere you can be seen' },
    { id: 'c8', text: 'Do one thing on your own, without checking who else wants to' },
    { id: 'c9', text: 'Thank someone for something specific' },
    { id: 'c10', text: 'Make eye contact for one whole conversation' },
    { id: 'c11', text: 'Walk in and say hello first' },
    { id: 'c12', text: 'Write down one thing you handled well' }
  ];
  var HEADLINES = [
    'Make room for one good thing.',
    'One small step is enough to begin.',
    'Today\'s progress can be quiet.',
    'Start where you actually are.',
    'A little better is still better.',
    'You can restart from here.',
    'Small and steady counts.',
    'Keep the goal close and the day gentle.'
  ];
  var FUTURE_SEEDS = [
    { title: 'Get through this school year without burning out', horizon: 'This year', next: 'Write the minimum version of a school week' },
    { title: 'Feel steadier speaking in class', horizon: 'Next few months', next: 'Ask one question this week' },
    { title: 'Sleep at a repeatable time', horizon: 'Next month', next: 'Choose a wind-down cue and set it once' }
  ];

  /* --- Default state ------------------------------------------------------ */
  function defaultState() {
    return {
      schemaVersion: Afterglow.store ? Afterglow.store.SCHEMA_VERSION : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile: { onboarded: false, name: '', focus: 'balanced', budget: 20, dayStart: '07:00' },
      settings: {
        theme: 'dark',
        motion: 'system',          // system | on | off
        weekStart: 1,              // 0 Sunday, 1 Monday
        confirmDestructive: true,
        showAtmosphere: true
      },
      habits: [],
      order: [],                   // habit ids in display order
      logs: {},                    // habitId -> { 'YYYY-MM-DD': { amount, at } }
      skips: {},                   // habitId -> { 'YYYY-MM-DD': at }
      flow: { plan: [], planBudget: 20, minimum: { enabled: true, blocks: [] }, done: {} },
      timer: { preset: 20, sessions: [] },
      journey: { active: false, startedAt: null, pausedAt: null, days: {}, skipped: false },
      journal: [],
      wins: [],
      motivation: { recent: [], lastShownAt: null },
      checklists: {},               // checklistId -> { 'YYYY-MM-DD': [itemIds] }
      tasks: [],
      goals: [],
      confidence: {},               // 'YYYY-MM-DD' -> challenge id
      notes: {},                    // small key/value text (sleep intention, future-me notes)
      future: { notes: '' },
      sunday: { dismissedFor: '' },
      meta: { seeded: false, storageNoteSeen: false }
    };
  }

  Afterglow.data = {
    CATEGORIES: CATEGORIES,
    ACCENTS: ACCENTS,
    TARGET_TYPES: TARGET_TYPES,
    categoryById: categoryById,
    accentColor: accentColor,
    targetTypeById: targetTypeById,
    generateStarterHabits: generateStarterHabits,
    TINY_ACTIONS: TINY_ACTIONS,
    COMFORT_LINES: COMFORT_LINES,
    MOTIVATION_DECLINES: MOTIVATION_DECLINES,
    MOTIVATION_WINS: MOTIVATION_WINS,
    FLOW_PLANS: FLOW_PLANS,
    MINIMUM_DAY: MINIMUM_DAY,
    JOURNEY: JOURNEY,
    JOURNAL_PROMPTS: JOURNAL_PROMPTS,
    MOOD_LABELS: MOOD_LABELS,
    ENERGY_LABELS: ENERGY_LABELS,
    WIN_PROMPTS: WIN_PROMPTS,
    STUDY_MICRO_STEPS: STUDY_MICRO_STEPS,
    MOVEMENT_ROUTINE: MOVEMENT_ROUTINE,
    WIND_DOWN_CHECKS: WIND_DOWN_CHECKS,
    GROOMING_MORNING: GROOMING_MORNING,
    GROOMING_EVENING: GROOMING_EVENING,
    CONFIDENCE_CHALLENGES: CONFIDENCE_CHALLENGES,
    HEADLINES: HEADLINES,
    FUTURE_SEEDS: FUTURE_SEEDS,
    defaultState: defaultState
  };
})(typeof window !== 'undefined' ? window : this);
