/* ==========================================================================
   TABLE OF CONTENTS / ОГЛАВЛЕНИЕ
   1. Configuration & Supabase Init (Инициализация и константы)
   2. Application State (Глобальное состояние)
   3. Changelog & Help Data (Данные версий и справки)
   4. Supabase API Service (Загрузка и синхронизация)
   5. App Lifecycle & Initialization (Точка входа и инициализация)
   6. Authentication System (Система авторизации)
   7. Navigation & Date Helpers (Форматирование дат и навигация)
   8. Events: Vacations & Birthdays (Отпуска и Дни рождения)
   9. Calendar Rendering (Отрисовка сетки календаря и смен)
   10. Shift Modal Controller (Модальное окно редактирования смен)
   11. Staff Management (Управление сотрудниками)
   12. Analytics & Overtime Engine (Расчет переработок и статистики)
   13. Changelog & Help Modals (Модальные окна Справки и Чейнджлога)
   ========================================================================== */

/* ==========================================================================
   1. CONFIGURATION & SUPABASE INIT
   ========================================================================== */
const SUPABASE_URL = 'https://fxdzzmgxsakmxymjnefd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Zug-QaFA6stMJ_XQuvOoUw_ZqwgUXTH';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Пароль для доступа к функциям администратора
const ADMIN_PASSWORD = '123';

/* ==========================================================================
   2. APPLICATION STATE (ГЛОБАЛЬНОЕ СОСТОЯНИЕ)
   ========================================================================== */
let isAdminLoggedIn = false; // Флаг прав администратора
let currentDate = new Date(); // Отображаемый месяц/год в календаре
let selectedStaff = null; // Выбранный сотрудник для фильтрации
let activeEditDate = null; // Дата, редактируемая в модальном окне

// Локальный кэш данных из Supabase
let birthdays = {};
let vacations = [];
let staff = [];
let shifts = {};

/* ==========================================================================
   3. CHANGELOG & HELP DATA
   ========================================================================== */
const monthsRu = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const monthsRuGenitive = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const CHANGELOG_DATA = [
   {
        version: "v1.1.4",
        date: "Август 2026",
        changes: [
            { type: "new", text: "Обновлено визуальное оформление: глубокий диагональный градиент и мягкое свечение фоновых акцентов." },
            { type: "upd", text: "Улучшены эффекты стекла (glassmorphism) и акцентная неоновая подсветка текущей даты." },
            { type: "upd", text: "Оптимизирован фоновый световую ореол над блоком аналитики для лучшей читаемости." }
        ]
    },
    {
        version: "v1.1.3",
        date: "Август 2026",
        changes: [
            { type: "new", text: "Добавлена поддержка отображения новой версии в чейнджлоге." },
            { type: "upd", text: "Оптимизация интерфейса и мелкие улучшения производительности." },
            { type: "fix", text: "Исправлены незначительные ошибки верстки и отображения данных." }
        ]
    },
    {
        version: "v1.1.0",
        date: "Август 2026",
        changes: [
            { type: "new", text: "Добавлена ролевая модель авторизации (Режим Гостя / Администратора)." },
            { type: "new", text: "Добавлен статус активности системы и интерактивное модальное окно чейнджлога." },
            { type: "upd", text: "Скрыты элементы управления добавлением и удалением дежурств для неавторизованных пользователей." },
            { type: "upd", text: "Расширена аналитическая панель с расчетом ночных и выходных переработок." },
            { type: "fix", text: "Исправлено корректное отображение диапазонов дат отпусков, пересекающих границу месяцев." }
        ]
    },
    {
        version: "v1.0.0",
        date: "Август 2026",
        changes: [
            { type: "new", text: "Первый релиз IPM Roster." },
            { type: "new", text: "Полная синхронизация графика дежурств с Supabase в реальном времени." },
            { type: "new", text: "Интерактивный сетчатый календарь с подсветкой текущей даты." },
            { type: "new", text: "Учет отпусков сотрудников и плашки дней рождения в ячейках календаря." }
        ]
    }
];

/* ==========================================================================
   4. SUPABASE API SERVICE (ЗАГРУЗКА И СИНХРОНИЗАЦИЯ)
   ========================================================================== */
/**
 * Параллельная загрузка всех таблиц из БД Supabase
 */
async function loadDataFromSupabase() {
    try {
        const [
            { data: staffData },
            { data: shiftsData },
            { data: vacData },
            { data: bdayData }
        ] = await Promise.all([
            supabaseClient.from('staff').select('name'),
            supabaseClient.from('shifts').select('*'),
            supabaseClient.from('vacations').select('*'),
            supabaseClient.from('birthdays').select('*')
        ]);

        if (staffData) staff = staffData.map(item => item.name);

        if (shiftsData) {
            shifts = {};
            shiftsData.forEach(s => { shifts[s.shift_date] = s.staff_name; });
        }

        if (vacData) {
            vacations = vacData.map(v => ({
                id: v.id,
                name: v.name,
                start: v.start_date,
                end: v.end_date
            }));
        }

        if (bdayData) {
            birthdays = {};
            bdayData.forEach(b => { birthdays[b.date_key] = b.person_name; });
        }
    } catch (err) {
        console.error("Ошибка при загрузке данных с Supabase:", err);
    }
}

/* ==========================================================================
   5. APP LIFECYCLE & INITIALIZATION
   ========================================================================== */
/**
 * Главная точка входа в приложение
 */
async function init() {
    populateMonthDropdown();
    await loadDataFromSupabase();
    renderStaff();
    renderEvents();
    renderCalendar();
    updateAnalytics();
    updateUiForAuthRole();
}

/* ==========================================================================
   6. AUTHENTICATION SYSTEM (СИСТЕМА АВТОРИЗАЦИИ)
   ========================================================================== */
function handleAuthClick() {
    if (isAdminLoggedIn) {
        isAdminLoggedIn = false;
        updateUiForAuthRole();
    } else {
        const modal = document.getElementById('auth-modal');
        document.getElementById('auth-password-input').value = '';
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        document.getElementById('auth-password-input').focus();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function loginAdmin() {
    const input = document.getElementById('auth-password-input').value;
    if (input === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        closeAuthModal();
        updateUiForAuthRole();
    } else {
        alert('Неверный пароль!');
    }
}

/**
 * Переключает отображение элементов управления в зависимости от прав (Гость/Админ)
 */
function updateUiForAuthRole() {
    const btn = document.getElementById('auth-btn');
    if (btn) {
        btn.innerHTML = isAdminLoggedIn ? '🔒 Выйти' : '🔑 Вход';
        btn.classList.toggle('active-auth', isAdminLoggedIn);
    }

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdminLoggedIn ? '' : 'none';
    });

    renderEvents();
    renderStaff();
}

/* ==========================================================================
   7. NAVIGATION & DATE HELPERS
   ========================================================================== */
function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
    if (!startStr || !endStr) return '';
    const s = new Date(startStr);
    const e = new Date(endStr);
    
    const sDay = s.getDate();
    const sMonth = monthsRuGenitive[s.getMonth()];
    const eDay = e.getDate();
    const eMonth = monthsRuGenitive[e.getMonth()];

    if (s.getMonth() === e.getMonth()) {
        return `${sDay} – ${eDay} ${sMonth}`;
    }
    return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

/* ==========================================================================
   8. EVENTS: VACATIONS & BIRTHDAYS (ОТПУСКА И ДНИ РОЖДЕНИЯ)
   ========================================================================== */
function renderEvents() {
    const vacContainer = document.getElementById('vacations-list');
    const bdayContainer = document.getElementById('birthdays-list');
    if (!vacContainer || !bdayContainer) return;
    
    vacContainer.innerHTML = '';
    bdayContainer.innerHTML = '';

    // Безопасный рендеринг списка отпусков
    vacations.forEach(v => {
        const formattedDate = formatVacationRange(v.start, v.end);
        const card = document.createElement('div');
        card.className = 'info-card vacation';

        const infoSpan = document.createElement('span');
        infoSpan.innerHTML = `<b>${escapeHtml(v.name)}</b>: ${formattedDate}`;
        card.appendChild(infoSpan);

        if (isAdminLoggedIn) {
            const delBtn = document.createElement('span');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '&times;';
            delBtn.onclick = () => deleteVacation(v.id);
            card.appendChild(delBtn);
        }

        vacContainer.appendChild(card);
    });

    // Безопасный рендеринг списка дней рождения
    Object.keys(birthdays).sort().forEach(dateKey => {
        const [m, d] = dateKey.split('-');
        const monthName = monthsRuGenitive[parseInt(m, 10) - 1];
        
        const card = document.createElement('div');
        card.className = 'info-card bday';

        const infoSpan = document.createElement('span');
        infoSpan.innerHTML = `<b>${escapeHtml(birthdays[dateKey])}</b> — ${parseInt(d, 10)} ${monthName}`;
        card.appendChild(infoSpan);

        if (isAdminLoggedIn) {
            const delBtn = document.createElement('span');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '&times;';
            delBtn.onclick = () => deleteBirthday(dateKey);
            card.appendChild(delBtn);
        }

        bdayContainer.appendChild(card);
    });
}

function toggleSection(panelId, e) {
    if (e && e.target.closest('.icon-btn')) return;
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle('collapsed');
}

function toggleForm(formId, btn, e) {
    if (!isAdminLoggedIn) return;
    if (e) e.stopPropagation();
    
    const form = document.getElementById(formId);
    const panel = form?.closest('.glass-panel');
    
    if (panel && panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
    }

    const isOpen = form.classList.toggle('active');
    if (btn) {
        btn.classList.toggle('active', isOpen);
        btn.innerHTML = isOpen ? '&times;' : '+';
    }
}

async function addVacation() {
    if (!isAdminLoggedIn) return;
    const name = document.getElementById('vacation-name').value.trim();
    const start = document.getElementById('vacation-start').value;
    const end = document.getElementById('vacation-end').value;

    if (name && start && end) {
        const { data, error } = await supabaseClient
            .from('vacations')
            .insert([{ name, start_date: start, end_date: end }])
            .select();

        if (!error && data) {
            vacations.push({ id: data[0].id, name, start, end });
            document.getElementById('vacation-name').value = '';
            document.getElementById('vacation-start').value = '';
            document.getElementById('vacation-end').value = '';
            renderEvents();
            toggleForm('vacation-form', document.querySelector("#vacations-panel .icon-btn"));
        }
    }
}

async function deleteVacation(id) {
    if (!isAdminLoggedIn) return;
    const { error } = await supabaseClient.from('vacations').delete().eq('id', id);
    if (!error) {
        vacations = vacations.filter(v => v.id !== id);
        renderEvents();
    }
}

async function addBirthday() {
    if (!isAdminLoggedIn) return;
    const name = document.getElementById('bday-name').value.trim();
    const day = parseInt(document.getElementById('bday-day').value, 10);
    const month = document.getElementById('bday-month').value;

    if (name && day >= 1 && day <= 31) {
        const key = `${month}-${String(day).padStart(2, '0')}`;
        const { error } = await supabaseClient.from('birthdays').upsert([
            { date_key: key, person_name: name }
        ]);

        if (!error) {
            birthdays[key] = name;
            document.getElementById('bday-name').value = '';
            document.getElementById('bday-day').value = '';
            renderEvents();
            renderCalendar();
            toggleForm('bday-form', document.querySelector("#bday-panel .icon-btn"));
        }
    }
}

async function deleteBirthday(dateKey) {
    if (!isAdminLoggedIn) return;
    const { error } = await supabaseClient.from('birthdays').delete().eq('date_key', dateKey);
    if (!error) {
        delete birthdays[dateKey];
        renderEvents();
        renderCalendar();
    }
}

/* ==========================================================================
   9. CALENDAR RENDERING (СЕТКА КАЛЕНДАРЯ)
   ========================================================================== */
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    grid.style.animation = 'none';
    grid.offsetHeight; // Триггер reflow для перезапуска анимации
    grid.style.animation = 'fadeIn 0.4s ease-out';
    grid.innerHTML = '';

    // Дни недели
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    days.forEach((d, idx) => {
        const div = document.createElement('div');
        div.className = `weekday ${idx >= 5 ? 'weekend' : ''}`;
        div.innerText = d;
        grid.appendChild(div);
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('current-period-label').innerText = `${monthsRu[month]} ${year}`;

    const todayStr = formatDateStr(new Date());

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Пустые ячейки до первого дня месяца
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-card';
        empty.style.opacity = '0.15';
        empty.style.cursor = 'default';
        grid.appendChild(empty);
    }

    // Заполнение дней месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dateStr = formatDateStr(dateObj);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        const isToday = dateStr === todayStr;
        
        const cell = document.createElement('div');
        cell.className = `day-card ${isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}`;
        
        let bdayHtml = '';
        const monthDayKey = dateStr.slice(5);
        if (birthdays[monthDayKey]) {
            bdayHtml = `<div class="bday-badge">🎂 ${escapeHtml(birthdays[monthDayKey].split(' ')[0])}</div>`;
        }

        cell.innerHTML = `
            <div class="day-header">
                <span class="day-number">${day}</span>
            </div>
            ${bdayHtml}
        `;

        // Тег назначенной смены
        if (shifts[dateStr]) {
            const person = shifts[dateStr];
            const tag = document.createElement('div');
            tag.className = `duty-tag ${selectedStaff === person ? 'highlighted' : ''}`;
            tag.setAttribute('data-person', person);
            tag.innerHTML = `<span>👤 ${escapeHtml(person)}</span>`;
            cell.appendChild(tag);
        }

        cell.onclick = () => {
            if (isAdminLoggedIn) {
                openModal(dateStr);
            }
        };
        
        grid.appendChild(cell);
    }
}

function updateHighlights() {
    document.querySelectorAll('.duty-tag').forEach(tag => {
        const person = tag.getAttribute('data-person');
        if (selectedStaff && person === selectedStaff) {
            tag.classList.add('highlighted');
        } else {
            tag.classList.remove('highlighted');
        }
    });
}

/* ==========================================================================
   10. SHIFT MODAL CONTROLLER (МОДАЛКА НАЗНАЧЕНИЯ СМЕНЫ)
   ========================================================================== */
function openModal(dateStr) {
    if (!isAdminLoggedIn) return;
    activeEditDate = dateStr;
    document.getElementById('modal-date-title').innerText = `Смена на ${dateStr}`;
    const select = document.getElementById('modal-staff-select');
    select.innerHTML = '';
    
    staff.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.innerText = s;
        if (shifts[dateStr] === s) opt.selected = true;
        select.appendChild(opt);
    });

    const overlay = document.getElementById('shift-modal');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
}

function closeModal() {
    const overlay = document.getElementById('shift-modal');
    overlay.classList.remove('active');
    setTimeout(() => {
        overlay.style.display = 'none';
        activeEditDate = null;
    }, 300);
}

async function saveModalShift() {
    if (!isAdminLoggedIn || !activeEditDate) return;
    const person = document.getElementById('modal-staff-select').value;

    const { error } = await supabaseClient.from('shifts').upsert([
        { shift_date: activeEditDate, staff_name: person }
    ]);

    if (!error) {
        shifts[activeEditDate] = person;
        closeModal();
        renderCalendar();
        renderStaff();
        updateAnalytics();
    }
}

async function deleteModalShift() {
    if (!isAdminLoggedIn || !activeEditDate) return;

    const { error } = await supabaseClient.from('shifts').delete().eq('shift_date', activeEditDate);

    if (!error) {
        delete shifts[activeEditDate];
        closeModal();
        renderCalendar();
        renderStaff();
        updateAnalytics();
    }
}

/* ==========================================================================
   11. STAFF MANAGEMENT (УПРАВЛЕНИЕ СОТРУДНИКАМИ)
   ========================================================================== */
function renderStaff() {
    const list = document.getElementById('staff-list');
    if (!list) return;
    list.innerHTML = '';

    staff.forEach(name => {
        const item = document.createElement('div');
        item.className = `staff-item ${selectedStaff === name ? 'active' : ''}`;
        
        const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const monthCount = Object.keys(shifts).filter(d => d.startsWith(currentMonthStr) && shifts[d] === name).length;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'staff-info';
        infoDiv.onclick = () => selectStaff(name);
        infoDiv.innerHTML = `
            <span class="staff-name">${escapeHtml(name)} (${monthCount})</span>
            <span class="staff-action-hint">${selectedStaff === name ? 'Сбросить' : 'Показать смены'}</span>
        `;
        item.appendChild(infoDiv);

        if (isAdminLoggedIn) {
            const delBtn = document.createElement('span');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '&times;';
            delBtn.onclick = (e) => deleteStaff(name, e);
            item.appendChild(delBtn);
        }

        list.appendChild(item);
    });
}

function selectStaff(name) {
    selectedStaff = selectedStaff === name ? null : name;
    renderStaff();
    updateHighlights();
    updateAnalytics();
}

async function addStaff() {
    if (!isAdminLoggedIn) return;
    const input = document.getElementById('new-staff-name');
    const name = input.value.trim();
    if (name && !staff.includes(name)) {
        const { error } = await supabaseClient.from('staff').insert([{ name }]);
        if (!error) {
            staff.push(name);
            input.value = '';
            renderStaff();
        }
    }
}

async function deleteStaff(name, event) {
    if (!isAdminLoggedIn) return;
    event.stopPropagation();
    const { error } = await supabaseClient.from('staff').delete().eq('name', name);
    if (!error) {
        staff = staff.filter(s => s !== name);
        if (selectedStaff === name) selectedStaff = null;
        renderStaff();
        renderCalendar();
        updateAnalytics();
    }
}

/* ==========================================================================
   12. ANALYTICS & OVERTIME ENGINE (АНАЛИТИКА И ПЕРЕРАБОТКИ)
   ========================================================================== */
function updateAnalytics() {
    const currentYear = currentDate.getFullYear();
    const currentMonthStr = `${currentYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // Часы переработки по дням недели (1-Пн ... 0-Вс)
    const overtimeByDay = { 1: 16, 2: 16, 3: 16, 4: 16, 5: 24, 6: 32, 0: 24 };

    if (selectedStaff) {
        const userMonthShifts = Object.keys(shifts).filter(d => d.startsWith(currentMonthStr) && shifts[d] === selectedStaff);
        const userYearShifts = Object.keys(shifts).filter(d => d.startsWith(String(currentYear)) && shifts[d] === selectedStaff);
        
        document.getElementById('stat-user-month').innerText = userMonthShifts.length;
        document.getElementById('stat-user-year').innerText = userYearShifts.length;

        let overtimeHours = 0;
        userMonthShifts.forEach(dStr => {
            const [y, m, d] = dStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayOfWeek = dateObj.getDay();
            overtimeHours += overtimeByDay[dayOfWeek] || 0;
        });

        document.getElementById('stat-user-overtime').innerText = `${overtimeHours} ч.`;
    } else {
        document.getElementById('stat-user-month').innerText = '-';
        document.getElementById('stat-user-year').innerText = '-';
        document.getElementById('stat-user-overtime').innerText = '-';
    }
}

/* ==========================================================================
   13. CHANGELOG & HELP MODALS (СПРАВКА И ЧЕЙНДЖЛОГ)
   ========================================================================== */
function openChangelogModal(e) {
    if (e) e.preventDefault();
    
    const container = document.getElementById('changelog-body');
    if (!container) return;

    container.innerHTML = CHANGELOG_DATA.map(rel => `
        <div class="changelog-version-block">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                <strong style="color:#fff; font-size:0.95rem;">${rel.version}</strong>
                <span class="changelog-date">${rel.date}</span>
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

    const modal = document.getElementById('changelog-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function openHelpModal(e) {
    if (e) e.preventDefault();
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    
    const checkbox = document.getElementById('dont-show-help-again');
    if (checkbox) checkbox.checked = false;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    
    const checkbox = document.getElementById('dont-show-help-again');
    if (checkbox && checkbox.checked) {
        localStorage.setItem('ipm_roster_hide_help', 'true');
    }

    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

/**
 * Вспомогательная функция безопасного экранирования спецсимволов HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ==========================================================================
   DOM READY LISTENER & INIT TRIGGER
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const hideHelp = localStorage.getItem('ipm_roster_hide_help');
    if (!hideHelp) {
        setTimeout(() => { openHelpModal(); }, 400);
    }
});

// Старт загрузки данных и отрисовки
init();
