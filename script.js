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

// --- ПІДГОТОВКА МОДАЛОК ---
function prepareModal() {
    const modalBody = document.querySelector('#wheel-modal .modal-content');
    modalBody.innerHTML = ''; 
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

// --- МИТТЄВІ ПЕРЕКАЗИ ТА ЗАПИТИ ---
async function sendDirectTransfer() {
    const toIdd = parseInt(document.getElementById('target-idd').value);
    const amount = parseFloat(document.getElementById('transfer-amount').value);

    if (!toIdd || !amount || amount <= 0) return alert("Введіть коректні дані");
    if (userData.balance < amount) return alert("Недостатньо коштів");
    if (toIdd === userData.idd) return alert("Не можна переказувати собі");

    const { data: receiver, error: findErr } = await supabaseClient.from('bank').select('user_id, balance, name').eq('idd', toIdd).single();
    if (findErr || !receiver) return alert("Гравця з таким IDD не знайдено");

    const { error: subErr } = await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    const { error: addErr } = await supabaseClient.from('bank').update({ balance: receiver.balance + amount }).eq('user_id', receiver.user_id);

    if (!subErr && !addErr) {
        await supabaseClient.from('transfer_requests').insert([{ from_user: userData.user_id, to_idd: toIdd, amount: amount, status: 'success' }]);
        alert(`✅ Ви переказали ${amount} 🌲 гравцю ${receiver.name}!`);
        toggleModal('transfer-modal', false);
        refreshUserData();
    }
}

async function sendTransferRequest() {
    const toIdd = document.getElementById('target-idd').value;
    const amount = document.getElementById('transfer-amount').value;
    if (!toIdd || !amount) return alert("Заповніть поля");
    
    await supabaseClient.from('transfer_requests').insert([{ from_user: userData.user_id, to_idd: parseInt(toIdd), amount: parseFloat(amount), status: 'pending' }]);
    alert("Запит надіслано! Гроші прийдуть, коли отримувач підтвердить його.");
    toggleModal('transfer-modal', false);
}

async function viewTransferRequests() {
    const { data } = await supabaseClient.from('transfer_requests')
        .select('*, bank!transfer_requests_from_user_fkey(name)')
        .eq('to_idd', userData.idd)
        .eq('status', 'pending');

    const cont = document.getElementById('requests-container');
    cont.innerHTML = data?.length ? data.map(req => `
        <div style="background:#1e293b; padding:12px; margin-bottom:10px; border-radius:10px; border-left: 5px solid #3b82f6;">
            <div style="font-size:14px;">Від: <b>${req.bank?.name || 'Гравець'}</b></div>
            <div style="color:#22c55e; font-size:18px; font-weight:bold; margin: 5px 0;">Сума: ${req.amount} 🌲</div>
            <button class="btn btn-small" style="width:100%" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">ПІДТВЕРДИТИ ПЕРЕКАЗ</button>
        </div>`).join('') : '<p style="text-align:center;">Запитів немає</p>';
    
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(id, amount, fromUserId) {
    if (userData.balance < amount) return alert("У тебе недостатньо коштів");
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    const { data: sender } = await supabaseClient.from('bank').select('balance').eq('user_id', fromUserId).single();
    if (sender) await supabaseClient.from('bank').update({ balance: sender.balance + amount }).eq('user_id', fromUserId);
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', id);
    alert("✅ Переказ підтверджено!");
    toggleModal('requests-list-modal', false);
    refreshUserData();
}

// --- ІГРИ (ЛІС ТА КОЛЕСО) ---
async function startForestGame() {
    if (userData.balance < 23) return alert("Недостатньо 🌲");
    await supabaseClient.from('bank').update({ balance: userData.balance - 23 }).eq('user_id', userData.user_id);
    forestWinSession = 0; refreshUserData();

    const modalBody = prepareModal();
    modalBody.innerHTML = `
        <h2 style="color:white; text-align:center;">🌲 Магічний Ліс 🌲</h2>
        <p id="forest-status" style="color:#22c55e; text-align:center; font-size:20px; font-weight:bold;">Виграш: 0 🌲</p>
        <div id="forest-playground" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; padding:10px;"></div>
    `;
    
    const items = [...Array(10).fill('🌿'), ...Array(5).fill('🌳'), ...Array(5).fill('☁️')].sort(() => Math.random() - 0.5);
    items.forEach(emoji => {
        const div = document.createElement('div');
        div.style.fontSize = '30px'; div.style.cursor = 'pointer'; div.style.textAlign = 'center';
        div.innerText = emoji; div.className = 'forest-item';
        div.onclick = () => clickForest(div);
        document.getElementById('forest-playground').appendChild(div);
    });
    toggleModal('wheel-modal', true);
}

async function clickForest(el) {
    if (el.classList.contains('found')) return;
    el.classList.add('found'); el.style.pointerEvents = 'none';
    if (Math.random() > 0.4) {
        const win = Math.floor(Math.random() * 12) + 3;
        forestWinSession += win;
        await supabaseClient.from('bank').update({ balance: userData.balance + win }).eq('user_id', userData.user_id);
        el.innerText = '💰';
        document.getElementById('forest-status').innerText = `Виграш: ${forestWinSession} 🌲`;
        refreshUserData();
    } else {
        el.innerText = '❌';
        alert(`Порожньо! Гру закінчено. Ви зібрали ${forestWinSession} 🌲`);
        document.querySelectorAll('.forest-item').forEach(i => i.classList.add('found'));
        setTimeout(() => toggleModal('wheel-modal', false), 1200);
    }
}

async function spinWheel() {
    if (userData.balance < 15) return alert("Треба 15 ₴!");
    const modalBody = prepareModal();
    modalBody.innerHTML = `<h2 style="color:white; text-align:center;">🎡 Колесо</h2><div style="text-align:center; padding:20px;"><div id="wheel-result" style="font-size:24px; color:yellow; margin-bottom:20px;">Готові?</div><button id="spin-btn-action" class="btn" style="width:100%">КРУТИТИ</button></div>`;
    toggleModal('wheel-modal', true);

    document.getElementById('spin-btn-action').onclick = async function() {
        this.disabled = true;
        await supabaseClient.from('bank').update({ balance: userData.balance - 15 }).eq('user_id', userData.user_id);
        const win = [0, 5, 20, 10, 0, 100, 0, 15, 50, 0][Math.floor(Math.random() * 10)];
        document.getElementById('wheel-result').innerText = "🌀 КРУТИМО...";
        setTimeout(async () => {
            document.getElementById('wheel-result').innerText = win > 0 ? `🎉 +${win} 🌲!` : "😢 0";
            if (win > 0) await supabaseClient.from('bank').update({ balance: userData.balance + win }).eq('user_id', userData.user_id);
            refreshUserData(); this.disabled = false;
        }, 1500);
    };
}

// --- ІНТЕРФЕЙС ТА МАГАЗИН ---
function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
    document.getElementById('user-spent').innerText = userData.total_spent || 0;
    document.getElementById('user-rank').innerText = (userData.total_spent > 2000) ? "ЛЕГЕНДА" : (userData.total_spent > 500) ? "ПОСТІЙНИЙ" : "НОВАЧОК";
    document.getElementById('vip-icon').style.display = userData.is_vip_user ? 'inline' : 'none';
    document.getElementById('current-rate').innerText = userData.is_vip_user ? '0.3' : '0.5';
}

function renderServices() {
    const btnHtml = (s, isKz) => `<div class="service-row"><span>${s.n} — ${s.p} ₴</span><div style="display:flex; gap:5px;">${isKz ? `<button class="btn btn-small btn-purple kz-btn" onclick="processOrder('${s.n}', ${s.p}, true)">ЗАБРОНЮВАТИ</button>` : `<button class="btn btn-small" onclick="processOrder('${s.n}', ${s.p}, false)">КУПИТИ</button><button class="btn btn-small btn-blue" onclick="addToCart('${s.n}', ${s.p})">🛒</button>`}</div></div>`;
    document.getElementById('services-list').innerHTML = services.map(s => btnHtml(s, false)).join('');
    document.getElementById('kz-list').innerHTML = kzServices.map(s => btnHtml(s, true)).join('');
}

async function refreshKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) {
        kzLimit = parseInt(data.value);
        document.getElementById('kz-status').innerText = `Вільних місць: ${kzLimit}`;
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
        alert(`✅ Замовлено: ${name}`); refreshUserData();
    }
}

// --- КОШИК ---
function addToCart(name, price) { cart.push({ name, price }); document.getElementById('cart-count').innerText = cart.length; }
function removeFromCart(i) { cart.splice(i, 1); document.getElementById('cart-count').innerText = cart.length; renderCart(); }
function renderCart() {
    const total = cart.reduce((s, i) => s + i.price, 0);
    document.getElementById('cart-items-list').innerHTML = cart.map((item, i) => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${item.name}</span><span style="color:red; cursor:pointer;" onclick="removeFromCart(${i})">❌ ${item.price}₴</span></div>`).join('') || 'Порожньо';
    document.getElementById('cart-total').innerText = total;
}
async function checkoutCart() {
    const total = cart.reduce((s, i) => s + i.price, 0);
    if (userData.balance < total) return alert("Мало коштів!");
    await supabaseClient.from('bank').update({ balance: userData.balance - total, total_spent: (userData.total_spent || 0) + total }).eq('user_id', userData.user_id);
    for (let item of cart) await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: item.name, price: item.price }]);
    alert("Оплачено!"); cart = []; document.getElementById('cart-count').innerText = 0; toggleModal('cart-modal', false); refreshUserData();
}

// --- ІНШЕ ---
async function refreshUserData() { if (userData) { const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single(); if (data) { userData = data; updateUI(); } } }
function buyCurrency() { const amount = document.getElementById('exchange-amount').value; const rate = userData.is_vip_user ? 0.3 : 0.5; alert(`До оплати: ${(amount * rate).toFixed(2)} ₴.`); window.open(MONO_JAR, "_blank"); }
function toggleModal(id, show) { if (id === 'cart-modal' && show) renderCart(); document.getElementById(id).classList.toggle('hidden', !show); }
async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }
async function usePromo() { const code = prompt("Промокод:"); if (!code) return; const { data } = await supabaseClient.from('promo_codes').select('*').eq('code', code).eq('is_active', true).single(); if (!data) return alert("Недійсний"); await supabaseClient.from('bank').update({ balance: userData.balance + data.reward }).eq('user_id', userData.user_id); await supabaseClient.from('promo_codes').update({ is_active: false }).eq('id', data.id); alert("✅ Нараховано!"); refreshUserData(); }
function setRating(n) { selectedRating = n; const stars = document.getElementById('star-input').children; for (let i = 0; i < 5; i++) stars[i].style.color = i < n ? "gold" : "white"; }
async function sendReview() { const text = document.getElementById('review-text').value; await supabaseClient.from('reviews').insert([{ user_name: userData.name, user_idd: userData.idd, text: `[${selectedRating}⭐] ${text}` }]); alert("Надіслано!"); toggleModal('review-modal', false); }
async function loadReviews() { const { data } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false }); document.getElementById('reviews-container').innerHTML = data?.map(r => `<div style="background:#1e293b; padding:10px; border-radius:10px; margin-bottom:5px;"><b>${r.user_name}</b>: ${r.text}</div>`).join('') || 'Немає відгуків'; toggleModal('reviews-list-modal', true); }

// --- ПРИВ'ЯЗКА ФУНКЦІЙ ---
window.signIn = signIn; window.sendDirectTransfer = sendDirectTransfer; window.sendTransferRequest = sendTransferRequest; 
window.viewTransferRequests = viewTransferRequests; window.confirmTransfer = confirmTransfer;
window.startForestGame = startForestGame; window.spinWheel = spinWheel; window.toggleModal = toggleModal;
window.usePromo = usePromo; window.buyCurrency = buyCurrency; window.signOut = signOut;
window.addToCart = addToCart; window.checkoutCart = checkoutCart; window.removeFromCart = removeFromCart;
window.setRating = setRating; window.sendReview = sendReview; window.loadReviews = loadReviews; window.processOrder = processOrder;
