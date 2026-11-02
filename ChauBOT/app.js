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
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M7 15h3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'eye-off': '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9 4 10 7a11.7 11.7 0 0 1-3.1 4.4M6.2 6.2C4.1 7.5 2.6 9.4 2 12c1 3 5 7 10 7 1.2 0 2.3-.2 3.3-.7"/>',
    refresh: '<path d="M20 7v5h-5"/><path d="M4.8 9A8 8 0 0 1 18.6 6L20 7M4 17v-5h5"/><path d="M19.2 15A8 8 0 0 1 5.4 18L4 17"/>',
    external: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};

const state = {
  tab: new URLSearchParams(window.location.search).get('open') === 'archive' ? 'archive' : 'home', modal: null, query: '', archiveMode: 'contacts', archiveContactId: null, archiveGroupId: null, archiveTopicId: null, archiveGroupsAvailable: true, archiveGroups: [], archiveTopics: [], groupArchiveEvents: [], archiveFilter: 'all', archiveCursor: null, archiveHasMore: false, archiveLoadingMore: false, archiveLoadMoreError: '', groupArchiveCursor: null, groupArchiveHasMore: false, groupArchiveLoadingMore: false, groupArchiveLoadMoreError: '', groupArchiveEventCounts: {}, groupArchiveTopicEventCounts: {}, user: null, connections: [], events: [], subscription: null, groupEntitlement: null,
  tutorialType: null, tutorialReturnTab: 'home', navigationStack: [],
  tariffMode: 'unlimited', selectedTariff: 'month', selectedGroupTariff: 'groups10',
  notificationPreferences: loadNotificationPreferences(),
  notificationPreferencesSaving: false,
  loading: false, eventFeedLoading: false, eventFeedError: '', archiveLoading: false, groupArchiveLoading: false, groupArchiveError: '', paymentLoading: false, paymentSheetOpen: false, paymentTermsAccepted: false, paymentSelection: null, tributeCheckoutPending: false, tributeCheckoutPreviousEntitlements: '', paymentsAvailable: false, packagePaymentsAvailable: false, groupPaymentsAvailable: false, tributePlanAvailability: {}, packageBalance: null, ownerStatistics: null, ownerStatisticsLoading: false, ownerTestGroup: [], ownerTestGroupLoading: false, ownerTestGroupAdding: false, ownerTestGroupError: '', apiError: '', telegram: window.Telegram?.WebApp || null,
  authenticated: false, preview: !window.Telegram?.WebApp?.initData
};

function pushNavigation() {
  const snapshot = {
    tab: state.tab,
    archiveContactId: state.archiveContactId,
    archiveMode: state.archiveMode,
    archiveGroupId: state.archiveGroupId,
    archiveTopicId: state.archiveTopicId,
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
  else if (state.tab === 'archive' && (state.archiveContactId != null || state.archiveTopicId != null || state.archiveGroupId != null)) {
    if (state.archiveTopicId != null) state.archiveTopicId = null;
    else if (state.archiveGroupId != null) state.archiveGroupId = null;
    else state.archiveContactId = null;
  }
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

function loadNotificationPreferences() {
  const defaults = { deleted_messages: true, edited_messages: true, one_time_messages: true, group_messages: false, deleted_by_owner: false, edited_by_owner: false };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('spychau-notification-preferences') || '{}') }; }
  catch { return defaults; }
}
const app = document.querySelector('#root');

function syncTelegramSafeArea() {
  const safeTop = Number(state.telegram?.safeAreaInset?.top) || 0;
  const contentTop = Number(state.telegram?.contentSafeAreaInset?.top) || 0;
  const safeBottom = Number(state.telegram?.safeAreaInset?.bottom) || 0;
  const contentBottom = Number(state.telegram?.contentSafeAreaInset?.bottom) || 0;
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
  document.documentElement.style.setProperty('--app-mobile-bottom-inset', `${Math.max(safeBottom, contentBottom)}px`);
  document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function racer(small = false, subscriptionActive = true) {
  const image = small
    ? './assets/mascot/kchau-trophies.png'
    : subscriptionActive
      ? './assets/mascot/scout-active.png'
      : './assets/mascot/scout-inactive.png';
  return `<div class="racer ${small ? 'racer-small' : 'scout-mascot'}" aria-hidden="true"><img src="${image}" alt="" /></div>`;
}

function displayName() {
  return state.user?.first_name || state.user?.username || 'Гонщик';
}

function topbar() {
  return `<header class="topbar"><div class="brand-mark">${state.authenticated && typeof state.user?.photo_url === 'string' && state.user.photo_url.toLowerCase().startsWith('https://') ? `<img src="${escapeHtml(state.user.photo_url)}" alt="" referrerpolicy="no-referrer">` : '<span>SK</span>'}<i></i></div><div class="brand-copy"><strong>SpySkaut</strong><span>Привет, ${escapeHtml(displayName())}</span></div><button class="icon-button" aria-label="О приложении" data-action="about">${icon('help', 19)}</button><button class="icon-button sun-button" aria-label="Уведомления" data-tab="archive">${icon('bell', 19)}</button></header>`;
}

function connectCard() {
  const activeCount = state.connections.filter(connection => Number(connection.enabled) === 1).length;
  const personalConnected = activeCount > 0;
  const count = activeCount ? '1 из 2' : '0 из 2';
  const connectButton = type => `<button type="button" class="button button-blue connect-cta" data-tutorial="${type}">Подключить</button>`;
  const connectedMark = `<span class="connection-done" role="status" aria-label="Подключено">${icon('check', 20)}</span>`;
  return `<div class="connect-card"><div class="connect-card-heading"><strong>Подключения</strong><span class="count-badge" style="border:0;background:none;padding:0;color:var(--muted)">${count}</span></div><div class="connect-row"><div class="service-icon blue home-personal">${icon('chat', 20)}</div><div class="row-copy"><strong>Личные чаты</strong><span>${personalConnected ? 'Подключение активно' : state.preview ? 'Открой приложение через Telegram' : 'Пока не подключены'}</span></div>${personalConnected ? connectedMark : connectButton('personal')}</div><div class="divider"></div><div class="connect-row"><div class="service-icon purple home-groups">${icon('people', 20)}</div><div class="row-copy"><strong>Группы</strong><span>Пока не подключены</span></div><button type="button" class="button button-purple connect-cta" data-tab="group-tariffs">Подключить</button></div></div>`;
}

function connectionTutorialPage() {
  const personal = state.tutorialType !== 'groups';
  const header = `<button type="button" class="profile-detail-back" data-action="tutorial-back">${icon('chevron', 16)} Назад</button>`;
  if (personal) return `<section class="page connection-tutorial-page"><div class="tutorial-intro">${header}<div class="tutorial-heading"><span class="eyebrow">ПОДКЛЮЧЕНИЕ</span><h1>Подключи меня<br>к личным чатам</h1><p>Три шага, одна минута — и я начну сохранять новые изменения и события.</p></div><div class="tutorial-mascot-space" aria-hidden="true"></div></div><div class="tutorial-step-list"><article class="tutorial-step-card"><span class="tutorial-step-number">1</span><div class="tutorial-step-content"><h2>Скопируй моё имя</h2><div class="tutorial-copy-row"><strong>@SpySkaut_bot</strong><button type="button" class="tutorial-copy-button" data-action="copy-bot-name">${icon('archive', 16)} Копировать</button></div></div></article><article class="tutorial-step-card"><span class="tutorial-step-number">2</span><div class="tutorial-step-content"><h2>Открой «Автоматизацию чатов»</h2><p>В настройках открой свой профиль, нажми «Изм.» и выбери автоматизацию чатов.</p><div class="tutorial-breadcrumb"><span>Настройки</span>${icon('chevron', 13)}<span>Изм.</span>${icon('chevron', 13)}<b>Автоматизация чатов</b></div></div></article><article class="tutorial-step-card"><span class="tutorial-step-number">3</span><div class="tutorial-step-content"><h2>Вставь имя и сохрани</h2><p>Дай доступ ко всем личным чатам — или только к нужным.</p></div></article></div><div class="tutorial-loop" role="img" aria-label="Зацикленная демонстрация подключения SpySkaut_bot в Telegram"><div class="tutorial-loop-head"><span></span><b>Как подключить SpySkaut_bot</b><small>Анимация шагов</small></div><div class="tutorial-loop-scenes"><div class="tutorial-loop-scene scene-settings"><div class="telegram-mock-top"><span>‹</span><b>Настройки</b></div><div class="telegram-mock-row">Уведомления и звуки <i>›</i></div><div class="telegram-mock-row">Конфиденциальность <i>›</i></div><div class="telegram-mock-row focus">Профиль <i>›</i></div><div class="telegram-mock-caption">Открой свой профиль в настройках</div></div><div class="tutorial-loop-scene scene-business"><div class="telegram-mock-top"><span>‹</span><b>Изменить профиль</b></div><div class="telegram-mock-row">Имя</div><div class="telegram-mock-row">Имя пользователя</div><div class="telegram-mock-row focus">Автоматизация чатов <i>›</i></div><div class="telegram-mock-caption">Нажми «Изм.» и открой автоматизацию чатов</div></div><div class="tutorial-loop-scene scene-bot"><div class="telegram-mock-top"><span>‹</span><b>Автоматизация чатов</b></div><div class="telegram-mock-bot"><span>SK</span><b>SpySkaut_bot<small>@SpySkaut_bot</small></b></div><div class="telegram-mock-action">Подключить бота</div><div class="telegram-mock-caption">Выбери нашего бота</div></div><div class="tutorial-loop-scene scene-chats"><div class="telegram-mock-top"><span>‹</span><b>Доступ к чатам</b></div><div class="telegram-mock-row">Личные чаты</div><div class="telegram-mock-row">Максим <i class="mock-check">✓</i></div><div class="telegram-mock-row">Аня <i class="mock-check">✓</i></div><div class="telegram-mock-action">Сохранить</div><div class="telegram-mock-caption">Дай доступ ко всем личным чатам или выбери нужные</div></div></div><div class="tutorial-loop-progress"><i></i><i></i><i></i><i></i></div></div><div class="tutorial-footer"><button type="button" class="button tutorial-open-settings" data-action="open-telegram-business-settings">Открыть настройки Telegram ${icon('arrow', 19)}</button><button type="button" class="tutorial-help-link" data-action="tutorial-help">${icon('help', 15)} Не получается? Помогу</button></div></section>`;
  return `<section class="page connection-tutorial-page">${header}<div class="tutorial-intro"><div class="tutorial-heading"><span class="eyebrow">ПОДКЛЮЧЕНИЕ</span><h1>Подключи SpySkaut<br>к беседе</h1><p>Добавь бота в группу и назначь его администратором, чтобы Telegram передавал изменения сообщений.</p></div></div><div class="tutorial-step-list"><article class="tutorial-step-card"><span class="tutorial-step-number">1</span><div class="tutorial-step-content"><h2>Добавь бота в беседу</h2><p>Выбери нужную группу и пригласи в неё @SpySkaut_bot.</p></div></article><article class="tutorial-step-card"><span class="tutorial-step-number">2</span><div class="tutorial-step-content"><h2>Назначь администратора</h2><p>Это нужно, чтобы бот видел сообщения и их изменения. Дополнительные права не выдавай.</p></div></article><article class="tutorial-step-card"><span class="tutorial-step-number">3</span><div class="tutorial-step-content"><h2>Открой архив событий</h2><p>Беседа появится здесь после подключения. Для уведомлений включи «Сообщения в группах» в настройках профиля.</p></div></article></div><div class="tutorial-note tutorial-note-pending">Сейчас сохраняются изменения сообщений в темах и обычных групповых чатах. Обычные удаления Telegram боту не передаёт; эту часть добавим позже. Оплата группового тарифа пока не подключена.</div><div class="tutorial-footer"><button type="button" class="button button-blue tutorial-open-settings" data-action="add-group-bot">Добавить SpySkaut в беседу ${icon('arrow', 19)}</button></div></section>`;
}

function archiveEventKind(event) {
  if (event?.group_event) {
    if (event.event_type === 'edited') return 'edited';
    if (event.event_type === 'deleted') return 'deleted';
    if (event.event_type === 'new' && (event.message?.__spychau_one_time_saved || Number(event.message?.ttl_period) > 0)) return 'one-time';
    return null;
  }
  if (!isEventVisibleByNotificationPreferences(event)) return null;
  if (event.event_type === 'deleted') return 'deleted';
  if (event.event_type === 'edited') return 'edited';
  if (event.event_type === 'new') return 'one-time';
  return null;
}

function isEventVisibleByNotificationPreferences(event) {
  if (event?.group_event) return true;
  const preferences = state.notificationPreferences || {};
  const message = event?.message || {};
  const chat = message.chat || event?.previous_message?.chat || {};
  if ((chat.type === 'group' || chat.type === 'supergroup') && !preferences.group_messages) return false;

  if (event?.event_type === 'deleted' || event?.event_type === 'edited') {
    const senderId = message.from?.id;
    if (senderId == null || state.user?.id == null) return false;
    const isOwnerAuthored = String(senderId) === String(state.user.id);
    const preferenceKey = event.event_type === 'deleted'
      ? (isOwnerAuthored ? 'deleted_by_owner' : 'deleted_messages')
      : (isOwnerAuthored ? 'edited_by_owner' : 'edited_messages');
    return Boolean(preferences[preferenceKey]);
  }

  if (event?.event_type !== 'new') return false;
  const senderId = message.from?.id;
  const isOwnerAuthored = state.user?.id != null && senderId != null && String(senderId) === String(state.user.id);
  const isOneTimeMessage = message.__spychau_one_time_saved === true
    || Number(message.ephemeral_message_id) > 0
    || Number(message.receiver_user?.id) > 0
    || Number(message.ttl_period) > 0;
  return state.user?.id != null && senderId != null && !isOwnerAuthored && isOneTimeMessage && Boolean(preferences.one_time_messages);
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
  if (event.previous_message) return { message: event.previous_message };
  return state.events.find(candidate => candidate.event_type !== 'deleted'
    && String(candidate.chat_id) === String(event.chat_id)
    && String(candidate.message_id) === String(event.message_id)
    && Number(candidate.id) < Number(event.id)) || null;
}

function archiveEventText(event) {
  const kind = archiveEventKind(event);
  const previous = previousMessageSnapshot(event);
  if (kind === 'deleted') {
    if (previous) return eventDescription(previous);

    // The API hydrates deleted events with their encrypted source snapshot.
    // On the home screen that source row may be outside the 25-event preview.
    const message = event.message || {};
    const hasSnapshotContent = typeof message.text === 'string'
      || typeof message.caption === 'string'
      || ['photo', 'video', 'voice', 'video_note', 'document', 'audio', 'animation', 'sticker'].some(field => message[field] != null);
    if (hasSnapshotContent) return eventDescription(event);

    return `Текст не сохранился · ID сообщения ${event.message_id || '—'}`;
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

function archiveEventRow(event, showEditedDiff = false) {
  const kind = archiveEventKind(event);
  const iconName = kind === 'deleted' ? 'close' : kind === 'one-time' ? 'clock' : event.message?.voice ? 'mic' : event.message?.photo ? 'image' : 'chat';
  const original = kind === 'deleted' ? previousMessageSnapshot(event) : null;
  const previous = kind === 'edited' ? previousMessageSnapshot(event) : null;
  const previousText = previous ? eventDescription(previous) : '';
  const currentText = eventDescription(event);
  const editedDiff = showEditedDiff && previous && previousText !== currentText
    ? `<div class="edited-message-diff"><div class="edited-message-version edited-message-before"><strong>Было:</strong><span>${escapeHtml(previousText)}</span></div><div class="edited-message-version edited-message-after"><strong>Стало:</strong><span>${escapeHtml(currentText)}</span></div></div>`
    : showEditedDiff && event.group_event && event.event_type === 'edited' && !previous
      ? `<div class="edited-message-diff"><div class="edited-message-version edited-message-after"><strong>Изменено:</strong><span>${escapeHtml(currentText)}</span></div><small class="archive-disclaimer">Исходная версия не сохранилась: бот подключили позже.</small></div>`
    : `<span>${escapeHtml(archiveEventText(event))}</span>`;
  const imageUrl = event.media_url || original?.media_url;
  const mediaItems = Array.isArray(event.media) ? event.media : [];
  const fallbackPhoto = !mediaItems.length && imageUrl
    ? `<a class="event-photo-link" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener" aria-label="Открыть сохранённую фотографию"><img class="event-photo" src="${escapeHtml(imageUrl)}" alt="Фотография из сообщения" loading="lazy" /></a>`
    : '';
  const media = mediaItems.map((asset) => {
    const src = escapeHtml(asset.url || '');
    if (!src) return '';
    if (asset.kind === 'photo') return `<a class="event-photo-link" href="${src}" target="_blank" rel="noopener" aria-label="Открыть сохранённую фотографию"><img class="event-photo" src="${src}" alt="Фотография из сообщения" loading="lazy" /></a>`;
    if (asset.kind === 'voice' || asset.kind === 'audio') return `<audio class="event-audio" controls preload="none" src="${src}">Браузер не поддерживает воспроизведение аудио.</audio>`;
    if (asset.kind === 'video' || asset.kind === 'video_note' || asset.kind === 'animation') return `<video class="event-video" controls playsinline preload="metadata" src="${src}">Браузер не поддерживает воспроизведение видео.</video>`;
    return `<a class="event-file-link" href="${src}" target="_blank" rel="noopener" download>${escapeHtml(asset.file_name || 'Открыть сохранённый файл')}</a>`;
  }).join('');
  return `<article class="event-row contact-event-row"><div class="event-type-icon ${kind}">${icon(iconName, 18)}</div><div class="event-copy"><div class="event-title-line"><strong>${escapeHtml(eventTitle(event))}</strong><time>${escapeHtml(formatDate(event.created_at))}</time></div>${editedDiff}${media || fallbackPhoto}</div></article>`;
}

function archiveModeTabs() {
  return `<div class="archive-mode-tabs" role="tablist" aria-label="История событий"><button type="button" role="tab" aria-selected="${state.archiveMode === 'contacts'}" class="${state.archiveMode === 'contacts' ? 'active' : ''}" data-archive-mode="contacts">Контакты</button><button type="button" role="tab" aria-selected="${state.archiveMode === 'groups'}" class="${state.archiveMode === 'groups' ? 'active' : ''}" data-archive-mode="groups">Группы</button></div>`;
}

function archivePageHeading(title, subtitle) {
  return `<div class="page-title archive-title"><span class="eyebrow">ИСТОРИЯ СОБЫТИЙ</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>${archiveModeTabs()}`;
}

function archiveLoadMoreControl(groupMode = false) {
  const hasMore = groupMode ? state.groupArchiveHasMore : state.archiveHasMore;
  const loading = groupMode ? state.groupArchiveLoadingMore : state.archiveLoadingMore;
  const error = groupMode ? state.groupArchiveLoadMoreError : state.archiveLoadMoreError;
  if (!hasMore && !error) return '';
  const action = groupMode ? 'load-more-group-archive' : 'load-more-archive';
  return `<div class="archive-load-more">${error ? `<p>${escapeHtml(error)}</p>` : ''}<button type="button" class="subtle-button" data-action="${action}" ${loading ? 'disabled' : ''}>${loading ? 'Загружаем…' : error ? 'Повторить загрузку' : 'Загрузить ещё'}</button></div>`;
}

function archiveGroupCard(group) {
  const id = String(group.chat_id);
  const topics = state.archiveTopics.filter(topic => String(topic.chat_id) === id);
  const events = Number(state.groupArchiveEventCounts[id] || 0);
  const botStatus = group.bot_status === 'administrator'
    ? 'Бот подключён как администратор'
    : 'Назначь бота администратором, чтобы он видел сообщения';
  return `<button type="button" class="archive-group-card" data-archive-group="${escapeHtml(id)}"><span class="archive-group-icon">${icon('people', 20)}</span><span class="archive-group-copy"><strong>${escapeHtml(group.title || 'Беседа')}</strong><small>${escapeHtml(botStatus)}</small></span><span class="archive-group-count">${events.length}</span>${icon('chevron', 16)}</button>`;
}

function archiveTopicCard(groupId, topic) {
  const id = String(topic.thread_id || '');
  const events = Number(state.groupArchiveTopicEventCounts[`${groupId}:${id}`] || 0);
  return `<button type="button" class="archive-group-card archive-topic-card" data-archive-topic="${escapeHtml(id)}"><span class="archive-topic-icon">${icon('chat', 19)}</span><span class="archive-group-copy"><strong>${escapeHtml(topic.name || (id ? `Тема ${id}` : 'Общие'))}</strong><small>${events ? `${events} ${plural(events, 'изменение', 'изменения', 'изменений')}` : 'Пока нет изменений'}</small></span><span class="archive-group-count">${events}</span>${icon('chevron', 16)}</button>`;
}

function archiveGroupsPage() {
  const query = state.query.trim().toLocaleLowerCase('ru');
  const group = state.archiveGroups.find(item => String(item.chat_id) === String(state.archiveGroupId));
  const savedTopics = state.archiveTopics.filter(item => String(item.chat_id) === String(state.archiveGroupId));
  const topics = group && !savedTopics.length ? [{ chat_id: group.chat_id, thread_id: '', name: 'Общие' }] : savedTopics;
  const topic = state.archiveTopicId == null ? null : topics.find(item => String(item.thread_id || '') === String(state.archiveTopicId));
  const selectedEvents = state.groupArchiveEvents.filter(event =>
    String(event.chat_id) === String(state.archiveGroupId)
    && (state.archiveTopicId == null || String(event.message_thread_id || '') === String(state.archiveTopicId))
    && (state.archiveFilter === 'all' || event.event_type === state.archiveFilter)
    && (!query || `${eventDescription(event)} ${eventTitle(event)}`.toLocaleLowerCase('ru').includes(query))
  );
  const heading = archivePageHeading(group ? (topic ? topic.name || 'Общие' : group.title || 'Беседа') : 'Группы', group ? (topic ? `Изменения в теме беседы «${group.title || 'Беседа'}».` : 'Темы и чаты внутри подключённой беседы.') : 'Беседы, в которых SpySkaut получил изменения сообщений.');
  if (state.groupArchiveLoading) return `<section class="page archive-page">${heading}<div class="archive-state"><div class="loading-indicator"></div><strong>Загружаем группы…</strong></div></section>`;
  if (state.groupArchiveError) return `<section class="page archive-page">${heading}<div class="archive-state"><strong>Не удалось загрузить группы</strong><p>${escapeHtml(state.groupArchiveError)}</p><button class="subtle-button" data-action="refresh-group-archive">Повторить</button></div></section>`;
  if (!group) {
    const groups = state.archiveGroups.filter(item => !query || `${item.title || ''} ${item.username || ''}`.toLocaleLowerCase('ru').includes(query));
    const content = !state.archiveGroupsAvailable
      ? `<div class="archive-state">${icon('lock', 24)}<strong>Группы пока в тестовом режиме</strong><p>Сохранение изменений уже подготовлено. Подключение и оплата группового тарифа появятся после завершения этой части.</p></div>`
      : groups.length
      ? groups.map(archiveGroupCard).join('')
      : `<div class="archive-state">${icon('people', 24)}<strong>${query ? 'Беседа не найдена' : 'Пока нет подключённых бесед'}</strong><p>${query ? 'Попробуй изменить запрос.' : 'Добавь SpySkaut в групповую беседу как администратора. Новые изменения будут появляться здесь; обычные удаления пока не поддерживаются Telegram Bot API.'}</p>${!query ? `<button type="button" class="button button-blue" data-tutorial="groups">Как подключить ${icon('chevron', 15)}</button>` : ''}</div>`;
    return `<section class="page archive-page">${heading}<label class="search-field">${icon('search', 17)}<input id="archive-search" value="${escapeHtml(state.query)}" placeholder="Поиск беседы" autocomplete="off"></label><div class="archive-summary"><span>${state.archiveGroups.length} ${plural(state.archiveGroups.length, 'беседа', 'беседы', 'бесед')}</span><button class="text-button" data-action="refresh-group-archive">Обновить ${icon('arrow', 15)}</button></div><div class="archive-group-list">${content}</div><div class="archive-disclaimer">${icon('shield', 16)}<span>В этой версии сохраняются изменения. Отслеживание удалений добавим отдельно.</span></div></section>`;
  }
  if (!topic) {
    const topicList = topics.length ? topics : [{ chat_id: group.chat_id, thread_id: '', name: 'Общие' }];
    const matching = topicList.filter(item => !query || `${item.name || ''}`.toLocaleLowerCase('ru').includes(query));
    return `<section class="page archive-page">${heading}<button type="button" class="archive-back" data-action="archive-group-back">${icon('chevron', 16)} Все группы</button><label class="search-field">${icon('search', 17)}<input id="archive-search" value="${escapeHtml(state.query)}" placeholder="Поиск чата или темы" autocomplete="off"></label><div class="archive-summary"><span>${matching.length} ${plural(matching.length, 'чат', 'чата', 'чатов')}</span></div><div class="archive-group-list">${matching.length ? matching.map(item => archiveTopicCard(group.chat_id, item)).join('') : `<div class="archive-state"><strong>Чаты не найдены</strong><p>Попробуй изменить запрос.</p></div>`}</div></section>`;
  }
  const filters = [['all', 'Все'], ['edited', 'Изменено']];
  const filterButtons = filters.map(([id, label]) => `<button type="button" class="archive-filter ${state.archiveFilter === id ? 'active' : ''}" data-archive-filter="${id}" aria-pressed="${state.archiveFilter === id}">${label}</button>`).join('');
  return `<section class="page archive-page">${heading}<button type="button" class="archive-back" data-action="archive-topic-back">${icon('chevron', 16)} ${escapeHtml(group.title || 'Беседа')}</button><div class="archive-filters" role="group" aria-label="Категории событий">${filterButtons}</div>${state.groupArchiveHasMore ? '<p class="archive-search-hint">Поиск выполняется по загруженным изменениям. Загрузи ещё, чтобы расширить поиск.</p>' : ''}${selectedEvents.length ? `<div class="archive-summary"><span>${selectedEvents.length} ${plural(selectedEvents.length, 'изменение', 'изменения', 'изменений')}</span></div><div class="events-list archive-list">${selectedEvents.map(event => archiveEventRow(event, true)).join('')}</div>` : `<div class="archive-state"><strong>Пока нет изменений</strong><p>Когда сообщение в этой теме отредактируют, изменение появится здесь. Удаления добавим позже.</p></div>`}${archiveLoadMoreControl(true)}</section>`;
}

function home() {
  const subscription = state.subscription || {};
  const subscriptionActive = Boolean(subscription.active);
  const packageActive = !subscriptionActive && Number(state.packageBalance?.remaining || 0) > 0;
  const accessActive = subscriptionActive || packageActive;
  const rawExpiry = subscription.expires_at || subscription.active_until || subscription.valid_until || subscription.ends_at || subscription.current_period_end || null;
  const parsedExpiry = rawExpiry ? new Date(typeof rawExpiry === 'number' && rawExpiry < 1e12 ? rawExpiry * 1000 : rawExpiry) : null;
  const expiryDate = parsedExpiry && !Number.isNaN(parsedExpiry.getTime())
    ? parsedExpiry.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const subscriptionExpired = !subscriptionActive && Boolean(parsedExpiry && !Number.isNaN(parsedExpiry.getTime()) && parsedExpiry.getTime() <= Date.now());
  const recentEvents = state.events.filter(archiveEventKind).sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0) || (Number(b.id) || 0) - (Number(a.id) || 0)).slice(0, 5);
  const feed = state.loading || state.eventFeedLoading
    ? `<div class="empty-events"><div class="loading-indicator"></div><strong>Загружаем события</strong><p>Основные разделы уже готовы.</p></div>`
    : state.eventFeedError
      ? `<div class="empty-events"><strong>Не удалось загрузить события</strong><p>Остальные разделы приложения работают.</p><button class="subtle-button" data-action="refresh-home-events">${icon('arrow', 15)} Повторить</button></div>`
      : recentEvents.length
        ? `<div class="events-list home-event-feed">${recentEvents.map(event => archiveEventRow(event)).join('')}</div>`
        : `<div class="empty-events empty-events-with-mascot"><div class="empty-art search-mascot"><img src="./assets/mascot/scout-observing.png" alt="Скаут наблюдает за событиями" /></div><strong>${state.preview ? 'Предпросмотр интерфейса' : 'Пока ничего не вижу'}</strong><p>${state.preview ? 'Для личных данных открой Mini App из Telegram.' : state.apiError ? 'Обнови приложение и попробуй снова.' : 'Когда появятся события из подключённых чатов, они отобразятся здесь.'}</p>${state.apiError ? `<button class="subtle-button" data-action="refresh">${icon('arrow', 15)} Повторить загрузку</button>` : ''}</div>`;
  const subscriptionTitle = subscriptionActive ? 'Подписка активна' : packageActive ? 'Пакет активен' : subscriptionExpired ? 'Подписка закончилась' : 'Подписка не активна';
  const subscriptionDescription = subscriptionActive
    ? 'Я в строю, сохраняю события и архив.'
    : packageActive ? 'Сохраняю уведомления из личных чатов и списываю их из пакета.'
    : subscriptionExpired
      ? 'Срок подписки истёк. Продли её, чтобы я продолжил сохранять события.'
      : 'Я не на посту и не сохраняю события. Подключай — вернусь в строй.';
  const subscriptionAction = accessActive
    ? subscriptionActive
      ? `<div class="home-subscription-status" role="status"><strong>Безлимит</strong> действует до <span class="home-subscription-expiry">${expiryDate ? escapeHtml(expiryDate) : '∞'}</span></div>`
      : `<div class="home-subscription-status" role="status">Осталось <strong>${new Intl.NumberFormat('ru-RU').format(state.packageBalance.remaining)} событий</strong> из ${new Intl.NumberFormat('ru-RU').format(state.packageBalance.purchased)}</div><button class="subtle-button" data-tab="tariffs">Пополнить пакет ${icon('chevron', 15)}</button>`
    : `<button class="button button-light" data-tab="tariffs"><span class="button-stencil-text">${subscriptionExpired ? 'Продлить' : 'Подключить'}</span>${icon('chevron', 16)}</button>`;
  return `<section class="page home-page"><div class="hero-card"><div class="hero-copy"><h1 class="subscription-heading"><span class="subscription-dot ${accessActive ? 'active' : 'inactive'}" aria-hidden="true"></span>${subscriptionTitle}</h1><p>${subscriptionDescription}</p>${subscriptionAction}</div>${racer(false, accessActive)}</div>${connectCard()}<div class="section-heading event-heading"><div><h2>Что происходило</h2></div><button class="text-button" data-tab="archive">Все ${icon('chevron', 17)}</button></div>${feed}<div class="trust-note">${icon('shield', 17)}<span>Доступ и выбранные чаты контролируешь ты.</span></div></section>`;
}

function services() {
  const activeCount = state.connections.filter(connection => Number(connection.enabled) === 1).length;
  const connectedButton = `<span class="button button-connected" role="status">Подключено</span>`;
  const personalButton = activeCount ? connectedButton : `<button class="button button-blue" data-tutorial="personal">Подключить ${icon('chevron', 16)}</button>`;
  const groupsButton = `<button class="button button-purple" data-tab="group-tariffs">Подключить ${icon('chevron', 16)}</button>`;
  return `<section class="page services-page"><div class="page-title"><h1>Сервисы</h1><p>Всё, что я умею - подключай нужное</p></div><div class="service-card featured-service"><div class="service-card-top"><div class="service-icon service-personal large">${icon('chat', 24)}</div><div><h2>Личные чаты</h2><p>Архив событий из чатов, которые ты разрешил подключённому боту.</p></div></div><div class="service-card-bottom"><span class="green-label">${icon('check', 15)} ${state.preview ? 'Доступно после запуска в Telegram' : `${activeCount} активных подключений`}</span>${personalButton}</div><div class="card-glow"></div></div><div class="service-card"><div class="service-card-top"><div class="service-icon service-groups large">${icon('people', 24)}</div><div><h2>Группы</h2><p>Тарифы для сохранения событий из подключённых групп.</p></div></div><div class="service-card-bottom"><span class="group-price-label">54 рубля за группу</span>${groupsButton}</div></div><div class="service-card archive-service"><div class="service-card-top"><div class="service-icon service-archive large">${icon('archive', 24)}</div><div><h2>Архив событий</h2><p>Список новых, изменённых и удалённых сообщений, полученных после подключения.</p></div></div><div class="service-card-bottom"><span class="lock-label">${icon('clock', 14)} ${state.preview ? 'Открой через Telegram' : `${state.events.length} событий загружено`}</span><button class="button button-blue" data-tab="archive">Открыть архив ${icon('chevron', 16)}</button></div></div><div class="coming-card"><span class="coming-label">СКОРО</span><div class="coming-content"><div><h2>Дополнительные возможности</h2><p>${icon('spark', 14)} AI анализ переписки</p><p>${icon('spark', 14)} Задачи из чатов</p></div><div class="racer racer-small" aria-hidden="true"><img src="./assets/mascot/scout-coming-soon-v2.png" alt="" /></div></div></div><button type="button" class="service-card tariff-entry" data-tab="tariffs"><div class="service-card-top"><div class="service-icon service-tariffs large">${icon('card', 24)}</div><div><h2>Тарифы и оплата</h2><p>Безлимитная подписка или пакет уведомлений для личных чатов.</p></div>${icon('chevron', 18)}</div></button></section>`;
}

const TARIFF_CATALOG = {
  package: [
    { id: 'pack100', title: '100 уведомлений', quantity: 100, priceRub: 189, stars: 118 },
    { id: 'pack300', title: '300 уведомлений', quantity: 300, priceRub: 499, stars: 312, badge: 'Хит' },
    { id: 'pack500', title: '500 уведомлений', quantity: 500, priceRub: 699, stars: 437 },
  ],
  unlimited: [
    { id: 'month', title: '1 месяц', months: 1, priceRub: 249, stars: 156, hint: '249 ₽ в месяц' },
    { id: 'half-year', title: '6 месяцев', months: 6, priceRub: 1190, stars: 745 },
    { id: 'year', title: '12 месяцев', months: 12, priceRub: 1790, stars: 1119 },
  ],
};

function tariffPriceLabel(priceRub) {
  return `${new Intl.NumberFormat('ru-RU').format(priceRub)} ₽`;
}

function tariffPlans(mode) {
  const plans = TARIFF_CATALOG[mode];
  if (mode === 'package') {
    const basePricePerEvent = plans[0].priceRub / plans[0].quantity;
    return plans.map(plan => {
      const pricePerEvent = plan.priceRub / plan.quantity;
      const discount = Math.round((1 - pricePerEvent / basePricePerEvent) * 100);
      return {
        ...plan,
        hint: `${pricePerEvent.toFixed(2).replace('.', ',')} ₽ за уведомление`,
        discount: discount ? `−${discount}%` : '',
        starsLabel: new Intl.NumberFormat('ru-RU').format(plan.stars),
        price: tariffPriceLabel(plan.priceRub),
      };
    });
  }

  return plans.map(plan => {
    const monthlyPrice = plan.priceRub / plan.months;
    const discount = Math.round((1 - plan.priceRub / (TARIFF_CATALOG.unlimited[0].priceRub * plan.months)) * 100);
    return {
      ...plan,
      hint: plan.hint || `${Math.round(monthlyPrice)} ₽ в месяц`,
      discount: discount ? `−${discount}%` : '',
      starsLabel: new Intl.NumberFormat('ru-RU').format(plan.stars),
      price: tariffPriceLabel(plan.priceRub),
    };
  });
}

function tariffPricing() {
  const plans = tariffPlans(state.tariffMode);
  const selected = plans.find(plan => plan.id === state.selectedTariff) || plans[0];
  const planRows = plans.map(plan => `<button type="button" class="tariff-plan ${selected.id === plan.id ? 'selected' : ''}" data-tariff-option="${plan.id}" aria-pressed="${selected.id === plan.id}"><span class="tariff-radio" aria-hidden="true"></span><span class="tariff-plan-copy"><strong>${plan.title}</strong>${plan.discount ? `<i class="tariff-discount">${plan.discount}</i>` : ''}${plan.badge ? `<i class="tariff-hit">${plan.badge}</i>` : ''}<small>${plan.hint}</small></span><span class="tariff-plan-price"><span>⭐ <small>${plan.starsLabel}</small></span><strong>${plan.price}</strong></span></button>`).join('');
  const benefits = state.tariffMode === 'unlimited'
    ? ['Уведомления без лимита — сколько бы ни удалили', 'Архив переписки — файл или HTML-страница', 'Удалённое, изменённое и исчезающее — всё сохраню']
    : ['Уведомление списывается, только когда я что-то поймал', 'Нет срока — пакет не сгорает', 'Закончится — предложу пополнить', 'Архив переписки — только на безлимите'];
  return `<div class="tariff-mode-switch" role="tablist" aria-label="Вариант тарифа"><button type="button" class="${state.tariffMode === 'unlimited' ? 'active' : ''}" data-tariff-mode="unlimited" aria-pressed="${state.tariffMode === 'unlimited'}"><strong>Безлимит</strong><small>на 1–12 месяцев</small></button><button type="button" class="${state.tariffMode === 'package' ? 'active' : ''}" data-tariff-mode="package" aria-pressed="${state.tariffMode === 'package'}"><strong>Пакет</strong><small>от 100 уведомлений</small></button></div><div class="tariff-plan-list">${planRows}</div><div class="tariff-benefits"><span>${state.tariffMode === 'unlimited' ? 'ВХОДИТ В БЕЗЛИМИТ' : 'КАК РАБОТАЕТ ПАКЕТ'}</span>${benefits.map(item => `<div><i>${icon('check', 16)}</i><strong>${item}</strong></div>`).join('')}</div>`;
}

function tariffsPage() {
  const intro = state.tariffMode === 'package'
    ? 'Платишь только за уведомления, которые пришли. Пакет не сгорает.'
    : 'Слежу за личными чатами и сохраняю изменения и удаления.';
  return `<section class="page tariffs-page"><div class="tariff-mascot tariff-main-mascot"><img src="./assets/mascot/scout-tablet.png" alt="Скаут со светящимся планшетом" /></div><div class="tariff-intro"><h2>Личные чаты</h2><p>${intro}</p></div>${packageBalanceCard()}<div class="tariff-pricing" data-tariff-pricing>${tariffPricing()}</div></section>`;
}

function packageBalanceCard() {
  const balance = state.packageBalance;
  if (!balance?.has_purchases) return '';
  const purchased = Math.max(0, Number(balance.purchased) || 0);
  const remaining = Math.min(purchased, Math.max(0, Number(balance.remaining) || 0));
  const consumed = Math.max(0, Number(balance.consumed) || 0);
  const refunded = Math.max(0, Number(balance.refunded) || 0);
  const percent = purchased ? Math.min(100, Math.round((consumed + refunded) / purchased * 100)) : 0;
  return `<div class="package-balance-card" role="status"><div class="package-balance-heading"><strong>Пакет уведомлений</strong><b>Осталось ${new Intl.NumberFormat('ru-RU').format(remaining)}</b></div><div class="package-balance-track" aria-label="Использовано ${percent}%"><i style="width:${percent}%"></i></div><small>из ${new Intl.NumberFormat('ru-RU').format(purchased)} событий · использовано ${new Intl.NumberFormat('ru-RU').format(consumed)}${refunded ? ` · возвращено ${new Intl.NumberFormat('ru-RU').format(refunded)}` : ''}</small></div>`;
}

const GROUP_TARIFFS = [
  { id: 'groups3', name: '3 группы', unit: '116 ₽ за группу в месяц', stars: '219', rubles: '349 ₽' },
  { id: 'groups10', name: '10 групп', unit: '79 ₽ за группу в месяц', stars: '496', rubles: '790 ₽', badge: 'Популярный', discount: '−32%' },
  { id: 'groups20', name: '20 групп', unit: '54 ₽ за группу в месяц', stars: '684', rubles: '1 090 ₽', discount: '−53%' }
];

function groupTariffsPricing() {
  const selected = GROUP_TARIFFS.find(plan => plan.id === state.selectedGroupTariff) || GROUP_TARIFFS[1];
  const planRows = GROUP_TARIFFS.map(plan => `<button type="button" class="tariff-plan ${selected.id === plan.id ? 'selected' : ''}" data-group-tariff="${plan.id}" aria-pressed="${selected.id === plan.id}"><span class="tariff-radio" aria-hidden="true"></span><span class="tariff-plan-copy"><strong>${plan.name}</strong>${plan.badge ? `<i class="tariff-hit">${plan.badge}</i>` : ''}${plan.discount ? `<i class="tariff-discount">${plan.discount}</i>` : ''}<small>${plan.unit}</small></span><span class="tariff-plan-price"><span>⭐ <small>${plan.stars}</small></span><strong>${plan.rubles}</strong></span></button>`).join('');
  const benefits = ['Удалённые и изменённые сообщения', 'События из подключённых групп', 'Для подключения необходимы соответствующие права в группе'];
  return `<div class="tariff-plan-list">${planRows}</div><div class="tariff-benefits group-tariff-benefits">${benefits.map(item => `<div><i>${icon('check', 16)}</i><strong>${item}</strong></div>`).join('')}</div>`;
}

function groupTariffsPage() {
  return `<section class="page tariffs-page group-tariffs-page"><div class="tariff-mascot group-tariff-mascot"><img src="./assets/mascot/scout-groups.png" alt="Скаут среди групповых значков" /></div><div class="tariff-intro"><h2>Группы</h2><p>Сохраняем удалённые и изменённые сообщения в подключённых группах.</p></div>${groupEntitlementCard()}<div class="tariff-pricing" data-group-tariff-pricing>${groupTariffsPricing()}</div></section>`;
}

function groupEntitlementCard() {
  const entitlement = state.groupEntitlement;
  if (!entitlement?.active) return '';
  const expiry = entitlement.expires_at ? new Date(entitlement.expires_at) : null;
  const expiryLabel = expiry && !Number.isNaN(expiry.getTime())
    ? expiry.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'не указан';
  const limit = Number(entitlement.groups_limit || 0);
  const activeGroups = Number(entitlement.active_groups || 0);
  const percent = limit ? Math.min(100, activeGroups / limit * 100) : 0;
  return `<div class="package-balance-card group-entitlement-card" role="status"><div class="package-balance-heading"><strong>Тариф ${escapeHtml(entitlement.plan_name || 'Группы')}</strong><b>${Number(entitlement.groups_available || 0)} свободно</b></div><div class="package-balance-track" aria-label="Подключено ${activeGroups} из ${limit} групп"><i style="width:${percent}%"></i></div><small>${activeGroups} из ${limit} групп · доступ до ${escapeHtml(expiryLabel)}</small></div>`;
}

function tariffPaymentDock() {
  if (state.tab === 'tariffs') {
    const selected = tariffPlans(state.tariffMode).find(plan => plan.id === state.selectedTariff) || tariffPlans(state.tariffMode)[0];
    const isSubscription = state.tariffMode === 'unlimited';
    return `<div class="tariff-dock"><button type="button" class="button tariff-pay-button" data-action="${isSubscription ? 'open-payment-sheet' : 'open-package-payment-sheet'}" data-sticky-tariff-payment ${state.paymentLoading ? 'disabled' : ''}>${state.paymentLoading ? 'Открываем Tribute…' : `Оплатить ${selected.price}`}</button><p class="tariff-dock-note">${isSubscription ? 'Оплата звёздами разовая. Автопродление подключим для карт и СБП через CloudPayments.' : 'Пакет событий не сгорает. Архив личных чатов в пакет не входит.'}</p></div>`;
  }
  if (state.tab === 'group-tariffs') {
    return `<div class="tariff-dock"><button type="button" class="button tariff-pay-button group-tariff-pay-button" data-sticky-tariff-payment disabled>Оплата скоро</button><p class="tariff-dock-note">Групповой тариф подключим после проверки личных тарифов.</p></div>`;
  }
  return '';
}

function tributePlanAvailable(serviceKey, planId) {
  return Boolean(state.tributePlanAvailability?.[serviceKey]?.[planId]);
}

function paymentSheet() {
  const selection = state.paymentSelection || {
    service_key: state.tariffMode === 'package' ? 'personal_package' : 'personal_unlimited',
    plan_id: state.selectedTariff,
  };
  const isPackage = selection.service_key === 'personal_package';
  const plans = tariffPlans(isPackage ? 'package' : 'unlimited');
  const selected = plans.find(plan => plan.id === selection.plan_id) || plans[0];
  const tributeReady = tributePlanAvailable(selection.service_key, selection.plan_id);
  const detail = isPackage
    ? 'Пакет активируется после подтверждения Tribute и не сгорает. Tribute покажет доступные способы оплаты.'
    : 'Откроется подписка Tribute с автопродлением. На странице Tribute проверь срок и сумму; продление можно отменить там.';
  return `<div class="payment-sheet-backdrop" data-action="close-payment-sheet"><section class="payment-sheet" role="dialog" aria-modal="true" aria-labelledby="payment-sheet-title" data-payment-sheet><div class="payment-sheet-handle"></div><button type="button" class="payment-sheet-close" aria-label="Закрыть" data-action="close-payment-sheet">${icon('close', 19)}</button><h2 id="payment-sheet-title">Оплата</h2><div class="payment-order-card"><span class="payment-order-icon">${icon('card', 22)}</span><span><strong>Личные чаты · ${escapeHtml(selected.title)}</strong><small>${isPackage ? `${selected.quantity} уведомлений, архив не входит` : 'Безлимит на выбранный период'}</small></span><b>${escapeHtml(selected.price)}</b></div><p class="payment-method-label">Выбери способ оплаты</p><div class="payment-method-list"><button type="button" class="payment-method-card payment-method-stub" data-action="cloudpayments-stub" aria-label="СБП и оплата картой — скоро"><span class="payment-method-star">💳</span><span><strong>СБП и оплата картой</strong><small>CloudPayments · подключим позже</small></span><span class="payment-method-soon">Скоро</span></button><button type="button" class="payment-method-card payment-method-tribute" data-action="tribute-stars" ${state.paymentLoading || !tributeReady ? 'disabled' : ''}><span class="payment-method-stars-icon">⭐</span><span><strong>Telegram Stars</strong><small>${state.paymentLoading ? 'Открываем Tribute…' : tributeReady ? 'Способы оплаты Tribute' : 'Оплата пока настраивается'}</small></span>${icon('chevron', 18)}</button></div><label class="payment-terms-consent"><input type="checkbox" data-terms-consent ${state.paymentTermsAccepted ? 'checked' : ''}><span>Принимаю <a href="https://t.me/SpySkaut_bot?start=terms" target="_blank" rel="noopener">условия оплаты</a>.</span></label><p class="payment-sheet-note">${detail}</p></section></div>`;
}

function telegramSettingsDock() {
  return state.tab === 'connection-tutorial' && state.tutorialType !== 'groups'
    ? '<div class="telegram-settings-dock" aria-label="Настройки подключения"></div>'
    : '';
}

function refreshTariffPricing() {
  const pricing = app.querySelector('[data-tariff-pricing]');
  if (!pricing) return render();
  const intro = app.querySelector('.tariff-intro p');
  if (intro) intro.textContent = state.tariffMode === 'package'
    ? 'Платишь только за уведомления, которые пришли. Пакет не сгорает.'
    : 'Слежу за личными чатами и сохраняю изменения и удаления.';
  pricing.innerHTML = tariffPricing();
  refreshTariffPaymentButton();
}

function refreshTariffPaymentButton() {
  const button = app.querySelector('[data-sticky-tariff-payment]');
  if (!button) return;
  if (state.tab === 'tariffs') {
    const selected = tariffPlans(state.tariffMode).find(plan => plan.id === state.selectedTariff) || tariffPlans(state.tariffMode)[0];
    const isSubscription = state.tariffMode === 'unlimited';
    button.dataset.action = isSubscription ? 'open-payment-sheet' : 'open-package-payment-sheet';
    button.textContent = `Оплатить ${selected.price}`;
    button.disabled = state.paymentLoading;
    const note = app.querySelector('.tariff-dock-note');
    if (note) note.textContent = isSubscription
      ? 'Автопродление оформляется в Tribute. Отменить его можно в подписке Tribute.'
      : 'Пакет событий не сгорает. Архив личных чатов в пакет не входит.';
  }
}
function archive() {
  if (!state.preview && (!state.subscription?.active || !state.subscription?.capabilities?.personal_archive)) {
    const packageActive = Boolean(state.subscription?.active && !state.subscription?.capabilities?.personal_archive);
    return `<section class="page archive-page"><div class="page-title archive-title"><span class="eyebrow">ИСТОРИЯ СОБЫТИЙ</span><h1>Архив</h1><p>События из подключённых чатов.</p></div><div class="archive-state">${icon('lock', 24)}<strong>${packageActive ? 'Архив доступен в безлимите' : 'Подписка не активна'}</strong><p>${packageActive ? 'Пакет уведомлений покрывает уведомления о событиях. Личный архив входит в безлимит.' : 'Архив событий и функции безлимита будут доступны после подключения тарифа.'}</p><button class="subtle-button" data-tab="tariffs">Выбрать тариф ${icon('chevron', 15)}</button></div></section>`;
  }
  if (state.archiveMode === 'groups') return archiveGroupsPage();
  const contacts = archiveContacts();
  const query = state.query.trim().toLocaleLowerCase('ru');
  const selectedContact = contacts.find(contact => contact.id === state.archiveContactId);
  const filters = [['all', 'Все'], ['deleted', 'Удалено'], ['edited', 'Изменено'], ['one-time', 'Одноразовое']];
  const disclaimer = `<div class="archive-disclaimer">${icon('shield', 16)}<span>События относятся только к подключённым чатам. Фото открываются из сохранённого снимка сообщения Telegram.</span></div>`;
  const emptyState = `<div class="archive-state">${icon(state.preview ? 'lock' : 'archive', 24)}<strong>${query ? 'Ничего не найдено' : state.preview ? 'Открой приложение в Telegram' : 'Пока нет событий'}</strong><p>${query ? 'Попробуй поискать по имени контакта или тексту события.' : state.preview ? 'Личный архив доступен после входа через Telegram Mini App.' : state.apiError ? 'Не удалось получить данные. Попробуй обновить страницу.' : 'Контакты появятся здесь, когда в личном чате будет удаление, изменение или одноразовое сообщение.'}</p>${state.apiError && !state.preview ? `<button class="subtle-button" data-action="refresh-archive">Повторить</button>` : ''}</div>`;

  if (state.archiveLoading) {
    return `<section class="page archive-page">${archivePageHeading('Контакты', 'Диалоги, в которых были события.')}<div class="archive-state"><div class="loading-indicator"></div><strong>Загружаем архив…</strong></div></section>`;
  }

  if (selectedContact) {
    const selectedEvents = selectedContact.events.filter(event => state.archiveFilter === 'all' || archiveEventKind(event) === state.archiveFilter);
    const filterButtons = filters.map(([id, label]) => `<button type="button" class="archive-filter ${state.archiveFilter === id ? 'active' : ''}" data-archive-filter="${id}" aria-pressed="${state.archiveFilter === id}">${label}</button>`).join('');
    const identity = eventContactIdentity(selectedContact);
    return `<section class="page archive-page">${archivePageHeading('Контакты', 'Диалоги, в которых были события.')}<button type="button" class="archive-back" data-action="archive-back">${icon('chevron', 16)} Все контакты</button><div class="contact-detail-heading">${contactAvatar(selectedContact)}<div class="contact-detail-copy"><h1>${escapeHtml(selectedContact.name)}</h1>${identity ? `<p class="contact-identity-line">${escapeHtml(identity)}</p>` : ''}</div></div><div class="archive-filters" role="group" aria-label="Категории событий">${filterButtons}</div>${selectedEvents.length ? `<div class="archive-summary"><span>${selectedEvents.length} ${plural(selectedEvents.length, 'событие', 'события', 'событий')}</span></div><div class="events-list archive-list">${selectedEvents.map(event => archiveEventRow(event, true)).join('')}</div>` : `<div class="archive-state"><strong>В этой категории пока пусто</strong><p>Выбери другую категорию событий.</p></div>`}${archiveLoadMoreControl()}${disclaimer}</section>`;
  }

  const matchingContacts = contacts.filter(contact => {
    if (!query) return true;
    const content = `${contact.name} ${contact.events.map(archiveEventText).join(' ')}`.toLocaleLowerCase('ru');
    return content.includes(query);
  });
  const contactRows = matchingContacts.map(archiveContactCard).join('');
  return `<section class="page archive-page">${archivePageHeading('Контакты', 'Диалоги, в которых были события.')}<label class="search-field">${icon('search', 17)}<input id="archive-search" value="${escapeHtml(state.query)}" placeholder="Поиск контакта или события" autocomplete="off"></label>${state.archiveHasMore ? '<p class="archive-search-hint">Поиск выполняется по загруженным событиям. Загрузи ещё, чтобы расширить поиск.</p>' : ''}${contacts.length ? `<div class="archive-summary"><span>${matchingContacts.length} ${plural(matchingContacts.length, 'контакт', 'контакта', 'контактов')} с событиями</span><button class="text-button" data-action="refresh-archive">Обновить ${icon('arrow', 15)}</button></div>${contactRows ? `<div class="archive-contact-list">${contactRows}</div>` : emptyState}` : emptyState}${archiveLoadMoreControl()}${disclaimer}</section>`;
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
  return `<section class="page profile-page"><div class="profile-intro"><div class="avatar">${escapeHtml(title.slice(0, 1).toUpperCase())}${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="${state.authenticated ? '' : 'offline'}"></span></div><h1>${escapeHtml(title)}</h1><div class="profile-account-line" style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin-top:5px"><span>${escapeHtml(secondary)}</span><span class="profile-telegram-id">ID: ${telegramId ? escapeHtml(telegramId) : 'не подтверждён'}</span></div></div><span class="list-label">МОЙ АККАУНТ</span><div class="profile-card"><button class="profile-row" data-tab="subscription"><span class="service-icon purple">${icon('lock', 19)}</span><span class="row-copy"><strong>Моя подписка</strong></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="services"><span class="service-icon blue">${icon('chat', 19)}</span><span class="row-copy"><strong>Мои подключения</strong></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="notifications"><span class="service-icon yellow">${icon('bell', 19)}</span><span class="row-copy"><strong>Уведомления</strong></span>${icon('chevron', 18)}</button><button class="profile-row receipt-email-row" data-tab="receipt-email"><span class="service-icon blue">${icon('mail', 19)}</span><span class="row-copy"><span class="receipt-email-heading"><strong>Почта для чеков</strong>${state.user?.receipt_email ? `<span class="receipt-email-value">${escapeHtml(state.user.receipt_email)}</span>` : ''}</span></span>${icon('chevron', 18)}</button></div>${state.subscription?.can_test_override ? `<span class="list-label">ХОЗЯЙСКИЙ РЕЖИМ</span><div class="profile-card"><button class="profile-row test-subscription-row" role="switch" aria-checked="${testActive}" data-action="toggle-test-subscription" ${state.subscriptionToggleLoading ? 'disabled' : ''}><span class="service-icon ${testActive ? 'green' : 'muted'}">${icon('spark', 19)}</span><span class="row-copy"><strong>Хозяйская подписка</strong></span><span class="test-switch ${testActive ? 'on' : ''}" aria-hidden="true"><i></i></span></button><button type="button" class="profile-row" data-tab="owner-statistics"><span class="service-icon yellow">${icon('chart', 19)}</span><span class="row-copy"><strong>Статистика</strong></span>${icon('chevron', 18)}</button><button type="button" class="profile-row" data-tab="owner-test-group"><span class="service-icon purple">${icon('people', 19)}</span><span class="row-copy"><strong>Тестовая группа</strong></span>${icon('chevron', 18)}</button></div>` : ''}<span class="list-label">СЕРВИС И ПОДДЕРЖКА</span><div class="profile-card"><button class="profile-row" data-tab="privacy"><span class="service-icon green">${icon('shield', 19)}</span><span class="row-copy"><strong>Безопасность и данные</strong></span>${icon('chevron', 18)}</button><button class="profile-row" data-tab="support"><span class="service-icon green">${icon('help', 19)}</span><span class="row-copy"><strong>Поддержка</strong></span>${icon('chevron', 18)}</button></div><div class="profile-footer"><span>SpySkaut · ранняя версия</span><span>Данные привязаны к твоему Telegram ID</span></div></section>`;
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

function ownerTestGroupPage() {
  const members = state.ownerTestGroup.map(member => `<div class="profile-row"><span class="service-icon green">${icon('user', 19)}</span><span class="row-copy"><strong>ID ${escapeHtml(member.telegram_id)}</strong><small>Активная тестовая подписка</small></span><button type="button" class="subtle-button" data-action="remove-test-group-member" data-telegram-id="${escapeHtml(member.telegram_id)}">Убрать</button></div>`).join('');
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('ХОЗЯЙСКИЙ РЕЖИМ', 'Тестовая группа', 'Добавляй пользователей, которым нужна активная тестовая подписка.')}<div class="profile-card profile-detail-card"><form id="owner-test-group-form"><label for="owner-test-group-id" class="receipt-email-label">Telegram ID пользователя</label><div class="owner-test-group-form" style="display:flex;align-items:center;gap:10px"><input id="owner-test-group-id" class="receipt-email-input" style="flex:1;min-width:0;width:auto" name="telegram_id" type="text" inputmode="numeric" autocomplete="off" placeholder="Например, 809418877" maxlength="20" required ${state.ownerTestGroupLoading || state.ownerTestGroupAdding ? 'disabled' : ''}><button class="button button-blue" type="submit" ${state.ownerTestGroupLoading || state.ownerTestGroupAdding ? 'disabled' : ''}>${state.ownerTestGroupAdding ? 'Добавляем…' : 'Добавить'}</button></div></form>${state.ownerTestGroupError ? `<p class="profile-detail-hint">${escapeHtml(state.ownerTestGroupError)}</p>` : ''}<span class="list-label">УЧАСТНИКИ${state.ownerTestGroupLoading ? ' · ЗАГРУЗКА…' : ` · ${state.ownerTestGroup.length}`}</span>${members ? `<div class="owner-test-group-list">${members}</div>` : `<p class="profile-detail-hint">${state.ownerTestGroupLoading ? 'Загружаем список…' : 'В группе пока нет участников.'}</p>`}</div></section>`;
}

async function loadOwnerTestGroup() {
  if (state.ownerTestGroupLoading) return;
  state.ownerTestGroupLoading = true;
  state.ownerTestGroupError = '';
  render();
  try {
    const result = await api('/api/owner/test-group');
    state.ownerTestGroup = result.members || [];
  } catch (error) {
    state.ownerTestGroupError = error.message || 'Не удалось загрузить тестовую группу.';
  } finally {
    state.ownerTestGroupLoading = false;
    render();
  }
}

async function addOwnerTestGroupMember(form) {
  if (!state.authenticated || state.ownerTestGroupAdding) return;
  const telegramId = String(new FormData(form).get('telegram_id') || '').trim();
  if (!/^\d{1,20}$/.test(telegramId)) { form.reportValidity(); return; }
  state.ownerTestGroupAdding = true;
  state.ownerTestGroupError = '';
  render();
  try {
    await api('/api/owner/test-group', { method: 'POST', body: JSON.stringify({ telegram_id: telegramId }) });
    await loadOwnerTestGroup();
    toast(`Пользователь ${telegramId} добавлен в тестовую группу.`);
  } catch (error) {
    state.ownerTestGroupError = error.message || 'Не удалось добавить пользователя.';
    toast(state.ownerTestGroupError);
  } finally {
    state.ownerTestGroupAdding = false;
    render();
  }
}

async function removeOwnerTestGroupMember(telegramId) {
  try {
    await api(`/api/owner/test-group/${encodeURIComponent(telegramId)}`, { method: 'DELETE' });
    await loadOwnerTestGroup();
    toast(`Пользователь ${telegramId} удалён из тестовой группы.`);
  } catch (error) {
    state.ownerTestGroupError = error.message || 'Не удалось удалить пользователя.';
    render();
  }
}

function notificationsPage() {
  const preferences = state.notificationPreferences;
  const switchRow = (key, title, description, iconName, color, disabled = false) => `<button type="button" class="profile-row notification-switch-row" role="switch" aria-checked="${Boolean(preferences[key])}" aria-label="${escapeHtml(title)}" data-notification-toggle="${key}" ${disabled || !state.authenticated || state.notificationPreferencesSaving ? 'disabled' : ''}><span class="service-icon ${color}">${icon(iconName, 19)}</span><span class="row-copy"><strong>${escapeHtml(title)}</strong>${description ? `<small>${escapeHtml(description)}</small>` : ''}</span><span class="test-switch ${preferences[key] ? 'on' : ''}" aria-hidden="true"><i></i></span></button>`;
  return `<section class="page profile-page notifications-page"><div class="notifications-heading-with-mascot">${profileDetailHeader('МОЙ АККАУНТ', 'Уведомления', 'Выбирай, о чём я пишу тебе в чат с ботом.')}<img class="notifications-header-mascot" src="./assets/mascot/scout-notifications.png" alt="Скаут с колокольчиком" /></div><span class="list-label">СООБЩЕНИЯ СОБЕСЕДНИКОВ</span><div class="profile-card">${switchRow('deleted_messages', 'Удалённые сообщения', '', 'trash', 'red')}${switchRow('edited_messages', 'Изменённые сообщения', '', 'edit', 'yellow')}${switchRow('one_time_messages', 'Одноразовые сообщения', '', 'clock', 'purple')}${switchRow('group_messages', 'Сообщения в группах', '', 'people', 'purple', true)}</div><span class="list-label">МОИ ДЕЙСТВИЯ</span><div class="profile-card">${switchRow('deleted_by_owner', 'Удалённые мной', 'Уведомлять об удалениях моих сообщений', 'trash', 'red')}${switchRow('edited_by_owner', 'Изменённые мной', 'Уведомлять об изменениях моих сообщений', 'edit', 'yellow')}</div><div class="notification-note">${state.preview ? 'Открой приложение через Telegram, чтобы синхронизировать настройки.' : 'Уведомления от бота приходят в этот личный чат. Настройки синхронизируются с Telegram-аккаунтом.'} Telegram может не передать боту исходное вложение в ответе.</div></section>`;
}

function profileDetailHeader(eyebrow, title, description) {
  return `<button type="button" class="profile-detail-back" data-tab="profile">${icon('chevron', 16)} Профиль</button><div class="page-title">${eyebrow && eyebrow !== 'МОЙ АККАУНТ' ? `<span class="eyebrow">${eyebrow}</span>` : ''}<h1>${title}</h1><p>${description}</p></div>`;
}

function supportPage() {
  const questions = [
    ['Как работает SpySkaut?', { intro: 'Я сохраняю события из выбранных тобой личных чатов. Это не копия всей переписки.', bullets: ['Фиксирую удаление и изменение сообщений.', 'Сохраняю переданные Telegram текст и поддерживаемые вложения.', 'Показываю события в архиве; уведомления отправляю в Telegram, если они включены.'] }],
    ['Как подключить личные чаты?', { intro: 'Подключение настраивается в Telegram:', path: ['Настройки', 'Профиль', 'Изм.', 'Автоматизация чатов'], steps: [['Открой экран подключения', 'На главной нажми «Подключить» в карточке личных чатов.'], ['Добавь бота', 'В автоматизации чатов выбери бота SpySkaut.'], ['Выбери переписки', 'Разреши доступ ко всем личным чатам или отметь только нужные и сохрани выбор.']], username: true }],
    ['Как подключить группы?', { intro: 'Группы пока доступны только владельцу приложения в тестовом режиме. Для остальных пользователей подключение и оплата группового тарифа ещё не открыты.', bullets: ['В тестовом режиме сохраняются изменения сообщений; обычные удаления Telegram Bot API не передаёт.', 'Если участвуешь в тесте, следуй инструкции в приложении и не выдавай боту дополнительных прав.'] }],
    ['Какие сообщения сохраняет SpySkaut?', { intro: 'В подключённых личных чатах сохраняются события:', bullets: ['об удалении сообщений;', 'об изменении сообщений;', 'о вложениях, которые Telegram передал боту.'], note: 'Обычные новые сообщения не архивируются как полная история переписки.' }],
    ['Почему не сохраняются удалённые и изменённые сообщения?', { intro: 'Проверь основные настройки:', steps: [['Убедись, что нужный чат подключён в Telegram.', ''], ['Проверь, что подписка активна.', ''], ['Открой настройки уведомлений и включи нужные события.', '']], path: ['Профиль', 'Уведомления'], bullets: ['События до подключения не поступают.', 'Telegram может не передать некоторые типы сообщений или вложений.'] }],
    ['Можно ли восстановить сообщения до подключения?', { intro: 'Нет. Telegram не передаёт SpySkaut историю чатов, поэтому содержание сообщений до подключения восстановить нельзя.', bullets: ['Сохраняются только подходящие события после подключения.', 'Если Telegram не передал текст или файл, восстановить его тоже не получится.'] }],
    ['Как настроить уведомления?', { intro: 'Открой настройки уведомлений:', path: ['Профиль', 'Уведомления'], steps: [['Включи нужные переключатели', 'Выбери события собеседников и свои действия, о которых хочешь узнавать.'], ['Проверь чат с ботом', 'Уведомления SpySkaut приходят в его личный чат.']] }],
    ['Сколько хранятся сообщения и события?', { intro: 'Содержимое событий и сохранённые вложения хранятся в архиве до 7 дней, затем удаляются автоматически.' }],
    ['Чем отличается безлимит от пакетов уведомлений?', { intro: 'В разделе «Тарифы и оплата» доступны два варианта:', bullets: ['Безлимит действует выбранный срок, не ограничивает количество уведомлений и включает архив событий из подключённых чатов.', 'Пакет расходуется только на полученные уведомления и не сгорает по сроку; архив событий в него не входит.'] }],
    ['Что произойдёт после окончания подписки?', { intro: 'Продлить подписку можно в приложении:', path: ['Сервисы', 'Тарифы и оплата'], bullets: ['Статус и дату окончания смотри в разделе «Моя подписка».', 'События и вложения удаляются по истечении 7 дней с момента получения.'] }],
    ['Насколько безопасен SpySkaut?', { intro: 'Доступ ограничен выбранными тобой личными чатами и привязан к твоему Telegram-аккаунту.', bullets: ['Архивные события и медиа шифруются при хранении.', 'Другие пользователи не могут открыть твой архив.', 'Секретные чаты недоступны ботам Telegram.'] }],
    ['Как удалить свои данные?', { intro: 'Удаление находится в настройках профиля:', path: ['Профиль', 'Безопасность и данные'], steps: [['Нажми «Удалить все мои данные».', ''], ['Подтверди удаление в появившемся окне.', '']], note: 'Профиль, архив, сохранённые медиа и настройки будут удалены без возможности восстановления. Уже отправленные сообщения бота в Telegram останутся в чате.' }],
  ];
  const renderAnswer = answer => {
    if (typeof answer === 'string') return `<p>${escapeHtml(answer)}</p>`;
    const path = answer.path?.length ? `<div class="support-answer-path" aria-label="Путь в приложении">${answer.path.map((part, index) => `${index ? `<span aria-hidden="true">${icon('chevron', 13)}</span>` : ''}<b>${escapeHtml(part)}</b>`).join('')}</div>` : '';
    const steps = answer.steps?.length ? `<ol class="support-answer-steps">${answer.steps.map(([title, text]) => `<li><span>${escapeHtml(title)}</span>${text ? `<small>${escapeHtml(text)}</small>` : ''}</li>`).join('')}</ol>` : '';
    const bullets = answer.bullets?.length ? `<ul class="support-answer-bullets">${answer.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
    const username = answer.username ? `<button type="button" class="support-copy-username" data-action="support-copy-username"><code>@SpySkaut_bot</code><span>Нажми, чтобы скопировать</span></button>` : '';
    const note = answer.note ? `<p class="support-answer-note">${escapeHtml(answer.note)}</p>` : '';
    return `<div class="support-rich-answer">${answer.intro ? `<p>${escapeHtml(answer.intro)}</p>` : ''}${path}${steps}${bullets}${username}${note}</div>`;
  };
  return `<section class="page profile-page profile-detail-page support-page"><div class="support-heading-with-mascot">${profileDetailHeader('', 'Чем помочь?', 'Частые вопросы — или напиши нам')}<img class="support-header-mascot" src="./assets/mascot/scout-support.png" alt="Скаут помогает найти ответ" /></div><label class="search-field support-search-field">${icon('search', 18)}<input id="support-search" type="search" placeholder="Найти ответ" autocomplete="off" aria-label="Найти ответ на частый вопрос"></label><div class="support-faq-list" aria-label="Частые вопросы">${questions.map(([question, answer]) => `<details class="support-faq-item"><summary><span>${escapeHtml(question)}</span>${icon('chevron', 17)}</summary>${renderAnswer(answer)}</details>`).join('')}<p class="support-empty" hidden>Ничего не найдено. Попробуй изменить запрос.</p></div>${supportDock()}</section>`;
}

function supportDock() {
  return `<div class="support-dock"><button type="button" class="button support-contact-button" data-action="support-unavailable">${icon('chat', 19)} Написать в поддержку</button><p class="support-dock-note">Подключим чат поддержки в Telegram чуть позже</p></div>`;
}

function aboutPage() {
  const points = [
    ['people', 'privacy-green', 'Только выбранные чаты', 'Бот получает сообщения и события только из подключённых тобой чатов.'],
    ['lock', 'privacy-gold', 'История остаётся приватной', 'Сообщения до подключения недоступны боту.'],
    ['shield', 'privacy-purple', 'Официальные возможности Telegram', 'Секретные чаты недоступны через Telegram Bot API.'],
    ['image', 'privacy-green', 'Сохранение фотографий', 'Фото отображаются из сохранённой копии сообщения.'],
    ['trash', 'privacy-orange', 'Контроль над данными', 'Ты можешь удалить профиль и архив в любой момент.'],
  ];
  return `<section class="page profile-page profile-detail-page about-page">${profileDetailHeader('', 'О SpySkaut', 'Сохраняем важные события из подключённых чатов.')}<p class="privacy-section-label">КАК ЭТО РАБОТАЕТ</p><div class="profile-card profile-detail-card"><div class="privacy-points">${points.map(([name, color, title, text]) => `<div class="privacy-point"><span class="privacy-point-icon ${color}">${icon(name, 18)}</span><span class="privacy-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></span></div>`).join('')}</div></div></section>`;
}

function privacyPage() {
  const points = [
    ['shield', 'privacy-blue', 'Официальная функция Telegram', 'Подключение через «Автоматизация чатов».'],
    ['lock', 'privacy-green', 'Ваши данные защищены', 'Сообщения шифруются перед сохранением, у каждого пользователя свой ключ шифрования.'],
    ['clock', 'privacy-gold', 'Храню только удалённое, изменённое и исчезающие сообщения', 'Содержимое хранится до 7 дней, потом записи безвозвратно стираются.'],
    ['eye-off', 'privacy-orange', 'Конфиденциальность переписки', 'Архив привязан к вашему Telegram-аккаунту. Третьим лицам данные не передаются.'],
  ];
  return `<section class="page profile-page profile-detail-page privacy-page"><div class="privacy-header-with-mascot">${profileDetailHeader('', 'Безопасность<br>и данные', 'Ваши переписки — под надёжной защитой.')}<img class="privacy-header-mascot" src="./assets/mascot/scout-security.png" alt="Скаут защищает данные щитом" /></div><p class="privacy-section-label">КАК ЭТО РАБОТАЕТ</p><div class="profile-card profile-detail-card"><div class="privacy-points">${points.map(([name, color, title, text]) => `<div class="privacy-point"><span class="privacy-point-icon ${color}">${icon(name, 18)}</span><span class="privacy-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></span></div>`).join('')}</div></div><button type="button" class="button button-danger privacy-delete-button" data-action="delete-data-confirm" ${!state.authenticated ? 'disabled' : ''}><span class="privacy-delete-label">${icon('trash', 18)}<span>Удалить все мои данные</span></span>${icon('chevron', 18)}</button><p class="privacy-delete-warning">Профиль, архивные сообщения и медиа, а также настройки аккаунта будут удалены. Уже отправленные ботом сообщения в Telegram останутся в чате. Это действие нельзя отменить.</p>${!state.authenticated ? '<p class="profile-detail-hint">Открой Mini App через Telegram, чтобы управлять данными аккаунта.</p>' : ''}</section>`;
}

function receiptEmailPage() {
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('МОЙ АККАУНТ', 'Почта для чеков', 'Пришлю на указанную почту кассовый чек после оплаты. Больше ни для чего её не использую.')}<div class="profile-card profile-detail-card"><form id="receipt-email-form"><label for="receipt-email" class="receipt-email-label">Электронная почта</label><input id="receipt-email" class="receipt-email-input" name="email" type="email" value="${escapeHtml(state.user?.receipt_email || '')}" placeholder="name@example.com" autocomplete="email" maxlength="254" required><button class="button button-blue modal-primary" type="submit" ${state.receiptEmailSaving ? 'disabled' : ''}>${state.receiptEmailSaving ? 'Сохраняем…' : 'Сохранить'}</button></form></div></section>`;
}

function deleteDataPage() {
  return `<section class="page profile-page profile-detail-page">${profileDetailHeader('СЕРВИС И ПОДДЕРЖКА', 'Удалить мои данные', 'Удаление профиля и событий, сохранённых в архиве.')}<div class="profile-card profile-detail-card"><div class="privacy-points"><div>${icon('info', 16)}<span>Будут удалены данные аккаунта и события из твоего архива.</span></div><div>${icon('info', 16)}<span>Это действие нельзя отменить.</span></div></div><button type="button" class="button button-danger modal-primary" data-action="delete-data-confirm" ${!state.authenticated ? 'disabled' : ''}>Удалить профиль и события</button>${!state.authenticated ? '<p class="profile-detail-hint">Открой Mini App через Telegram, чтобы управлять данными аккаунта.</p>' : ''}</div></section>`;
}

function subscriptionPage() {
  const subscription = state.subscription || {};
  const active = Boolean(subscription.active);
  const packageActive = Number(state.packageBalance?.remaining || 0) > 0;
  const tariffLabel = subscription.test_group_member ? 'Тестовая группа' : subscription.capabilities?.personal_archive ? subscription.plan_name || 'Безлимит' : state.packageBalance?.has_purchases ? `Пакет · осталось ${state.packageBalance.remaining}` : subscription.plan_name || subscription.tariff_name || subscription.plan || subscription.tariff || (subscription.test_override ? 'Хозяйский' : 'Не указан');
  const rawExpiry = subscription.expires_at || subscription.active_until || subscription.valid_until || subscription.ends_at || subscription.current_period_end || null;
  const parsedExpiry = rawExpiry ? new Date(typeof rawExpiry === 'number' && rawExpiry < 1e12 ? rawExpiry * 1000 : rawExpiry) : null;
  const expiryLabel = !subscription.capabilities?.personal_archive && state.packageBalance?.has_purchases ? 'Без срока действия' : parsedExpiry && !Number.isNaN(parsedExpiry.getTime())
    ? parsedExpiry.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : subscription.test_group_member ? 'На время тестирования' : 'Срок окончания не указан';
  return `<section class="page profile-page subscription-page">${profileDetailHeader('МОЙ АККАУНТ', 'Моя подписка', 'Статус доступа и остатки пакета для этого Telegram-аккаунта.')}<div class="profile-card"><div class="profile-row subscription-row"><span class="service-icon ${active || packageActive ? 'green' : 'red'}">${icon('lock', 19)}</span><span class="row-copy subscription-row-copy"><strong>Личные чаты</strong></span><span class="subscription-status"><i class="${active || packageActive ? 'active' : 'inactive'}"></i>${active ? 'Активны' : packageActive ? 'Пакет активен' : 'Не активны'}</span></div><div class="profile-row subscription-row"><span class="service-icon purple">${icon('spark', 19)}</span><span class="row-copy subscription-row-copy"><strong>Тариф</strong></span><span class="subscription-row-value">${escapeHtml(tariffLabel)}</span></div><div class="profile-row subscription-row"><span class="service-icon blue">${icon('clock', 19)}</span><span class="row-copy subscription-row-copy"><strong>Действует до</strong></span><span class="subscription-row-value">${escapeHtml(expiryLabel)}</span></div>${active ? `<div class="profile-row subscription-row"><span class="service-icon green">${icon('refresh', 19)}</span><span class="row-copy subscription-row-copy"><strong>Автопродление</strong></span><span class="subscription-row-value">${subscription.auto_renew ? 'Включено' : 'Выключено'}</span></div><div class="profile-row subscription-row"><span class="service-icon blue">${icon('external', 19)}</span><span class="row-copy subscription-row-copy"><strong>Управлять подпиской</strong></span><a class="subscription-row-value" href="https://t.me/tribute" target="_blank" rel="noopener">Открыть Tribute</a></div>` : ''}</div>${packageBalanceCard()}${groupEntitlementCard()}</section>`;
}

function nav() {
  const items = [['home', 'home', 'Главная'], ['services', 'grid', 'Сервисы'], ['profile', 'user', 'Профиль']];
  return `<nav class="bottom-nav" aria-label="Основная навигация">${items.map(([id, ico, label]) => `<button class="${state.tab === id || (state.tab === 'connection-tutorial' && state.tutorialReturnTab === id) || (id === 'services' && ['tariffs', 'group-tariffs'].includes(state.tab)) || (id === 'profile' && ['subscription', 'notifications', 'support', 'privacy', 'receipt-email', 'delete-data', 'owner-statistics', 'owner-test-group'].includes(state.tab)) ? 'active' : ''}" data-tab="${id}">${icon(ico, 21)}<span>${label}</span></button>`).join('')}</nav>`;
}

function modal() {
  if (!state.modal) return '';
  let body = '';
  if (state.modal === 'connect') body = `<div class="modal-icon blue">${icon('chat', 23)}</div><span class="eyebrow">ПОДКЛЮЧЕНИЕ TELEGRAM BUSINESS</span><h2>Подключение пока не выполняем</h2><p>Сначала собираем и проверяем приложение. Позже добавим безопасный сценарий подключения и покажем точные разрешения Telegram перед подтверждением.</p><div class="modal-callout">${icon('lock', 16)} Подключай только свой аккаунт и только те чаты, на обработку которых у тебя есть разрешение.</div><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'telegram') body = `<div class="modal-icon blue">${icon('user', 23)}</div><span class="eyebrow">TELEGRAM MINI APP</span><h2>Как открыть приложение в Telegram</h2><p>Сейчас Mini App ещё не привязана к кнопке бота. После загрузки обновлённого приложения настроим кнопку запуска через BotFather.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'privacy' || state.modal === 'about') body = `<div class="modal-icon green">${icon('shield', 23)}</div><span class="eyebrow">${state.modal === 'about' ? 'О SPYCHAU' : 'ПРОЗРАЧНОСТЬ'}</span><h2>${state.modal === 'about' ? 'Архив событий подключённых чатов' : 'Доступ и данные под твоим контролем'}</h2><p>Бот может получать только те события и сообщения, которые Telegram передаёт после того, как владелец аккаунта подключил бизнес-бота и выбрал чаты.</p><div class="privacy-points"><div>${icon('check', 16)}<span>Секретные чаты не доступны официальному Bot API</span></div><div>${icon('check', 16)}<span>Содержимое до подключения не появится в архиве</span></div><div>${icon('check', 16)}<span>Для фото используется сохранённый снимок сообщения Telegram</span></div><div>${icon('check', 16)}<span>Удалить профиль и сохранённые события можно из раздела «Профиль»</span></div></div><button class="button button-blue modal-primary" data-action="close">Закрыть ${icon('chevron', 16)}</button>`;
  if (state.modal === 'groups') body = `<div class="modal-icon purple">${icon('people', 23)}</div><span class="eyebrow">ГРУППОВЫЕ ЧАТЫ</span><h2>Это отдельная функция</h2><p>Подключение Telegram Business работает с разрешёнными личными чатами. Для группового режима нужно отдельно добавить бота в группу и корректно настроить его права. Этот сценарий пока не реализован.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'subscription') body = `<div class="modal-icon blue">${icon('lock', 23)}</div><span class="eyebrow">ПОДПИСКА</span><h2>Подключение подписки</h2><p>Покупка подписки пока не подключена. Сейчас её статус проверяется на сервере, а переключатель хозяйского режима доступен владельцу приложения в профиле.</p><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron', 16)}</button>`;
  if (state.modal === 'receipt-email') body = `<div class="modal-icon blue">${icon('mail', 23)}</div><span class="eyebrow">ЧЕКИ О ПОКУПКАХ</span><h2>Почта для чеков</h2><p>Укажи адрес, на который отправлять чеки о покупке. Его можно изменить в любой момент.</p><form id="receipt-email-form"><label for="receipt-email" style="display:block;font-size:12px;color:var(--muted);margin-bottom:7px">Электронная почта</label><input id="receipt-email" class="receipt-email-input" name="email" type="email" value="${escapeHtml(state.user?.receipt_email || '')}" placeholder="name@example.com" autocomplete="email" maxlength="254" required><button class="button button-blue modal-primary" type="submit" ${state.receiptEmailSaving ? 'disabled' : ''}>${state.receiptEmailSaving ? 'Сохраняем…' : 'Сохранить'}</button></form>`;
  return `<div class="modal-backdrop" data-action="backdrop"><div class="modal">${body}<button class="modal-close" data-action="close" aria-label="Закрыть">${icon('close', 18)}</button></div></div>`;
}

function syncTelegramTheme() {
  const color = '#101827';
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = color;
  if (!state.telegram) return;
  state.telegram.setHeaderColor?.(color);
  state.telegram.setBackgroundColor?.(color);
}

function render() {
  syncTelegramTheme();
  const page = state.tab === 'home' ? home() : state.tab === 'services' ? services() : state.tab === 'tariffs' ? tariffsPage() : state.tab === 'group-tariffs' ? groupTariffsPage() : state.tab === 'archive' ? archive() : state.tab === 'connection-tutorial' ? connectionTutorialPage() : state.tab === 'subscription' ? subscriptionPage() : state.tab === 'notifications' ? notificationsPage() : state.tab === 'support' ? supportPage() : state.tab === 'privacy' ? privacyPage() : state.tab === 'receipt-email' ? receiptEmailPage() : state.tab === 'delete-data' ? deleteDataPage() : state.tab === 'owner-statistics' ? ownerStatisticsPage() : state.tab === 'owner-test-group' ? ownerTestGroupPage() : state.tab === 'about' ? aboutPage() : profile();
  const mainTabs = ['home', 'services', 'profile'];
  const tariffDockActive = ['tariffs', 'group-tariffs'].includes(state.tab);
  const telegramSettingsDockActive = state.tab === 'connection-tutorial' && state.tutorialType !== 'groups';
  app.innerHTML = `<div class="app-shell ${tariffDockActive ? 'has-tariff-dock' : ''} ${telegramSettingsDockActive ? 'has-telegram-settings-dock' : ''}"><div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>${state.tab === 'home' ? topbar() : ''}<main>${page}</main>${tariffPaymentDock()}${telegramSettingsDock()}${telegramSettingsDockActive ? '' : nav()}${state.tab === 'about' ? '' : modal()}${state.paymentSheetOpen ? paymentSheet() : ''}<div class="toast" role="status" aria-live="polite"></div></div>`;
  const settingsButton = app.querySelector('.tutorial-open-settings');
  const settingsHelp = app.querySelector('.tutorial-help-link');
  const settingsDock = app.querySelector('.telegram-settings-dock');
  if (settingsButton && settingsDock) settingsDock.append(settingsButton);
  if (settingsHelp && settingsDock) settingsDock.append(settingsHelp);
  syncTelegramBackButton();
}

function toast(message) {
  const element = document.querySelector('.toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('visible');
  window.setTimeout(() => element.classList.remove('visible'), 2800);
}

async function copyBotUsername() {
  try {
    await navigator.clipboard.writeText('@SpySkaut_bot');
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = '@SpySkaut_bot';
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  }
}

async function api(path, options = {}) {
  if (!state.telegram?.initData) throw new Error('Открой приложение через Telegram.');
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), Authorization: `tma ${state.telegram.initData}`, ...options.headers }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Ошибка API (${response.status})`);
    error.details = result.details || null;
    throw error;
  }
  return result;
}

const PAYMENT_TERMS_VERSION = '2026-11-02';

async function purchaseSelectedPlan() {
  const selection = state.paymentSelection || {
    service_key: state.tariffMode === 'package' ? 'personal_package' : 'personal_unlimited',
    plan_id: state.selectedTariff,
  };
  if (!state.authenticated || !state.telegram?.openTelegramLink) { toast('Открой приложение через Telegram.'); return; }
  if (!state.paymentTermsAccepted) { toast('Сначала прими условия оплаты.'); return; }
  if (state.paymentLoading) return;
  const previous = `${state.subscription?.expires_at || ''}|${state.packageBalance?.remaining ?? ''}`;
  state.paymentLoading = true;
  render();
  try {
    const result = await api('/api/payments/checkout', { method: 'POST', body: JSON.stringify({
      service_key: selection.service_key, plan_id: selection.plan_id, terms_accepted: true, terms_version: PAYMENT_TERMS_VERSION
    }) });
    const mode = selection.service_key === 'personal_package' ? 'package' : 'unlimited';
    const expected = tariffPlans(mode).find(plan => plan.id === selection.plan_id);
    if (!expected || result.service_key !== selection.service_key || result.plan_id !== selection.plan_id
      || Number(result.amount) !== expected.priceRub || String(result.currency).toUpperCase() !== 'RUB') {
      throw new Error('Цена или тариф не совпали. Закрой оплату и попробуй ещё раз.');
    }
    state.paymentLoading = false;
    state.paymentSheetOpen = false;
    state.tributeCheckoutPending = true;
    state.tributeCheckoutPreviousEntitlements = previous;
    render();
    state.telegram.openTelegramLink(result.checkout_url);
  } catch (error) {
    state.paymentLoading = false;
    state.paymentSheetOpen = true;
    render();
    const message = error.message === 'payments_not_ready'
      ? 'Платёжные продукты Tribute ещё не настроены.'
      : error.message === 'tribute_product_price_mismatch'
        ? error.details?.issue === 'wrong_amount' && Number.isFinite(Number(error.details.reported_rub))
          ? `В Tribute указана цена ${error.details.reported_rub} ₽, а в приложении — ${error.details.expected_rub} ₽. Исправь цену связанного товара; оплата не открыта.`
          : error.details?.issue === 'product_not_found'
            ? 'Не нашёл связанный товар в Tribute. Проверь ссылку на товар; оплата не открыта.'
            : error.details?.issue === 'product_not_approved'
              ? 'Товар в Tribute ещё не одобрен. Оплата не открыта.'
              : error.details?.issue === 'stars_not_enabled'
                ? 'У товара Tribute выключена оплата Stars. Включи её в настройках товара.'
                : error.details?.issue === 'api_unavailable'
                  ? 'Не удалось проверить товар в Tribute. Попробуй ещё раз позже.'
                  : 'Не удалось подтвердить цену и настройки товара в Tribute. Оплата не открыта.'
        : error.message || 'Не удалось открыть оплату.';
    toast(message);
  }
}

let tributeRefreshRunning = false;
function applyLatestPaymentState(latest) {
  const previous = JSON.stringify([
    state.subscription, state.packageBalance, state.groupEntitlement,
    state.paymentsAvailable, state.packagePaymentsAvailable, state.groupPaymentsAvailable,
    state.tributePlanAvailability,
  ]);
  state.subscription = { ...(latest.subscription || {}), can_test_override: Boolean(latest.can_test_override) };
  state.packageBalance = latest.package_balance || null;
  state.groupEntitlement = latest.group_entitlement || null;
  state.paymentsAvailable = Boolean(latest.payments_available);
  state.packagePaymentsAvailable = Boolean(latest.package_payments_available);
  state.groupPaymentsAvailable = Boolean(latest.group_payments_available);
  state.tributePlanAvailability = latest.tribute_plan_availability || {};
  return previous !== JSON.stringify([
    state.subscription, state.packageBalance, state.groupEntitlement,
    state.paymentsAvailable, state.packagePaymentsAvailable, state.groupPaymentsAvailable,
    state.tributePlanAvailability,
  ]);
}

async function refreshAfterTributeCheckout() {
  if (tributeRefreshRunning || document.visibilityState === 'hidden') return;
  if (!state.tributeCheckoutPending) {
    if (!state.authenticated) return;
    tributeRefreshRunning = true;
    try {
      const latest = await api('/api/me');
      if (applyLatestPaymentState(latest)) render();
    } catch {}
    tributeRefreshRunning = false;
    return;
  }
  tributeRefreshRunning = true;
  const previous = state.tributeCheckoutPreviousEntitlements;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const latest = await api('/api/me');
      const changed = applyLatestPaymentState(latest);
      const current = `${state.subscription?.expires_at || ''}|${state.packageBalance?.remaining ?? ''}`;
      if (current !== previous) {
        state.tributeCheckoutPending = false;
        state.tributeCheckoutPreviousEntitlements = '';
        render();
        toast('Оплата подтверждена, доступ обновлён.');
        tributeRefreshRunning = false;
        return;
      }
      if (changed) render();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  state.tributeCheckoutPending = false;
  state.tributeCheckoutPreviousEntitlements = '';
  tributeRefreshRunning = false;
  toast('Tribute ещё не подтвердил оплату. Обнови приложение позже.');
}
document.addEventListener('visibilitychange', refreshAfterTributeCheckout);
window.addEventListener('focus', refreshAfterTributeCheckout);

async function loadMe() {
  if (state.preview) { render(); return; }
  state.loading = true;
  state.apiError = '';
  render();
  let loadInitialArchive = false;
  let loadInitialHomeFeed = false;
  try {
    const result = await api('/api/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ init_data: state.telegram.initData, notification_preferences: state.notificationPreferences }),
    });
    state.user = result.user;
    state.connections = result.connections || [];
    state.subscription = { ...(result.subscription || {}), can_test_override: Boolean(result.can_test_override) };
    state.packageBalance = result.package_balance || null;
    state.groupEntitlement = result.group_entitlement || null;
    state.paymentsAvailable = Boolean(result.payments_available);
    state.packagePaymentsAvailable = Boolean(result.package_payments_available);
    state.groupPaymentsAvailable = Boolean(result.group_payments_available);
    state.tributePlanAvailability = result.tribute_plan_availability || {};
    state.notificationPreferences = result.notification_preferences || state.notificationPreferences;
    state.events = [];
    state.authenticated = true;
    try { localStorage.setItem('spychau-notification-preferences', JSON.stringify(state.notificationPreferences)); } catch {}
    loadInitialArchive = state.tab === 'archive' && new URLSearchParams(window.location.search).get('open') === 'archive';
    loadInitialHomeFeed = !loadInitialArchive && ['home', 'services'].includes(state.tab);
  } catch (error) {
    state.apiError = error.message || 'Не удалось загрузить данные';
  } finally {
    state.loading = false;
    state.subscriptionToggleLoading = false;
    render();
  }
  if (loadInitialArchive) void loadArchive();
  else if (loadInitialHomeFeed) void loadHomeEvents();
}

async function loadHomeEvents() {
  if (state.preview) return;
  state.eventFeedLoading = true;
  state.eventFeedError = '';
  render();
  try {
    const result = await api('/api/home/events');
    state.events = result.events || [];
    if (result.package_balance) state.packageBalance = result.package_balance;
  } catch (error) {
    state.eventFeedError = error.message || 'Не удалось загрузить события';
  } finally {
    state.eventFeedLoading = false;
    render();
  }
}

async function loadArchive({ append = false } = {}) {
  state.tab = 'archive';
  if (state.archiveMode === 'groups') return loadGroupArchive();
  if (state.preview) { render(); return; }
  if (append && (state.archiveLoadingMore || !state.archiveHasMore || !state.archiveCursor)) return;
  if (append) {
    state.archiveLoadingMore = true;
    state.archiveLoadMoreError = '';
  } else {
    state.archiveLoading = true;
    state.apiError = '';
    state.archiveCursor = null;
    state.archiveHasMore = false;
    state.archiveLoadMoreError = '';
  }
  render();
  try {
    const cursor = append ? state.archiveCursor : null;
    const result = await api(`/api/archive${cursor ? `?before_id=${encodeURIComponent(cursor)}` : ''}`);
    state.events = append ? [...state.events, ...(result.events || [])] : (result.events || []);
    state.archiveCursor = result.next_cursor || null;
    state.archiveHasMore = Boolean(result.has_more && result.next_cursor);
  } catch (error) {
    if (error.message === 'subscription_required') {
      state.subscription = { ...state.subscription, active: false };
      state.events = [];
      state.archiveCursor = null;
      state.archiveHasMore = false;
    } else if (append) {
      state.archiveLoadMoreError = error.message || 'Не удалось загрузить следующую страницу';
    } else {
      state.apiError = error.message || 'Не удалось загрузить архив';
    }
  } finally {
    if (append) state.archiveLoadingMore = false;
    else state.archiveLoading = false;
    render();
  }
}

async function loadGroupArchive({ append = false } = {}) {
  state.tab = 'archive';
  if (state.preview) { render(); return; }
  if (append && (state.groupArchiveLoadingMore || !state.groupArchiveHasMore || !state.groupArchiveCursor)) return;
  if (append) {
    state.groupArchiveLoadingMore = true;
    state.groupArchiveLoadMoreError = '';
  } else {
    state.groupArchiveLoading = true;
    state.groupArchiveError = '';
    state.groupArchiveCursor = null;
    state.groupArchiveHasMore = false;
    state.groupArchiveLoadMoreError = '';
  }
  render();
  try {
    const cursor = append ? state.groupArchiveCursor : null;
    const result = await api(`/api/archive/groups${cursor ? `?before_id=${encodeURIComponent(cursor)}` : ''}`);
    state.archiveGroupsAvailable = Boolean(result.available);
    if (!append) {
      state.archiveGroups = result.groups || [];
      state.archiveTopics = result.topics || [];
      state.groupArchiveEventCounts = Object.fromEntries((result.event_counts || []).map(item => [String(item.chat_id), Number(item.count || 0)]));
      state.groupArchiveTopicEventCounts = Object.fromEntries((result.topic_event_counts || []).map(item => [`${item.chat_id}:${item.message_thread_id || ''}`, Number(item.count || 0)]));
    }
    const events = (result.events || []).map(event => ({ ...event, group_event: true }));
    state.groupArchiveEvents = append ? [...state.groupArchiveEvents, ...events] : events;
    state.groupArchiveCursor = result.next_cursor || null;
    state.groupArchiveHasMore = Boolean(result.has_more && result.next_cursor);
    if (!state.archiveGroups.some(group => String(group.chat_id) === String(state.archiveGroupId))) {
      state.archiveGroupId = null;
      state.archiveTopicId = null;
    }
  } catch (error) {
    if (error.message === 'subscription_required') {
      state.subscription = { ...state.subscription, active: false };
      state.archiveGroups = [];
      state.archiveGroupsAvailable = false;
      state.archiveTopics = [];
      state.groupArchiveEvents = [];
      state.groupArchiveCursor = null;
      state.groupArchiveHasMore = false;
    } else {
      if (append) state.groupArchiveLoadMoreError = error.message || 'Не удалось загрузить следующую страницу';
      else state.groupArchiveError = error.message || 'Не удалось получить данные';
    }
  } finally {
    if (append) state.groupArchiveLoadingMore = false;
    else state.groupArchiveLoading = false;
    render();
  }
}

app.addEventListener('submit', async event => {
  if (event.target.id === 'owner-test-group-form') {
    event.preventDefault();
    await addOwnerTestGroupMember(event.target);
    return;
  }
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

app.addEventListener('change', event => {
  if (!event.target.matches('[data-terms-consent]')) return;
  state.paymentTermsAccepted = event.target.checked;
});

app.addEventListener('click', async event => {
  const target = event.target.closest('[data-action], [data-tab], [data-tutorial], [data-archive-filter], [data-archive-mode], [data-archive-group], [data-archive-topic], [data-contact-id], [data-notification-toggle], [data-tariff-mode], [data-tariff-option], [data-group-tariff]');
  if (!target) return;
  try {
    if (window.Telegram?.WebApp?.HapticFeedback?.impactOccurred) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    } else if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {}
  if (target.dataset.tariffMode) {
    state.tariffMode = target.dataset.tariffMode;
    state.selectedTariff = state.tariffMode === 'unlimited' ? 'month' : 'pack300';
    refreshTariffPricing();
    return;
  }
  if (target.dataset.tariffOption) {
    state.selectedTariff = target.dataset.tariffOption;
    refreshTariffPricing();
    return;
  }
  if (target.dataset.groupTariff) {
    state.selectedGroupTariff = target.dataset.groupTariff;
    const pricing = app.querySelector('[data-group-tariff-pricing]');
    if (pricing) pricing.innerHTML = groupTariffsPricing();
    else render();
    refreshTariffPaymentButton();
    return;
  }
  if (target.dataset.action === 'backdrop' && event.target !== target) return;
  if (target.dataset.action === 'open-payment-sheet') {
    if (!state.authenticated) { toast('Открой приложение через Telegram.'); return; }
    state.paymentTermsAccepted = false;
    state.paymentSelection = { service_key: 'personal_unlimited', plan_id: state.selectedTariff };
    state.paymentSheetOpen = true;
    render();
    return;
  }
  if (target.dataset.action === 'open-package-payment-sheet') {
    if (!state.authenticated) { toast('Открой приложение через Telegram.'); return; }
    state.paymentTermsAccepted = false;
    state.paymentSelection = { service_key: 'personal_package', plan_id: state.selectedTariff };
    state.paymentSheetOpen = true;
    render();
    return;
  }
  if (target.dataset.action === 'open-group-payment-sheet') {
    toast('Оплата групповых тарифов в Telegram Stars ещё подключается. Списаний не будет.');
    return;
  }
  if (target.dataset.action === 'close-payment-sheet') {
    if (target.classList.contains('payment-sheet-backdrop') && event.target !== target) return;
    state.paymentSheetOpen = false;
    state.paymentSelection = null;
    render();
    return;
  }
  if (target.dataset.action === 'tribute-stars') { await purchaseSelectedPlan(); return; }
  if (target.dataset.action === 'cloudpayments-stub') {
    toast('Оплата картой и через СБП появится после подключения CloudPayments. Сейчас списаний не будет.');
    return;
  }
  if (target.dataset.contactId) {
    pushNavigation();
    state.archiveContactId = target.dataset.contactId;
    state.archiveFilter = 'all';
    state.tab = 'archive';
    render();
    return;
  }
  if (target.dataset.archiveGroup !== undefined) {
    pushNavigation();
    state.archiveGroupId = target.dataset.archiveGroup;
    state.archiveTopicId = null;
    state.archiveFilter = 'all';
    state.query = '';
    render();
    return;
  }
  if (target.dataset.archiveTopic !== undefined) {
    pushNavigation();
    state.archiveTopicId = target.dataset.archiveTopic;
    state.archiveFilter = 'all';
    state.query = '';
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
  if (target.dataset.action === 'copy-bot-name' || target.dataset.action === 'support-copy-username') {
    const copied = await copyBotUsername();
    toast(copied ? 'Имя бота скопировано.' : 'Скопируй имя бота: @SpySkaut_bot');
    return;
  }
  if (target.dataset.action === 'open-telegram-business-settings') {
    const copied = await copyBotUsername();
    let instructionsSent = false;
    try {
      const result = await api('/api/telegram/connect-instructions', { method: 'POST' });
      instructionsSent = result.sent === true;
    } catch {}
    if (!copied) toast('Скопируй имя бота: @SpySkaut_bot');
    const botLink = instructionsSent ? 'https://t.me/SpySkaut_bot' : 'https://t.me/SpySkaut_bot?start=connect';
    if (state.telegram?.openTelegramLink) state.telegram.openTelegramLink(botLink);
    else window.location.href = botLink;
    return;
  }
  if (target.dataset.action === 'tutorial-help') {
    toast('Настройки → Изм. → Автоматизация чатов. Там выбери @SpySkaut_bot и нужные чаты.');
    return;
  }
  if (target.dataset.action === 'archive-group-back') {
    state.archiveGroupId = null;
    state.archiveTopicId = null;
    state.query = '';
    render();
    return;
  }
  if (target.dataset.action === 'archive-topic-back') {
    state.archiveTopicId = null;
    state.query = '';
    render();
    return;
  }
  if (target.dataset.action === 'refresh-group-archive') { await loadGroupArchive(); return; }
  if (target.dataset.action === 'load-more-archive') { await loadArchive({ append: true }); return; }
  if (target.dataset.action === 'load-more-group-archive') { await loadGroupArchive({ append: true }); return; }
  if (target.dataset.action === 'add-group-bot') {
    const link = 'https://t.me/SpySkaut_bot?startgroup=true';
    if (state.telegram?.openTelegramLink) state.telegram.openTelegramLink(link);
    else window.location.href = link;
    return;
  }
  if (target.dataset.action === 'support-unavailable') {
    toast('Чат поддержки в Telegram скоро появится.');
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
    const profileDetailTabs = ['subscription', 'notifications', 'support', 'privacy', 'receipt-email', 'delete-data', 'owner-statistics', 'owner-test-group'];
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
      if (state.archiveMode === 'groups') await loadGroupArchive();
      else await loadArchive();
      return;
    }
    if (target.dataset.tab !== state.tab) pushNavigation();
    state.tab = target.dataset.tab;
    render();
    if (state.tab === 'owner-statistics') await loadOwnerStatistics();
    if (state.tab === 'owner-test-group') await loadOwnerTestGroup();
    return;
  }
  if (target.dataset.archiveFilter) {
    state.archiveFilter = target.dataset.archiveFilter;
    render();
    return;
  }
  if (target.dataset.archiveMode) {
    if (target.dataset.archiveMode === state.archiveMode) return;
    pushNavigation();
    state.archiveMode = target.dataset.archiveMode;
    state.archiveContactId = null;
    state.archiveGroupId = null;
    state.archiveTopicId = null;
    state.archiveFilter = 'all';
    state.query = '';
    if (state.archiveMode === 'groups') await loadGroupArchive();
    else render();
    return;
  }
  if (target.dataset.notificationToggle) {
    const key = target.dataset.notificationToggle;
    if (!['deleted_messages', 'edited_messages', 'one_time_messages', 'deleted_by_owner', 'edited_by_owner'].includes(key)) return;
    if (!state.authenticated) { toast('Открой приложение через Telegram, чтобы изменить настройки.'); return; }
    if (state.notificationPreferencesSaving) return;
    const previous = state.notificationPreferences;
    const next = { ...state.notificationPreferences, [key]: !state.notificationPreferences[key] };
    state.notificationPreferencesSaving = true;
    state.notificationPreferences = next;
    render();
    let feedback = 'Настройки уведомлений сохранены.';
    try {
      const result = await api('/api/me/notification-preferences', { method: 'PUT', body: JSON.stringify({ preferences: next }) });
      state.notificationPreferences = result.preferences;
      try { localStorage.setItem('spychau-notification-preferences', JSON.stringify(result.preferences)); } catch {}
    } catch (error) {
      state.notificationPreferences = previous;
      feedback = error.message || 'Не удалось сохранить настройки уведомлений.';
    } finally {
      state.notificationPreferencesSaving = false;
      render();
    }
    toast(feedback);
    return;
  }
  const action = target.dataset.action;
  if (action === 'tariff-pay') { await purchaseSelectedPlan(); return; }
  if (action === 'group-tariff-pay') { toast('Оплата групп пока не подключена — деньги не списаны.'); return; }
  if (action === 'about') { pushNavigation(); state.modal = null; state.tab = 'about'; render(); return; }
  if (action === 'close' || action === 'backdrop') { state.modal = null; render(); return; }
  if (action === 'refresh') { await loadMe(); return; }
  if (action === 'refresh-home-events') { await loadHomeEvents(); return; }
  if (action === 'refresh-archive') { await loadArchive(); return; }
  if (action === 'refresh-owner-statistics') { await loadOwnerStatistics(); return; }
  if (action === 'remove-test-group-member') { await removeOwnerTestGroupMember(target.dataset.telegramId); return; }
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
    if (!window.confirm('Удалить профиль, архивные сообщения и медиа, а также настройки аккаунта? Уже отправленные ботом сообщения в Telegram останутся в чате. Это действие нельзя отменить.')) return;
    try {
      await api('/api/me/data', { method: 'DELETE' });
      state.user = null; state.connections = []; state.events = []; state.subscription = null; state.packageBalance = null; state.groupEntitlement = null; state.authenticated = false;
      state.ownerStatistics = null; state.ownerTestGroup = []; state.navigationStack = []; state.archiveContactId = null; state.archiveGroupId = null; state.archiveTopicId = null; state.archiveGroups = []; state.archiveTopics = []; state.groupArchiveEvents = []; state.archiveMode = 'contacts'; state.query = '';
      try { localStorage.removeItem('spychau-notification-preferences'); } catch {}
      state.notificationPreferences = loadNotificationPreferences();
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
  if (event.target.id === 'support-search') {
    const query = event.target.value.trim().toLocaleLowerCase('ru');
    const items = [...app.querySelectorAll('.support-faq-item')];
    let visibleCount = 0;
    for (const item of items) {
      item.hidden = !item.textContent.toLocaleLowerCase('ru').includes(query);
      if (!item.hidden) visibleCount += 1;
    }
    const empty = app.querySelector('.support-empty');
    if (empty) empty.hidden = visibleCount > 0;
  }
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
  syncTelegramTheme();
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
