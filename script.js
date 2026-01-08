const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PRIVAT_LINK = "https://next.privat24.ua/send/ijak6";
let userData = null;

async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const { data: authData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return alert("Помилка входу!");

    const { data: profile } = await supabaseClient.from('bank').select('*').eq('user_id', authData.user.id).single();
    if (profile) {
        userData = profile;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        updateUI();
        getKzLimit();
        setInterval(refreshUserData, 5000);
    }
}

function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
    document.getElementById('vip-icon').style.display = userData.is_vip_user ? 'inline' : 'none';
    document.getElementById('current-rate').innerText = userData.is_vip_user ? '0.3' : '0.5';
}

// ОБМІН (Калькулятор + Приват)
function buyCurrency() {
    const amount = parseFloat(document.getElementById('exchange-amount').value);
    if (!amount || amount <= 0) return alert("Введіть кількість!");
    const rate = userData.is_vip_user ? 0.3 : 0.5;
    alert(`Сума до оплати: ${ (amount * rate).toFixed(2) } ₴. Переходимо в Приват24.`);
    window.open(PRIVAT_LINK, "_blank");
}

// ПОСЛУГИ (Просте списання)
async function processOrder(name, price) {
    if (userData.balance < price) return alert("Мало грошей на балансі!");
    const { error } = await supabaseClient.from('bank').update({ balance: userData.balance - price }).eq('user_id', userData.user_id);
    if (!error) {
        await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: name, price: price }]);
        userData.balance -= price;
        updateUI();
        alert(`Сплачено: ${name}`);
    }
}

// ВІДГУКИ
async function sendReview() {
    const text = document.getElementById('review-text').value;
    if (!text) return alert("Напишіть текст!");
    const { error } = await supabaseClient.from('reviews').insert([{ user_name: userData.name, user_idd: userData.idd, text: text }]);
    if (!error) {
        alert("Відгук надіслано!");
        document.getElementById('review-text').value = '';
        toggleModal('review-modal', false);
    }
}

async function loadReviews() {
    const { data } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false });
    const cont = document.getElementById('reviews-container');
    cont.innerHTML = data && data.length ? '' : 'Відгуків немає';
    data?.forEach(rev => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `<b>${rev.user_name} (ID:${rev.user_idd})</b><br>${rev.text}`;
        cont.appendChild(div);
    });
    toggleModal('reviews-list-modal', true);
}

// ПЕРЕКАЗИ
async function sendTransferRequest() {
    const to = document.getElementById('target-idd').value;
    const am = document.getElementById('transfer-amount').value;
    await supabaseClient.from('transfer_requests').insert([{ from_user: userData.user_id, to_idd: parseInt(to), amount: parseFloat(am), status: 'pending' }]);
    alert("Запит надіслано!");
    toggleModal('transfer-modal', false);
}

async function viewTransferRequests() {
    const { data } = await supabaseClient.from('transfer_requests').select('*').eq('to_idd', userData.idd).eq('status', 'pending');
    const cont = document.getElementById('requests-container');
    cont.innerHTML = data?.length ? '' : 'Запитів немає';
    data?.forEach(req => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `<p>Сума: ${req.amount} ₴</p><button class="btn" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">OK</button>`;
        cont.appendChild(div);
    });
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(id, amount, fId) {
    if (userData.balance < amount) return alert("Мало грошей!");
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    const { data: s } = await supabaseClient.from('bank').select('balance').eq('user_id', fId).single();
    if (s) await supabaseClient.from('bank').update({ balance: s.balance + amount }).eq('user_id', fId);
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', id);
    location.reload();
}

// СЛУЖБОВІ
async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) document.getElementById('kz-slots-display').innerText = data.value;
}

async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { userData = data; updateUI(); }
}

function toggleModal(id, show) { document.getElementById(id).classList.toggle('hidden', !show); }
async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

window.signIn = signIn; window.buyCurrency = buyCurrency; window.processOrder = processOrder;
window.sendReview = sendReview; window.loadReviews = loadReviews; window.toggleModal = toggleModal;
window.sendTransferRequest = sendTransferRequest; window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer; window.signOut = signOut;
