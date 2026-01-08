const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PRIVAT_LINK = "https://next.privat24.ua/send/ijak6";

let userData = null;

// --- 1. АВТОРИЗАЦІЯ ТА ВХІД ---
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (authError) return alert("Помилка входу: " + authError.message);

    const { data: profile } = await supabaseClient.from('bank').select('*').eq('user_id', authData.user.id).single();
    if (profile) {
        userData = profile;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        updateUI();
        getKzLimit();
        setInterval(refreshUserData, 5000); // Оновлення балансу кожні 5 сек
    }
}

// --- 2. ОНОВЛЕННЯ ІНТЕРФЕЙСУ (БАЛАНС, VIP, КУРС) ---
function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name || "Користувач";
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;

    const vipIcon = document.getElementById('vip-icon');
    if (userData.is_vip_user) {
        vipIcon.style.display = 'inline';
        document.getElementById('current-rate').innerText = '0.3';
    } else {
        vipIcon.style.display = 'none';
        document.getElementById('current-rate').innerText = '0.5';
    }
}

// --- 3. КУПІВЛЯ ЛІСНИЧКІВ (КАЛЬКУЛЯТОР + ПРИВАТ24) ---
function buyCurrency() {
    const amount = parseFloat(document.getElementById('exchange-amount').value);
    if (!amount || amount <= 0) return alert("Введіть кількість лісничків!");
    
    const rate = userData.is_vip_user ? 0.3 : 0.5;
    const totalCost = (amount * rate).toFixed(2);
    
    alert(`Сума до оплати: ${totalCost} ₴. Натисніть ОК, щоб перейти до оплати.`);
    window.open(PRIVAT_LINK, "_blank");
}

// --- 4. ОПЛАТА ПОСЛУГ (СПИСАННЯ З БАЛАНСУ) ---
async function processOrder(name, price) {
    if (userData.balance < price) return alert("Недостатньо гривень на балансі!");

    const { error } = await supabaseClient.from('bank').update({ balance: userData.balance - price }).eq('user_id', userData.user_id);
    if (!error) {
        // Логування запиту в базу
        await supabaseClient.from('service_requests').insert([{ 
            user_id: userData.user_id, 
            idd: userData.idd, 
            service: name, 
            price: price 
        }]);
        
        userData.balance -= price;
        updateUI();
        alert(`Сплачено: ${name}. Дякуємо!`);
    } else {
        alert("Помилка транзакції");
    }
}

// --- 5. СИСТЕМА ПЕРЕКАЗІВ МІЖ ГРАВЦЯМИ ---
async function sendTransferRequest() {
    const to = document.getElementById('target-idd').value;
    const am = document.getElementById('transfer-amount').value;
    if (!to || !am) return alert("Заповніть усі поля!");

    await supabaseClient.from('transfer_requests').insert([{ 
        from_user: userData.user_id, 
        to_idd: parseInt(to), 
        amount: parseFloat(am), 
        status: 'pending' 
    }]);
    
    alert("Запит на переказ надіслано успішно!");
    toggleModal('transfer-modal', false);
}

async function viewTransferRequests() {
    const { data } = await supabaseClient.from('transfer_requests').select('*').eq('to_idd', userData.idd).eq('status', 'pending');
    const cont = document.getElementById('requests-container');
    cont.innerHTML = data?.length ? '' : '<p style="text-align:center">Вхідних запитів немає</p>';
    
    data?.forEach(req => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `
            <p>Сума: <b>${req.amount} ₴</b></p>
            <button class="btn" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">ПІДТВЕРДИТИ</button>
        `;
        cont.appendChild(div);
    });
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(id, amount, fId) {
    if (userData.balance < amount) return alert("Мало грошей на балансі!");
    
    // Списуємо у відправника
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    
    // Додаємо отримувачу
    const { data: senderProfile } = await supabaseClient.from('bank').select('balance').eq('user_id', fId).single();
    if (senderProfile) {
        await supabaseClient.from('bank').update({ balance: senderProfile.balance + amount }).eq('user_id', fId);
    }
    
    // Оновлюємо статус запиту
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', id);
    
    alert("Переказ виконано!");
    location.reload();
}

// --- 6. СИСТЕМА ВІДГУКІВ ---
async function sendReview() {
    const text = document.getElementById('review-text').value;
    if (!text) return alert("Будь ласка, напишіть текст відгуку!");

    const { error } = await supabaseClient.from('reviews').insert([{
        user_name: userData.name,
        user_idd: userData.idd,
        text: text
    }]);

    if (!error) {
        alert("Відгук надіслано! Дякуємо ❤️");
        document.getElementById('review-text').value = '';
        toggleModal('review-modal', false);
    } else {
        alert("Не вдалося надіслати відгук");
    }
}

async function loadReviews() {
    const { data } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false });
    const cont = document.getElementById('reviews-container');
    cont.innerHTML = '';

    if (data && data.length > 0) {
        data.forEach(rev => {
            const div = document.createElement('div');
            div.className = 'request-item';
            div.style.textAlign = 'left';
            div.innerHTML = `
                <div style="color:var(--green); font-weight:bold;">${rev.user_name} (ID: ${rev.user_idd})</div>
                <div style="margin-top:5px;">${rev.text}</div>
            `;
            cont.appendChild(div);
        });
    } else {
        cont.innerHTML = '<p style="text-align:center">Відгуків поки немає</p>';
    }
    toggleModal('requests-list-modal', true);
}

// --- 7. ДОПОМІЖНІ ФУНКЦІЇ ---
async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) document.getElementById('kz-slots-display').innerText = data.value;
}

async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { 
        userData = data; 
        updateUI(); 
    }
}

function toggleModal(id, show) { 
    document.getElementById(id)?.classList.toggle('hidden', !show); 
}

async function signOut() { 
    await supabaseClient.auth.signOut(); 
    location.reload(); 
}

// Експорт функцій для кнопок HTML
window.signIn = signIn;
window.buyCurrency = buyCurrency;
window.processOrder = processOrder;
window.sendTransferRequest = sendTransferRequest;
window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer;
window.sendReview = sendReview;
window.loadReviews = loadReviews;
window.toggleModal = toggleModal;
window.signOut = signOut;
