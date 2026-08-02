// Инициализация Supabase
const SUPABASE_URL = 'https://fxdzzmgxsakmxymjnefd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Zug-QaFA6stMJ_XQuvOoUw_ZqwgUXTH';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ПАРОЛЬ АДМИНИСТРАТОРА
const ADMIN_PASSWORD = '123'; // <-- Замени на свой пароль!

// Состояние авторизации (сбрасывается при F5 / перезаходе)
let isAdminLoggedIn = false;

let currentDate = new Date(); 
let selectedStaff = null;
let activeEditDate = null;

const monthsRu = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const monthsRuGenitive = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// Локальное состояние приложения
let birthdays = {};
let vacations = [];
let staff = [];
let shifts = {};

function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Загрузка всех данных из Supabase
async function loadDataFromSupabase() {
    try {
        const { data: staffData } = await supabaseClient.from('staff').select('name');
        if (staffData) staff = staffData.map(item => item.name);

        const { data: shiftsData } = await supabaseClient.from('shifts').select('*');
        if (shiftsData) {
            shifts = {};
            shiftsData.forEach(s => { shifts[s.shift_date] = s.staff_name; });
        }

        const { data: vacData } = await supabaseClient.from('vacations').select('*');
        if (vacData) {
            vacations = vacData.map(v => ({
                id: v.id,
                name: v.name,
                start: v.start_date,
                end: v.end_date
            }));
        }

        const { data: bdayData } = await supabaseClient.from('birthdays').select('*');
        if (bdayData) {
            birthdays = {};
            bdayData.forEach(b => { birthdays[b.date_key] = b.person_name; });
        }
    } catch (err) {
        console.error("Ошибка при загрузке данных с Supabase:", err);
    }
}

async function init() {
    populateMonthDropdown();
    await loadDataFromSupabase();
    renderStaff();
    renderEvents();
    renderCalendar();
    updateAnalytics();
    updateUiForAuthRole();
}

// --- Логика Авторизации ---
function handleAuthClick() {
    if (isAdminLoggedIn) {
        // Если уже вошли — выходим
        isAdminLoggedIn = false;
        updateUiForAuthRole();
    } else {
        // Открываем модалку для ввода пароля
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

// Переключение интерфейса под статус авторизации
function updateUiForAuthRole() {
    const btn = document.getElementById('auth-btn');
    if (btn) {
        btn.innerHTML = isAdminLoggedIn ? '🔒 Выйти' : '🔑 Вход';
        btn.classList.toggle('active-auth', isAdminLoggedIn);
    }

    // Скрываем или показываем элеметы редактирования
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdminLoggedIn ? '' : 'none';
    });

    renderEvents();
    renderStaff();
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

function renderEvents() {
    const vacContainer = document.getElementById('vacations-list');
    const bdayContainer = document.getElementById('birthdays-list');
    if (!vacContainer || !bdayContainer) return;
    
    vacContainer.innerHTML = '';
    bdayContainer.innerHTML = '';

    vacations.forEach(v => {
        const formattedDate = formatVacationRange(v.start, v.end);
        const delBtn = isAdminLoggedIn ? `<span class="delete-btn" onclick="deleteVacation(${v.id})">&times;</span>` : '';
        vacContainer.innerHTML += `
            <div class="info-card vacation">
                <span><b>${v.name}</b>: ${formattedDate}</span>
                ${delBtn}
            </div>`;
    });

    Object.keys(birthdays).sort().forEach(dateKey => {
        const [m, d] = dateKey.split('-');
        const monthName = monthsRuGenitive[parseInt(m) - 1];
        const delBtn = isAdminLoggedIn ? `<span class="delete-btn" onclick="deleteBirthday('${dateKey}')">&times;</span>` : '';
        bdayContainer.innerHTML += `
            <div class="info-card bday">
                <span><b>${birthdays[dateKey]}</b> — ${parseInt(d)} ${monthName}</span>
                ${delBtn}
            </div>`;
    });
}

function toggleSection(panelId, e) {
    if (e && e.target.closest('.icon-btn')) return;
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle('collapsed');
}

function toggleForm(formId, btn, e) {
    if (!isAdminLoggedIn) return; // Запрет для гостей
    if (e) e.stopPropagation();
    
    const form = document.getElementById(formId);
    const panel = form.closest('.glass-panel');
    
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
    const day = parseInt(document.getElementById('bday-day').value);
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

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.style.animation = 'none';
    grid.offsetHeight;
    grid.style.animation = 'fadeIn 0.4s ease-out';
    grid.innerHTML = '';

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

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-card';
        empty.style.opacity = '0.15';
        empty.style.cursor = 'default';
        grid.appendChild(empty);
    }

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
            bdayHtml = `<div class="bday-badge">🎂 ${birthdays[monthDayKey].split(' ')[0]}</div>`;
        }

        cell.innerHTML = `
            <div class="day-header">
                <span class="day-number">${day}</span>
            </div>
            ${bdayHtml}
        `;

        if (shifts[dateStr]) {
            const person = shifts[dateStr];
            const tag = document.createElement('div');
            tag.className = `duty-tag ${selectedStaff === person ? 'highlighted' : ''}`;
            tag.setAttribute('data-person', person);
            tag.innerHTML = `<span>👤 ${person}</span>`;
            cell.appendChild(tag);
        }

        // Вызываем окно редактирования смены ТОЛЬКО если пользователь — админ
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

function renderStaff() {
    const list = document.getElementById('staff-list');
    if (!list) return;
    list.innerHTML = '';

    staff.forEach(name => {
        const item = document.createElement('div');
        item.className = `staff-item ${selectedStaff === name ? 'active' : ''}`;
        
        const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const monthCount = Object.keys(shifts).filter(d => d.startsWith(currentMonthStr) && shifts[d] === name).length;

        const delBtn = isAdminLoggedIn ? `<span class="delete-btn" onclick="deleteStaff('${name}', event)">&times;</span>` : '';

        item.innerHTML = `
            <span onclick="selectStaff('${name}')" style="flex:1;">${name} (${monthCount})</span>
            ${delBtn}
        `;
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

function updateAnalytics() {
    const currentYear = currentDate.getFullYear();
    const currentMonthStr = `${currentYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    if (selectedStaff) {
        const userMonthShifts = Object.keys(shifts).filter(d => d.startsWith(currentMonthStr) && shifts[d] === selectedStaff);
        const userYearShifts = Object.keys(shifts).filter(d => d.startsWith(String(currentYear)) && shifts[d] === selectedStaff);
        
        document.getElementById('stat-user-month').innerText = userMonthShifts.length;
        document.getElementById('stat-user-year').innerText = userYearShifts.length;

        let overtimeHours = 0;
        userMonthShifts.forEach(dStr => {
            const dateObj = new Date(dStr);
            const dayOfWeek = dateObj.getDay();
            
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                overtimeHours += 24;
            } else {
                overtimeHours += 15;
            }
        });

        document.getElementById('stat-user-overtime').innerText = `${overtimeHours} ч.`;
    } else {
        document.getElementById('stat-user-month').innerText = '-';
        document.getElementById('stat-user-year').innerText = '-';
        document.getElementById('stat-user-overtime').innerText = '-';
    }
}

// Запуск инициализации приложения
init();