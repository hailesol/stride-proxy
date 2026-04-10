/* ══════════════════════════════════
   STRIDE — Calendar Module
   Multi-month with tabs, past days
   blank, race day highlighted
   ══════════════════════════════════ */

let draggedDay    = null;
let allMonths     = {}; // { 'YYYY-MM': { day: workoutObj } }
let activeMonthKey = null;

/* ── Render a month tab ── */
function renderMonthTabs() {
  const tabsEl = document.getElementById('month-tabs');
  tabsEl.innerHTML = '';
  tabsEl.style.display = Object.keys(allMonths).length ? 'flex' : 'none';

  Object.keys(allMonths).sort().forEach(key => {
    const [year, month] = key.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const btn = document.createElement('button');
    btn.className = `month-tab${key === activeMonthKey ? ' active' : ''}`;
    btn.textContent = label;
    btn.onclick = () => switchMonth(key);
    tabsEl.appendChild(btn);
  });
}

function switchMonth(key) {
  activeMonthKey = key;
  renderMonthTabs();
  renderCalendarForKey(key);
}

/* ── Store workouts for a month ── */
function storeMonthWorkouts(year, month, workouts, raceDate) {
  const key = `${year}-${String(month + 1).padStart(2,'0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  allMonths[key] = {};

  // Fill all days with rest by default
  for (let d = 1; d <= daysInMonth; d++) {
    allMonths[key][d] = { day: d, type: 'rest', title: 'Rest Day', description: 'Full recovery.' };
  }

  // Overlay AI workouts
  workouts.forEach(w => {
    if (w.day >= 1 && w.day <= daysInMonth) {
      allMonths[key][w.day] = w;
    }
  });

  // Mark race day if it falls in this month
  if (raceDate) {
    const rd = new Date(raceDate);
    if (rd.getFullYear() === year && rd.getMonth() === month) {
      const rday = rd.getDate();
      allMonths[key][rday] = {
        day: rday, type: 'race', title: '🏁 Race Day!',
        description: `This is it — your ${window.strideProfile?.distance || 'race'} race day! Trust your training, run your plan, enjoy every step.`,
        warm_up: '20 min easy warm-up jog. Gentle dynamic drills. Stay relaxed.',
        main_session: `Race start — run your goal pace from the gun. Remember your HR zones and pacing strategy.`,
        cool_down: '10–15 min easy walk after finishing. Celebrate! 🎉',
        notes: 'You have done the work. Trust it. Enjoy it.'
      };
    }
  }

  activeMonthKey = key;
}

/* ── Main calendar render for a month key ── */
function renderCalendarForKey(key) {
  const [year, month] = key.split('-').map(Number);
  const monthObj      = allMonths[key];
  const today         = new Date();
  const todayYear     = today.getFullYear();
  const todayMonth    = today.getMonth() + 1;
  const todayDate     = today.getDate();
  const daysInMonth   = new Date(year, month, 0).getDate();

  // Monday-first offset
  const jsFirst  = new Date(year, month - 1, 1).getDay();
  const firstDay = (jsFirst + 6) % 7;

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
  document.getElementById('calendar-month-title').innerHTML =
    `<span>${monthName}</span> ${year}`;

  const container = document.getElementById('calendar-container');
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  // Day headers Mon–Sun
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
    const h = document.createElement('div');
    h.className   = 'cal-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  let dayCounter = 1;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');

    if (i < firstDay || dayCounter > daysInMonth) {
      cell.className = 'cal-cell empty';
    } else {
      const d = dayCounter;

      // Is this day in the past?
      const isPast = (year < todayYear) ||
        (year === todayYear && month < todayMonth) ||
        (year === todayYear && month === todayMonth && d < todayDate);

      const isToday = year === todayYear && month === todayMonth && d === todayDate;
      const w       = monthObj[d];
      const isRace  = w && w.type === 'race';

      cell.className = 'cal-cell';
      if (isPast)  cell.classList.add('past');
      if (isToday) cell.classList.add('today');
      if (isRace)  cell.classList.add('race-day');
      cell.dataset.day = d;
      cell.dataset.key = key;

      const dateLabel       = document.createElement('div');
      dateLabel.className   = 'cal-date';
      dateLabel.textContent = d;
      cell.appendChild(dateLabel);

      if (w && !isPast) {
        cell.appendChild(createWorkoutCard(w, d, key));
      }

      if (!isPast) {
        cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', e => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          if (draggedDay !== null && draggedDay !== d) swapWorkouts(draggedDay, d, key);
        });
      }

      dayCounter++;
    }
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

/* ── Create workout card ── */
function createWorkoutCard(workout, day, monthKey) {
  const card          = document.createElement('div');
  card.className      = 'workout-card';
  card.dataset.type   = workout.type;
  card.dataset.day    = day;
  card.draggable      = true;

  const summary = (workout.main_session || workout.description || '').substring(0, 50);

  card.innerHTML = `
    <div class="workout-card-title">${workout.title}</div>
    <div class="workout-card-desc">${summary}${summary.length >= 50 ? '…' : ''}</div>
  `;

  card.addEventListener('dragstart', () => {
    draggedDay = day;
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => { card.classList.remove('dragging'); draggedDay = null; });
  card.addEventListener('click', () => openModal(workout, day));

  return card;
}

/* ── Swap workouts ── */
function swapWorkouts(fromDay, toDay, key) {
  const month = allMonths[key];
  const temp  = { ...month[fromDay] };
  month[fromDay] = { ...month[toDay], day: fromDay };
  month[toDay]   = { ...temp,         day: toDay };
  updateCell(fromDay, key);
  updateCell(toDay,   key);
  showToast(`Day ${fromDay} ↔ Day ${toDay} swapped`, 'info');
}

function updateCell(day, key) {
  const cell = document.querySelector(`.cal-cell[data-day="${day}"][data-key="${key}"]`);
  if (!cell) return;
  const old = cell.querySelector('.workout-card');
  if (old) old.remove();
  const w = allMonths[key]?.[day];
  if (w) cell.appendChild(createWorkoutCard(w, day, key));
}

/* ══ MODAL ══ */
const typeColors = {
  easy: 'var(--easy)', tempo: 'var(--tempo)', interval: 'var(--interval)',
  long: 'var(--long)', race:  'var(--race)',  rest:     'var(--muted)'
};

function openModal(workout, day) {
  const key  = activeMonthKey;
  const [year, month] = key.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  document.getElementById('modal-title').textContent = workout.title;
  document.getElementById('modal-date').textContent  = dateStr;

  const color = typeColors[workout.type] || 'var(--muted)';
  const badge = document.getElementById('modal-type-badge');
  badge.textContent         = workout.type.charAt(0).toUpperCase() + workout.type.slice(1);
  badge.style.color         = color;
  badge.style.border        = `1px solid ${color}`;
  badge.style.background    = 'transparent';

  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  if (workout.type === 'rest') {
    body.appendChild(makeSection('rest', '😴', 'Rest Day', workout.description || 'Full recovery.'));
  } else if (workout.type === 'race') {
    body.appendChild(makeSection('race', '🏁', 'Race Day', workout.description || ''));
    if (workout.warm_up)      body.appendChild(makeSection('warmup',   '🔥', 'Warm Up',      workout.warm_up));
    if (workout.main_session) body.appendChild(makeSection('main',     '⚡', 'The Race',     workout.main_session));
    if (workout.cool_down)    body.appendChild(makeSection('cooldown', '🧊', 'After Race',   workout.cool_down));
    if (workout.notes)        body.appendChild(makeSection('notes',    '📋', 'Coach Notes',  workout.notes));
  } else {
    if (workout.warm_up)      body.appendChild(makeSection('warmup',   '🔥', 'Warm Up',      workout.warm_up));
    if (workout.main_session) body.appendChild(makeSection('main',     '⚡', 'Main Session', workout.main_session));
    if (workout.cool_down)    body.appendChild(makeSection('cooldown', '🧊', 'Cool Down',    workout.cool_down));
    if (workout.notes)        body.appendChild(makeSection('notes',    '📋', 'Coach Notes',  workout.notes));
    if (!workout.warm_up && !workout.main_session && workout.description) {
      body.appendChild(makeSection('main', '⚡', 'Session', workout.description));
    }
  }

  document.getElementById('workout-modal').classList.add('show');
}

function makeSection(type, icon, label, text) {
  const s = document.createElement('div');
  s.className = `workout-section ${type}`;
  s.innerHTML = `
    <div class="workout-section-header">
      <span class="workout-section-icon">${icon}</span>${label}
    </div>
    <div class="workout-section-body">${text}</div>
  `;
  return s;
}

function closeModal() {
  document.getElementById('workout-modal').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('workout-modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});
