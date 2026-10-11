/* ==========================================================================
   dates.js — local-calendar date helpers.
   Afterglow always works in the user's *local* calendar day. We never use
   toISOString() for day keys, because that converts to UTC and can shift a
   record to the previous or next day for users outside UTC.
   ========================================================================== */
(function (global) {
  'use strict';

  var Afterglow = global.Afterglow = global.Afterglow || {};

  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** Local date key: "YYYY-MM-DD" from local calendar fields. */
  function toKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** "YYYY-MM-DD" -> Date at local midnight (never UTC-parsed). */
  function fromKey(key) {
    if (typeof key !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
    if (isNaN(d.getTime())) return null;
    // Reject impossible dates such as 2026-02-31 that Date would roll over.
    if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
    return d;
  }

  function isValidKey(key) { return !!fromKey(key); }

  function todayKey() { return toKey(new Date()); }

  function nowKey(dateObj) { return toKey(dateObj || new Date()); }

  /** Add days using calendar fields so DST transitions cannot skew the result. */
  function addDays(input, amount) {
    var d = typeof input === 'string' ? fromKey(input) : new Date(input.getTime());
    if (!d) return null;
    var out = new Date(d.getFullYear(), d.getMonth(), d.getDate() + amount,
      d.getHours ? d.getHours() : 0, 0, 0, 0);
    return typeof input === 'string' ? toKey(out) : out;
  }

  function addMonths(input, amount) {
    var d = typeof input === 'string' ? fromKey(input) : new Date(input.getTime());
    if (!d) return null;
    var day = d.getDate();
    var out = new Date(d.getFullYear(), d.getMonth() + amount, 1, 0, 0, 0, 0);
    var last = daysInMonth(out.getFullYear(), out.getMonth());
    out.setDate(Math.min(day, last));
    return typeof input === 'string' ? toKey(out) : out;
  }

  /** Whole calendar days between two keys (b - a). */
  function diffDays(aKey, bKey) {
    var a = fromKey(aKey), b = fromKey(bKey);
    if (!a || !b) return NaN;
    var MS = 86400000;
    // Round, because a DST change makes a "day" 23 or 25 hours long.
    return Math.round((b.getTime() - a.getTime()) / MS);
  }

  function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }

  function isToday(key) { return key === todayKey(); }

  function isFutureKey(key) { return diffDays(todayKey(), key) > 0; }

  /** 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
  function weekdayOf(key) { var d = fromKey(key); return d ? d.getDay() : 0; }

  function startOfWeek(key, weekStart) {
    var d = fromKey(key) || new Date();
    var start = typeof weekStart === 'number' ? weekStart : 1;
    var offset = (d.getDay() - start + 7) % 7;
    return addDays(toKey(d), -offset);
  }

  /** Array of 7 keys for the week containing `key`, honouring the week start day. */
  function weekKeys(key, weekStart) {
    var start = startOfWeek(key, weekStart);
    var out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(start, i));
    return out;
  }

  /** Every day key in a month, padded so index 0 is aligned by weekday is not needed here. */
  function monthKeys(year, monthIndex) {
    var out = [];
    var total = daysInMonth(year, monthIndex);
    for (var day = 1; day <= total; day++) out.push(toKey(new Date(year, monthIndex, day)));
    return out;
  }

  /** Last `count` day keys, ending today. */
  function lastNDays(count, endKey) {
    var end = endKey || todayKey();
    var out = [];
    for (var i = count - 1; i >= 0; i--) out.push(addDays(end, -i));
    return out;
  }

  function dayName(index, style) {
    if (style === 'short') return DAY_SHORT[((index % 7) + 7) % 7];
    return DAY_NAMES[((index % 7) + 7) % 7];
  }

  function monthName(index, style) {
    if (style === 'short') return MONTH_SHORT[index];
    return MONTH_NAMES[index];
  }

  /** "Friday, 10 October 2026" */
  function formatLong(dateOrKey) {
    var d = typeof dateOrKey === 'string' ? fromKey(dateOrKey) : dateOrKey;
    if (!d) return '';
    return DAY_NAMES[d.getDay()] + ', ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
  }

  /** "Fri 10 Oct" */
  function formatShort(dateOrKey, withYear) {
    var d = typeof dateOrKey === 'string' ? fromKey(dateOrKey) : dateOrKey;
    if (!d) return '';
    var s = DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
    return withYear ? s + ' ' + d.getFullYear() : s;
  }

  /** "10 Oct" or "10 October 2026" */
  function formatDayMonth(dateOrKey, long) {
    var d = typeof dateOrKey === 'string' ? fromKey(dateOrKey) : dateOrKey;
    if (!d) return '';
    return d.getDate() + ' ' + (long ? MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear() : MONTH_SHORT[d.getMonth()]);
  }

  function monthLabel(year, monthIndex) { return MONTH_NAMES[monthIndex] + ' ' + year; }

  /** Local clock label, e.g. "07:42". */
  function timeLabel(date) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** Friendly day label for a key: Today / Yesterday / Tomorrow / "Fri 10 Oct". */
  function relativeDay(key) {
    var delta = diffDays(todayKey(), key);
    if (delta === 0) return 'Today';
    if (delta === -1) return 'Yesterday';
    if (delta === 1) return 'Tomorrow';
    if (delta < -1 && delta >= -6) return Math.abs(delta) + ' days ago';
    return formatShort(key);
  }

  /** Time-aware but never presumptuous. */
  function greeting(hour) {
    var h = typeof hour === 'number' ? hour : new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 22) return 'Good evening';
    return 'Still awake';
  }

  /** Minutes -> "1h 05m" or "25m". */
  function durationLabel(minutes) {
    var m = Math.max(0, Math.round(minutes || 0));
    var h = Math.floor(m / 60);
    var rest = m % 60;
    if (h > 0) return h + 'h ' + pad2(rest) + 'm';
    return rest + 'm';
  }

  function clockLabel(seconds) {
    var s = Math.max(0, Math.round(seconds || 0));
    var m = Math.floor(s / 60);
    return pad2(m) + ':' + pad2(s % 60);
  }

  /** "5 min", "90 seconds", "1 min" — used for honest tiny-action durations. */
  function humanDuration(seconds) {
    var s = Math.max(5, Math.round(seconds || 0));
    if (s < 60) return s + ' seconds';
    var m = Math.round(s / 60);
    return m + (m === 1 ? ' minute' : ' minutes');
  }

  Afterglow.dates = {
    DAY_NAMES: DAY_NAMES,
    DAY_SHORT: DAY_SHORT,
    MONTH_NAMES: MONTH_NAMES,
    MONTH_SHORT: MONTH_SHORT,
    pad2: pad2,
    toKey: toKey,
    fromKey: fromKey,
    isValidKey: isValidKey,
    todayKey: todayKey,
    addDays: addDays,
    addMonths: addMonths,
    diffDays: diffDays,
    daysInMonth: daysInMonth,
    isToday: isToday,
    isFutureKey: isFutureKey,
    weekdayOf: weekdayOf,
    startOfWeek: startOfWeek,
    weekKeys: weekKeys,
    monthKeys: monthKeys,
    lastNDays: lastNDays,
    dayName: dayName,
    monthName: monthName,
    monthLabel: monthLabel,
    formatLong: formatLong,
    formatShort: formatShort,
    formatDayMonth: formatDayMonth,
    timeLabel: timeLabel,
    relativeDay: relativeDay,
    greeting: greeting,
    durationLabel: durationLabel,
    clockLabel: clockLabel,
    humanDuration: humanDuration
  };
})(typeof window !== 'undefined' ? window : this);
