/* ==========================================================================
TABLE OF CONTENTS / ОГЛАВЛЕНИЕ
Configuration & Supabase Init (Инициализация и константы)
Application State (Глобальное состояние)
Changelog & Help Data (Данные версий и справки)
Toast Notifications (Пользовательские уведомления)
Supabase API Service (Загрузка и синхронизация)
App Lifecycle & Initialization (Точка входа)
Authentication System (Система авторизации)
Navigation & Date Helpers (Форматирование дат и навигация)
Events: Vacations & Birthdays (Отпуска и дни рождения)
Calendar Rendering (Отрисовка сетки календаря и смен)
Shift Modal Controller (Модальное окно редактирования смен)
Staff Management (Управление сотрудниками)
Analytics & Overtime Engine (Расчет переработок и статистики)
Changelog & Help Modals (Модальные окна справки и чейнджлога)
Modal Utilities (Общие механизмы открытия/закрытия модалок)
Security Helpers (Экранирование)
Global Handlers (Закрытие модалок, клавиатура)
DOM Ready & Init Trigger
========================================================================== */

/* ==========================================================================
CONFIGURATION & SUPABASE INIT (ИНИЦИАЛИЗАЦИЯ И КОНСТАНТЫ)
ПРИМЕЧАНИЕ: URL и ключ намеренно хранятся в клиентском коде — сервис
является внутренним инструментом и используется только своей командой.
========================================================================== */
const SUPABASE_URL = 'https://fxdzzmgxsakmxymjnefd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Zug-QaFA6stMJ_XQuvOoUw_ZqwgUXTH';

let supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) {
    console.error('Не удалось инициализировать Supabase-клиент:', err);
}

// Пароль для доступа к функциям администратора (только для внутреннего использования)
const ADMIN_PASSWORD = '123';

/* ==========================================================================
2. APPLICATION STATE (ГЛОБАЛЬНОЕ СОСТОЯНИЕ)
========================================================================== */
let isAdminLoggedIn = false;     // Флаг прав администратора
let currentDate = new Date();    // Отображаемый месяц/год в календаре
let selectedStaff = null;        // Выбранный сотрудник для фильтрации
let activeEditDate = null;       // Дата, редактируемая в модальном окне
let isRequestInProgress = false; // Защита от дублирующих/параллельных запросов
let lastFocusedElement = null;   // Для возврата фокуса после закрытия модалки

// Локальный кэш данных из Supabase
let birthdays = {};
let vacations = [];
let staff = [];
// v1.2.0: смена хранится как объект { person, overtime } вместо строки
let shifts = {}; // { 'YYYY-MM-DD': { person: string, overtime: number } }

/* ==========================================================================
3. CHANGELOG & HELP DATA
========================================================================== */
const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const monthsRuGenitive = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const CHANGELOG_DATA = [
    {
        version: 'v1.3.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Создан Telegram-бот системы (@ipm_roster_bot): уведомления о дежурствах приходят каждому сотруднику в личные сообщения.' },
            { type: 'new', text: 'Автоматическая рассылка: в 07:50 — кто дежурит сегодня и дни рождения (сегодня и завтра), в 16:50 — кто дежурит сегодня.' },
            { type: 'new', text: 'Напоминания о днях рождения: за один день и в день рождения.' },
            { type: 'new', text: 'Команды бота: /start — выбор себя из списка сотрудников, /today, /tomorrow, /birthdays, /test, /help.' },
            { type: 'new', text: 'В шапке добавлена кнопка «✈️ Telegram» — быстрый переход к боту.' }
        ]
    },
    {
    version: 'v1.2.0',        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'В карточке смены добавлено поле «Часы переработки» — значение сохраняется в БД вместе со сменой.' },
            { type: 'upd', text: 'Аналитика переработок: итог за месяц считается как сумма часов из смен сотрудника вместо авторасчета по дням недели.' },
            { type: 'upd', text: 'Кнопки «Пред», «Сегодня» и «След» перенесены в заголовок календаря, в шапке осталась только кнопка входа.' },
            { type: 'upd', text: 'Секции «Отпуска» и «Дни рождения» свернуты по умолчанию и раскрываются по клику.' }
        ]
    },
    {
        version: 'v1.1.5',
        date: 'Август 2026',
        changes: [
            { type: 'fix', text: 'Исправлена XSS-уязвимость: экранирование пользовательского HTML теперь действительно работает.' },
            { type: 'fix', text: 'Исправлена форма входа администратора: страница больше не перезагружается при отправке пароля.' },
            { type: 'new', text: 'Добавлены toast-уведомления об ошибках и успешных операциях.' },
            { type: 'new', text: 'Клавиатурная доступность: календарь, списки и заголовки секций управляются с клавиатуры.' },
            { type: 'upd', text: 'Обработка ошибок БД, защита от двойных кликов и оптимизация подсчета смен.' }
        ]
    },
    {
        version: 'v1.1.4',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Обновлено визуальное оформление: глубокий диагональный градиент и мягкое свечение фоновых акцентов.' },
            { type: 'upd', text: 'Улучшены эффекты стекла (glassmorphism) и акцентная неоновая подсветка текущей даты.' },
            { type: 'upd', text: 'Оптимизирован фоновый световой ореол над блоком аналитики для лучшей читаемости.' }
        ]
    },
    {
        version: 'v1.1.3',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Добавлена поддержка отображения новой версии в чейнджлоге.' },
            { type: 'upd', text: 'Оптимизация интерфейса и мелкие улучшения производительности.' },
            { type: 'fix', text: 'Исправлены незначительные ошибки верстки и отображения данных.' }
        ]
    },
    {
        version: 'v1.1.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Добавлена ролевая модель авторизации (Режим Гостя / Администратора).' },
            { type: 'new', text: 'Добавлен статус активности системы и интерактивное модальное окно чейнджлога.' },
            { type: 'upd', text: 'Скрыты элементы управления добавлением и удалением дежурств для неавторизованных пользователей.' },
            { type: 'upd', text: 'Расширена аналитическая панель с расчетом ночных и выходных переработок.' },
            { type: 'fix', text: 'Исправлено корректное отображение диапазонов дат отпусков, пересекающих границу месяцев.' }
        ]
    },
    {
        version: 'v1.0.0',
        date: 'Август 2026',
        changes: [
            { type: 'new', text: 'Первый релиз IPM Roster.' },
            { type: 'new', text: 'Полная синхронизация графика дежурств с Supabase в реальном времени.' },
            { type: 'new', text: 'Интерактивный сетчатый календарь с подсветкой текущей даты.' },
            { type: 'new', text: 'Учет отпусков сотрудников и плашки дней рождения в ячейках календаря.' }
        ]
    }
];

/* ==========================================================================
4. TOAST NOTIFICATIONS (ПОЛЬЗОВАТЕЛЬСКИЕ УВЕДОМЛЕНИЯ)
========================================================================== */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Ограничиваем количество одновременных уведомлений
    while (container.children.length >= 4) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerText = message; // innerText — безопасно, HTML не интерпретируется
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/* ==========================================================================
5. SUPABASE API SERVICE (ЗАГРУЗКА И СИНХРОНИЗАЦИЯ)
========================================================================== */
/**
 * Параллельная загрузка всех таблиц из БД Supabase.
 * @returns {Promise<boolean>} true — данные загружены успешно
 */
async function loadDataFromSupabase() {
    if (!supabaseClient) return false;
    try {
        const [staffRes, shiftsRes, vacRes, bdayRes] = await Promise.all([
            supabaseClient.from('staff').select('name'),
            // v1.2.0: запрашиваем часы переработки вместе со сменами
            supabaseClient.from('shifts').select('shift_date, staff_name, overtime_hours'),
            supabaseClient.from('vacations').select(''),
            supabaseClient.from('birthdays').select('*')
        ]);

        const firstError = [staffRes.error, shiftsRes.error, vacRes.error, bdayRes.error].find(Boolean);
        if (firstError) {
            console.error('Ошибка при загрузке данных из Supabase:', firstError);
            return false;
        }

        if (staffRes.data) staff = staffRes.data.map(item => item.name);
        if (shiftsRes.data) {
            shifts = {};
            shiftsRes.data.forEach(s => {
                shifts[s.shift_date] = {
                    person: s.staff_name,
                    overtime: parseOvertime(s.overtime_hours)
                };
            });
        }
        if (vacRes.data) {
            vacations = vacRes.data.map(v => ({
                id: v.id,
                name: v.name,
                start: v.start_date,
                end: v.end_date
            }));
        }
        if (bdayRes.data) {
            birthdays = {};
            bdayRes.data.forEach(b => { birthdays[b.date_key] = b.person_name; });
        }
        return true;
    } catch (err) {
        console.error('Ошибка при загрузке данных из Supabase:', err);
        return false;
    }
}

/* ==========================================================================
6. APP LIFECYCLE & INITIALIZATION (ТОЧКА ВХОДА)
========================================================================== */
async function init() {
    populateMonthDropdown();
    const ok = await loadDataFromSupabase();
    renderCalendar();
    renderEvents();
    renderStaff();
    updateAnalytics();
    applyAuthUi();
    hideLoadingOverlay();
    if (!ok) {
        showToast('Не удалось загрузить данные из БД. Обновите страницу.', 'error');
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 400);
}

/* ==========================================================================
7. AUTHENTICATION SYSTEM (СИСТЕМА АВТОРИЗАЦИИ)
========================================================================== */
function handleAuthClick() {
    if (isAdminLoggedIn) {
        isAdminLoggedIn = false;
        updateUiForAuthRole();
        showToast('Вы вышли из режима администратора');
    } else {
        openModalOverlay('auth-modal');
        const input = document.getElementById('auth-password-input');
        input.value = '';
        input.focus();
    }
}

function closeAuthModal() {
    closeModalOverlay('auth-modal');
}

function loginAdmin(event) {
    // Предотвращаем перезагрузку страницы и попадание пароля в URL
    if (event) event.preventDefault();
    const input = document.getElementById('auth-password-input').value;
    if (input === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        closeAuthModal();
        updateUiForAuthRole();
        showToast('Вход выполнен');
    } else {
        showToast('Неверный пароль!', 'error');
    }
}

/** Переключает видимость элементов управления в зависимости от прав (только DOM-флаги) */
function applyAuthUi() {
    const btn = document.getElementById('auth-btn');
    if (btn) {
        btn.innerText = isAdminLoggedIn ? '🔒 Выйти' : '🔑 Вход';
        btn.classList.toggle('active-auth', isAdminLoggedIn);
    }
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdminLoggedIn ? '' : 'none';
    });
}

/** Полное обновление интерфейса при смене роли (с перерисовкой списков) */
function updateUiForAuthRole() {
    applyAuthUi();
    renderCalendar();
    renderEvents();
    renderStaff();
}

/* ==========================================================================
8. NAVIGATION & DATE HELPERS (ФОРМАТИРОВАНИЕ ДАТ И НАВИГАЦИЯ)
========================================================================== */
function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Парсит YYYY-MM-DD как ЛОКАЛЬНУЮ дату (без сдвига из-за UTC).
 * Устойчив и к полным ISO-строкам (берет только первые 10 символов).
 */
function parseDateLocal(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function formatHumanDate(dateStr) {
    const d = parseDateLocal(dateStr);
    if (!d) return dateStr;
    return `${d.getDate()} ${monthsRuGenitive[d.getMonth()]} ${d.getFullYear()}`;
}

function populateMonthDropdown() {
    const select = document.getElementById('bday-month');
    if (!select) return;
    select.innerHTML = '';
    monthsRu.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx + 1).padStart(2, '0');
        opt.innerText = m;
        select.appendChild(opt);
    });
    // По умолчанию — текущий отображаемый месяц
    select.value = String(currentDate.getMonth() + 1).padStart(2, '0');
}

function navigatePeriod(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
    renderStaff();
    updateAnalytics();
}

function goToday() {
    currentDate = new Date();
    renderCalendar();
    renderStaff();
    updateAnalytics();
}

function formatVacationRange(startStr, endStr) {
    const s = parseDateLocal(startStr);
    const e = parseDateLocal(endStr);
    if (!s || !e) return '';
    const sDay = s.getDate();
    const sMonth = monthsRuGenitive[s.getMonth()];
    const eDay = e.getDate();
    const eMonth = monthsRuGenitive[e.getMonth()];
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${sDay}–${eDay} ${sMonth}`;
    }
    return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

/* ==========================================================================
9. EVENTS: VACATIONS & BIRTHDAYS (ОТПУСКА И ДНИ РОЖДЕНИЯ)
========================================================================== */
function renderEvents() {
    const vacContainer = document.getElementById('vacations-list');
    const bdayContainer = document.getElementById('birthdays-list');
    if (!vacContainer || !bdayContainer) return;

    // Отпуска
    const vacFragment = document.createDocumentFragment();
    if (!vacations.length) vacFragment.appendChild(createEmptyHint('Отпусков пока нет'));
    vacations.forEach(v => {
        const card = document.createElement('div');
        card.className = 'info-card vacation';
        const infoSpan = document.createElement('span');
        infoSpan.innerHTML = `<b>${escapeHtml(v.name)}</b>: ${escapeHtml(formatVacationRange(v.start, v.end))}`;
        card.appendChild(infoSpan);
        if (isAdminLoggedIn) {
            card.appendChild(createDeleteBtn('Удалить отпуск', () => deleteVacation(v.id)));
        }
        vacFragment.appendChild(card);
    });
    vacContainer.innerHTML = '';
    vacContainer.appendChild(vacFragment);

    // Дни рождения
    const bdayFragment = document.createDocumentFragment();
    const dateKeys = Object.keys(birthdays).sort();
    if (!dateKeys.length) bdayFragment.appendChild(createEmptyHint('Дней рождения пока нет'));
    dateKeys.forEach(dateKey => {
        const [m, d] = dateKey.split('-');
        const monthName = monthsRuGenitive[parseInt(m, 10) - 1];
        const card = document.createElement('div');
        card.className = 'info-card bday';
        const infoSpan = document.createElement('span');
        infoSpan.innerHTML = `<b>${escapeHtml(birthdays[dateKey])}</b> — ${parseInt(d, 10)} ${monthName}`;
        card.appendChild(infoSpan);
        if (isAdminLoggedIn) {
            card.appendChild(createDeleteBtn('Удалить день рождения', () => deleteBirthday(dateKey)));
        }
        bdayFragment.appendChild(card);
    });
    bdayContainer.innerHTML = '';
    bdayContainer.appendChild(bdayFragment);
}

function createEmptyHint(text) {
    const div = document.createElement('div');
    div.className = 'empty-hint';
    div.innerText = text;
    return div;
}

function createDeleteBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'delete-btn';
    btn.setAttribute('aria-label', label);
    btn.innerText = '×';
    btn.onclick = onClick;
    return btn;
}

function toggleSection(panelId, e) {
    if (e && e.target.closest && e.target.closest('.icon-btn')) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const collapsed = panel.classList.toggle('collapsed');
    const title = panel.querySelector('.section-title');
    if (title) title.setAttribute('aria-expanded', String(!collapsed));
}

function toggleForm(formId, btn, e) {
    if (!isAdminLoggedIn) return;
    if (e) e.stopPropagation();
    const form = document.getElementById(formId);
    if (!form) return;

    // Если панель свернута — разворачиваем, чтобы форма была видна
    const panel = form.closest('.glass-panel');
    if (panel && panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
        const title = panel.querySelector('.section-title');
        if (title) title.setAttribute('aria-expanded', 'true');
    }

    const isOpen = form.classList.toggle('active');
    if (btn) {
        btn.classList.toggle('active', isOpen);
        btn.innerText = isOpen ? '×' : '+';
        btn.setAttribute('aria-expanded', String(isOpen));
    }
}

async function addVacation(event) {
    if (event) event.preventDefault();
    if (!isAdminLoggedIn || isRequestInProgress) return;

    const nameInput = document.getElementById('vacation-name');
    const startInput = document.getElementById('vacation-start');
    const endInput = document.getElementById('vacation-end');
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

    isRequestInProgress = true;
    try {
        const { data, error } = await supabaseClient
            .from('vacations')
            .insert([{ name, start_date: start, end_date: end }])
            .select();
        if (error) throw error;
        vacations.push({ id: data[0].id, name, start, end });
        nameInput.value = '';
        startInput.value = '';
        endInput.value = '';
        renderEvents();
        toggleForm('vacation-form', document.querySelector('#vacations-panel .icon-btn'));
        showToast('Отпуск добавлен');
    } catch (err) {
        console.error('Ошибка добавления отпуска:', err);
        showToast('Не удалось сохранить отпуск', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

async function deleteVacation(id) {
    if (!isAdminLoggedIn || isRequestInProgress) return;
    isRequestInProgress = true;
    try {
        const { error } = await supabaseClient.from('vacations').delete().eq('id', id);
        if (error) throw error;
        vacations = vacations.filter(v => v.id !== id);
        renderEvents();
        showToast('Отпуск удален');
    } catch (err) {
        console.error('Ошибка удаления отпуска:', err);
        showToast('Не удалось удалить отпуск', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

async function addBirthday(event) {
    if (event) event.preventDefault();
    if (!isAdminLoggedIn || isRequestInProgress) return;

    const nameInput = document.getElementById('bday-name');
    const dayInput = document.getElementById('bday-day');
    const name = nameInput.value.trim();
    const day = parseInt(dayInput.value, 10);

    if (!name || !(day >= 1 && day <= 31)) {
        showToast('Укажите имя и корректный день (1–31)', 'error');
        return;
    }

    // Примечание по модели данных: на одну дату хранится только один ДР
    // (upsert по date_key перезаписывает имя).
    const key = `${document.getElementById('bday-month').value}-${String(day).padStart(2, '0')}`;

    isRequestInProgress = true;
    try {
        const { error } = await supabaseClient.from('birthdays').upsert([
            { date_key: key, person_name: name }
        ]);
        if (error) throw error;
        birthdays[key] = name;
        nameInput.value = '';
        dayInput.value = '';
        renderEvents();
        renderCalendar();
        toggleForm('bday-form', document.querySelector('#bday-panel .icon-btn'));
        showToast('День рождения добавлен');
    } catch (err) {
        console.error('Ошибка добавления дня рождения:', err);
        showToast('Не удалось сохранить день рождения', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

async function deleteBirthday(dateKey) {
    if (!isAdminLoggedIn || isRequestInProgress) return;
    isRequestInProgress = true;
    try {
        const { error } = await supabaseClient.from('birthdays').delete().eq('date_key', dateKey);
        if (error) throw error;
        delete birthdays[dateKey];
        renderEvents();
        renderCalendar();
        showToast('День рождения удален');
    } catch (err) {
        console.error('Ошибка удаления дня рождения:', err);
        showToast('Не удалось удалить день рождения', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

/* ==========================================================================
10. CALENDAR RENDERING (СЕТКА КАЛЕНДАРЯ)
========================================================================== */
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    // Перезапуск анимации появления (стандартный reflow-прием)
    grid.style.animation = 'none';
    void grid.offsetHeight;
    grid.style.animation = 'fadeIn 0.4s ease-out';
    grid.innerHTML = '';

    const fragment = document.createDocumentFragment();

    // Дни недели
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    days.forEach((d, idx) => {
        const div = document.createElement('div');
        div.className = idx >= 5 ? 'weekday weekend' : 'weekday';
        div.innerText = d;
        fragment.appendChild(div);
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const label = document.getElementById('current-period-label');
    if (label) label.innerText = `${monthsRu[month]} ${year}`;

    const todayStr = formatDateStr(new Date());
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Пустые ячейки до первого дня месяца
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-card empty';
        empty.setAttribute('aria-hidden', 'true');
        fragment.appendChild(empty);
    }

    // Заполнение дней месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dateStr = formatDateStr(dateObj);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        const isToday = dateStr === todayStr;

        const cell = document.createElement('div');
        cell.className = [
            'day-card',
            isWeekend ? 'is-weekend' : '',
            isToday ? 'is-today' : '',
            isAdminLoggedIn ? '' : 'readonly'
        ].filter(Boolean).join(' ');

        const monthDayKey = dateStr.slice(5);
        let bdayHtml = '';
        if (birthdays[monthDayKey]) {
            bdayHtml = `<div class="bday-badge">🎂 ${escapeHtml(birthdays[monthDayKey].split(' ')[0])}</div>`;
        }

        cell.innerHTML = `
            <div class="day-header">
                <span class="day-number">${day}</span>
            </div>
            ${bdayHtml}
        `;

        // Тег назначенной смены (v1.2.0: смена — объект { person, overtime })
        const shift = shifts[dateStr];
        if (shift) {
            const person = shift.person;
            const tag = document.createElement('div');
            tag.className = `duty-tag ${selectedStaff === person ? 'highlighted' : ''}`;
            tag.setAttribute('data-person', person);
            tag.innerHTML = `<span>👤 ${escapeHtml(person)}</span>`;
            cell.appendChild(tag);
        }

        // Интерактивность только для администратора: мышь + клавиатура
        if (isAdminLoggedIn) {
            cell.setAttribute('role', 'button');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label',
                `${day} ${monthsRuGenitive[month]}${shift ? `, дежурит: ${shift.person}` : ''}`);
            cell.addEventListener('click', () => openModal(dateStr));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal(dateStr);
                }
            });
        }

        fragment.appendChild(cell);
    }

    grid.appendChild(fragment);
}

function updateHighlights() {
    document.querySelectorAll('.duty-tag').forEach(tag => {
        const person = tag.getAttribute('data-person');
        tag.classList.toggle('highlighted', Boolean(selectedStaff && person === selectedStaff));
    });
}

/* ==========================================================================
11. SHIFT MODAL CONTROLLER (МОДАЛКА НАЗНАЧЕНИЯ СМЕНЫ)
========================================================================== */
function openModal(dateStr) {
    if (!isAdminLoggedIn) return;
    activeEditDate = dateStr;

    const title = document.getElementById('modal-date-title');
    if (title) title.innerText = `Смена на ${formatHumanDate(dateStr)}`;

    const existing = shifts[dateStr];
    const select = document.getElementById('modal-staff-select');
    select.innerHTML = '';
    staff.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.innerText = s;
        if (existing && existing.person === s) opt.selected = true;
        select.appendChild(opt);
    });
    if (!staff.length) {
        const opt = document.createElement('option');
        opt.innerText = 'Нет сотрудников';
        opt.disabled = true;
        select.appendChild(opt);
    }

    // v1.2.0: предзаполнение часов переработки (0 для новой смены)
    const overtimeInput = document.getElementById('modal-overtime-input');
    if (overtimeInput) overtimeInput.value = existing ? existing.overtime : 0;

    // Нельзя сохранить смену, если список сотрудников пуст
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.disabled = staff.length === 0;

    openModalOverlay('shift-modal');
    select.focus();
}

function closeModal() {
    closeModalOverlay('shift-modal');
    setTimeout(() => { activeEditDate = null; }, 300);
}

async function saveModalShift() {
    if (!isAdminLoggedIn || !activeEditDate || isRequestInProgress) return;

    const person = document.getElementById('modal-staff-select').value;
    if (!person) {
        showToast('Нет сотрудников для назначения', 'error');
        return;
    }
    // v1.2.0: часы переработки вводятся вручную и сохраняются в БД
    const overtime = parseOvertime(document.getElementById('modal-overtime-input').value);

    isRequestInProgress = true;
    try {
        const { error } = await supabaseClient.from('shifts').upsert([
            { shift_date: activeEditDate, staff_name: person, overtime_hours: overtime }
        ]);
        if (error) throw error;
        shifts[activeEditDate] = { person, overtime };
        closeModal();
        renderCalendar();
        renderStaff();
        updateAnalytics();
        showToast('Смена назначена');
    } catch (err) {
        console.error('Ошибка сохранения смены:', err);
        showToast('Не удалось сохранить смену', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

async function deleteModalShift() {
    if (!isAdminLoggedIn || !activeEditDate || isRequestInProgress) return;
    isRequestInProgress = true;
    try {
        const { error } = await supabaseClient.from('shifts').delete().eq('shift_date', activeEditDate);
        if (error) throw error;
        delete shifts[activeEditDate];
        closeModal();
        renderCalendar();
        renderStaff();
        updateAnalytics();
        showToast('Смена снята');
    } catch (err) {
        console.error('Ошибка снятия смены:', err);
        showToast('Не удалось снять смену', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

/* ==========================================================================
12. STAFF MANAGEMENT (УПРАВЛЕНИЕ СОТРУДНИКАМИ)
========================================================================== */
/* Один проход по сменам вместо фильтра для каждого сотрудника */
function countShiftsByStaff(monthStr) {
    const counts = {};
    for (const [date, shift] of Object.entries(shifts)) {
        if (date.startsWith(monthStr)) {
            counts[shift.person] = (counts[shift.person] || 0) + 1;
        }
    }
    return counts;
}

function renderStaff() {
    const list = document.getElementById('staff-list');
    if (!list) return;

    const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const monthCounts = countShiftsByStaff(monthStr);

    const fragment = document.createDocumentFragment();
    if (!staff.length) fragment.appendChild(createEmptyHint('Список сотрудников пуст'));

    staff.forEach(name => {
        const item = document.createElement('div');
        item.className = `staff-item ${selectedStaff === name ? 'active' : ''}`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'staff-info';
        infoDiv.setAttribute('role', 'button');
        infoDiv.setAttribute('tabindex', '0');
        infoDiv.setAttribute('aria-pressed', String(selectedStaff === name));
        infoDiv.setAttribute('aria-label', `${name}: ${selectedStaff === name ? 'сбросить фильтр' : 'показать смены'}`);
        infoDiv.innerHTML = `
            <span class="staff-name">${escapeHtml(name)} (${monthCounts[name] || 0})</span>
            <span class="staff-action-hint" aria-hidden="true">${selectedStaff === name ? 'Сбросить' : 'Показать смены'}</span>
        `;
        infoDiv.addEventListener('click', () => selectStaff(name));
        infoDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectStaff(name);
            }
        });
        item.appendChild(infoDiv);

        if (isAdminLoggedIn) {
            item.appendChild(createDeleteBtn(`Удалить сотрудника ${name}`, (e) => deleteStaff(name, e)));
        }
        fragment.appendChild(item);
    });

    list.innerHTML = '';
    list.appendChild(fragment);
}

function selectStaff(name) {
    selectedStaff = selectedStaff === name ? null : name;
    renderStaff();
    updateHighlights();
    updateAnalytics();
}

async function addStaff(event) {
    if (event) event.preventDefault();
    if (!isAdminLoggedIn || isRequestInProgress) return;

    const input = document.getElementById('new-staff-name');
    const name = input.value.trim();
    if (!name) return;
    if (staff.includes(name)) {
        showToast('Сотрудник с таким именем уже есть', 'error');
        return;
    }

    isRequestInProgress = true;
    try {
        const { error } = await supabaseClient.from('staff').insert([{ name }]);
        if (error) throw error;
        staff.push(name);
        input.value = '';
        renderStaff();
        showToast(`Сотрудник «${name}» добавлен`);
    } catch (err) {
        console.error('Ошибка добавления сотрудника:', err);
        showToast('Не удалось добавить сотрудника', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

async function deleteStaff(name, event) {
    if (event) event.stopPropagation();
    if (!isAdminLoggedIn || isRequestInProgress) return;
    isRequestInProgress = true;
    try {
        const { error } = await supabaseClient.from('staff').delete().eq('name', name);
        if (error) throw error;
        staff = staff.filter(s => s !== name);
        if (selectedStaff === name) selectedStaff = null;
        renderStaff();
        renderCalendar();
        updateAnalytics();
        showToast(`Сотрудник «${name}» удален`);
    } catch (err) {
        console.error('Ошибка удаления сотрудника:', err);
        showToast('Не удалось удалить сотрудника', 'error');
    } finally {
        isRequestInProgress = false;
    }
}

/* ==========================================================================
13. ANALYTICS & OVERTIME ENGINE (АНАЛИТИКА И ПЕРЕРАБОТКИ)
========================================================================== */
/**
 * v1.2.0: нормализация значения часов переработки из инпута/БД.
 * Приводит к числу >= 0 с округлением до сотых (понимает запятую).
 */
function parseOvertime(value) {
    const num = parseFloat(String(value).replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.round(num * 100) / 100;
}

function updateAnalytics() {
    const monthEl = document.getElementById('stat-user-month');
    const yearEl = document.getElementById('stat-user-year');
    const overtimeEl = document.getElementById('stat-user-overtime');
    if (!monthEl || !yearEl || !overtimeEl) return;

    if (!selectedStaff) {
        monthEl.innerText = '-';
        yearEl.innerText = '-';
        overtimeEl.innerText = '-';
        return;
    }

    const currentYear = currentDate.getFullYear();
    const currentMonthStr = `${currentYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // v1.2.0: авторасчет по дням недели УДАЛЕН.
    // Переработки — простая сумма часов, сохраненных в сменах сотрудника.
    let monthShifts = 0;
    let yearShifts = 0;
    let overtimeHours = 0;
    for (const [dateStr, shift] of Object.entries(shifts)) {
        if (shift.person !== selectedStaff) continue;
        if (dateStr.startsWith(String(currentYear))) yearShifts++;
        if (dateStr.startsWith(currentMonthStr)) {
            monthShifts++;
            overtimeHours += shift.overtime;
        }
    }

    monthEl.innerText = monthShifts;
    yearEl.innerText = yearShifts;
    overtimeEl.innerText = `${Math.round(overtimeHours * 100) / 100} ч.`;
}

/* ==========================================================================
14. CHANGELOG & HELP MODALS (СПРАВКА И ЧЕЙНДЖЛОГ)
========================================================================== */
function openChangelogModal(e) {
    if (e) e.preventDefault();
    const container = document.getElementById('changelog-body');
    if (!container) return;

    container.innerHTML = CHANGELOG_DATA.map(rel => `
        <div class="changelog-version-block">
            <div class="changelog-version-header">
                <strong class="changelog-version">${escapeHtml(rel.version)}</strong>
                <span class="changelog-date">${escapeHtml(rel.date)}</span>
            </div>
            <ul class="changelog-list">
                ${rel.changes.map(item => `
                    <li class="changelog-item">
                        <span class="changelog-type type-${item.type}">
                            ${item.type === 'new' ? 'Новое' : item.type === 'fix' ? 'Фикс' : 'Изм'}
                        </span>
                        <span>${escapeHtml(item.text)}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `).join('');

    openModalOverlay('changelog-modal');
}

function closeChangelogModal() {
    closeModalOverlay('changelog-modal');
}

function openHelpModal(e) {
    if (e) e.preventDefault();
    const checkbox = document.getElementById('dont-show-help-again');
    if (checkbox) checkbox.checked = false;
    openModalOverlay('help-modal');
}

function closeHelpModal() {
    // Сохранение настройки происходит при ЛЮБОМ способе закрытия (кнопка, оверлей, Escape)
    const checkbox = document.getElementById('dont-show-help-again');
    if (checkbox && checkbox.checked) {
        localStorage.setItem('ipm_roster_hide_help', 'true');
    }
    closeModalOverlay('help-modal');
}

/* ==========================================================================
15. MODAL UTILITIES (ОБЩИЕ МЕХАНИЗМЫ МОДАЛОК)
========================================================================== */
function openModalOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    lastFocusedElement = document.activeElement;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('active'));
}

function closeModalOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => {
        overlay.style.display = 'none';
        // Возврат фокуса на элемент, открывший модалку
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }, 300);
}

/** Фокус-трап: Tab циклически перемещается внутри открытой модалки */
function trapFocus(container, e) {
    const focusables = container.querySelectorAll(
        'button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

/* ==========================================================================
16. SECURITY HELPERS (ЭКРАНИРОВАНИЕ)
========================================================================== */
/* Экранирование спецсимволов HTML для защиты от XSS */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ==========================================================================
17. GLOBAL HANDLERS (ЗАКРЫТИЕ МОДАЛОК, КЛАВИАТУРА)
Единая точка закрытия: оверлей-клик и Escape вызывают штатные
close*-функции, поэтому побочные логики (например, сохранение
чекбокса справки) не теряются.
========================================================================== */
const MODAL_CLOSERS = {
    'shift-modal': closeModal,
    'auth-modal': closeAuthModal,
    'changelog-modal': closeChangelogModal,
    'help-modal': closeHelpModal
};

function getVisibleModalOverlay() {
    const overlays = document.querySelectorAll('.modal-overlay');
    for (let i = overlays.length - 1; i >= 0; i--) {
        if (overlays[i].style.display === 'flex') return overlays[i];
    }
    return null;
}

function requestCloseOverlay(overlay) {
    const closer = MODAL_CLOSERS[overlay.id];
    if (closer) closer();
}

// Закрытие по клику на подложку
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal-overlay')
        && e.target.style.display === 'flex') {
        requestCloseOverlay(e.target);
    }
});

// Escape (закрытие) и Tab (фокус-трап)
document.addEventListener('keydown', (e) => {
    const overlay = getVisibleModalOverlay();
    if (!overlay) return;
    if (e.key === 'Escape') {
        requestCloseOverlay(overlay);
    } else if (e.key === 'Tab') {
        trapFocus(overlay, e);
    }
});

// Клавиатурная активация сворачиваемых заголовков секций
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ')
        && e.target.classList && e.target.classList.contains('section-title')
        && e.target.hasAttribute('tabindex')) {
        e.preventDefault();
        e.target.click();
    }
});

/* ==========================================================================
18. DOM READY & INIT TRIGGER
========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Версия в футере всегда соответствует последней записи чейнджлога
    const footerVersion = document.getElementById('footer-version');
    if (footerVersion && CHANGELOG_DATA.length) {
        footerVersion.innerText = CHANGELOG_DATA[0].version;
    }

    const hideHelp = localStorage.getItem('ipm_roster_hide_help');
    if (!hideHelp) {
        setTimeout(openHelpModal, 400);
    }
});

// Старт загрузки данных и отрисовки
init();
