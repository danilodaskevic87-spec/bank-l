const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (authError) return alert("Помилка: " + authError.message);

    const { data: profile } = await supabaseClient.from('bank').select('*').eq('user_id', authData.user.id).single();
    if (profile) {
        userData = profile;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        updateUI();
        getKzLimit(); // Виклик лімітів кайф зони
        setInterval(refreshUserData, 5000);
    }
}

function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name || "Користувач";
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;

    // Відображення VIP
    const vipIcon = document.getElementById('vip-icon');
    if (userData.is_vip_user) {
        vipIcon.style.display = 'inline';
        document.getElementById('current-rate').innerText = '0.3';
    } else {
        vipIcon.style.display = 'none';
        document.getElementById('current-rate').innerText = '0.5';
    }
}

async function buyCurrency() {
    const amount = parseFloat(document.getElementById('exchange-amount').value);
    if (!amount || amount <= 0) return alert("Введіть кількість");

    const rate = userData.is_vip_user ? 0.3 : 0.5;
    const cost = amount * rate;

    if (userData.balance < cost) return alert(`Треба ${cost.toFixed(2)} ₴`);

    const { error } = await supabaseClient.from('bank').update({ balance: userData.balance - cost }).eq('user_id', userData.user_id);
    if (!error) {
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id, idd: userData.idd,
            service: `💰 Обмін: ${amount} 🌲`, price: cost
        }]);
        userData.balance -= cost;
        updateUI();
        alert(`Придбано!`);
    }
}

async function processOrder(name, price) {
    if (userData.balance < price) return alert("Мало коштів");
    const { error } = await supabaseClient.from('bank').update({ balance: userData.balance - price }).eq('user_id', userData.user_id);
    if (!error) {
        await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: name, price: price }]);
        userData.balance -= price;
        updateUI();
        alert("Замовлення прийнято!");
    }
}

async function getKzLimit() {
    const { data, error } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    const display = document.getElementById('kz-slots-display');
    if (data && display) {
        display.innerText = data.value;
    } else {
        if (display) display.innerText = "0";
    }
}

async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { userData = data; updateUI(); }
}

async function sendTransferRequest() {
    const to = document.getElementById('target-idd').value;
    const am = document.getElementById('transfer-amount').value;
    await supabaseClient.from('transfer_requests').insert([{ from_user: userData.user_id, to_idd: parseInt(to), amount: parseFloat(am), status: 'pending' }]);
    alert("Запит надіслано");
    toggleModal('transfer-modal', false);
}

async function viewTransferRequests() {
    const { data } = await supabaseClient.from('transfer_requests').select('*').eq('to_idd', userData.idd).eq('status', 'pending');
    const cont = document.getElementById('requests-container');
    cont.innerHTML = data?.length ? '' : 'Запитів немає';
    data?.forEach(req => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `<p>${req.amount} ₴</p><button class="btn" onclick="confirmTransfer(${req.id}, ${req.amount}, '${req.from_user}')">OK</button>`;
        cont.appendChild(div);
    });
    toggleModal('requests-list-modal', true);
}

async function confirmTransfer(id, amount, fId) {
    if (userData.balance < amount) return alert("Мало грошей");
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    const { data: s } = await supabaseClient.from('bank').select('balance').eq('user_id', fId).single();
    if (s) await supabaseClient.from('bank').update({ balance: s.balance + amount }).eq('user_id', fId);
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', id);
    location.reload();
}

function toggleModal(id, show) { document.getElementById(id)?.classList.toggle('hidden', !show); }
async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

window.signIn = signIn; window.buyCurrency = buyCurrency; window.processOrder = processOrder;
window.sendTransferRequest = sendTransferRequest; window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer; window.toggleModal = toggleModal; window.signOut = signOut;
