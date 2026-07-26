/* ============ THEME ============ */
function toggleTheme(){
  const html = document.documentElement;
  html.classList.toggle('dark');
  const dark = html.classList.contains('dark');
  localStorage.setItem('harmony-theme', dark ? 'dark' : 'light');
  document.getElementById('theme-icon').textContent = dark ? 'light_mode' : 'dark_mode';
}
(function initTheme(){
  const saved = localStorage.getItem('harmony-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();

/* ============ NAV / ROUTER ============ */
const PAGES = ['landing','tracker','chat','legal','learning','community'];
function goTo(page){
  PAGES.forEach(p=>{
    document.getElementById('page-'+p).classList.toggle('active', p===page);
  });
  document.querySelectorAll('.nav-link').forEach(a=>{
    a.classList.toggle('active-link', a.dataset.nav === page);
  });
  window.scrollTo({top:0, behavior:'smooth'});
  history.replaceState(null,'','#'+page);
  if(page==='chat') setTimeout(()=>document.getElementById('chat-input').focus(),300);
  revealOnScroll();
}
window.addEventListener('DOMContentLoaded', ()=>{
  const hash = location.hash.replace('#','');
  goTo(PAGES.includes(hash) ? hash : 'landing');
});

/* ============ SCROLL REVEAL ============ */
const revealObserver = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
},{threshold:0.1});
function revealOnScroll(){
  document.querySelectorAll('.reveal:not(.in)').forEach(el=>revealObserver.observe(el));
}
revealOnScroll();

/* ============ STORAGE HELPERS ============ */
function loadJSON(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; }
}
function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

/* ============ TRACKER ============ */
let calState = loadJSON('harmony-calendar', {}); // { "2026-7-15": true, ... }
let logs = loadJSON('harmony-logs', []); // {date, mood, symptoms, notes}
let currentMonth = new Date();
let selectedMood = null;
let selectedSymptoms = new Set();

function keyFor(y,m,d){ return `${y}-${m}-${d}`; }

function renderCalendar(){
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';
  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  document.getElementById('cal-month-label').textContent = currentMonth.toLocaleString('default',{month:'long', year:'numeric'});
  const firstDay = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  for(let i=0;i<firstDay;i++){
    const filler = document.createElement('div');
    filler.className = 'h-14 md:h-20';
    grid.appendChild(filler);
  }
  for(let d=1; d<=daysInMonth; d++){
    const div = document.createElement('div');
    const k = keyFor(y,m,d);
    const isPeriod = !!calState[k];
    div.className = 'h-14 md:h-20 p-2 rounded-xl border border-outline-variant/20 font-bold calendar-day-hover transition-all cursor-pointer flex flex-col justify-between text-sm';
    if(isPeriod){ div.style.backgroundColor = 'var(--primary-container)'; div.style.borderColor='var(--primary-container)'; div.style.color='var(--on-primary-container)'; }
    const today = new Date();
    if(today.getFullYear()===y && today.getMonth()===m && today.getDate()===d){
      div.style.outline = '2px solid var(--primary)';
    }
    div.innerHTML = `<span>${d}</span>${isPeriod?'<span class="material-symbols-outlined text-sm fill">water_drop</span>':''}`;
    div.addEventListener('click', ()=>{
      calState[k] = !calState[k];
      saveJSON('harmony-calendar', calState);
      renderCalendar();
      updateHeroStatus();
      updateHistory();
    });
    grid.appendChild(div);
  }
}
function changeMonth(delta){
  currentMonth.setMonth(currentMonth.getMonth()+delta);
  renderCalendar();
}

function updateHeroStatus(){
  const periodDays = Object.keys(calState).filter(k=>calState[k]).map(k=>{
    const [y,m,d] = k.split('-').map(Number);
    return new Date(y,m,d);
  }).sort((a,b)=>a-b);
  if(periodDays.length===0){
    document.getElementById('next-period-label').textContent = 'Log a period to begin';
    document.getElementById('phase-label').textContent = 'Awaiting data';
    return;
  }
  const lastPeriod = periodDays[periodDays.length-1];
  const today = new Date(); today.setHours(0,0,0,0);
  const daysSince = Math.round((today - lastPeriod)/86400000);
  const cycleLen = 28;
  const daysToNext = Math.max(cycleLen - daysSince, 0);
  document.getElementById('next-period-label').textContent = daysToNext===0 ? 'Period may start today' : `Next Period: In ${daysToNext} Days`;
  let phase = 'Follicular Phase';
  if(daysSince <= 5) phase = 'Menstrual Phase';
  else if(daysSince <= 13) phase = 'Follicular Phase';
  else if(daysSince <= 16) phase = 'Ovulation';
  else phase = 'Luteal Phase';
  document.getElementById('phase-label').textContent = phase;
  const focusMap = {
    'Menstrual Phase': ['Rest & Recover','Your body is shedding — prioritize rest, warmth and iron-rich food.'],
    'Follicular Phase': ['Energize','Energy is rising. A great time for new workouts or projects.'],
    'Ovulation': ['Peak Energy','You may feel most social and energetic today — great for connection.'],
    'Luteal Phase': ['Gentle Movement', "Your energy levels might be lower today. Try some restorative yoga or a short walk."]
  };
  document.getElementById('focus-title').textContent = focusMap[phase][0];
  document.getElementById('focus-text').textContent = focusMap[phase][1];
}

function updateHistory(){
  const dates = Object.keys(calState).filter(k=>calState[k]).map(k=>{
    const [y,m,d] = k.split('-').map(Number); return new Date(y,m,d);
  }).sort((a,b)=>a-b);
  const bars = document.getElementById('history-bars');
  bars.innerHTML = '';
  if(dates.length < 2){
    document.getElementById('avg-cycle-label').textContent = 'Average: — Days (log more to see)';
    checkIrregularity([]);
    return;
  }
  // group consecutive-day runs as period starts
  const starts = [dates[0]];
  for(let i=1;i<dates.length;i++){
    const diff = (dates[i]-dates[i-1])/86400000;
    if(diff > 3) starts.push(dates[i]);
  }
  const gaps = [];
  for(let i=1;i<starts.length;i++){
    gaps.push(Math.round((starts[i]-starts[i-1])/86400000));
  }
  if(gaps.length===0){
    document.getElementById('avg-cycle-label').textContent = 'Average: — Days (log more to see)';
    checkIrregularity([]);
    return;
  }
  const avg = Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length);
  document.getElementById('avg-cycle-label').textContent = `Average: ${avg} Days`;
  const max = Math.max(...gaps, 1);
  gaps.slice(-6).forEach(g=>{
    const bar = document.createElement('div');
    bar.className = 'bg-primary w-full rounded-t-sm';
    bar.style.height = Math.max(15, (g/max)*100)+'%';
    bar.style.opacity = 0.5 + 0.5*(g/max);
    bars.appendChild(bar);
  });
  checkIrregularity(gaps.slice(-6));
}

document.getElementById('mood-grid').addEventListener('click', (e)=>{
  const btn = e.target.closest('.mood-selector');
  if(!btn) return;
  document.querySelectorAll('.mood-selector').forEach(b=>{
    b.style.boxShadow=''; b.style.outline='';
  });
  btn.style.outline = '3px solid var(--secondary-container)';
  selectedMood = btn.dataset.mood;
});
document.getElementById('symptom-tags').addEventListener('click',(e)=>{
  const chip = e.target.closest('.symptom-chip');
  if(!chip) return;
  const s = chip.dataset.symptom;
  if(selectedSymptoms.has(s)){ selectedSymptoms.delete(s); chip.style.backgroundColor=''; chip.style.color=''; }
  else{ selectedSymptoms.add(s); chip.style.backgroundColor='var(--primary-container)'; chip.style.color='var(--on-primary-container)'; }
});

function saveLog(){
  const notes = document.getElementById('log-notes').value;
  if(!selectedMood && selectedSymptoms.size===0 && !notes.trim()){
    const c = document.getElementById('save-confirm');
    c.textContent = 'Pick a mood, symptom, or add a note first';
    c.style.color = 'var(--error)';
    c.classList.remove('hidden');
    setTimeout(()=>{ c.classList.add('hidden'); c.style.color=''; c.textContent='✓ Log saved'; }, 2200);
    return;
  }
  const entry = { date: new Date().toISOString().slice(0,10), mood: selectedMood, symptoms: Array.from(selectedSymptoms), notes };
  logs.push(entry);
  saveJSON('harmony-logs', logs);

  // reset the form for the next entry
  document.getElementById('log-notes').value = '';
  document.querySelectorAll('.mood-selector').forEach(b=>{ b.style.outline=''; });
  document.querySelectorAll('.symptom-chip').forEach(chip=>{ chip.style.backgroundColor=''; chip.style.color=''; });
  selectedMood = null;
  selectedSymptoms = new Set();

  const c = document.getElementById('save-confirm');
  c.classList.remove('hidden');
  setTimeout(()=>c.classList.add('hidden'), 2000);
  updateInsight();
  updateDietSuggestion();
  renderRecentLogs();
}
function renderRecentLogs(){
  const wrap = document.getElementById('recent-logs');
  if(!wrap) return;
  if(logs.length===0){
    wrap.innerHTML = '<p class="text-sm text-on-surface-variant">No logs yet — save your first entry above.</p>';
    return;
  }
  wrap.innerHTML = '';
  logs.slice().reverse().slice(0,6).forEach((l, idx)=>{
    const realIdx = logs.length - 1 - idx;
    const row = document.createElement('div');
    row.className = 'flex items-start gap-3 p-3 rounded-xl border border-outline-variant/20';
    row.innerHTML = `
      <div class="text-xs font-bold text-on-surface-variant w-20 flex-shrink-0 pt-0.5">${l.date}</div>
      <div class="flex-1 text-sm">
        ${l.mood ? `<span class="font-semibold">${l.mood}</span>` : ''}
        ${l.symptoms.length ? ' · ' + l.symptoms.join(', ') : ''}
        ${l.notes ? `<p class="text-on-surface-variant text-xs mt-1">${l.notes}</p>` : ''}
      </div>
      <button class="text-on-surface-variant hover:text-primary" onclick="deleteLog(${realIdx})"><span class="material-symbols-outlined text-base">delete</span></button>`;
    wrap.appendChild(row);
  });
}
function deleteLog(idx){
  logs.splice(idx,1);
  saveJSON('harmony-logs', logs);
  renderRecentLogs();
  updateInsight();
  updateDietSuggestion();
}
function clearLogs(){
  logs = [];
  saveJSON('harmony-logs', logs);
  renderRecentLogs();
  updateInsight();
  updateDietSuggestion();
}
const DIET_BY_PHASE = {
  'Menstrual Phase': 'Focus on iron-rich foods (spinach, lentils, jaggery, dates) and warm fluids to replace lost iron and ease cramps. Add vitamin C (citrus, amla) to help iron absorption.',
  'Follicular Phase': 'Your energy is rising — light, fresh foods like sprouts, fermented foods, and lean protein support this rebuilding phase.',
  'Ovulation': 'Support hormone balance with fiber-rich veggies, seeds (flax, pumpkin) and antioxidant-rich fruits like berries.',
  'Luteal Phase': 'Cravings may rise — favor complex carbs (whole grains, oats), magnesium-rich foods (nuts, dark chocolate) and reduce salt/caffeine to ease bloating and mood swings.'
};
const DIET_BY_MOOD = {
  'Low': 'Warm, comforting meals with B12 and omega-3s (eggs, fish, walnuts) can help support mood.',
  'Tired': 'Iron and B-vitamin rich foods (lentils, leafy greens, whole grains) can help fight fatigue.',
  'Stressed': 'Magnesium-rich foods (nuts, seeds, dark chocolate) and chamomile tea can help calm the nervous system.',
  'Energetic': "Great time to fuel with balanced protein and complex carbs to sustain that energy.",
  'Calm': 'Keep it balanced — whole foods, plenty of water, and mindful eating will maintain this steady state.',
  'Happy': 'Keep enjoying a colorful, varied plate — this is a great time to try a new healthy recipe!'
};
const DIET_BY_SYMPTOM = {
  'Cramps': 'anti-inflammatory foods like ginger, turmeric and leafy greens',
  'Bloating': 'reducing salt intake and adding potassium-rich foods like bananas and cucumber',
  'Headache': 'staying well hydrated and including magnesium-rich foods',
  'Fatigue': 'iron and B12 rich foods such as lentils, eggs and fortified cereals',
  'Acne': 'reducing sugar/dairy and adding zinc-rich foods like pumpkin seeds'
};
function updateDietSuggestion(){
  const el = document.getElementById('diet-suggestion');
  if(!el) return;
  if(logs.length===0){
    el.textContent = 'Log your mood and symptoms to get a gentle, phase-based diet suggestion here.';
    return;
  }
  const last = logs[logs.length-1];
  const phase = document.getElementById('phase-label').textContent;
  let msg = DIET_BY_PHASE[phase] || 'Eat a balanced, whole-food diet with plenty of water.';
  if(last.mood && DIET_BY_MOOD[last.mood]) msg += ' ' + DIET_BY_MOOD[last.mood];
  if(last.symptoms && last.symptoms.length){
    const tips = last.symptoms.filter(s=>DIET_BY_SYMPTOM[s]).map(s=>DIET_BY_SYMPTOM[s]);
    if(tips.length) msg += ` For ${last.symptoms.join(', ').toLowerCase()}, try ${tips.join(' and ')}.`;
  }
  el.textContent = msg;
}

function checkIrregularity(gaps){
  const card = document.getElementById('irregularity-card');
  const text = document.getElementById('irregularity-text');
  if(!card) return;
  if(gaps.length < 2){ card.style.display = 'none'; return; }
  const min = Math.min(...gaps), max = Math.max(...gaps);
  const outOfRange = gaps.some(g => g < 21 || g > 35);
  const highVariance = (max - min) > 9;
  if(outOfRange || highVariance){
    card.style.display = 'flex';
    if(outOfRange){
      text.textContent = `One or more of your recent cycles (${gaps.join(', ')} days) fall outside the typical 21–35 day range. This can sometimes indicate irregular ovulation, PCOD/PCOS, thyroid issues, or stress. It's a good idea to consult a gynaecologist for a check-up.`;
    } else {
      text.textContent = `Your recent cycle lengths (${gaps.join(', ')} days) vary quite a bit month to month. Noticeable irregularity can be worth discussing with a gynaecologist — conditions like PCOD/PCOS are commonly linked to irregular cycles.`;
    }
  } else {
    card.style.display = 'none';
  }
}

function updateInsight(){
  if(logs.length===0) return;
  const moodCounts = {};
  logs.forEach(l=>{ if(l.mood) moodCounts[l.mood]=(moodCounts[l.mood]||0)+1; });
  const top = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1])[0];
  const symptomCounts = {};
  logs.forEach(l=>l.symptoms.forEach(s=>symptomCounts[s]=(symptomCounts[s]||0)+1));
  const topSymptom = Object.entries(symptomCounts).sort((a,b)=>b[1]-a[1])[0];
  let msg = `You've logged ${logs.length} ${logs.length===1?'entry':'entries'}.`;
  if(top) msg += ` "${top[0]}" is your most common mood.`;
  if(topSymptom) msg += ` "${topSymptom[0]}" appears most often — consider tracking triggers or asking Astha for tips.`;
  document.getElementById('ai-insight').textContent = msg;
}

renderCalendar();
updateHeroStatus();
updateHistory();
updateInsight();
updateDietSuggestion();
renderRecentLogs();

/* ============ CHATBOT (ASTHA) ============ */
const RULES = [
  { kws:['hi','hello','hey','namaste'], reply:"Hi there 👋 I'm Astha. How are you feeling today, or is there something on your mind about your cycle, hygiene, or wellbeing?" },
  { kws:['cycle length','normal cycle','how long'], reply:"A typical menstrual cycle ranges from 21 to 35 days, with bleeding lasting 2–7 days. Cycles can vary month to month due to stress, diet, or health changes — if yours is consistently outside this range, it's worth talking to a doctor." },
  { kws:['pain','cramp','cramps'], reply:"For period pain: a heating pad on your lower abdomen, gentle stretching or yoga, staying hydrated, and light exercise can help. Over-the-counter pain relief (like ibuprofen) can also ease cramps — but if pain is severe or stops your daily activities, please see a doctor." },
  { kws:['hygiene','pad','tampon','cup','clean'], reply:"Change your pad every 4–6 hours, and a tampon or menstrual cup as instructed by the product (usually every 4–8 hours). Wash your hands before and after, and use plain water to clean the genital area — avoid scented soaps, which can disturb natural pH." },
  { kws:['anxious','anxiety','stress','stressed','overwhelmed'], reply:"I hear you. Feeling anxious is tough. Try the 4-7-8 breathing technique: inhale for 4 seconds, hold for 7, exhale slowly for 8. Would you like to try it together, or talk more about what's on your mind?" },
  { kws:['feel very down','feel down','feel low','sad','low','down','depressed'], reply:"I'm really sorry you're feeling this way today. Your feelings are valid. A few gentle things that can help right now: step outside for fresh air or sunlight, message someone you trust, drink some water, and try not to be hard on yourself — low moods are common, especially around your cycle. If this heaviness continues for more than two weeks or feels unmanageable, please consider speaking with a counselor, doctor, or a trusted adult. You don't have to go through it alone." },
  { kws:['irregular','late period','missed period', 'irregular periods'], reply:"Irregular periods can happen due to stress, sudden weight change, over-exercising, thyroid issues, or conditions like PCOD/PCOS. A few things that can help: maintaining a consistent sleep schedule, balanced meals, moderate exercise, and managing stress. Tracking your cycle here helps spot patterns — if periods are missed for 3+ months, arrive more than 35 days apart, or feel unpredictable for several months, please see a gynaecologist for a check-up to rule out PCOD/PCOS or thyroid issues." },
  { kws:['symptoms of pcod','symptoms of pcos'], reply:"Common PCOD/PCOS symptoms: irregular or missed periods, excess hair growth on face/body (hirsutism), persistent acne, weight gain that's hard to manage, hair thinning on the scalp, dark patches of skin, and sometimes fertility difficulties. If you notice several of these together, it's a good idea to see a gynaecologist for proper testing rather than self-diagnosing." },
  { kws:['pcod','pcos'], reply:"PCOD/PCOS (Polycystic Ovarian Disease/Syndrome) is a hormonal condition affecting how the ovaries work. Common symptoms include: irregular or missed periods, excess facial/body hair, acne, weight gain (especially around the abdomen), thinning hair on the scalp, and difficulty losing weight. It's diagnosed by a doctor using symptoms, blood tests, and sometimes an ultrasound. It's very manageable with lifestyle changes, diet, and sometimes medication — please consult a gynaecologist if you notice these symptoms, especially very irregular periods." },
  { kws:['confident', 'confidence', 'more confident'], reply:"Building confidence is a practice, not a switch! A few things that genuinely help: keep a small list of things you've done well (a 'wins' journal), practice good posture, set tiny achievable goals and celebrate them, surround yourself with people who lift you up, and remind yourself that everyone — even people who look confident — has doubts. Confidence often grows quietly through repeated small acts of courage, not one big moment." },
  { kws:['books on feminism','feminism book', 'feminist book', 'feminism'], reply:"Some approachable books on feminism: 'We Should All Be Feminists' by Chimamanda Ngozi Adichie (short and powerful), 'The Second Sex' by Simone de Beauvoir (a classic, more academic), 'Feminism is for Everybody' by bell hooks, 'Why I Am a Feminist' by Rebecca Solnit-adjacent essays, and 'Period Power' by Maisie Hill (connects feminism with menstrual health!). Starting with Adichie's short essay is a great, easy entry point." },
  { kws:['pms','pmdd'], reply:"PMS symptoms (mood swings, bloating, tender breasts, irritability) usually show up 1–2 weeks before your period. Regular exercise, reducing salt/caffeine, and enough sleep can ease symptoms. PMDD is a more severe form — if symptoms disrupt your life, a doctor can help." },
  { kws:['diet for normal cycle', 'diet for cycle', 'food for cycle', 'nutrition for cycle'], reply:"For a healthy, regular cycle: eat enough overall calories (under-eating can disrupt cycles), include healthy fats (nuts, seeds, avocado, ghee) which support hormone production, iron-rich foods (leafy greens, lentils) especially after your period, complex carbs for steady energy, and stay hydrated. Reducing processed sugar and managing stress also support cycle regularity." },
  { kws:['diet for pcos','diet for pcod','pcos diet','pcod diet'], reply:"For PCOD/PCOS, a diet that helps manage insulin resistance tends to help most: favor low-glycemic complex carbs (whole grains, millets) over refined sugar/white flour, include lean protein and healthy fats to stay full longer, add fiber-rich vegetables, limit processed and sugary foods, and consider smaller, more frequent meals. Regular movement (even a daily walk) also improves insulin sensitivity. This isn't a replacement for medical advice — a doctor or dietician can build a plan suited to you." },
  { kws:['endometriosis'], reply:"Endometriosis is a condition where tissue similar to the uterine lining grows outside the uterus — on the ovaries, fallopian tubes, or other pelvic organs. It can cause severe period pain (beyond typical cramps), pain during sex, heavy bleeding, pain during bowel movements or urination during periods, and sometimes fertility difficulties. It's often underdiagnosed because 'painful periods' are dismissed as normal — if your period pain is severe enough to affect daily life, please see a gynaecologist, as early diagnosis helps management." },
  { kws:['cervical cancer'], reply:"Cervical cancer develops in the cells of the cervix, often linked to persistent HPV (Human Papillomavirus) infection. Early symptoms can include abnormal vaginal bleeding (between periods, after sex, or after menopause), unusual discharge, and pelvic pain — though early stages often have no symptoms at all. Regular screening (Pap smear/HPV test, usually recommended from age 21 or 25 depending on guidelines) is key for early detection, and the HPV vaccine significantly reduces risk. Please talk to a gynaecologist about a screening schedule that's right for you." },
  { kws:['diet','food','eat','nutrition'], reply:"During your period, iron-rich foods (leafy greens, lentils, jaggery), warm fluids, and reducing caffeine can help with energy and cramps. Small, frequent meals can also ease bloating." },
  { kws:['legal','rights','law'], reply:"Harmony's Legal Hub has clear explanations of menstrual leave policies, workplace rights, and health-related laws. Want me to take you there?" },
  { kws:['thank','thanks'], reply:"You're always welcome 💜 I'm here whenever you need me." },
  { kws:['exercise','workout','yoga'], reply:"Gentle yoga poses like Child's Pose, Cat-Cow, and Supta Baddha Konasana can ease period discomfort. During your follicular and ovulation phases, your body may handle higher-intensity workouts well." },
];
const FALLBACKS = [
  "That's a great question. While I don't have a specific answer stored for that, I'd encourage you to explore the Legal Hub or Learning sections, or consult a healthcare professional for personal guidance.",
  "I want to make sure I give you accurate guidance — could you tell me a bit more about what you're experiencing?",
  "I'm here to support you with menstrual health, hygiene, and wellbeing topics. Could you rephrase your question so I can help better?"
];
function asthaReply(text){
  const lower = text.toLowerCase();
  for(const rule of RULES){
    if(rule.kws.some(k=>lower.includes(k))) return rule.reply;
  }
  return FALLBACKS[Math.floor(Math.random()*FALLBACKS.length)];
}

let chatHistory = loadJSON('harmony-chat', null);
if(!chatHistory){
  chatHistory = [{ from:'astha', text:"Hello, I'm Astha. I'm here to support your journey today. How are you feeling, or is there something specific on your mind regarding your wellness?" }];
  saveJSON('harmony-chat', chatHistory);
}
function renderChat(){
  const win = document.getElementById('chat-window');
  win.innerHTML = '';
  chatHistory.forEach(m=>appendBubble(m.from, m.text, false));
  win.scrollTop = win.scrollHeight;
}
function appendBubble(from, text, animate=true){
  const win = document.getElementById('chat-window');
  const div = document.createElement('div');
  if(from==='astha'){
    div.className = 'flex items-start gap-2 message-anim';
    div.innerHTML = `<div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-primary" style="background-color:var(--astha-bubble);"><span class="material-symbols-outlined fill text-lg">auto_awesome</span></div>
      <div class="max-w-[80%] p-3 rounded-2xl rounded-tl-none shadow-sm text-sm" style="background-color:var(--astha-bubble); color:var(--on-surface);">${text}</div>`;
  } else {
    div.className = 'flex items-start justify-end gap-2 message-anim';
    div.innerHTML = `<div class="max-w-[80%] bg-card p-3 rounded-2xl rounded-tr-none border border-outline-variant/20 shadow-sm text-sm">${text}</div>
      <div class="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0 text-on-primary-container"><span class="material-symbols-outlined text-lg">person</span></div>`;
  }
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}
function sendChat(textOverride){
  const input = document.getElementById('chat-input');
  const text = (textOverride || input.value).trim();
  if(!text) return;
  chatHistory.push({from:'user', text});
  appendBubble('user', text);
  input.value = '';
  saveJSON('harmony-chat', chatHistory);
  const win = document.getElementById('chat-window');
  const typing = document.createElement('div');
  typing.className = 'flex items-start gap-2 message-anim';
  typing.id = 'typing-indicator';
  typing.innerHTML = `<div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-primary" style="background-color:var(--astha-bubble);"><span class="material-symbols-outlined fill text-lg">auto_awesome</span></div>
    <div class="p-3 rounded-2xl rounded-tl-none shadow-sm text-sm flex gap-1" style="background-color:var(--astha-bubble);"><span class="typing-dot">●</span><span class="typing-dot">●</span><span class="typing-dot">●</span></div>`;
  win.appendChild(typing);
  win.scrollTop = win.scrollHeight;
  setTimeout(()=>{
    document.getElementById('typing-indicator')?.remove();
    const reply = asthaReply(text);
    chatHistory.push({from:'astha', text:reply});
    appendBubble('astha', reply);
    saveJSON('harmony-chat', chatHistory);
  }, 700 + Math.random()*500);
}
function clearChat(){
  chatHistory = [{ from:'astha', text:"Hello, I'm Astha. I'm here to support your journey today. How are you feeling, or is there something specific on your mind regarding your wellness?" }];
  saveJSON('harmony-chat', chatHistory);
  renderChat();
}
document.getElementById('chat-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendChat(); });
document.getElementById('quick-replies').addEventListener('click', (e)=>{
  const btn = e.target.closest('.quick-btn');
  if(btn) sendChat(btn.textContent);
});
renderChat();

/* ============ LEGAL HUB ============ */
const LEGAL_TOPICS = [
  { icon:'work', title:'Menstrual & Health Leave', 
    def: "<b>What it is:</b> Menstrual leave is paid or unpaid time off from work or school specifically granted for menstrual-related discomfort (like severe cramps or PCOD-related pain), separate from regular sick leave.",
    body:"Some countries and companies offer paid menstrual leave. In India, states like Bihar (since 1992) and more recently Kerala (for students) have introduced menstrual leave policies, and private companies like Zomato and Byju's have added 1–2 days of monthly menstrual leave in their internal policies. There is currently no single central law in India mandating menstrual leave nationally — it depends on state rules or individual company policy. Check your employee handbook, HR policy, or your institution's rules to see what's offered, and know that requesting reasonable accommodation for documented health reasons is a right worth understanding." },
  { icon:'shield', title:'Right to Safe & Hygienic Products', 
    def: "<b>What it is:</b> This is the right to access affordable, safe, quality menstrual hygiene products (pads, tampons, cups) without excessive taxation or barriers, recognized as part of the right to health and dignity.",
    body:"You have the right to access safe, quality menstrual products. In India, sanitary napkins were exempted from GST (Goods and Services Tax) in 2018 following public campaigns, making them tax-free. The Government of India's <b>Menstrual Hygiene Scheme (MHS)</b>, run under the National Health Mission, provides free or subsidized sanitary napkins to adolescent girls through schools and Anganwadi centers in many states. If your school or local health center isn't providing these, you can raise it with the school authority or local Primary Health Centre (PHC)." },
  { icon:'gavel', title:'Workplace Protection — The POSH Act', 
    def: "<b>What it is:</b> POSH stands for 'Prevention of Sexual Harassment.' The <b>Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013</b> is an Indian law that legally defines sexual harassment and sets out how workplaces must prevent and respond to it. An <b>Internal Complaints Committee (ICC)</b> is a mandatory panel every qualifying workplace must set up to receive and investigate complaints.",
    body:"The POSH Act requires every workplace with 10 or more employees to set up an Internal Complaints Committee (ICC), led by a senior woman employee, with at least one external member (from an NGO or with legal knowledge) to ensure impartiality. Harassment covers unwelcome physical contact, requests for sexual favors, sexually colored remarks, showing pornography, or any other unwelcome physical, verbal, or non-verbal conduct of a sexual nature — this includes harassment related to menstruation, pregnancy, or gender identity. A complaint can be filed within 3 months of the incident (extendable), and the law mandates confidentiality throughout the process. Retaliation against a complainant is itself a punishable offense." },
  { icon:'health_and_safety', title:'Right to Privacy & Non-Discrimination', 
    def: "<b>What it is:</b> The right to privacy means your personal and medical information (like cycle tracking data, health records, or diagnoses) cannot be shared or misused without your consent. Non-discrimination means you cannot be treated unfairly at school, work, or public services because of a biological process like menstruation.",
    body:"In India, the Supreme Court recognized privacy as a <b>Fundamental Right</b> under Article 21 of the Constitution in the 2017 <i>Justice K.S. Puttaswamy</i> judgment — this extends to medical and reproductive health information. Separately, the <b>Digital Personal Data Protection Act, 2023</b> governs how organizations must handle personal data, including health data, requiring consent and safeguards. You cannot legally be denied admission, employment, or services purely due to menstruation-related reasons — doing so can amount to discrimination under constitutional equality principles (Article 14 & 15)." },
  { icon:'school', title:'Menstrual Health in Schools', 
    def: "<b>What it is:</b> This covers the policies requiring schools to provide menstrual hygiene infrastructure — clean toilets, sanitary product access, disposal facilities, and health education — as part of a student's right to education in a safe environment.",
    body:"India's <b>National Menstrual Hygiene Policy (2021)</b>, along with state-level School Health Programmes, requires schools to provide sanitary products, functional and clean washrooms with water access, proper disposal mechanisms (like incinerators), and age-appropriate menstrual health education, often as part of the Rashtriya Kishor Swasthya Karyakram (RKSK). If your school lacks these facilities, you (or a parent/guardian) can formally raise it with the school principal, the District Education Officer, or the local School Management Committee." },
  { icon:'balance', title:'Reporting Abuse or Harassment', 
    def: "<b>What it is:</b> Helplines are free, often confidential services designed to connect someone facing abuse, harassment, or violence with immediate support, counseling, or legal/police assistance.",
    body:"If you experience abuse, harassment, or violence, helplines and legal aid services are available in most countries, often free of charge. In India: dial <b>181</b> (Women Helpline, 24/7), <b>1098</b> (Child Helpline), or <b>112</b> (Emergency Services). The <b>Protection of Children from Sexual Offences (POCSO) Act, 2012</b> specifically protects minors from sexual abuse and mandates faster, child-friendly legal procedures. <b>Free Legal Aid</b> is also available through District Legal Services Authorities (DLSA) for those who cannot afford a lawyer. Always prioritize your immediate safety first, then reach out to a trusted adult or helpline." },
  { icon:'family_restroom', title:'Domestic Violence Protections',
    def: "<b>What it is:</b> The <b>Protection of Women from Domestic Violence Act, 2005 (PWDVA)</b> is an Indian civil law that protects women from physical, emotional, sexual, verbal, or economic abuse within domestic/family relationships, and gives access to protection orders, residence rights, and monetary relief.",
    body:"Under this Act, a woman facing domestic violence can approach a <b>Protection Officer</b>, the police, or directly the Magistrate's Court to seek a <b>Protection Order</b> (stopping the abuser from further violence), a <b>Residence Order</b> (right to stay in the shared household), and monetary relief for medical expenses or loss of earnings — all without needing to file a criminal case first, though criminal remedies (like Section 498A of the Bharatiya Nyaya Sanhita, formerly IPC) are also available for cruelty by a husband or his relatives." },
  { icon:'pregnant_woman', title:'Maternity & Reproductive Rights',
    def: "<b>What it is:</b> The <b>Maternity Benefit Act, 1961 (amended 2017)</b> is a labor law ensuring paid leave and job protection for women around childbirth. It reflects the broader principle that reproductive health decisions are a personal right.",
    body:"The Maternity Benefit Act entitles eligible women employees to 26 weeks of paid maternity leave for the first two children (12 weeks for subsequent children), prohibits dismissal during pregnancy leave, and mandates creche facilities in establishments with 50+ employees. Separately, the <b>Medical Termination of Pregnancy (MTP) Act</b> (amended 2021) governs safe, legal access to abortion up to specified gestational limits, recognizing reproductive autonomy as part of personal liberty." },
  { icon:'payments', title:'Right to Equal Pay & Opportunity',
    def: "<b>What it is:</b> Equal pay means being paid the same wage as anyone else for the same or similar work, regardless of gender. Equal opportunity means having a fair, unbiased chance at hiring, promotions, and workplace roles.",
    body:"In India, the <b>Equal Remuneration Act, 1976</b> (now consolidated into the <b>Code on Wages, 2019</b>) legally requires equal pay for equal work between men and women, and prohibits discrimination in recruitment for the same role. If you suspect unequal pay for the same work, you can raise it with your labor department or a Labour Court. <br><br><b>Internationally:</b> the <b>ILO Equal Remuneration Convention (No. 100)</b>, ratified by over 170 countries, sets the global standard for equal pay, and the UN's <b>Sustainable Development Goal 5</b> (Gender Equality) tracks progress on closing pay gaps worldwide." },
  { icon:'cake', title:'Age of Consent & Marriage Laws',
    def: "<b>What it is:</b> The 'age of consent' is the legal age at which a person is considered able to consent to sexual activity. Marriage laws set the minimum legal age at which a person can marry.",
    body:"In India, the age of consent for sexual activity is <b>18 years</b> under the POCSO Act — any sexual activity with a person below this age is a criminal offense regardless of apparent consent. The legal minimum marriage age is <b>18 for women and 21 for men</b> under the <b>Prohibition of Child Marriage Act, 2006</b>; child marriage is illegal and can be voided by the minor involved. <br><br><b>Internationally:</b> Many countries have raised minimum marriage age to 18 for all genders following UN and UNICEF advocacy against child marriage, though laws vary widely — it's worth checking local laws if you live outside India." },
  { icon:'auto_stories', title:'Right to Education',
    def: "<b>What it is:</b> The right to education means every child has a legal entitlement to free, quality schooling, regardless of gender, income, or background.",
    body:"India's <b>Right of Children to Free and Compulsory Education Act, 2009 (RTE Act)</b> guarantees free and compulsory education for children aged 6–14, and mandates that no child be turned away for inability to pay fees at government schools. It also requires schools to have adequate sanitation (including for menstrual hygiene) and prohibits discrimination or expulsion on discriminatory grounds. <br><br><b>Internationally:</b> the <b>UN Convention on the Rights of the Child (Article 28)</b> and <b>UNESCO's Education for All</b> initiative recognize education as a fundamental human right for every child worldwide." },
  { icon:'phonelink_lock', title:'Cyber Harassment & Online Safety',
    def: "<b>What it is:</b> Cyber harassment covers online stalking, non-consensual sharing of images, cyberbullying, and other digital abuse. Online safety laws aim to hold offenders accountable and protect victims' digital privacy.",
    body:"Under India's <b>Information Technology Act, 2000</b> (Sections 66E, 67, 67A) and provisions in the Bharatiya Nyaya Sanhita, sharing private images without consent, online stalking, and cyberbullying are punishable offenses. Complaints can be filed at the National Cyber Crime Reporting Portal (<b>cybercrime.gov.in</b>) or by dialing <b>1930</b>. <br><br><b>Internationally:</b> laws like the EU's <b>GDPR</b> (data privacy), and various national 'revenge porn' laws in the US, UK, and Australia, similarly criminalize non-consensual sharing of private content — if you're outside India, your local cybercrime unit or equivalent portal can help." },
  { icon:'real_estate_agent', title:'Property & Inheritance Rights',
    def: "<b>What it is:</b> Inheritance rights determine who legally receives property, assets, or wealth after a person's death, and whether all children — regardless of gender — have equal claim.",
    body:"The <b>Hindu Succession (Amendment) Act, 2005</b> gave daughters equal coparcenary rights to ancestral property, equal to sons, in Hindu families — a landmark reform. Muslim, Christian, and Parsi communities in India follow their own personal laws (e.g. Muslim Personal Law, Indian Succession Act) which have different inheritance structures, so it's worth understanding which law applies to your situation. <br><br><b>Internationally:</b> inheritance laws vary greatly by country and religion; the UN's <b>CEDAW (Convention on the Elimination of All Forms of Discrimination Against Women)</b> encourages member states to ensure equal inheritance rights, though implementation differs globally." },
  { icon:'directions_bus', title:'Right to Safety in Public Spaces & Transport',
    def: "<b>What it is:</b> This covers your legal right to safe, harassment-free public spaces and transport, and the legal consequences for those who violate that safety (stalking, groping, eve-teasing, etc).",
    body:"In India, <b>Section 74 & 75 of the Bharatiya Nyaya Sanhita</b> (formerly IPC Sections 354 & 509) criminalize assault or use of criminal force intending to outrage modesty, and word/gesture-based harassment, respectively. Many cities also have dedicated women's safety helplines and 'pink patrol' units. If you experience harassment in public or on transport, you can report it to nearby police, transit security, or via emergency number <b>112</b>. <br><br><b>Internationally:</b> initiatives like <b>UN Women's Safe Cities and Safe Public Spaces Programme</b> work with governments worldwide to improve public safety infrastructure and legal response to street harassment." },
  { icon:'diversity_3', title:'International Human Rights Frameworks',
    def: "<b>What it is:</b> Beyond individual national laws, there are global agreements that set baseline standards for women's rights, health, and dignity that most countries have agreed to work toward.",
    body:"Two key frameworks worth knowing: the <b>Universal Declaration of Human Rights (UDHR, 1948)</b>, which establishes basic rights to dignity, education, and non-discrimination for all people, and <b>CEDAW (1979)</b>, often called the international bill of rights for women, which India and most UN member states have ratified — committing to eliminate discrimination against women in law, education, health, employment, and family life. While these frameworks aren't directly enforceable in court like a national law, they shape and pressure national policy, and are useful reference points when advocating for your rights or understanding global standards." },
];
function renderLegal(){
  const wrap = document.getElementById('legal-accordion');
  LEGAL_TOPICS.forEach((t,i)=>{
    const item = document.createElement('div');
    item.className = 'accordion-item bg-card border border-outline-variant/30 rounded-2xl overflow-hidden reveal';
    item.innerHTML = `
      <button class="w-full flex items-center gap-4 p-5 text-left" onclick="this.parentElement.classList.toggle('open')">
        <div class="w-10 h-10 rounded-lg bg-tertiary-container flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-on-tertiary-container">${t.icon}</span></div>
        <span class="font-bold text-deep-plum flex-1">${t.title}</span>
        <span class="material-symbols-outlined chev">expand_more</span>
      </button>
      <div class="accordion-content px-5">
        <div class="pb-5 pl-14 space-y-3">
          <p class="text-sm bg-tertiary-container/20 border border-tertiary-container/30 rounded-xl p-3 text-on-surface-variant">${t.def}</p>
          <p class="text-sm text-on-surface-variant">${t.body}</p>
        </div>
      </div>`;
    wrap.appendChild(item);
  });
  revealOnScroll();
}
renderLegal();

/* ============ LEARNING ============ */
const COURSES = [
  { title:'The Art of Mindful Longevity', cat:'Mental Health', hours:12, level:'Introductory', progress: loadProgress('longevity'), desc:'Integrating ancient wisdom with modern science to enhance life quality and resilience.',
    resources: [
      { term:'Mindfulness', def:'The practice of paying deliberate, non-judgmental attention to the present moment — your thoughts, feelings, and surroundings.' },
      { term:'Resilience', def:'The ability to mentally and emotionally recover from stress, setbacks, or adversity.' },
      { term:'Longevity', def:'Living a long life — but in wellness contexts, it especially means living well for longer, with good physical and mental health.' },
      { term:'Circadian Rhythm', def:"Your body's internal 24-hour clock that regulates sleep, energy, and hormone cycles — keeping it steady supports long-term health." },
      { term:'Blue Zones', def:'Regions of the world (like Okinawa, Japan and Sardinia, Italy) where people live unusually long, healthy lives — studied for common lifestyle habits.' }
    ],
    links: [
      { label:'Harvard Health — The Science of Mindfulness', url:'https://www.health.harvard.edu/mind-and-mood' },
      { label:'Blue Zones — Lessons on Longevity', url:'https://www.bluezones.com/' },
      { label:'WHO — Ageing and Health', url:'https://www.who.int/news-room/fact-sheets/detail/ageing-and-health' }
    ],
    quiz:[
      {q:'What is a core benefit of mindfulness?', options:['Reduced stress','Faster typing','More screen time'], a:0}
    ]},
  { title:'Journaling for Inner Peace', cat:'Mental Health', hours:4, level:'Beginner', progress: loadProgress('journaling'), desc:'Use guided prompts to process emotions and build a daily reflection habit.',
    resources: [
      { term:'Journaling', def:'The practice of regularly writing down thoughts, feelings, or experiences, often used to process emotions and track personal growth.' },
      { term:'Emotional Processing', def:'Consciously acknowledging and working through feelings rather than suppressing or ignoring them.' },
      { term:'Gratitude Practice', def:'A habit of intentionally noting things you are thankful for, linked to improved mood and wellbeing.' },
      { term:'Stream of Consciousness Writing', def:'Writing continuously without editing or overthinking, letting thoughts flow freely onto the page.' },
      { term:'Prompted Journaling', def:'Using a specific question or theme (a "prompt") to guide what you write about, useful when unsure where to start.' }
    ],
    links: [
      { label:'Penzu — Guide to Journaling', url:'https://penzu.com/journaling' },
      { label:'Positive Psychology — Journaling Benefits & Prompts', url:'https://positivepsychology.com/benefits-of-journaling/' },
      { label:'Greater Good Science Center — Gratitude Practices', url:'https://ggia.berkeley.edu/' }
    ],
    quiz:[
      {q:'How often should you journal for best results?', options:['Once a year','Daily or a few times a week','Never'], a:1}
    ]},
  { title:'Foundations of Hormonal Nutrition', cat:'Nutrition', hours:8, level:'Beginner', progress: loadProgress('nutrition'), desc:'Learn how food choices interact with your cycle across all four phases.',
    resources: [
      { term:'Menstrual Phase', def:'The 3–7 days when the uterine lining sheds — the body needs extra iron and rest.' },
      { term:'Follicular Phase', def:'The phase after your period, when estrogen rises and the body prepares an egg for release.' },
      { term:'Luteal Phase', def:'The phase after ovulation and before your next period, when progesterone rises — cravings and PMS symptoms often appear here.' },
      { term:'Glycemic Index (GI)', def:'A measure of how quickly a food raises blood sugar — low-GI foods (like whole grains) release energy more steadily.' },
      { term:'Micronutrients', def:'Vitamins and minerals (like iron, magnesium, zinc) needed in small amounts but essential for hormone production and energy.' },
      { term:'Cycle Syncing', def:'The practice of adjusting diet and exercise to match the four phases of your menstrual cycle.' }
    ],
    links: [
      { label:'Harvard T.H. Chan — The Nutrition Source', url:'https://www.hsph.harvard.edu/nutritionsource/' },
      { label:'NIH — Menstrual Cycle & Nutrition', url:'https://www.nichd.nih.gov/health/topics/menstruation' },
      { label:'Healthline — Eating for Your Cycle', url:'https://www.healthline.com/health/womens-health/cycle-syncing' }
    ],
    quiz:[
      {q:'Iron-rich foods are especially useful during which phase?', options:['Menstrual phase','Ovulation','None'], a:0}
    ]},
  { title:'Restorative Yoga for Every Phase', cat:'Yoga', hours:6, level:'All Levels', progress: loadProgress('yoga'), desc:'Gentle sequences designed to support your body through each cycle phase.',
    resources: [
      { term:'Restorative Yoga', def:'A slow-paced style of yoga using supported poses held for longer periods to promote deep relaxation.' },
      { term:"Child's Pose (Balasana)", def:'A resting pose that gently stretches the lower back and hips — often used to ease period cramps.' },
      { term:'Cat-Cow Stretch', def:'A flowing movement between two poses that mobilizes the spine and can relieve lower back and abdominal tension.' },
      { term:'Supta Baddha Konasana', def:"A reclined, supported pose that opens the hips and encourages deep relaxation — commonly used during the luteal or menstrual phase." },
      { term:'Pranayama', def:'Yogic breathing exercises used to calm the nervous system and reduce stress.' }
    ],
    links: [
      { label:'Yoga Journal — Poses for Menstrual Relief', url:'https://www.yogajournal.com/' },
      { label:'Ekhart Yoga — Restorative Yoga Classes', url:'https://www.ekhartyoga.com/' },
      { label:'DoYogaWithMe — Free Yoga Videos', url:'https://www.doyogawithme.com/' }
    ],
    quiz:[
      {q:"Child's Pose is best used for:", options:['High intensity training','Rest and gentle stretching','Sprinting'], a:1}
    ]},
  { title:'Know Your Financial Basics', cat:'Life Skills', hours:5, level:'Beginner', progress: loadProgress('finance'), desc:'Budgeting, saving, and understanding your first payslip — practical money skills.',
    resources: [
      { term:'Budget', def:'A plan for how you will spend and save your money over a period of time, based on your income.' },
      { term:'Emergency Fund', def:'Money set aside specifically for unexpected expenses, like medical bills or urgent repairs.' },
      { term:'Compound Interest', def:'Interest calculated on both the original amount saved/invested and the interest already earned — it helps savings grow faster over time.' },
      { term:'Gross vs Net Pay', def:'Gross pay is your total earnings before deductions; net pay is what you actually receive after taxes and other deductions.' },
      { term:'Credit Score', def:'A number representing your creditworthiness, based on your history of borrowing and repaying money — it affects loan and credit card approvals.' }
    ],
    links: [
      { label:'Investopedia — Personal Finance Basics', url:'https://www.investopedia.com/personal-finance-4427760' },
      { label:'RBI — Financial Education Resources', url:'https://rbi.org.in/FinancialEducation/Home.aspx' },
      { label:'Khan Academy — Personal Finance Course', url:'https://www.khanacademy.org/college-careers-more/personal-finance' }
    ],
    quiz:[
      {q:'A budget helps you:', options:['Spend randomly','Track and plan spending','Avoid saving'], a:1}
    ]},
  { title:'Mindful Parenting in the Digital Age', cat:'Mental Health', hours:7, level:'Intermediate', progress: loadProgress('parenting'), desc:'Balancing screen time, communication and connection with children today.',
    resources: [
      { term:'Active Listening', def:"Fully concentrating on, understanding, and responding thoughtfully to what someone is saying, rather than passively hearing them." },
      { term:'Screen Time Balance', def:'Managing digital device use so it supports, rather than replaces, in-person connection, sleep, and other activities.' },
      { term:'Digital Wellbeing', def:"A person's overall mental and physical health as it's affected by their relationship with technology and devices." },
      { term:'Co-viewing', def:'Watching or engaging with digital content together with a child, to guide understanding and open conversation.' },
      { term:'Digital Footprint', def:'The trail of data a person leaves behind from their online activity — an important concept to teach children early.' }
    ],
    links: [
      { label:'American Academy of Pediatrics — Media & Children', url:'https://www.healthychildren.org/English/family-life/Media/Pages/default.aspx' },
      { label:'Common Sense Media — Parenting Guides', url:'https://www.commonsensemedia.org/' },
      { label:'UNICEF — Digital Parenting Resources', url:'https://www.unicef.org/parenting/digital-age' }
    ],
    quiz:[
      {q:'A key part of mindful parenting is:', options:['Ignoring the child','Active listening','Strict screen bans only'], a:1}
    ]},
];
function progKey(id){ return 'harmony-course-'+id; }
function loadProgress(id){ return loadJSON(progKey(id), 0); }
function courseId(title){ return title.toLowerCase().replace(/[^a-z]+/g,'-'); }

let currentFilter = 'All';
function renderCourses(){
  const grid = document.getElementById('course-grid');
  grid.innerHTML = '';
  COURSES.filter(c=>currentFilter==='All' || c.cat===currentFilter).forEach(c=>{
    const id = courseId(c.title);
    const progress = loadJSON(progKey(id), 0);
    const card = document.createElement('div');
    card.className = 'glass-card rounded-2xl p-6 flex flex-col reveal';
    card.innerHTML = `
      <span class="inline-block w-fit px-3 py-1 bg-primary-container text-on-primary-container text-xs rounded-full mb-3">${c.cat}</span>
      <h3 class="text-lg font-bold text-deep-plum mb-2">${c.title}</h3>
      <p class="text-sm text-on-surface-variant mb-4 flex-1">${c.desc}</p>
      <p class="text-xs text-on-surface-variant mb-1 flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span> ${c.hours} hours · ${c.level}</p>
      <div class="mb-3">
        <div class="flex justify-between text-xs mb-1"><span>Progress</span><span>${progress}%</span></div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%;"></div></div>
      </div>
      <div class="flex gap-2">
        <button class="flex-1 px-4 py-2.5 rounded-full font-bold text-sm border border-outline-variant hover:bg-primary-container/20 transition-all" onclick="openResources('${id}')">📖 Resources</button>
        <button class="enroll-btn flex-1 px-4 py-2.5 rounded-full font-bold text-sm" onclick="openQuiz('${id}')">${progress>=100?'Review Quiz':'Start Quiz'}</button>
      </div>`;
    grid.appendChild(card);
  });
  revealOnScroll();
}
document.getElementById('course-filters').addEventListener('click',(e)=>{
  const btn = e.target.closest('.filter-btn');
  if(!btn) return;
  currentFilter = btn.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(b=>{
    b.classList.remove('bg-primary','on-primary');
    b.classList.add('bg-glass','border','border-outline-variant');
  });
  btn.classList.add('bg-primary','on-primary');
  btn.classList.remove('bg-glass','border','border-outline-variant');
  renderCourses();
});
renderCourses();

function openResources(id){
  const course = COURSES.find(c=>courseId(c.title)===id);
  if(!course) return;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-6';
  modal.innerHTML = `
    <div class="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto chat-scrollbar">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-lg font-bold text-deep-plum">${course.title}</h3>
        <button class="text-on-surface-variant" onclick="this.closest('.fixed').remove()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <p class="text-sm text-on-surface-variant mb-4">${course.desc}</p>
      <h4 class="text-xs font-bold uppercase tracking-wide text-primary mb-2">Key Terms & Explanations</h4>
      <div class="space-y-3 mb-5">
        ${course.resources.map(r=>`
          <div class="bg-primary-container/10 border border-primary-container/30 rounded-xl p-3">
            <p class="font-bold text-sm text-deep-plum">${r.term}</p>
            <p class="text-sm text-on-surface-variant mt-1">${r.def}</p>
          </div>`).join('')}
      </div>
      <h4 class="text-xs font-bold uppercase tracking-wide text-tertiary mb-2">Further Reading</h4>
      <div class="space-y-2 mb-5">
        ${(course.links||[]).map(l=>`
          <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 bg-tertiary-container/15 border border-tertiary-container/30 rounded-xl p-3 text-sm text-on-tertiary-container hover:bg-tertiary-container/25 transition-all">
            <span class="material-symbols-outlined text-base">open_in_new</span> ${l.label}
          </a>`).join('')}
      </div>
      <button class="w-full bg-primary on-primary py-2.5 rounded-full font-bold text-sm" onclick="this.closest('.fixed').remove(); openQuiz('${id}')">Take the Quiz →</button>
    </div>`;
  document.body.appendChild(modal);
}
function openQuiz(id){
  const course = COURSES.find(c=>courseId(c.title)===id);
  if(!course) return;
  const q = course.quiz[0];
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-6';
  modal.innerHTML = `
    <div class="bg-card rounded-2xl p-6 max-w-md w-full">
      <h3 class="text-lg font-bold text-deep-plum mb-4">${course.title} — Quick Quiz</h3>
      <p class="mb-4 text-sm font-semibold">${q.q}</p>
      <div class="space-y-2 mb-4" id="quiz-opts">
        ${q.options.map((o,i)=>`<button class="quiz-opt w-full text-left px-4 py-2 rounded-xl border border-outline-variant hover:bg-primary-container/20" data-i="${i}">${o}</button>`).join('')}
      </div>
      <button class="text-xs text-on-surface-variant" onclick="this.closest('.fixed').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('.quiz-opt').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const correct = Number(btn.dataset.i) === q.a;
      const current = loadJSON(progKey(id),0);
      const next = Math.min(100, current + (correct?34:10));
      saveJSON(progKey(id), next);
      modal.querySelector('#quiz-opts').innerHTML = `<p class="text-sm font-semibold ${correct?'text-tertiary':'text-error'}">${correct?'✓ Correct! Progress updated.':'Not quite — but progress ticked up a little. Keep learning!'}</p>`;
      setTimeout(()=>{ modal.remove(); renderCourses(); }, 1200);
    });
  });
}

/* ============ COMMUNITY: INTEREST CATALOG ============ */
const INTEREST_CATEGORIES = [
  { key:'cooking', label:'Cooking', icon:'ramen_dining', color:'var(--primary-container)' },
  { key:'health', label:'Health', icon:'fitness_center', color:'var(--tertiary-container)' },
  { key:'cleaning', label:'Cleaning', icon:'cleaning_services', color:'var(--secondary-container)' },
  { key:'art', label:'Art & Drawing', icon:'palette', color:'var(--primary-container)' },
  { key:'stitching', label:'Stitching', icon:'content_cut', color:'var(--tertiary-container)' },
  { key:'portfolio', label:'Portfolio Building', icon:'work_history', color:'var(--secondary-container)' },
  { key:'skill', label:'Skill Building', icon:'auto_awesome', color:'var(--primary-container)' },
  { key:'webdev', label:'Web/App Development', icon:'code', color:'var(--tertiary-container)' },
  { key:'ornaments', label:'Handmade Ornaments', icon:'diamond', color:'var(--secondary-container)' },
  { key:'crochet', label:'Crocheting', icon:'texture', color:'var(--primary-container)' },
  { key:'finance', label:'Financial Learning', icon:'account_balance', color:'var(--tertiary-container)' },
  { key:'expenses', label:'Managing Expenses', icon:'payments', color:'var(--secondary-container)' },
  { key:'writing', label:'Writing', icon:'edit_note', color:'var(--primary-container)' },
  { key:'reading', label:'Reading', icon:'menu_book', color:'var(--tertiary-container)' },
];

const LEARNER_ITEMS = {
  cooking: [
    { title:'Home Baking Basics', desc:'Learn to bake bread, cookies and cakes from scratch with simple pantry ingredients.', link:'https://www.bbcgoodfood.com/recipes/collection/baking-recipes' },
    { title:'Regional Cuisine Mastery', desc:'Explore traditional recipes and techniques from different regional cuisines.', link:'https://www.bbcgoodfood.com/recipes/collection/indian-recipes' }
  ],
  health: [
    { title:'Beginner Fitness & Stretching', desc:'Simple daily routines to build strength, flexibility and better posture.', link:'https://www.nhs.uk/live-well/exercise/' },
    { title:'Understanding Nutrition Basics', desc:'Learn the fundamentals of a balanced diet and reading food labels.', link:'https://www.who.int/news-room/fact-sheets/detail/healthy-diet' }
  ],
  cleaning: [
    { title:'Home Organization 101', desc:'Declutter and organize your living space room by room, efficiently.', link:'https://www.youtube.com/results?search_query=home+organization+for+beginners' },
    { title:'Eco-Friendly Cleaning', desc:'Make your own effective, non-toxic cleaning products at home.', link:'https://www.epa.gov/saferchoice' }
  ],
  art: [
    { title:'Sketching for Beginners', desc:'Learn pencil sketching fundamentals — shapes, shading and proportion.', link:'https://www.skillshare.com/en/browse/drawing' },
    { title:'Watercolor Painting Basics', desc:'Explore brush techniques and color blending for vibrant watercolor art.', link:'https://www.domestika.org/en/courses/topic/54-illustration' }
  ],
  stitching: [
    { title:'Basic Hand Stitching', desc:'Learn essential hand-stitching techniques for repairs and simple projects.', link:'https://www.youtube.com/results?search_query=basic+hand+stitching+for+beginners' },
    { title:'Sewing Machine Essentials', desc:'Get comfortable using a sewing machine to stitch your own garments.', link:'https://www.craftsy.com/' }
  ],
  portfolio: [
    { title:'Design Portfolio Basics', desc:'Curate and present your creative work professionally online.', link:'https://www.behance.net/' },
    { title:'Resume & LinkedIn Building', desc:'Build a resume and online presence that stands out to recruiters.', link:'https://www.linkedin.com/learning/' }
  ],
  skill: [
    { title:'Public Speaking Basics', desc:'Overcome stage fright and communicate confidently in any setting.', link:'https://www.toastmasters.org/' },
    { title:'Time Management Skills', desc:'Learn practical productivity frameworks to get more done calmly.', link:'https://www.coursera.org/courses?query=time%20management' }
  ],
  webdev: [
    { title:'HTML, CSS & JS Basics', desc:'Start building your own websites from scratch, step by step.', link:'https://www.freecodecamp.org/' },
    { title:'Intro to App Development', desc:'Learn the fundamentals of building mobile apps for Android or iOS.', link:'https://developer.android.com/courses' }
  ],
  ornaments: [
    { title:'Beaded Jewelry Making', desc:'Create beautiful beaded necklaces, earrings and bracelets at home.', link:'https://www.youtube.com/results?search_query=beaded+jewelry+making+for+beginners' },
    { title:'Clay Ornament Crafting', desc:'Sculpt and paint decorative clay ornaments and charms.', link:'https://www.craftsy.com/' }
  ],
  crochet: [
    { title:'Crochet for Beginners', desc:'Learn basic stitches and simple patterns to start your first project.', link:'https://www.yarnspirations.com/pages/how-to-crochet' },
    { title:'Amigurumi Basics', desc:'Craft cute crocheted toys and figures using simple stitches.', link:'https://www.ravelry.com/' }
  ],
  finance: [
    { title:'Personal Finance 101', desc:'Understand saving, investing, taxes and building long-term wealth.', link:'https://www.investopedia.com/' },
    { title:'Intro to Stock Markets', desc:'Learn the basics of how stock markets and investing work.', link:'https://www.nseindia.com/' }
  ],
  expenses: [
    { title:'Monthly Budgeting Basics', desc:'Track and plan your monthly expenses without feeling restricted.', link:'https://www.investopedia.com/personal-finance-4427760' },
    { title:'Smart Saving Habits', desc:'Practical, realistic tips to save consistently every month.', link:'https://www.consumerfinance.gov/consumer-tools/educator-tools/your-money-your-goals/' }
  ],
  writing: [
    { title:'Creative Writing Basics', desc:'Learn storytelling structure, character building and creative expression.', link:'https://www.masterclass.com/articles/creative-writing-101' },
    { title:'Content Writing for Beginners', desc:'Learn to write engaging content for blogs and social media.', link:'https://www.coursera.org/courses?query=content%20writing' }
  ],
  reading: [
    { title:'Building a Reading Habit', desc:'Practical tips to read more consistently and actually enjoy it.', link:'https://www.goodreads.com/' },
    { title:'Starting a Book Club', desc:'Learn how to start or join a book club with friends or online.', link:'https://www.goodreads.com/group' }
  ],
};

const BUSINESS_ITEMS = {
  cooking: [
    { business:'Spice Route Culinary Studio', title:'Professional Baking Certification', desc:'12-week hands-on program covering breads, pastries and cake artistry — includes a business starter kit for home bakers.', price:'₹8,999', duration:'12 weeks', link:'https://www.udemy.com/topic/baking/' },
    { business:'Urban Kitchen Collective', title:'Weekend Regional Cuisine Workshops', desc:'Live weekend workshops on regional cuisines, taught by practicing chefs, with recipe cards included.', price:'₹1,499 / session', duration:'3 hours', link:'https://www.eventbrite.com/d/online/cooking-classes/' }
  ],
  health: [
    { business:'Vitality Wellness Co.', title:'8-Week Fitness Foundations Program', desc:'A structured beginner fitness program with live trainer check-ins and progress tracking.', price:'₹3,499', duration:'8 weeks', link:'https://www.classpass.com/' },
    { business:'NutriWell Clinic', title:'Nutrition Fundamentals Workshop', desc:'A dietician-led course on building sustainable, balanced eating habits.', price:'₹2,199', duration:'4 sessions', link:'https://www.coursera.org/courses?query=nutrition' }
  ],
  cleaning: [
    { business:'TidyHome Academy', title:'Home Organization Business Certificate', desc:'Learn organizing systems well enough to declutter for clients — includes a starter business toolkit.', price:'₹4,999', duration:'6 weeks', link:'https://www.udemy.com/topic/home-organization/' },
    { business:'GreenClean Co.', title:'Eco-Cleaning Product Making Workshop', desc:'Learn to make and sell non-toxic cleaning products from home.', price:'₹999', duration:'1 day', link:'https://www.epa.gov/saferchoice' }
  ],
  art: [
    { business:'Canvas & Co. Studio', title:'Sketching to Selling: Artist Bootcamp', desc:'From beginner sketching techniques to setting up your own online art shop.', price:'₹5,499', duration:'10 weeks', link:'https://www.domestika.org/en/courses/topic/54-illustration' },
    { business:'Paletteworks Academy', title:'Watercolor Mastery Workshop', desc:'Intensive watercolor techniques taught by professional illustrators.', price:'₹2,999', duration:'5 sessions', link:'https://www.skillshare.com/en/browse/drawing' }
  ],
  stitching: [
    { business:'StitchCraft Studio', title:'Tailoring Basics for Small Business', desc:'Learn garment stitching well enough to start taking client orders.', price:'₹6,499', duration:'8 weeks', link:'https://www.craftsy.com/' },
    { business:'SewSimple Classes', title:'Weekend Sewing Machine Workshop', desc:'Hands-on sessions to master your sewing machine from scratch.', price:'₹1,299 / session', duration:'2 sessions', link:'https://www.youtube.com/results?search_query=sewing+machine+workshop' }
  ],
  portfolio: [
    { business:'CreativeEdge Consulting', title:'Design Portfolio Building Sprint', desc:'A 4-week sprint to build a job-ready design portfolio with mentor feedback.', price:'₹4,499', duration:'4 weeks', link:'https://www.behance.net/' },
    { business:'CareerLaunch Pro', title:'Resume & LinkedIn Optimization Package', desc:'One-on-one sessions to rebuild your resume and LinkedIn for visibility.', price:'₹2,999', duration:'2 sessions', link:'https://www.linkedin.com/learning/' }
  ],
  skill: [
    { business:'SpeakWell Institute', title:'Public Speaking Mastery Course', desc:'Small-group live coaching to build stage confidence and clear delivery.', price:'₹3,999', duration:'6 weeks', link:'https://www.toastmasters.org/' },
    { business:'ProductivityPath Coaching', title:'Time Management Intensive', desc:'A practical course on planning systems used by working professionals.', price:'₹1,999', duration:'3 sessions', link:'https://www.coursera.org/courses?query=time%20management' }
  ],
  webdev: [
    { business:'CodeForward Academy', title:'Full-Stack Web Development Bootcamp', desc:'From HTML/CSS basics to deploying a full working website, project-based.', price:'₹12,999', duration:'14 weeks', link:'https://www.freecodecamp.org/' },
    { business:'AppCraft Labs', title:'Intro to Mobile App Development', desc:'Build and publish your first simple mobile app with mentor support.', price:'₹9,499', duration:'10 weeks', link:'https://developer.android.com/courses' }
  ],
  ornaments: [
    { business:'GlimmerCraft Studio', title:'Jewelry Making for Small Business', desc:'Learn beaded and wire jewelry techniques plus how to price and sell your pieces.', price:'₹3,499', duration:'5 weeks', link:'https://www.craftsy.com/' },
    { business:'ClayTales Workshop', title:'Clay Ornament Business Starter', desc:'Sculpting, painting and packaging clay ornaments ready for markets.', price:'₹2,799', duration:'4 sessions', link:'https://www.youtube.com/results?search_query=clay+ornament+business' }
  ],
  crochet: [
    { business:'YarnHouse Academy', title:'Crochet Business Starter Course', desc:'From basic stitches to pricing and selling finished crochet pieces online.', price:'₹2,499', duration:'6 weeks', link:'https://www.yarnspirations.com/pages/how-to-crochet' },
    { business:'Amigurumi Collective', title:'Amigurumi Toy-Making Workshop', desc:'Learn to craft sellable crocheted toys with guided patterns.', price:'₹1,799', duration:'4 sessions', link:'https://www.ravelry.com/' }
  ],
  finance: [
    { business:'WealthWise Advisors', title:'Personal Finance Mastery Course', desc:'A practical course on saving, investing and long-term wealth planning.', price:'₹4,999', duration:'6 weeks', link:'https://www.investopedia.com/' },
    { business:'MarketReady Academy', title:'Stock Market Fundamentals', desc:'Learn how markets work and how to start investing responsibly.', price:'₹3,999', duration:'5 sessions', link:'https://www.nseindia.com/' }
  ],
  expenses: [
    { business:'BudgetSmart Coaching', title:'Monthly Budgeting Workshop', desc:'Hands-on templates and coaching to plan and track your expenses.', price:'₹1,499', duration:'3 sessions', link:'https://www.consumerfinance.gov/consumer-tools/educator-tools/your-money-your-goals/' },
    { business:'SaveSteady Program', title:'Building Smart Saving Habits', desc:'A guided program to build automatic, sustainable saving habits.', price:'₹1,199', duration:'4 weeks', link:'https://www.investopedia.com/personal-finance-4427760' }
  ],
  writing: [
    { business:'InkWell Writers Studio', title:'Creative Writing Certificate', desc:'Structured feedback-driven course on storytelling and creative craft.', price:'₹3,999', duration:'8 weeks', link:'https://www.masterclass.com/articles/creative-writing-101' },
    { business:'ContentPro Academy', title:'Content Writing for Freelancers', desc:'Learn to write for blogs and brands, with real client-style briefs.', price:'₹4,499', duration:'6 weeks', link:'https://www.coursera.org/courses?query=content%20writing' }
  ],
  reading: [
    { business:'ReadersCircle Co.', title:'Guided Reading Habit Program', desc:'A month-long guided program with curated book lists and check-ins.', price:'₹999', duration:'4 weeks', link:'https://www.goodreads.com/' },
    { business:'BookClub Connect', title:'Start Your Own Book Club Kit', desc:'Templates, discussion guides and community support to launch a book club.', price:'₹599', duration:'Self-paced', link:'https://www.goodreads.com/group' }
  ],
};

let activeInterestFilter = { learner:'all', business:'all' };
function renderInterestFilters(mode){
  const wrap = document.getElementById('interest-filters-'+mode);
  if(!wrap) return;
  wrap.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'interest-filter-btn flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-outline-variant transition-all' + (activeInterestFilter[mode]==='all' ? ' bg-primary on-primary' : ' bg-glass');
  allBtn.innerHTML = `<span class="material-symbols-outlined text-sm">apps</span> All`;
  allBtn.onclick = ()=>{ activeInterestFilter[mode]='all'; renderInterestFilters(mode); renderInterestGrid(mode); };
  wrap.appendChild(allBtn);
  INTEREST_CATEGORIES.forEach(cat=>{
    const btn = document.createElement('button');
    const active = activeInterestFilter[mode]===cat.key;
    btn.className = 'interest-filter-btn flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-outline-variant transition-all' + (active ? ' bg-primary on-primary' : ' bg-glass');
    btn.innerHTML = `<span class="material-symbols-outlined text-sm">${cat.icon}</span> ${cat.label}`;
    btn.onclick = ()=>{ activeInterestFilter[mode]=cat.key; renderInterestFilters(mode); renderInterestGrid(mode); };
    wrap.appendChild(btn);
  });
}
function renderInterestGrid(mode){
  const grid = document.getElementById('interest-grid-'+mode);
  if(!grid) return;
  grid.innerHTML = '';
  const filter = activeInterestFilter[mode];
  const cats = filter==='all' ? INTEREST_CATEGORIES : INTEREST_CATEGORIES.filter(c=>c.key===filter);
  const dataSource = mode==='learner' ? LEARNER_ITEMS : BUSINESS_ITEMS;
  cats.forEach(cat=>{
    (dataSource[cat.key]||[]).forEach(item=>{
      const card = document.createElement('div');
      card.className = 'glass-card rounded-2xl p-5 cursor-pointer relative overflow-hidden reveal in';
      card.innerHTML = `
        <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-40" style="background-color:${cat.color};"></div>
        <div class="relative z-10">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style="background-color:${cat.color};">
            <span class="material-symbols-outlined fill" style="color:var(--on-surface);">${cat.icon}</span>
          </div>
          <span class="inline-block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-1">${cat.label}${mode==='business' ? ' · Business' : ''}</span>
          <h3 class="text-base font-bold text-deep-plum mb-1">${item.title}</h3>
          ${mode==='business' ? `<p class="text-xs font-semibold text-primary mb-1">${item.business}</p>` : ''}
          <p class="text-sm text-on-surface-variant line-clamp-3">${item.desc}</p>
          ${mode==='business' ? `<div class="flex items-center gap-3 mt-3 text-xs font-bold text-on-surface-variant"><span>💰 ${item.price}</span><span>⏱ ${item.duration}</span></div>` : ''}
        </div>`;
      card.addEventListener('click', ()=>openInterestModal(cat, item, mode));
      grid.appendChild(card);
    });
  });
  revealOnScroll();
}
function openInterestModal(cat, item, mode){
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-6';
  modal.innerHTML = `
    <div class="bg-card rounded-2xl p-6 max-w-md w-full relative overflow-hidden">
      <div class="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-30" style="background-color:${cat.color};"></div>
      <div class="relative z-10">
        <div class="flex justify-between items-start mb-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center" style="background-color:${cat.color};"><span class="material-symbols-outlined fill" style="color:var(--on-surface);">${cat.icon}</span></div>
          <button class="text-on-surface-variant" onclick="this.closest('.fixed').remove()"><span class="material-symbols-outlined">close</span></button>
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">${cat.label}${mode==='business' ? ' · Business Listing' : ''}</span>
        <h3 class="text-xl font-bold text-deep-plum mt-1 mb-1">${item.title}</h3>
        ${mode==='business' ? `<p class="text-sm font-semibold text-primary mb-2">Offered by ${item.business}</p>` : ''}
        <p class="text-sm text-on-surface-variant mb-4">${item.desc}</p>
        ${mode==='business' ? `<div class="flex items-center gap-4 mb-4 text-sm font-bold"><span class="bg-tertiary-container/30 text-on-tertiary-container px-3 py-1 rounded-full">💰 ${item.price}</span><span class="bg-secondary-container/30 text-on-secondary-container px-3 py-1 rounded-full">⏱ ${item.duration}</span></div>` : ''}
        <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="w-full bg-primary on-primary py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-base">open_in_new</span> ${mode==='business' ? 'Enroll / Learn More' : 'Take This Class Online'}
        </a>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
renderInterestFilters('learner');
renderInterestGrid('learner');
renderInterestFilters('business');
renderInterestGrid('business');

/* ============ COMMUNITY ============ */
function switchCommunityTab(tab){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active-tab', b.dataset.tab===tab));
  document.getElementById('community-learner').classList.toggle('hidden', tab!=='learner');
  document.getElementById('community-business').classList.toggle('hidden', tab!=='business');
}
const DEFAULT_POSTS = {
  learner: [
    { name:'Amara', avatar:'🎨', text:'Just finished my first watercolor painting! Any tips on shading?', time:'2h ago' },
    { name:'Riya', avatar:'📚', text:'Looking for a study buddy for the Nutrition course — anyone in?', time:'5h ago' },
  ],
  business: [
    { name:'GreenLeaf Studio', avatar:'🌿', text:'We are offering 3 design internships this month — open to portfolio submissions!', time:'1d ago' },
    { name:'CraftHer Co.', avatar:'🧵', text:'Looking for handmade jewelry makers to feature in our next pop-up market.', time:'3d ago' },
  ]
};
let posts = loadJSON('harmony-posts', DEFAULT_POSTS);
function renderFeed(mode){
  const feed = document.getElementById('feed-'+mode);
  feed.innerHTML = '';
  posts[mode].forEach(p=>{
    const div = document.createElement('div');
    div.className = 'bg-card border border-outline-variant/20 rounded-2xl p-4 flex gap-3 reveal in';
    div.innerHTML = `
      <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0" style="background-color:var(--secondary-container);">${p.avatar}</div>
      <div class="flex-1">
        <div class="flex items-center gap-2"><span class="font-bold text-sm">${p.name}</span><span class="text-xs text-on-surface-variant">${p.time}</span></div>
        <p class="text-sm mt-1">${p.text}</p>
        <div class="flex gap-4 mt-2 text-xs text-on-surface-variant">
          <button class="hover:text-primary flex items-center gap-1"><span class="material-symbols-outlined text-sm">favorite</span> Like</button>
          <button class="hover:text-primary flex items-center gap-1"><span class="material-symbols-outlined text-sm">chat_bubble</span> Reply</button>
        </div>
      </div>`;
    feed.appendChild(div);
  });
}
function addPost(evt, mode){
  evt.preventDefault();
  const form = evt.target;
  const input = form.querySelector('input');
  const text = input.value.trim();
  if(!text) return false;
  posts[mode].unshift({ name:'You', avatar: mode==='learner'?'🌸':'🏢', text, time:'just now' });
  saveJSON('harmony-posts', posts);
  input.value = '';
  renderFeed(mode);
  return false;
}
renderFeed('learner');
renderFeed('business');
