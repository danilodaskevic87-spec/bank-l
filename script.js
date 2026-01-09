const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MONO_JAR = "https://send.monobank.ua/jar/93dZgGk4oC";
let userData = null;
let cart = [];
let selectedRating = 5;
let kzLimit = 0;

const services = [
    { n: '🍔 Їжа', p: 10 }, { n: '💧 Вода', p: 5 }, { n: '🥤 Кола', p: 12 },
    { n: '🍬 Цукерка', p: 3 }, { n: '🍌 Банан', p: 7 }, { n: '🍊 Мандарини', p: 8 },
    { n: '💆 Масаж', p: 150 }, { n: 'Тренажер', p: 250 }
];

const kzServices = [
    { n: '🪑 1 місце', p: 60 },
    { n: '🕶️ Принести з кухні', p: 120 }
];

// --- ВИПРАВЛЕНО: Додана закриваюча дужка в кінці ---
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const { data: authData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return alert("Помилка входу");

    const { data: profile } = await supabaseClient.from('bank').select('*').eq('user_id', authData.user.id).single();
    if (profile) {
        userData = profile;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('cart-btn').classList.remove('hidden');
        renderServices();
        updateUI();
        loadNews();
        refreshKzLimit();
        setInterval(refreshUserData, 5000);
        setInterval(refreshKzLimit, 10000);
    }
} 

async function startForestGame() {
    if (userData.balance < 23) return alert("Недостатньо 🌲 (треба 23)");
    const modalBody = document.querySelector('#wheel-modal .modal-content');
    modalBody.innerHTML = '<h2 style="color:white; text-shadow: 2px 2px 4px #000;">Знайди скарб у лісі!</h2>';
    const playground = document.createElement('div');
    playground.id = 'forest-playground';
    const items = [...Array(10).fill('🌿'), ...Array(5).fill('🌳'), ...Array(5).fill('☁️')];
    items.sort(() => Math.random() - 0.5);
    items.forEach(emoji => {
        const div = document.createElement('div');
        div.className = 'forest-obj';
        div.innerText = emoji;
        div.onclick = () => clickForest(div);
        playground.appendChild(div);
    });
    modalBody.appendChild(playground);
    toggleModal('wheel-modal', true);
}

async function clickForest(el) {
    if (el.classList.contains('found')) return;
    let balance = userData.balance - 23;
    await supabaseClient.from('bank').update({ balance: balance }).eq('user_id', userData.user_id);
    if (Math.random() > 0.5) {
        const win = Math.floor(Math.random() * (30 - 3 + 1)) + 3;
        await supabaseClient.from('bank').update({ balance: balance + win }).eq('user_id', userData.user_id);
        el.innerText = '💰';
        alert(`🎉 Ти знайшов ${win} 🌲!`);
    } else {
        el.innerText = '❌';
        alert("Тут порожньо...");
    }
    el.classList.add('found');
    refreshUserData();
    setTimeout(() => toggleModal('wheel-modal', false), 1200);
}

function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
    document.getElementById('user-spent').innerText = userData.total_spent || 0;
    let rank = "НОВАЧОК";
    const spent = userData.total_spent || 0;
    if (spent > 500) rank = "ПОСТІЙНИЙ ГІСТЬ";
    if (spent > 2000) rank = "ЛЕГЕНДА ЛІСУ";
    document.getElementById('user-rank').innerText = rank;
    document.getElementById('vip-icon').style.display = userData.is_vip_user ? 'inline' : 'none';
    document.getElementById('current-rate').innerText = userData.is_vip_user ? '0.3' : '0.5';
}

function renderServices() {
    document.getElementById('services-list').innerHTML = services.map(s => `
        <div class="service-row">
            <span>${s.n} — ${s.p} ₴</span>
            <div style="display:flex; gap:5px;">
                <button class="btn btn-small" onclick="processOrder('${s.n}', ${s.p}, false)">КУПИТИ</button>
                <button class="btn btn-small btn-blue" onclick="addToCart('${s.n}', ${s.p})">🛒</button>
            </div>
        </div>
    `).join('');
    document.getElementById('kz-list').innerHTML = kzServices.map(s => `
        <div class="service-row">
            <span>${s.n} — ${s.p} ₴</span>
            <button class="btn btn-small btn-purple kz-btn" onclick="processOrder('${s.n}', ${s.p}, true)">ЗАБРОНЮВАТИ</button>
        </div>
    `).join('');
}

async function refreshKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) {
        kzLimit = parseInt(data.value);
        document.getElementById('kz-status').innerText = `Вільних: ${kzLimit}`;
        document.querySelectorAll('.kz-btn').forEach(b => b.disabled = kzLimit <= 0);
    }
}

async function processOrder(name, price, isKz) {
    if (userData.balance < price) return alert("Мало коштів!");
    if (isKz) {
        await refreshKzLimit();
        if (kzLimit <= 0) return alert("Місць немає!");
    }
    const { error } = await supabaseClient.from('bank').update({ 
        balance: userData.balance - price,
        total_spent: (userData.total_spent || 0) + price
    }).eq('user_id', userData.user_id);
    if (!error) {
        if (isKz) await supabaseClient.from('settings').update({ value: (kzLimit - 1).toString() }).eq('key', 'kz_limit');
        await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: name, price: price }]);
        alert(`Оплачено: ${name}`);
        refreshUserData();
    }
}

async function spinWheel() {
    if (userData.balance < 15) return alert("Треба 15 ₴!");
    const btn = document.getElementById('spin-btn');
    btn.disabled = true;
    await supabaseClient.from('bank').update({ balance: userData.balance - 15 }).eq('user_id', userData.user_id);
    const prizes = [0, 5, 20, 10, 0, 100, 0, 15, 50, 0]; 
    const win = prizes[Math.floor(Math.random() * prizes.length)];
    document.getElementById('wheel-result').innerText = "Крутимо...";
    setTimeout(async () => {
        document.getElementById('wheel-result').innerText = win > 0 ? `Виграш: ${win} 🌲!` : "Спробуй ще!";
        if (win > 0) await supabaseClient.from('bank').update({ balance: userData.balance + win }).eq('user_id', userData.user_id);
        refreshUserData();
        btn.disabled = false;
    }, 2000);
}

async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { userData = data; updateUI(); }
}

async function usePromo() {
    const userCode = prompt("Введіть промокод:");
    if (!userCode) return; 
    const { data, error } = await supabaseClient.from('promo_codes').select('*').eq('code', userCode).eq('is_active', true).single();
    if (error || !data) return alert("❌ Код недійсний або використаний");
    const { error: updErr } = await supabaseClient.from('bank').update({ balance: userData.balance + data.reward }).eq('user_id', userData.user_id);
    if (!updErr) {
        await supabaseClient.from('promo_codes').update({ is_active: false }).eq('id', data.id);
        alert(`✅ Нараховано +${data.reward} 🌲`);
        refreshUserData();
    }
}

// РЕШТА ФУНКЦІЙ (СКОРОЧЕНО ДЛЯ ПРИКЛАДУ, АЛЕ ЗАЛИШТЕ СВОЇ)
function buyCurrency() { window.open(MONO_JAR, "_blank"); }
function toggleModal(id, show) { document.getElementById(id).classList.toggle('hidden', !show); }
async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

// --- ПРИВ'ЯЗКА ДО WINDOW (Обов'язково для HTML кнопок) ---
window.signIn = signIn;
window.usePromo = usePromo;
window.startForestGame = startForestGame;
window.spinWheel = spinWheel;
window.processOrder = processOrder;
window.toggleModal = toggleModal;
window.buyCurrency = buyCurrency;
window.signOut = signOut;
