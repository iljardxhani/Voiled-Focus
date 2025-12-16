document.addEventListener('DOMContentLoaded', () => {
// --- CONFIG (place at the very top of your JS) ---
let TEST_MODE = false; // overridden by settings

// Real durations (ms)
const REAL_GREEN_MS = 25 * 60 * 1000; // 25 minutes
const REAL_BLUE_MS  = 5  * 60 * 1000; // 5 minutes

// Test durations (ms) — ultra-short so a full cycle finishes about a second
const TEST_GREEN_MS = 500;
const TEST_BLUE_MS  = 500;

// Final values used by the app


  const addTaskBtn = document.getElementById('addTaskBtn');
  const taskInput = document.getElementById('taskInput');
  const taskList = document.getElementById('taskList');
  const cycleBtn = document.getElementById('cycleBtn');
  const focusedDisplay = document.querySelector('.progress');
  const sessionGridEl = document.getElementById('sessionGrid');
  const callItDayBtn = document.getElementById('callItDayBtn');
  const plannerGrid = document.getElementById('plannerGrid');
  const calendarPanel = document.getElementById('calendarPanel');
  const dayPanel = document.getElementById('dayPanel');
  const backToCalendarBtn = document.getElementById('backToCalendarBtn');
  const yearTitle = document.getElementById('yearTitle');
  const prevYearBtn = document.getElementById('prevYearBtn');
  const nextYearBtn = document.getElementById('nextYearBtn');
  const MAX_DAILY_SESSIONS = 20;
  let cycles = 1;
  let focusedTime = 0; // optional, kept for compatibility
  const yearGrid = document.getElementById('yearGrid');
  const programDayBtn = document.getElementById('programDayBtn');
  const dayEmptyState = document.getElementById('dayEmptyState');
  const dayDetailContainer = document.getElementById('dayDetailContainer');
  const selectedDateLabel = document.getElementById('selectedDateLabel');
  const selectedDateHint = document.getElementById('selectedDateHint');
  const realTodayKey = () => new Date().toISOString().slice(0, 10);
  const STORE_KEY = 'voiled_focus_state_v1';
  const TASKS_KEY = 'voiled_tasks_v1';
  const CALENDAR_KEY = 'voiled_calendar_v1';
  const SETTINGS_KEY = 'voiled_settings_v1';
  const GOALS_KEY = 'voiled_goals_v1';
  const SELECTED_DATE_KEY = 'voiled_selected_date_v1';
  const TASKS_DB_KEY = 'voiled_tasks_db_v1';

  const settingsInit = loadSettings();
  TEST_MODE = !!settingsInit.testMode;
  let GREEN_MS = TEST_MODE ? TEST_GREEN_MS : REAL_GREEN_MS;
  let BLUE_MS  = TEST_MODE ? TEST_BLUE_MS  : REAL_BLUE_MS;
  refreshDurations();

  let focusedToday = 0;
  let calendarData = loadCalendarData();
  ensureTasksDbSeeded();
  let selectedDate = calendarPanel ? (loadSelectedDate() || effectiveTodayKey()) : effectiveTodayKey(); // day page always opens on today
  let currentYear = new Date(selectedDate).getFullYear();
  let expandedMonth = null;
  let dragPreviewDate = null;
  let dragPreviewTimer = null;
  let lastGoalReservation = null;
  let isGoalDragging = false;
  const reservedCache = new Set();
  let pendingLocalCalendarEvents = 0;

  function clearNavActions() {
    publishNavActions([]);
  }










  const copyBtn = document.getElementById('copyBtn');
  copyBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch('todoPromt.txt');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Copy failed', err);
      alert('Failed to copy.');
    }
  });

  function resetSelectedDay() {
    releaseReservationsForDay(selectedDate);
    calendarData.days[selectedDate] = { tasks: [], focusCount: 0, planned: false };
    writeTasksForDate(selectedDate, [], { forcePlanned: false });
    persistCalendar();
    focusedToday = 0;
    if (taskList) taskList.innerHTML = '';
    renumberTasks();
    buildGrid();
    updateGrid(0);
    updateCalendarCellClasses();
    selectDay(selectedDate);
    if (focusedDisplay) focusedDisplay.textContent = `Focused: ${focusedToday}`;
    alert('Day cleared. Program this day again to add tasks.');
  }

  // Call it a Day logic (destructive, with confirmation + motivational alert)
  function callItDay() {
    if (!isTodaySelected()) return;

    const confirmMsg = "Call it a Day? This will clear today's progress and tasks. Proceed?";
    if (!confirm(confirmMsg)) return;

    const unfinished = Array.from(taskList?.children || []).filter(li => !li.classList.contains('completed')).map(li => ({
      text: li.querySelector('.task-text .task-label')?.textContent || '',
      cycles: li.dataset.cycles || '1'
    })).filter(t => t.text);

    let carryOver = false;
    if (confirm('Carry over unfinished tasks to tomorrow?')) {
      carryOver = true;
    }

    // Motivational message (edit this string if you want different phrasing)
    alert("Congratulations — you crushed it today! Take a proper break. 🌟\nEverything is cleared and ready for tomorrow.");
    
    
    // Fireworks show with sound
    if (typeof confetti === 'function') {
      const bursts = 5;
      for (let i = 0; i < bursts; i++) {
        setTimeout(() => {
          confetti({
            particleCount: 100 + Math.floor(Math.random() * 100),
            spread: 60 + Math.random() * 40,
            origin: { x: Math.random(), y: Math.random() * 0.5 },
            colors: ['#ff0a54','#ff477e','#ff7096','#ff85a1','#fbb1b7']
          });

          // Play sound
          playSound('confetti.mp3');
        }, i * 300);
      }
      playSound('victory.mp3');
    }


    // Stop any running visual work and clean tasks in DOM safely
    // If there are running tasks, remove their progress bars and mark not running before clearing
    Array.from(taskList.children).forEach(li => {
      try {
        li.dataset.running = 'false';
        li.querySelectorAll('.progress-bar').forEach(b => b.remove());
      } catch (e) {}
    });

    // Release goal reservations before wiping the day
    releaseReservationsForDay(selectedDate);

    // Clear tasks visually and reset counters/grid
    taskList.innerHTML = '';
    focusedToday = 0;
    const clearedEntry = getDayEntry(selectedDate);
    clearedEntry.planned = false;
    writeTasksForDate(selectedDate, [], { forcePlanned: false });
    saveState();     // persist reset day state
    saveTasks();
    buildGrid();
    updateGrid(0);
    updateCalendarCellClasses();

    if (carryOver) {
      const nextDateObj = new Date(`${selectedDate}T00:00:00`);
      nextDateObj.setDate(nextDateObj.getDate() + 1);
      const nextDate = nextDateObj.toISOString().slice(0, 10);
      const nextEntry = getDayEntry(nextDate);
      unfinished.forEach(t => nextEntry.tasks.push({ text: t.text, cycles: t.cycles, completed: false }));
      appendTasksForDate(nextDate, unfinished.map(t => ({ ...t, completed: false })));
      if (unfinished.length) nextEntry.planned = true;
      persistCalendar();
      updateCalendarCellClasses();
    }

    if (focusedDisplay) focusedDisplay.textContent = `Focused: ${focusedToday}`;
  }

  // --- calendar + state helpers
  function loadCalendarData() {
    try {
      const raw = localStorage.getItem(CALENDAR_KEY);
      if (!raw) return { days: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.days !== 'object') {
        return { days: {} };
      }
      return { days: parsed.days };
    } catch {
      return { days: {} };
    }
  }

  function reloadCalendarData() {
    calendarData = loadCalendarData();
  }

  function normalizeTask(task = {}) {
    return {
      text: task.text || '',
      cycles: task.cycles ? String(task.cycles) : "1",
      completed: !!task.completed,
      running: !!task.running,
      runningPhase: task.runningPhase || null,
      runningCycle: task.runningCycle || null,
      startedAt: task.startedAt ? Number(task.startedAt) : null,
      sourceGoalId: task.sourceGoalId || null,
      sourceTaskId: task.sourceTaskId || null,
      sourceGoalText: task.sourceGoalText || null,
      date: task.date || null
    };
  }

  function loadTasksDbRaw() {
    try {
      const raw = localStorage.getItem(TASKS_DB_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
    } catch {}
    return [];
  }

  function persistTasksDb(tasks) {
    try {
      localStorage.setItem(TASKS_DB_KEY, JSON.stringify({ tasks }));
      pendingLocalCalendarEvents += 1;
      notifyCalendarUpdated();
    } catch {}
  }

  function tasksForDate(dateStr) {
    return loadTasksDbRaw()
      .filter(t => t && t.date === dateStr)
      .map(t => {
        const norm = normalizeTask(t);
        const { date, ...rest } = norm;
        return rest;
      });
  }

  function writeTasksForDate(dateStr, tasks, options = {}) {
    const forcePlanned = Object.prototype.hasOwnProperty.call(options, 'forcePlanned') ? !!options.forcePlanned : null;
    const base = loadTasksDbRaw().filter(t => t && t.date !== dateStr);
    const shaped = (tasks || []).map(t => ({ ...normalizeTask(t), date: dateStr }));
    persistTasksDb([...base, ...shaped]);
    const entry = getDayEntry(dateStr);
    const tasksForEntry = shaped.map(t => {
      const { date, ...rest } = t;
      return rest;
    });
    entry.tasks = tasksForEntry;
    if (forcePlanned === null) {
      entry.planned = entry.tasks.length > 0 || dateStr === effectiveTodayKey() || entry.planned;
    } else {
      entry.planned = forcePlanned;
    }
    return tasksForEntry;
  }

  function appendTasksForDate(dateStr, newTasks) {
    const existing = tasksForDate(dateStr);
    return writeTasksForDate(dateStr, [...existing, ...(newTasks || [])]);
  }

  function syncEntryFromDb(dateStr) {
    const entry = getDayEntry(dateStr);
    entry.tasks = tasksForDate(dateStr);
    entry.planned = entry.planned || entry.tasks.length > 0 || dateStr === effectiveTodayKey();
    return entry;
  }

  function syncCalendarFromTasksDb() {
    const grouped = {};
    loadTasksDbRaw().forEach(item => {
      if (!item?.date) return;
      const norm = normalizeTask(item);
      const { date, ...rest } = norm;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(rest);
    });
    Object.entries(grouped).forEach(([date, tasks]) => {
      const entry = getDayEntry(date);
      entry.tasks = tasks;
      entry.planned = entry.planned || tasks.length > 0 || date === effectiveTodayKey();
    });
  }

  function ensureTasksDbSeeded() {
    const existing = loadTasksDbRaw();
    if (existing.length) {
      syncCalendarFromTasksDb();
      return;
    }
    const seed = [];
    Object.entries(calendarData.days || {}).forEach(([date, entry]) => {
      (entry?.tasks || []).forEach(t => {
        seed.push({ ...normalizeTask(t), date });
      });
    });
    if (seed.length) {
      persistTasksDb(seed);
      syncCalendarFromTasksDb();
    }
  }

  function persistCalendar() {
    try {
      localStorage.setItem(CALENDAR_KEY, JSON.stringify(calendarData));
      pendingLocalCalendarEvents += 1;
      notifyCalendarUpdated();
    } catch {}
  }

  function notifyCalendarUpdated() {
    try {
      window.dispatchEvent(new Event('calendar-updated'));
      window.parent?.postMessage({ type: 'calendar-updated' }, '*');
    } catch {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.volume === 'number') {
        return {
          volume: Math.max(0, Math.min(1, parsed.volume)),
          overrideDate: parsed.overrideDate || null,
          testMode: !!parsed.testMode
        };
      }
    } catch {}
    return { volume: 1, overrideDate: null, testMode: false };
  }

  function getVolume() {
    const settings = loadSettings();
    return Math.max(0, Math.min(1, settings.volume ?? 1));
  }

  function loadSelectedDate() {
    try {
      const raw = localStorage.getItem(SELECTED_DATE_KEY);
      if (!raw) return null;
      const d = new Date(`${raw}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function saveSelectedDate(dateStr) {
    try {
      localStorage.setItem(SELECTED_DATE_KEY, dateStr);
    } catch {}
  }

  function refreshDurations() {
    const settings = loadSettings();
    TEST_MODE = !!settings.testMode;
    GREEN_MS = TEST_MODE ? TEST_GREEN_MS : REAL_GREEN_MS;
    BLUE_MS  = TEST_MODE ? TEST_BLUE_MS  : REAL_BLUE_MS;
  }

  function effectiveTodayKey() {
    const settings = loadSettings();
    const iso = settings.overrideDate;
    if (iso && !Number.isNaN(new Date(`${iso}T00:00:00`).getTime())) {
      return iso;
    }
    return realTodayKey();
  }

  function compareDateStr(a, b) {
    const aT = new Date(`${a}T00:00:00`).getTime();
    const bT = new Date(`${b}T00:00:00`).getTime();
    if (Number.isNaN(aT) || Number.isNaN(bT)) return 0;
    if (aT === bT) return 0;
    return aT < bT ? -1 : 1;
  }

  function getDayEntry(dateStr) {
    if (!calendarData.days[dateStr]) {
      calendarData.days[dateStr] = { tasks: [], focusCount: 0, planned: false };
    }
    return calendarData.days[dateStr];
  }

  function isTodaySelected() {
    return selectedDate === effectiveTodayKey();
  }

  function migrateLegacy() {
    const today = effectiveTodayKey();
    const todayEntry = getDayEntry(today);

    if (!todayEntry.tasks.length) {
      try {
        const rawTasks = localStorage.getItem(TASKS_KEY);
        const parsedTasks = rawTasks ? JSON.parse(rawTasks) : null;
        if (Array.isArray(parsedTasks) && parsedTasks.length) {
          todayEntry.tasks = parsedTasks;
          todayEntry.planned = true;
        }
      } catch {}
    }

    if (!todayEntry.focusCount) {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        const obj = raw ? JSON.parse(raw) : null;
        if (obj && obj.date === today && typeof obj.count === 'number') {
          todayEntry.focusCount = Math.max(0, Math.min(MAX_DAILY_SESSIONS, obj.count));
        }
      } catch {}
    }
    persistCalendar();
    try {
      localStorage.removeItem(TASKS_KEY);
      localStorage.removeItem(STORE_KEY);
    } catch {}
  }

  function ensureTodayPlanned() {
    const today = effectiveTodayKey();
    const entry = getDayEntry(today);
    if (!entry.planned) {
      entry.planned = true;
      persistCalendar();
    }
  }

  function saveState() {
    const entry = getDayEntry(selectedDate);
    entry.focusCount = focusedToday;
    persistCalendar();
  }

  function saveTasks() {
    const entry = getDayEntry(selectedDate);
    const tasks = Array.from(taskList.children).map(li => ({
      text: li.querySelector('.task-text .task-label')?.textContent || "",
      cycles: li.dataset.cycles || "1",
      completed: li.classList.contains('completed'),
      running: li.dataset.running === 'true',
      runningPhase: li.dataset.runningPhase || null,
      runningCycle: li.dataset.runningCycle || null,
      startedAt: li.dataset.startedAt ? Number(li.dataset.startedAt) : null,
      sourceGoalId: li.dataset.sourceGoalId || null,
      sourceTaskId: li.dataset.sourceTaskId || null,
      sourceGoalText: li.dataset.sourceGoalText || null
    }));
    entry.tasks = tasks;
    entry.planned = entry.tasks.length > 0 || isTodaySelected();
    writeTasksForDate(selectedDate, tasks);
    persistCalendar();
    // Keep goals in sync (reservation + completion) for tasks sourced from goals
    syncGoalsFromTasks(selectedDate, tasks);
    updateCalendarCellClasses();
  }

  function resetToday() {
    focusedToday = 0;
    saveState();
    buildGrid();
    updateGrid(0);
    if (focusedDisplay) focusedDisplay.textContent = `Focused: ${focusedToday}`;
  }

  function loadState() {
    const entry = syncEntryFromDb(selectedDate);
    focusedToday = Math.max(0, Math.min(MAX_DAILY_SESSIONS, entry.focusCount || 0));
  }

  // --- calendar UI
  function formatDateLabel(dateStr) {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function updateCalendarCellClasses() {
    if (!yearGrid) return;
    const today = effectiveTodayKey();
    const statusClasses = ['planned', 'past-success', 'past-fail', 'past-gold'];

    yearGrid.querySelectorAll('.day-cell').forEach(cell => {
      if (cell.classList.contains('placeholder')) return;
      const cellDate = cell.dataset.date;
      const entry = calendarData.days[cellDate];
      const planned = !!(entry && (entry.planned || (entry.tasks && entry.tasks.length)));
      const focus = entry?.focusCount || 0;
      const cmp = compareDateStr(cellDate, today);
      let status = '';
      if (cmp < 0) {
        if (focus >= MAX_DAILY_SESSIONS) status = 'past-gold';
        else if (focus >= 1) status = 'past-success';
        else status = 'past-fail';
      } else if (cmp === 0) {
        if (focus >= MAX_DAILY_SESSIONS) status = 'past-gold';
        else if (focus >= 1) status = 'past-success';
        else if (planned) status = 'planned';
      } else if (planned) {
        status = 'planned';
      }

      statusClasses.forEach(cls => cell.classList.remove(cls));
      if (status) cell.classList.add(status);
      cell.classList.toggle('today', cellDate === today);
      cell.classList.toggle('selected', cellDate === selectedDate);
    });
  }

  function buildYearGrid(year = new Date().getFullYear()) {
    if (!yearGrid) return;
    yearGrid.innerHTML = '';
    if (yearTitle) yearTitle.textContent = `${year}`;

    for (let month = 0; month < 12; month++) {
      const block = document.createElement('div');
      block.className = 'month-block';
      block.dataset.month = String(month);
      block.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.classList && target.classList.contains('day-cell')) return;
        expandMonth(month);
      });
      const header = document.createElement('div');
      header.className = 'month-header';
      header.textContent = new Date(year, month, 1).toLocaleString(undefined, { month: 'long' });
      block.appendChild(header);

      const weekdays = document.createElement('div');
      weekdays.className = 'month-weekdays';
      ['M','T','W','T','F','S','S'].forEach(d => {
        const lbl = document.createElement('div');
        lbl.textContent = d;
        weekdays.appendChild(lbl);
      });
      block.appendChild(weekdays);

      const daysEl = document.createElement('div');
      daysEl.className = 'month-days';

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startDay = new Date(year, month, 1).getDay();
      const offset = (startDay + 6) % 7; // Monday-first

      for (let pad = 0; pad < offset; pad++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'day-cell placeholder';
        daysEl.appendChild(placeholder);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'day-cell';
        cell.dataset.date = isoDate;
        cell.textContent = day;
        cell.addEventListener('click', () => {
          selectDay(isoDate);
        });
        const schedulePreviewSelect = () => {
          const existing = calendarData.days ? calendarData.days[isoDate] : null;
          const hasTasks = !!(existing && Array.isArray(existing.tasks) && existing.tasks.length);
          if (dragPreviewDate === isoDate) return;
          clearTimeout(dragPreviewTimer);
          dragPreviewTimer = setTimeout(() => {
            selectDay(isoDate);
            dragPreviewDate = isoDate;
            dragPreviewTimer = null;
          }, hasTasks ? 600 : 600);
        };
        cell.addEventListener('dragenter', (e) => {
          if (!isGoalDrag(e)) return;
          e.preventDefault();
          cell.classList.add('drag-preview');
          schedulePreviewSelect();
        });
        cell.addEventListener('dragleave', () => {
          clearTimeout(dragPreviewTimer);
          dragPreviewTimer = null;
          cell.classList.remove('drag-preview');
          if (dragPreviewDate === isoDate) dragPreviewDate = null;
        });
        cell.addEventListener('dragover', (e) => {
          if (!isGoalDrag(e)) return;
          e.preventDefault();
          schedulePreviewSelect();
        });
        cell.addEventListener('drop', (e) => {
          const payload = parseGoalDrag(e);
          if (!payload || !payload.text) return;
          e.preventDefault();
          clearTimeout(dragPreviewTimer);
          dragPreviewTimer = null;
          dragPreviewDate = null;
          cell.classList.remove('drag-preview');
          const entry = getDayEntry(isoDate);
          entry.planned = true;
          persistCalendar();
          selectDay(isoDate);
          handleGoalDropToSelected(payload, isoDate);
          e.stopPropagation();
        });
        daysEl.appendChild(cell);
      }

      block.appendChild(daysEl);
      yearGrid.appendChild(block);
    }

    updateCalendarCellClasses();
  }

  function ensureMonthDragExpand() {
    if (!yearGrid || yearGrid._dragExpandReady) return;
    yearGrid._dragExpandReady = true;
    yearGrid.addEventListener('dragover', (e) => {
      if (!isGoalDrag(e)) return;
      if (dayPanel && !dayPanel.classList.contains('hidden')) return; // already in day view; do not re-expand
      if (calendarPanel && calendarPanel.classList.contains('hidden')) return; // calendar hidden
      const block = e.target?.closest?.('.month-block');
      if (!block) return;
      const monthIdx = Number(block.dataset.month);
      if (Number.isNaN(monthIdx)) return;
      e.preventDefault();
      clearTimeout(block._expandTimer);
      block._expandTimer = setTimeout(() => expandMonth(monthIdx), 1000);
    }, { passive: false });
    yearGrid.addEventListener('dragleave', (e) => {
      const block = e.target?.closest?.('.month-block');
      if (block && block._expandTimer) {
        clearTimeout(block._expandTimer);
        block._expandTimer = null;
      }
    });
    yearGrid.addEventListener('drop', (e) => {
      const block = e.target?.closest?.('.month-block');
      if (block && block._expandTimer) {
        clearTimeout(block._expandTimer);
        block._expandTimer = null;
      }
    });
  }

  function expandMonth(monthIndex) {
    if (isGoalDragging && dayPanel && !dayPanel.classList.contains('hidden')) return; // stay in day view when dragging
    if (!yearGrid) return;
    expandedMonth = { year: currentYear, month: monthIndex };
    yearGrid.classList.add('expanded');
    yearGrid.querySelectorAll('.month-block').forEach(block => {
      const isTarget = Number(block.dataset.month) === monthIndex;
      block.classList.toggle('expanded', isTarget);
    });
    setTimeout(() => {
      const today = new Date(effectiveTodayKey());
      const targetDay = (today.getFullYear() === currentYear && today.getMonth() === monthIndex) ? today.getDate() : 1;
      const cell = yearGrid.querySelector(`.month-block.expanded .day-cell[data-date="${currentYear}-${String(monthIndex + 1).padStart(2,'0')}-${String(targetDay).padStart(2,'0')}"]`);
      cell?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }, 20);
    if (plannerGrid) plannerGrid.classList.remove('full-day');
    if (calendarPanel) calendarPanel.classList.remove('hidden');
    dayPanel?.classList.add('hidden');
    publishNavActions([
      { id: 'bulk-month', label: 'Bulk Program' },
      { id: 'collapse-month', label: 'Back' }
    ]);
  }

  function collapseMonth() {
    expandedMonth = null;
    yearGrid?.classList.remove('expanded');
    yearGrid?.querySelectorAll('.month-block').forEach(block => block.classList.remove('expanded'));
    clearNavActions();
  }

  function showCalendarView() {
    if (plannerGrid && calendarPanel && dayPanel) {
      plannerGrid.classList.remove('full-day');
      calendarPanel.classList.remove('hidden');
      dayPanel.classList.add('hidden');
    }
    dragPreviewDate = null;
    clearTimeout(dragPreviewTimer);
    dragPreviewTimer = null;
    updateCalendarCellClasses();
    if (expandedMonth) {
      publishNavActions([
        { id: 'bulk-month', label: 'Bulk Program' },
        { id: 'collapse-month', label: 'Back' }
      ]);
    } else {
      publishNavActions([]);
    }
  }

  function selectDay(dateStr) {
    dragPreviewDate = null;
    clearTimeout(dragPreviewTimer);
    dragPreviewTimer = null;
    if (expandedMonth) collapseMonth();
    selectedDate = dateStr;
    saveSelectedDate(dateStr);
    const entry = syncEntryFromDb(selectedDate);
    const today = effectiveTodayKey();
    const cmp = compareDateStr(selectedDate, today);
    const isToday = cmp === 0;
    const isPast = cmp < 0;
    const isFuture = cmp > 0;
    const hasPlan = isToday || entry.planned || (entry.tasks && entry.tasks.length);

    if (selectedDateLabel) selectedDateLabel.textContent = formatDateLabel(selectedDate);
    if (selectedDateHint) {
      if (isPast) selectedDateHint.textContent = 'This day passed and cannot be programmed.';
      else if (isToday) selectedDateHint.textContent = 'Today — actions enabled.';
      else if (hasPlan) selectedDateHint.textContent = 'Viewing a programmed day; actions limited until that date.';
      else selectedDateHint.textContent = 'Click "Program this day" to add tasks.';
    }
    if (dayEmptyState && !hasPlan) {
      if (isPast) dayEmptyState.textContent = `This day (${formatDateLabel(selectedDate)}) has passed and cannot be programmed.`;
      else dayEmptyState.textContent = `No plan for ${formatDateLabel(selectedDate)}. Use "Program this day" to add tasks.`;
    }

    programDayBtn?.classList.toggle('hidden', hasPlan || isPast);
    if (programDayBtn) programDayBtn.disabled = isPast;
    dayEmptyState?.classList.toggle('hidden', hasPlan);
    dayDetailContainer?.classList.toggle('hidden', !hasPlan);

    if (plannerGrid && calendarPanel && dayPanel) {
      plannerGrid.classList.add('full-day');
      calendarPanel.classList.add('hidden');
      dayPanel.classList.remove('hidden');
    }

    cycles = 1;
    cycleBtn.textContent = cycles;

    if (hasPlan) {
      loadState();
      buildGrid();
      updateGrid(0);
      renderTasksForSelectedDay();
    } else {
      focusedToday = Math.max(0, Math.min(MAX_DAILY_SESSIONS, entry.focusCount || 0));
      taskList.innerHTML = '';
      buildGrid();
      updateGrid(0);
    }

    updateCalendarCellClasses();
    enforceActionVisibility();
    const actions = [];
    if (dayPanel) {
      actions.push({ id: 'back-calendar', label: 'Back to calendar' });
    }
    if (!isPast) {
      actions.push({ id: 'bulk-day', label: 'Bulk Program' });
      if (!hasPlan) actions.push({ id: 'program-day', label: 'Program this day' });
      if (hasPlan) {
        actions.push({ id: 'reset-day', label: 'Reset Progress' });
        if (isToday) actions.push({ id: 'call-it-day', label: 'Call it a Day' });
      }
    }
    if (!dayPanel) { // day-only page
      if (!isPast) {
        actions.push({ id: 'reset-day', label: 'Reset Progress' });
        if (isToday && hasPlan) actions.push({ id: 'call-it-day', label: 'Call it a Day' });
      }
    }
    publishNavActions(actions);
  }

  // --- grid
  function buildGrid() {
    if (!sessionGridEl) return;
    sessionGridEl.innerHTML = '';
    for (let i = 0; i < MAX_DAILY_SESSIONS; i++) {
      const sq = document.createElement('div');
      sq.className = 'session-square';
      sessionGridEl.appendChild(sq);
    }
  }

  function updateGrid(increment = 0) {
    if (!sessionGridEl) return;
    if (increment > 0) {
      focusedToday = Math.min(MAX_DAILY_SESSIONS, focusedToday + increment);
      saveState();
      updateCalendarCellClasses();
    }
    const squares = Array.from(sessionGridEl.children);
    squares.forEach((sq, idx) => {
      sq.classList.toggle('filled', idx < focusedToday);
      sq.classList.toggle('full', focusedToday >= MAX_DAILY_SESSIONS);
    });
    if (focusedDisplay) focusedDisplay.textContent = `Focused: ${focusedToday}`;
  }

  // --- utilities
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function playSound(src) {
    try {
      const audio = new Audio(src);
      audio.volume = getVolume();
      audio.play().catch(() => {});
    } catch {}
  }

  function publishNavActions(actions = []) {
    try {
      const unique = [];
      const seen = new Set();
      (actions || []).forEach(action => {
        if (!action?.id) return;
        if (seen.has(action.id)) return;
        seen.add(action.id);
        unique.push(action);
      });
      window.parent?.postMessage({ type: 'nav-actions', actions: unique }, '*');
    } catch {}
  }

  function isGoalDrag(event) {
    try {
      const types = event.dataTransfer?.types;
      if (!types) return false;
      const match = Array.from(types).includes('application/x-voiled-goal-task');
      if (match) isGoalDragging = true;
      return match;
    } catch {
      return false;
    }
  }

  function parseGoalDrag(event) {
    try {
      const raw = event.dataTransfer?.getData('application/x-voiled-goal-task');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.taskId || !parsed.goalId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function updateLocalGoalReservation(payload, dateStr) {
    try {
      const { goalId, taskId, text, goalText } = payload || {};
      const goal = goalsState().find(g => g.id === goalId || g.text === goalText);
      if (!goal) return;
      const task = goal.tasks.find(t => t.id === taskId || t.text === text);
      if (!task) return;
      task.reserved = true;
      task.assignedDate = dateStr;
      renderGoalTasks();
    } catch {}
  }

  function notifyGoalReserved(payload, dateStr) {
    try {
      window.parent?.postMessage({ type: 'goal-reserved', payload: { ...payload, date: dateStr } }, '*');
    } catch {}
  }

  // Lightweight cached goals accessor (populated if goals page loaded)
  function goalsState() {
    try {
      if (window.goals && Array.isArray(window.goals.items)) return window.goals.items;
    } catch {}
    return [];
  }

  function markGoalTaskReserved(payload, dateStr) {
    try {
      const { goalId, taskId, goalText, text } = payload || {};
      const raw = localStorage.getItem(GOALS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.items) return;
      const items = parsed.items.map(g => ({
        ...g,
        id: g.id || `g_${Math.random().toString(36).slice(2)}`,
        tasks: (g.tasks || []).map(t => ({
          id: t.id || `t_${Math.random().toString(36).slice(2)}`,
          text: t.text || '',
          reserved: !!t.reserved,
          completed: !!t.completed,
          assignedDate: t.assignedDate || null
        }))
      }));
      let goal = items.find(g => g.id === goalId);
      if (!goal && goalText) goal = items.find(g => g.text === goalText);
      let task = goal?.tasks.find(t => t.id === taskId);
      if (!task && goal && text) task = goal.tasks.find(t => t.text === text);
      if (!task && !goal && text) {
        goal = items.find(g => (g.tasks || []).some(t => t.text === text));
        task = goal?.tasks.find(t => t.text === text);
      }
      if (task) {
        task.reserved = true;
        task.assignedDate = dateStr;
      }
      if (task && goal) {
        lastGoalReservation = { goalId: goal.id, taskId: task.id, text: task.text };
        const cacheKey = `${goal.id || goalText || 'g'}::${task.id || text || 't'}`;
        reservedCache.add(cacheKey);
      }
      const updated = { ...parsed, items };
      localStorage.setItem(GOALS_KEY, JSON.stringify(updated));
    } catch {}
  }

  function releaseGoalTaskReservation(payload) {
    try {
      const { goalId, taskId, goalText, text } = payload || {};
      if (!goalId && !taskId && !goalText && !text) return;
      const raw = localStorage.getItem(GOALS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.items) return;
      let changed = false;
      const items = parsed.items.map(g => {
        const matchGoal = goalId ? g.id === goalId : goalText ? g.text === goalText : true;
        const tasks = (g.tasks || []).map(t => {
          const matchTask = (taskId && t.id === taskId) || (!taskId && text && t.text === text);
          if (matchGoal && matchTask) {
            if (t.reserved || t.assignedDate || t.completed) changed = true;
            return { ...t, reserved: false, assignedDate: null, completed: false };
          }
          return t;
        });
        return { ...g, tasks };
      });
      if (!changed) return;
      const updated = { ...parsed, items };
      localStorage.setItem(GOALS_KEY, JSON.stringify(updated));
      const cacheKey = `${goalId || goalText || 'g'}::${taskId || text || 't'}`;
      reservedCache.delete(cacheKey);
      try {
        window.parent?.postMessage({ type: 'goal-unreserved', payload: { goalId, taskId, goalText, text } }, '*');
      } catch {}
    } catch {}
  }

  function releaseLocalGoalReservation(payload) {
    try {
      const { goalId, taskId, goalText, text } = payload || {};
      const goal = goalsState().find(g => g.id === goalId || g.text === goalText);
      if (!goal) return;
      const task = goal.tasks.find(t => t.id === taskId || t.text === text);
      if (!task) return;
      task.reserved = false;
      task.completed = false;
      task.assignedDate = null;
      renderGoalTasks();
    } catch {}
  }

  function releaseReservationForTask(task) {
    if (!task) return;
    const payload = {
      goalId: task.sourceGoalId || null,
      taskId: task.sourceTaskId || null,
      goalText: task.sourceGoalText || null,
      text: task.text || ''
    };
    if (!payload.goalId && !payload.taskId && !payload.goalText) return;
    releaseGoalTaskReservation(payload);
    releaseLocalGoalReservation(payload);
  }

  function releaseReservationForElement(li) {
    if (!li) return;
    const payload = {
      goalId: li.dataset.sourceGoalId || null,
      taskId: li.dataset.sourceTaskId || null,
      goalText: li.dataset.sourceGoalText || null,
      text: li.querySelector('.task-text .task-label')?.textContent || ''
    };
    if (!payload.goalId && !payload.taskId && !payload.goalText) return;
    releaseGoalTaskReservation(payload);
    releaseLocalGoalReservation(payload);
  }

  function syncGoalsFromTasks(dateStr, tasks = []) {
    try {
      const raw = localStorage.getItem(GOALS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.items) return;
      let changed = false;
      const items = parsed.items.map(goal => {
        const tasksCopy = (goal.tasks || []).map(t => ({ ...t }));
        tasks.forEach(task => {
          const { sourceGoalId, sourceTaskId, sourceGoalText, text, completed } = task || {};
          if (!sourceGoalId && !sourceGoalText) return;
          if (goal.id !== sourceGoalId && goal.text !== sourceGoalText) return;
          let tgt = tasksCopy.find(t => t.id === sourceTaskId) || tasksCopy.find(t => t.text === text);
          if (!tgt) return;
          const prev = { reserved: tgt.reserved, completed: tgt.completed, assignedDate: tgt.assignedDate };
          tgt.reserved = true;
          tgt.assignedDate = dateStr;
          if (completed) tgt.completed = true;
          if (prev.reserved !== tgt.reserved || prev.completed !== tgt.completed || prev.assignedDate !== tgt.assignedDate) changed = true;
        });
        return { ...goal, tasks: tasksCopy };
      });
      if (!changed) return;
      const updated = { ...parsed, items };
      localStorage.setItem(GOALS_KEY, JSON.stringify(updated));
      pendingLocalCalendarEvents += 1;
      notifyCalendarUpdated();
    } catch {}
  }

  function releaseReservationsForDay(dateStr) {
    try {
      const entry = calendarData?.days?.[dateStr];
      if (!entry || !Array.isArray(entry.tasks)) return;
      entry.tasks.forEach(task => releaseReservationForTask(task));
    } catch {}
  }

  function isGoalTaskReserved(payload) {
    try {
      const { goalId, taskId, goalText, text } = payload || {};
      const cacheKey = `${goalId || goalText || 'g'}::${taskId || text || 't'}`;
      if (reservedCache.has(cacheKey)) return true;
      const raw = localStorage.getItem(GOALS_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const items = parsed?.items || [];
      for (const g of items) {
        if (goalId && g.id !== goalId && g.text !== goalText) continue;
        for (const t of g.tasks || []) {
          if ((taskId && t.id === taskId) || (!taskId && text && t.text === text)) {
            return !!t.reserved || !!t.assignedDate;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  function romanize(num) {
    const lookup = [
      { value: 1000, symbol: 'M' },
      { value: 900, symbol: 'CM' },
      { value: 500, symbol: 'D' },
      { value: 400, symbol: 'CD' },
      { value: 100, symbol: 'C' },
      { value: 90, symbol: 'XC' },
      { value: 50, symbol: 'L' },
      { value: 40, symbol: 'XL' },
      { value: 10, symbol: 'X' },
      { value: 9, symbol: 'IX' },
      { value: 5, symbol: 'V' },
      { value: 4, symbol: 'IV' },
      { value: 1, symbol: 'I' },
    ];
    let n = Math.max(1, Math.floor(num));
    let res = '';
    lookup.forEach(item => {
      while (n >= item.value) {
        res += item.symbol;
        n -= item.value;
      }
    });
    return res || 'I';
  }

  function renumberTasks() {
    if (!taskList) return;
    const items = Array.from(taskList.children);
    items.forEach((li, idx) => {
      li.dataset.order = String(idx + 1);
      const idxEl = li.querySelector('.task-index');
      if (idxEl) idxEl.textContent = `${romanize(idx + 1)}.`;
    });
  }

  let dragSrcEl = null;
  function attachDragHandlers(li) {
    if (!taskList) return;
    li.addEventListener('dragstart', (e) => {
      if (li.classList.contains('completed') || li.dataset.running === 'true') {
        e.preventDefault();
        return;
      }
      dragSrcEl = li;
      li.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      }
    });

    li.addEventListener('dragover', (e) => {
      if (!dragSrcEl || dragSrcEl === li) return;
      e.preventDefault();
      const rect = li.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) taskList.insertBefore(dragSrcEl, li);
      else taskList.insertBefore(dragSrcEl, li.nextSibling);
      li.classList.add('drag-over');
    });

    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => { e.preventDefault(); li.classList.remove('drag-over'); });
    li.addEventListener('dragend', () => {
      dragSrcEl = null;
      li.classList.remove('dragging');
      taskList.querySelectorAll('.task').forEach(t => t.classList.remove('drag-over'));
      renumberTasks();
      saveTasks();
    });
  }

  // --- create task element (shows status label for completed tasks)
  function createTaskElement(text, cyclesCount = String(cycles), completed = false, options = {}) {
    const { allowStart = true, state = null, sourceGoalId = null, sourceTaskId = null, sourceGoalText = null } = options;
    const li = document.createElement('li');
    li.className = 'task';
    li.dataset.cycles = String(cyclesCount);
    li.dataset.running = 'false';
    if (sourceGoalId) li.dataset.sourceGoalId = sourceGoalId;
    if (sourceTaskId) li.dataset.sourceTaskId = sourceTaskId;
    if (sourceGoalText) li.dataset.sourceGoalText = sourceGoalText;
    if (state) {
      if (state.running) li.dataset.running = 'true';
      if (state.runningPhase) li.dataset.runningPhase = state.runningPhase;
      if (state.runningCycle != null) li.dataset.runningCycle = String(state.runningCycle);
      if (state.startedAt) li.dataset.startedAt = String(state.startedAt);
    }

    li.innerHTML = `
      <div class="task-text"><span class="task-index"></span><span class="task-label">${escapeHtml(String(text))}</span></div>
      <button class="removeBtn">X</button>
      <button class="playBtn">▶</button>
      <div class="progress-container"></div>
      <div class="status-sign"></div> <!-- start empty -->
    `;


    const removeBtn = li.querySelector('.removeBtn');
    const playBtn = li.querySelector('.playBtn');
    const statusSign = li.querySelector('.status-sign');

    if (completed) {
      li.classList.add('completed');
      li.querySelector('.task-text')?.classList.add('task-text-end');
      statusSign.textContent = 'Completed';
      statusSign.classList.add('status-sign-end');
      statusSign.style.display = 'inline-block'; // ensure visible after reload
      playBtn?.classList.add('hidden');
      removeBtn?.classList.add('hidden');
      li.draggable = false;
    } else {
      li.draggable = true;
      removeBtn?.addEventListener('click', () => {
        if (li.dataset.running === 'true') return;
        releaseReservationForElement(li);
        li.remove();
        renumberTasks();
        saveTasks();
      });

      if (allowStart) {
        playBtn?.addEventListener('click', () => {
          if (li.dataset.running === 'true') return;
          startTask(playBtn, li, statusSign);
        });
      } else if (playBtn) {
        playBtn.classList.add('hidden');
        playBtn.disabled = true;
      }
    }

    attachDragHandlers(li);
    return li;
  }

  // --- tasks rendering
  function renderTasksForSelectedDay() {
    if (!taskList) return;
    const entry = syncEntryFromDb(selectedDate);
    const allowStart = isTodaySelected() && !calendarPanel; // disable starting when viewed inside calendar
    taskList.innerHTML = '';

    (entry.tasks || []).forEach(t => {
      if (!t?.text) return;
      const state = t.running ? {
        running: true,
        runningPhase: t.runningPhase,
        runningCycle: t.runningCycle,
        startedAt: t.startedAt
      } : null;
      const li = createTaskElement(
        t.text,
        t.cycles,
        !!t.completed,
        {
          allowStart,
          state,
          sourceGoalId: t.sourceGoalId || null,
          sourceTaskId: t.sourceTaskId || null,
          sourceGoalText: t.sourceGoalText || null
        }
      );
      taskList.appendChild(li);
    });

    renumberTasks();
    enforceActionVisibility();
    resumeRunningTasks();
  }

  function enforceActionVisibility() {
    const today = effectiveTodayKey();
    const cmp = compareDateStr(selectedDate, today);
    const allowStart = (cmp === 0) && !calendarPanel; // block starting when inside calendar view
    const allowEdit = cmp >= 0; // future or today
    taskList?.querySelectorAll('li.task').forEach(li => {
      const isCompleted = li.classList.contains('completed');
      const playBtn = li.querySelector('.playBtn');
      const removeBtn = li.querySelector('.removeBtn');

      if (isCompleted) {
        playBtn?.classList.add('hidden');
        removeBtn?.classList.add('hidden');
        if (playBtn) playBtn.disabled = true;
        if (removeBtn) removeBtn.disabled = true;
        li.draggable = false;
      } else {
        if (playBtn) {
          playBtn.classList.toggle('hidden', !allowStart);
          playBtn.disabled = !allowStart;
        }
        if (removeBtn) {
          removeBtn.classList.toggle('hidden', !allowEdit);
          removeBtn.disabled = !allowEdit;
        }
        li.draggable = allowEdit && li.dataset.running !== 'true';
      }
    });
    if (addTaskBtn) addTaskBtn.disabled = !allowEdit;
    if (taskInput) taskInput.disabled = !allowEdit;
    if (cycleBtn) cycleBtn.disabled = !allowEdit;
  }

  function resumeRunningTasks() {
    if (!isTodaySelected()) return;
    if (calendarPanel) return; // do not auto-start from calendar view
    const items = Array.from(taskList?.children || []);
    items.forEach(li => {
      if (li.dataset.running === 'true' && !li.classList.contains('completed')) {
        const state = {
          cycleIndex: li.dataset.runningCycle ? Number(li.dataset.runningCycle) : 0,
          phase: li.dataset.runningPhase || 'focus',
          startedAt: li.dataset.startedAt ? Number(li.dataset.startedAt) : null
        };
        const playBtn = li.querySelector('.playBtn');
        const statusSign = li.querySelector('.status-sign');
        startTask(playBtn, li, statusSign, state);
      }
    });
  }

  function handleGoalDropToSelected(payload, targetDate = selectedDate) {
    if (!payload || !payload.text) return;
    if (isGoalTaskReserved(payload)) return; // already assigned elsewhere
    selectedDate = targetDate;
    saveSelectedDate(targetDate);
    const entry = syncEntryFromDb(targetDate);
    entry.planned = true;
    const already = (entry.tasks || []).some(t => {
      if (payload.taskId && t.sourceTaskId === payload.taskId) return true;
      if (!t.sourceTaskId && t.text === payload.text) return true;
      return false;
    });
    if (already) return;
    entry.tasks.push({
      text: payload.text || '',
      cycles: "1",
      completed: false,
      sourceGoalId: payload.goalId || null,
      sourceTaskId: payload.taskId || null,
      sourceGoalText: payload.goalText || null
    });
    writeTasksForDate(targetDate, entry.tasks);
    persistCalendar();
    const isDayVisible = (dayPanel && !dayPanel.classList.contains('hidden')) || (!calendarPanel && !dayPanel);
    if (isDayVisible) {
      selectDay(targetDate);
    } else {
      renderTasksForSelectedDay();
    }
    updateCalendarCellClasses();
    markGoalTaskReserved(payload, targetDate);
    updateLocalGoalReservation(payload, targetDate);
    const cacheKey = `${payload.goalId || payload.goalText || 'g'}::${payload.taskId || payload.text || 't'}`;
    reservedCache.add(cacheKey);
    notifyGoalReserved(payload, targetDate);
  }

  // --- nav sync
  function handleNavCommand(action) {
    switch (action) {
      case 'reset-day':
        resetSelectedDay();
        break;
      case 'call-it-day':
        callItDay();
        break;
      case 'program-day':
        programDayBtn?.click();
        break;
      case 'back-calendar':
        showCalendarView();
        break;
      case 'bulk-month':
        promptBulkMonth();
        break;
      case 'bulk-day':
        promptBulkDay();
        break;
      case 'collapse-month':
        collapseMonth();
        break;
      default:
        break;
    }
  }

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'nav-command') {
      handleNavCommand(event.data.action);
    }
  });

  function handleExternalSync(e) {
    const isStorage = e?.type === 'storage';
    const isCalendarEvent = e?.type === 'calendar-updated';
    if (isCalendarEvent && pendingLocalCalendarEvents > 0) {
      pendingLocalCalendarEvents = Math.max(0, pendingLocalCalendarEvents - 1);
      return; // ignore self-triggered calendar events to avoid re-render loops
    }
    if (!isStorage && !isCalendarEvent) return;
    if (isStorage) {
      if (e.key === SETTINGS_KEY) {
        refreshDurations();
        return;
      }
      if (e.key === SELECTED_DATE_KEY) {
        const incoming = loadSelectedDate();
        if (incoming && incoming !== selectedDate) {
          selectedDate = incoming;
          selectDay(selectedDate);
        }
        return;
      }
      if (e.key !== CALENDAR_KEY && e.key !== TASKS_DB_KEY) return;
    }
    reloadCalendarData();
    syncCalendarFromTasksDb();
    const entry = syncEntryFromDb(selectedDate);
    focusedToday = Math.max(0, Math.min(MAX_DAILY_SESSIONS, entry.focusCount || 0));
    buildGrid();
    updateGrid(0);
    renderTasksForSelectedDay();
    updateCalendarCellClasses();
  }

  window.addEventListener('storage', handleExternalSync);
  window.addEventListener('calendar-updated', handleExternalSync);
  ['dragend','drop'].forEach(evt => {
    window.addEventListener(evt, () => { isGoalDragging = false; });
  });

  [dayDetailContainer, taskList, dayPanel].forEach(el => {
    if (!el) return;
    el.addEventListener('dragover', (e) => {
      if (!isGoalDrag(e)) return;
      e.preventDefault();
    });
    el.addEventListener('drop', (e) => {
      const payload = parseGoalDrag(e);
      if (!payload) return;
      e.preventDefault();
      handleGoalDropToSelected(payload, selectedDate);
      e.stopPropagation();
    });
  });

  function promptBulkDay() {
    if (compareDateStr(selectedDate, effectiveTodayKey()) < 0) {
      alert('Cannot bulk program a past day.');
      return;
    }
    const raw = prompt('Enter tasks JSON (array of strings or objects with "text") for this day:');
    if (!raw) return;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { alert('Invalid JSON'); return; }
    let tasks = [];
    if (Array.isArray(parsed)) {
      tasks = parsed.map(t => typeof t === 'string' ? t : (t?.text || '')).filter(Boolean);
    } else if (parsed && Array.isArray(parsed.tasks)) {
      tasks = parsed.tasks.map(t => typeof t === 'string' ? t : (t?.text || '')).filter(Boolean);
    } else {
      alert('Provide an array or { tasks: [] }');
      return;
    }
    const entry = syncEntryFromDb(selectedDate);
    const newTasks = tasks.map(txt => ({ text: txt, cycles: "1", completed: false }));
    const combined = [...entry.tasks, ...newTasks];
    writeTasksForDate(selectedDate, combined);
    entry.planned = true;
    persistCalendar();
    selectDay(selectedDate);
  }

  function promptBulkMonth() {
    if (!expandedMonth) {
      alert('Expand a month first.');
      return;
    }
    if (!confirm('Bulk program this month? This appends tasks for each provided day.')) return;
    const raw = prompt('Enter JSON: { "YYYY-MM-DD": ["Task A", "Task B"], ... }');
    if (!raw) return;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { alert('Invalid JSON'); return; }
    const today = effectiveTodayKey();
    Object.entries(parsed || {}).forEach(([date, list]) => {
      if (!Array.isArray(list)) return;
      const cmp = compareDateStr(date, today);
      if (cmp < 0) return; // skip past
      const d = new Date(`${date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== expandedMonth.year || d.getMonth() !== expandedMonth.month) return;
      const entry = syncEntryFromDb(date);
      const additions = [];
      list.forEach(item => {
        const text = typeof item === 'string' ? item : (item?.text || '');
        if (text) additions.push({ text, cycles: "1", completed: false });
      });
      if (additions.length) {
        const combined = [...entry.tasks, ...additions];
        writeTasksForDate(date, combined);
        entry.planned = true;
      }
    });
    persistCalendar();
    updateCalendarCellClasses();
    alert('Bulk month programming complete.');
  }

  // --- init
  migrateLegacy();
  ensureTasksDbSeeded();
  ensureTodayPlanned();
  buildYearGrid(currentYear);
  ensureMonthDragExpand();
  if (!calendarPanel) {
    selectDay(selectedDate);
  } else {
    // show only calendar until a date is clicked
    if (plannerGrid) {
      plannerGrid.classList.remove('full-day');
    }
    calendarPanel.classList.remove('hidden');
    dayPanel?.classList.add('hidden');
    updateCalendarCellClasses();
    clearNavActions();
  }

  programDayBtn?.addEventListener('click', () => {
    if (compareDateStr(selectedDate, effectiveTodayKey()) < 0) return;
    const entry = getDayEntry(selectedDate);
    entry.planned = true;
    persistCalendar();
    selectDay(selectedDate);
  });

  prevYearBtn?.addEventListener('click', () => {
    currentYear -= 1;
    buildYearGrid(currentYear);
    updateCalendarCellClasses();
  });

  nextYearBtn?.addEventListener('click', () => {
    currentYear += 1;
    buildYearGrid(currentYear);
    updateCalendarCellClasses();
  });

  backToCalendarBtn?.addEventListener('click', () => {
    showCalendarView();
  });
  if (backToCalendarBtn) {
    let backHoverTimer = null;
    const scheduleBack = () => {
      clearTimeout(backHoverTimer);
      backHoverTimer = setTimeout(() => showCalendarView(), 700);
    };
    ['dragenter','dragover'].forEach(evt => {
      backToCalendarBtn.addEventListener(evt, (e) => {
        if (!isGoalDrag(e)) return;
        e.preventDefault();
        scheduleBack();
      });
    });
    ['dragleave','drop'].forEach(evt => {
      backToCalendarBtn.addEventListener(evt, () => { clearTimeout(backHoverTimer); backHoverTimer = null; });
    });
  }

  // --- cycle button ---
  cycleBtn.textContent = cycles;
  cycleBtn.addEventListener('click', () => {
    cycles = Math.min(99, cycles + 1);
    cycleBtn.textContent = cycles;
  });

  // --- add task (accepts plain text or JSON array) ---
  addTaskBtn.addEventListener('click', () => {
    if (addTaskBtn.disabled) return;
    const raw = taskInput.value.trim();
    if (!raw) return;

    const allowStart = isTodaySelected();
    let createdAny = false;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (item == null) return;
          const text = typeof item === 'string' ? item : (item?.text || '');
          const cyc = item?.cycles ? String(item.cycles) : String(cycles);
          if (!text) return;
          const li = createTaskElement(String(text), cyc, false, { allowStart });
          taskList.appendChild(li);
          createdAny = true;
        });
      }
    } catch {}

    if (!createdAny) {
      const li = createTaskElement(raw, String(cycles), false, { allowStart });
      taskList.appendChild(li);
    }

    taskInput.value = '';
    cycles = 1;
    cycleBtn.textContent = cycles;
    renumberTasks();
    saveTasks();
  });

  // --- animate bar
  function animateBarToFull(barEl, durationMs, startPct = 0) {
    return new Promise((resolve) => {
      const clampedStart = Math.max(0, Math.min(0.99, startPct));
      barEl.style.width = `${clampedStart * 100}%`;
      const prevTransition = barEl.style.transition;
      barEl.style.transition = 'none';
      const start = performance.now() - (durationMs * clampedStart);
      function step(now) {
        const elapsed = now - start;
        const pct = Math.min(1, elapsed / durationMs);
        barEl.style.width = `${pct * 100}%`;
        if (pct < 1) requestAnimationFrame(step);
        else {
          barEl.style.width = '100%';
          barEl.style.transition = prevTransition || '';
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  // --- start task
  async function startTask(playBtn, taskContainer, statusSign, resumeState = null) {
    refreshDurations();
    if (!isTodaySelected()) return;
    const cycleCount = parseInt(taskContainer.dataset.cycles, 10) || 1;
    const progressContainer = taskContainer.querySelector('.progress-container');
    const removeBtn = taskContainer.querySelector('.removeBtn');

    taskContainer.dataset.running = 'true';
    taskContainer.draggable = false;
    if (playBtn) { playBtn.disabled = true; playBtn.classList.add('hidden'); }
    if (removeBtn) removeBtn.classList.add('hidden');

    try {
      progressContainer.querySelectorAll('.progress-bar').forEach(b => b.remove());

      let startCycle = resumeState?.cycleIndex ? Math.max(0, Math.min(cycleCount - 1, parseInt(resumeState.cycleIndex, 10))) : 0;
      let startPhase = resumeState?.phase || 'focus';
      let initialStartedAt = resumeState?.startedAt ? Number(resumeState.startedAt) : null;
      let initialPct = 0;
      if (initialStartedAt) {
        const duration = startPhase === 'break' ? BLUE_MS : GREEN_MS;
        const elapsed = Math.max(0, Date.now() - initialStartedAt);
        initialPct = Math.min(0.99, elapsed / duration);
      }

      for (let i = startCycle; i < cycleCount; i++) {
        statusSign.style.display = 'inline-block';
        statusSign.textContent = `Session ${i + 1}/${cycleCount}`;

        if (!(i === startCycle && startPhase === 'break')) {
          const greenBar = document.createElement('div');
          greenBar.className = 'progress-bar green-bar';
          greenBar.style.width = '0%';
          greenBar.style.zIndex = '0';
          progressContainer.appendChild(greenBar);

          taskContainer.dataset.runningPhase = 'focus';
          taskContainer.dataset.runningCycle = String(i);
          taskContainer.dataset.startedAt = String(Date.now() - Math.round(GREEN_MS * initialPct));
          saveTasks();

          const focusStartPct = (i === startCycle && startPhase === 'focus') ? initialPct : 0;
          await animateBarToFull(greenBar, GREEN_MS, focusStartPct);

          // increment + persist via updateGrid
          updateGrid(1);

          // reflect display (updateGrid already updates focusedDisplay)
          if (focusedDisplay) focusedDisplay.textContent = `Focused: ${focusedToday}`;

          // Confetti & sound
          if (typeof confetti === 'function') {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          }
          playSound('compleation.mp3');

          await new Promise(r => setTimeout(r, 30));

          greenBar.style.transition = 'background-color 60ms linear, width 0s';
          greenBar.style.backgroundColor = '#888';
          greenBar.style.width = '100%';
          await new Promise(r => setTimeout(r, 70));
          greenBar.remove();
        }

        statusSign.textContent = `Break ${i + 1}/${cycleCount}`;
        const blueBar = document.createElement('div');
        blueBar.className = 'progress-bar blue-bar';
        blueBar.style.width = '0%';
        blueBar.style.zIndex = '0';
        progressContainer.appendChild(blueBar);
        taskContainer.dataset.runningPhase = 'break';
        taskContainer.dataset.startedAt = String(Date.now() - Math.round(BLUE_MS * (i === startCycle && startPhase === 'break' ? initialPct : 0)));
        saveTasks();

        const breakStartPct = (i === startCycle && startPhase === 'break') ? initialPct : 0;
        await animateBarToFull(blueBar, BLUE_MS, breakStartPct);
        blueBar.remove();

        initialPct = 0; // only apply resume pct once
      }

      const finalBar = document.createElement('div');
      finalBar.className = 'progress-bar gray-bar';
      finalBar.style.width = '100%';
      finalBar.style.zIndex = '0';
      progressContainer.appendChild(finalBar);

      taskContainer.classList.add('completed');
      taskContainer.querySelector('.task-text')?.classList.add('task-text-end');
      statusSign.textContent = 'Completed';
      statusSign.classList.add('status-sign-end');
      statusSign.style.display = 'inline-block'; // ensure visible
      if (playBtn) {
        playBtn.classList.add('hidden');
        playBtn.disabled = true;
      }
      if (removeBtn) {
        removeBtn.classList.add('hidden');
        removeBtn.disabled = true;
      }

      saveTasks();

    } catch (err) {
      console.error(err);
    } finally {
      taskContainer.dataset.running = 'false';
      if (!taskContainer.classList.contains('completed')) {
        taskContainer.draggable = true;
      }
      delete taskContainer.dataset.runningPhase;
      delete taskContainer.dataset.runningCycle;
      delete taskContainer.dataset.startedAt;
    }
  }

});
