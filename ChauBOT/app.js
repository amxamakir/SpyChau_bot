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
    chevron: '<path d="m9 18 6-6-6-6"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};

function racer(small = false) {
  return `<div class="racer ${small ? 'racer-small' : ''}" aria-hidden="true"><img src="./assets/mcqueen-cutout.png" alt="" /></div>`;
}

const state = { tab: 'home', modal: null, query: '', user: null };
const app = document.querySelector('#root');

function topbar() {
  const name = state.user?.first_name || 'Гонщик';
  return `<header class="topbar"><div class="brand-mark"><span>SC</span><i></i></div><div class="brand-copy"><strong>SpyChau</strong><span>Привет, ${escapeHtml(name)}</span></div><button class="icon-button" aria-label="Уведомления">${icon('bell',19)}<b></b></button><button class="icon-button sun-button" aria-label="Справка" data-action="privacy">${icon('help',19)}</button></header>`;
}

function home() {
 return `<section class="page home-page"><div class="hero-card"><div class="hero-copy"><span class="status-pill"><span class="status-dot"></span> Подключение не настроено</span><h1>Твоя история<br>под контролем</h1><p>Подключи Telegram Business, чтобы сохранять доступные изменения в выбранных чатах.</p><button class="button button-light" data-action="connect">Подключить аккаунт ${icon('chevron',17)}</button></div>${racer()}<div class="hero-orbit orbit-a"></div><div class="hero-orbit orbit-b"></div></div><div class="section-heading"><div><h2>Подключения</h2><p>Выбирай, где нужен архив</p></div><span class="count-badge">0 / 2</span></div><div class="connect-card"><div class="connect-row"><div class="service-icon blue">${icon('chat',21)}</div><div class="row-copy"><strong>Личные чаты</strong><span>Через подключение Telegram Business</span></div><button class="button button-blue button-compact" data-action="connect">Настроить ${icon('chevron',16)}</button></div><div class="divider"></div><div class="connect-row"><div class="service-icon purple">${icon('people',21)}</div><div class="row-copy"><strong>Группы</strong><span>Отдельный режим с доступом в группе</span></div><button class="button button-purple button-compact" data-action="privacy">Подробнее ${icon('chevron',16)}</button></div></div><div class="section-heading event-heading"><div><h2>Что происходило</h2><p>Последние события в архиве</p></div><button class="text-button" data-action="archive">Весь архив ${icon('chevron',17)}</button></div><div class="empty-events"><div class="empty-art"><div class="magnifier">${icon('search',25)}</div>${racer(true)}</div><strong>Пока тихо на трассе</strong><p>После подключения здесь появятся сохранённые изменения и удаления.</p><button class="subtle-button" data-action="connect">${icon('spark',15)} Подключить первый чат</button></div><div class="trust-note">${icon('shield',17)}<span>Доступ контролируешь ты. Его можно отозвать в настройках Telegram.</span></div></section>`;
}

function services() {
 return `<section class="page services-page"><div class="page-title"><span class="eyebrow">ТВОЙ НАБОР ИНСТРУМЕНТОВ</span><h1>Сервисы</h1><p>Подключай нужное и управляй архивом</p></div><div class="service-card featured-service"><div class="service-card-top"><div class="service-icon blue large">${icon('chat',24)}</div><div><h2>Личные чаты</h2><p>Архив доступных изменений и удалений в выбранных чатах Telegram Business.</p></div></div><div class="service-card-bottom"><span class="green-label">${icon('check',15)} Подключение бесплатно</span><button class="button button-blue" data-action="connect">Подключить ${icon('chevron',16)}</button></div><div class="card-glow"></div></div><div class="service-card"><div class="service-card-top"><div class="service-icon purple large">${icon('people',24)}</div><div><h2>Группы</h2><p>Архив сообщений в группах, где ты добавил бота с нужным доступом.</p></div></div><div class="service-card-bottom"><span class="muted-price">Тариф появится позже</span><button class="button button-purple" data-action="privacy">Как работает ${icon('chevron',16)}</button></div></div><div class="service-card archive-service"><div class="service-card-top"><div class="service-icon cyan large">${icon('archive',24)}</div><div><h2>Архив переписки</h2><p>Найди сохранённые версии и события по чату, типу и дате.</p></div></div><div class="service-card-bottom"><span class="lock-label">${icon('lock',14)} Доступен после подключения</span><button class="button button-blue" data-action="archive">Открыть архив ${icon('chevron',16)}</button></div></div><div class="coming-card"><span class="coming-label">В РАЗРАБОТКЕ</span><div class="coming-content"><div><h2>Больше порядка</h2><p>${icon('spark',14)} Умные фильтры и быстрый поиск</p><p>${icon('spark',14)} Экспорт истории в файл</p><button class="subtle-button" data-action="privacy">${icon('bell',14)} Сообщить о запуске</button></div>${racer(true)}</div></div></section>`;
}

function profile() {
 const name = state.user?.first_name || 'Гонщик';
 return `<section class="page profile-page"><div class="profile-intro"><div class="avatar">${escapeHtml(name.slice(0,1).toUpperCase())}<span></span></div><h1>${escapeHtml(name)}</h1><p>${state.user?.username ? '@'+escapeHtml(state.user.username) : 'профиль SpyChau'}</p></div><span class="list-label">ТВОЙ АККАУНТ</span><div class="profile-card"><button class="profile-row" data-tab="services"><span class="service-icon blue">${icon('chat',19)}</span><span class="row-copy"><strong>Мои подключения</strong><small>Пока нет активных подключений</small></span>${icon('chevron',18)}</button><button class="profile-row" data-action="archive"><span class="service-icon cyan">${icon('archive',19)}</span><span class="row-copy"><strong>Архив и хранение</strong><small>Настройки срока хранения</small></span>${icon('chevron',18)}</button><button class="profile-row" data-action="privacy"><span class="service-icon green">${icon('shield',19)}</span><span class="row-copy"><strong>Безопасность и данные</strong><small>Экспорт, удаление и доступ</small></span>${icon('chevron',18)}</button></div><span class="list-label">СЕРВИС И ПОДДЕРЖКА</span><div class="profile-card"><button class="profile-row" data-action="privacy"><span class="service-icon yellow">${icon('bell',19)}</span><span class="row-copy"><strong>Уведомления</strong><small>События архива и подписки</small></span>${icon('chevron',18)}</button><button class="profile-row" data-action="privacy"><span class="service-icon purple">${icon('gift',19)}</span><span class="row-copy"><strong>Подписка и оплата</strong><small>Оплата цифровых функций через Stars</small></span>${icon('chevron',18)}</button><button class="profile-row" data-action="privacy"><span class="service-icon blue">${icon('mail',19)}</span><span class="row-copy"><strong>Поддержка</strong><small>Ответим на вопросы по работе сервиса</small></span>${icon('chevron',18)}</button><button class="profile-row" data-action="privacy"><span class="service-icon muted">${icon('help',19)}</span><span class="row-copy"><strong>Правила и приватность</strong><small>Как мы обрабатываем данные</small></span>${icon('chevron',18)}</button></div><div class="profile-footer"><span>SpyChau · ранняя версия 0.1</span><span>Сделано для ясности, а не для шума</span></div></section>`;
}

function nav() {
 const items = [['home','home','Главная'],['services','grid','Сервисы'],['profile','user','Профиль']];
 return `<nav class="bottom-nav" aria-label="Основная навигация">${items.map(([id,ico,label])=>`<button class="${state.tab===id?'active':''}" data-tab="${id}">${icon(ico,21)}<span>${label}</span></button>`).join('')}</nav>`;
}

function modal() {
 if (!state.modal) return '';
 let body='';
 if (state.modal==='connect') body=`<div class="modal-icon blue">${icon('chat',23)}</div><span class="eyebrow">ПОДКЛЮЧЕНИЕ АККАУНТА</span><h2>Ты решаешь, какие чаты открыть</h2><p>SpyChau работает через официальное подключение Telegram Business. Telegram покажет список разрешений и чатов до подтверждения.</p><div class="steps"><div><b>1</b><span>Открой настройки Telegram Business</span></div><div><b>2</b><span>Выбери SpyChau и нужные чаты</span></div><div><b>3</b><span>Вернись сюда — проверим статус</span></div></div><div class="modal-callout">${icon('lock',16)} Секретные чаты не поддерживаются. События до подключения недоступны.</div><button class="button button-blue modal-primary" data-action="close">Понятно ${icon('chevron',16)}</button>`;
 if (state.modal==='archive') body=`<div class="modal-icon cyan">${icon('archive',23)}</div><span class="eyebrow">АРХИВ СОБЫТИЙ</span><h2>Здесь будет твоя история</h2><p>Когда подключение заработает, можно будет искать сообщения и версии по чату, типу события и дате.</p><label class="search-field">${icon('search',17)}<input id="archive-search" value="${escapeHtml(state.query)}" placeholder="Поиск по архиву"></label><div class="archive-empty">${icon('clock',19)}<span>${state.query?'Ничего не найдено — архив пока пуст.':'Событий пока нет. Подключи чаты, чтобы начать.'}</span></div><button class="button button-blue modal-primary" data-tab="home">К подключению ${icon('chevron',16)}</button>`;
 if (state.modal==='privacy') body=`<div class="modal-icon green">${icon('shield',23)}</div><span class="eyebrow">ПРОЗРАЧНОСТЬ</span><h2>Доступ и данные под твоим контролем</h2><p>Бот получает сообщения только из выбранных тобой чатов. Разрешения можно изменить или отозвать в настройках Telegram Business.</p><div class="privacy-points"><div>${icon('check',16)}<span>Секретные чаты не доступны Bot API</span></div><div>${icon('check',16)}<span>Архив можно будет удалить по запросу</span></div><div>${icon('check',16)}<span>Цифровая подписка в Telegram оплачивается Stars</span></div></div><button class="button button-blue modal-primary" data-action="close">Закрыть ${icon('chevron',16)}</button>`;
 return `<div class="modal-backdrop" data-action="backdrop"><div class="modal">${body}<button class="modal-close" data-action="close" aria-label="Закрыть">${icon('close',18)}</button></div></div>`;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function render() { app.innerHTML=`<div class="app-shell"><div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>${topbar()}<main>${state.tab==='home'?home():state.tab==='services'?services():profile()}</main>${nav()}${modal()}</div>`; }

app.addEventListener('click', (event) => {
 const target=event.target.closest('[data-action],[data-tab]'); if (!target) return;
 if (target.dataset.action==='backdrop' && event.target!==target) return;
 if (target.dataset.tab) { state.tab=target.dataset.tab; state.modal=null; render(); return; }
 if (target.dataset.action==='close' || target.dataset.action==='backdrop') { state.modal=null; render(); return; }
 if (target.dataset.action) { state.modal=target.dataset.action; render(); }
});
app.addEventListener('input',event=>{if(event.target.id==='archive-search'){state.query=event.target.value;const msg=document.querySelector('.archive-empty span');if(msg)msg.textContent=state.query?'Ничего не найдено — архив пока пуст.':'Событий пока нет. Подключи чаты, чтобы начать.';}});

const tg=window.Telegram?.WebApp;
if(tg){tg.ready?.();tg.expand?.();state.user=tg.initDataUnsafe?.user||null;if(tg.initData){fetch('/api/auth/telegram',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({init_data:tg.initData})}).catch(()=>{});}}
render();
