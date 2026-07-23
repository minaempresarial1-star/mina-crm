import { clearConnectionSettings, createProspectStore, getConnectionSettings, saveConnectionSettings } from './store.js';

const STAGES = ['Por investigar', 'Por contactar', 'Contactado', 'Respondió', 'Reunión', 'Oportunidad', 'Pausado'];

// Biblioteca de recursos (herramientas ya diseñadas). Editar aquí para agregar más.
const RESOURCES = [
  {
    category: 'Prospección en persona',
    items: [
      { title: 'Herramienta de reunión · Médicos', desc: 'Ciclo completo Apertura · Cuaje · Cierre: calculador de fuga patrimonial, checklist de blindaje, plan personalizado y cierre.', url: 'https://alejandrohuante16-jpg.github.io/mario-medicos/medicos.html', tag: 'En vivo' },
      { title: 'Simulador “Dos Actos”', desc: 'Simulador patrimonial general para mostrar en vivo el costo de dejar el dinero estancado.', url: 'https://alejandrohuante16-jpg.github.io/mario-medicos/simulador.html', tag: 'En vivo' }
    ]
  },
  {
    category: 'Para enviar al prospecto',
    items: [
      { title: 'Información de primer contacto (en frío)', desc: 'Página breve para presentar la propuesta a un prospecto que aún no conoces: qué hacemos, cómo trabajamos y quiénes nos regulan. Cierra invitando al simulador base. Se envía como link.', url: 'https://alejandrohuante16-jpg.github.io/mario-medicos/primer-contacto.html', tag: 'En vivo' },
      { title: 'Simulador base · Escenario patrimonial', desc: 'Simulador que el prospecto usa por su cuenta, sin datos personales. Es el destino del botón de la página de primer contacto.', url: 'https://minaempresarial1-star.github.io/escenario-patrimonial-mina/', tag: 'En vivo' },
      { title: 'Página de seguimiento', desc: 'Pieza de seguimiento posterior a una conversación exploratoria; refuerza el interés sin recomendar producto.', url: '', tag: 'En preparación' }
    ]
  },
  {
    category: 'Cierre',
    items: [
      { title: 'Arquitectura Personalizada', desc: 'Presentación de cierre reactiva (OptiMaxx Plus): estrategia, simulación, bono y liquidez. Se personaliza por cliente.', url: '', tag: 'Local' }
    ]
  },
  {
    category: 'Operación del CRM',
    items: [
      { title: 'Guía de uso para Mario', desc: 'Onboarding y operación diaria del CRM, responsive e imprimible.', url: 'https://minaempresarial1-star.github.io/mina-crm/guia-mario.html', tag: 'En vivo' }
    ]
  }
];
let store = createProspectStore();
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
const summaryDialog = document.querySelector('#summaryDialog');

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
  newId: null,
  saving: false,
  moveId: null,
  summaryId: null,
  objectUrls: []
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

// Identificador estable generado en el cliente para que un guardado repetido
// (doble toque, reintento por red lenta) resuelva a la MISMA fila y no duplique.
function newUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const rand = (crypto.getRandomValues(new Uint8Array(1))[0]) % 16;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

// Busca una ficha existente que probablemente sea el mismo contacto,
// por nombre normalizado o por teléfono (>= 7 dígitos).
function findPossibleDuplicate({ name, phone }) {
  const targetName = normalizeName(name);
  const targetPhone = onlyDigits(phone);
  return state.prospects.find(p => {
    if (targetName && normalizeName(p.name) === targetName) return true;
    if (targetPhone.length >= 7 && onlyDigits(p.phone) === targetPhone) return true;
    return false;
  });
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

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

// Modo demo local (solo con ?demo=1): store en memoria con datos de ejemplo,
// para previsualizar la interfaz sin backend ni clave. No afecta producción.
function createDemoStore() {
  const nowIso = () => new Date().toISOString();
  const day = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return dateInputValue(d); };
  const at = (offset, hhmm) => `${day(offset)}T${hhmm}`;
  let data = [
    { id: 'd1', name: 'Dra. Yamel del Castillo', specialty: 'Dermatología', organization: 'Clínica Amore', stage: 'Contactado', source: 'Torre médica', owner: 'Mario', phone: '2213456789', email: 'yamel@example.mx', location: 'Angelópolis', nextAction: 'Enviar simulador y proponer llamada de 15 minutos', dueDate: day(-2), appointmentAt: '', context: 'Interesada; estaba ocupada en consulta.', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 2 },
    { id: 'd2', name: 'Dr. Agustín Gutiérrez', specialty: 'Pediatría y neonatología', organization: 'Torres Médicas', stage: 'Respondió', source: 'Referido', owner: 'Alejandro', phone: '2217654321', email: '', location: 'Puebla', nextAction: 'Confirmar segunda reunión de diagnóstico', dueDate: day(1), appointmentAt: at(1, '17:30'), context: 'Quiere emprender a futuro; ya tiene un seguro.', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 3 },
    { id: 'd3', name: 'Dr. Osiris Melchor', specialty: 'Cardiología', organization: 'Consultorio propio', stage: 'Reunión', source: 'Prospección en frío', owner: 'Mario', phone: '2211112233', email: '', location: 'Angelópolis', nextAction: 'Presentar arquitectura personalizada y cerrar arranque', dueDate: day(2), appointmentAt: at(2, '10:00'), context: 'Quiere empezar con poco; prioriza liquidez.', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 1 },
    { id: 'd4', name: 'Dr. Alberto Pulido', specialty: 'Traumatología', organization: 'Clínica Amore', stage: 'Por contactar', source: 'Torre médica', owner: 'Mario', phone: '2214445566', email: '', location: 'Puebla', nextAction: 'Enviar mensaje que despierte interés por WhatsApp', dueDate: day(0), appointmentAt: '', context: 'Pidió información; falta mensaje que genere cita.', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 1 },
    { id: 'd5', name: 'Dr. Gustavo Minutti', specialty: 'Gastroenterología', organization: 'Consultorio propio', stage: 'Pausado', source: 'Referido', owner: 'Alejandro', phone: '', email: '', location: 'Puebla', nextAction: 'Revisar en 60 días con contenido de valor', dueDate: day(58), appointmentAt: '', context: 'Interés alto, urgencia baja; invierte en su consultorio.', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 4 },
    { id: 'd6', name: 'Dra. Ana Luzuriaga', specialty: 'Ginecología', organization: 'Hospital Ángeles', stage: 'Por investigar', source: 'Prospección en frío', owner: 'Alejandro', phone: '', email: '', location: 'Angelópolis', nextAction: 'Investigar perfil y preparar acercamiento', dueDate: day(0), appointmentAt: '', context: '', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 1 },
    { id: 'd7', name: 'Dr. Tomás Herrera Arzola', specialty: 'Cardiología', organization: 'Torres Médicas', stage: 'Oportunidad', source: 'Referido', owner: 'Mario', phone: '2219998877', email: 'herrera@example.mx', location: 'Angelópolis', nextAction: 'Preparar comparativo de escenarios patrimoniales', dueDate: day(-1), appointmentAt: '', context: 'Ticket alto; analítico y ocupado.', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 5 },
    { id: 'd8', name: 'Dr. Romero Galicia', specialty: 'Medicina interna', organization: 'Consultorio propio', stage: 'Por contactar', source: 'Referido', owner: 'Alejandro', phone: '2213334455', email: '', location: 'Puebla', nextAction: 'Proponer café de 20 minutos', dueDate: day(3), appointmentAt: '', context: 'Entrada más fácil; pidió fondo educativo.', completed: false, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 1 },
    { id: 'd9', name: 'Dra. Sofía Prieto', specialty: 'Endocrinología', organization: 'Hospital Ángeles', stage: 'Contactado', source: 'Torre médica', owner: 'Mario', phone: '2216667788', email: '', location: 'Angelópolis', nextAction: 'Primer contacto realizado', dueDate: day(-5), appointmentAt: '', context: 'Seguimiento cerrado por ahora.', completed: true, photoId: '', createdAt: nowIso(), updatedAt: nowIso(), version: 2 }
  ];
  const clone = () => data.map(p => ({ ...p }));
  return {
    async all() { return clone(); },
    async save(prospect) {
      const rec = { ...prospect }; delete rec.photo;
      const i = data.findIndex(x => x.id === rec.id);
      if (i >= 0) { rec.createdAt = data[i].createdAt; rec.updatedAt = nowIso(); rec.version = (data[i].version || 0) + 1; rec.completed = Boolean(rec.completed); data[i] = rec; }
      else { rec.id = rec.id || 'demo-' + Date.now(); rec.createdAt = nowIso(); rec.updatedAt = nowIso(); rec.version = 1; rec.completed = Boolean(rec.completed); data.push(rec); }
      return { ...rec };
    },
    async update(id, changes) { const cur = data.find(x => x.id === id); if (!cur) throw new Error('Prospecto no encontrado'); return this.save({ ...cur, ...changes, id }); },
    async remove(id) { data = data.filter(x => x.id !== id); return id; },
    async photo() { return null; }
  };
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
  // allowCache: en campo (torre médica sin señal) muestra el último snapshot
  // guardado en vez de fallar. El store solo usa caché ante errores de red,
  // nunca ante errores de autenticación.
  state.prospects = await store.all({ allowCache: true });
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
    ['contacts', '♙', 'Contactos'],
    ['resources', '▤', 'Recursos']
  ];
  return `<aside class="sidebar">
    <div class="brand"><span class="brand__mark">◇</span><span><strong>MINA</strong><small>Operación patrimonial</small></span></div>
    <nav class="nav" aria-label="Principal">${items.map(([view, icon, label]) => `<button data-view="${view}" class="${state.view === view ? 'active' : ''}"><span class="nav__icon">${icon}</span>${label}</button>`).join('')}</nav>
    <div class="team-card"><p class="eyebrow" style="color:#f59e0b">Equipo activo</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><div class="avatars"><span class="avatar">AH</span><span class="avatar mario">MA</span></div><span class="micro" style="color:#aeb6ca">2 responsables</span></div><span class="sync-status"${navigator.onLine ? '' : ' style="color:var(--amber)"'}>${navigator.onLine ? 'Google Sheets sincronizado' : 'Sin conexión · datos guardados'}</span></div>
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
    ${item('resources', '▤', 'Recursos')}
  </nav>`;
}

function emptyState(title, body, action = true) {
  return `<div class="empty"><strong>${title}</strong><p class="muted micro">${body}</p>${action ? '<button class="button button--primary" data-open-capture>Capturar primera tarjeta</button>' : ''}</div>`;
}

function todayView() {
  const active = state.prospects.filter(p => !p.completed).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const overdue = active.filter(isOverdue).length;
  // Debe coincidir con el filtro 'uncontacted' que abre este stat (etapas 0 y 1),
  // no solo 'Por investigar'; antes el número no cuadraba con el tablero filtrado.
  const unactivated = active.filter(isUncontacted).length;
  const tasks = active.slice(0, 8);
  return `<main class="page">
    <header class="page-header"><div><p class="eyebrow">Operación compartida</p><h1>Cada contacto necesita<br><span>un siguiente paso.</span></h1></div><div class="header-actions"><button class="button button--primary" data-open-capture>＋ Capturar tarjeta</button></div></header>
    <section class="stats" aria-label="Filtros rápidos"><button class="stat" data-dashboard-filter="overdue"><span>Vencidos</span><strong>${overdue}</strong><small>Seguimientos con fecha ya pasada</small></button><button class="stat" data-dashboard-filter="uncontacted"><span>Sin contactar</span><strong>${unactivated}</strong><small>Aún sin primer acercamiento</small></button><button class="stat" data-dashboard-filter="all"><span>En seguimiento</span><strong>${active.length}</strong><small>Relaciones activas en el pipeline</small></button></section>
    <div class="content-grid"><section><div class="section-head"><div><p class="eyebrow">Agenda compartida</p><h2>Próximas acciones</h2></div></div>
      <div class="task-list">${tasks.length ? tasks.map((p, index) => `<article class="task is-clickable ${isOverdue(p) ? 'overdue' : ''}" data-summary="${p.id}"><span class="task__number">${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(p.nextAction)}</h3><p>${escapeHtml(p.name)} · ${escapeHtml(p.specialty)} · ${escapeHtml(p.owner)} · ${formatDate(p.dueDate)}</p></div><button class="task__complete" data-complete="${p.id}" aria-label="Completar seguimiento">✓</button></article>`).join('') : emptyState('La agenda está vacía', 'Captura una tarjeta para crear el primer seguimiento.')}</div>
    </section><aside><div class="focus-panel"><p class="eyebrow" style="color:#f59e0b">Siguiente mejor acción</p><h3>${active.length ? escapeHtml(active[0].nextAction) : 'Registrar lo obtenido en campo'}</h3><p>${active.length ? `${escapeHtml(active[0].name)} · ${escapeHtml(active[0].owner)} · ${formatDate(active[0].dueDate)}. Abre su ficha para trabajar esta acción y dejar el seguimiento actualizado.` : 'Cada tarjeta puede convertirse inmediatamente en responsable, contexto y fecha.'}</p>${active.length ? `<button class="button button--amber" data-focus-prospect="${active[0].id}">Atender seguimiento de ${escapeHtml(active[0].name)}</button>` : '<button class="button button--amber" data-open-capture>Registrar una tarjeta</button>'}</div></aside></div>
  </main>`;
}

function leadCard(prospect, { mobile = false } = {}) {
  const overdue = isOverdue(prospect);
  return `<article class="lead-card is-clickable ${overdue ? 'stale' : ''}" data-lead-id="${prospect.id}" data-summary="${prospect.id}" ${mobile ? 'data-swipe-card' : 'data-desktop-drag'}>
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
    ['all', 'En seguimiento', active.length, 'Todo el pipeline activo'],
    ['uncontacted', 'Sin contactar', active.filter(isUncontacted).length, 'Sin primer acercamiento'],
    ['overdue', 'Vencidos', active.filter(isOverdue).length, 'Fecha ya pasó']
  ];
  return `<main class="page">
    <header class="page-header"><div><p class="eyebrow">MINA · Operación patrimonial</p><h1 style="font-size:34px">Pipeline ejecutivo</h1></div><div class="header-actions"><button class="button button--primary" data-open-capture>＋ Capturar tarjeta</button></div></header>
    <section class="pipeline-hero"><div><p class="eyebrow" style="color:#f59e0b">Seguimiento comercial</p><h1>De contacto en contacto,<br><span>ningún compromiso se pierde.</span></h1></div>${metrics.map(([key, label, count, desc]) => `<button class="pipeline-metric ${state.pipelineFilter === key ? 'active' : ''}" data-pipeline-filter="${key}" aria-pressed="${state.pipelineFilter === key}"><span class="micro">${label}</span><strong>${count}</strong><small>${desc}</small></button>`).join('')}</section>
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
      <div class="day-agenda__list">${selectedEntries.length ? selectedEntries.map(entry => `<article class="agenda-event"><span class="agenda-event__rail ${entry.type}"></span><div><span class="micro muted">${entry.type === 'appointment' ? `${calendarTimeLabel(entry)} · Cita confirmada` : `Todo el día · Seguimiento`}</span><h3>${escapeHtml(entry.prospect.name)}</h3><p>${escapeHtml(entry.prospect.nextAction)} · ${escapeHtml(entry.prospect.owner)}</p></div><div class="agenda-event__actions"><a class="button button--google" href="${escapeHtml(googleCalendarUrl(entry))}" target="_blank" rel="noopener">Añadir a Google Calendar</a><button class="button button--quiet" data-edit="${entry.prospect.id}">Editar seguimiento</button></div></article>`).join('') : `<div class="empty"><strong>No hay eventos este día</strong><p class="muted micro">Selecciona otro día o crea un seguimiento con fecha.</p><button class="button button--primary" data-open-capture>Crear seguimiento</button></div>`}</div>
    </section>
  </main>`;
}

function contactsView() {
  return `<main class="page"><header class="page-header"><div><p class="eyebrow">Directorio</p><h1 style="font-size:45px">Todas las relaciones,<br><span>un solo historial.</span></h1></div><button class="button button--primary" data-open-capture>＋ Capturar</button></header><section class="directory"><input class="search" id="contactSearch" type="search" placeholder="Buscar por nombre, especialidad o responsable"><div class="directory-list" id="directoryList">${directoryRows(state.prospects)}</div></section></main>`;
}

function directoryRows(prospects) {
  return prospects.length ? prospects.map(p => `<article class="directory-row is-clickable" data-summary="${p.id}"><div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.specialty)}${p.organization ? ` · ${escapeHtml(p.organization)}` : ''} · ${escapeHtml(p.source)}${p.phone ? ` · ${escapeHtml(p.phone)}` : ''}</p></div><span class="pill">${escapeHtml(p.stage)}</span><div style="display:flex;gap:8px;align-items:center"><button class="button button--quiet micro" data-edit="${p.id}" aria-label="Editar ${escapeHtml(p.name)}">Editar</button>${avatar(p.owner)}<button class="delete-button" data-delete="${p.id}" aria-label="Eliminar ${escapeHtml(p.name)}">×</button></div></article>`).join('') : emptyState('No hay contactos todavía', 'La primera tarjeta que captures aparecerá aquí.');
}

function resourceCard(item) {
  const live = Boolean(item.url);
  return `<article class="resource-card ${live ? '' : 'is-soon'}">
    <div class="resource-card__top"><h3>${escapeHtml(item.title)}</h3><span class="resource-tag ${live ? '' : 'resource-tag--soft'}">${escapeHtml(item.tag)}</span></div>
    <p>${escapeHtml(item.desc)}</p>
    ${live
      ? `<a class="button button--primary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Abrir ↗</a>`
      : `<span class="resource-card__soon">En preparación</span>`}
  </article>`;
}

function resourcesView() {
  return `<main class="page">
    <header class="page-header"><div><p class="eyebrow">Recursos</p><h1>Todo el material,<br><span>en un solo lugar.</span></h1></div></header>
    <div class="resources">
      ${RESOURCES.map(group => `<section class="resource-group"><h2 class="resource-group__title">${escapeHtml(group.category)}</h2><div class="resource-grid">${group.items.map(resourceCard).join('')}</div></section>`).join('')}
    </div>
  </main>`;
}

function render() {
  revokeObjectUrls();
  const views = { today: todayView, pipeline: pipelineView, capture: captureView, calendar: calendarView, contacts: contactsView, resources: resourcesView };
  const view = views[state.view] || todayView;
  app.innerHTML = `<div class="shell">${sidebar()}${view()}</div>${mobileNav()}`;
  bindViewEvents();
}

function openProspectDialog() {
  state.photo = null;
  state.photoId = null;
  state.editId = null;
  state.newId = newUuid();
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
  state.newId = null;
}

function openSummaryDialog(id) {
  const p = state.prospects.find(x => x.id === id);
  if (!p) return;
  state.summaryId = id;
  const overdue = isOverdue(p);
  document.querySelector('#summaryName').textContent = p.name;
  document.querySelector('#summaryEyebrow').textContent = `${p.specialty || 'Sin especialidad'}${p.organization ? ' · ' + p.organization : ''}`;
  const rows = [
    ['Etapa', `<span class="pill">${escapeHtml(p.stage)}</span>`],
    ['Responsable', escapeHtml(p.owner || '—')],
    ['Origen', escapeHtml(p.source || '—')],
    ['Ubicación', escapeHtml(p.location || '—')],
    ['Teléfono', p.phone ? `<a href="tel:${escapeHtml(onlyDigits(p.phone))}">${escapeHtml(p.phone)}</a>` : '—'],
    ['Correo', p.email ? `<a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a>` : '—'],
    ['Cita confirmada', p.appointmentAt ? escapeHtml(formatDateTime(p.appointmentAt)) : '—'],
    ['Última actualización', p.updatedAt ? escapeHtml(formatDateTime(p.updatedAt)) : '—']
  ];
  document.querySelector('#summaryBody').innerHTML = `
    <div class="summary-hero ${overdue ? 'overdue' : ''}">
      <span class="summary-hero__label">${overdue ? 'Acción vencida' : 'Siguiente acción'} · ${formatDate(p.dueDate)}</span>
      <strong>${escapeHtml(p.nextAction || 'Sin acción definida')}</strong>
    </div>
    <dl class="summary-grid">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${p.context ? `<div class="summary-context"><span class="micro muted">Contexto de campo</span><p>${escapeHtml(p.context)}</p></div>` : ''}
  `;
  document.querySelector('#summaryActions').innerHTML = `
    <button class="button button--quiet" data-summary-complete="${p.id}">${p.completed ? 'Reabrir seguimiento' : 'Marcar como completado'}</button>
    <button class="button button--quiet" data-summary-move="${p.id}">Mover de etapa</button>
    <button class="button button--primary" data-summary-edit="${p.id}">Editar ficha</button>
  `;
  bindSummaryActions();
  summaryDialog.hidden = false;
}

function bindSummaryActions() {
  const editBtn = summaryDialog.querySelector('[data-summary-edit]');
  if (editBtn) editBtn.onclick = () => { const id = editBtn.dataset.summaryEdit; closeSummaryDialog(); openEditDialog(id); };
  const moveBtn = summaryDialog.querySelector('[data-summary-move]');
  if (moveBtn) moveBtn.onclick = () => { const id = moveBtn.dataset.summaryMove; closeSummaryDialog(); openMoveDialog(id); };
  const doneBtn = summaryDialog.querySelector('[data-summary-complete]');
  if (doneBtn) doneBtn.onclick = async () => {
    const p = state.prospects.find(x => x.id === doneBtn.dataset.summaryComplete);
    if (!p) return;
    closeSummaryDialog();
    await store.update(p.id, { completed: !p.completed });
    showToast(p.completed ? 'Seguimiento reabierto.' : 'Seguimiento completado.');
    await refresh();
  };
}

function closeSummaryDialog() {
  summaryDialog.hidden = true;
  state.summaryId = null;
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
  document.querySelectorAll('[data-summary]').forEach(el => el.addEventListener('click', event => {
    if (event.target.closest('button, a, input, textarea, select, .drag-hint')) return;
    openSummaryDialog(el.dataset.summary);
  }));
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

  // Aviso de posible duplicado al crear (no al editar).
  if (!editingId) {
    const existing = findPossibleDuplicate(prospect);
    if (existing && !window.confirm(`Ya existe una ficha de "${existing.name}" (${existing.stage}). ¿Registrar de todos modos como ficha nueva?`)) {
      return;
    }
  }

  const saveButton = document.querySelector('#saveProspectButton');
  const originalLabel = saveButton.textContent;
  state.saving = true;
  saveButton.disabled = true;
  saveButton.textContent = 'Guardando…';
  try {
    // El id estable (state.newId) hace idempotente el guardado: un doble envío
    // resuelve a la misma fila y el backend actualiza en vez de duplicar.
    if (editingId) await store.update(editingId, prospect);
    else await store.save({ ...prospect, id: state.newId });
    closeProspectDialog();
    if (!editingId) {
      state.view = 'capture';
      const url = new URL(location.href); url.searchParams.set('view', state.view); history.replaceState({}, '', url);
    }
    showToast(editingId ? `${prospect.name} quedó actualizado.` : `${prospect.name} quedó guardado con su primer seguimiento.`);
    await refresh();
  } finally {
    state.saving = false;
    saveButton.disabled = false;
    saveButton.textContent = originalLabel;
  }
});

document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', closeProspectDialog));
document.querySelectorAll('[data-close-move]').forEach(button => button.addEventListener('click', closeMoveDialog));
document.querySelectorAll('[data-close-summary]').forEach(button => button.addEventListener('click', closeSummaryDialog));
prospectDialog.addEventListener('click', event => { if (event.target === prospectDialog) closeProspectDialog(); });
moveDialog.addEventListener('click', event => { if (event.target === moveDialog) closeMoveDialog(); });
summaryDialog.addEventListener('click', event => { if (event.target === summaryDialog) closeSummaryDialog(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeProspectDialog(); closeMoveDialog(); closeSummaryDialog(); } });
window.addEventListener('popstate', () => { state.view = new URLSearchParams(location.search).get('view') || 'today'; render(); });
window.addEventListener('online', () => render());
window.addEventListener('offline', () => render());
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

const DEMO_MODE = new URLSearchParams(location.search).get('demo') === '1';
if (DEMO_MODE) store = createDemoStore();

render();
if (DEMO_MODE) {
  await refresh();
} else {
  const connection = getConnectionSettings();
  if (!connection.configured || !connection.apiKey) {
    openConnectionDialog(connection.configured ? '' : 'La dirección de sincronización todavía no está configurada.');
  } else {
    try { await refresh(); }
    catch (error) { openConnectionDialog(error.message); }
  }
}
