const icon = (name, size = 20) => {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.8L3 21l1.8-4.5A8.5 8.5 0 1 1 21 11.5Z"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.6 1.4c-.8 1.1-2.2 1.3-2.2 3M12 17h.01"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H8.5a2.5 2.5 0 1 1 2.5-2.5V8Zm0 0h3.5A2.5 2.5 0 1 0 13 5.5V8Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};


const state = {
  tab: 'home', modal: null, query: '', user: null, connections: [], events: [],
  loading: false, archiveLoading: false, apiError: '', telegram: window.Telegram?.WebApp || null,
  authenticated: false, preview: !window.Telegram?.WebApp?.initData
};
const app = document.querySelector('#root');


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


function racer(small = false) {
  const image = small ? './assets/mcqueen-cutout.png' : './assets/spy-chau-happy-clean.png';
  return `<div class="racer ${small ? 'racer-small' : ''}" aria-hidden="true"><img src="${image}" alt="" /></div>`;
}


function displayName() {
  return state.user?.first_name || state.user?.username || 'Гонщик';
}


function topbar() {
  return `<header class="topbar"><div class="brand-mark"><span>SC</span><i></i></div><div class="brand-copy"><strong>SpyChau</strong><span>Привет, ${escapeHtml(displayName())}</span></div><button class="icon-button" aria-label="О приложении" data-action="about">${icon('help', 19)}</button><button class="icon-button sun-button" aria-label="Безопасность и данные" data-action="privacy">${icon('shield', 19)}</button></header>`;
}


function statusLabel() {
  if (state.preview) return ['Предпросмотр приложения', 'preview'];
  if (state.loading) return ['Загружаем аккаунт…', 'loading'];
  if (state.apiError) return ['Не удалось загрузить данные', 'error'];
  if (state.connections.some(connection => Number(connection.enabled) === 1)) return ['Подключение активно', 'active'];
  return ['Аккаунт пока не подключён', 'inactive'];
}


function connectCard() {
  const activeCount = state.connections.filter(connection => Number(connection.enabled) === 1).length;
  const count = activeCount ? '1 из 2' : '0 из 2';
  return `<div class="connect-card"><div class="connect-card-heading"><strong>Подключения</strong><span class="count-badge" style="border:0;background:none;padding:0;color:var(--muted)">${count}</span></div><div class="connect-row"><div class="service-icon blue">${icon('chat', 20)}</div><div class="row-copy"><strong>Личные чаты</strong><span>${activeCount ? 'Подключение активно' : state.preview ? 'Открой приложение через Telegram' : 'Подключение настраивается позже'}</span></div><button class="button button-blue button-compact" data-action="connect">${state.preview ? 'Открыть в Telegram' : 'Подробнее'} ${icon('chevron', 15)}</button></div><div class="divider"></div><div class="connect-row"><div class="service-icon purple">${icon('people', 20)}</div><div class="row-copy"><strong>Группы</strong><span>Пока не подключены</span></div><button class="button button-blue button-compact" data-action="groups">Подробнее ${icon('chevron', 15)}</button></div></div>`;
}


function eventTitle(event) {
  if (event.event_type === 'deleted') return 'Сообщение удалено';
  if (event.event_type === 'edited') return 'Сообщение изменено';
  return 'Новое сообщение';
}


function eventDescription(event) {
  const message = event.message || {};
  if (message.text) return message.text;
  if (message.caption) return message.caption;
  if (message.photo) return 'Фото';
  if (message.video) return 'Видео';
  if (message.voice) return 'Голосовое сообщение';
  if (message.video_note) return 'Видеосообщение';
  if (message.document) return 'Файл';
  if (event.event_type === 'deleted') return `ID сообщения: ${event.message_id || '—'}`;
  return 'Содержимое события получено от Telegram';
}


function formatDate(value) {
  if (!value) return 'Дата неизвестна';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}


function eventCard(event) {
  const type = event.event_type === 'deleted' ? 'deleted' : event.event_type === 'edited' ? 'edited' : 'new';
  return `<article class="event-row"><div class="event-type-icon ${type}">${icon(event.event_type === 'deleted' ? 'close' : event.message?.voice ? 'mic' : event.message?.photo ? 'image' : 'chat', 18)}</div><div class="event-copy"><div class="event-title-line"><strong>${escapeHtml(eventTitle(event))}</strong><time>${escapeHtml(formatDate(event.created_at))}</time></div><span>${escapeHtml(eventDescription(event))}</span><small>Чат ${escapeHtml(event.chat_id || '—')} · сообщение ${escapeHtml(event.message_id || '—')}</small></div></article>`;
}


function home() {
  const latest = state.events.slice(0, 3);
  return `<section class="page home-page"><div class="hero-card"><div class="hero-copy"><h1>${state.preview ? 'Твоя история<br>под контролем' : state.connections.some(c => Number(c.enabled) === 1) ? 'Архив уже<br>на связи' : 'Сохраняй<br>важное'}</h1><p>${state.preview ? 'Открой SpyChau внутри Telegram, чтобы увидеть свой профиль и данные.' : 'События доступны только из подключённых тобой чатов и только с момента подключения.'}</p><button class="button button-light" data-action="${state.preview ? 'telegram' : 'connect'}">${state.preview ? 'Как открыть в Telegram' : 'О подключении'} ${icon('chevron', 16)}</button></div>${racer()}<div class="hero-orbit orbit-a"></div><div class="hero-orbit orbit-b"></div></div>${connectCard()}<div class="section-heading event-heading"><div><h2>Что происходило</h2><p>Последние события в архиве</p></div><button class="text-button" data-tab="archive">Весь архив ${icon('chevron', 17)}</button></div>${state.loading ? `<div class="empty-events"><div class="loading-indicator"></div><strong>Загружаем архив</strong><p>Получаем состояние аккаунта.</p></div>` : latest.length ? `<div class="events-list">${latest.map(eventCard).join('')}</div> `<div class="events-list">${latest.map(eventCard).join('')}</div>` : `<div class="empty-events"><div class="empty-art"><div class="magnifier">${icon('search', 25)}</div>${racer(true)}</div><strong>${state.preview ? 'Предпросмотр интерфейса' : 'Пока тихо на трассе'}</strong><p>${state.preview ? 'Для личных данных открой Mini App из Telegram.' : state.apiError ? 'Обнови приложение и попробуй снова.' : 'Когда появятся события из подключённых чатов, они отобразятся здесь.'}</p>${state.apiError ? `<button class="subtle-button" data-action="refresh">${icon('arrow', 15)} Повторить загрузку</button>` : ''}</div>`}<div class="trust-note">${icon('shield', 17)}<span>Доступ и выбранные чаты контролируешь ты.</span></div></section>`;
}


function services() {
  const activeCount = state.connections.filter(connection => Number(connection.enabled) === 1).length;
  return `<section class="page services-page"><div class="page-title"><span class="eyebrow">ТВОЙ НАБОР ИНСТРУМЕНТОВ</span><h1>Сервисы</h1><p>Функции SpyChau и состояние подключения</p></div><div class="service-card featured-service"><div class="service-card-top"><div class="service-icon blue large">${icon('chat', 24)}</div><div><h2>Личные чаты</h2><p>Архив событий из чатов, которые ты разрешил подключённому Telegram Business боту.</p></div></div><div class="service-card-bottom"><span class="green-label">${icon('check', 15)} ${state.preview ? 'Доступно после запуска в Telegram' : `${activeCount} активных подключений`}</span><button class="button button-blue" data-action="connect">${state.preview ? 'О подключении' : 'Настройка'} ${icon('chevron', 16)}</button></div><div class="card-glow"></div></div><div class="service-card"><div class="service-card-top"><div class="service-icon purple large">${icon('people', 24)}</div><div><h2>Группы</h2><p>Отдельный режим для групповых чатов. Пока не подключён.</p></div></div><div class="service-card-bottom"><span class="muted-price">Будет добавлен отдельно</span><button class="button button-purple" data-action="groups">Подробнее ${icon('chevron', 16)}</button></div></div><div class="service-card archive-service"><div class="service-card-top"><div class="service-icon cyan large">${icon('archive', 24)}</div><div><h2>Архив событий</h2><p>Список новых, изменённых и удалённых сообщений, полученных после подключения.</p></div></div><div class="service-card-bottom"><span class="lock-label">${icon('clock', 14)} ${state.preview ? 'Открой через Telegram' : `${state.events.length} событий загружено`}</span><button class="button button-blue" data-tab="archive">Открыть архив ${icon('chevron', 16)}</button></div></div><div class="coming-card"><span class="coming-label">ПОЗЖЕ</span><div class="coming-content"><div><h2>Дополнительные возможности</h2><p>${icon('spark', 14)} Поиск и фильтры архива</p><p>${icon('spark', 14)} Настройки хранения и экспорт</p><p>${icon('spark', 14)} Управление профилем</p></div>${racer(true)}</div></div></section>`;
}


function archive() {
  const filtered = state.events.filter(event => {
    const text = `${eventTitle(event)} ${eventDescription(event)} ${event.chat_id} ${event.message_id}`.toLowerCase();
    return text.includes(state.query.toLowerCase());
  });
  return `<section class="page archive-page"><div class="page-title archive-title"><span class="eyebrow">ИСТОРИЯ ПОДКЛЮЧЁННЫХ ЧАТОВ</span><h1>Архив</h1><p>События, которые Telegram передал после подключения.</p></div><label class="search-field">${icon('search', 17)}<input id="archive-search" value="${escapeHtml(state.query)}" placeholder="Чат, текст или ID сообщения" autocomplete="off"></label>${state.archiveLoading ? `<div class="archive-state"><div class="loading-indicator"></div><strong>Загружаем архив…</strong></div>` : filtered.length ? `<div class="archive-summary"><span>${filtered.length} ${plural(filtered.length, 'событие', 'события', 'событий')}</span><button class="text-button" data-action="refresh-archive">Обновить ${icon('arrow', 15)}</button></div><div class="events-list archive-list">${filtered.map(eventCard).join('')}</div>` : `<div class="archive-state">${icon(state.preview ? 'lock' : 'archive', 24)}<strong>${state.query ? 'Ничего не найдено' : state.preview ? 'Открой приложение в Telegram' : 'Событий пока нет'}</strong><p>${state.query ? 'Измени запрос или очисти строку поиска.' : state.preview ? 'Личный архив доступен после входа через Telegram Mini App.' : state.apiError ? 'Не удалось получить данные. Попробуй обновить страницу.' : 'Новые события появятся здесь, если Telegram передаст их подключённому боту.'}</p>${state.apiError && !state.preview ? `<button class="subtle-button" data-action="refresh-archive">Повторить</button>` : ''}</div>`}<div class="archive-disclaimer">${icon('shield', 16)}<span>SpyChau не может восстановить данные, которые Telegram не передал боту. Секретные чаты не поддерживаются.</span></div></section>`;
}


function plural(number, one, few, many) {
  const n = Math.abs(number) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return many;
  if (last > 1 && last < 5) return few;
  return last === 1 ? one : many;
}


function profile() {
  const user = state.user;
  const activeCount = state.connections.filter(connection => Number(connection.enabled) === 1).length;
  const title = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Пользователь Telegram' : 'Предпросмотр';
  const secondary = user?.username ? `@${user.username}` : 'Аккаунт Telegram';
  const telegramId = state.authenticated && user?.id ? String(user.id) : null;
  const photoUrl = state.authenticated && typeof user?.photo_url === 'string' && /^https:\/\//i.test(user.photo_url) ? user.photo_url : null;
  return `<section class="page profile-page"><div class="profile-intro"><div class="avatar">${escapeHtml(title.slice(0, 1).toUpperCase())}${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="${state.authenticated ? '' : 'offline'}"></span></div><h1>${escapeHtml(title)}</h1><div class="profile-account-line" style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin-top:5px"><span>${escapeHtml(secondary)}</span><span class="profile-telegram-id" style="color:#d9b890">ID: ${telegramId ? escapeHtml(telegramId) : 'не подтверждён'}</span></div></div><span class="list-label">ТВОЙ АККАУНТ</span><div class="profile-card"><button class="profile-row" data-tab="services"><span class="service-icon blue">${icon('chat', 19)}</span><span class="row-copy"><strong>Мои подключения</strong><small>${state.preview ? 'Вход через Telegram не выполнен' : `${activeCount} активных · ${state.connections.length} всего`}</small></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="archive"><span class="service-icon cyan">${icon('archive', 19)}</span><span class="row-copy"><strong>Архив событий</strong><small>${state.preview ? 'Открой приложение через Telegram' : `${state.events.length} последних событий`}</small></span>${icon('chevron', 18)}</button><button class="profile-row" data-action="privacy"><span class="service-icon green">${icon('shield', 19)}</span><span class="row-copy"><strong>Безопасность и данные</strong><small>Доступ и ограничения Telegram</small></span>${icon('chevron', 18)}</button></div><span class="list-label">СЕРВИС И ПОДДЕРЖКА</span><div class="profile-card"><button class="profile-row" data-action="support"><span class="service-icon blue">${icon('help', 19)}</span><span class="row-copy"><strong>Поддержка</strong><small>Контакт поддержки добавим перед запуском</small></span>${icon('chevron', 18)}</button><button class="profile-row" data-action="delete-data"><span class="service-icon muted">${icon('close', 19)}</span><span class="row-copy"><strong>Удалить мои данные</strong><small>Очистить профиль и события из архива</small></span>${icon('chevron', 18)}</button></div><div class="profile-footer"><span>SpyChau · ранняя версия</span><span>Данные привязаны к твоему Telegram ID</span></div></section>`;
}


function nav() {
  const items = [['home', 'home', 'Главная'], ['services', 'grid', 'Сервисы'], ['profile', 'user', 'Профиль']];
  return `<nav class="bottom-nav" aria-label="Основная навигация">${items.map(([id, ico, label]) => `<button class="${state.tab === id ? 'active' : ''}" data-tab="${id}">${icon(ico, 21)}<span>${label}</span></button>`).join('')}</nav>`;
}

function modal() {  if (!state.modal) return '';  let body = '';  if (state.modal === 'connect') body = `<div class="modal-icon blue">${icon('chat', 23)}</div><span class="eyebrow">ПОДКЛЮЧЕНИЕ TELEGRAM BUSINESS</span><h2>Подключение пока не выполняем</h2><p>Сначала собираем и проверяем приложение. Позже добавим безопасный сценарий подключения и покажем точные разрешения Telegram перед подтверждением.</p><div class="modal-callout">${icon('lock', 16)} Подключай только свой аккаунт и только те чаты, на обработку которых у тебя есть разрешение.</div><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;  if (state.modal === 'telegram') body = `<div class="modal-icon blue">${icon('user', 23)}</div><span class="eyebrow">TELEGRAM MINI APP</span><h2>Как открыть приложение в Telegram</h2><p>Сейчас Mini App ещё не привязана к кнопке бота. После загрузки обновлённого приложения настроим кнопку запуска через BotFather.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;  if (state.modal === 'privacy' || state.modal === 'about') body = `<div class="modal-icon green">${icon('shield', 23)}</div><span class="eyebrow">${state.modal === 'about' ? 'О SPYCHAU' : 'ПРОЗРАЧНОСТЬ'}</span><h2>${state.modal === 'about' ? 'Архив событий подключённых чатов' : 'Доступ и данные под твоим контролем'}</h2><p>Бот может получать только те события и сообщения, которые Telegram передаёт после того, как владелец аккаунта подключил бизнес-бота и выбрал чаты.</p><div class="privacy-points"><div>${icon('check', 16)}<span>Секретные чаты не доступны официальному Bot API</span></div><div>${icon('check', 16)}<span>Содержимое до подключения не появится в архиве</span></div><div>${icon('check', 16)}<span>Удалить профиль и сохранённые события можно из раздела «Профиль»</span></div></div><button class="button button-blue modal-primary" data-action="close">Закрыть ${icon('chevron', 16)}</button>`;  if (state.modal === 'groups') body = `<div class="modal-icon purple">${icon('people', 23)}</div><span class="eyebrow">ГРУППОВЫЕ ЧАТЫ</span><h2>Это отдельная функция</h2><p>Подключение Telegram Business работает с разрешёнными личными чатами. Для группового режима нужно отдельно добавить бота в группу и корректно настроить его права. Этот сценарий пока не реализован.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;  if (state.modal === 'support') body = `<div class="modal-icon blue">${icon('help', 23)}</div><span class="eyebrow">ПОДДЕРЖКА</span><h2>Контакт поддержки ещё не настроен</h2><p>Добавим его до запуска сервиса для пользователей.</p><button class="button button-blue modal-primary" data-action="close">Закрыть ${icon('chevron', 16)}</button>`;  return `<div class="modal-backdrop" data-action="backdrop"><div class="modal">${body}<button class="modal-close" data-action="close" aria-label="Закрыть">${icon('close', 18)}</button></div></div>`;}function render() {  const page = state.tab === 'home' ? home() : state.tab === 'services' ? services() : state.tab === 'archive' ? archive() : profile();  app.innerHTML = `<div class="app-shell"><div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>${state.tab === 'home' ? topbar() : ''}<main>${page}</main>${nav()}${modal()}<div class="toast" role="status" aria-live="polite"></div></div>`;}function toast(message) {  const element = document.querySelector('.toast');  if (!element) return;  element.textContent = message;  element.classList.add('visible');  window.setTimeout(() => element.classList.remove('visible'), 2800);}async function api(path, options = {}) {  if (!state.telegram?.initData) throw new Error('Открой приложение через Telegram.');  const response = await fetch(path, {    ...options,    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), Authorization: `tma ${state.telegram.initData}`, ...options.headers }  });  const result = await response.json().catch(() => ({}));  if (!response.ok) throw new Error(result.error || `Ошибка API (${response.status})`);  return result;}async function loadMe() {  if (state.preview) { render(); return; }  state.loading = true;  state.apiError = '';  render();  try {    const auth = await api('/api/auth/telegram', { method: 'POST', body: JSON.stringify({ init_data: state.telegram.initData }) });    state.user = auth.user;    state.authenticated = Boolean(auth.authenticated);    const result = await api('/api/me');    state.user = result.user;    state.connections = result.connections || [];    state.events = result.events || [];    state.authenticated = true;  } catch (error) {    state.apiError = error.message || 'Не удалось загрузить данные';  } finally {    state.loading = false;    render();async function loadArchive() {
  if (state.preview) { state.tab = 'archive'; render(); return; }
  state.archiveLoading = true;
  state.apiError = '';
  render();
  try {
    const result = await api('/api/archive');
    state.events = result.events || [];
  } catch (error) {
    state.apiError = error.message || 'Не удалось загрузить архив';
  } finally {
    state.archiveLoading = false;
    state.tab = 'archive';
    render();
  }
}


app.addEventListener('click', async event => {
  const target = event.target.closest('[data-action], [data-tab]');
  if (!target) return;
  if (target.dataset.action === 'backdrop' && event.target !== target) return;
  if (target.dataset.tab) {
    state.modal = null;
    if (target.dataset.tab === 'archive') { await loadArchive(); return; }
    state.tab = target.dataset.tab;
    render();
    return;
  }
  const action = target.dataset.action;
  if (action === 'close' || action === 'backdrop') { state.modal = null; render(); return; }
  if (action === 'refresh') { await loadMe(); return; }
  if (action === 'refresh-archive') { await loadArchive(); return; }
  if (action === 'delete-data') {
    if (!state.authenticated) { toast('Открой Mini App из Telegram для управления данными.'); return; }
    if (!window.confirm('Удалить профиль и все события из архива? Это действие нельзя отменить.')) return;
    try {
      await api('/api/me/data', { method: 'DELETE' });
      state.user = null; state.connections = []; state.events = []; state.authenticated = false;
      toast('Данные удалены.');
      render();
    } catch (error) { toast(error.message || 'Не удалось удалить данные.'); }
    return;
  }
  state.modal = action;
  render();
});


app.addEventListener('input', event => {
  if (event.target.id === 'archive-search') {
    const cursor = event.target.selectionStart;
    state.query = event.target.value;
    render();
    const input = document.querySelector('#archive-search');
    input?.focus();
    input?.setSelectionRange(cursor, cursor);
  }
});


app.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.modal) { state.modal = null; render(); }
});


if (state.telegram) {
  state.telegram.ready?.();
  state.telegram.expand?.();
  state.telegram.setHeaderColor?.('#100b0c');
  state.telegram.setBackgroundColor?.('#100b0c');
  state.user = state.telegram.initDataUnsafe?.user || null;
}
render();
if (!state.preview) loadMe();
