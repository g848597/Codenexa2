# CodeNexa Business

Мобильное бизнес-приложение (CRM, проекты, финансы, AI Director) на React + Vite.
Разбито на модули из исходного монолитного файла `CodeNexaBusiness.jsx`.

## Запуск

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production-сборка в dist/
```

## Структура проекта

```
src/
  main.jsx                 # точка входа, монтирует <App />
  App.jsx                  # корневой компонент: навигация (tab/subScreen),
                            # состояние CRM/Projects, загрузка/сохранение данных

  utils/
    fonts.js                # useFonts() — подключает Google Fonts
    helpers.js               # isoAgo, formatRelative, genId, colorForName,
                              # isValidEmail/Phone, formatDeadline, daysUntil,
                              # deadlineTone, seedActivity, fmt

  data/                      # моковые/демо-данные (заменить на реальный API)
    mockData.js              # COMPANY, METRICS, AI_INSIGHTS, графики выручки
    statusConstants.js       # статусы клиентов/проектов и их цвета
    seedClients.js           # демо-клиенты CRM
    seedProjects.js          # демо-проекты
    tasksData.js             # канбан-доска задач
    teamData.js               # команда / менеджеры
    salesData.js              # воронка продаж
    marketingData.js          # контент-идеи
    notificationsData.js      # лента уведомлений
    plansData.js               # тарифные планы

  storage/                   # слой персистентности (window.storage API)
    storageClient.js          # safeGet/safeSet/safeDelete — безопасные обёртки
    clientsStorage.js         # загрузка/сохранение клиентов CRM
    projectsStorage.js        # загрузка/сохранение проектов + projectFinancials()

  components/
    ui/                       # переиспользуемые примитивы интерфейса
      Glass.jsx, Pill.jsx, ProgressBar.jsx, Avatar.jsx, IconBtn.jsx,
      SectionTitle.jsx, Delta.jsx, ConfirmDialog.jsx, index.js (barrel)
    layout/
      TopBar.jsx, BottomNav.jsx

  features/                  # один экран/модуль = одна папка
    dashboard/Dashboard.jsx
    ai/AIDirector.jsx         # чат с Anthropic Messages API
    crm/
      CRM.jsx                 # список клиентов, поиск/фильтры
      ClientDetail.jsx        # карточка клиента (вкладки)
      ClientFormModal.jsx     # форма создания/редактирования клиента
    projects/
      Projects.jsx
      ProjectDetail.jsx
      ProjectFormModal.jsx
    finance/Finance.jsx
    tasks/Tasks.jsx
    sales/Sales.jsx
    marketing/Marketing.jsx
    team/Team.jsx
    analytics/Analytics.jsx
    notifications/Notifications.jsx
    settings/
      Settings.jsx, Profile.jsx, Subscription.jsx
    more/MoreGrid.jsx

  styles/
    globals.css               # все стили приложения (бывший inline <style>)
```

## Важно про хранилище (window.storage)

CRM и Projects изначально сохранялись через `window.storage` — API,
доступное только внутри Claude.ai-артефактов. В обычном браузере
(`storage/storageClient.js`) все обращения к нему безопасно "проваливаются"
и приложение просто работает на демо-данных из `data/seed*.js` без
сохранения между перезагрузками (`persistent: false`).

Чтобы данные сохранялись по-настоящему, замените реализацию
`storage/storageClient.js` на вызовы вашего backend/БД (той же сигнатуры
`safeGet(key, shared)/safeSet(key, value, shared)/safeDelete(key, shared)`) —
остальной код менять не придётся.

## AI Director

`features/ai/AIDirector.jsx` обращается напрямую к
`https://api.anthropic.com/v1/messages` из браузера. Для реального продакшена
этот вызов обычно нужно перенести на свой backend (чтобы не светить API-ключ
на клиенте).

## Почему так разбито

- **data/** — источник правды по демо-данным, легко подменить на fetch к API.
- **storage/** — вся логика персистентности в одном месте, независимая от UI.
- **components/ui** — мелкие "глупые" компоненты без бизнес-логики.
- **features/** — каждый экран самодостаточен: свои импорты, минимум связей
  с другими фичами (кроме общих ui/data/storage).
- **App.jsx** — единственное место, которое знает про навигацию и "склеивает"
  фичи между собой.

Такое разбиение позволяет открывать/редактировать только нужный файл,
не перечитывая весь проект каждый раз.
