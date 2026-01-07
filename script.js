// Налаштування Supabase
const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

// Функція ЛОГІНУ
async function login() {
    const inputField = document.getElementById('idd-input');
    if (!inputField) return;
    
    const inputIDD = inputField.value;
    
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

    userData = data;
    
    // Перемикання екранів
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    updateUI();
    getKzLimit();
}

// Оновлення інтерфейсу
function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
}

// Купівля послуг
async function processOrder(serviceName, price) {
    if (!userData || userData.balance < price) {
        alert("Недостатньо коштів!");
        return;
    }

    const newBalance = userData.balance - price;

    // Оновлення таблиці bank
    const { error: updError } = await supabaseClient
        .from('bank')
        .update({ balance: newBalance })
        .eq('idd', userData.idd);

    if (!updError) {
        // Реєстрація запиту
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id,
            idd: userData.idd,
            service: serviceName,
            price: price
        }]);

        userData.balance = newBalance;
        updateUI();
        alert("Оплачено: " + serviceName);
    }
}

// Перекази
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

// Перегляд вхідних запитів
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
            div.style.padding = "10px";
            div.style.border = "1px solid #2ecc71";
            div.style.margin = "5px";
            div.innerHTML = `
                <p>Сума: ${req.amount} ₴</p>
                <button class="service-btn" onclick="confirmTransfer(${req.id}, ${req.amount})">ПІДТВЕРДИТИ ✅</button>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<p style="text-align:center">Немає нових запитів</p>';
    }
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(reqId, amount) {
    if (userData.balance < amount) {
        alert("Не вистачає коштів");
        return;
    }
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', reqId);
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('idd', userData.idd);
    alert("Переказ виконано!");
    location.reload();
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
}

async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) document.getElementById('kz-slots').innerText = data.value;
}

// Прив'язка функцій до глобального вікна (щоб onclick працював точно)
window.login = login;
window.processOrder = processOrder;
window.sendTransferRequest = sendTransferRequest;
window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer;
window.toggleModal = toggleModal;
