const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

/**
 * 1. ЛОГІН (Ця функція спрацьовує першою)
 */
async function login() {
    const idInput = document.getElementById('idd-input').value;
    if (!idInput) return alert("Будь ласка, введіть ваш IDD");

    // Перевірка користувача в таблиці bank за полем 'idd'
    const { data, error } = await supabaseClient
        .from('bank')
        .select('*')
        .eq('idd', idInput)
        .single();

    if (data) {
        userData = data;
        
        // ХОВАЄМО екран логіну, ПОКАЗУЄМО основний додаток
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        updateUI();
        getKzLimit();
    } else {
        alert("IDD не знайдено. Перевірте правильність вводу.");
    }
}

/**
 * 2. ОНОВЛЕННЯ ІНТЕРФЕЙСУ
 * Відображаємо Name, Balance та IDD з бази
 */
function updateUI() {
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
}

/**
 * 3. КУПІВЛЯ ПОСЛУГ
 * Списання коштів та запис у лог
 */
async function processOrder(name, price) {
    if (userData.balance < price) return alert("У вас недостатньо коштів на балансі!");

    const newBalance = userData.balance - price;

    // Оновлюємо баланс у Supabase
    const { error: updateError } = await supabaseClient
        .from('bank')
        .update({ balance: newBalance })
        .eq('idd', userData.idd);

    if (!updateError) {
        // Додаємо запис у таблицю service_requests
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id,
            idd: userData.idd,
            service: name,
            price: price
        }]);

        // Додаємо запис у транзакції
        await supabaseClient.from('transactions').insert([{
            user_id: userData.user_id,
            type: 'minus',
            info: `Оплата послуги: ${name}`,
            amount: price
        }]);

        userData.balance = newBalance;
        updateUI();
        alert(`Оплата успішна: ${name}`);
    }
}

/**
 * 4. СИСТЕМНІ НАЛАШТУВАННЯ
 * Отримання ліміту місць для "Кайф зони"
 */
async function getKzLimit() {
    const { data } = await supabaseClient
        .from('settings')
        .select('value')
        .eq('key', 'kz_limit')
        .single();
    if (data) document.getElementById('kz-slots').innerText = data.value;
}

/**
 * 5. ВХІДНІ ЗАПИТИ (Кнопка "📩 Переглянути запити")
 */
async function viewTransferRequests() {
    const { data } = await supabaseClient
        .from('transfer_requests')
        .select('*')
        .eq('to_idd', userData.idd)
        .eq('status', 'pending');

    const container = document.getElementById('requests-container');
    
    // Якщо запитів немає, показуємо текст
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">Нових запитів немає</p>';
    } else {
        container.innerHTML = '';
        data.forEach(req => {
            const div = document.createElement('div');
            div.className = 'request-item';
            div.innerHTML = `
                <p>Сума: <b>${req.amount} ₴</b></p>
                <button class="service-btn" onclick="confirmTransfer(${req.id}, ${req.amount})">Підтвердити ✅</button>
            `;
            container.appendChild(div);
        });
    }
    toggleModal('requests-list-modal', true);
}

// Допоміжні функції
function toggleModal(id, show) {
    document.getElementById(id).classList.toggle('hidden', !show);
}

// Прив'язка функцій до глобального об'єкта window для роботи з onclick в HTML
window.login = login;
window.processOrder = processOrder;
window.viewTransferRequests = viewTransferRequests;
window.toggleModal = toggleModal;
