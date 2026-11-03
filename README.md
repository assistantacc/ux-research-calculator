# ux-research-calculator

Tools for calculating, visualizing, and interpreting UX/CX research metrics

Веб-приложение для восьми UX/CX-метрик на основе [Swiss Research Excelbook 1.2](https://github.com/UXRozum/Swiss_Excelbook). Интерфейс следует [Material Design 3](https://m3.material.io/).

## Возможности

- SUM, двухпунктовый UMUX, CES, NPS, CSI, ODI, Kano и PSM.
- Переключение `Rus/En`, светлая и тёмная темы, адаптация для телефона.
- Ввод в таблице, вставка из Excel, импорт XLSX/CSV/TSV с сопоставлением столбцов.
- Графики, интерпретации, формулы и явное исключение некорректных строк.
- Автоматическое сохранение в браузере. Экспорт данных и результатов в CSV, всего проекта в JSON, печать в PDF.
- Расчёты и чтение загруженных файлов выполняются на устройстве. Сервер и регистрация не требуются.

## Локальный запуск

Требуются Node.js 22.12+ и pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Откройте адрес, который напечатает Vite (по умолчанию `http://127.0.0.1:5173`).

```sh
pnpm test     # расчёты, граничные случаи, импорт, локализация, резервные копии
pnpm build    # статическая сборка в dist/
pnpm preview  # просмотр собранной версии
```

## Работа с данными

Каждый калькулятор начинает с явно помеченного синтетического примера. Вставка или редактирование заменяет отметку демо пользовательскими данными. Переключение языка переводит интерфейс; введённые пользователем названия и ответы сохраняются.

Одна строка соответствует одному ответу. Для CSI/ODI используется длинный формат: `атрибут`, `важность`, `удовлетворённость`. Для Kano: `свойство`, `реакция на наличие`, `реакция на отсутствие`. В одном файле может быть сколько угодно атрибутов. Для импорта широких таблиц выберите нужные столбцы; для одного атрибута можно задать общее название и добавлять следующие атрибуты через повторный импорт с опцией добавления.

Импортёр позволяет выбрать лист XLSX, первую строку данных и соответствие столбцов. Это важно для файлов с ID участников, несколькими метриками или служебными заголовками. Пустые строки пропускаются; частичные ответы и неверные значения показываются среди исключённых. Цены PSM должны быть положительными и упорядоченными.

Шаблоны CSV содержат заголовки и три демонстрационные строки. Перед вставкой данных с заголовками включите соответствующий флажок. Для десятичных запятых используйте TSV или CSV с разделителем `;`.

Браузерное хранилище относится к конкретному адресу сайта и браузеру. Очистка данных сайта удалит проект. Для резервного копирования выберите **Экспорт → Весь проект · JSON**. Импорт JSON восстанавливает данные всех восьми калькуляторов, настройки и язык.

## Методика и источник

См. [описание формул и отличий от Excel](docs/methodology.md). Сохранены варианты шкал из исходного файла: UMUX 1–5, CES как доля ответов 4–5, CSI 1–5. Повреждённые ссылки и ошибки подсчёта пустых формул не воспроизводятся.

Источник: UXRozum, Swiss Research Excelbook, коммит `8ded7c8eb34e588d81b6a0622455e0bec042cdff`. Исходные Excel-файлы не включены в сборку. Контрольные суммы приведены в [source-manifest.json](docs/source-manifest.json).

## Публикация на GitHub Pages

Подготовлен workflow [pages.yml](.github/workflows/pages.yml), запускаемый вручную. После загрузки исходников в GitHub:

1. В **Settings → Pages → Build and deployment** выберите **GitHub Actions**.
2. В **Actions → Deploy to GitHub Pages** нажмите **Run workflow**.
3. Workflow запустит тесты, соберёт `dist/` и опубликует сайт. Адрес появится в результате deployment.

Автоматической публикации при push нет. Относительные адреса сборки поддерживают размещение в `/ux-research-calculator/` и на собственном домене. Маршруты калькуляторов используют хэш, поэтому обновление страницы не требует серверной настройки маршрутов.

## Структура

- `src/lib/metrics.mjs` — независимые функции расчёта и проверки данных.
- `src/lib/catalog.mjs` — тексты интерфейса, методики и примеры на двух языках.
- `src/lib/storage.mjs` — формат проекта и проверка резервных копий.
- `src/components/` — графики, импортёр и диалоги.
- `tests/metrics.test.mjs` — проверка формул и граничных случаев.

## English

A browser-local UX/CX calculator based on Swiss Research Excelbook 1.2. Includes eight calculators, Russian/English UI, light/dark themes, XLSX/CSV/TSV import with column mapping, charts, calculation notes, CSV exports, JSON project backups, and print-to-PDF. No account or calculation server is required. The initial page load requires the site to be reachable; there is no service worker or offline installation feature.

Install Node.js 22.12+ and pnpm 11.25.0, then run `pnpm install --frozen-lockfile` and `pnpm dev`. Use `pnpm test` and `pnpm build` for validation and production output. See the calculation documentation for source-specific scales and corrections.
