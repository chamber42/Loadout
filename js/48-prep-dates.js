'use strict';
/* ============================================================
   LOADOUT - WHEN A PREP ACTUALLY HAPPENS

   A prep has always been a run of numbered days. state.prep.schedule is
   day 1, day 2, day 3, and state.activeDay says which of them is being
   edited. Nowhere did anything record which Tuesday day 1 was.

   That was fine while the prep was only a cooking plan. It stops being
   fine the moment anything needs to know a date: a reminder that the food
   is about to run out cannot be scheduled against "day 5".

   ONE FIELD, AND WHAT IT LETS EVERYTHING ELSE ASK

   state.prep.startDate is the day key of prep day 1. From that alone:
   which date any prep day falls on, which prep day a date is, and when the
   food runs out. Nothing else needs storing, and nothing already stored
   changes meaning.

   WHAT THIS DELIBERATELY DOES NOT DO

   It does not move state.activeDay. Having a date means the app COULD
   decide which prep day you are on rather than asking, and that is a real
   improvement — but it is a change to how the loadout and journal screens
   behave, and it should be chosen rather than arriving as a side effect of
   wanting a reminder. The date is recorded and read; which day is active
   stays exactly as manual as it was.
   ============================================================ */

  function prepStartKey(){
    if (typeof state === 'undefined' || !state.prep) return null;
    const k = state.prep.startDate;
    return /^\d{4}-\d{2}-\d{2}$/.test(k || '') ? k : null;
  }

  function prepDayCountTotal(){
    if (typeof state === 'undefined' || !state.prep || !state.prep.schedule) return 0;
    return state.prep.schedule.length;
  }

  function shiftKey(key, days){
    const d = weightKeyToDate(key);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* The date a given prep day falls on. dayIdx is zero-based, matching
     state.prep.schedule. */
  function prepDateFor(dayIdx){
    const start = prepStartKey();
    if (!start) return null;
    return shiftKey(start, dayIdx);
  }

  /* Which prep day a date is, one-based, or null when the date sits
     outside the run. */
  function prepDayForDate(key){
    const start = prepStartKey();
    if (!start) return null;
    const offset = daysBetweenKeys(start, key);
    if (offset < 0 || offset >= prepDayCountTotal()) return null;
    return offset + 1;
  }

  /* The last day the prep covers. */
  function prepLastKey(){
    const n = prepDayCountTotal();
    if (!n) return null;
    return prepDateFor(n - 1);
  }

  /* Prepped days still ahead, counting today. Zero once the food has run
     out, null when there is no prep or no date on it. */
  function prepDaysLeft(fromKey){
    const start = prepStartKey();
    const n = prepDayCountTotal();
    if (!start || !n) return null;
    const from = fromKey || todayKey();
    const offset = daysBetweenKeys(start, from);
    if (offset < 0) return n;            // not started yet
    return Math.max(0, n - offset);
  }

  /* Stamps today onto a prep that has none.

     Called when a prep is built, and again on load for any prep saved
     before this field existed. Today rather than a question: a prep is
     built at the point somebody is about to cook and eat it, so today is
     right far more often than not, and it is one tap to change on the prep
     screen when it is wrong. Guessing beats interrupting. */
  function ensurePrepStartDate(){
    if (typeof state === 'undefined' || !state.prep) return;
    if (prepStartKey()) return;
    if (!prepDayCountTotal()) return;
    state.prep.startDate = todayKey();
  }

  function setPrepStartDate(key){
    if (typeof state === 'undefined' || !state.prep) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return false;
    state.prep.startDate = key;
    if (typeof schedulePrepReminder === 'function') schedulePrepReminder();
    return true;
  }

  /* "Mon 8 Sep" — the form used wherever a prep date is shown. */
  function prepDateLabel(key){
    if (!key) return '';
    const d = weightKeyToDate(key);
    return DOW[mondayIndex(d)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
  }

  window.prepStartKey       = prepStartKey;
  window.prepDateFor        = prepDateFor;
  window.prepDayForDate     = prepDayForDate;
  window.prepLastKey        = prepLastKey;
  window.prepDaysLeft       = prepDaysLeft;
  window.ensurePrepStartDate = ensurePrepStartDate;
  window.setPrepStartDate   = setPrepStartDate;
  window.prepDateLabel      = prepDateLabel;
