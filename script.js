// Налаштування Supabase
const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';

// Перевіряємо, чи завантажена бібліотека Supabase перед ініціалізацією
if (typeof supabase === 'undefined') {
    alert("Помилка: Бібліотека Supabase не завантажена. Перевірте інтернет або посилання в HTML!");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let userData = null;

// ФУНКЦІЯ ВХОДУ (Аутентифікація через Email/Password)
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    if (!email || !password) {
        alert("Будь ласка, введіть пошту та пароль!");
        return;
    }

    try {
        // 1. Спроба входу в Auth систему
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            alert("Помилка входу: " + authError.message);
            return;
        }

        // 2. Якщо вхід успішний, шукаємо профіль у таблиці 'bank' за user_id
        const { data: profile, error: profileError } = await supabaseClient
            .from('bank')
            .select('*')
            .eq('user_id', authData.user.id)
            .single();

        if (profileError || !profile) {
            alert("Акаунт створено, але дані в таблиці 'bank' не знайдені для цього UUID.");
            return;
        }

        // 3. Зберігаємо дані та перемикаємо екран
        userData = profile;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        updateUI();
        getKzLimit();

    } catch (err) {
        console.error("Critical error:", err);
        alert("Сталася критична помилка. Перевірте консоль браузера.");
    }
}

// Оновлення балансу та імені
function updateUI() {
    if (!userData) return;
    document.getElementById('user-name').innerText = userData.name || "Користувач";
    document.getElementById('user-balance').innerText = userData.balance || 0;
    document.getElementById('user-idd').innerText = userData.idd || "000000";
}

// Функція виходу
async function signOut() {
    await supabaseClient.auth.signOut();
    location.reload();
}

// Решта функцій (Послуги, Модалки)
function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.toggle('hidden', !show);
}

async function getKzLimit() {
    const { data } = await supabaseClient.from('settings').select('value').eq('key', 'kz_limit').single();
    if (data) document.getElementById('kz-slots').innerText = data.value;
}

// РОБИМО ФУНКЦІЇ ДОСТУПНИМИ ДЛЯ HTML
window.signIn = signIn;
window.signOut = signOut;
window.toggleModal = toggleModal;
window.processOrder = async function(name, price) {
    if (!userData || userData.balance < price) return alert("Недостатньо коштів!");
    
    const { error } = await supabaseClient
        .from('bank')
        .update({ balance: userData.balance - price })
        .eq('user_id', userData.user_id);

    if (!error) {
        userData.balance -= price;
        updateUI();
        alert(`Оплачено: ${name}`);
    }
};
