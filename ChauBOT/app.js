const icon = (name, size = 20) => {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m2 0-.8 14H6.8L6 6m4 4v6m4-6v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
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
    back: '<path d="M19 12H5m7 7-7-7 7-7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>'
    ,sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
    ,moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>'
    ,chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};

const state = {
  tab: 'home', modal: null, query: '', archiveContactId: null, archiveFilter: 'all', user: null, connections: [], events: [], subscription: null,
  tutorialType: null, tutorialReturnTab: 'home', navigationStack: [],
  theme: loadTheme(),
  notificationPreferences: loadNotificationPreferences(),
  loading: false, archiveLoading: false, ownerStatistics: null, ownerStatisticsLoading: false, apiError: '', telegram: window.Telegram?.WebApp || null,
  authenticated: false, preview: !window.Telegram?.WebApp?.initData
};

function pushNavigation() {
  const snapshot = {
    tab: state.tab,
    archiveContactId: state.archiveContactId,
    archiveFilter: state.archiveFilter,
    query: state.query,
    tutorialType: state.tutorialType,
    tutorialReturnTab: state.tutorialReturnTab
  };
  const last = state.navigationStack[state.navigationStack.length - 1];
  if (last && Object.keys(snapshot).every(key => last[key] === snapshot[key])) return;
  state.navigationStack.push(snapshot);
  if (state.navigationStack.length > 40) state.navigationStack.shift();
}

function goBack() {
  const previous = state.navigationStack.pop();
  if (previous) Object.assign(state, previous);
  else if (state.tab === 'archive' && state.archiveContactId) state.archiveContactId = null;
  else if (state.tab === 'connection-tutorial') state.tab = state.tutorialReturnTab || 'home';
  else state.tab = 'home';
  state.modal = null;
  render();
}

function syncTelegramBackButton() {
  const backButton = state.telegram?.BackButton;
  if (!backButton) return;
  const mainTabs = ['home', 'services', 'profile'];
  if (mainTabs.includes(state.tab)) backButton.hide?.();
  else backButton.show?.();
}

function loadTheme() {
  try { return localStorage.getItem('spychau-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

function loadNotificationPreferences() {
  const defaults = { deleted_messages: false, edited_messages: false, group_messages: false, deleted_by_owner: false, edited_by_owner: false };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('spychau-notification-preferences') || '{}') }; }
  catch { return defaults; }
}
const app = document.querySelector('#root');

function syncTelegramSafeArea() {
  const safeTop = Number(state.telegram?.safeAreaInset?.top) || 0;
  const contentTop = Number(state.telegram?.contentSafeAreaInset?.top) || 0;
  const stableHeight = Number(state.telegram?.viewportStableHeight) || 0;
  const visualHeight = Number(window.visualViewport?.height) || 0;
  const viewportHeight = stableHeight || visualHeight || window.innerHeight;
  const insetTop = Math.max(safeTop, contentTop);
  // Telegram overlays its controls on the WebView in fullscreen. Keep the
  // app header below them even on clients that report a zero content inset.
  const fullscreenFallback = Math.min(184, Math.max(144, viewportHeight * 0.18)) * 0.75;
  const topInset = state.telegram?.isFullscreen
    ? Math.max(insetTop + 12, fullscreenFallback)
    : insetTop;
  document.documentElement.style.setProperty('--app-mobile-top-inset', `${topInset}px`);
  document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function racer(small = false) {
  const image = small ? './assets/mascot/kchau-trophies.png' : './assets/spy-chau-happy-clean.png';
  return `<div class="racer ${small ? 'racer-small' : ''}" aria-hidden="true"><img src="${image}" alt="" /></div>`;
}

function displayName() {
  return state.user?.first_name || state.user?.username || 'Гонщик';
}

function topbar() {
  return `<header class="topbar"><div class="brand-mark">${state.authenticated && typeof state.user?.photo_url === 'string' && state.user.photo_url.toLowerCase().startsWith('https://') ? `<img src="${escapeHtml(state.user.photo_url)}" alt="" referrerpolicy="no-referrer">` : '<span>SC</span>'}<i></i></div><div class="brand-copy"><strong>SpyChau</strong><span>Привет, ${escapeHtml(displayName())}</span></div><button class="icon-button theme-toggle" aria-label="${state.theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}" data-action="toggle-theme">${icon(state.theme === 'dark' ? 'sun' : 'moon', 19)}</button><button class="icon-button" aria-label="О приложении" data-action="about">${icon('help', 19)}</button><button class="icon-button sun-button" aria-label="Уведомления" data-tab="archive">${icon('bell', 19)}</button></header>`;
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
  const personalConnected = activeCount > 0;
  const count = activeCount ? '1 из 2' : '0 из 2';
  const connectButton = type => `<button type="button" class="button button-blue connect-cta" data-tutorial="${type}">Подключить</button>`;
  const connectedMark = `<span class="connection-done" role="status" aria-label="Подключено">${icon('check', 20)}</span>`;
  return `<div class="connect-card"><div class="connect-card-heading"><strong>Подключения</strong><span class="count-badge" style="border:0;background:none;padding:0;color:var(--muted)">${count}</span></div><div class="connect-row"><div class="service-icon blue">${icon('chat', 20)}</div><div class="row-copy"><strong>Личные чаты</strong><span>${personalConnected ? 'Подключение активно' : state.preview ? 'Открой приложение через Telegram' : 'Пока не подключены'}</span></div>${personalConnected ? connectedMark : connectButton('personal')}</div><div class="divider"></div><div class="connect-row"><div class="service-icon purple">${icon('people', 20)}</div><div class="row-copy"><strong>Группы</strong><span>Пока не подключены</span></div>${connectButton('groups')}</div></div>`;
}

function connectionTutorialPage() {
  const personal = state.tutorialType !== 'groups';
  const header = `<button type="button" class="profile-detail-back" data-action="tutorial-back">${icon('chevron', 16)} Назад</button>`;
  if (personal) return `<section class="page connection-tutorial-page"><div class="tutorial-intro">${header}<div class="tutorial-heading"><span class="eyebrow">ПОДКЛЮЧЕНИЕ</span><h1>Подключи меня<br>к личным чатам</h1><p>Три шага — и я начну сохранять новые изменения и удаления.</p></div><div class="tutorial-mascot-space" aria-hidden="true"></div></div><div class="tutorial-step-list"><article class="tutorial-step-card"><span class="tutorial-step-number">1</span><div class="tutorial-step-content"><h2>Скопируй моё имя</h2><div class="tutorial-copy-row"><strong>@SpyUndo_bot</strong><button type="button" class="tutorial-copy-button" data-action="copy-bot-name">${icon('archive', 16)} Копировать</button></div></div></article><article class="tutorial-step-card"><span class="tutorial-step-number">2</span><div class="tutorial-step-content"><h2>Открой «Автоматизацию чатов»</h2><p>Этот раздел настроек Telegram подключает бота к выбранным чатам.</p><div class="tutorial-breadcrumb"><span>Настройки</span>${icon('chevron', 13)}<span>Telegram Business</span>${icon('chevron', 13)}<b>Чат-боты</b></div></div></article><article class="tutorial-step-card"><span class="tutorial-step-number">3</span><div class="tutorial-step-content"><h2>Выбери чаты и сохрани</h2><p>Отметь нужные личные чаты, проверь разрешения и нажми «Сохранить».</p></div></article></div><div class="tutorial-note">Новые события начнут сохраняться после подключения. Telegram не передаёт боту историю сообщений до этого момента.</div><div class="tutorial-loop" role="img" aria-label="Зацикленная демонстрация подключения SpyUndo_bot в Telegram"><div class="tutorial-loop-head"><span></span><b>Как подключить SpyUndo_bot</b><small>Анимация шагов</small></div><div class="tutorial-loop-scenes"><div class="tutorial-loop-scene scene-settings"><div class="telegram-mock-top"><span>‹</span><b>Настройки</b></div><div class="telegram-mock-row">Уведомления и звуки <i>›</i></div><div class="telegram-mock-row">Конфиденциальность <i>›</i></div><div class="telegram-mock-row focus">Telegram Business <i>›</i></div><div class="telegram-mock-caption">Открой настройки Telegram Business</div></div><div class="tutorial-loop-scene scene-business"><div class="telegram-mock-top"><span>‹</span><b>Telegram Business</b></div><div class="telegram-mock-row">Часы работы <i>›</i></div><div class="telegram-mock-row">Быстрые ответы <i>›</i></div><div class="telegram-mock-row focus">Чат-боты <i>›</i></div><div class="telegram-mock-caption">Перейди в раздел «Чат-боты»</div></div><div class="tutorial-loop-scene scene-bot"><div class="telegram-mock-top"><span>‹</span><b>Чат-боты</b></div><div class="telegram-mock-bot"><span>SC</span><b>SpyUndo_bot<small>@SpyUndo_bot</small></b></div><div class="telegram-mock-action">Подключить бота</div><div class="telegram-mock-caption">Выбери нашего бота</div></div><div class="tutorial-loop-scene scene-chats"><div class="telegram-mock-top"><span>‹</span><b>Доступ к чатам</b></div><div class="telegram-mock-row">Личные чаты</div><div class="telegram-mock-row">Максим <i class="mock-check">✓</i></div><div class="telegram-mock-row">Аня <i class="mock-check">✓</i></div><div class="telegram-mock-action">Сохранить</div><div class="telegram-mock-caption">Отметь нужные чаты и сохрани</div></div></div><div class="tutorial-loop-progress"><i></i><i></i><i></i><i></i></div></div><div class="tutorial-footer"><button type="button" class="button tutorial-open-settings" data-action="open-telegram-business-settings">Открыть настройки Telegram ${icon('arrow', 19)}</button><button type="button" class="tutorial-help-link" data-action="tutorial-help">${icon('help', 15)} Не получается? Помогу</button></div></section>`;
  return `<section class="page connection-tutorial-page">${header}<div class="service-card connection-tutorial-card"><div class="service-card-top"><div class="service-icon purple large">${icon('people', 24)}</div><div><h2>Групповой режим готовится</h2><p>Сейчас SpyChau не сохраняет события из групп.</p></div></div><div class="tutorial-note tutorial-note-pending">Добавление бота в группу пока не включит архивирование сообщений. Не выдавай боту права администратора ради этой функции. Когда групповой режим будет реализован, здесь появятся точные шаги и необходимые разрешения.</div></div></section>`;
}

function archiveEventKind(event) {
  const message = event.message || {};
  if (message.ephemeral_message_id != null || message.receiver_user?.id != null || Number(message.ttl_period) > 0) return 'one-time';
  if (event.event_type === 'deleted') return 'deleted';
  if (event.event_type === 'edited') return 'edited';
  return null;
}

function eventTitle(event) {
  if (archiveEventKind(event) === 'one-time') return 'Одноразовое сообщение';
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
  if (archiveEventKind(event) === 'one-time') return 'Одноразовое сообщение';
  if (event.event_type === 'deleted') return `ID сообщения: ${event.message_id || '—'}`;
  return 'Содержимое события получено от Telegram';
}

function formatDate(value) {
  if (!value) return 'Дата неизвестна';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function eventCard(event) {
  const kind = archiveEventKind(event);
  const type = kind || 'new';
  const iconName = kind === 'deleted' ? 'close' : kind === 'one-time' ? 'clock' : event.message?.voice ? 'mic' : event.message?.photo ? 'image' : 'chat';
  return `<article class="event-row"><div class="event-type-icon ${type}">${icon(iconName, 18)}</div><div class="event-copy"><div class="event-title-line"><strong>${escapeHtml(eventTitle(event))}</strong><time>${escapeHtml(formatDate(event.created_at))}</time></div><span>${escapeHtml(eventDescription(event))}</span><small>Чат ${escapeHtml(event.chat_id || '—')} · сообщение ${escapeHtml(event.message_id || '—')}</small></div></article>`;
}

function eventChat(event) {
  return event.message?.chat || {};
}

function eventContactName(event) {
  const chat = eventChat(event);
  return [chat.first_name, chat.last_name].filter(Boolean).join(' ')
    || chat.title
    || (chat.username ? `@${chat.username}` : '')
    || `Контакт ${String(event.chat_id || '').slice(-4)}`;
}

function eventContactIdentity(contact) {
  return [contact.username ? `@${contact.username}` : '', contact.telegramId ? `ID чата: ${contact.telegramId}` : '']
    .filter(Boolean)
    .join(' · ');
}

function contactAvatar(contact, extraClass = '') {
  const initial = escapeHtml(contact.name.slice(0, 1).toLocaleUpperCase('ru'));
  const photo = contact.avatar_url ? `<img class="contact-avatar-image" src="${escapeHtml(contact.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  return `<span class="contact-avatar ${extraClass} ${contact.avatar_url ? 'has-photo' : ''}">${photo}<span class="avatar-initial">${initial}</span></span>`;
}

function archiveContactCard(contact) {
  const latest = contact.events[0];
  const kind = archiveEventKind(latest) || 'deleted';
  const eventIcon = kind === 'deleted' ? 'trash' : kind === 'edited' ? 'edit' : 'clock';
  const eventLabel = kind === 'deleted' ? 'Удалено сообщение' : kind === 'edited' ? 'Изменено сообщение' : 'Одноразовое сообщение';
  const identity = contact.username ? `@${contact.username}` : `ID чата: ${contact.telegramId}`;
  return `<button type="button" class="contact-row archive-contact-card" data-contact-id="${escapeHtml(contact.id)}">${contactAvatar(contact)}<span class="contact-copy archive-contact-copy"><strong>${escapeHtml(contact.name)}</strong><small class="contact-identity-line">${escapeHtml(identity)}</small><span class="archive-contact-event ${kind}">${icon(eventIcon, 17)}<span>${eventLabel}</span></span></span><span class="contact-count ${kind}">${contact.events.length}</span>${icon('chevron', 16)}</button>`;
}

function previousMessageSnapshot(event) {
  return state.events.find(candidate => candidate.event_type !== 'deleted'
    && String(candidate.chat_id) === String(event.chat_id)
    && String(candidate.message_id) === String(event.message_id)
    && Number(candidate.id) < Number(event.id)) || null;
}

function archiveEventText(event) {
  const kind = archiveEventKind(event);
  const previous = previousMessageSnapshot(event);
  if (kind === 'deleted') {
    return previous ? eventDescription(previous) : `Текст не сохранился · ID сообщения ${event.message_id || '—'}`;
  }
  const currentText = eventDescription(event);
  if (kind === 'edited' && previous) {
    const previousText = eventDescription(previous);
    if (previousText !== currentText) return `Было: ${previousText} · Стало: ${currentText}`;
  }
  return currentText;
}

function archiveContacts() {
  const contacts = new Map();
  for (const event of state.events) {
    if (!archiveEventKind(event)) continue;
    const chat = eventChat(event);
    if (chat.type && chat.type !== 'private') continue;
    const chatId = String(event.chat_id || chat.id || '');
    if (!chatId) continue;
    let contact = contacts.get(chatId);
    if (!contact) {
      contact = {
        id: chatId,
        name: eventContactName(event),
        username: chat.username || '',
        telegramId: String(chat.id || chatId),
        avatar_url: event.avatar_url || null,
        events: [],
        latestId: Number(event.id) || 0,
      };
      contacts.set(chatId, contact);
    }
    contact.events.push(event);
    contact.latestId = Math.max(contact.latestId, Number(event.id) || 0);
    if (chat.username) contact.username = chat.username;
    if (chat.id) contact.telegramId = String(chat.id);
    if (event.avatar_url) contact.avatar_url = event.avatar_url;
    if (contact.name.startsWith('Контакт ')) contact.name = eventContactName(event);
  }
  return [...contacts.values()].sort((left, right) => right.latestId - left.latestId);
}

function archiveEventRow(event) {
  const kind = archiveEventKind(event);
  const iconName = kind === 'deleted' ? 'close' : kind === 'one-time' ? 'clock' : 'chat';
  const original = kind === 'deleted' ? previousMessageSnapshot(event) : null;
  const imageUrl = event.media_url || original?.media_url;
  const photo = imageUrl ? `<a class="event-photo-link" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener" aria-label="Открыть сохранённую фотографию"><img class="event-photo" src="${escapeHtml(imageUrl)}" alt="Фотография из сообщения" loading="lazy" /></a>` : '';
  return `<article class="event-row contact-event-row"><div class="event-type-icon ${kind}">${icon(iconName, 18)}</div><div class="event-copy"><div class="event-title-line"><strong>${escapeHtml(eventTitle(event))}</strong><time>${escapeHtml(formatDate(event.created_at))}</time></div><span>${escapeHtml(archiveEventText(event))}</span>${photo}</div></article>`;
}

function homeContactRow(contact) {
  const kinds = [...new Set(contact.events.map(event => {
    const kind = archiveEventKind(event);
    return kind === 'deleted' ? 'Удалено' : kind === 'edited' ? 'Изменено' : 'Одноразовое';
  }))];
  return `<button type="button" class="contact-row home-contact-row" data-contact-id="${escapeHtml(contact.id)}">${contactAvatar(contact)}<span class="contact-copy"><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(kinds.join(' · '))}</small></span><span class="contact-count">${contact.events.length} ${plural(contact.events.length, 'событие', 'события', 'событий')}</span>${icon('chevron', 16)}</button>`;
}

function home() {
  const subscriptionActive = Boolean(state.subscription?.active);
  const contacts = archiveContacts().slice(0, 3);
  return `<section class="page home-page"><div class="hero-card"><div class="hero-copy"><h1 class="subscription-heading"><span class="subscription-dot ${subscriptionActive ? 'active' : 'inactive'}" aria-hidden="true"></span>${subscriptionActive ? 'Подписка активна' : 'Подписка не активна'}</h1><p>${subscriptionActive ? 'Я в гонке, сохраняю все изменения и удаления' : 'Я не на дороге и не сохраняю удаленное. Подключай - и вернусь в гонку.'}</p><button class="button button-light" data-action="${state.preview ? 'telegram' : 'connect'}">Подключить ${icon('chevron', 16)}</button></div>${racer()}<div class="hero-orbit orbit-a"></div><div class="hero-orbit orbit-b"></div></div>${connectCard()}<div class="section-heading event-heading"><div><h2>Что происходило</h2><p>Контакты и связанные события</p></div><button class="text-button" data-tab="archive">Весь архив ${icon('chevron', 17)}</button></div>${state.loading ? `<div class="empty-events"><div class="loading-indicator"></div><strong>Загружаем архив</strong><p>Получаем состояние аккаунта.</p></div>` : contacts.length ? `<div class="contact-list home-contact-list">${contacts.map(homeContactRow).join('')}</div>` : `<div class="empty-events"><div class="empty-art search-mascot"><img src="./assets/mascot/kchau-driving-road.png" alt="Кчау едет по дороге" /></div><strong>${state.preview ? 'Предпросмотр интерфейса' : 'Пока тихо на трассе'}</strong><p>${state.preview ? 'Для личных данных открой Mini App из Telegram.' : state.apiError ? 'Обнови приложение и попробуй снова.' : 'Когда появятся события из подключённых чатов, они отобразятся здесь.'}</p>${state.apiError ? `<button class="subtle-button" data-action="refresh">${icon('arrow', 15)} Повторить загрузку</button>` : ''}</div>`}<div class="trust-note">${icon('shield', 17)}<span>Доступ и выбранные чаты контролируешь ты.</span></div></section>`;
}

function services() {
  const activeCount = state.connections.filter(connection => Number(connection.enabled) === 1).length;
  return `<section class="page services-page"><div class="page-title"><h1>Сервисы</h1><p>Всё, что умеет Кчау - подключай нужное</p></div><div class="service-card featured-service"><div class="service-card-top"><div class="service-icon blue large">${icon('chat', 24)}</div><div><h2>Личные чаты</h2><p>Архив событий из чатов, которые ты разрешил подключённому Telegram Business боту.</p></div></div><div class="service-card-bottom"><span class="green-label">${icon('check', 15)} ${state.preview ? 'Доступно после запуска в Telegram' : `${activeCount} активных подключений`}</span><button class="button button-blue" data-tutorial="personal">${state.preview ? 'О подключении' : 'Настройка'} ${icon('chevron', 16)}</button></div><div class="card-glow"></div></div><div class="service-card"><div class="service-card-top"><div class="service-icon purple large">${icon('people', 24)}</div><div><h2>Группы</h2><p>Отдельный режим для групповых чатов. Пока не подключён.</p></div></div><div class="service-card-bottom"><span class="muted-price">Будет добавлен отдельно</span><button class="button button-purple" data-tutorial="groups">Подробнее ${icon('chevron', 16)}</button></div></div><div class="service-card archive-service"><div class="service-card-top"><div class="service-icon cyan large">${icon('archive', 24)}</div><div><h2>Архив событий</h2><p>Список новых, изменённых и удалённых сообщений, полученных после подключения.</p></div></div><div class="service-card-bottom"><span class="lock-label">${icon('clock', 14)} ${state.preview ? 'Открой через Telegram' : `${state.events.length} событий загружено`}</span><button class="button button-blue" data-tab="archive">Открыть архив ${icon('chevron', 16)}</button></div></div><div class="coming-card"><span class="coming-label">ПОЗЖЕ</span><div class="coming-content"><div><h2>Дополнительные возможности</h2><p>${icon('spark', 14)} Поиск и фильтры архива</p><p>${icon('spark', 14)} Настройки хранения и экспорт</p><p>${icon('spark', 14)} Управление профилем</p></div>${racer(true)}</div></div></section>`;
}

function archive() {
  if (!state.preview && !state.subscription?.active) {
    return `<section class="page archive-page"><div class="page-title archive-title"><span class="eyebrow">ИСТОРИЯ ПОДКЛЮЧЁННЫХ ЧАТОВ</span><h1>Архив</h1><p>События из подключённых чатов.</p></div><div class="archive-state">${icon('lock', 24)}<strong>Подписка не активна</strong><p>Архив событий и функции подписки будут доступны после подключения подписки.</p><button class="subtle-button" data-action="subscription-info">Как подключить ${icon('chevron', 15)}</button></div></section>`;
  }
  const contacts = archiveContacts();
  const query = state.query.trim().toLocaleLowerCase('ru');
  const selectedContact = contacts.find(contact => contact.id === state.archiveContactId);
  const filters = [['all', 'Все'], ['deleted', 'Удалено'], ['edited', 'Изменено'], ['one-time', 'Одноразовое']];
  const disclaimer = `<div class="archive-disclaimer">${icon('shield', 16)}<span>События относятся только к подключённым чатам. Фото открываются из сохранённого снимка сообщения Telegram.</span></div>`;
  const emptyState = `<div class="archive-state">${icon(state.preview ? 'lock' : 'archive', 24)}<strong>${query ? 'Ничего не найдено' : state.preview ? 'Открой приложение в Telegram' : 'Пока нет событий'}</strong><p>${query ? 'Попробуй поискать по имени контакта или тексту события.' : state.preview ? 'Личный архив доступен после входа через Telegram Mini App.' : state.apiError ? 'Не удалось получить данные. Попробуй обновить страницу.' : 'Контакты появятся здесь, когда в личном чате будет удаление, изменение или одноразовое сообщение.'}</p>${state.apiError && !state.preview ? `<button class="subtle-button" data-action="refresh-archive">Повторить</button>` : ''}</div>`;

  if (state.archiveLoading) {
    return `<section class="page archive-page"><div class="page-title archive-title"><span class="eyebrow">ИСТОРИЯ ЛИЧНЫХ ЧАТОВ</span><h1>Контакты</h1><p>Диалоги, в которых были события.</p></div><div class="archive-state"><div class="loading-indicator"></div><strong>Загружаем архив…</strong></div></section>`;
  }

  if (selectedContact) {
    const selectedEvents = selectedContact.events.filter(event => state.archiveFilter === 'all' || archiveEventKind(event) === state.archiveFilter);
    const filterButtons = filters.map(([id, label]) => `<button type="button" class="archive-filter ${state.archiveFilter === id ? 'active' : ''}" data-archive-filter="${id}" aria-pressed="${state.archiveFilter === id}">${label}</button>`).join('');
    const identity = eventContactIdentity(selectedContact);
    return `<section class="page archive-page"><button type="button" class="archive-back" data-action="archive-back">${icon('chevron', 16)} Все контакты</button><div class="contact-detail-heading">${contactAvatar(selectedContact)}<div class="contact-detail-copy"><h1>${escapeHtml(selectedContact.name)}</h1>${identity ? `<p class="contact-identity-line">${escapeHtml(identity)}</p>` : ''}<p>${selectedContact.events.length} ${plural(selectedContact.events.length, 'событие', 'события', 'событий')}</p></div><button class="text-button" data-action="refresh-archive">Обновить ${icon('arrow', 15)}</button></div><div class="archive-filters" role="group" aria-label="Категории событий">${filterButtons}</div>${selectedEvents.length ? `<div class="archive-summary"><span>${selectedEvents.length} ${plural(selectedEvents.length, 'событие', 'события', 'событий')}</span></div><div class="events-list archive-list">${selectedEvents.map(archiveEventRow).join('')}</div>` : `<div class="archive-state"><strong>В этой категории пока пусто</strong><p>Выбери другую категорию событий.</p></div>`}${disclaimer}</section>`;
  }

  const matchingContacts = contacts.filter(contact => {
    if (!query) return true;
    const content = `${contact.name} ${contact.events.map(archiveEventText).join(' ')}`.toLocaleLowerCase('ru');
    return content.includes(query);
  });
  const contactRows = matchingContacts.map(archiveContactCard).join('');
  return `<section class="page archive-page"><div class="page-title archive-title"><span class="eyebrow">ИСТОРИЯ ЛИЧНЫХ ЧАТОВ</span><h1>Контакты</h1><p>Диалоги, в которых были события.</p></div><label class="search-field">${icon('search', 17)}<input id="archive-search" value="${escapeHtml(state.query)}" placeholder="Поиск контакта или события" autocomplete="off"></label>${contacts.length ? `<div class="archive-summary"><span>${matchingContacts.length} ${plural(matchingContacts.length, 'контакт', 'контакта', 'контактов')} с событиями</span><button class="text-button" data-action="refresh-archive">Обновить ${icon('arrow', 15)}</button></div>${contactRows ? `<div class="archive-contact-list">${contactRows}</div>` : emptyState}` : emptyState}${disclaimer}</section>`;
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
  const testOverride = state.subscription?.test_override;
  const testActive = testOverride === null || testOverride === undefined ? Boolean(state.subscription?.active) : Boolean(testOverride);
  const activeCount = state.connections.filter(connection => Number(connection.enabled) === 1).length;
  const title = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Пользователь Telegram' : 'Предпросмотр';
  const secondary = user?.username ? `@${user.username}` : 'Аккаунт Telegram';
  const telegramId = state.authenticated && user?.id ? String(user.id) : null;
  const photoUrl = state.authenticated && typeof user?.photo_url === 'string' && /^https:\/\//i.test(user.photo_url) ? user.photo_url : null;
  return `<section class="page profile-page"><div class="profile-intro"><div class="avatar">${escapeHtml(title.slice(0, 1).toUpperCase())}${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="${state.authenticated ? '' : 'offline'}"></span></div><h1>${escapeHtml(title)}</h1><div class="profile-account-line" style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-top:5px"><span>${escapeHtml(secondary)}</span><span class="profile-telegram-id" style="color:#d9b890">ID: ${telegramId ? escapeHtml(telegramId) : 'не подтверждён'}</span></div></div><span class="list-label">МОЙ АККАУНТ</span><div class="profile-card"><button class="profile-row" data-tab="subscription"><span class="service-icon purple">${icon('lock', 19)}</span><span class="row-copy"><strong>Моя подписка</strong><small>${state.subscription?.active ? 'Подписка активна' : 'Подписка не активна'}</small></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="services"><span class="service-icon blue">${icon('chat', 19)}</span><span class="row-copy"><strong>Мои подключения</strong><small>${state.preview ? 'Вход через Telegram не выполнен' : `${activeCount} активных · ${state.connections.length} всего`}</small></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="notifications"><span class="service-icon yellow">${icon('bell', 19)}</span><span class="row-copy"><strong>Уведомления</strong><small>Настройки оповещений приложения</small></span>${icon('chevron', 18)}</button><button class="profile-row receipt-email-row" data-tab="receipt-email"><span class="service-icon blue">${icon('mail', 19)}</span><span class="row-copy"><span class="receipt-email-heading"><strong>Почта для чеков</strong>${state.user?.receipt_email ? `<span class="receipt-email-value">${escapeHtml(state.user.receipt_email)}</span>` : ''}</span>${state.user?.receipt_email ? '' : '<small>Добавь адрес для чеков о покупке</small>'}</span>${icon('chevron', 18)}</button></div>${state.subscription?.can_test_override ? `<span class="list-label">ХОЗЯЙСКИЙ РЕЖИМ</span><div class="profile-card"><button class="profile-row test-subscription-row" role="switch" aria-checked="${testActive}" data-action="toggle-test-subscription" ${state.subscriptionToggleLoading ? 'disabled' : ''}><span class="service-icon ${testActive ? 'green' : 'muted'}">${icon('spark', 19)}</span><span class="row-copy"><strong>Хозяйская подписка</strong><small>${state.subscriptionToggleLoading ? 'Сохраняем…' : testActive ? 'Включена · доступны функции подписки' : 'Выключена · функции ограничены'}</small></span><span class="test-switch ${testActive ? 'on' : ''}" aria-hidden="true"><i></i></span></button><button type="button" class="profile-row" data-tab="owner-statistics"><span class="service-icon yellow">${icon('chart', 19)}</span><span class="row-copy"><strong>Статистика</strong><small>Статистика приложения</small></span>${icon('chevron', 18)}</button></div>` : ''}<span class="list-label">СЕРВИС И ПОДДЕРЖКА</span><div class="profile-card"><button class="profile-row" data-tab="support"><span class="service-icon blue">${icon('help', 19)}</span><span class="row-copy"><strong>Поддержка</strong><small>Контакт поддержки добавим перед запуском</small></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="privacy"><span class="service-icon green">${icon('shield', 19)}</span><span class="row-copy"><strong>Безопасность и данные</strong><small>Доступ и ограничения Telegram</small></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="delete-data"><span class="service-icon muted">${icon('close', 19)}</span><span class="row-copy"><strong>Удалить мои данные</strong><small>Очистить профиль и события из архива</small></span>${icon('chevron', 18)}</button></div><div class="profile-footer"><span>SpyChau · ранняя версия</span><span>Данные привязаны к твоему Telegram ID</span></div></section>`;
}

function ownerStatisticsPage() {
  const count = state.ownerStatistics?.unique_visitors;
  const value = state.ownerStatisticsLoading ? 'Загружаем…' : count == null ? '—' : `${count} ${plural(count, 'пользователь', 'пользователя', 'пользователей')}`;
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('ХОЗЯЙСКИЙ РЕЖИМ', 'Статистика', 'Посещения приложения.')}<div class="profile-card profile-detail-card"><div class="profile-row"><span class="service-icon yellow">${icon('user', 20)}</span><span class="row-copy"><strong>Пользователи посетили приложение</strong><small>Уникальные аккаунты Telegram</small></span><span class="subscription-row-value">${escapeHtml(value)}</span></div>${state.apiError ? `<p class="profile-detail-hint">${escapeHtml(state.apiError)}</p>` : ''}<button type="button" class="subtle-button" data-action="refresh-owner-statistics" ${state.ownerStatisticsLoading ? 'disabled' : ''}>Обновить ${icon('arrow', 15)}</button></div></section>`;
}

async function loadOwnerStatistics() {
  if (state.ownerStatisticsLoading) return;
  state.ownerStatisticsLoading = true;
  state.apiError = '';
  render();
  try {
    state.ownerStatistics = await api('/api/owner/statistics');
  } catch (error) {
    state.apiError = error.message || 'Не удалось загрузить статистику.';
  } finally {
    state.ownerStatisticsLoading = false;
    render();
  }
}

function notificationsPage() {
  const preferences = state.notificationPreferences;
  const switchRow = (key, title, description, iconName, color, disabled = false) => `<button type="button" class="profile-row notification-switch-row" role="switch" aria-checked="${Boolean(preferences[key])}" aria-label="${escapeHtml(title)}" data-notification-toggle="${key}" ${disabled || !state.authenticated ? 'disabled' : ''}><span class="service-icon ${color}">${icon(iconName, 19)}</span><span class="row-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><span class="test-switch ${preferences[key] ? 'on' : ''}" aria-hidden="true"><i></i></span></button>`;
  return `<section class="page profile-page notifications-page">${profileDetailHeader('МОЙ АККАУНТ', 'Уведомления', 'Выбери, какие типы событий учитывать.')}<span class="list-label">СООБЩЕНИЯ СОБЕСЕДНИКОВ</span><div class="profile-card">${switchRow('deleted_messages', 'Удалённые сообщения', 'События удаления в подключённых чатах', 'trash', 'red')}${switchRow('edited_messages', 'Изменённые сообщения', 'События изменения в подключённых чатах', 'edit', 'yellow')}${switchRow('group_messages', 'Сообщения в группах', 'Групповые чаты пока не подключены', 'people', 'purple', true)}</div><span class="list-label">МОИ ДЕЙСТВИЯ</span><div class="profile-card">${switchRow('deleted_by_owner', 'Удалённые мной', 'Telegram не сообщает, кто удалил сообщение', 'trash', 'blue', true)}${switchRow('edited_by_owner', 'Изменённые мной', 'Telegram не сообщает, кто изменил сообщение', 'edit', 'blue', true)}</div><div class="notification-note">${state.preview ? 'Открой приложение через Telegram, чтобы сохранять настройки.' : 'Настройки сохраняются на этом устройстве. Отправка уведомлений ботом пока не подключена.'} Одноразовые сообщения пока доступны в архиве.</div></section>`;
}

function profileDetailHeader(eyebrow, title, description) {
  return `<button type="button" class="profile-detail-back" data-tab="profile">${icon('chevron', 16)} Профиль</button><div class="page-title">${eyebrow && eyebrow !== 'МОЙ АККАУНТ' ? `<span class="eyebrow">${eyebrow}</span>` : ''}<h1>${title}</h1><p>${description}</p></div>`;
}

function supportPage() {
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('', 'Поддержка', 'Помощь по работе SpyChau.')}<div class="profile-card profile-detail-card"><div class="profile-row"><span class="service-icon blue">${icon('help', 20)}</span><span class="row-copy"><strong>Связь с поддержкой</strong><small>Контакт поддержки пока не настроен. Добавим его перед запуском сервиса.</small></span></div></div></section>`;
}

function aboutPage() {
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('', 'О SpyChau', 'Архив событий подключённых чатов.')}<div class="profile-card profile-detail-card"><div class="privacy-points"><div class="privacy-point"><span class="privacy-point-icon frame-green">${icon('chat', 18)}</span><span>Бот получает события и сообщения только из чатов, которые ты подключил.</span></div><div class="privacy-point"><span class="privacy-point-icon frame-gold">${icon('clock', 18)}</span><span>Telegram не передаёт боту историю сообщений до подключения.</span></div><div class="privacy-point"><span class="privacy-point-icon frame-purple">${icon('lock', 18)}</span><span>Секретные чаты недоступны через официальный Bot API.</span></div><div class="privacy-point"><span class="privacy-point-icon frame-green">${icon('image', 18)}</span><span>Для фото используется сохранённый снимок сообщения Telegram.</span></div><div class="privacy-point"><span class="privacy-point-icon frame-orange">${icon('trash', 18)}</span><span>Удалить профиль и архив можно в разделе «Удалить мои данные».</span></div></div></div></section>`;
}

function privacyPage() {
  const points = [
    ['chat', 'coral frame-coral', 'Бот получает события только в чатах, которые ты подключил.'],
    ['clock', 'gold frame-gold', 'Telegram не передаёт боту историю сообщений до подключения.'],
    ['lock', 'orange frame-purple', 'Секретные чаты недоступны через официальный Bot API.'],
    ['image', 'yellow frame-green', 'Фото показываются из сохранённого снимка сообщения Telegram.'],
    ['trash', 'burgundy frame-orange', 'Удалить профиль и архив можно в разделе «Удалить мои данные».'],
  ];
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('', 'Безопасность и данные', 'Как SpyChau получает и хранит данные.')}<div class="profile-card profile-detail-card"><div class="privacy-points">${points.map(([name, color, text]) => `<div class="privacy-point"><span class="privacy-point-icon ${color}">${icon(name, 18)}</span><span>${text}</span></div>`).join('')}</div></div></section>`;
}

function receiptEmailPage() {
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('МОЙ АККАУНТ', 'Почта для чеков', 'Укажи адрес для получения чеков о покупке.')}<div class="profile-card profile-detail-card"><form id="receipt-email-form"><label for="receipt-email" class="receipt-email-label">Электронная почта</label><input id="receipt-email" class="receipt-email-input" name="email" type="email" value="${escapeHtml(state.user?.receipt_email || '')}" placeholder="name@example.com" autocomplete="email" maxlength="254" required><button class="button button-blue modal-primary" type="submit" ${state.receiptEmailSaving ? 'disabled' : ''}>${state.receiptEmailSaving ? 'Сохраняем…' : 'Сохранить'}</button></form></div></section>`;
}

function deleteDataPage() {
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('СЕРВИС И ПОДДЕРЖКА', 'Удалить мои данные', 'Удаление профиля и событий, сохранённых в архиве.')}<div class="profile-card profile-detail-card"><div class="privacy-points"><div>${icon('info', 16)}<span>Будут удалены данные аккаунта и события из твоего архива.</span></div><div>${icon('info', 16)}<span>Это действие нельзя отменить.</span></div></div><button type="button" class="button button-danger modal-primary" data-action="delete-data-confirm" ${!state.authenticated ? 'disabled' : ''}>Удалить профиль и события</button>${!state.authenticated ? '<p class="profile-detail-hint">Открой Mini App через Telegram, чтобы управлять данными аккаунта.</p>' : ''}</div></section>`;
}

function subscriptionPage() {
  const subscription = state.subscription || {};
  const active = Boolean(subscription.active);
  const tariffLabel = subscription.plan_name || subscription.tariff_name || subscription.plan || subscription.tariff || (subscription.test_override ? 'Хозяйский' : 'Не указан');
  const rawExpiry = subscription.expires_at || subscription.active_until || subscription.valid_until || subscription.ends_at || subscription.current_period_end || null;
  const parsedExpiry = rawExpiry ? new Date(typeof rawExpiry === 'number' && rawExpiry < 1e12 ? rawExpiry * 1000 : rawExpiry) : null;
  const expiryLabel = parsedExpiry && !Number.isNaN(parsedExpiry.getTime())
    ? parsedExpiry.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Срок окончания не указан';
  return `<section class="page profile-page subscription-page">${profileDetailHeader('МОЙ АККАУНТ', 'Моя подписка', 'Статус подписки для этого Telegram-аккаунта.')}<div class="profile-card"><div class="profile-row subscription-row"><span class="service-icon ${active ? 'green' : 'muted'}">${icon('lock', 19)}</span><span class="row-copy subscription-row-copy"><strong>Моя подписка</strong></span><span class="subscription-status"><i class="${active ? 'active' : 'inactive'}"></i>${active ? 'Активна' : 'Не активна'}</span></div><div class="profile-row subscription-row"><span class="service-icon purple">${icon('spark', 19)}</span><span class="row-copy subscription-row-copy"><strong>Тариф</strong></span><span class="subscription-row-value">${escapeHtml(tariffLabel)}</span></div><div class="profile-row subscription-row"><span class="service-icon blue">${icon('clock', 19)}</span><span class="row-copy subscription-row-copy"><strong>Действует до</strong></span><span class="subscription-row-value">${escapeHtml(expiryLabel)}</span></div></div></section>`;
}

function nav() {
  const items = [['home', 'home', 'Главная'], ['services', 'grid', 'Сервисы'], ['profile', 'user', 'Профиль']];
  return `<nav class="bottom-nav" aria-label="Основная навигация">${items.map(([id, ico, label]) => `<button class="${state.tab === id || (state.tab === 'connection-tutorial' && state.tutorialReturnTab === id) || (id === 'profile' && ['subscription', 'notifications', 'support', 'privacy', 'receipt-email', 'delete-data', 'owner-statistics'].includes(state.tab)) ? 'active' : ''}" data-tab="${id}">${icon(ico, 21)}<span>${label}</span></button>`).join('')}</nav>`;
}

function modal() {
  if (!state.modal) return '';
  let body = '';
  if (state.modal === 'connect') body = `<div class="modal-icon blue">${icon('chat', 23)}</div><span class="eyebrow">ПОДКЛЮЧЕНИЕ TELEGRAM BUSINESS</span><h2>Подключение пока не выполняем</h2><p>Сначала собираем и проверяем приложение. Позже добавим безопасный сценарий подключения и покажем точные разрешения Telegram перед подтверждением.</p><div class="modal-callout">${icon('lock', 16)} Подключай только свой аккаунт и только те чаты, на обработку которых у тебя есть разрешение.</div><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'telegram') body = `<div class="modal-icon blue">${icon('user', 23)}</div><span class="eyebrow">TELEGRAM MINI APP</span><h2>Как открыть приложение в Telegram</h2><p>Сейчас Mini App ещё не привязана к кнопке бота. После загрузки обновлённого приложения настроим кнопку запуска через BotFather.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'privacy' || state.modal === 'about') body = `<div class="modal-icon green">${icon('shield', 23)}</div><span class="eyebrow">${state.modal === 'about' ? 'О SPYCHAU' : 'ПРОЗРАЧНОСТЬ'}</span><h2>${state.modal === 'about' ? 'Архив событий подключённых чатов' : 'Доступ и данные под твоим контролем'}</h2><p>Бот может получать только те события и сообщения, которые Telegram передаёт после того, как владелец аккаунта подключил бизнес-бота и выбрал чаты.</p><div class="privacy-points"><div>${icon('check', 16)}<span>Секретные чаты не доступны официальному Bot API</span></div><div>${icon('check', 16)}<span>Содержимое до подключения не появится в архиве</span></div><div>${icon('check', 16)}<span>Для фото используется сохранённый снимок сообщения Telegram</span></div><div>${icon('check', 16)}<span>Удалить профиль и сохранённые события можно из раздела «Профиль»</span></div></div><button class="button button-blue modal-primary" data-action="close">Закрыть ${icon('chevron', 16)}</button>`;
  if (state.modal === 'groups') body = `<div class="modal-icon purple">${icon('people', 23)}</div><span class="eyebrow">ГРУППОВЫЕ ЧАТЫ</span><h2>Это отдельная функция</h2><p>Подключение Telegram Business работает с разрешёнными личными чатами. Для группового режима нужно отдельно добавить бота в группу и корректно настроить его права. Этот сценарий пока не реализован.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'subscription') body = `<div class="modal-icon blue">${icon('lock', 23)}</div><span class="eyebrow">ПОДПИСКА</span><h2>Подключение подписки</h2><p>Покупка подписки пока не подключена. Сейчас её статус проверяется на сервере, а переключатель хозяйского режима доступен владельцу приложения в профиле.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'receipt-email') body = `<div class="modal-icon blue">${icon('mail', 23)}</div><span class="eyebrow">ЧЕКИ О ПОКУПКАХ</span><h2>Почта для чеков</h2><p>Укажи адрес, на который отправлять чеки о покупке. Его можно изменить в любой момент.</p><form id="receipt-email-form"><label for="receipt-email" style="display:block;font-size:11px;color:var(--muted);margin-bottom:7px">Электронная почта</label><input id="receipt-email" style="width:100%;background:#0d142a;border:1px solid var(--line);border-radius:13px;color:#f3f5ff;padding:12px;font:inherit;outline:none" name="email" type="email" value="${escapeHtml(state.user?.receipt_email || '')}" placeholder="name@example.com" autocomplete="email" maxlength="254" required><button class="button button-blue modal-primary" type="submit" ${state.receiptEmailSaving ? 'disabled' : ''}>${state.receiptEmailSaving ? 'Сохраняем…' : 'Сохранить'}</button></form>`;
  if (state.modal === 'support') body = `<div class="modal-icon blue">${icon('help', 23)}</div><span class="eyebrow">ПОДДЕРЖКА</span><h2>Контакт поддержки ещё не настроен</h2><p>Добавим его до запуска сервиса для пользователей.</p><button class="button button-blue modal-primary" data-action="close">Закрыть ${icon('chevron', 16)}</button>`;
  return `<div class="modal-backdrop" data-action="backdrop"><div class="modal">${body}<button class="modal-close" data-action="close" aria-label="Закрыть">${icon('close', 18)}</button></div></div>`;
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  const page = state.tab === 'home' ? home() : state.tab === 'services' ? services() : state.tab === 'archive' ? archive() : state.tab === 'connection-tutorial' ? connectionTutorialPage() : state.tab === 'subscription' ? subscriptionPage() : state.tab === 'notifications' ? notificationsPage() : state.tab === 'support' ? supportPage() : state.tab === 'privacy' ? privacyPage() : state.tab === 'receipt-email' ? receiptEmailPage() : state.tab === 'delete-data' ? deleteDataPage() : state.tab === 'owner-statistics' ? ownerStatisticsPage() : state.tab === 'about' ? aboutPage() : profile();
  const mainTabs = ['home', 'services', 'profile'];
  app.innerHTML = `<div class="app-shell"><div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>${state.tab === 'home' ? topbar() : ''}${mainTabs.includes(state.tab) ? '' : `<button type="button" class="desktop-back-button" data-action="app-back" aria-label="Назад">${icon('back', 19)}</button>`}<main>${page}</main>${nav()}${state.tab === 'about' ? '' : modal()}<div class="toast" role="status" aria-live="polite"></div></div>`;
  syncTelegramBackButton();
}

function toast(message) {
  const element = document.querySelector('.toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('visible');
  window.setTimeout(() => element.classList.remove('visible'), 2800);
}

async function api(path, options = {}) {
  if (!state.telegram?.initData) throw new Error('Открой приложение через Telegram.');
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), Authorization: `tma ${state.telegram.initData}`, ...options.headers }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Ошибка API (${response.status})`);
  return result;
}

async function loadMe() {
  if (state.preview) { render(); return; }
  state.loading = true;
  state.apiError = '';
  render();
  try {
    const auth = await api('/api/auth/telegram', { method: 'POST', body: JSON.stringify({ init_data: state.telegram.initData }) });
    state.user = auth.user;
    state.authenticated = Boolean(auth.authenticated);
    const result = await api('/api/me');
    state.user = result.user;
    state.connections = result.connections || [];
    state.subscription = { ...(result.subscription || {}), can_test_override: Boolean(result.can_test_override) };
    state.events = result.events || [];
    state.authenticated = true;
  } catch (error) {
    state.apiError = error.message || 'Не удалось загрузить данные';
  } finally {
    state.loading = false;
    state.subscriptionToggleLoading = false;
    render();
  }
}

async function loadArchive() {
  if (state.preview) { state.tab = 'archive'; render(); return; }
  state.archiveLoading = true;
  state.apiError = '';
  render();
  try {
    const result = await api('/api/archive');
    state.events = result.events || [];
  } catch (error) {
    if (error.message === 'subscription_required') {
      state.subscription = { ...state.subscription, active: false };
      state.events = [];
    } else {
      state.apiError = error.message || 'Не удалось загрузить архив';
    }
  } finally {
    state.archiveLoading = false;
    state.tab = 'archive';
    render();
  }
}

app.addEventListener('submit', async event => {
  if (event.target.id !== 'receipt-email-form') return;
  event.preventDefault();
  if (!state.authenticated) { toast('Открой приложение через Telegram, чтобы сохранить почту.'); return; }
  const form = event.target;
  const email = String(new FormData(form).get('email') || '').trim().toLowerCase();
  if (!email || email.length > 254) { form.reportValidity(); return; }
  state.receiptEmailSaving = true;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Сохраняем…';
  try {
    const result = await api('/api/me/receipt-email', { method: 'PUT', body: JSON.stringify({ email }) });
    state.user = { ...state.user, receipt_email: result.receipt_email };
    state.tab = 'profile';
    state.receiptEmailSaving = false;
    render();
    toast('Почта для чеков сохранена.');
  } catch (error) {
    state.receiptEmailSaving = false;
    button.disabled = false;
    button.textContent = 'Сохранить';
    toast(error.message || 'Не удалось сохранить почту.');
  }
});

app.addEventListener('click', async event => {
  const target = event.target.closest('[data-action], [data-tab], [data-tutorial], [data-archive-filter], [data-contact-id], [data-notification-toggle]');
  if (!target) return;
  if (target.dataset.action === 'backdrop' && event.target !== target) return;
  if (target.dataset.contactId) {
    pushNavigation();
    state.archiveContactId = target.dataset.contactId;
    state.archiveFilter = 'all';
    state.tab = 'archive';
    render();
    return;
  }
  if (target.dataset.action === 'archive-back') {
    goBack();
    return;
  }
  if (target.dataset.action === 'tutorial-back') {
    goBack();
    return;
  }
  if (target.dataset.action === 'copy-bot-name') {
    try {
      await navigator.clipboard.writeText('@SpyUndo_bot');
      toast('Имя бота скопировано.');
    } catch {
      const input = document.createElement('textarea');
      input.value = '@SpyUndo_bot';
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      toast(copied ? 'Имя бота скопировано.' : 'Скопируй имя бота: @SpyUndo_bot');
    }
    return;
  }
  if (target.dataset.action === 'open-telegram-business-settings') {
    window.location.href = 'tg://settings/business';
    return;
  }
  if (target.dataset.action === 'tutorial-help') {
    toast('Настройки → Telegram Business → Чат-боты. Там выбери @SpyUndo_bot и нужные чаты.');
    return;
  }
  if (target.dataset.tutorial) {
    pushNavigation();
    state.modal = null;
    state.tutorialType = target.dataset.tutorial;
    state.tutorialReturnTab = state.tab;
    state.tab = 'connection-tutorial';
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (target.dataset.tab) {
    state.modal = null;
    const profileDetailTabs = ['subscription', 'notifications', 'support', 'privacy', 'receipt-email', 'delete-data', 'owner-statistics'];
    if (target.dataset.tab === 'profile' && profileDetailTabs.includes(state.tab)) {
      if (state.navigationStack.length) goBack();
      else { state.tab = 'profile'; render(); }
      return;
    }
    if (target.dataset.tab === 'archive') {
      if (state.tab !== 'archive' || state.archiveContactId) pushNavigation();
      state.archiveContactId = null;
      state.archiveFilter = 'all';
      state.query = '';
      await loadArchive();
      return;
    }
    if (target.dataset.tab !== state.tab) pushNavigation();
    state.tab = target.dataset.tab;
    render();
    if (state.tab === 'owner-statistics') await loadOwnerStatistics();
    return;
  }
  if (target.dataset.archiveFilter) {
    state.archiveFilter = target.dataset.archiveFilter;
    render();
    return;
  }
  if (target.dataset.notificationToggle) {
    const key = target.dataset.notificationToggle;
    if (!['deleted_messages', 'edited_messages'].includes(key)) return;
    const next = { ...state.notificationPreferences, [key]: !state.notificationPreferences[key] };
    state.notificationPreferences = next;
    try { localStorage.setItem('spychau-notification-preferences', JSON.stringify(next)); }
    catch { toast('Не удалось сохранить выбор на этом устройстве.'); }
    render();
    toast('Выбор сохранён на этом устройстве.');
    return;
  }
  const action = target.dataset.action;
  if (action === 'toggle-theme') {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('spychau-theme', state.theme); } catch {}
    render();
    return;
  }
  if (action === 'app-back') { goBack(); return; }
  if (action === 'about') { pushNavigation(); state.modal = null; state.tab = 'about'; render(); return; }
  if (action === 'close' || action === 'backdrop') { state.modal = null; render(); return; }
  if (action === 'refresh') { await loadMe(); return; }
  if (action === 'refresh-archive') { await loadArchive(); return; }
  if (action === 'refresh-owner-statistics') { await loadOwnerStatistics(); return; }
  if (action === 'toggle-test-subscription') {
    if (!state.subscription?.can_test_override || state.subscriptionToggleLoading) return;
    state.subscriptionToggleLoading = true;
    render();
    try {
      await api('/api/subscription/test-override', { method: 'POST', body: JSON.stringify({ active: !Boolean(state.subscription.active) }) });
      await loadMe();
      toast(`Хозяйская подписка ${state.subscription?.active ? 'включена' : 'выключена'}.`);
    } catch (error) {
      state.subscriptionToggleLoading = false;
      toast(error.message || 'Не удалось изменить тестовую подписку.');
      render();
    }
    return;
  }
  if (action === 'subscription-info') { state.modal = 'subscription'; render(); return; }
  if (action === 'delete-data-confirm') {
    if (!state.authenticated) { toast('Открой Mini App из Telegram для управления данными.'); return; }
    if (!window.confirm('Удалить профиль и все события из архива? Это действие нельзя отменить.')) return;
    try {
      await api('/api/me/data', { method: 'DELETE' });
      state.user = null; state.connections = []; state.events = []; state.subscription = null; state.authenticated = false;
      state.tab = 'profile';
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

app.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains('contact-avatar-image')) return;
  image.parentElement?.classList.remove('has-photo');
  image.remove();
}, true);

app.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.modal) { state.modal = null; render(); }
});

if (state.telegram) {
  state.telegram.BackButton?.onClick?.(goBack);
  syncTelegramSafeArea();
  state.telegram.onEvent?.('safeAreaChanged', syncTelegramSafeArea);
  state.telegram.onEvent?.('contentSafeAreaChanged', syncTelegramSafeArea);
  state.telegram.onEvent?.('fullscreenChanged', syncTelegramSafeArea);
  state.telegram.onEvent?.('viewportChanged', syncTelegramSafeArea);
  window.addEventListener('resize', syncTelegramSafeArea, { passive: true });
  window.visualViewport?.addEventListener('resize', syncTelegramSafeArea, { passive: true });
  state.telegram.ready?.();
  state.telegram.expand?.();
  state.telegram.setHeaderColor?.('#14080c');
  state.telegram.setBackgroundColor?.('#14080c');
  if (!state.telegram.isFullscreen && typeof state.telegram.requestFullscreen === 'function') {
    try {
      Promise.resolve(state.telegram.requestFullscreen()).then(syncTelegramSafeArea).catch(syncTelegramSafeArea);
    } catch {
      syncTelegramSafeArea();
    }
  }
  state.user = state.telegram.initDataUnsafe?.user || null;
}
render();
if (!state.preview) loadMe();
