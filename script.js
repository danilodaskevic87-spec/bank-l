const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

// Аутентифікація користувача
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) return alert("Помилка: " + error.message);
    
    // Після входу шукаємо баланс користувача по UUID
    const { data: profile, error: pError } = await supabaseClient
        .from('bank')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

    if (profile) {
        userData = profile;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        updateUI();
        getKzLimit();
    }
}

// Оновлення тексту на екрані
function updateUI() {
    document.getElementById('user-name').innerText = userData.name;
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;
}

// Оплата послуг
async function processOrder(name, price) {
    if (userData.balance < price) return alert("Недостатньо коштів!");

    const { error } = await supabaseClient
        .from('bank')
        .update({ balance: userData.balance - price })
        .eq('user_id', userData.user_id);

    if (!error) {
        // Логування в історію
        await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: name, price: price }]);
        
        userData.balance -= price;
        updateUI();
        alert(`Прийнято: ${name}`);
    }
}

// Запит на переказ
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

// Перегляд вхідних запитів
async function viewTransferRequests() {
    const { data } = await supabaseClient.from('transfer_requests').select('*').eq('to_idd', userData.idd).eq('status', 'pending');
    const container = document.getElementById('requests-container');
    container.innerHTML = data?.length ? '' : '<p style="text-align:center">Запитів немає</p>';

    data?.forEach(req => {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `
            <p>Сума: ${req.amount} ₴</p>
            <button class="btn" onclick="confirmTransfer(${req.id}, ${req.amount})">OK</button>
        `;
        container.appendChild(div);
    });
    toggleModal('requests-list-modal', true);
}

// Підтвердження переказу
async function confirmTransfer(id, amount) {
    if (userData.balance < amount) return alert("Не вистачає грошей!");
    
    await supabaseClient.from('bank').update({ balance: userData.balance - amount }).eq('user_id', userData.user_id);
    await supabaseClient.from('transfer_requests').update({ status: 'success' }).eq('id', id);
    
    alert("Переказ виконано!");
    location.reload();
}

// Ліміти кайф зони
async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) document.getElementById('kz-slots').innerText = data.value;
}

function toggleModal(id, show) { document.getElementById(id).classList.toggle('hidden', !show); }
async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

window.signIn = signIn;
window.processOrder = processOrder;
window.toggleModal = toggleModal;
window.sendTransferRequest = sendTransferRequest;
window.viewTransferRequests = viewTransferRequests;
window.confirmTransfer = confirmTransfer;
window.signOut = signOut;
