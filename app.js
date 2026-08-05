'use strict';

/* ==========================================================================
   IPM Roster — основной скрипт приложения
   ОГЛАВЛЕНИЕ:
   1. CONFIG       — константы, справочники, чейнджлог
   2. STATE        — глобальное состояние приложения
   3. SERVICES
      3.1 Supabase — клиент БД и API-методы
      3.2 Dates    — работа с датами
      3.3 Utils    — экранирование, парсинг, DOM-хелперы
      3.4 Toast    — уведомления
      3.5 Modals   — общий механизм модальных окон
   4. UI-МОДУЛИ
      4.1 Auth       — режим администратора
      4.2 Calendar   — сетка календаря и подсветка смен
      4.3 Events     — отпуска и дни рождения
      4.4 Staff      — список сотрудников и фильтрация
      4.5 Stats      — аналитика
      4.6 ShiftModal — редактирование смены
      4.7 Changelog / Help
   5. BOOTSTRAP    — привязка событий и инициализация
   ========================================================================== */

/* ==========================================================================
   1. CONFIG (КОНСТАНТЫ, СПРАВОЧНИКИ, ЧЕЙНДЖЛОГ)
   ========================================================================== */
const CONFIG = Object.freeze({
    SUPABASE_URL: 'https://fxdzzmgxsakmxymjnefd.supabase.co',
    SUPABASE_KEY: 'sb_publishable_Zug-QaFA6stMJ_XQuvOoUw_ZqwgUXTH',
    // Пароль режима администратора. Приложение — внутренний инструмент,
    // поэтому ключи сознательно хранятся в клиентском коде.
    ADMIN_PASSWORD: '123',
    HELP_HIDE_KEY: 'ipm_roster_hide_help',
    MAX_TOASTS: 4,
    TOAST_TTL_MS: 3500,
    MODAL_ANIMATION_MS: 300,
});

const MONTHS_RU = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const MONTHS_RU_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Подписи типов изменений в чейнджлоге */
const CHANGE_TYPE_LABELS = { new: 'Новое', fix: 'Фикс', upd: 'Изм' };

const CHANGELOG_DATA = [
   const CHANGELOG_DATA = [
    {
        version: 'v1.4.1',
        date: 'Август 2026',
        changes: [
            { type: 'fix', text: 'Восстановлено отображение иконки приложения (favicon) во вкладке браузера — она встроена в HTML как SVG и не зависит от внешних файлов.' },
            { type: 'upd', text: 'Рефакторинг кодовой базы: единая структура «конфиг → сервисы → UI-модули», устранено дублирование логики рендера, комментарии приведены к общему стандарту. Внешнее поведение не менялось.' },
        ],
    },
    {
        version: 'v1.4.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Telegram-бот: команда /schedule присылает картинку-календарь дежурств на месяц (понимает аргументы: /schedule 09, /schedule 2026-09, /schedule 09-2026).' },
            { type: 'new', text: 'Картинка генерируется на лету в фирменном стиле: подсветка текущего дня, выходные, плашки дежурных и отметки дней рождения.' },
        ],
    },
    {
        version: 'v1.3.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Создан Telegram-бот системы (@ipm_roster_bot): уведомления о дежурствах приходят каждому сотруднику в личные сообщения.' },
            { type: 'new', text: 'Автоматическая рассылка: в 07:50 — кто дежурит сегодня и дни рождения (сегодня и завтра), в 16:50 — кто дежурит сегодня.' },
            { type: 'new', text: 'Напоминания о днях рождения: за один день и в день рождения.' },
            { type: 'new', text: 'Команды бота: /start — выбор себя из списка сотрудников, /today, /tomorrow, /birthdays, /test, /help.' },
            { type: 'new', text: 'В шапке добавлена кнопка «✈️ Telegram» — быстрый переход к боту.' },
        ],
    },
    {
        version: 'v1.2.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'В карточке смены добавлено поле «Часы переработки» — значение сохраняется в БД вместе со сменой.' },
            { type: 'upd', text: 'Аналитика переработок: итог за месяц считается как сумма часов из смен сотрудника вместо авторасчета по дням недели.' },
            { type: 'upd', text: 'Кнопки «Пред», «Сегодня» и «След» перенесены в заголовок календаря, в шапке осталась только кнопка входа.' },
            { type: 'upd', text: 'Секции «Отпуска» и «Дни рождения» свёрнуты по умолчанию и раскрываются по клику.' },
        ],
    },
    {
        version: 'v1.1.5',
        date: 'Август 2026',
        changes: [
            { type: 'fix', text: 'Исправлена XSS-уязвимость: экранирование пользовательского HTML теперь действительно работает.' },
            { type: 'fix', text: 'Исправлена форма входа администратора: страница больше не перезагружается при отправке пароля.' },
            { type: 'new', text: 'Добавлены toast-уведомления об ошибках и успешных операциях.' },
            { type: 'new', text: 'Клавиатурная доступность: календарь, списки и заголовки секций управляются с клавиатуры.' },
            { type: 'upd', text: 'Обработка ошибок БД, защита от двойных кликов и оптимизация подсчета смен.' },
        ],
    },
    {
        version: 'v1.1.4',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Обновлено визуальное оформление: глубокий диагональный градиент и мягкое свечение фоновых акцентов.' },
            { type: 'upd', text: 'Улучшены эффекты стекла (glassmorphism) и акцентная неоновая подсветка текущей даты.' },
            { type: 'upd', text: 'Оптимизирован фоновый световой ореол над блоком аналитики для лучшей читаемости.' },
        ],
    },
    {
        version: 'v1.1.3',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Добавлена поддержка отображения новой версии в чейнджлоге.' },
            { type: 'upd', text: 'Оптимизация интерфейса и мелкие улучшения производительности.' },
            { type: 'fix', text: 'Исправлены незначительные ошибки верстки и отображения данных.' },
        ],
    },
    {
        version: 'v1.1.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Добавлена ролевая модель авторизации (Режим Гостя / Администратора).' },
            { type: 'new', text: 'Добавлен статус активности системы и интерактивное модальное окно чейнджлога.' },
            { type: 'upd', text: 'Скрыты элементы управления добавлением и удалением дежурств для неавторизованных пользователей.' },
            { type: 'upd', text: 'Расширена аналитическая панель с расчетом ночных и выходных переработок.' },
            { type: 'fix', text: 'Исправлено корректное отображение диапазонов дат отпусков, пересекающих границу месяцев.' },
        ],
    },
    {
        version: 'v1.0.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Первый релиз IPM Roster.' },
            { type: 'new', text: 'Полная синхронизация графика дежурств с Supabase в реальном времени.' },
            { type: 'new', text: 'Интерактивный сетчатый календарь с подсветкой текущей даты.' },
            { type: 'new', text: 'Учет отпусков сотрудников и плашки дней рождения в ячейках календаря.' },
        ],
    },
];

/* ==========================================================================
   2. STATE (ГЛОБАЛЬНОЕ СОСТОЯНИЕ)
   ========================================================================== */
const state = {
    isAdmin: false,            // флаг прав администратора
    currentDate: new Date(),   // отображаемый месяц/год в календаре
    selectedStaff: null,       // выбранный сотрудник для фильтрации
    activeEditDate: null,      // дата, редактируемая в модалке смены
    isBusy: false,             // защита от параллельных запросов
    lastFocusedElement: null,  // для возврата фокуса после закрытия модалки
    // Кэш данных из Supabase
    staff: [],                 // string[]
    shifts: {},                // { 'YYYY-MM-DD': { person, overtime } }
    vacations: [],             // { id, name, start, end }
    birthdays: {},             // { 'MM-DD': personName }
};

/* ==========================================================================
   3.1 SERVICES: SUPABASE (КЛИЕНТ И API-МЕТОДЫ)
   ========================================================================== */
let supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
} catch (err) {
    console.error('Не удалось инициализировать Supabase-клиент:', err);
}

const api = {
    /**
     * Параллельная загрузка всех таблиц.
     * @returns {Promise<boolean>} true — данные загружены успешно
     */
    async loadAll() {
        if (!supabaseClient) return false;
        try {
            const [staffRes, shiftsRes, vacRes, bdayRes] = await Promise.all([
                supabaseClient.from('staff').select('name'),
                supabaseClient.from('shifts').select('shift_date, staff_name, overtime_hours'),
                supabaseClient.from('vacations').select('*'),
                supabaseClient.from('birthdays').select('*'),
            ]);

            const firstError = [staffRes, shiftsRes, vacRes, bdayRes]
                .map(res => res.error)
                .find(Boolean);
            if (firstError) {
                console.error('Ошибка при загрузке данных из Supabase:', firstError);
                return false;
            }

            state.staff = (staffRes.data || []).map(item => item.name);

            state.shifts = {};
            (shiftsRes.data || []).forEach(s => {
                state.shifts[s.shift_date] = {
                    person: s.staff_name,
                    overtime: parseOvertime(s.overtime_hours),
                };
            });

            state.vacations = (vacRes.data || []).map(v => ({
                id: v.id,
                name: v.name,
                start: v.start_date,
                end: v.end_date,
            }));

            state.birthdays = {};
            (bdayRes.data || []).forEach(b => {
                state.birthdays[b.date_key] = b.person_name;
            });

            return true;
        } catch (err) {
            console.error('Ошибка при загрузке данных из Supabase:', err);
            return false;
        }
    },

    // Мутации (вызываются только в режиме администратора)
    upsertShift: (date, person, overtime) => supabaseClient
        .from('shifts')
        .upsert([{ shift_date: date, staff_name: person, overtime_hours: overtime }]),
    deleteShift: date => supabaseClient.from('shifts').delete().eq('shift_date', date),
    addVacation: (name, start, end) => supabaseClient
        .from('vacations')
        .insert([{ name, start_date: start, end_date: end }])
        .select(),
    deleteVacation: id => supabaseClient.from('vacations').delete().eq('id', id),
    upsertBirthday: (key, name) => supabaseClient
        .from('birthdays')
        .upsert([{ date_key: key, person_name: name }]),
    deleteBirthday: key => supabaseClient.from('birthdays').delete().eq('date_key', key),
    addStaff: name => supabaseClient.from('staff').insert([{ name }]),
    deleteStaff: name => supabaseClient.from('staff').delete().eq('name', name),
};

/* ==========================================================================
   3.2 SERVICES: DATES (РАБОТА С ДАТАМИ)
   ========================================================================== */
const dates = {
    /** Date → 'YYYY-MM-DD' (локальное время, без UTC-сдвига) */
    toKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    /** Date → 'YYYY-MM' (префикс для фильтрации смен по месяцу) */
    monthKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Парсит 'YYYY-MM-DD' как ЛОКАЛЬНУЮ дату (без сдвига из-за UTC).
     * Устойчив и к полным ISO-строкам (берёт первые 10 символов).
     */
    parseLocal(dateStr) {
        if (!dateStr) return null;
        const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d);
    },

    /** 'YYYY-MM-DD' → «5 сентября 2026» */
    human(dateStr) {
        const d = this.parseLocal(dateStr);
        if (!d) return dateStr;
        return `${d.getDate()} ${MONTHS_RU_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
    },

    /** Диапазон отпуска: «1–14 сентября» или «28 сентября – 5 октября» */
    vacationRange(startStr, endStr) {
        const s = this.parseLocal(startStr);
        const e = this.parseLocal(endStr);
        if (!s || !e) return '';
        const sMonth = MONTHS_RU_GENITIVE[s.getMonth()];
        const eMonth = MONTHS_RU_GENITIVE[e.getMonth()];
        if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
            return `${s.getDate()}–${e.getDate()} ${sMonth}`;
        }
        return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth}`;
    },
};

/* ==========================================================================
   3.3 SERVICES: UTILS (ЭКРАНИРОВАНИЕ, ПАРСИНГ, DOM-ХЕЛПЕРЫ)
   ========================================================================== */
/** Шорткат для доступа к элементам по id */
const $ = id => document.getElementById(id);

/** Экранирование спецсимволов HTML для защиты от XSS */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Нормализация часов переработки из инпута/БД:
 * число >= 0 с округлением до сотых (понимает запятую).
 */
function parseOvertime(value) {
    const num = parseFloat(String(value).replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.round(num * 100) / 100;
}

/** Пустая заглушка для пустых списков */
function createEmptyHint(text) {
    const div = document.createElement('div');
    div.className = 'empty-hint';
    div.textContent = text;
    return div;
}

/** Кнопка «×» для удаления элемента списка */
function createDeleteBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'delete-btn';
    btn.setAttribute('aria-label', label);
    btn.textContent = '×';
    btn.addEventListener('click', onClick);
    return btn;
}

/** Обёртка клавиатурной активации (Enter / Space) для кнопкоподобных элементов */
function onActivate(handler) {
    return event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handler(event);
        }
    };
}

/**
 * Единый рендер списков инфо-карточек (отпуска, дни рождения).
 * @param {HTMLElement} container целевой список
 * @param {Array<{className: string, html: string, onDelete: ?{label: string, handler: Function}}>} items
 * @param {string} emptyText текст при пустом списке
 */
function renderInfoCardList(container, items, emptyText) {
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
        container.appendChild(createEmptyHint(emptyText));
        return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach(({ className, html, onDelete }) => {
        const card = document.createElement('div');
        card.className = className;
        const body = document.createElement('span');
        body.innerHTML = html; // вызывающий код обязан экранировать данные
        card.appendChild(body);
        if (onDelete) card.appendChild(createDeleteBtn(onDelete.label, onDelete.handler));
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

/** Один проход по сменам вместо фильтра для каждого сотрудника */
function countShiftsByStaff(monthPrefix) {
    const counts = {};
    for (const [date, shift] of Object.entries(state.shifts)) {
        if (date.startsWith(monthPrefix)) {
            counts[shift.person] = (counts[shift.person] || 0) + 1;
        }
    }
    return counts;
}

/* ==========================================================================
   3.4 SERVICES: TOAST (УВЕДОМЛЕНИЯ)
   ========================================================================== */
function showToast(message, type = 'success') {
    const container = $('toast-container');
    if (!container) return;

    // Ограничиваем количество одновременных уведомлений
    while (container.children.length >= CONFIG.MAX_TOASTS) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message; // textContent — безопасно, HTML не интерпретируется
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), CONFIG.MODAL_ANIMATION_MS);
    }, CONFIG.TOAST_TTL_MS);
}

/* ==========================================================================
   3.5 SERVICES: MODALS (ОБЩИЙ МЕХАНИЗМ МОДАЛЬНЫХ ОКОН)
   ========================================================================== */
const modals = {
    _closers: {},

    /** Регистрирует «штатный» обработчик закрытия оверлея (со side-эффектами) */
    registerCloser(id, fn) {
        this._closers[id] = fn;
    },

    open(id) {
        const overlay = $(id);
        if (!overlay) return;
        state.lastFocusedElement = document.activeElement;
        overlay.style.display = 'flex';
        requestAnimationFrame(() => overlay.classList.add('active'));
    },

    close(id) {
        const overlay = $(id);
        if (!overlay) return;
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            // Возврат фокуса на элемент, открывший модалку
            const el = state.lastFocusedElement;
            if (el && typeof el.focus === 'function') el.focus();
            state.lastFocusedElement = null;
        }, CONFIG.MODAL_ANIMATION_MS);
    },

    /** Текущий открытый оверлей (последний в DOM) */
    getVisible() {
        const overlays = document.querySelectorAll('.modal-overlay');
        for (let i = overlays.length - 1; i >= 0; i--) {
            if (overlays[i].style.display === 'flex') return overlays[i];
        }
        return null;
    },

    requestClose(overlay) {
        const closer = this._closers[overlay.id];
        if (closer) closer();
    },

    /** Фокус-трап: Tab циклически перемещается внутри открытой модалки */
    trapFocus(container, event) {
        const focusables = container.querySelectorAll(
            'button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    },
};

/* ==========================================================================
   4.1 UI: AUTH (РЕЖИМ АДМИНИСТРАТОРА)
   ========================================================================== */
const AuthUI = {
    /** Клик по кнопке «Вход/Выйти» в шапке */
    toggle() {
        if (state.isAdmin) {
            state.isAdmin = false;
            refreshAuthViews();
            showToast('Вы вышли из режима администратора');
        } else {
            modals.open('auth-modal');
            const input = $('auth-password-input');
            input.value = '';
            input.focus();
        }
    },

    /** Отправка пароля (preventDefault — без перезагрузки страницы) */
    login(event) {
        if (event) event.preventDefault();
        const value = $('auth-password-input').value;
        if (value === CONFIG.ADMIN_PASSWORD) {
            state.isAdmin = true;
            modals.close('auth-modal');
            refreshAuthViews();
            showToast('Вход выполнен');
        } else {
            showToast('Неверный пароль!', 'error');
        }
    },

    close() {
        modals.close('auth-modal');
    },

    /** Показ/скрытие админских контролов в зависимости от роли */
    apply() {
        const btn = $('auth-btn');
        btn.textContent = state.isAdmin ? '🔒 Выйти' : '🔑 Вход';
        btn.classList.toggle('active-auth', state.isAdmin);
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = state.isAdmin ? '' : 'none';
        });
    },
};

/* ==========================================================================
   4.2 UI: CALENDAR (СЕТКА КАЛЕНДАРЯ И ПОДСВЕТКА СМЕН)
   ========================================================================== */
const CalendarUI = {
    /** Полный рендер сетки текущего месяца */
    render() {
        const grid = $('calendar-grid');
        if (!grid) return;

        // Перезапуск анимации появления (стандартный reflow-приём)
        grid.style.animation = 'none';
        void grid.offsetHeight;
        grid.style.animation = 'fadeIn 0.4s ease-out';
        grid.innerHTML = '';

        const fragment = document.createDocumentFragment();

        // Заголовки дней недели
        WEEKDAYS_RU.forEach((label, idx) => {
            const cell = document.createElement('div');
            cell.className = idx >= 5 ? 'weekday weekend' : 'weekday';
            cell.textContent = label;
            fragment.appendChild(cell);
        });

        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        const periodLabel = $('current-period-label');
        if (periodLabel) periodLabel.textContent = `${MONTHS_RU[month]} ${year}`;

        const todayKey = dates.toKey(new Date());
        let firstDay = new Date(year, month, 1).getDay();
        firstDay = firstDay === 0 ? 6 : firstDay - 1; // неделя начинается с понедельника
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Пустые ячейки до первого дня месяца
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'day-card empty';
            empty.setAttribute('aria-hidden', 'true');
            fragment.appendChild(empty);
        }

        // Дни месяца
        for (let day = 1; day <= daysInMonth; day++) {
            fragment.appendChild(this.buildDayCard(year, month, day, todayKey));
        }

        grid.appendChild(fragment);
    },

    /** Сборка одной карточки дня (номер, ДР-бейдж, тег смены, интерактивность) */
    buildDayCard(year, month, day, todayKey) {
        const dateObj = new Date(year, month, day);
        const dateKey = dates.toKey(dateObj);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        const shift = state.shifts[dateKey];
        const bdayPerson = state.birthdays[dateKey.slice(5)]; // ключ ДР хранится как 'MM-DD'

        const cell = document.createElement('div');
        cell.className = [
            'day-card',
            isWeekend && 'is-weekend',
            dateKey === todayKey && 'is-today',
            !state.isAdmin && 'readonly',
        ].filter(Boolean).join(' ');

        cell.innerHTML = `
            <div class="day-header">
                <span class="day-number">${day}</span>
            </div>
            ${bdayPerson ? `<div class="bday-badge">🎂 ${escapeHtml(bdayPerson.split(' ')[0])}</div>` : ''}
        `;

        // Тег назначенной смены
        if (shift) {
            const tag = document.createElement('div');
            tag.className = `duty-tag ${state.selectedStaff === shift.person ? 'highlighted' : ''}`;
            tag.setAttribute('data-person', shift.person);
            tag.innerHTML = `<span>👤 ${escapeHtml(shift.person)}</span>`;
            cell.appendChild(tag);
        }

        // Интерактивность (мышь + клавиатура) только для администратора
        if (state.isAdmin) {
            cell.setAttribute('role', 'button');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label',
                `${day} ${MONTHS_RU_GENITIVE[month]}${shift ? `, дежурит: ${shift.person}` : ''}`);
            cell.addEventListener('click', () => ShiftModal.open(dateKey));
            cell.addEventListener('keydown', onActivate(() => ShiftModal.open(dateKey)));
        }

        return cell;
    },

    /** Подсветка смен выбранного сотрудника без полного рендера */
    updateHighlights() {
        document.querySelectorAll('.duty-tag').forEach(tag => {
            const person = tag.getAttribute('data-person');
            tag.classList.toggle('highlighted',
                Boolean(state.selectedStaff && person === state.selectedStaff));
        });
    },
};

/* ==========================================================================
   4.3 UI: EVENTS (ОТПУСКА И ДНИ РОЖДЕНИЯ)
   ========================================================================== */
const EventsUI = {
    render() {
        this.renderVacations();
        this.renderBirthdays();
    },

    renderVacations() {
        const items = state.vacations.map(v => ({
            className: 'info-card vacation',
            html: `<b>${escapeHtml(v.name)}</b>: ${escapeHtml(dates.vacationRange(v.start, v.end))}`,
            onDelete: state.isAdmin
                ? { label: 'Удалить отпуск', handler: () => this.deleteVacation(v.id) }
                : null,
        }));
        renderInfoCardList($('vacations-list'), items, 'Отпусков пока нет');
    },

    renderBirthdays() {
        const items = Object.keys(state.birthdays).sort().map(key => {
            const [m, d] = key.split('-');
            const monthName = MONTHS_RU_GENITIVE[parseInt(m, 10) - 1];
            return {
                className: 'info-card bday',
                html: `<b>${escapeHtml(state.birthdays[key])}</b> — ${parseInt(d, 10)} ${monthName}`,
                onDelete: state.isAdmin
                    ? { label: 'Удалить день рождения', handler: () => this.deleteBirthday(key) }
                    : null,
            };
        });
        renderInfoCardList($('birthdays-list'), items, 'Дней рождения пока нет');
    },

    async addVacation(event) {
        if (event) event.preventDefault();
        if (!state.isAdmin || state.isBusy) return;

        const nameInput = $('vacation-name');
        const startInput = $('vacation-start');
        const endInput = $('vacation-end');
        const name = nameInput.value.trim();
        const start = startInput.value;
        const end = endInput.value;

        if (!name || !start || !end) {
            showToast('Заполните все поля отпуска', 'error');
            return;
        }
        if (end < start) {
            showToast('Дата окончания раньше даты начала', 'error');
            return;
        }

        state.isBusy = true;
        try {
            const { data, error } = await api.addVacation(name, start, end);
            if (error) throw error;
            state.vacations.push({ id: data[0].id, name, start, end });
            nameInput.value = '';
            startInput.value = '';
            endInput.value = '';
            this.render();
            toggleForm('vacation-form', $('vacation-form-toggle'));
            showToast('Отпуск добавлен');
        } catch (err) {
            console.error('Ошибка добавления отпуска:', err);
            showToast('Не удалось сохранить отпуск', 'error');
        } finally {
            state.isBusy = false;
        }
    },

    async deleteVacation(id) {
        if (!state.isAdmin || state.isBusy) return;
        state.isBusy = true;
        try {
            const { error } = await api.deleteVacation(id);
            if (error) throw error;
            state.vacations = state.vacations.filter(v => v.id !== id);
            this.render();
            showToast('Отпуск удален');
        } catch (err) {
            console.error('Ошибка удаления отпуска:', err);
            showToast('Не удалось удалить отпуск', 'error');
        } finally {
            state.isBusy = false;
        }
    },

    async addBirthday(event) {
        if (event) event.preventDefault();
        if (!state.isAdmin || state.isBusy) return;

        const nameInput = $('bday-name');
        const dayInput = $('bday-day');
        const name = nameInput.value.trim();
        const day = parseInt(dayInput.value, 10);

        if (!name || !(day >= 1 && day <= 31)) {
            showToast('Укажите имя и корректный день (1–31)', 'error');
            return;
        }

        // Модель данных: на одну дату хранится только один ДР (upsert перезаписывает имя)
        const month = $('bday-month').value;
        const key = `${month}-${String(day).padStart(2, '0')}`;

        state.isBusy = true;
        try {
            const { error } = await api.upsertBirthday(key, name);
            if (error) throw error;
            state.birthdays[key] = name;
            nameInput.value = '';
            dayInput.value = '';
            this.render();
            CalendarUI.render();
            toggleForm('bday-form', $('bday-form-toggle'));
            showToast('День рождения добавлен');
        } catch (err) {
            console.error('Ошибка добавления дня рождения:', err);
            showToast('Не удалось сохранить день рождения', 'error');
        } finally {
            state.isBusy = false;
        }
    },

    async deleteBirthday(key) {
        if (!state.isAdmin || state.isBusy) return;
        state.isBusy = true;
        try {
            const { error } = await api.deleteBirthday(key);
            if (error) throw error;
            delete state.birthdays[key];
            this.render();
            CalendarUI.render();
            showToast('День рождения удален');
        } catch (err) {
            console.error('Ошибка удаления дня рождения:', err);
            showToast('Не удалось удалить день рождения', 'error');
        } finally {
            state.isBusy = false;
        }
    },
};

/* ==========================================================================
   4.4 UI: STAFF (СПИСОК СОТРУДНИКОВ И ФИЛЬТРАЦИЯ)
   ========================================================================== */
const StaffUI = {
    render() {
        const list = $('staff-list');
        if (!list) return;

        const monthCounts = countShiftsByStaff(dates.monthKey(state.currentDate));
        const fragment = document.createDocumentFragment();

        if (!state.staff.length) {
            fragment.appendChild(createEmptyHint('Список сотрудников пуст'));
        }

        state.staff.forEach(name => {
            const isSelected = state.selectedStaff === name;
            const item = document.createElement('div');
            item.className = `staff-item ${isSelected ? 'active' : ''}`;

            const info = document.createElement('div');
            info.className = 'staff-info';
            info.setAttribute('role', 'button');
            info.setAttribute('tabindex', '0');
            info.setAttribute('aria-pressed', String(isSelected));
            info.setAttribute('aria-label', `${name}: ${isSelected ? 'сбросить фильтр' : 'показать смены'}`);
            info.innerHTML = `
                <span class="staff-name">${escapeHtml(name)} (${monthCounts[name] || 0})</span>
                <span class="staff-action-hint" aria-hidden="true">${isSelected ? 'Сбросить' : 'Показать смены'}</span>
            `;
            const activate = () => this.select(name);
            info.addEventListener('click', activate);
            info.addEventListener('keydown', onActivate(activate));
            item.appendChild(info);

            if (state.isAdmin) {
                item.appendChild(createDeleteBtn(
                    `Удалить сотрудника ${name}`,
                    event => this.remove(name, event)
                ));
            }
            fragment.appendChild(item);
        });

        list.innerHTML = '';
        list.appendChild(fragment);
    },

    /** Клик по сотруднику — включить/сбросить фильтр смен */
    select(name) {
        state.selectedStaff = state.selectedStaff === name ? null : name;
        this.render();
        CalendarUI.updateHighlights();
        StatsUI.update();
    },

    async add(event) {
        if (event) event.preventDefault();
        if (!state.isAdmin || state.isBusy) return;

        const input = $('new-staff-name');
        const name = input.value.trim();
        if (!name) return;
        if (state.staff.includes(name)) {
            showToast('Сотрудник с таким именем уже есть', 'error');
            return;
        }

        state.isBusy = true;
        try {
            const { error } = await api.addStaff(name);
            if (error) throw error;
            state.staff.push(name);
            input.value = '';
            this.render();
            showToast(`Сотрудник «${name}» добавлен`);
        } catch (err) {
            console.error('Ошибка добавления сотрудника:', err);
            showToast('Не удалось добавить сотрудника', 'error');
        } finally {
            state.isBusy = false;
        }
    },

    async remove(name, event) {
        if (event) event.stopPropagation();
        if (!state.isAdmin || state.isBusy) return;

        state.isBusy = true;
        try {
            const { error } = await api.deleteStaff(name);
            if (error) throw error;
            state.staff = state.staff.filter(s => s !== name);
            if (state.selectedStaff === name) state.selectedStaff = null;
            this.render();
            CalendarUI.render();
            StatsUI.update();
            showToast(`Сотрудник «${name}» удален`);
        } catch (err) {
            console.error('Ошибка удаления сотрудника:', err);
            showToast('Не удалось удалить сотрудника', 'error');
        } finally {
            state.isBusy = false;
        }
    },
};

/* ==========================================================================
   4.5 UI: STATS (АНАЛИТИКА)
   ========================================================================== */
const StatsUI = {
    /** Обновление аналитики по выбранному сотруднику за отображаемый месяц */
    update() {
        const monthEl = $('stat-user-month');
        const yearEl = $('stat-user-year');
        const overtimeEl = $('stat-user-overtime');
        if (!monthEl || !yearEl || !overtimeEl) return;

        if (!state.selectedStaff) {
            monthEl.textContent = '-';
            yearEl.textContent = '-';
            overtimeEl.textContent = '-';
            return;
        }

        const year = state.currentDate.getFullYear();
        const monthPrefix = dates.monthKey(state.currentDate);
        let monthShifts = 0;
        let yearShifts = 0;
        let overtimeHours = 0;

        // Переработки — сумма часов, сохранённых в сменах сотрудника (без авторасчёта)
        for (const [dateKey, shift] of Object.entries(state.shifts)) {
            if (shift.person !== state.selectedStaff) continue;
            if (dateKey.startsWith(String(year))) yearShifts++;
            if (dateKey.startsWith(monthPrefix)) {
                monthShifts++;
                overtimeHours += shift.overtime;
            }
        }

        monthEl.textContent = monthShifts;
        yearEl.textContent = yearShifts;
        overtimeEl.textContent = `${Math.round(overtimeHours * 100) / 100} ч.`;
    },
};

/* ==========================================================================
   4.6 UI: SHIFT MODAL (РЕДАКТИРОВАНИЕ СМЕНЫ)
   ========================================================================== */
const ShiftModal = {
    /** Открытие модалки смены для даты (только администратор) */
    open(dateKey) {
        if (!state.isAdmin) return;
        state.activeEditDate = dateKey;

        $('modal-date-title').textContent = `Смена на ${dates.human(dateKey)}`;

        const select = $('modal-staff-select');
        select.innerHTML = '';
        const existing = state.shifts[dateKey];
        if (state.staff.length) {
            state.staff.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                if (existing && existing.person === name) opt.selected = true;
                select.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.textContent = 'Нет сотрудников';
            opt.disabled = true;
            select.appendChild(opt);
        }

        // Часы переработки: предзаполнение (0 для новой смены)
        $('modal-overtime-input').value = existing ? existing.overtime : 0;
        // Нельзя сохранить смену, если список сотрудников пуст
        $('modal-save-btn').disabled = state.staff.length === 0;

        modals.open('shift-modal');
        select.focus();
    },

    close() {
        modals.close('shift-modal');
        setTimeout(() => { state.activeEditDate = null; }, CONFIG.MODAL_ANIMATION_MS);
    },

    async save() {
        if (!state.isAdmin || !state.activeEditDate || state.isBusy) return;

        const person = $('modal-staff-select').value;
        if (!person) {
            showToast('Нет сотрудников для назначения', 'error');
            return;
        }

        // Часы переработки вводятся вручную и сохраняются в БД вместе со сменой
        const overtime = parseOvertime($('modal-overtime-input').value);

        state.isBusy = true;
        try {
            const { error } = await api.upsertShift(state.activeEditDate, person, overtime);
            if (error) throw error;
            state.shifts[state.activeEditDate] = { person, overtime };
            this.close();
            refreshPeriodViews();
            showToast('Смена назначена');
        } catch (err) {
            console.error('Ошибка сохранения смены:', err);
            showToast('Не удалось сохранить смену', 'error');
        } finally {
            state.isBusy = false;
        }
    },

    async remove() {
        if (!state.isAdmin || !state.activeEditDate || state.isBusy) return;
        state.isBusy = true;
        try {
            const { error } = await api.deleteShift(state.activeEditDate);
            if (error) throw error;
            delete state.shifts[state.activeEditDate];
            this.close();
            refreshPeriodViews();
            showToast('Смена снята');
        } catch (err) {
            console.error('Ошибка снятия смены:', err);
            showToast('Не удалось снять смену', 'error');
        } finally {
            state.isBusy = false;
        }
    },
};

/* ==========================================================================
   4.7 UI: CHANGELOG / HELP
   ========================================================================== */
const ChangelogUI = {
    open(event) {
        if (event) event.preventDefault();
        const body = $('changelog-body');
        if (!body) return;
        body.innerHTML = CHANGELOG_DATA.map(release => `
            <div class="changelog-version-block">
                <div class="changelog-version-header">
                    <strong class="changelog-version">${escapeHtml(release.version)}</strong>
                    <span class="changelog-date">${escapeHtml(release.date)}</span>
                </div>
                <ul class="changelog-list">
                    ${release.changes.map(item => `
                        <li class="changelog-item">
                            <span class="changelog-type type-${item.type}">
                                ${CHANGE_TYPE_LABELS[item.type] || item.type}
                            </span>
                            <span>${escapeHtml(item.text)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');
        modals.open('changelog-modal');
    },

    close() {
        modals.close('changelog-modal');
    },
};

const HelpUI = {
    open(event) {
        if (event) event.preventDefault();
        const checkbox = $('dont-show-help-again');
        if (checkbox) checkbox.checked = false;
        modals.open('help-modal');
    },

    /** При закрытии любым способом сохраняем настройку «больше не показывать» */
    close() {
        const checkbox = $('dont-show-help-again');
        if (checkbox && checkbox.checked) {
            localStorage.setItem(CONFIG.HELP_HIDE_KEY, 'true');
        }
        modals.close('help-modal');
    },
};

/* ==========================================================================
   5. BOOTSTRAP (ПРИВЯЗКА СОБЫТИЙ И ИНИЦИАЛИЗАЦИЯ)
   ========================================================================== */

/** Перерисовка всех представлений, зависящих от отображаемого периода */
function refreshPeriodViews() {
    CalendarUI.render();
    StaffUI.render();
    StatsUI.update();
}

/** Полное обновление интерфейса при смене роли */
function refreshAuthViews() {
    AuthUI.apply();
    CalendarUI.render();
    EventsUI.render();
    StaffUI.render();
}

/** Навигация по месяцам */
function navigatePeriod(delta) {
    state.currentDate.setMonth(state.currentDate.getMonth() + delta);
    refreshPeriodViews();
}

/** Возврат к текущей дате */
function goToday() {
    state.currentDate = new Date();
    refreshPeriodViews();
}

/** Свернуть/развернуть секцию. Клики по вложенным кнопкам («+») игнорируются. */
function toggleSection(panelId, event) {
    if (event && event.target.closest && event.target.closest('.icon-btn')) return;
    const panel = $(panelId);
    if (!panel) return;
    const collapsed = panel.classList.toggle('collapsed');
    const title = panel.querySelector('.section-title');
    if (title) title.setAttribute('aria-expanded', String(!collapsed));
}

/** Открыть/закрыть форму добавления; разворачивает секцию, если она свёрнута */
function toggleForm(formId, btn, event) {
    if (!state.isAdmin) return;
    if (event) event.stopPropagation();

    const form = $(formId);
    if (!form) return;

    const panel = form.closest('.glass-panel');
    if (panel && panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
        const title = panel.querySelector('.section-title');
        if (title) title.setAttribute('aria-expanded', 'true');
    }

    const isOpen = form.classList.toggle('active');
    if (btn) {
        btn.classList.toggle('active', isOpen);
        btn.textContent = isOpen ? '×' : '+';
        btn.setAttribute('aria-expanded', String(isOpen));
    }
}

/** Заполнение выпадающего списка месяцев в форме ДР */
function populateMonthDropdown() {
    const select = $('bday-month');
    if (!select) return;
    select.innerHTML = '';
    MONTHS_RU.forEach((name, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx + 1).padStart(2, '0');
        opt.textContent = name;
        select.appendChild(opt);
    });
    // По умолчанию — текущий отображаемый месяц
    select.value = String(state.currentDate.getMonth() + 1).padStart(2, '0');
}

/** Версия в футере всегда соответствует последней записи чейнджлога */
function setFooterVersion() {
    const tag = $('footer-version');
    if (tag && CHANGELOG_DATA.length) {
        tag.textContent = CHANGELOG_DATA[0].version;
    }
}

function hideLoadingOverlay() {
    const overlay = $('loading-overlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 400);
}

/** Автопоказ справки при первом входе */
function maybeShowHelp() {
    if (!localStorage.getItem(CONFIG.HELP_HIDE_KEY)) {
        setTimeout(() => HelpUI.open(), 400);
    }
}

/** Регистрация штатных обработчиков закрытия модалок (Escape / клик по подложке) */
function registerModalClosers() {
    modals.registerCloser('shift-modal', () => ShiftModal.close());
    modals.registerCloser('auth-modal', () => AuthUI.close());
    modals.registerCloser('changelog-modal', () => ChangelogUI.close());
    modals.registerCloser('help-modal', () => HelpUI.close());
}

/** Привязка кнопки «+» к форме добавления */
function bindFormToggle(btnId, formId) {
    const btn = $(btnId);
    if (!btn) return;
    btn.addEventListener('click', event => toggleForm(formId, btn, event));
}

/** Все обработчики интерфейса (единая точка привязки) */
function bindEvents() {
    // Шапка и навигация по календарю
    $('auth-btn').addEventListener('click', () => AuthUI.toggle());
    $('prev-month-btn').addEventListener('click', () => navigatePeriod(-1));
    $('today-btn').addEventListener('click', goToday);
    $('next-month-btn').addEventListener('click', () => navigatePeriod(1));

    // Сворачиваемые заголовки секций (мышь + клавиатура)
    document.querySelectorAll('.section-title[data-panel-toggle]').forEach(title => {
        const toggle = event => toggleSection(title.dataset.panelToggle, event);
        title.addEventListener('click', toggle);
        title.addEventListener('keydown', onActivate(toggle));
    });

    // Кнопки «+» форм добавления
    bindFormToggle('vacation-form-toggle', 'vacation-form');
    bindFormToggle('bday-form-toggle', 'bday-form');
    bindFormToggle('staff-form-toggle', 'staff-form');

    // Отправка форм
    $('vacation-form').addEventListener('submit', event => EventsUI.addVacation(event));
    $('bday-form').addEventListener('submit', event => EventsUI.addBirthday(event));
    $('staff-form').addEventListener('submit', event => StaffUI.add(event));
    $('auth-password-form').addEventListener('submit', event => AuthUI.login(event));

    // Модалка смены
    $('modal-save-btn').addEventListener('click', () => ShiftModal.save());
    $('modal-delete-btn').addEventListener('click', () => ShiftModal.remove());
    $('modal-cancel-btn').addEventListener('click', () => ShiftModal.close());

    // Остальные модалки и футер
    $('auth-cancel-btn').addEventListener('click', () => AuthUI.close());
    $('changelog-close-btn').addEventListener('click', () => ChangelogUI.close());
    $('help-close-btn').addEventListener('click', () => HelpUI.close());
    $('footer-version').addEventListener('click', event => ChangelogUI.open(event));
    $('help-link').addEventListener('click', event => HelpUI.open(event));
}

/** Глобальные обработчики: закрытие модалок по подложке, Escape и Tab */
function bindGlobalHandlers() {
    // Закрытие по клику на подложку
    document.addEventListener('click', event => {
        const overlay = event.target;
        if (overlay.classList && overlay.classList.contains('modal-overlay')
            && overlay.style.display === 'flex') {
            modals.requestClose(overlay);
        }
    });

    // Escape (закрытие) и Tab (фокус-трап)
    document.addEventListener('keydown', event => {
        const overlay = modals.getVisible();
        if (!overlay) return;
        if (event.key === 'Escape') {
            modals.requestClose(overlay);
        } else if (event.key === 'Tab') {
            modals.trapFocus(overlay, event);
        }
    });
}

/** Точка входа: загрузка данных и первая отрисовка */
async function init() {
    setFooterVersion();
    populateMonthDropdown();
    registerModalClosers();
    bindEvents();
    bindGlobalHandlers();
    AuthUI.apply(); // скрываем admin-контролы до загрузки данных

    const ok = await api.loadAll();
    CalendarUI.render();
    EventsUI.render();
    StaffUI.render();
    StatsUI.update();
    hideLoadingOverlay();

    if (!ok) {
        showToast('Не удалось загрузить данные из БД. Обновите страницу.', 'error');
    }
    maybeShowHelp();
}

// Старт после готовности DOM (скрипт подключён с defer)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
