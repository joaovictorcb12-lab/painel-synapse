// ============================================================
// FIREBASE — autenticação e banco de dados na nuvem
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const loginScreen = document.getElementById('loginScreen');
const appRoot = document.getElementById('app');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const accountEmail = document.getElementById('accountEmail');
const logoutBtn = document.getElementById('logoutBtn');

let cloudData = {};
let currentUid = null;
let db = null;
let saveTimer = null;
let appStarted = false;

// ===== Storage helpers (agora respaldados pelo Firestore) =====
const store = {
  get(key, fallback){
    return (key in cloudData) ? cloudData[key] : fallback;
  },
  set(key, value){
    cloudData[key] = value;
    scheduleSave();
  }
};

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToCloud, 600);
}
async function saveToCloud(){
  if(!db || !currentUid) return;
  try{
    await setDoc(doc(db, 'users', currentUid), cloudData, { merge: true });
  }catch(err){
    console.error('Erro ao salvar na nuvem:', err);
  }
}

function firebaseConfigured(){
  return typeof CONFIG !== 'undefined' && CONFIG.FIREBASE_CONFIG && CONFIG.FIREBASE_CONFIG.apiKey && CONFIG.FIREBASE_CONFIG.apiKey.length > 5;
}

// Migração única: se a pessoa já tinha dados salvos neste navegador
// (versão antiga, sem nuvem) e a conta na nuvem ainda está vazia,
// importa esses dados locais automaticamente.
function migrateLegacyLocalData(){
  const migrated = {};
  let found = false;
  try{
    for(let i=0; i<localStorage.length; i++){
      const key = localStorage.key(i);
      if(key && key.startsWith('synapse:')){
        const shortKey = key.slice('synapse:'.length);
        try{ migrated[shortKey] = JSON.parse(localStorage.getItem(key)); found = true; }catch(e){}
      }
    }
  }catch(e){}
  return found ? migrated : null;
}

async function startFirebase(){
  if(!firebaseConfigured()){
    loginScreen.querySelector('.login-box').innerHTML = `
      <h2 style="font-family:var(--font-display); font-size:19px; margin-bottom:10px;">Configuração pendente</h2>
      <p class="login-sub">O banco de dados na nuvem ainda não foi configurado. Siga o passo a passo do <strong>README.md</strong> (criar projeto no Firebase → ativar Authentication e Firestore) e cole as chaves em <code>config.js</code>.</p>
    `;
    return;
  }

  const app = initializeApp(CONFIG.FIREBASE_CONFIG);
  const auth = getAuth(app);
  db = getFirestore(app);

  async function handleGoogleCredential(idToken){
    loginStatus.textContent = 'Entrando...';
    try{
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    }catch(err){
      loginStatus.textContent = 'Não foi possível entrar. Tente novamente.';
    }
  }

  function setupGoogleButton(){
    if(typeof google === 'undefined' || !google.accounts || !google.accounts.id){
      setTimeout(setupGoogleButton, 300);
      return;
    }
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: (response) => handleGoogleCredential(response.credential)
    });
    google.accounts.id.renderButton(document.getElementById('googleBtnContainer'), {
      theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', width: 260
    });
  }
  if(CONFIG.GOOGLE_CLIENT_ID){
    setupGoogleButton();
  } else {
    // Sem Client ID configurado ainda (Calendar) — usa o popup do Firebase como alternativa
    loginBtn.style.display = 'inline-flex';
  }

  loginBtn.addEventListener('click', () => {
    loginStatus.textContent = 'Entrando...';
    signInWithPopup(auth, new GoogleAuthProvider()).catch((err) => {
      if(err && err.code === 'auth/popup-closed-by-user') return;
      loginStatus.textContent = 'Não foi possível entrar. Tente novamente.';
    });
  });
  logoutBtn.addEventListener('click', () => {
    signOut(auth);
  });

  onAuthStateChanged(auth, async (user) => {
    if(user){
      currentUid = user.uid;
      loginStatus.textContent = '';
      accountEmail.textContent = user.email || user.displayName || '';

      const snap = await getDoc(doc(db, 'users', currentUid));
      if(snap.exists()){
        cloudData = snap.data();
      } else {
        const legacy = migrateLegacyLocalData();
        cloudData = legacy || {};
        if(legacy) await saveToCloud();
      }

      loginScreen.style.display = 'none';
      appRoot.style.display = 'grid';

      if(!appStarted){
        appStarted = true;
        initApp();
      }
    } else {
      currentUid = null;
      cloudData = {};
      loginScreen.style.display = 'flex';
      appRoot.style.display = 'none';
    }
  });
}
startFirebase();

// ===== Service worker (PWA) — roda independente do login =====
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

const todayKey = (d = new Date()) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0,10);
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function initApp(){
// ===== Theme =====
const themeToggle = document.getElementById('themeToggle');
const iconSun = document.getElementById('iconSun');
const iconMoon = document.getElementById('iconMoon');
const themeLabel = document.getElementById('themeLabel');

function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  document.body.setAttribute('data-theme', t);
  iconSun.style.display = t === 'dark' ? 'none' : 'block';
  iconMoon.style.display = t === 'dark' ? 'block' : 'none';
  themeLabel.textContent = t === 'dark' ? 'Modo claro' : 'Modo escuro';
  store.set('theme', t);
  if(document.getElementById('tab-progresso').classList.contains('active')) renderCharts();
  if(document.getElementById('tab-estudos').classList.contains('active') && typeof renderSimulados === 'function') renderSimulados();
  if(document.getElementById('tab-treino').classList.contains('active') && typeof renderWorkoutChart === 'function') renderWorkoutChart();
}
applyTheme(store.get('theme', 'light'));
themeToggle.addEventListener('click', () => {
  const cur = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(cur);
});

// ===== Navigation =====
const navLinks = document.querySelectorAll('.nav-link');
const tabs = document.querySelectorAll('.tab');
const mobileTitle = document.getElementById('mobileTitle');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

const TAB_LABELS = {
  dashboard:'Painel', agenda:'Agenda', tarefas:'Tarefas', habitos:'Hábitos',
  foco:'Foco', estudos:'ENAMED', treino:'Treino', notas:'Notas', diario:'Diário', flashcards:'Revisão', metas:'Metas', progresso:'Progresso'
};

function showTab(name, focusId){
  tabs.forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  navLinks.forEach(l => l.classList.toggle('active', l.dataset.tab === name));
  mobileTitle.textContent = TAB_LABELS[name] || name;
  closeSidebar();
  store.set('lastTab', name);
  if(name === 'progresso') renderCharts();
  if(name === 'dashboard') renderDashboard();
  if(name === 'estudos' && typeof renderSimulados === 'function') renderSimulados();
  if(name === 'treino' && typeof renderWorkoutChart === 'function') renderWorkoutChart();
  if(focusId){
    setTimeout(() => { const el = document.getElementById(focusId); if(el) el.focus(); }, 120);
  }
}
navLinks.forEach(link => link.addEventListener('click', () => showTab(link.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.goto, btn.dataset.focus));
});

function openSidebar(){ sidebar.classList.add('open'); sidebarBackdrop.classList.add('open'); }
function closeSidebar(){ sidebar.classList.remove('open'); sidebarBackdrop.classList.remove('open'); }
document.getElementById('mobileMenuBtn').addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
sidebarBackdrop.addEventListener('click', closeSidebar);

showTab(store.get('lastTab', 'dashboard'));

// ===== Quotes =====
const QUOTES = [
  "A disciplina é a ponte entre metas e realizações.",
  "Pequenos progressos diários somam grandes resultados.",
  "Não é sobre ter tempo, é sobre fazer tempo.",
  "O cérebro que você treina hoje é o profissional que você será amanhã.",
  "Feito é melhor que perfeito.",
  "Consistência bate intensidade no longo prazo.",
  "Cuide do processo — o resultado é consequência.",
  "Um passo de cada vez ainda é um passo à frente."
];
const todaysQuote = '"' + QUOTES[new Date().getDate() % QUOTES.length] + '"';
document.getElementById('quoteStripDash').textContent = todaysQuote;

document.getElementById('dashboardDate').textContent =
  new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});

// ============================================================
// GOOGLE CALENDAR INTEGRATION
// ============================================================
let gTokenClient = null;
let gAccessToken = null;
let gUpcomingEvents = [];

const googleConnectBtn = document.getElementById('googleConnectBtn');
const googleStatusHint = document.getElementById('googleStatusHint');
const googleStatusTitle = document.getElementById('googleStatusTitle');
const setupSteps = document.getElementById('setupSteps');
const agendaColumns = document.getElementById('agendaColumns');
const eventsList = document.getElementById('eventsList');
const eventForm = document.getElementById('eventForm');
const eventFeedback = document.getElementById('eventFeedback');

function googleConfigured(){
  return typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_CLIENT_ID && CONFIG.GOOGLE_CLIENT_ID.trim().length > 10;
}

function initGoogle(){
  if(!googleConfigured()){
    googleStatusHint.textContent = 'Integração ainda não configurada.';
    setupSteps.style.display = 'block';
    googleConnectBtn.style.display = 'none';
    return;
  }
  if(typeof google === 'undefined' || !google.accounts){
    // GIS script not loaded yet — retry shortly
    setTimeout(initGoogle, 300);
    return;
  }
  gTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    callback: (resp) => {
      if(resp && resp.access_token){
        gAccessToken = resp.access_token;
        onGoogleConnected();
      }
    }
  });
  googleConnectBtn.addEventListener('click', () => {
    gTokenClient.requestAccessToken({ prompt: gAccessToken ? '' : 'consent' });
  });
}

function onGoogleConnected(){
  googleStatusTitle.textContent = 'Google Agenda conectado';
  googleStatusHint.textContent = 'Conta conectada. Os eventos abaixo são lidos direto da sua Google Agenda.';
  googleConnectBtn.textContent = 'Reconectar';
  agendaColumns.style.display = 'grid';
  fetchUpcomingEvents();
}

async function fetchUpcomingEvents(){
  if(!gAccessToken) return;
  eventsList.innerHTML = '<p class="dash-empty">Carregando eventos...</p>';
  try{
    const timeMin = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=10&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + gAccessToken } });
    if(res.status === 401){ gAccessToken = null; googleConnectBtn.textContent = 'Conectar Google Agenda'; agendaColumns.style.display='none'; return; }
    const data = await res.json();
    gUpcomingEvents = data.items || [];
    renderEventsList();
    renderDashboardEvents();
  }catch(e){
    eventsList.innerHTML = '<p class="dash-empty">Não foi possível carregar os eventos agora.</p>';
  }
}

function renderEventsList(){
  if(!gUpcomingEvents.length){
    eventsList.innerHTML = '<p class="dash-empty">Nenhum evento futuro encontrado.</p>';
    return;
  }
  eventsList.innerHTML = gUpcomingEvents.map(ev => {
    const start = ev.start?.dateTime || ev.start?.date;
    const label = formatEventDateLabel(start, !!ev.start?.dateTime);
    return `<div class="dash-row"><span class="dr-dot"></span><span class="dr-text">${escapeHtml(ev.summary || 'Sem título')}</span><span class="dr-meta">${label}</span></div>`;
  }).join('');
}

function formatEventDateLabel(iso, hasTime){
  if(!iso) return '';
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  if(!hasTime) return dateStr;
  const timeStr = d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  return `${dateStr} · ${timeStr}`;
}

document.getElementById('refreshEventsBtn').addEventListener('click', fetchUpcomingEvents);

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!gAccessToken){ showEventFeedback('Conecte sua Google Agenda primeiro.', true); return; }
  const title = document.getElementById('evTitle').value.trim();
  const date = document.getElementById('evDate').value;
  const start = document.getElementById('evStart').value;
  const end = document.getElementById('evEnd').value;
  const desc = document.getElementById('evDesc').value.trim();
  if(!title || !date || !start || !end){ showEventFeedback('Preencha título, data e horários.', true); return; }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = {
    summary: title,
    description: desc,
    start: { dateTime: `${date}T${start}:00`, timeZone: tz },
    end: { dateTime: `${date}T${end}:00`, timeZone: tz }
  };
  try{
    showEventFeedback('Adicionando...', false);
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + gAccessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error('falha');
    showEventFeedback('Evento adicionado à sua Google Agenda ✓', false);
    eventForm.reset();
    fetchUpcomingEvents();
  }catch(err){
    showEventFeedback('Não foi possível criar o evento. Tente reconectar.', true);
  }
});

function showEventFeedback(msg, isError){
  eventFeedback.textContent = msg;
  eventFeedback.className = 'event-feedback' + (isError ? ' error' : '');
}

initGoogle();

// ===== Tasks =====
let tasks = store.get('tasks', []);
let taskFilter = 'todas';
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskPriority = document.getElementById('taskPriority');
const taskDueInput = document.getElementById('taskDueInput');
const taskList = document.getElementById('taskList');
const taskEmptyNote = document.getElementById('taskEmptyNote');

document.getElementById('taskFilterRow').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-chip');
  if(!btn) return;
  taskFilter = btn.dataset.filter;
  document.querySelectorAll('#taskFilterRow .filter-chip').forEach(c => c.classList.toggle('active', c===btn));
  renderTasks();
});

function dueBadge(due){
  if(!due) return '';
  const today = todayKey();
  let cls = '';
  let label = new Date(due+'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  if(due < today){ cls = 'overdue'; label = 'Atrasada · ' + label; }
  else if(due === today){ cls = 'today'; label = 'Hoje'; }
  return `<span class="due-badge ${cls}">${label}</span>`;
}

function renderTasks(){
  let list = tasks;
  if(taskFilter === 'pendentes') list = tasks.filter(t=>!t.done);
  if(taskFilter === 'concluidas') list = tasks.filter(t=>t.done);

  taskList.innerHTML = '';
  taskEmptyNote.style.display = list.length ? 'none' : 'block';
  taskEmptyNote.textContent = tasks.length ? 'Nada por aqui com esse filtro.' : 'Sem tarefas pendentes. Bom sinal.';

  const order = {alta:0, media:1, baixa:2};
  [...list].sort((a,b)=> (a.done - b.done) || (order[a.priority]-order[b.priority]) || (a.due||'9999').localeCompare(b.due||'9999')).forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    li.innerHTML = `
      <button class="task-check" aria-label="Concluir">${task.done ? '✓' : ''}</button>
      <span class="task-text">${escapeHtml(task.text)}</span>
      ${dueBadge(task.due)}
      <span class="task-priority priority-${task.priority}">${task.priority}</span>
      <button class="task-del" aria-label="Remover">✕</button>
    `;
    li.querySelector('.task-check').addEventListener('click', () => {
      task.done = !task.done;
      if(task.done){ task.doneDate = todayKey(); logCompletion('taskLog'); }
      store.set('tasks', tasks); renderTasks(); renderDashboard();
    });
    li.querySelector('.task-del').addEventListener('click', () => {
      tasks = tasks.filter(t => t.id !== task.id);
      store.set('tasks', tasks); renderTasks(); renderDashboard();
    });
    taskList.appendChild(li);
  });
}
taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if(!text) return;
  tasks.push({id:uid(), text, priority:taskPriority.value, due: taskDueInput.value || null, done:false});
  store.set('tasks', tasks);
  taskInput.value = ''; taskDueInput.value = '';
  renderTasks(); renderDashboard();
});
renderTasks();

function logCompletion(logKey){
  const log = store.get(logKey, {});
  const k = todayKey();
  log[k] = (log[k] || 0) + 1;
  store.set(logKey, log);
}

// ===== Habits =====
let habits = store.get('habits', []);
const habitForm = document.getElementById('habitForm');
const habitInput = document.getElementById('habitInput');
const habitGrid = document.getElementById('habitGrid');
const habitEmptyNote = document.getElementById('habitEmptyNote');

function computeStreak(habit){
  let streak = 0;
  let d = new Date();
  while(true){
    const k = todayKey(d);
    if(habit.log[k]){ streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}
function last7DateKeys(){
  const arr = [];
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); arr.push(todayKey(d)); }
  return arr;
}
function habitHeatmap(habit){
  return last7DateKeys().map(k => `<span class="heat-dot ${habit.log[k]?'on':''}" title="${k}"></span>`).join('');
}

function renderHabits(){
  habitGrid.innerHTML = '';
  habitEmptyNote.style.display = habits.length ? 'none' : 'block';
  const tKey = todayKey();
  habits.forEach(habit => {
    const doneToday = !!habit.log[tKey];
    const row = document.createElement('div');
    row.className = 'habit-row';
    row.innerHTML = `
      <button class="habit-dot ${doneToday ? 'on' : ''}" aria-label="Marcar hoje">${doneToday ? '✓' : ''}</button>
      <div class="habit-main">
        <div class="habit-name">${escapeHtml(habit.name)}</div>
        <div class="habit-heatmap">${habitHeatmap(habit)}</div>
      </div>
      <span class="habit-streak">🔥 ${computeStreak(habit)}d</span>
      <button class="habit-del" aria-label="Remover">✕</button>
    `;
    row.querySelector('.habit-dot').addEventListener('click', () => {
      if(habit.log[tKey]) delete habit.log[tKey];
      else { habit.log[tKey] = true; logCompletion('habitLog'); }
      store.set('habits', habits); renderHabits(); renderDashboard();
    });
    row.querySelector('.habit-del').addEventListener('click', () => {
      habits = habits.filter(h => h.id !== habit.id);
      store.set('habits', habits); renderHabits(); renderDashboard();
    });
    habitGrid.appendChild(row);
  });
}
habitForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = habitInput.value.trim();
  if(!name) return;
  habits.push({id:uid(), name, log:{}});
  store.set('habits', habits);
  habitInput.value = '';
  renderHabits(); renderDashboard();
});
renderHabits();

// ===== Pomodoro =====
const focusMinInput = document.getElementById('focusMin');
const breakMinInput = document.getElementById('breakMin');
const pomodoroTime = document.getElementById('pomodoroTime');
const pomodoroMode = document.getElementById('pomodoroMode');
const pomodoroToggle = document.getElementById('pomodoroToggle');
const pomodoroReset = document.getElementById('pomodoroReset');
const pomodoroSkip = document.getElementById('pomodoroSkip');
const pomodoroCountEl = document.getElementById('pomodoroCount');
const ringFg = document.getElementById('ringFg');
const RING_CIRC = 2 * Math.PI * 98;
ringFg.style.strokeDasharray = RING_CIRC;

let pomodoroState = {
  mode: 'focus',
  remaining: 25*60,
  total: 25*60,
  running: false,
  count: store.get('pomodoroCount_' + todayKey(), 0)
};
let pomodoroTimer = null;
pomodoroCountEl.textContent = pomodoroState.count;

function formatTime(s){
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}
function renderPomodoro(){
  pomodoroTime.textContent = formatTime(pomodoroState.remaining);
  pomodoroMode.textContent = pomodoroState.mode === 'focus' ? 'Foco' : 'Pausa';
  const progress = 1 - (pomodoroState.remaining / pomodoroState.total);
  ringFg.style.strokeDashoffset = RING_CIRC * (1 - progress);
  pomodoroToggle.textContent = pomodoroState.running ? 'Pausar' : 'Iniciar';
}
function tickPomodoro(){
  pomodoroState.remaining--;
  if(pomodoroState.remaining <= 0){
    if(pomodoroState.mode === 'focus'){
      pomodoroState.count++;
      store.set('pomodoroCount_' + todayKey(), pomodoroState.count);
      pomodoroCountEl.textContent = pomodoroState.count;
      switchMode('break');
    } else {
      switchMode('focus');
    }
  }
  renderPomodoro();
}
function switchMode(mode){
  pomodoroState.mode = mode;
  const mins = mode === 'focus' ? parseInt(focusMinInput.value||25) : parseInt(breakMinInput.value||5);
  pomodoroState.remaining = mins*60;
  pomodoroState.total = mins*60;
}
pomodoroToggle.addEventListener('click', () => {
  pomodoroState.running = !pomodoroState.running;
  if(pomodoroState.running){ pomodoroTimer = setInterval(tickPomodoro, 1000); }
  else { clearInterval(pomodoroTimer); }
  renderPomodoro();
});
pomodoroReset.addEventListener('click', () => {
  clearInterval(pomodoroTimer);
  pomodoroState.running = false;
  switchMode(pomodoroState.mode);
  renderPomodoro();
});
pomodoroSkip.addEventListener('click', () => {
  clearInterval(pomodoroTimer);
  pomodoroState.running = false;
  switchMode(pomodoroState.mode === 'focus' ? 'break' : 'focus');
  renderPomodoro();
});
switchMode('focus');
renderPomodoro();

// ===== Notes =====
let notes = store.get('notes', []);
const noteForm = document.getElementById('noteForm');
const noteTitleInput = document.getElementById('noteTitleInput');
const noteBodyInput = document.getElementById('noteBodyInput');
const noteGrid = document.getElementById('noteGrid');
const noteEmptyNote = document.getElementById('noteEmptyNote');

function renderNotes(){
  noteGrid.innerHTML = '';
  noteEmptyNote.style.display = notes.length ? 'none' : 'block';
  [...notes].reverse().forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    const dateLabel = note.createdAt ? new Date(note.createdAt).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '';
    card.innerHTML = `
      <button class="note-del" aria-label="Remover">✕</button>
      <h4>${escapeHtml(note.title)}</h4>
      <p>${escapeHtml(note.body)}</p>
      <span class="note-date">${dateLabel}</span>
    `;
    card.querySelector('.note-del').addEventListener('click', () => {
      notes = notes.filter(n => n.id !== note.id);
      store.set('notes', notes); renderNotes();
    });
    noteGrid.appendChild(card);
  });
}
noteForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = noteTitleInput.value.trim();
  const body = noteBodyInput.value.trim();
  if(!title && !body) return;
  notes.push({id:uid(), title: title || 'Sem título', body, createdAt: Date.now()});
  store.set('notes', notes);
  noteTitleInput.value = ''; noteBodyInput.value = '';
  renderNotes();
});
renderNotes();

// ===== Journal =====
let journalEntries = store.get('journal', []);
const journalDate = document.getElementById('journalDate');
const journalInput = document.getElementById('journalInput');
const journalSaveBtn = document.getElementById('journalSaveBtn');
const journalList = document.getElementById('journalList');

journalDate.textContent = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});

function renderJournal(){
  journalList.innerHTML = '';
  [...journalEntries].reverse().forEach(entry => {
    const div = document.createElement('div');
    div.className = 'journal-entry';
    div.innerHTML = `<p class="j-date">${entry.dateLabel}</p><p>${escapeHtml(entry.text)}</p>`;
    journalList.appendChild(div);
  });
}
journalSaveBtn.addEventListener('click', () => {
  const text = journalInput.value.trim();
  if(!text) return;
  journalEntries.push({
    id: uid(), text, date: todayKey(),
    dateLabel: new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'})
  });
  store.set('journal', journalEntries);
  journalInput.value = '';
  renderJournal();
});
renderJournal();

// ===== Flashcards =====
let flashcards = store.get('flashcards', []);
let flashIndex = 0;
let flashFlipped = false;
const flashForm = document.getElementById('flashForm');
const flashFront = document.getElementById('flashFront');
const flashBack = document.getElementById('flashBack');
const flashCard = document.getElementById('flashCard');
const flashControls = document.getElementById('flashControls');
const flashCount = document.getElementById('flashCount');
const flashDeckList = document.getElementById('flashDeckList');

function renderFlash(){
  flashDeckList.innerHTML = '';
  flashcards.forEach(card => {
    const row = document.createElement('div');
    row.className = 'flash-deck-row';
    row.innerHTML = `<strong>${escapeHtml(card.front)}</strong><span>${escapeHtml(card.back)}</span><span class="reviews">${card.reviews||0}x revisado</span><button class="task-del" aria-label="Remover">✕</button>`;
    row.querySelector('button').addEventListener('click', () => {
      flashcards = flashcards.filter(c => c.id !== card.id);
      store.set('flashcards', flashcards);
      flashIndex = 0;
      renderFlash();
    });
    flashDeckList.appendChild(row);
  });

  if(flashcards.length === 0){
    flashCard.innerHTML = '<p class="flash-empty">Adicione um card para começar a revisar.</p>';
    flashControls.style.display = 'none';
    flashCount.textContent = '';
    return;
  }
  if(flashIndex >= flashcards.length) flashIndex = 0;
  flashControls.style.display = 'flex';
  showFlashCard();
}
function showFlashCard(){
  flashFlipped = false;
  const card = flashcards[flashIndex];
  flashCard.innerHTML = `<span class="side-label">Pergunta</span>${escapeHtml(card.front)}`;
  flashCount.textContent = `${flashIndex+1} / ${flashcards.length}`;
}
flashCard.addEventListener('click', () => flipFlash());
document.getElementById('flashFlip').addEventListener('click', () => flipFlash());
function flipFlash(){
  if(!flashcards.length) return;
  flashFlipped = !flashFlipped;
  const card = flashcards[flashIndex];
  if(flashFlipped){
    card.reviews = (card.reviews||0) + 1;
    store.set('flashcards', flashcards);
  }
  flashCard.innerHTML = flashFlipped
    ? `<span class="side-label">Resposta</span>${escapeHtml(card.back)}`
    : `<span class="side-label">Pergunta</span>${escapeHtml(card.front)}`;
}
document.getElementById('flashPrev').addEventListener('click', () => {
  if(!flashcards.length) return;
  flashIndex = (flashIndex - 1 + flashcards.length) % flashcards.length;
  showFlashCard();
});
document.getElementById('flashNext').addEventListener('click', () => {
  if(!flashcards.length) return;
  flashIndex = (flashIndex + 1) % flashcards.length;
  showFlashCard();
});
flashForm.addEventListener('submit', e => {
  e.preventDefault();
  const front = flashFront.value.trim();
  const back = flashBack.value.trim();
  if(!front || !back) return;
  flashcards.push({id:uid(), front, back, reviews:0});
  store.set('flashcards', flashcards);
  flashFront.value=''; flashBack.value='';
  renderFlash();
});
renderFlash();

// ===== Goals =====
let goals = store.get('goals', []);
const goalForm = document.getElementById('goalForm');
const goalInput = document.getElementById('goalInput');
const goalDateInput = document.getElementById('goalDate');
const goalList = document.getElementById('goalList');
const goalEmptyNote = document.getElementById('goalEmptyNote');

function goalDaysBadge(goal){
  if(!goal.date) return '<span class="goal-days">sem prazo</span>';
  const today = todayKey();
  const diff = Math.round((new Date(goal.date) - new Date(today)) / 86400000);
  let cls = '', label = '';
  if(diff < 0){ cls='overdue'; label = 'Atrasada'; }
  else if(diff === 0){ cls='soon'; label = 'Hoje'; }
  else if(diff <= 7){ cls='soon'; label = `em ${diff}d`; }
  else{ label = `em ${diff}d`; }
  return `<span class="goal-days ${cls}">${label}</span>`;
}

function renderGoals(){
  goalList.innerHTML = '';
  goalEmptyNote.style.display = goals.length ? 'none' : 'block';
  [...goals].sort((a,b)=> (a.done-b.done) || (a.date||'').localeCompare(b.date||'')).forEach(goal => {
    const row = document.createElement('div');
    row.className = 'goal-row' + (goal.done ? ' done' : '');
    const dateLabel = goal.date ? new Date(goal.date+'T00:00:00').toLocaleDateString('pt-BR') : 'Sem prazo';
    row.innerHTML = `
      <button class="goal-check" aria-label="Concluir">${goal.done ? '✓' : ''}</button>
      <div class="goal-info">
        <p class="goal-name">${escapeHtml(goal.text)}</p>
        <p class="goal-date">${dateLabel}</p>
      </div>
      ${goal.done ? '' : goalDaysBadge(goal)}
      <button class="goal-del" aria-label="Remover">✕</button>
    `;
    row.querySelector('.goal-check').addEventListener('click', () => {
      goal.done = !goal.done;
      store.set('goals', goals); renderGoals(); renderDashboard();
    });
    row.querySelector('.goal-del').addEventListener('click', () => {
      goals = goals.filter(g => g.id !== goal.id);
      store.set('goals', goals); renderGoals(); renderDashboard();
    });
    goalList.appendChild(row);
  });
}
goalForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = goalInput.value.trim();
  if(!text) return;
  goals.push({id:uid(), text, date: goalDateInput.value, done:false});
  store.set('goals', goals);
  goalInput.value=''; goalDateInput.value='';
  renderGoals(); renderDashboard();
});
renderGoals();

// ============================================================
// ESTUDOS — Simulados ENAMED
// ============================================================
let simulados = store.get('simulados', []);
let openSimulados = new Set();

const simuladoForm = document.getElementById('simuladoForm');
const simNomeInput = document.getElementById('simNome');
const simDataInput = document.getElementById('simData');
const simNotaInput = document.getElementById('simNota');
const simAreasList = document.getElementById('simAreasList');
const addAreaBtn = document.getElementById('addAreaBtn');
const simuladoList = document.getElementById('simuladoList');
const simuladoEmptyNote = document.getElementById('simuladoEmptyNote');
const simuladoStatsRow = document.getElementById('simuladoStatsRow');
const simuladoChartCard = document.getElementById('simuladoChartCard');
let simuladoChartInstance = null;

function addAreaRow(name, score){
  const row = document.createElement('div');
  row.className = 'sim-area-row';
  row.innerHTML = `
    <input type="text" placeholder="Área (ex: Clínica Médica)" value="${name?escapeHtml(name):''}">
    <input type="number" placeholder="Nota" step="0.1" value="${score!=null?score:''}">
    <button type="button" class="area-remove" aria-label="Remover área">✕</button>
  `;
  row.querySelector('.area-remove').addEventListener('click', () => row.remove());
  simAreasList.appendChild(row);
}
addAreaBtn.addEventListener('click', () => addAreaRow());
addAreaRow();

simuladoForm.addEventListener('submit', e => {
  e.preventDefault();
  const nome = simNomeInput.value.trim();
  const data = simDataInput.value;
  const nota = parseFloat(simNotaInput.value);
  if(!nome || !data || isNaN(nota)) return;
  const areas = [...simAreasList.querySelectorAll('.sim-area-row')].map(row => {
    const inputs = row.querySelectorAll('input');
    return { name: inputs[0].value.trim(), score: parseFloat(inputs[1].value) };
  }).filter(a => a.name && !isNaN(a.score));

  simulados.push({ id: uid(), nome, data, nota, areas });
  store.set('simulados', simulados);
  simuladoForm.reset();
  simAreasList.innerHTML = '';
  addAreaRow();
  renderSimulados();
  renderDashboard();
});

function renderSimulados(){
  simuladoEmptyNote.style.display = simulados.length ? 'none' : 'block';

  if(simulados.length){
    const scores = simulados.map(s=>s.nota);
    const best = Math.max(...scores);
    const avg = (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
    const sortedByDate = [...simulados].sort((a,b)=>a.data.localeCompare(b.data));
    const last = sortedByDate[sortedByDate.length-1].nota;
    simuladoStatsRow.innerHTML = `
      <div class="stat-box"><div class="stat-num">${simulados.length}</div><div class="stat-label">Simulados feitos</div></div>
      <div class="stat-box"><div class="stat-num">${last}</div><div class="stat-label">Última nota</div></div>
      <div class="stat-box"><div class="stat-num">${avg}</div><div class="stat-label">Média geral</div></div>
      <div class="stat-box"><div class="stat-num">${best}</div><div class="stat-label">Melhor nota</div></div>
    `;
  } else {
    simuladoStatsRow.innerHTML = '';
  }

  if(simulados.length >= 1){
    simuladoChartCard.style.display = 'block';
    const sorted = [...simulados].sort((a,b)=>a.data.localeCompare(b.data));
    const labels = sorted.map(s => new Date(s.data+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    const data = sorted.map(s=>s.nota);
    const styles = getComputedStyle(document.body);
    const accent = styles.getPropertyValue('--accent').trim();
    const ink = styles.getPropertyValue('--ink-soft').trim();
    const line = styles.getPropertyValue('--line').trim();
    if(simuladoChartInstance) simuladoChartInstance.destroy();
    simuladoChartInstance = new Chart(document.getElementById('simuladoChart'), {
      type:'line',
      data:{ labels, datasets:[{ data, borderColor:accent, backgroundColor:accent, tension:0.3, pointRadius:4, pointBackgroundColor:accent, fill:false }] },
      options:{
        responsive:true,
        plugins:{ legend:{display:false} },
        scales:{
          x:{ grid:{display:false}, ticks:{color:ink} },
          y:{ ticks:{color:ink}, grid:{color:line} }
        }
      }
    });
  } else {
    simuladoChartCard.style.display = 'none';
  }

  simuladoList.innerHTML = [...simulados].sort((a,b)=>b.data.localeCompare(a.data)).map(sim => {
    const dateLabel = new Date(sim.data+'T00:00:00').toLocaleDateString('pt-BR');
    const areasHtml = sim.areas.length
      ? sim.areas.map(a => `<span class="area-tag">${escapeHtml(a.name)} <span class="area-tag-score">${a.score}</span></span>`).join('')
      : '<span class="hint">Sem detalhamento por área.</span>';
    return `
      <div class="simulado-card ${openSimulados.has(sim.id)?'open':''}" data-sim-id="${sim.id}">
        <div class="simulado-head" data-action="toggle-sim">
          <span class="sim-chevron">▾</span>
          <span class="sim-name">${escapeHtml(sim.nome)}</span>
          <span class="sim-date">${dateLabel}</span>
          <span class="sim-score">${sim.nota}</span>
          <button class="simulado-del" data-action="del-sim" aria-label="Remover">✕</button>
        </div>
        <div class="simulado-areas">${areasHtml}</div>
      </div>`;
  }).join('');
}

simuladoList.addEventListener('click', e => {
  const delBtn = e.target.closest('[data-action="del-sim"]');
  if(delBtn){
    const card = delBtn.closest('.simulado-card');
    simulados = simulados.filter(s => s.id !== card.dataset.simId);
    store.set('simulados', simulados);
    renderSimulados(); renderDashboard();
    return;
  }
  const head = e.target.closest('[data-action="toggle-sim"]');
  if(head){
    const card = head.closest('.simulado-card');
    const id = card.dataset.simId;
    if(openSimulados.has(id)) openSimulados.delete(id); else openSimulados.add(id);
    card.classList.toggle('open');
  }
});
renderSimulados();

// ============================================================
// ESTUDOS — Conteúdo programático (período > módulo > conteúdo)
// ============================================================
let studyPeriods = store.get('studyPeriods', []);
let openPeriods = new Set();
let openModules = new Set();

const periodForm = document.getElementById('periodForm');
const periodInput = document.getElementById('periodInput');
const periodListEl = document.getElementById('periodList');
const periodEmptyNote = document.getElementById('periodEmptyNote');

function renderPeriods(){
  periodEmptyNote.style.display = studyPeriods.length ? 'none' : 'block';

  periodListEl.innerHTML = studyPeriods.map(period => {
    const modulesHtml = period.modules.map(mod => {
      const doneCount = mod.items.filter(i=>i.done).length;
      const itemsHtml = mod.items.map(item => `
        <div class="content-item-row ${item.done?'done':''}">
          <button class="content-check" data-action="toggle-item" data-period="${period.id}" data-module="${mod.id}" data-item="${item.id}">${item.done?'✓':''}</button>
          <span class="content-text">${escapeHtml(item.text)}</span>
          <button class="content-del" data-action="del-item" data-period="${period.id}" data-module="${mod.id}" data-item="${item.id}">✕</button>
        </div>`).join('');
      return `
        <details class="module-block" data-module-id="${mod.id}">
          <summary>
            <span class="m-chevron">▸</span>
            <span class="m-name">${escapeHtml(mod.name)}</span>
            <span class="module-progress">${doneCount}/${mod.items.length}</span>
            <button class="module-del" data-action="del-module" data-period="${period.id}" data-module="${mod.id}">✕</button>
          </summary>
          <div class="module-block-body">
            ${itemsHtml || '<p class="empty-note" style="padding:10px 0">Nenhum conteúdo adicionado.</p>'}
            <form class="inline-add-row add-item-form" data-period="${period.id}" data-module="${mod.id}">
              <input type="text" placeholder="Novo conteúdo..." required>
              <button type="submit" class="ghost-btn small">Adicionar</button>
            </form>
          </div>
        </details>`;
    }).join('');

    const totalItems = period.modules.reduce((a,m)=>a+m.items.length,0);
    const doneItems = period.modules.reduce((a,m)=>a+m.items.filter(i=>i.done).length,0);

    return `
      <details class="period-block" data-period-id="${period.id}">
        <summary>
          <span class="p-chevron">▸</span>
          <span class="p-name">${escapeHtml(period.name)}</span>
          <span class="module-progress">${doneItems}/${totalItems}</span>
          <button class="period-del" data-action="del-period" data-period="${period.id}">✕</button>
        </summary>
        <div class="period-block-body">
          ${modulesHtml}
          <form class="inline-add-row add-module-form" data-period="${period.id}">
            <input type="text" placeholder="Novo módulo..." required>
            <button type="submit" class="ghost-btn small">+ Módulo</button>
          </form>
        </div>
      </details>`;
  }).join('');

  periodListEl.querySelectorAll('.period-block').forEach(el => {
    if(openPeriods.has(el.dataset.periodId)) el.open = true;
    el.ontoggle = () => { el.open ? openPeriods.add(el.dataset.periodId) : openPeriods.delete(el.dataset.periodId); };
  });
  periodListEl.querySelectorAll('.module-block').forEach(el => {
    if(openModules.has(el.dataset.moduleId)) el.open = true;
    el.ontoggle = () => { el.open ? openModules.add(el.dataset.moduleId) : openModules.delete(el.dataset.moduleId); };
  });
}

periodForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = periodInput.value.trim();
  if(!name) return;
  studyPeriods.push({id:uid(), name, modules:[]});
  store.set('studyPeriods', studyPeriods);
  periodInput.value = '';
  renderPeriods();
});

periodListEl.addEventListener('submit', e => {
  if(e.target.matches('.add-module-form')){
    e.preventDefault();
    const periodId = e.target.dataset.period;
    const input = e.target.querySelector('input');
    const name = input.value.trim();
    if(!name) return;
    const period = studyPeriods.find(p=>p.id===periodId);
    period.modules.push({id:uid(), name, items:[]});
    openPeriods.add(periodId);
    store.set('studyPeriods', studyPeriods);
    renderPeriods();
  } else if(e.target.matches('.add-item-form')){
    e.preventDefault();
    const periodId = e.target.dataset.period;
    const moduleId = e.target.dataset.module;
    const input = e.target.querySelector('input');
    const text = input.value.trim();
    if(!text) return;
    const period = studyPeriods.find(p=>p.id===periodId);
    const mod = period.modules.find(m=>m.id===moduleId);
    mod.items.push({id:uid(), text, done:false});
    openPeriods.add(periodId); openModules.add(moduleId);
    store.set('studyPeriods', studyPeriods);
    renderPeriods();
  }
});

periodListEl.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  const periodId = btn.dataset.period;
  const period = studyPeriods.find(p=>p.id===periodId);
  if(action === 'del-period'){
    studyPeriods = studyPeriods.filter(p=>p.id!==periodId);
  } else if(action === 'del-module'){
    period.modules = period.modules.filter(m=>m.id!==btn.dataset.module);
    openPeriods.add(periodId);
  } else if(action === 'del-item'){
    const mod = period.modules.find(m=>m.id===btn.dataset.module);
    mod.items = mod.items.filter(i=>i.id!==btn.dataset.item);
    openPeriods.add(periodId); openModules.add(btn.dataset.module);
  } else if(action === 'toggle-item'){
    const mod = period.modules.find(m=>m.id===btn.dataset.module);
    const item = mod.items.find(i=>i.id===btn.dataset.item);
    item.done = !item.done;
    openPeriods.add(periodId); openModules.add(btn.dataset.module);
  } else {
    return;
  }
  store.set('studyPeriods', studyPeriods);
  renderPeriods();
});
renderPeriods();

// ===== Estudos: sub-navegação (Simulados / Conteúdo) =====
document.getElementById('studySubnav').addEventListener('click', e => {
  const btn = e.target.closest('.filter-chip');
  if(!btn) return;
  document.querySelectorAll('#studySubnav .filter-chip').forEach(c => c.classList.toggle('active', c===btn));
  const mode = btn.dataset.study;
  document.getElementById('studySimulados').style.display = mode === 'simulados' ? 'block' : 'none';
  document.getElementById('studyConteudo').style.display = mode === 'conteudo' ? 'block' : 'none';
});

// ============================================================
// TREINO — sessões de musculação
// ============================================================
let workouts = store.get('workouts', []);
let openSessions = new Set();

const sessionForm = document.getElementById('sessionForm');
const sessionLabel = document.getElementById('sessionLabel');
const sessionDateInput = document.getElementById('sessionDate');
const sessionListEl = document.getElementById('sessionList');
const sessionEmptyNote = document.getElementById('sessionEmptyNote');
const workoutStatsRow = document.getElementById('workoutStatsRow');
const workoutChartCard = document.getElementById('workoutChartCard');
const exerciseSelect = document.getElementById('exerciseSelect');
let workoutChartInstance = null;

sessionDateInput.value = todayKey();

function distinctExerciseNames(){
  const map = new Map();
  workouts.forEach(w => w.exercises.forEach(ex => {
    const key = ex.name.toLowerCase();
    if(!map.has(key)) map.set(key, ex.name);
  }));
  return [...map.values()];
}

function renderWorkoutStats(){
  const total = workouts.length;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-6);
  const weekAgoKey = todayKey(weekAgo);
  const thisWeek = workouts.filter(w => w.date >= weekAgoKey).length;
  const exerciseCount = distinctExerciseNames().length;
  const totalSets = workouts.reduce((a,w)=>a + w.exercises.reduce((b,ex)=>b+ex.sets.length,0), 0);
  workoutStatsRow.innerHTML = `
    <div class="stat-box"><div class="stat-num">${total}</div><div class="stat-label">Treinos registrados</div></div>
    <div class="stat-box"><div class="stat-num">${thisWeek}</div><div class="stat-label">Essa semana</div></div>
    <div class="stat-box"><div class="stat-num">${exerciseCount}</div><div class="stat-label">Exercícios diferentes</div></div>
    <div class="stat-box"><div class="stat-num">${totalSets}</div><div class="stat-label">Séries no total</div></div>
  `;
}

function renderWorkoutChart(){
  const names = distinctExerciseNames();
  if(!names.length){ workoutChartCard.style.display = 'none'; return; }
  workoutChartCard.style.display = 'block';
  const prevSelected = exerciseSelect.value;
  exerciseSelect.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  exerciseSelect.value = names.includes(prevSelected) ? prevSelected : names[names.length-1];
  const selected = exerciseSelect.value;

  const points = [];
  [...workouts].sort((a,b)=>a.date.localeCompare(b.date)).forEach(w => {
    const matching = w.exercises.filter(ex => ex.name.toLowerCase() === selected.toLowerCase());
    if(!matching.length) return;
    const maxLoad = Math.max(...matching.flatMap(ex => ex.sets.map(s=>s.carga)));
    points.push({ date: w.date, load: maxLoad });
  });
  const labels = points.map(p => new Date(p.date+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
  const data = points.map(p=>p.load);

  const styles = getComputedStyle(document.body);
  const accent = styles.getPropertyValue('--accent').trim();
  const ink = styles.getPropertyValue('--ink-soft').trim();
  const line = styles.getPropertyValue('--line').trim();
  if(workoutChartInstance) workoutChartInstance.destroy();
  workoutChartInstance = new Chart(document.getElementById('workoutChart'), {
    type:'line',
    data:{ labels, datasets:[{ data, borderColor:accent, backgroundColor:accent, tension:0.3, pointRadius:4, pointBackgroundColor:accent, fill:false }] },
    options:{
      responsive:true,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{display:false}, ticks:{color:ink} },
        y:{ ticks:{color:ink}, grid:{color:line} }
      }
    }
  });
}
exerciseSelect.addEventListener('change', renderWorkoutChart);

function newSetRowHtml(){
  return `<div class="sim-area-row"><input type="number" placeholder="Carga (kg)" step="0.5"><input type="number" placeholder="Reps" step="1"><button type="button" class="area-remove" data-action="remove-set-row">✕</button></div>`;
}

function renderWorkouts(){
  sessionEmptyNote.style.display = workouts.length ? 'none' : 'block';
  renderWorkoutStats();
  renderWorkoutChart();

  sessionListEl.innerHTML = [...workouts].sort((a,b)=>b.date.localeCompare(a.date)).map(session => {
    const dateLabel = new Date(session.date+'T00:00:00').toLocaleDateString('pt-BR');
    const exercisesHtml = session.exercises.map(ex => {
      const tags = ex.sets.map(s => `<span class="area-tag">${s.carga}kg <span class="area-tag-score">×${s.reps}</span></span>`).join('');
      return `
        <div class="exercise-row">
          <span class="exercise-name">${escapeHtml(ex.name)}</span>
          <div class="exercise-tags">${tags}</div>
          <button class="content-del" data-action="del-exercise" data-session="${session.id}" data-exercise="${ex.id}">✕</button>
        </div>`;
    }).join('');

    return `
      <details class="period-block" data-session-id="${session.id}">
        <summary>
          <span class="p-chevron">▸</span>
          <span class="p-name">${escapeHtml(session.label || ('Treino de ' + dateLabel))}</span>
          <span class="module-progress">${session.exercises.length} exerc.</span>
          <span class="sim-date">${dateLabel}</span>
          <button class="period-del" data-action="del-session" data-session="${session.id}">✕</button>
        </summary>
        <div class="period-block-body">
          ${exercisesHtml || '<p class="empty-note" style="padding:10px 0">Nenhum exercício adicionado ainda.</p>'}
          <form class="exercise-form" data-session="${session.id}">
            <input type="text" class="exercise-name-input" placeholder="Exercício (ex: Supino reto)" required>
            <div class="sim-areas-list set-rows">
              ${newSetRowHtml()}
              ${newSetRowHtml()}
            </div>
            <div class="exercise-form-actions">
              <button type="button" class="ghost-btn small" data-action="add-set-row">+ Série</button>
              <button type="submit" class="primary-btn small">Adicionar exercício</button>
            </div>
          </form>
        </div>
      </details>`;
  }).join('');

  sessionListEl.querySelectorAll('.period-block').forEach(el => {
    if(openSessions.has(el.dataset.sessionId)) el.open = true;
    el.ontoggle = () => { el.open ? openSessions.add(el.dataset.sessionId) : openSessions.delete(el.dataset.sessionId); };
  });
}

sessionForm.addEventListener('submit', e => {
  e.preventDefault();
  const label = sessionLabel.value.trim();
  const date = sessionDateInput.value || todayKey();
  workouts.push({ id: uid(), label, date, exercises: [] });
  store.set('workouts', workouts);
  sessionLabel.value = '';
  sessionDateInput.value = todayKey();
  renderWorkouts(); renderDashboard();
});

sessionListEl.addEventListener('click', e => {
  const addSetBtn = e.target.closest('[data-action="add-set-row"]');
  if(addSetBtn){
    const container = addSetBtn.closest('form').querySelector('.set-rows');
    container.insertAdjacentHTML('beforeend', newSetRowHtml());
    return;
  }
  const removeSetBtn = e.target.closest('[data-action="remove-set-row"]');
  if(removeSetBtn){ removeSetBtn.closest('.sim-area-row').remove(); return; }

  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  const sessionId = btn.dataset.session;
  if(action === 'del-session'){
    workouts = workouts.filter(w => w.id !== sessionId);
  } else if(action === 'del-exercise'){
    const session = workouts.find(w => w.id === sessionId);
    session.exercises = session.exercises.filter(ex => ex.id !== btn.dataset.exercise);
    openSessions.add(sessionId);
  } else {
    return;
  }
  store.set('workouts', workouts);
  renderWorkouts(); renderDashboard();
});

sessionListEl.addEventListener('submit', e => {
  if(!e.target.matches('.exercise-form')) return;
  e.preventDefault();
  const sessionId = e.target.dataset.session;
  const name = e.target.querySelector('.exercise-name-input').value.trim();
  if(!name) return;
  const rows = [...e.target.querySelectorAll('.set-rows .sim-area-row')];
  const sets = rows.map(row => {
    const inputs = row.querySelectorAll('input');
    return { carga: parseFloat(inputs[0].value), reps: parseInt(inputs[1].value) };
  }).filter(s => !isNaN(s.carga) && !isNaN(s.reps) && s.reps > 0);
  if(!sets.length) return;
  const session = workouts.find(w => w.id === sessionId);
  session.exercises.push({ id: uid(), name, sets });
  openSessions.add(sessionId);
  store.set('workouts', workouts);
  renderWorkouts(); renderDashboard();
});
renderWorkouts();

// ============================================================
// DASHBOARD
// ============================================================
function computeStats(){
  const doneTasks = tasks.filter(t=>t.done).length;
  const totalPomodoros = store.get('pomodoroCount_' + todayKey(), 0);
  const activeStreaks = habits.map(computeStreak);
  const bestStreak = activeStreaks.length ? Math.max(...activeStreaks) : 0;
  return { habitsCount: habits.length, bestStreak, doneTasks, totalPomodoros };
}

function renderDashboard(){
  const stats = computeStats();
  document.getElementById('dashStatsRow').innerHTML = `
    <div class="stat-box"><div class="stat-num">${habits.filter(h=>h.log[todayKey()]).length}/${habits.length}</div><div class="stat-label">Hábitos hoje</div></div>
    <div class="stat-box"><div class="stat-num">${stats.bestStreak}</div><div class="stat-label">Melhor sequência</div></div>
    <div class="stat-box"><div class="stat-num">${tasks.filter(t=>!t.done).length}</div><div class="stat-label">Tarefas pendentes</div></div>
    <div class="stat-box"><div class="stat-num">${stats.totalPomodoros}</div><div class="stat-label">Pomodoros hoje</div></div>
  `;

  const pendingTasks = tasks.filter(t=>!t.done).slice(0,5);
  document.getElementById('dashTasks').innerHTML = pendingTasks.length
    ? pendingTasks.map(t => `<div class="dash-row"><span class="dr-dot"></span><span class="dr-text">${escapeHtml(t.text)}</span>${dueBadge(t.due)}</div>`).join('')
    : '<p class="dash-empty">Nenhuma tarefa pendente.</p>';

  document.getElementById('dashHabits').innerHTML = habits.length
    ? habits.map(h => {
        const on = !!h.log[todayKey()];
        return `<div class="dash-row"><span class="dr-dot" style="background:${on?'var(--accent)':'var(--line)'}"></span><span class="dr-text">${escapeHtml(h.name)}</span><span class="dr-meta">${on?'feito':'pendente'}</span></div>`;
      }).join('')
    : '<p class="dash-empty">Nenhum hábito cadastrado.</p>';

  const upcomingGoals = goals.filter(g=>!g.done).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(0,4);
  document.getElementById('dashGoals').innerHTML = upcomingGoals.length
    ? upcomingGoals.map(g => `<div class="dash-row"><span class="dr-dot"></span><span class="dr-text">${escapeHtml(g.text)}</span>${goalDaysBadge(g)}</div>`).join('')
    : '<p class="dash-empty">Nenhuma meta cadastrada.</p>';

  const dashStudyEl = document.getElementById('dashStudy');
  if(simulados.length){
    const sortedByDate = [...simulados].sort((a,b)=>a.data.localeCompare(b.data));
    const last = sortedByDate[sortedByDate.length-1];
    const best = Math.max(...simulados.map(s=>s.nota));
    dashStudyEl.innerHTML = `
      <div class="dash-row"><span class="dr-dot"></span><span class="dr-text">Última: ${escapeHtml(last.nome)}</span><span class="dr-meta">${last.nota}</span></div>
      <div class="dash-row"><span class="dr-dot"></span><span class="dr-text">Melhor nota</span><span class="dr-meta">${best}</span></div>
    `;
  } else {
    dashStudyEl.innerHTML = '<p class="dash-empty">Nenhum simulado registrado ainda.</p>';
  }

  const dashWorkoutEl = document.getElementById('dashWorkout');
  if(workouts.length){
    const sortedW = [...workouts].sort((a,b)=>b.date.localeCompare(a.date));
    const last = sortedW[0];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-6);
    const weekCount = workouts.filter(w => w.date >= todayKey(weekAgo)).length;
    const lastDateLabel = new Date(last.date+'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
    dashWorkoutEl.innerHTML = `
      <div class="dash-row"><span class="dr-dot"></span><span class="dr-text">Último: ${escapeHtml(last.label || 'Treino')}</span><span class="dr-meta">${lastDateLabel}</span></div>
      <div class="dash-row"><span class="dr-dot"></span><span class="dr-text">Essa semana</span><span class="dr-meta">${weekCount} treino(s)</span></div>
    `;
  } else {
    dashWorkoutEl.innerHTML = '<p class="dash-empty">Nenhum treino registrado ainda.</p>';
  }

  renderDashboardEvents();
}

function renderDashboardEvents(){
  const el = document.getElementById('dashEvents');
  if(!gAccessToken){
    el.innerHTML = '<p class="dash-empty">Conecte sua Google Agenda na aba Agenda para ver seus próximos eventos aqui.</p>';
    return;
  }
  if(!gUpcomingEvents.length){ el.innerHTML = '<p class="dash-empty">Nenhum evento futuro.</p>'; return; }
  el.innerHTML = gUpcomingEvents.slice(0,5).map(ev => {
    const start = ev.start?.dateTime || ev.start?.date;
    const label = formatEventDateLabel(start, !!ev.start?.dateTime);
    return `<div class="dash-row"><span class="dr-dot"></span><span class="dr-text">${escapeHtml(ev.summary || 'Sem título')}</span><span class="dr-meta">${label}</span></div>`;
  }).join('');
}
renderDashboard();

// ============================================================
// PROGRESS CHARTS
// ============================================================
const statsRow = document.getElementById('statsRow');
let habitChartInstance = null;
let taskChartInstance = null;

function last7Days(){
  const days = [];
  for(let i=6; i>=0; i--){ const d = new Date(); d.setDate(d.getDate()-i); days.push(d); }
  return days;
}

function renderCharts(){
  const days = last7Days();
  const labels = days.map(d => d.toLocaleDateString('pt-BR', {weekday:'short'}).replace('.',''));
  const habitLog = store.get('habitLog', {});
  const taskLog = store.get('taskLog', {});
  const habitData = days.map(d => habitLog[todayKey(d)] || 0);
  const taskData = days.map(d => taskLog[todayKey(d)] || 0);

  const styles = getComputedStyle(document.body);
  const accent = styles.getPropertyValue('--accent').trim();
  const clay = styles.getPropertyValue('--clay').trim();
  const ink = styles.getPropertyValue('--ink-soft').trim();
  const line = styles.getPropertyValue('--line').trim();

  const stats = computeStats();
  statsRow.innerHTML = `
    <div class="stat-box"><div class="stat-num">${stats.habitsCount}</div><div class="stat-label">Hábitos ativos</div></div>
    <div class="stat-box"><div class="stat-num">${stats.bestStreak}</div><div class="stat-label">Melhor sequência</div></div>
    <div class="stat-box"><div class="stat-num">${stats.doneTasks}</div><div class="stat-label">Tarefas concluídas</div></div>
    <div class="stat-box"><div class="stat-num">${stats.totalPomodoros}</div><div class="stat-label">Pomodoros hoje</div></div>
  `;

  const chartOpts = (color) => ({
    type: 'bar',
    data: { labels, datasets: [{ data: [], backgroundColor: color, borderRadius: 6, maxBarThickness: 28 }] },
    options: {
      responsive:true,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{display:false}, ticks:{color:ink, font:{family:'Inter'}} },
        y:{ beginAtZero:true, ticks:{precision:0, color:ink}, grid:{color:line} }
      }
    }
  });

  if(habitChartInstance) habitChartInstance.destroy();
  const hCfg = chartOpts(accent);
  hCfg.data.datasets[0].data = habitData;
  habitChartInstance = new Chart(document.getElementById('habitChart'), hCfg);

  if(taskChartInstance) taskChartInstance.destroy();
  const tCfg = chartOpts(clay);
  tCfg.data.datasets[0].data = taskData;
  taskChartInstance = new Chart(document.getElementById('taskChart'), tCfg);
}

// ============================================================
// COMMAND PALETTE / SEARCH
// ============================================================
const paletteOverlay = document.getElementById('paletteOverlay');
const paletteInput = document.getElementById('paletteInput');
const paletteResults = document.getElementById('paletteResults');

function openPalette(){
  paletteOverlay.classList.add('open');
  paletteInput.value = '';
  paletteResults.innerHTML = '';
  setTimeout(() => paletteInput.focus(), 30);
}
function closePalette(){ paletteOverlay.classList.remove('open'); }

document.getElementById('searchTrigger').addEventListener('click', openPalette);
document.getElementById('mobileSearchBtn').addEventListener('click', openPalette);
paletteOverlay.addEventListener('click', (e) => { if(e.target === paletteOverlay) closePalette(); });

document.addEventListener('keydown', (e) => {
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    paletteOverlay.classList.contains('open') ? closePalette() : openPalette();
  }
  if(e.key === 'Escape' && paletteOverlay.classList.contains('open')) closePalette();
});

function searchIndex(query){
  const q = query.trim().toLowerCase();
  if(!q) return [];
  const results = [];
  tasks.forEach(t => { if(t.text.toLowerCase().includes(q)) results.push({type:'Tarefa', label:t.text, tab:'tarefas'}); });
  notes.forEach(n => { if((n.title+' '+n.body).toLowerCase().includes(q)) results.push({type:'Nota', label:n.title, tab:'notas'}); });
  habits.forEach(h => { if(h.name.toLowerCase().includes(q)) results.push({type:'Hábito', label:h.name, tab:'habitos'}); });
  goals.forEach(g => { if(g.text.toLowerCase().includes(q)) results.push({type:'Meta', label:g.text, tab:'metas'}); });
  flashcards.forEach(c => { if((c.front+' '+c.back).toLowerCase().includes(q)) results.push({type:'Card', label:c.front, tab:'flashcards'}); });
  journalEntries.forEach(j => { if(j.text.toLowerCase().includes(q)) results.push({type:'Diário', label:j.text.slice(0,60), tab:'diario'}); });
  simulados.forEach(s => { if(s.nome.toLowerCase().includes(q)) results.push({type:'Simulado', label:`${s.nome} · ${s.nota}`, tab:'estudos'}); });
  studyPeriods.forEach(p => {
    if(p.name.toLowerCase().includes(q)) results.push({type:'Período', label:p.name, tab:'estudos'});
    p.modules.forEach(m => {
      if(m.name.toLowerCase().includes(q)) results.push({type:'Módulo', label:m.name, tab:'estudos'});
      m.items.forEach(i => { if(i.text.toLowerCase().includes(q)) results.push({type:'Conteúdo', label:i.text, tab:'estudos'}); });
    });
  });
  Object.entries(TAB_LABELS).forEach(([tab,label]) => { if(label.toLowerCase().includes(q)) results.push({type:'Seção', label, tab}); });
  workouts.forEach(w => {
    if((w.label||'').toLowerCase().includes(q)) results.push({type:'Treino', label: w.label || w.date, tab:'treino'});
    w.exercises.forEach(ex => { if(ex.name.toLowerCase().includes(q)) results.push({type:'Exercício', label:ex.name, tab:'treino'}); });
  });
  return results.slice(0,30);
}

paletteInput.addEventListener('input', () => {
  const results = searchIndex(paletteInput.value);
  if(!paletteInput.value.trim()){ paletteResults.innerHTML = ''; return; }
  if(!results.length){ paletteResults.innerHTML = '<p class="palette-empty">Nada encontrado.</p>'; return; }
  paletteResults.innerHTML = results.map(r =>
    `<div class="palette-item" data-tab="${r.tab}"><span class="pi-type">${r.type}</span><span>${escapeHtml(r.label || 'Sem título')}</span></div>`
  ).join('');
  paletteResults.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => { showTab(item.dataset.tab); closePalette(); });
  });
});
}
