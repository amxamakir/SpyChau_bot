# SpyChau release process

## Recent releases

- `v0.8.30: Добавить светлую тему` — добавлена светлая цветовая схема с переключателем в верхней панели; выбор сохраняется на устройстве.


- `v0.8.29: Открывать «О SpyChau» отдельной страницей` — экран с описанием приложения открывается в основном интерфейсе вместо нижней шторки.
- `v0.8.28: Статус подписки и срок справа` — статус подписки и дата окончания отображаются справа от названий строк, с цветными индикаторами активности.

- `v0.8.27: Вернуть исходные цвета рамок иконок` — рамкам возвращены исходные коралловый, жёлтый, фиолетовый, зелёный и оранжевый цвета; внутренние линии остаются в палитре SpyChau.
- `v0.8.26: Исправить цвет линий иконок безопасности` — внутренние линии контурных иконок теперь используют тот же цвет, что и их рамки.
- `v0.8.25: Фирменные цвета значков безопасности` — контурные значки страницы безопасности перекрашены в красные, оранжевые и жёлтые оттенки палитры SpyChau.
- `v0.8.24: Контурные значки безопасности` — галочки заменены тонкими контурными пиктограммами, соответствующими каждому пункту о безопасности и данных.
- `v0.8.23: Оформить почту для чеков в профиле` — название карточки и сохранённый адрес теперь белые и оформлены одинаковым шрифтом и размером.
- `v0.8.22: Убрать подписи над страницами профиля` — синяя подпись «Сервис и поддержка» убрана со страниц «Поддержка» и «Безопасность и данные».
- `v0.8.21: Убрать подпись аккаунта в разделах профиля` — синяя надпись «Мой аккаунт» скрыта на внутренних страницах профиля.
- `v0.8.20: Полноэкранные разделы профиля` — поддержка, безопасность и данные, почта для чеков и удаление данных открываются отдельными страницами с возвратом в профиль.
- `v0.8.19: Настройки уведомлений` — добавлены разделы «Сообщения собеседников» и «Мои действия» с переключателями; выбор локально сохраняется на устройстве, неподдерживаемые Telegram и групповые действия отмечены недоступными.
- `v0.8.18: Раздел уведомлений в профиле` — карточка «Архив событий» заменена карточкой «Уведомления», которая открывает отдельный раздел профиля.
- `v0.8.17: Белые даты и счётчики архива` — дата события и количество событий в карточке контакта теперь отображаются белым цветом.
- `v0.8.16: Убрать пояснение контакта` — из карточки переписки удалена поясняющая строка под данными контакта.
- `v0.8.15: Показывать данные контактов` — в истории рядом с именем контакта показываются username и ID чата, а в карточке переписки повторяются сведения, помогающие отличить собеседника.
- `v0.8.14: Цветные фильтры архива` — фильтры «Удалено», «Изменено» и «Одноразовое» получили цвета палитры «Контрастные метки»; иконки событий используют те же цвета категорий.
- `v0.8.13: Не терять контакты в архиве` — архив загружает события удаления, изменения и одноразовые сообщения независимо от потока обычных сообщений; исходные снимки сохраняются для показа удалённого или изменённого текста.
- `v0.8.12: Увеличить текст на телефонах` — мобильная типографика подстроена под экран iPhone 14 Pro Max: подписи, описания, кнопки и элементы разделов стали крупнее и читаемее.
- `v0.8.11: Исправить safe area в полноэкранном режиме` — возвращён полноэкранный режим; верхний отступ учитывает Safe Area Telegram и не перекрывается стилями для широкого экрана.
- `v0.8.10: Убрать перекрытие шапки кнопками Telegram` — приложение больше не запрашивает fullscreen автоматически: `expand()` раскрывает Mini App на доступную высоту, а safe area применяется при реальном fullscreen.
- `v0.8.9: Адаптивная раскладка Telegram Mini App` — размеры раскладки синхронизируются со стабильной высотой окна Telegram и Visual Viewport; верхний отступ берётся из content safe area, а резервный вариант подстраивается под высоту экрана. Обновление окна и поворот устройства пересчитывают отступы.
- `v0.8.8: Увеличенный отступ над шапкой на телефонах` — гарантированный верхний отступ увеличен до 88 px с учётом safe area Telegram.
- `v0.8.7: Отступ с учётом безопасной зоны Telegram` — верхнее содержимое Mini App учитывает системную и Telegram safe area и перестаёт попадать под кнопки закрытия.
- `v0.8.6: Отступ сверху на мобильных` — верхний отступ приложения на телефонах увеличен с учётом безопасной зоны Telegram.
- `v0.8.5: Бордовый фон приложения` — добавлен мягкий тёмно-бордовый фон страницы и согласован цвет фона Telegram Mini App.
- `v0.8.4: Вертикальное выравнивание карточек` — блок статуса подписки выровнен по центру и сужен, чтобы не пересекаться с машинкой; заголовок подключений опущен ещё немного.
- `v0.8.3: Выравнивание заголовка подключений` — заголовок и счётчик на главной опущены на несколько пикселей для ровного выравнивания.
- `v0.8.2: Align receipt email in profile` — сохранённая почта для чеков отображается справа в строке с названием карточки.
- `v0.8.1: Enlarge profile identity` — аватар, тег и Telegram ID в профиле увеличены на 15%.
- `v0.8.0: Show photos in deleted message events` — фото из удалённых сообщений показываются по сохранённому Telegram file ID через защищённую ссылку.

- `v0.7.7: Bundle Rubik font locally` — файлы Rubik лежат рядом с приложением, чтобы шрифт загружался без обращения к Google Fonts.
- `v0.7.6: Use Rubik throughout the app` — распространён шрифт Rubik на все разделы; версия API health обновлена.
- `v0.7.5: Use Rubik and enlarge profile text` — применён шрифт Rubik и увеличена типографика в профиле.

## Every production update

1. Use the next semantic version: `PATCH` for a fix, `MINOR` for a backward-compatible feature, and `MAJOR` for a breaking change or a change that needs a user action.
2. Commit the complete change directly to the Cloudflare-connected GitHub branch (`main`) with a title in this format:

   ```text
   v0.2.2: Show Telegram profile photos
   ```

   The version and short change description in this commit title are also the Cloudflare deployment title. Keep the colon; the configured deploy command uses the part before it as the version tag.
3. GitHub sends the new `main` commit to Cloudflare Workers Builds. It deploys the Worker and assets at the existing Worker URL, which is the URL opened by Telegram. Users see the new app when they open or reload it; no BotFather URL change is needed for normal app updates.
4. In Cloudflare, confirm the latest deployment shows the expected `vX.Y.Z: change` title and succeeded before announcing the release.

Cloudflare's production Deploy command must be:

```sh
npx wrangler deploy --env production --name spychau-bot --message "$(git log -1 --pretty=%s)" --tag "$(git log -1 --pretty=%s | cut -d: -f1)"
```

For a database schema change, add a new numbered SQL migration in `migrations/` and apply it to production before deploying code that depends on it. Never edit a migration already applied in production.

## Roll back application code

In Cloudflare, open **Workers & Pages → spychau-bot → Deployments**, select the known-good Worker version, and choose **Rollback**. Alternatively, use `npx wrangler rollback <VERSION_ID>` from a signed-in Wrangler project. Record the rollback in GitHub with a commit using a new version number so the source history matches production.

A Worker rollback restores code and configuration associated with that version. It does not undo D1 writes or schema migrations. Back up production data before risky migrations and use a new forward migration to repair production data/schema; do not assume rolling back Worker code reverses database changes.
