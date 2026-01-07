// Налаштування Supabase
const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

// 1. ЛОГІН (Цей блок спрацьовує першим)
async function login() {
    const inputIDD = document.getElementById('idd-input').value;
    
    if (!inputIDD) {
        alert("Будь ласка, введіть IDD");
        return;
    }

    // Пошук у таблиці bank
    const { data, error } = await supabaseClient
        .from('bank')
        .select('*')
        .eq('idd', inputIDD)
        .single();

    if (error || !data) {
        alert("Користувача не знайдено!");
        return;
    }

    // Якщо користувач знайдений:
    userData = data;
    
    // Приховуємо логін, показуємо додаток
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    updateUI();
    getKzLimit();
}

// 2. ОНОВЛЕННЯ ДАНИХ КОРИСТУВАЧА
function updateUI() {
    // Використовуємо дані з таблиці bank
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
}

// 3. ОБРОБКА ПОСЛУГ (Кнопки Їжа, Вода тощо)
async function processOrder(serviceName, price) {
    if (userData.balance < price) {
        alert("Недостатньо коштів!");
        return;
    }

    const newBalance = userData.balance - price;

    // Оновлюємо баланс
    const { error: updError } = await supabaseClient
        .from('bank')
        .update({ balance: newBalance })
        .eq('idd', userData.idd);

    if (!updError) {
        // Реєструємо запит
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id,
            idd: userData.idd,
            service: serviceName,
            price: price
        }]);

        userData.balance = newBalance;
        updateUI();
        alert("Оплачено!");
    } else {
        alert("Помилка при оплаті");
    }
}

// 4. ЗАПИТИ НА ПЕРЕКАЗ
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
        alert("Запит надіслано!");
        toggleModal('transfer-modal', false);
    }
}

// 5. ВХІДНІ ЗАПИТИ (Кнопка тепер працює тільки після логіну)
async function viewTransferRequests() {
    const { data, error } = await supabaseClient
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
                <button class="service-btn" onclick="confirmTransfer(${req.id}, ${req.amount})">ПІДТВЕРДИТИ ✅</button>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<p style="text-align:center">Немає запитів</p>';
    }
    toggleModal('requests-list-modal', true);
}

// ПІДТВЕРДЖЕННЯ
async function confirmTransfer(reqId, amount) {
    if (userData.balance < amount) {
        alert("Не вистачає коштів");
        return;
    }

    // Міняємо статус на success
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', reqId);
    
    // Знімаємо гроші у того, хто підтвердив
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('idd', userData.idd);
    
    alert("Переказ виконано!");
    location.reload();
}

// Допоміжні функції
function toggleModal(id, show) {
    document.getElementById(id).classList.toggle('hidden', !show);
}

async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) document.getElementById('kz-slots').innerText = data.value;
}
