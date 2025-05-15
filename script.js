const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const form = document.getElementById('activity-form');
const input = document.getElementById('activity-input');
const categoryInput = document.getElementById('category-input');
const list = document.getElementById('activity-list');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const filterCategory = document.getElementById('filter-category');
const categoryProgressBars = document.getElementById('category-progress-bars');

const CATEGORIES = ["Soft Skills", "Leadership", "Internship", "Other"];
const BADGES = [
  { id: 'first', label: 'First Activity', check: acts => acts.length >= 1 },
  { id: 'five', label: '5 Activities', check: acts => acts.length >= 5 },
  { id: 'all-categories', label: 'All Categories', check: acts => CATEGORIES.every(cat => acts.some(a => a.category === cat)) },
  { id: 'streak3', label: '3-Day Streak', check: acts => hasStreak(acts, 3) },
];

let activities = JSON.parse(localStorage.getItem('activities') || '[]');
let filter = "All";

function saveActivities() {
  localStorage.setItem('activities', JSON.stringify(activities));
}

function updateProgress() {
  const total = activities.length;
  const completed = activities.filter(a => a.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressBar.style.width = percent + '%';
  progressText.textContent = `${percent}% Completed`;
  progressBar.classList.remove('pulse');
  void progressBar.offsetWidth; // force reflow
  progressBar.classList.add('pulse');
}

function hasStreak(acts, days) {
  const completedDates = acts.filter(a => a.completed && a.completedAt)
    .map(a => a.completedAt.split('T')[0]);
  const uniqueDates = [...new Set(completedDates)].sort();
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i-1]);
    const curr = new Date(uniqueDates[i]);
    if ((curr - prev) / (1000*60*60*24) === 1) streak++;
    else streak = 1;
    if (streak >= days) return true;
  }
  return false;
}

function getBadges(activities) {
  return BADGES.filter(b => b.check(activities));
}

function renderBadges(activities) {
  const badgesDiv = document.getElementById('badges-section');
  const badges = getBadges(activities);
  badgesDiv.innerHTML = '';
  if (badges.length === 0) {
    badgesDiv.style.display = 'none';
    return;
  }
  badgesDiv.style.display = 'flex';
  badges.forEach(badge => {
    const div = document.createElement('div');
    div.className = 'badge';
    div.textContent = `🏅 ${badge.label}`;
    badgesDiv.appendChild(div);
    animateBadge(div);
  });
}

function updateAnalytics(activities) {
  const chartCanvas = document.getElementById('analytics-chart');
  const data = CATEGORIES.map(cat => 
    activities.filter(a => a.category === cat && a.completed).length
  );
  const hasData = data.some(count => count > 0);
  if (!hasData) {
    chartCanvas.style.display = 'none';
    return;
  }
  chartCanvas.style.display = 'block';
  const ctx = chartCanvas.getContext('2d');
  if (window.analyticsChart) window.analyticsChart.destroy();
  window.analyticsChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: CATEGORIES,
      datasets: [{
        data,
        backgroundColor: ['#6366f1', '#34d399', '#fbbf24', '#f472b6']
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Completed Activities by Category' }
      }
    }
  });
}

document.getElementById('dark-mode-toggle').onclick = () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
}

document.getElementById('share-profile-btn').onclick = () => {
  const url = `${window.location.origin}${window.location.pathname}?profile=local`;
  navigator.clipboard.writeText(url);
  alert('Profile link copied to clipboard!');
};

function updateCategoryProgress() {
  const categoryProgressBars = document.getElementById('category-progress-bars');
  categoryProgressBars.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const catActivities = activities.filter(a => a.category === cat);
    const completed = catActivities.filter(a => a.completed).length;
    const percent = catActivities.length === 0 ? 0 : Math.round((completed / catActivities.length) * 100);
    const div = document.createElement('div');
    div.className = 'category-progress';
    div.innerHTML = `
      <h4>${cat}</h4>
      <div class="progress-bar-bg">
        <div class="progress-bar" style="width:${percent}%;background: linear-gradient(90deg, #6366f1, #34d399);height:100%"></div>
      </div>
      <span style="font-size:0.9rem;color:#6366f1">${percent}%</span>
    `;
    categoryProgressBars.appendChild(div);
  });
}

function renderActivities() {
  const list = document.getElementById('activity-list');
  list.innerHTML = '';
  let filtered = filter === "All" ? activities : activities.filter(a => a.category === filter);
  filtered.forEach((activity, idx) => {
    const li = document.createElement('li');
    li.className = 'activity-item' + (activity.completed ? ' completed' : '');
    // Overdue
    if (activity.dueDate) {
      const due = new Date(activity.dueDate);
      const now = new Date();
      if (!activity.completed && due < now) {
        li.classList.add('overdue');
      }
    }
    // Staggered animation
    li.style.animationDelay = (idx * 0.07) + 's';
    li.classList.add('staggered');
    li.addEventListener('animationend', () => li.classList.remove('staggered'), { once: true });
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = activity.completed;
    checkbox.addEventListener('change', () => {
      activities[idx].completed = checkbox.checked;
      if (checkbox.checked) activities[idx].completedAt = new Date().toISOString();
      else delete activities[idx].completedAt;
      saveActivities();
      renderActivities();
      updateProgress();
      updateCategoryProgress();
      renderBadges(activities);
      updateAnalytics(activities);
    });
    li.appendChild(checkbox);
    // Activity text or edit field
    if (activity.editing) {
      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.value = activity.text;
      editInput.style.flex = '1';
      editInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          finishEdit(activity, editInput.value);
        }
      });
      li.appendChild(editInput);
      // Save button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'action-btn';
      saveBtn.innerHTML = '💾';
      saveBtn.title = 'Save';
      saveBtn.onclick = () => finishEdit(activity, editInput.value);
      li.appendChild(saveBtn);
    } else {
      const span = document.createElement('span');
      span.textContent = activity.text;
      span.style.marginLeft = '10px';
      li.appendChild(span);
      // Category badge
      const catBadge = document.createElement('span');
      catBadge.className = 'activity-category';
      catBadge.textContent = activity.category;
      li.appendChild(catBadge);
      // Due date
      if (activity.dueDate) {
        const dueSpan = document.createElement('span');
        dueSpan.textContent = `Due: ${activity.dueDate}`;
        dueSpan.style.marginLeft = '10px';
        li.appendChild(dueSpan);
      }
      // Notes
      if (activity.notes) {
        const notesDiv = document.createElement('div');
        notesDiv.textContent = `📝 ${activity.notes}`;
        notesDiv.style.fontSize = '0.95em';
        notesDiv.style.marginLeft = '10px';
        li.appendChild(notesDiv);
      }
      // Completed badge
      const badge = document.createElement('span');
      badge.className = 'activity-badge';
      badge.textContent = 'Completed!';
      li.appendChild(badge);
      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'action-btn';
      editBtn.innerHTML = '✏️';
      editBtn.title = 'Edit';
      editBtn.onclick = () => {
        activities[idx].editing = true;
        renderActivities();
      };
      li.appendChild(editBtn);
      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'action-btn';
      delBtn.innerHTML = '🗑️';
      delBtn.title = 'Delete';
      delBtn.onclick = () => {
        activities.splice(idx, 1);
        saveActivities();
        renderActivities();
        updateProgress();
        updateCategoryProgress();
        renderBadges(activities);
        updateAnalytics(activities);
      };
      li.appendChild(delBtn);
    }
    list.appendChild(li);
  });
}

function finishEdit(activity, newText) {
  const idx = activities.indexOf(activity);
  activities[idx].text = newText;
  delete activities[idx].editing;
  saveActivities();
  renderActivities();
  renderBadges(activities);
  updateAnalytics(activities);
}

document.getElementById('activity-form').addEventListener('submit', e => {
  e.preventDefault();
  const text = document.getElementById('activity-input').value.trim();
  const category = document.getElementById('category-input').value;
  const dueDate = document.getElementById('due-date-input').value;
  const notes = document.getElementById('notes-input').value;
  if (text && category) {
    activities.push({ text, category, completed: false, dueDate, notes });
    document.getElementById('activity-input').value = '';
    document.getElementById('category-input').value = '';
    document.getElementById('due-date-input').value = '';
    document.getElementById('notes-input').value = '';
    saveActivities();
    renderActivities();
    updateProgress();
    updateCategoryProgress();
    renderBadges(activities);
    updateAnalytics(activities);
  }
});

document.getElementById('filter-category').addEventListener('change', e => {
  filter = e.target.value;
  renderActivities();
});

// Initial render
renderActivities();
updateProgress();
updateCategoryProgress();
renderBadges(activities);
updateAnalytics(activities);

// Public profile (read-only, demo)
const params = new URLSearchParams(window.location.search);
if (params.has('profile')) {
  document.querySelector('.container').innerHTML = '<h1>Public Profile (Read Only)</h1>' +
    '<div id="badges-section"></div>' +
    '<canvas id="analytics-chart" width="400" height="200"></canvas>' +
    '<ul id="activity-list"></ul>';
  renderActivities();
  renderBadges(activities);
  updateAnalytics(activities);
}

// Fade-in for main sections on load
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.main-header')?.classList.add('fade-in');
  document.querySelector('.container')?.classList.add('fade-in');
  document.querySelector('.main-footer')?.classList.add('fade-in');
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.classList.add('spin');
    logo.addEventListener('animationend', () => logo.classList.remove('spin'), { once: true });
  }
  [...document.querySelectorAll('button, .action-btn')].forEach(btn => {
    btn.addEventListener('click', addRippleEffect);
  });
});

function addRippleEffect(e) {
  const btn = e.currentTarget;
  const circle = document.createElement('span');
  circle.className = 'button-ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (e.clientX - rect.left - size/2) + 'px';
  circle.style.top = (e.clientY - rect.top - size/2) + 'px';
  btn.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}

function animateBadge(badgeDiv) {
  badgeDiv.classList.add('pop');
  badgeDiv.addEventListener('animationend', () => badgeDiv.classList.remove('pop'), { once: true });
  // Confetti burst
  for (let i = 0; i < 12; i++) {
    const confetti = document.createElement('span');
    confetti.className = 'confetti';
    confetti.style.background = `hsl(${Math.random()*360},90%,60%)`;
    confetti.style.left = (16 + Math.cos((i/12)*2*Math.PI)*24) + 'px';
    confetti.style.top = (8 + Math.sin((i/12)*2*Math.PI)*16) + 'px';
    badgeDiv.appendChild(confetti);
    confetti.addEventListener('animationend', () => confetti.remove(), { once: true });
  }
} 