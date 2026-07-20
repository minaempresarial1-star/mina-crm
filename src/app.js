import { clearConnectionSettings, createProspectStore, getConnectionSettings, saveConnectionSettings } from './store.js';

const STAGES = ['Por investigar', 'Por contactar', 'Contactado', 'Respondió', 'Reunión', 'Oportunidad', 'Pausado'];
const store = createProspectStore();
const app = document.querySelector('#app');
const prospectDialog = document.querySelector('#prospectDialog');
const moveDialog = document.querySelector('#moveDialog');
const moveOptions = document.querySelector('#moveOptions');
const form = document.querySelector('#prospectForm');
const photoInput = document.querySelector('#photoInput');
const photoPreview = document.querySelector('#photoPreview');
const toast = document.querySelector('#toast');
const connectionDialog = document.querySelector('#connectionDialog');
const connectionForm = document.querySelector('#connectionForm');
const connectionError = document.querySelector('#connectionError');

const state = {
  prospects: [],
  view: new URLSearchParams(location.search).get('view') || 'today',
  mobileStage: STAGES[0],
  pipelineFilter: 'all',
  calendarCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  calendarSelected: dateInputValue(new Date()),
  photo: null,
  photoId: null,
  photoCache: new Map(),
  editId: null,
  moveId: null,
  objectUrls: []
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function dateInputValue(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateInputValue(date);
}

function formatDate(dateString) {
  if (!dateString) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${dateString}T12:00:00`));
}

function isOverdue(prospect) {
  return !prospect.completed && prospect.dueDate && prospect.dueDate < dateInputValue(new Date());
}

function isUncontacted(prospect) {
  return !prospect.completed && STAGES.indexOf(prospect.stage) < 2;
}

function pipelineFilterDetails(filter, prospects) {
  const definitions = {
    all: {
      label: 'Todos los prospectos',
      description: 'Relaciones abiertas que todavía requieren seguimiento, sin importar su etapa.'
    },
    uncontacted: {
      label: 'Sin contacto',
      description: 'Prospectos que siguen en “Por investigar” o “Por contactar” y aún no registran un acercamiento.'
    },
    overdue: {
      label: 'Seguimientos vencidos',
      description: 'Acciones cuya fecha límite ya pasó y todavía no están completadas. Reprográmalas o márcalas como realizadas.'
    }
  };
  const matches = prospects.filter(prospect => {
    if (filter === 'uncontacted') return isUncontacted(prospect);
    if (filter === 'overdue') return isOverdue(prospect);
    return true;
  });
  return { ...definitions[filter], matches };
}

function avatar(owner) {
  if (owner === 'Ambos') return '<span class="avatars"><span class="avatar">AH</span><span class="avatar mario">MA</span></span>';
  return `<span class="avatar ${owner === 'Mario' ? 'mario' : ''}">${owner === 'Mario' ? 'MA' : 'AH'}</span>`;
}

function photoUrl(blob) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  state.objectUrls.push(url);
  return url;
}

function revokeObjectUrls() {
  state.objectUrls.forEach(URL.revokeObjectURL);
  state.objectUrls = [];
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function openConnectionDialog(message = '') {
  const settings = getConnectionSettings();
  document.querySelector('#actorInput').value = settings.actor;
  document.querySelector('#apiKeyInput').value = settings.apiKey;
  connectionError.textContent = message;
  connectionError.hidden = !message;
  connectionDialog.hidden = false;
  setTimeout(() => document.querySelector('#apiKeyInput').focus(), 50);
}

function closeConnectionDialog() {
  connectionDialog.hidden = true;
  connectionError.hidden = true;
}

async function bindPhotoImages() {
  document.querySelectorAll('[data-photo-id]').forEach(async image => {
    const photoId = image.dataset.photoId;
    try {
      const dataUrl = state.photoCache.get(photoId) || await store.photo(photoId);
      if (dataUrl) {
        state.photoCache.set(photoId, dataUrl);
        image.src = dataUrl;
      }
    } catch {
      image.replaceWith(Object.assign(document.createElement('span'), { className: 'recent-photo recent-placeholder', textContent: '◇' }));
    }
  });
}

async function refresh() {
  state.prospects = await store.all();
  render();
}

function setView(view, { replace = false } = {}) {
  state.view = view;
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  render();
}

function sidebar() {
  const items = [
    ['today', '⌂', 'Hoy'],
    ['pipeline', '↗', 'Pipeline'],
    ['capture', '▣', 'Capturar'],
    ['calendar', '□', 'Calendario'],
    ['contacts', '♙', 'Contactos']
  ];
  return `<aside class="sidebar">
    <div class="brand"><span class="brand__mark">◇</span><span><strong>MINA</strong><small>Operación patrimonial</small></span></div>
    <nav class="nav" aria-label="Principal">${items.map(([view, icon, label]) => `<button data-view="${view}" class="${state.view === view ? 'active' : ''}"><span class="nav__icon">${icon}</span>${label}</button>`).join('')}</nav>
    <div class="team-card"><p class="eyebrow" style="color:#f59e0b">Equipo activo</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><div class="avatars"><span class="avatar">AH</span><span class="avatar mario">MA</span></div><span class="micro" style="color:#aeb6ca">2 responsables</span></div><span class="sync-status">Google Sheets sincronizado</span></div>
  </aside>`;
}

function mobileNav() {
  const item = (view, icon, label, extra = '') => `<button data-view="${view}" class="${state.view === view ? 'active' : ''} ${extra}"><span>${icon}</span>${label}</button>`;
  return `<nav class="mobile-nav" aria-label="Navegación móvil">
    ${item('today', '⌂', 'Hoy')}
    ${item('pipeline', '↗', 'Pipeline')}
    <button class="capture" data-open-capture><span>＋</span>Capturar</button>
    ${item('calendar', '□', 'Agenda')}
    ${item('contacts', '♙', 'Contactos')}
  </nav>`;
}

function emptyState(title, body, action = true) {
  return `<div class="empty"><strong>${title}</strong><p class="muted micro">${body}</p>${action ? '<button class="button button--primary" data-open-capture>Capturar primera tarjeta</button>' : ''}</div>`;
}

function todayView() {
  const active = state.prospects.filter(p => !p.completed).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const overdue = active.filter(isOverdue).length;
  const unactivated = active.filter(p => p.stage === STAGES[0]).length;
  const tasks = active.slice(0, 8);
  return `<main class="page">
    <header class="page-header"><div><p class="eyebrow">Operación compartida</p><h1>Cada contacto necesita<br><span>un siguiente paso.</span></h1></div><div class="header-actions"><button class="button button--primary" data-open-capture>＋ Capturar tarjeta</button></div></header>
    <section class="stats" aria-label="Filtros rápidos"><button class="stat" data-dashboard-filter="overdue"><span>Vencidos</span><strong>${overdue}</strong><small>Ver y resolver</small></button><button class="stat" data-dashboard-filter="uncontacted"><span>Por activar</span><strong>${unactivated}</strong><small>Ver sin contacto</small></button><button class="stat" data-dashboard-filter="all"><span>Activos</span><strong>${active.length}</strong><small>Ver pipeline</small></button></section>
    <div class="content-grid"><section><div class="section-head"><div><p class="eyebrow">Agenda compartida</p><h2>Próximas acciones</h2></div></div>
      <div class="task-list">${tasks.length ? tasks.map((p, index) => `<article class="task ${isOverdue(p) ? 'overdue' : ''}"><span class="task__number">${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(p.nextAction)}</h3><p>${escapeHtml(p.name)} · ${escapeHtml(p.specialty)} · ${escapeHtml(p.owner)} · ${formatDate(p.dueDate)}</p></div><button class="task__complete" data-complete="${p.id}" aria-label="Completar seguimiento">✓</button></article>`).join('') : emptyState('La agenda está vacía', 'Captura una tarjeta para crear el primer seguimiento.')}</div>
    </section><aside><div class="focus-panel"><p class="eyebrow" style="color:#f59e0b">Siguiente mejor acción</p><h3>${active.length ? escapeHtml(active[0].nextAction) : 'Registrar lo obtenido en campo'}</h3><p>${active.length ? `${escapeHtml(active[0].name)} · ${escapeHtml(active[0].owner)} · ${formatDate(active[0].dueDate)}. Abre su ficha para trabajar esta acción y dejar el seguimiento actualizado.` : 'Cada tarjeta puede convertirse inmediatamente en responsable, contexto y fecha.'}</p>${active.length ? `<button class="button button--amber" data-focus-prospect="${active[0].id}">Atender seguimiento de ${escapeHtml(active[0].name)}</button>` : '<button class="button button--amber" data-open-capture>Registrar una tarjeta</button>'}</div></aside></div>
  </main>`;
}

function leadCard(prospect, { mobile = false } = {}) {
  const overdue = isOverdue(prospect);
  return `<article class="lead-card ${overdue ? 'stale' : ''}" data-lead-id="${prospect.id}" ${mobile ? 'data-swipe-card' : 'data-desktop-drag'}>
    ${mobile ? '' : '<span class="drag-hint" aria-hidden="true">⠿</span>'}
    <span class="pill ${overdue ? 'amber' : ''}">${escapeHtml(prospect.source)}</span>
    <h3>${escapeHtml(prospect.name)}</h3>
    <p>${escapeHtml(prospect.specialty)}${prospect.location ? ` · ${escapeHtml(prospect.location)}` : ''}</p>
    <div class="next-action"><b>Siguiente acción · ${formatDate(prospect.dueDate)}</b>${escapeHtml(prospect.nextAction)}</div>
    <div class="lead-meta"><span class="micro muted">${escapeHtml(prospect.owner)}</span>${avatar(prospect.owner)}</div>
    ${mobile ? `<div class="mobile-lead-actions"><button data-edit="${prospect.id}" aria-label="Editar ${escapeHtml(prospect.name)}">Editar ficha</button><button data-move="${prospect.id}">Mover de etapa</button></div>` : `<button class="edit-lead" data-edit="${prospect.id}" aria-label="Editar ${escapeHtml(prospect.name)}">Editar</button>`}
  </article>`;
}

function pipelineView() {
  const active = state.prospects.filter(p => !p.completed);
  const filter = pipelineFilterDetails(state.pipelineFilter, active);
  const visible = filter.matches;
  if (!STAGES.includes(state.mobileStage)) state.mobileStage = STAGES[0];
  if (visible.length && !visible.some(prospect => prospect.stage === state.mobileStage)) {
    state.mobileStage = STAGES.find(stage => visible.some(prospect => prospect.stage === stage)) || STAGES[0];
  }
  const mobileProspects = visible.filter(p => p.stage === state.mobileStage);
  const metrics = [
    ['all', 'Prospectos', active.length],
    ['uncontacted', 'Sin contacto', active.filter(isUncontacted).length],
    ['overdue', 'Vencidos', active.filter(isOverdue).length]
  ];
  return `<main class="page">
    <header class="page-header"><div><p class="eyebrow">MINA · Operación patrimonial</p><h1 style="font-size:34px">Pipeline ejecutivo</h1></div><div class="header-actions"><button class="button button--primary" data-open-capture>＋ Capturar tarjeta</button></div></header>
    <section class="pipeline-hero"><div><p class="eyebrow" style="color:#f59e0b">Seguimiento comercial</p><h1>De contacto en contacto,<br><span>ningún compromiso se pierde.</span></h1></div>${metrics.map(([key, label, count]) => `<button class="pipeline-metric ${state.pipelineFilter === key ? 'active' : ''}" data-pipeline-filter="${key}" aria-pressed="${state.pipelineFilter === key}"><span class="micro">${label}</span><strong>${count}</strong><small>${key === 'overdue' ? '¿Qué significa?' : 'Filtrar tablero'}</small></button>`).join('')}</section>
    <section class="filter-explainer" aria-live="polite"><div><span class="filter-explainer__count">${visible.length}</span><div><strong>${filter.label}</strong><p>${filter.description}</p></div></div>${state.pipelineFilter !== 'all' ? '<button class="button button--quiet" data-pipeline-filter="all">Quitar filtro</button>' : ''}</section>
    <div class="board-wrap"><section class="board">${STAGES.map((stage, index) => `<div class="pipeline-column" data-stage="${stage}"><header class="pipeline-column__head"><h2>${stage}</h2><span class="stage-count">${String(index + 1).padStart(2, '0')} · ${visible.filter(p => p.stage === stage).length}</span></header>${visible.filter(p => p.stage === stage).map(p => leadCard(p)).join('') || '<p class="micro muted" style="padding:8px">No hay prospectos con este filtro.</p>'}</div>`).join('')}</section></div>
    <section class="mobile-pipeline"><div class="stage-tabs">${STAGES.map(stage => `<button class="stage-tab ${stage === state.mobileStage ? 'active' : ''}" data-mobile-stage="${stage}">${stage} · ${visible.filter(p => p.stage === stage).length}</button>`).join('')}</div><p class="swipe-instruction">Desliza una tarjeta → para avanzar o ← para regresarla. También puedes usar “Mover de etapa”.</p><div class="mobile-stage"><header class="mobile-stage__head"><h2>${state.mobileStage}</h2><span class="stage-count">${mobileProspects.length}</span></header>${mobileProspects.map(p => leadCard(p, { mobile: true })).join('') || emptyState('Esta etapa está vacía', 'Selecciona otra etapa o cambia el filtro.', false)}</div></section>
  </main>`;
}

function captureView() {
  const recent = state.prospects.slice(0, 8);
  return `<main class="capture-layout"><section class="capture-main"><p class="eyebrow" style="color:#f59e0b">Entrada principal</p><h1>Una tarjeta.<br><span>Una relación</span><br>por activar.</h1><p>Registra lo obtenido durante la prospección. La fotografía conserva la fuente; el contexto, el responsable y la fecha convierten la tarjeta en seguimiento.</p><button class="camera-panel" data-open-capture><span class="camera-card"><strong>Nuevo contacto</strong><small class="muted">Foto · contexto · responsable</small></span></button><button class="button button--amber" data-open-capture>◎ Fotografiar una tarjeta</button></section>
    <section class="capture-inbox"><p class="eyebrow">Capturas recientes</p><h2>${recent.length ? 'Listas para dar seguimiento' : 'Empieza con una tarjeta'}</h2><div class="recent-list">${recent.length ? recent.map(p => { const url = photoUrl(p.photo) || state.photoCache.get(p.photoId); const image = url ? `<img class="recent-photo" src="${url}" alt="Tarjeta de ${escapeHtml(p.name)}">` : p.photoId ? `<img class="recent-photo" data-photo-id="${escapeHtml(p.photoId)}" alt="Tarjeta de ${escapeHtml(p.name)}">` : '<span class="recent-photo recent-placeholder">◇</span>'; return `<article class="recent-card">${image}<div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.specialty)} · ${escapeHtml(p.stage)} · ${formatDate(p.dueDate)}</p></div><button class="button button--quiet micro" data-edit="${p.id}" aria-label="Editar ${escapeHtml(p.name)}">Editar</button></article>`; }).join('') : emptyState('Todavía no hay tarjetas', 'Toca “Fotografiar una tarjeta” y usa la cámara trasera del teléfono.')}</div></section>
  </main>`;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function localCompactDateTime(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function calendarEntries() {
  return state.prospects.filter(prospect => !prospect.completed).flatMap(prospect => {
    const entries = [];
    const appointmentDate = prospect.appointmentAt?.slice(0, 10);
    if (prospect.dueDate && prospect.dueDate !== appointmentDate) {
      entries.push({ type: 'followup', date: prospect.dueDate, prospect, title: prospect.nextAction || `Seguimiento con ${prospect.name}` });
    }
    if (appointmentDate) {
      entries.push({ type: 'appointment', date: appointmentDate, prospect, title: `Cita con ${prospect.name}` });
    } else if (prospect.dueDate && !entries.length) {
      entries.push({ type: 'followup', date: prospect.dueDate, prospect, title: prospect.nextAction || `Seguimiento con ${prospect.name}` });
    }
    return entries;
  }).sort((a, b) => `${a.date}${a.prospect.appointmentAt || ''}`.localeCompare(`${b.date}${b.prospect.appointmentAt || ''}`));
}

function calendarTimeLabel(entry) {
  if (entry.type !== 'appointment') return '';
  return new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.prospect.appointmentAt));
}

function googleCalendarUrl(entry) {
  const prospect = entry.prospect;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: entry.title,
    details: `${prospect.nextAction || 'Seguimiento patrimonial'}\nResponsable: ${prospect.owner}\nRegistrado en MINA CRM`,
    location: prospect.location || prospect.organization || '',
    ctz: 'America/Mexico_City'
  });
  if (entry.type === 'appointment') {
    const start = new Date(prospect.appointmentAt);
    const end = new Date(start.getTime() + 30 * 60000);
    params.set('dates', `${localCompactDateTime(start)}/${localCompactDateTime(end)}`);
  } else {
    const start = new Date(`${entry.date}T12:00:00`);
    params.set('dates', `${entry.date.replaceAll('-', '')}/${dateInputValue(addDays(start, 1)).replaceAll('-', '')}`);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calendarView() {
  const cursor = state.calendarCursor;
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const entries = calendarEntries();
  const todayKey = dateInputValue(new Date());
  const selectedKey = state.calendarSelected;
  const selectedDate = new Date(`${selectedKey}T12:00:00`);
  const selectedEntries = entries.filter(entry => entry.date === selectedKey);
  const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(monthStart);
  const selectedLabel = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate);
  const weekdays = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  return `<main class="page calendar-page">
    <header class="calendar-toolbar">
      <div class="calendar-toolbar__identity"><p class="eyebrow">Agenda compartida</p><h1>${monthLabel}</h1></div>
      <div class="calendar-toolbar__nav"><button class="button button--quiet" data-calendar-nav="today">Hoy</button><button class="calendar-nav-button" data-calendar-nav="prev" aria-label="Mes anterior">‹</button><button class="calendar-nav-button" data-calendar-nav="next" aria-label="Mes siguiente">›</button></div>
      <div class="calendar-toolbar__actions"><button class="button button--quiet" data-export-calendar>⇩ Exportar mes</button><button class="button button--primary" data-open-capture>＋ Crear seguimiento</button></div>
    </header>
    <section class="calendar-sync-note"><span class="calendar-sync-note__icon">G</span><div><strong>Llévalo a tu calendario personal</strong><p>Abre un evento y elige “Añadir a Google Calendar”, o exporta el mes completo como archivo de calendario.</p></div></section>
    <section class="month-calendar" aria-label="Calendario mensual de ${escapeHtml(monthLabel)}">
      <div class="month-weekdays">${weekdays.map(day => `<span>${day}</span>`).join('')}</div>
      <div class="month-grid">${days.map(day => {
        const key = dateInputValue(day);
        const dayEntries = entries.filter(entry => entry.date === key);
        const outside = day.getMonth() !== cursor.getMonth();
        return `<button class="month-day ${outside ? 'outside' : ''} ${key === todayKey ? 'today' : ''} ${key === selectedKey ? 'selected' : ''}" data-calendar-select="${key}" aria-label="${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' }).format(day)}, ${dayEntries.length} eventos"><span class="month-day__number">${day.getDate()}</span><span class="month-day__events">${dayEntries.slice(0, 3).map(entry => `<span class="month-event ${entry.type}"><b>${calendarTimeLabel(entry)}</b>${escapeHtml(entry.prospect.name)}</span>`).join('')}${dayEntries.length > 3 ? `<span class="month-more">+${dayEntries.length - 3} más</span>` : ''}</span></button>`;
      }).join('')}</div>
    </section>
    <section class="day-agenda">
      <header><div><p class="eyebrow">Día seleccionado</p><h2>${selectedLabel}</h2></div><span class="day-agenda__count">${selectedEntries.length} ${selectedEntries.length === 1 ? 'evento' : 'eventos'}</span></header>
      <div class="day-agenda__list">${selectedEntries.length ? selectedEntries.map(entry => `<article class="agenda-event"><span class="agenda-event__rail ${entry.type}"></span><div><span class="micro muted">${entry.type === 'appointment' ? `${calendarTimeLabel(entry)} · Cita confirmada` : `Todo el día · Seguimiento`}</span><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.prospect.nextAction)} · ${escapeHtml(entry.prospect.owner)}</p></div><div class="agenda-event__actions"><a class="button button--google" href="${escapeHtml(googleCalendarUrl(entry))}" target="_blank" rel="noopener">Añadir a Google Calendar</a><button class="button button--quiet" data-edit="${entry.prospect.id}">Editar seguimiento</button></div></article>`).join('') : `<div class="empty"><strong>No hay eventos este día</strong><p class="muted micro">Selecciona otro día o crea un seguimiento con fecha.</p><button class="button button--primary" data-open-capture>Crear seguimiento</button></div>`}</div>
    </section>
  </main>`;
}

function contactsView() {
  return `<main class="page"><header class="page-header"><div><p class="eyebrow">Directorio</p><h1 style="font-size:45px">Todas las relaciones,<br><span>un solo historial.</span></h1></div><button class="button button--primary" data-open-capture>＋ Capturar</button></header><section class="directory"><input class="search" id="contactSearch" type="search" placeholder="Buscar por nombre, especialidad o responsable"><div class="directory-list" id="directoryList">${directoryRows(state.prospects)}</div></section></main>`;
}

function directoryRows(prospects) {
  return prospects.length ? prospects.map(p => `<article class="directory-row"><div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.specialty)}${p.organization ? ` · ${escapeHtml(p.organization)}` : ''} · ${escapeHtml(p.source)}${p.phone ? ` · ${escapeHtml(p.phone)}` : ''}</p></div><span class="pill">${escapeHtml(p.stage)}</span><div style="display:flex;gap:8px;align-items:center"><button class="button button--quiet micro" data-edit="${p.id}" aria-label="Editar ${escapeHtml(p.name)}">Editar</button>${avatar(p.owner)}<button class="delete-button" data-delete="${p.id}" aria-label="Eliminar ${escapeHtml(p.name)}">×</button></div></article>`).join('') : emptyState('No hay contactos todavía', 'La primera tarjeta que captures aparecerá aquí.');
}

function render() {
  revokeObjectUrls();
  const views = { today: todayView, pipeline: pipelineView, capture: captureView, calendar: calendarView, contacts: contactsView };
  const view = views[state.view] || todayView;
  app.innerHTML = `<div class="shell">${sidebar()}${view()}</div>${mobileNav()}`;
  bindViewEvents();
}

function openProspectDialog() {
  state.photo = null;
  state.photoId = null;
  state.editId = null;
  form.reset();
  document.querySelector('#dialogTitle').textContent = 'Activar una relación';
  document.querySelector('#dialogEyebrow').textContent = 'Nueva tarjeta';
  document.querySelector('#saveProspectButton').textContent = 'Guardar y crear seguimiento';
  document.querySelector('#nextActionInput').value = 'Investigar y preparar acercamiento';
  document.querySelector('#dueDateInput').value = defaultDueDate();
  document.querySelector('#stageInput').value = STAGES[0];
  photoPreview.innerHTML = '◎';
  photoInput.value = '';
  prospectDialog.hidden = false;
  setTimeout(() => document.querySelector('#nameInput').focus(), 50);
}

function openEditDialog(id) {
  const prospect = state.prospects.find(p => p.id === id);
  if (!prospect) return;
  state.editId = id;
  state.photo = prospect.photo || null;
  state.photoId = prospect.photoId || null;
  form.reset();
  document.querySelector('#dialogTitle').textContent = `Editar a ${prospect.name}`;
  document.querySelector('#dialogEyebrow').textContent = 'Ficha del prospecto';
  document.querySelector('#saveProspectButton').textContent = 'Guardar cambios';
  document.querySelector('#nameInput').value = prospect.name || '';
  document.querySelector('#specialtyInput').value = prospect.specialty || '';
  document.querySelector('#organizationInput').value = prospect.organization || '';
  document.querySelector('#stageInput').value = prospect.stage || STAGES[0];
  document.querySelector('#sourceInput').value = prospect.source || 'Otro';
  document.querySelector('#ownerInput').value = prospect.owner || 'Alejandro';
  document.querySelector('#phoneInput').value = prospect.phone || '';
  document.querySelector('#emailInput').value = prospect.email || '';
  document.querySelector('#locationInput').value = prospect.location || '';
  document.querySelector('#nextActionInput').value = prospect.nextAction || '';
  document.querySelector('#dueDateInput').value = prospect.dueDate || defaultDueDate();
  document.querySelector('#appointmentInput').value = prospect.appointmentAt || '';
  document.querySelector('#contextInput').value = prospect.context || '';
  photoInput.value = '';
  if (prospect.photo) {
    const url = URL.createObjectURL(prospect.photo);
    state.objectUrls.push(url);
    photoPreview.innerHTML = `<img src="${url}" alt="Tarjeta de ${escapeHtml(prospect.name)}">`;
  } else if (prospect.photoId) {
    photoPreview.innerHTML = '<span class="micro muted">Cargando foto…</span>';
    store.photo(prospect.photoId).then(dataUrl => {
      if (!dataUrl || state.editId !== id) return;
      state.photoCache.set(prospect.photoId, dataUrl);
      photoPreview.innerHTML = `<img src="${dataUrl}" alt="Tarjeta de ${escapeHtml(prospect.name)}">`;
    }).catch(() => { photoPreview.innerHTML = '◎'; });
  } else {
    photoPreview.innerHTML = '◎';
  }
  prospectDialog.hidden = false;
  setTimeout(() => document.querySelector('#nameInput').focus(), 50);
}

function closeProspectDialog() {
  prospectDialog.hidden = true;
  state.photo = null;
  state.photoId = null;
  state.editId = null;
}

function openMoveDialog(id) {
  const prospect = state.prospects.find(p => p.id === id);
  if (!prospect) return;
  state.moveId = id;
  document.querySelector('#moveTitle').textContent = `Mover a ${prospect.name}`;
  moveOptions.innerHTML = STAGES.map((stage, index) => `<button class="${prospect.stage === stage ? 'active' : ''}" data-move-to="${stage}"><span>${String(index + 1).padStart(2, '0')} · ${stage}</span>${prospect.stage === stage ? '<span>Actual</span>' : '<span>→</span>'}</button>`).join('');
  moveDialog.hidden = false;
  bindMoveOptions();
}

function closeMoveDialog() {
  moveDialog.hidden = true;
  state.moveId = null;
}

async function moveProspect(id, stage) {
  const prospect = state.prospects.find(p => p.id === id);
  if (!prospect || prospect.stage === stage) return;
  await store.update(id, { stage });
  showToast(`${prospect.name} avanzó a ${stage}.`);
  await refresh();
}

async function moveRelative(id, direction) {
  const prospect = state.prospects.find(p => p.id === id);
  const index = STAGES.indexOf(prospect?.stage);
  const nextIndex = Math.max(0, Math.min(STAGES.length - 1, index + direction));
  if (!prospect || nextIndex === index) return;
  state.mobileStage = STAGES[nextIndex];
  await moveProspect(id, STAGES[nextIndex]);
}

function bindMoveOptions() {
  document.querySelectorAll('[data-move-to]').forEach(button => button.addEventListener('click', async () => {
    const id = state.moveId;
    const stage = button.dataset.moveTo;
    closeMoveDialog();
    await moveProspect(id, stage);
  }));
}

function bindDesktopDrag() {
  document.querySelectorAll('[data-desktop-drag]').forEach(card => {
    let startX = 0;
    let startY = 0;
    let dragging = false;

    card.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.target.closest('button')) return;
      startX = event.clientX;
      startY = event.clientY;
      dragging = false;
      card.setPointerCapture(event.pointerId);
    });

    card.addEventListener('pointermove', event => {
      if (!card.hasPointerCapture(event.pointerId)) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < 6) return;
      dragging = true;
      card.classList.add('dragging');
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(1deg)`;
      document.querySelectorAll('.pipeline-column').forEach(column => column.classList.remove('drop-target'));
      const target = document.elementsFromPoint(event.clientX, event.clientY).find(element => element.classList?.contains('pipeline-column'));
      target?.classList.add('drop-target');
    });

    card.addEventListener('pointerup', async event => {
      if (!card.hasPointerCapture(event.pointerId)) return;
      card.releasePointerCapture(event.pointerId);
      const target = document.elementsFromPoint(event.clientX, event.clientY).find(element => element.classList?.contains('pipeline-column'));
      card.classList.remove('dragging');
      card.style.transform = '';
      document.querySelectorAll('.pipeline-column').forEach(column => column.classList.remove('drop-target'));
      if (dragging && target) await moveProspect(card.dataset.leadId, target.dataset.stage);
    });

    card.addEventListener('pointercancel', () => {
      card.classList.remove('dragging');
      card.style.transform = '';
      document.querySelectorAll('.pipeline-column').forEach(column => column.classList.remove('drop-target'));
    });
  });
}

function bindMobileSwipe() {
  document.querySelectorAll('[data-swipe-card]').forEach(card => {
    let startX = 0;
    let deltaX = 0;
    card.addEventListener('pointerdown', event => { if (event.target.closest('button')) return; startX = event.clientX; deltaX = 0; card.setPointerCapture(event.pointerId); card.classList.add('swiping'); });
    card.addEventListener('pointermove', event => { if (!card.classList.contains('swiping')) return; deltaX = event.clientX - startX; card.style.transform = `translateX(${Math.max(-110, Math.min(110, deltaX))}px)`; });
    card.addEventListener('pointerup', async event => {
      if (!card.classList.contains('swiping')) return;
      card.releasePointerCapture(event.pointerId);
      card.classList.remove('swiping');
      card.style.transform = '';
      if (Math.abs(deltaX) >= 70) await moveRelative(card.dataset.leadId, deltaX > 0 ? 1 : -1);
    });
    card.addEventListener('pointercancel', () => { card.classList.remove('swiping'); card.style.transform = ''; });
  });
}

function icsEscape(value = '') {
  return String(value).replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n');
}

function exportCalendarMonth() {
  const cursor = state.calendarCursor;
  const monthEntries = calendarEntries().filter(entry => {
    const date = new Date(`${entry.date}T12:00:00`);
    return date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth();
  });
  if (!monthEntries.length) {
    showToast('Este mes no tiene eventos para exportar.');
    return;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MINA//CRM compartido//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  monthEntries.forEach(entry => {
    const prospect = entry.prospect;
    lines.push('BEGIN:VEVENT', `UID:${icsEscape(`${prospect.id}-${entry.type}@mina-crm`)}`, `DTSTAMP:${stamp}`);
    if (entry.type === 'appointment') {
      const start = new Date(prospect.appointmentAt);
      const end = new Date(start.getTime() + 30 * 60000);
      lines.push(`DTSTART;TZID=America/Mexico_City:${localCompactDateTime(start)}`, `DTEND;TZID=America/Mexico_City:${localCompactDateTime(end)}`);
    } else {
      const start = new Date(`${entry.date}T12:00:00`);
      lines.push(`DTSTART;VALUE=DATE:${entry.date.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${dateInputValue(addDays(start, 1)).replaceAll('-', '')}`);
    }
    lines.push(
      `SUMMARY:${icsEscape(entry.title)}`,
      `DESCRIPTION:${icsEscape(`${prospect.nextAction || 'Seguimiento patrimonial'}\nResponsable: ${prospect.owner}\nRegistrado en MINA CRM`)}`,
      `LOCATION:${icsEscape(prospect.location || prospect.organization || '')}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `MINA-${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}.ics`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${monthEntries.length} eventos listos para tu calendario.`);
}

function bindViewEvents() {
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-open-capture]').forEach(button => button.addEventListener('click', openProspectDialog));
  document.querySelectorAll('[data-dashboard-filter]').forEach(button => button.addEventListener('click', () => {
    state.pipelineFilter = button.dataset.dashboardFilter;
    setView('pipeline');
  }));
  document.querySelectorAll('[data-pipeline-filter]').forEach(button => button.addEventListener('click', () => {
    state.pipelineFilter = button.dataset.pipelineFilter;
    render();
  }));
  document.querySelectorAll('[data-focus-prospect]').forEach(button => button.addEventListener('click', () => openEditDialog(button.dataset.focusProspect)));
  document.querySelectorAll('[data-calendar-nav]').forEach(button => button.addEventListener('click', () => {
    const direction = button.dataset.calendarNav;
    if (direction === 'today') {
      const today = new Date();
      state.calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
      state.calendarSelected = dateInputValue(today);
    } else {
      const delta = direction === 'next' ? 1 : -1;
      state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + delta, 1);
      state.calendarSelected = dateInputValue(state.calendarCursor);
    }
    render();
  }));
  document.querySelectorAll('[data-calendar-select]').forEach(button => button.addEventListener('click', () => {
    state.calendarSelected = button.dataset.calendarSelect;
    const selected = new Date(`${state.calendarSelected}T12:00:00`);
    state.calendarCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
    render();
  }));
  document.querySelectorAll('[data-export-calendar]').forEach(button => button.addEventListener('click', exportCalendarMonth));
  bindEditButtons();
  document.querySelectorAll('[data-mobile-stage]').forEach(button => button.addEventListener('click', () => { state.mobileStage = button.dataset.mobileStage; render(); }));
  document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => openMoveDialog(button.dataset.move)));
  document.querySelectorAll('[data-complete]').forEach(button => button.addEventListener('click', async () => {
    const prospect = state.prospects.find(p => p.id === button.dataset.complete);
    if (!prospect) return;
    await store.update(prospect.id, { completed: !prospect.completed });
    showToast(prospect.completed ? 'Seguimiento reabierto.' : 'Seguimiento completado.');
    await refresh();
  }));
  const search = document.querySelector('#contactSearch');
  if (search) search.addEventListener('input', () => {
    const query = search.value.toLocaleLowerCase('es');
    const filtered = state.prospects.filter(p => [p.name, p.specialty, p.owner, p.source].some(value => value?.toLocaleLowerCase('es').includes(query)));
    document.querySelector('#directoryList').innerHTML = directoryRows(filtered);
    bindDeleteButtons();
    bindEditButtons();
  });
  bindDeleteButtons();
  bindDesktopDrag();
  bindMobileSwipe();
  bindPhotoImages();
}

function bindEditButtons() {
  document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    openEditDialog(button.dataset.edit);
  }));
}

function bindDeleteButtons() {
  document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    const prospect = state.prospects.find(p => p.id === button.dataset.delete);
    if (!prospect || !window.confirm(`¿Eliminar a ${prospect.name}? Esta acción no se puede deshacer.`)) return;
    await store.remove(prospect.id);
    showToast(`${prospect.name} fue eliminado.`);
    await refresh();
  }));
}

async function compressImage(file) {
  if (!file || !file.type.startsWith('image/')) return null;
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
}

document.querySelector('#photoTrigger').addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  try {
    state.photo = await compressImage(file);
    const previewUrl = URL.createObjectURL(state.photo);
    photoPreview.innerHTML = `<img src="${previewUrl}" alt="Vista previa de la tarjeta">`;
    state.objectUrls.push(previewUrl);
  } catch {
    showToast('No fue posible preparar esta foto. Intenta tomarla nuevamente.');
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const dueDateValue = document.querySelector('#dueDateInput').value;
  const prospect = {
    name: document.querySelector('#nameInput').value.trim(),
    specialty: document.querySelector('#specialtyInput').value.trim(),
    organization: document.querySelector('#organizationInput').value.trim(),
    source: document.querySelector('#sourceInput').value,
    owner: document.querySelector('#ownerInput').value,
    phone: document.querySelector('#phoneInput').value.trim(),
    email: document.querySelector('#emailInput').value.trim(),
    location: document.querySelector('#locationInput').value.trim(),
    nextAction: document.querySelector('#nextActionInput').value.trim(),
    // Noon prevents a date-only value from moving to the previous day when
    // Apps Script converts it through the America/Mexico_City timezone.
    dueDate: dueDateValue ? `${dueDateValue}T12:00:00` : '',
    appointmentAt: document.querySelector('#appointmentInput').value,
    context: document.querySelector('#contextInput').value.trim(),
    stage: document.querySelector('#stageInput').value,
    photo: state.photo,
    photoId: state.photoId
  };
  const editingId = state.editId;
  if (editingId) await store.update(editingId, prospect);
  else await store.save(prospect);
  closeProspectDialog();
  if (!editingId) {
    state.view = 'capture';
    const url = new URL(location.href); url.searchParams.set('view', state.view); history.replaceState({}, '', url);
  }
  showToast(editingId ? `${prospect.name} quedó actualizado.` : `${prospect.name} quedó guardado con su primer seguimiento.`);
  await refresh();
});

document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', closeProspectDialog));
document.querySelectorAll('[data-close-move]').forEach(button => button.addEventListener('click', closeMoveDialog));
prospectDialog.addEventListener('click', event => { if (event.target === prospectDialog) closeProspectDialog(); });
moveDialog.addEventListener('click', event => { if (event.target === moveDialog) closeMoveDialog(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeProspectDialog(); closeMoveDialog(); } });
window.addEventListener('popstate', () => { state.view = new URLSearchParams(location.search).get('view') || 'today'; render(); });
window.addEventListener('unhandledrejection', event => {
  const error = event.reason instanceof Error ? event.reason : new Error('No fue posible completar la operación.');
  event.preventDefault();
  showToast(error.message);
  if (error.code === 'UNAUTHORIZED' || error.code === 'CONNECTION_REQUIRED') {
    clearConnectionSettings();
    openConnectionDialog(error.message);
  }
});

connectionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = connectionForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  connectionError.hidden = true;
  saveConnectionSettings({
    apiKey: document.querySelector('#apiKeyInput').value,
    actor: document.querySelector('#actorInput').value
  });
  try {
    await refresh();
    closeConnectionDialog();
    showToast('CRM conectado con Google Sheets.');
  } catch (error) {
    connectionError.textContent = error.message;
    connectionError.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

render();
const connection = getConnectionSettings();
if (!connection.configured || !connection.apiKey) {
  openConnectionDialog(connection.configured ? '' : 'La dirección de sincronización todavía no está configurada.');
} else {
  try { await refresh(); }
  catch (error) { openConnectionDialog(error.message); }
}
