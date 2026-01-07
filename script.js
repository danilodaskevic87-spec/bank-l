const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

// --- ВХІД ---
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    if (!email || !password) return alert("Заповніть пошту та пароль!");

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (authError) return alert("Помилка входу: " + authError.message);

    // Завантаження профілю з таблиці bank
    const { data: profile } = await supabaseClient
        .from('bank')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();

    if (profile) {
        userData = profile;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        updateUI();
        getKzLimit();
        setInterval(refreshUserData, 5000); // Автооновлення балансу
    } else {
        alert("Користувача не знайдено в таблиці 'bank'");
    }
}

// --- ОНОВЛЕННЯ ІНТЕРФЕЙСУ ---
function updateUI() {
    if (!userData) return;
    
    document.getElementById('user-name').innerText = userData.name || "Користувач";
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;

    // ⭐ VIP Іконка
    const vipIcon = document.getElementById('vip-icon');
    vipIcon.style.display = userData.is_vip_user ? 'inline' : 'none';

    // Оновлення курсу валют
    const rate = userData.is_vip_user ? 0.3 : 0.5;
    document.getElementById('current-rate').innerText = rate;
}

// --- КУПІВЛЯ ВАЛЮТИ (ЛІСНИЧКІВ) ---
async function buyCurrency() {
    const amount = parseFloat(document.getElementById('exchange-amount').value);
    if (!amount || amount <= 0) return alert("Введіть кількість");

    const rate = userData.is_vip_user ? 0.3 : 0.5;
    const cost = amount * rate;

    if (userData.balance < cost) return alert(`Недостатньо ₴! Потрібно ${cost.toFixed(2)}`);

    const { error } = await supabaseClient
        .from('bank')
        .update({ balance: userData.balance - cost })
        .eq('user_id', userData.user_id);

    if (!error) {
        // Записуємо запит на видачу лісничків
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id,
            idd: userData.idd,
            service: `💰 Обмін: ${amount} 🌲 (Курс ${rate})`,
            price: cost
        }]);
        
        userData.balance -= cost;
        updateUI();
        alert(`Успішно! Куплено ${amount} лісничків за ${cost.toFixed(2)} ₴`);
        document.getElementById('exchange-amount').value = '';
    }
}

// --- ОПЛАТА ПОСЛУГ ---
async function processOrder(name, price) {
    if (userData.balance < price) return alert("Мало грошей!");

    const { error } = await supabaseClient
        .from('bank')
        .update({ balance: userData.balance - price })
        .eq('user_id', userData.user_id);

    if (!error) {
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id,
            idd: userData.idd,
            service: name,
            price: price
        }]);
        
        userData.balance -= price;
        updateUI();
        alert(`Прийнято: ${name}`);
    }
}

// --- СИСТЕМА ПЕРЕКАЗІВ ---
async function sendTransferRequest() {
    const toIdd = document.getElementById('target-idd').value;
    const amount = document.getElementById('transfer-amount').value;

    const { error } = await supabaseClient.from('transfer_requests').insert([{
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

async function viewTransferRequests() {
    const { data } = await supabaseClient
        .from('transfer_requests')
        .select('*')
        .eq('to_idd', userData.idd)
        .eq('status', 'pending');

    const container = document.getElementById('requests-container');
    container.innerHTML = data?.length ? '' : '<p style="text-align:center">Немає запитів</p>';

    data?.forEach(req => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `
            <p>Сума: <b>${req.amount} ₴</b></p>
            <button class="btn" style="padding:10px" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">ПІДТВЕРДИТИ ✅</button>
        `;
        container.appendChild(div);
    });
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(reqId, amount, fromUserId) {
    if (userData.balance < amount) return alert("Мало грошей!");

    // Списання у мене
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    
    // Додавання іншому
    const { data: sender } = await supabaseClient.from('bank').select('balance').eq('user_id', fromUserId).single();
    if (sender) {
        await supabaseClient.from('bank').update({ balance: sender.balance + amount }).eq('user_id', fromUserId);
    }

    // Закриваємо запит
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', reqId);
    
    alert("Переказ виконано!");
    location.reload();
}

// --- СИСТЕМНІ ФУНКЦІЇ ---
async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { userData = data; updateUI(); }
}

async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) document.getElementById('kz-slots').innerText = data.value;
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
}

async function signOut() {
    await supabaseClient.auth.signOut();
    location.reload();
}

// Експорт функцій для HTML
window.signIn = signIn;
window.buyCurrency = buyCurrency;
window.processOrder = processOrder;
window.sendTransferRequest = sendTransferRequest;
window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer;
window.toggleModal = toggleModal;
window.signOut = signOut;
