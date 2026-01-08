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

async function activatePromo() {
    // Викликає вікно поверх сайту. Дизайн HTML не міняється!
    const userCode = prompt("Введіть секретний промокод:");
    
    if (!userCode) return; // Якщо натиснули "Скасувати"

    // Шукаємо код у базі
    const { data, error } = await supabaseClient
        .from('promo_codes')
        .select('*')
        .eq('code', userCode)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return alert("❌ Код недійсний або вже використаний!");
    }

    // Додаємо гроші до балансу
    const { error: updateError } = await supabaseClient
        .from('bank')
        .update({ balance: userData.balance + data.reward })
        .eq('user_id', userData.user_id);

    if (!updateError) {
        // Позначаємо код як використаний
        await supabaseClient.from('promo_codes').update({ is_active: false }).eq('id', data.id);
        
        alert(`✅ Успішно! Нараховано ${data.reward} 🌲`);
        refreshUserData(); // Оновлюємо баланс на екрані
    }
}

// Реєструємо функцію
window.activatePromo = activatePromo;

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
    
    // Списуємо 15 ₴ за спробу
    await supabaseClient.from('bank').update({ balance: userData.balance - 15 }).eq('user_id', userData.user_id);
    
    const prizes = [0, 5, 20, 10, 0, 100, 0, 15, 50, 0]; 
    const win = prizes[Math.floor(Math.random() * prizes.length)];
    document.getElementById('wheel-result').innerText = "Крутимо...";
    
    setTimeout(async () => {
        document.getElementById('wheel-result').innerText = win > 0 ? `Виграш: ${win} 🌲!` : "Спробуй ще!";
        if (win > 0) {
            await supabaseClient.from('bank').update({ balance: userData.balance + win }).eq('user_id', userData.user_id);
        }
        refreshUserData();
        btn.disabled = false;
    }, 2000);
}

function buyCurrency() {
    const amount = document.getElementById('exchange-amount').value;
    if (!amount || amount <= 0) return alert("Введіть кількість");
    const rate = userData.is_vip_user ? 0.3 : 0.5;
    alert(`До оплати: ${(amount * rate).toFixed(2)} ₴. Відкриваємо Monobank.`);
    window.open(MONO_JAR, "_blank");
}

async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { userData = data; updateUI(); }
}

async function loadNews() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'news').single();
    if (data) document.getElementById('news-text').innerText = data.value;
}

function setRating(n) {
    selectedRating = n;
    const stars = document.getElementById('star-input').children;
    for (let i = 0; i < 5; i++) stars[i].className = i < n ? "active" : "";
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

async function sendTransferRequest() {
    const to = document.getElementById('target-idd').value;
    const am = document.getElementById('transfer-amount').value;
    await supabaseClient.from('transfer_requests').insert([{ from_user: userData.user_id, to_idd: parseInt(to), amount: parseFloat(am), status: 'pending' }]);
    alert("Запит надіслано!"); toggleModal('transfer-modal', false);
}

async function viewTransferRequests() {
    const { data } = await supabaseClient.from('transfer_requests').select('*').eq('to_idd', userData.idd).eq('status', 'pending');
    const cont = document.getElementById('requests-container');
    cont.innerHTML = data?.length ? data.map(req => `
        <div style="background:#0d1b2a; padding:10px; margin-bottom:5px; border-radius:10px;">
            Сума: ${req.amount} ₴ <button class="btn btn-small" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">OK</button>
        </div>`).join('') : 'Запитів немає';
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

function addToCart(name, price) { cart.push({ name, price }); document.getElementById('cart-count').innerText = cart.length; }

function toggleModal(id, show) { 
    if (id === 'cart-modal' && show) renderCart();
    document.getElementById(id).classList.toggle('hidden', !show); 
}

function renderCart() {
    const cont = document.getElementById('cart-items-list');
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    cont.innerHTML = cart.length ? cart.map((item, i) => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${item.name}</span><span style="color:var(--red);" onclick="removeFromCart(${i})">❌ ${item.price}₴</span></div>`).join('') : 'Кошик порожній';
    document.getElementById('cart-total').innerText = total;
}

function removeFromCart(i) { cart.splice(i, 1); document.getElementById('cart-count').innerText = cart.length; renderCart(); }

async function checkoutCart() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    if (userData.balance < total) return alert("Мало коштів!");
    await supabaseClient.from('bank').update({ balance: userData.balance - total, total_spent: (userData.total_spent || 0) + total }).eq('user_id', userData.user_id);
    for (let item of cart) { await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: item.name, price: item.price }]); }
    alert("Оплачено!"); cart = []; document.getElementById('cart-count').innerText = 0; toggleModal('cart-modal', false); refreshUserData();
}

async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

window.signIn = signIn; window.buyCurrency = buyCurrency; window.processOrder = processOrder;
window.sendReview = sendReview; window.loadReviews = loadReviews; window.toggleModal = toggleModal;
window.addToCart = addToCart; window.checkoutCart = checkoutCart; window.removeFromCart = removeFromCart;
window.spinWheel = spinWheel; window.setRating = setRating; window.signOut = signOut;
window.sendTransferRequest = sendTransferRequest; window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer;
