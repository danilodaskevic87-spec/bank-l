// Функція для оновлення балансу на екрані (бере дані з БД)
async function refreshDisplay() {
    const { data, error } = await supabaseClient
        .from('bank')
        .select('balance, idd, rank')
        .eq('user_id', currentUserId)
        .single();

    if (data) {
        document.getElementById('user-balance').innerText = data.balance;
        document.getElementById('user-idd').innerText = data.idd;
        document.getElementById('user-rank').innerText = data.rank;
    }
}

// 1. КАЙФ ЗОНА (Перевірка лімітів з таблиці settings)
async function openKaifZone() {
    const { data: settings } = await supabaseClient.from('settings').select('*');
    
    const limit = parseInt(settings.find(i => i.key === 'kz_limit')?.value || 0);
    const sold = parseInt(settings.find(i => i.key === 'kz_sold')?.value || 0);
    const available = limit - sold;

    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-content-body');
    title.innerText = "Кайф Зона";

    if (available <= 0) {
        body.innerHTML = `<p>❌ ВІЛЬНИХ МІСЦЬ НЕМАЄ (0 / ${limit})</p>`;
    } else {
        body.innerHTML = `
            <p>✅ ВІЛЬНО МІСЦЬ: ${available}</p>
            <button onclick="buyKzTicket(100)">КУПИТИ ВХІД (100 🌲)</button>
        `;
    }
    document.getElementById('forest-modal').classList.remove('hidden');
}

// Функція покупки квитка в КЗ
async function buyKzTicket(price) {
    const { data: user } = await supabaseClient.from('bank').select('balance').eq('user_id', currentUserId).single();

    if (user.balance >= price) {
        // 1. Знімаємо гроші
        await supabaseClient.from('bank').update({ balance: user.balance - price }).eq('user_id', currentUserId);
        
        // 2. Оновлюємо лічильник kz_sold у таблиці settings
        const { data: settings } = await supabaseClient.from('settings').select('value').eq('key', 'kz_sold').single();
        await supabaseClient.from('settings').update({ value: (parseInt(settings.value) + 1).toString() }).eq('key', 'kz_sold');

        alert("Квиток куплено! Кайфуйте.");
        closeModal();
        refreshDisplay(); // Оновлюємо баланс на екрані
    } else {
        alert("Недостатньо дерев!");
    }
}

// 2. ПОСЛУГИ (Кухня та зміна кольору)
function openServices() {
    document.getElementById('modal-title').innerText = "Послуги";
    const body = document.getElementById('modal-content-body');

    body.innerHTML = `
        <div>
            <span>🥗 Принести з кухні — 45 🌲</span>
            <button onclick="processPurchase('Обід з кухні', 45)">ЗАМОВИТИ</button>
        </div>
        <hr>
        <div>
            <span>🎨 Колір рангу — 30 🌲</span>
            <button onclick="changeRankColor()">ЗМІНИТИ</button>
        </div>
    `;
    document.getElementById('forest-modal').classList.remove('hidden');
}

// Універсальна функція покупки послуги
async function processPurchase(itemName, price) {
    const { data: user } = await supabaseClient.from('bank').select('balance').eq('user_id', currentUserId).single();

    if (user.balance >= price) {
        await supabaseClient.from('bank').update({ balance: user.balance - price }).eq('user_id', currentUserId);
        alert(`Послугу "${itemName}" успішно оплачено!`);
        refreshDisplay();
    } else {
        alert("Мало дерев на балансі!");
    }
}

// 3. ЗМІНА КОЛЬОРУ РАНГУ
async function changeRankColor() {
    const color = prompt("Введіть назву кольору (напр. red, gold, lime):");
    if (!color) return;

    const price = 30;
    const { data: user } = await supabaseClient.from('bank').select('balance').eq('user_id', currentUserId).single();

    if (user.balance >= price) {
        await supabaseClient.from('bank').update({ balance: user.balance - price }).eq('user_id', currentUserId);
        document.getElementById('user-rank').style.color = color;
        alert("Колір змінено!");
        refreshDisplay();
    } else {
        alert("Не вистачає дерев!");
    }
}

function closeModal() {
    document.getElementById('forest-modal').classList.add('hidden');
}
