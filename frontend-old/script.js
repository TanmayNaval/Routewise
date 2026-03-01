document.getElementById('trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // UI Elements
    const submitBtn = document.getElementById('submit-btn');
    const spinner = document.getElementById('spinner');
    const btnText = submitBtn.querySelector('span');
    const loadingMsg = document.getElementById('loading-msg');
    const resultsContainer = document.getElementById('results-container');
    const errorContainer = document.getElementById('error-container');
    
    // Form Values
    const destination = document.getElementById('destination').value;
    const days = parseInt(document.getElementById('days').value);
    const budget = document.getElementById('budget').value;
    const travel_style = document.getElementById('travel_style').value;
    
    // Loading State
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-80', 'cursor-not-allowed', 'scale-[0.98]');
    spinner.classList.remove('hidden');
    btnText.textContent = 'Generating...';
    loadingMsg.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
    
    try {
        const response = await fetch('http://localhost:8000/api/plan-trip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ destination, days, budget, travel_style })
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }
        
        const data = await response.json();
        
        renderResults(data);
        
        resultsContainer.classList.remove('hidden');
    } catch (error) {
        errorContainer.textContent = `Error: ${error.message}. Make sure the FastAPI backend is running on localhost:8000.`;
        errorContainer.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-80', 'cursor-not-allowed', 'scale-[0.98]');
        spinner.classList.add('hidden');
        btnText.textContent = 'Generate Trip Plan';
        loadingMsg.classList.add('hidden');
    }
});

function renderResults(data) {
    // 1. Render Destinations
    const destList = document.getElementById('destinations-list');
    destList.innerHTML = '';
    (data.destinations || []).forEach(dest => {
        const badge = document.createElement('span');
        badge.className = 'px-4 py-2 bg-blue-100/50 text-blue-800 rounded-2xl text-sm font-bold border border-blue-200/50 shadow-sm';
        badge.textContent = dest;
        destList.appendChild(badge);
    });
    
    // 2. Render Attractions
    const attrList = document.getElementById('attractions-list');
    attrList.innerHTML = '';
    Object.entries(data.top_attractions || {}).forEach(([place, attractions]) => {
        const card = document.createElement('div');
        card.className = 'bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow';
        card.innerHTML = `
            <h4 class="font-bold text-slate-800 mb-3 text-lg">${place}</h4>
            <ul class="text-sm text-slate-600 list-none space-y-2">
                ${(Array.isArray(attractions) ? attractions : [attractions]).map(a => `
                    <li class="flex gap-2">
                        <span class="text-blue-400">▹</span>
                        <span>${a}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        attrList.appendChild(card);
    });
    
    // Reasoning
    document.getElementById('reasoning').textContent = data.reasoning || 'No specific reasoning provided by the agent.';
    
    // 3. Render Itinerary
    const itinList = document.getElementById('itinerary-list');
    itinList.innerHTML = '';
    const plan = data.day_wise_plan || {};
    
    // Sort logic for Day 1, Day 2 etc.
    const sortedDays = Object.keys(plan).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
    });
    
    sortedDays.forEach((day, index) => {
        const acts = plan[day];
        const dayDiv = document.createElement('div');
        dayDiv.className = 'relative';
        dayDiv.innerHTML = `
            <div class="absolute w-4 h-4 bg-indigo-500 rounded-full -left-[33px] top-1.5 ring-4 ring-white shadow-sm"></div>
            <h3 class="font-bold text-indigo-900 mb-4 text-lg bg-indigo-50/80 inline-block px-3 py-1 rounded-lg">${day}</h3>
            <ul class="text-slate-600 space-y-3 text-base bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                ${(Array.isArray(acts) ? acts : [acts]).map(item => `
                    <li class="flex gap-3 items-start">
                        <span class="text-indigo-400 mt-0.5">✓</span>
                        <span>${item}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        itinList.appendChild(dayDiv);
    });
    
    // 4. Render Budget Breakdown
    const budgetBox = document.getElementById('budget-breakdown');
    budgetBox.innerHTML = '';
    const est = data.estimated_budget || {};
    
    const categories = [
        { key: 'stay', label: 'Accommodation', icon: '🏨', color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { key: 'food', label: 'Food & Dining', icon: '🍽️', color: 'text-orange-600', bg: 'bg-orange-50' },
        { key: 'transport', label: 'Transportation', icon: '🚆', color: 'text-blue-600', bg: 'bg-blue-50' },
        { key: 'activities', label: 'Activities', icon: '🎫', color: 'text-pink-600', bg: 'bg-pink-50' },
    ];
    
    categories.forEach(cat => {
        const val = est[cat.key] || 0;
        const div = document.createElement('div');
        div.className = `p-5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm ${cat.bg} hover:shadow-md transition-shadow`;
        div.innerHTML = `
            <span class="text-3xl mb-2 drop-shadow-sm">${cat.icon}</span>
            <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">${cat.label}</span>
            <span class="text-2xl font-black ${cat.color}">$${val}</span>
        `;
        budgetBox.appendChild(div);
    });
    
    // Total row
    const totalDiv = document.createElement('div');
    totalDiv.className = 'col-span-2 sm:col-span-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6 rounded-2xl flex items-center justify-between shadow-lg transform hover:scale-[1.01] transition-transform';
    totalDiv.innerHTML = `
        <span class="font-extrabold uppercase tracking-widest text-emerald-50">Total Estimated Cost</span>
        <span class="text-4xl font-black drop-shadow-md">$${est.total || 0}</span>
    `;
    budgetBox.appendChild(totalDiv);
    
    // 5. Render Tips
    const tipsList = document.getElementById('budget-tips');
    const tipsContainer = document.getElementById('tips-container');
    tipsList.innerHTML = '';
    
    const tips = data.budget_tips || [];
    if (tips.length > 0) {
        tipsContainer.classList.remove('hidden');
        tips.forEach(tip => {
            const li = document.createElement('li');
            li.className = 'flex gap-3 items-start';
            li.innerHTML = `
                <span class="text-emerald-500 font-bold mt-0.5">»</span>
                <span>${tip}</span>
            `;
            tipsList.appendChild(li);
        });
    } else {
        tipsContainer.classList.add('hidden');
    }
}
