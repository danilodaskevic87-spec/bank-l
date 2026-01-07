const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userData = null;

// --- ВХІД ---
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (authError) return alert("Помилка: " + authError.message);

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
        setInterval(refreshUserData, 5000);
    }
}

// --- ОНОВЛЕННЯ ІНТЕРФЕЙСУ ТА КУРСУ ---
function updateUI() {
    if (!userData) return;
    
    document.getElementById('user-name').innerText = userData.name || "Користувач";
    document.getElementById('user-balance').innerText = userData.balance;
    document.getElementById('user-idd').innerText = userData.idd;

    // Розрахунок курсу залежно від VIP-статусу
    const rate = userData.is_vip_user ? 0.3 : 0.5;
    const rateElement = document.getElementById('current-rate');
    if (rateElement) rateElement.innerText = rate;
}

// --- КУПІВЛЯ ВАЛЮТИ (ЛІСНИЧКІВ) ---
async function buyCurrency() {
    const amountToBuy = parseFloat(document.getElementById('exchange-amount').value);
    if (!amountToBuy || amountToBuy <= 0) return alert("Введіть коректну кількість");

    // Визначаємо ціну за VIP-статусом
    const rate = userData.is_vip_user ? 0.3 : 0.5;
    const totalCost = amountToBuy * rate;

    if (userData.balance < totalCost) {
        return alert(`Недостатньо коштів! Потрібно ${totalCost.toFixed(2)} ₴`);
    }

    const newBalance = userData.balance - totalCost;

    // Оновлюємо баланс в базі
    const { error } = await supabaseClient
        .from('bank')
        .update({ balance: newBalance })
        .eq('user_id', userData.user_id);

    if (!error) {
        // Записуємо запит на валюту, щоб адмін видав її (або додаємо в іншу таблицю)
        await supabaseClient.from('service_requests').insert([{
            user_id: userData.user_id,
            idd: userData.idd,
            service: `💰 Купівля лісничків: ${amountToBuy} шт`,
            price: totalCost
        }]);

        userData.balance = newBalance;
        updateUI();
        alert(`Ви купили ${amountToBuy} лісничків за ${totalCost.toFixed(2)} ₴!`);
        document.getElementById('exchange-amount').value = '';
    }
}

// --- РЕШТА ФУНКЦІЙ (БЕЗ ЗМІН) ---
async function processOrder(name, price) {
    if (userData.balance < price) return alert("Недостатньо коштів!");
    const { error } = await supabaseClient.from('bank').update({ balance: userData.balance - price }).eq('user_id', userData.user_id);
    if (!error) {
        await supabaseClient.from('service_requests').insert([{ user_id: userData.user_id, idd: userData.idd, service: name, price: price }]);
        userData.balance -= price;
        updateUI();
        alert(`Прийнято: ${name}`);
    }
}

async function refreshUserData() {
    if (!userData) return;
    const { data } = await supabaseClient.from('bank').select('*').eq('user_id', userData.user_id).single();
    if (data) { userData = data; updateUI(); }
}

function toggleModal(id, show) { document.getElementById(id)?.classList.toggle('hidden', !show); }
async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

window.signIn = signIn;
window.buyCurrency = buyCurrency;
window.processOrder = processOrder;
window.toggleModal = toggleModal;
window.signOut = signOut;
