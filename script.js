const SUPABASE_URL = 'https://mefzopeenhfdqfatbjaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LU94dUJoW2jwZJ9WIdfsMw_lEnMQobx';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Авторизація
async function signIn() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Помилка: " + error.message);
    }
}

// 2. Слухач стану (спрацьовує при вході або оновленні сторінки)
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        const user = session.user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Завантажуємо дані з БД
        await fetchUserData(user.id);
        await fetchNews();
    }
});

// 3. Отримання даних користувача з таблиці 'bank'
async function fetchUserData(userId) {
    const { data, error } = await supabaseClient
        .from('bank')
        .select('idd, balance, rank, total_spent')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error("Помилка БД:", error.message);
        return;
    }

    if (data) {
        document.getElementById('user-idd').innerText = data.idd || "Не вказано";
        document.getElementById('user-balance').innerText = data.balance || 0;
        document.getElementById('user-rank').innerText = data.rank || "Без рангу";
        document.getElementById('user-spent').innerText = data.total_spent || 0;
    }
}

// 4. Отримання новин з таблиці 'settings'
async function fetchNews() {
    const { data, error } = await supabaseClient
        .from('settings')
        .select('value')
        .eq('key', 'news')
        .single();

    if (data) {
        document.getElementById('news-content').innerText = data.value;
    }
}

// 5. Вихід
async function signOut() {
    await supabaseClient.auth.signOut();
    location.reload();
}
