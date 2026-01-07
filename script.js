const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

// --- 1. ВХІД ---
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    if (!email || !password) return alert("Введіть пошту та пароль");

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (authError) return alert("Помилка: " + authError.message);

    // Отримання профілю з таблиці 'bank'
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
        
        // Починаємо автооновлення балансу кожні 5 секунд
        setInterval(refreshUserData, 5000);
    } else {
        alert("Дані в таблиці 'bank' не знайдено.");
    }
}

// --- 2. ОНОВЛЕННЯ ДАНИХ ТА ІМЕНІ ---
function updateUI() {
    if (!userData) return;
    
    // Відображення імені з колонки 'name'
    const nameElement = document.getElementById('user-name');
    if (nameElement) {
        nameElement.innerText = userData.name || "Без імені";
    }

    // Відображення балансу
    const balanceElement = document.getElementById('user-balance');
    if (balanceElement) {
        balanceElement.innerText = userData.balance;
    }

    // Відображення IDD
    const iddElement = document.getElementById('user-idd');
    if (iddElement) {
        iddElement.innerText = userData.idd;
    }
}

// Функція для фонового оновлення балансу
async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient
        .from('bank')
        .select('*')
        .eq('user_id', userData.user_id)
        .single();
    if (data) {
        userData = data;
        updateUI();
    }
}

// --- 3. ОПЛАТА ПОСЛУГ ---
async function processOrder(name, price) {
    if (userData.balance < price) return alert("Недостатньо коштів!");

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

// --- 4. ПЕРЕКАЗИ ---
async function sendTransferRequest() {
    const toIdd = document.getElementById('target-idd').value;
    const amount = document.getElementById('transfer-amount').value;

    if (!toIdd || !amount) return alert("Заповніть всі поля");

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
    container.innerHTML = data?.length ? '' : '<p style="text-align:center">Запитів немає</p>';

    data?.forEach(req => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `
            <p>Сума: <b>${req.amount} ₴</b></p>
            <button class="service-btn" style="background:#2ecc71; color:#000; padding:10px" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">OK ✅</button>
        `;
        container.appendChild(div);
    });
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(reqId, amount, fromUserId) {
    if (userData.balance < amount) return alert("Недостатньо грошей!");

    // Знімаємо у себе
    const { error: e1 } = await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    if (e1) return alert("Помилка списання");

    // Додаємо іншому
    const { data: sender } = await supabaseClient.from('bank').select('balance').eq('user_id', fromUserId).single();
    if (sender) {
        await supabaseClient.from('bank').update({ balance: sender.balance + amount }).eq('user_id', fromUserId);
    }

    // Закриваємо запит
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', reqId);
    
    alert("Переказ виконано!");
    location.reload();
}

// --- 5. ІНШЕ ---
async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) {
        const slots = document.getElementById('kz-slots');
        if (slots) slots.innerText = data.value;
    }
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
}

async function signOut() {
    await supabaseClient.auth.signOut();
    location.reload();
}

// Прив'язка до HTML
window.signIn = signIn;
window.processOrder = processOrder;
window.sendTransferRequest = sendTransferRequest;
window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer;
window.toggleModal = toggleModal;
window.signOut = signOut;
