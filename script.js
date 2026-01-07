// Налаштування вашого проекту Supabase
const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

/**
 * АВТОРИЗАЦІЯ
 * Пошук користувача в таблиці 'bank' за IDD
 */
async function login() {
    const inputIDD = document.getElementById('idd-input').value;
    
    const { data, error } = await supabaseClient
        .from('bank')
        .select('*')
        .eq('idd', inputIDD)
        .single();

    if (error || !data) {
        alert("Користувача з IDD " + inputIDD + " не знайдено!");
        return;
    }

    userData = data;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    updateUI();
    getKzLimit(); // Завантажити ліміт місць
}

/**
 * ОНОВЛЕННЯ ІНТЕРФЕЙСУ
 * Відображення імені, балансу та IDD
 */
function updateUI() {
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance + " ₴";
    document.getElementById('user-idd').innerText = userData.idd;
}

/**
 * ЗАМОВЛЕННЯ ПОСЛУГ
 * Списання коштів та логування замовлення
 */
async function processOrder(serviceName, price) {
    if (userData.balance < price) {
        alert("Недостатньо коштів!");
        return;
    }

    // Списання в таблиці 'bank'
    const newBalance = userData.balance - price;
    const { error: updError } = await supabaseClient
        .from('bank')
        .update({ balance: newBalance })
        .eq('idd', userData.idd);

    if (!updError) {
        // Запис у 'service_requests'
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id,
            idd: userData.idd,
            service: serviceName,
            price: price
        }]);

        // Запис у 'transactions'
        await supabaseClient.from('transactions').insert([{
            user_id: userData.user_id,
            type: 'minus',
            info: `Купівля: ${serviceName}`,
            amount: price
        }]);

        userData.balance = newBalance;
        updateUI();
        alert(`Успішно сплачено: ${serviceName}`);
    }
}

/**
 * ПЕРЕКАЗИ МІЖ КОРИСТУВАЧАМИ
 * Створення запиту в таблиці 'transfer_requests'
 */
async function sendTransferRequest() {
    const toIdd = document.getElementById('target-idd').value;
    const amount = document.getElementById('transfer-amount').value;

    const { error } = await supabaseClient
        .from('transfer_requests')
        .insert([{
            from_user: userData.user_id,
            to_idd: parseInt(toIdd),
            amount: parseFloat(amount),
            status: 'pending'
        }]);

    if (!error) {
        alert("Запит на переказ надіслано!");
        toggleModal('transfer-modal', false);
    }
}

/**
 * ПЕРЕВІРКА ВХІДНИХ ЗАПИТІВ
 * Пошук запитів зі статусом 'pending' для вашого IDD
 */
async function viewTransferRequests() {
    const { data } = await supabaseClient
        .from('transfer_requests')
        .select('*')
        .eq('to_idd', userData.idd)
        .eq('status', 'pending');

    const container = document.getElementById('requests-container');
    container.innerHTML = '';

    if (data && data.length > 0) {
        data.forEach(req => {
            const div = document.createElement('div');
            div.className = 'request-item';
            div.innerHTML = `
                <p>Сума: ${req.amount} ₴</p>
                <button onclick="confirmTransfer(${req.id}, ${req.amount})">ПІДТВЕРДИТИ ✅</button>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<p>Немає нових запитів</p>';
    }
    toggleModal('requests-list-modal', true);
}

/**
 * ПІДТВЕРДЖЕННЯ ПЕРЕКАЗУ
 * Зміна статусу на 'success' та оновлення балансу
 */
async function confirmTransfer(reqId, amount) {
    if (userData.balance < amount) {
        alert("Недостатньо грошей для підтвердження!");
        return;
    }

    // 1. Оновити статус запиту
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', reqId);
    
    // 2. Списати кошти
    const newBalance = userData.balance - amount;
    await supabaseClient.from('bank').update({ balance: newBalance }).eq('idd', userData.idd);
    
    alert("Переказ виконано!");
    location.reload(); // Перезавантажити для оновлення всіх даних
}

/**
 * СИСТЕМНІ НАЛАШТУВАННЯ
 * Отримання ліміту місць з таблиці 'settings'
 */
async function getKzLimit() {
    const { data } = await supabaseClient
        .from('settings')
        .select('value')
        .eq('key', 'kz_limit')
        .single();
    
    if (data) {
        document.getElementById('kz-slots').innerText = data.value;
    }
}

// Допоміжна функція для модальних вікон
function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}
