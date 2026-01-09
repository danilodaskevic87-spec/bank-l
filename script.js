const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MONO_JAR = "https://send.monobank.ua/jar/93dZgGk4oC";
let userData = null;
let cart = [];
let selectedRating = 5;
let kzLimit = 0;
let forestWinSession = 0;

const services = [
    { n: '🍔 Їжа', p: 10 }, { n: '💧 Вода', p: 5 }, { n: '🥤 Кола', p: 12 },
    { n: '🍬 Цукерка', p: 3 }, { n: '🍌 Банан', p: 7 }, { n: '🍊 Мандарини', p: 8 },
    { n: '💆 Масаж', p: 150 }, { n: 'Тренажер', p: 250 }
];

const kzServices = [
    { n: '🪑 1 місце', p: 60 },
    { n: '🕶️ Принести з кухні', p: 120 }
];

// --- ДОПОМІЖНА ФУНКЦІЯ ОЧИЩЕННЯ МОДАЛКИ ---
function prepareModal() {
    const modalBody = document.querySelector('#wheel-modal .modal-content');
    modalBody.innerHTML = ''; // Повністю видаляємо старий вміст (Ліс або Колесо)
    return modalBody;
}

// --- АВТОРИЗАЦІЯ ---
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const { data: authData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) return alert("Помилка входу: перевірте дані");

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
        setInterval(loadNews, 30000);
    }
}

// --- ВІЗУАЛЬНА ГРА "ЛІС" ---
async function startForestGame() {
    if (userData.balance < 23) return alert("Недостатньо 🌲 (треба 23)");
    
    const { error } = await supabaseClient.from('bank').update({ balance: userData.balance - 23 }).eq('user_id', userData.user_id);
    if (error) return alert("Помилка транзакції");
    
    forestWinSession = 0;
    await refreshUserData();

    const modalBody = prepareModal(); // Очищуємо перед початком
    modalBody.innerHTML = `
        <h2 style="color:white; text-shadow: 2px 2px 4px #000; text-align:center;">🌲 Магічний Ліс 🌲</h2>
        <p id="forest-status" style="color:#22c55e; text-align:center; font-size:20px; font-weight:bold; background:rgba(0,0,0,0.6); border-radius:10px; padding:5px;">Зібрано: 0 🌲</p>
        <div id="forest-playground"></div>
    `;
    
    const playground = document.getElementById('forest-playground');
    playground.style.display = 'grid';
    playground.style.gridTemplateColumns = 'repeat(5, 1fr)';
    playground.style.gap = '10px';
    playground.style.padding = '15px';
    playground.style.background = "url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=500') center/cover";
    playground.style.borderRadius = '15px';

    const items = [...Array(10).fill('🌿'), ...Array(5).fill('🌳'), ...Array(5).fill('☁️')];
    items.sort(() => Math.random() - 0.5);

    items.forEach(emoji => {
        const div = document.createElement('div');
        div.style.fontSize = '35px';
        div.style.cursor = 'pointer';
        div.style.textAlign = 'center';
        div.innerText = emoji;
        div.className = 'forest-item';
        div.onclick = () => clickForest(div);
        playground.appendChild(div);
    });

    toggleModal('wheel-modal', true);
}

async function clickForest(el) {
    if (el.classList.contains('found')) return;
    el.classList.add('found');
    el.style.pointerEvents = 'none';

    if (Math.random() > 0.4) {
        const win = Math.floor(Math.random() * 12) + 3;
        forestWinSession += win;
        await supabaseClient.from('bank').update({ balance: userData.balance + win }).eq('user_id', userData.user_id);
        el.innerText = '💰';
        document.getElementById('forest-status').innerText = `Зібрано: ${forestWinSession} 🌲`;
        refreshUserData();
    } else {
        el.innerText = '❌';
        alert(`Порожньо! Ви програли. Виграш: ${forestWinSession} 🌲`);
        document.querySelectorAll('.forest-item').forEach(item => item.classList.add('found'));
        setTimeout(() => toggleModal('wheel-modal', false), 1500);
    }
}

// --- КОЛЕСО ФОРТУНИ (ВИПРАВЛЕНЕ) ---
async function spinWheel() {
    if (userData.balance < 15) return alert("Треба 15 ₴!");
    
    const modalBody = prepareModal(); // Очищуємо результати Лісу
    modalBody.innerHTML = `
        <h2 style="color:white; text-align:center;">🎡 Колесо Фортуни</h2>
        <div id="wheel-container" style="text-align:center; padding:20px;">
            <div id="wheel-result" style="font-size:24px; color:yellow; margin-bottom:20px;">Готові?</div>
            <button id="spin-btn-action" class="btn" style="width:100%">КРУТИТИ (15 ₴)</button>
        </div>
    `;

    toggleModal('wheel-modal', true);

    document.getElementById('spin-btn-action').onclick = async function() {
        const btn = this;
        btn.disabled = true;
        
        await supabaseClient.from('bank').update({ balance: userData.balance - 15 }).eq('user_id', userData.user_id);
        
        const prizes = [0, 5, 20, 10, 0, 100, 0, 15, 50, 0]; 
        const win = prizes[Math.floor(Math.random() * prizes.length)];
        document.getElementById('wheel-result').innerText = "🌀 КРУТИМО...";
        
        setTimeout(async () => {
            document.getElementById('wheel-result').innerText = win > 0 ? `🎉 ВИГРАШ: ${win} 🌲!` : "😢 Спробуй ще!";
            if (win > 0) await supabaseClient.from('bank').update({ balance: userData.balance + win }).eq('user_id', userData.user_id);
            refreshUserData();
            btn.disabled = false;
        }, 2000);
    };
}

// --- ОНОВЛЕННЯ UI ТА СЕРВІСИ ---
function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
    document.getElementById('user-spent').innerText = userData.total_spent || 0;
    let rank = (userData.total_spent > 2000) ? "ЛЕГЕНДА ЛІСУ" : (userData.total_spent > 500) ? "ПОСТІЙНИЙ ГІСТЬ" : "НОВАЧОК";
    document.getElementById('user-rank').innerText = rank;
    document.getElementById('vip-icon').style.display = userData.is_vip_user ? 'inline' : 'none';
    document.getElementById('current-rate').innerText = userData.is_vip_user ? '0.3' : '0.5';
}

function renderServices() {
    const render = (s) => `<div class="service-row"><span>${s.n} — ${s.p} ₴</span><div style="display:flex; gap:5px;"><button class="btn btn-small" onclick="processOrder('${s.n}', ${s.p}, false)">КУПИТИ</button><button class="btn btn-small btn-blue" onclick="addToCart('${s.n}', ${s.p})">🛒</button></div></div>`;
    document.getElementById('services-list').innerHTML = services.map(render).join('');
    document.getElementById('kz-list').innerHTML = kzServices.map(s => `<div class="service-row"><span>${s.n} — ${s.p} ₴</span><button class="btn btn-small btn-purple kz-btn" onclick="processOrder('${s.n}', ${s.p}, true)">ЗАБРОНЮВАТИ</button></div>`).join('');
}

async function refreshKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) {
        kzLimit = parseInt(data.value);
        document.getElementById('kz-status').innerText = `Вільних: ${kzLimit}`;
        document.querySelectorAll('.kz-btn').forEach(b => b.disabled = kzLimit <= 0);
    }
}

async function loadNews() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'news').single();
    if (data) document.getElementById('news-text').innerText = data.value;
}

async function processOrder(name, price, isKz) {
    if (userData.balance < price) return alert("Мало коштів!");
    if (isKz) { await refreshKzLimit(); if (kzLimit <= 0) return alert("Місць немає!"); }
    const { error } = await supabaseClient.from('bank').update({ balance: userData.balance - price, total_spent: (userData.total_spent || 0) + price }).eq('user_id', userData.user_id);
    if (!error) {
        if (isKz) await supabaseClient.from('settings').update({ value: (kzLimit - 1).toString() }).eq('key', 'kz_limit');
        await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: name, price: price }]);
        alert(`Оплачено: ${name}`);
        refreshUserData();
    }
}

// --- ПРОМО, ПЕРЕКАЗИ ТА ІНШЕ ---
async function usePromo() {
    const userCode = prompt("Введіть промокод:");
    if (!userCode) return; 
    const { data, error } = await supabaseClient.from('promo_codes').select('*').eq('code', userCode).eq('is_active', true).single();
    if (error || !data) return alert("❌ Код недійсний");
    await supabaseClient.from('bank').update({ balance: userData.balance + data.reward }).eq('user_id', userData.user_id);
    await supabaseClient.from('promo_codes').update({ is_active: false }).eq('id', data.id);
    alert(`✅ Нараховано +${data.reward} 🌲`);
    refreshUserData();
}

async function sendTransferRequest() {
    const to = document.getElementById('target-idd').value;
    const am = document.getElementById('transfer-amount').value;
    await supabaseClient.from('transfer_requests').insert([{ from_user: userData.user_id, to_idd: parseInt(to), amount: parseFloat(am), status: 'pending' }]);
    alert("Запит надіслано!"); toggleModal('transfer-modal', false);
}

async function viewTransferRequests() {
    const { data } = await supabaseClient.from('transfer_requests').select('*').eq('to_idd', userData.idd).eq('status', 'pending');
    const cont = document.getElementById('requests-container');
    cont.innerHTML = data?.length ? data.map(req => `<div style="background:#0d1b2a; padding:10px; margin-bottom:5px; border-radius:10px;">Сума: ${req.amount} ₴ <button class="btn btn-small" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">OK</button></div>`).join('') : 'Запитів немає';
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(id, amount, fId) {
    if (userData.balance < amount) return alert("Мало коштів");
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    const { data: s } = await supabaseClient.from('bank').select('balance').eq('user_id', fId).single();
    if (s) await supabaseClient.from('bank').update({ balance: s.balance + amount }).eq('user_id', fId);
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', id);
    alert("Переказ виконано!"); toggleModal('requests-list-modal', false); refreshUserData();
}

// --- КОШИК ТА ВІДГУКИ ---
function addToCart(name, price) { cart.push({ name, price }); document.getElementById('cart-count').innerText = cart.length; }
function removeFromCart(i) { cart.splice(i, 1); document.getElementById('cart-count').innerText = cart.length; renderCart(); }
function renderCart() {
    const cont = document.getElementById('cart-items-list');
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    cont.innerHTML = cart.length ? cart.map((item, i) => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${item.name}</span><span style="color:#ef4444; cursor:pointer;" onclick="removeFromCart(${i})">❌ ${item.price}₴</span></div>`).join('') : 'Кошик порожній';
    document.getElementById('cart-total').innerText = total;
}
async function checkoutCart() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    if (userData.balance < total) return alert("Мало коштів!");
    await supabaseClient.from('bank').update({ balance: userData.balance - total, total_spent: (userData.total_spent || 0) + total }).eq('user_id', userData.user_id);
    for (let item of cart) { await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: item.name, price: item.price }]); }
    alert("Оплачено!"); cart = []; document.getElementById('cart-count').innerText = 0; toggleModal('cart-modal', false); refreshUserData();
}

async function sendReview() {
    const text = document.getElementById('review-text').value;
    if (!text) return alert("Напишіть текст!");
    await supabaseClient.from('reviews').insert([{ user_name: userData.name, user_idd: userData.idd, text: `[${selectedRating}⭐] ${text}` }]);
    alert("Відгук надіслано!"); toggleModal('review-modal', false);
}
async function loadReviews() {
    const { data } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false });
    const cont = document.getElementById('reviews-container');
    cont.innerHTML = data?.map(r => `<div style="background:#0d1b2a; padding:10px; margin-bottom:5px; border-radius:10px;"><b>${r.user_name}</b>: ${r.text}</div>`).join('') || 'Порожньо';
    toggleModal('reviews-list-modal', true);
}

// --- СИСТЕМНІ ---
async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { userData = data; updateUI(); }
}
function buyCurrency() {
    const amount = document.getElementById('exchange-amount').value;
    if (!amount || amount <= 0) return alert("Введіть кількість");
    const rate = userData.is_vip_user ? 0.3 : 0.5;
    alert(`До оплати: ${(amount * rate).toFixed(2)} ₴. Monobank.`); window.open(MONO_JAR, "_blank");
}
function toggleModal(id, show) { if (id === 'cart-modal' && show) renderCart(); document.getElementById(id).classList.toggle('hidden', !show); }
async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

// --- ПРИВ'ЯЗКА ---
window.signIn = signIn; window.buyCurrency = buyCurrency; window.processOrder = processOrder;
window.sendReview = sendReview; window.loadReviews = loadReviews; window.toggleModal = toggleModal;
window.addToCart = addToCart; window.checkoutCart = checkoutCart; window.removeFromCart = removeFromCart;
window.spinWheel = spinWheel; window.setRating = (n) => { selectedRating = n; const stars = document.getElementById('star-input').children; for (let i = 0; i < 5; i++) stars[i].className = i < n ? "active" : ""; };
window.signOut = signOut; window.sendTransferRequest = sendTransferRequest; window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer; window.usePromo = usePromo; window.startForestGame = startForestGame;
