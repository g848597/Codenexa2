/* =========================================================================
   SUPABASE КЛИЕНТ
   Заполните своими значениями из Project Settings → API в Supabase Dashboard.
   SUPABASE_ANON_KEY — это публичный (anon) ключ, его можно спокойно
   держать во фронтенд-коде: реальная защита данных обеспечивается RLS-
   политиками в базе, а не секретностью этого ключа.
   ========================================================================= */
const SUPABASE_URL = 'https://temjwwglowbuarxuixpa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6kcF4N5DLCpLMSoaPDNmgQ_LHFDFZUq';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Надёжный fallback: лендинг не должен ломаться, если Supabase временно недоступен. */
const FALLBACK_SERVICES = [
  {id:'fallback-lash-lamination', category:'Ресницы', name:'Ламинирование ресниц', description:'Подчёркивает природную красоту, делает взгляд выразительнее и ухоженнее.', price:8500, duration:60, image:'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?q=80&w=1000&auto=format&fit=crop', active:true},
  {id:'fallback-brow-correction', category:'Брови', name:'Коррекция формы', description:'Подбор идеальной формы с учётом особенностей лица.', price:3000, duration:30, image:'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop', active:true},
  {id:'fallback-brow-color', category:'Брови', name:'Окрашивание + коррекция', description:'Насыщенный цвет и идеальная форма для выразительного взгляда.', price:6000, duration:45, image:'https://images.unsplash.com/photo-1512207736890-6ffe237ff9c8?q=80&w=1000&auto=format&fit=crop', active:true},
  {id:'fallback-complex', category:'Комплекс', name:'Ламинирование + коррекция', description:'Комплекс для естественного объёма и идеальной формы.', price:7000, duration:75, image:'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?q=80&w=1000&auto=format&fit=crop', active:true},
  {id:'fallback-complex-full', category:'Комплекс', name:'Ламинирование + окрашивание + коррекция', description:'Максимальный эффект для идеального взгляда каждый день.', price:8000, duration:90, image:'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?q=80&w=1000&auto=format&fit=crop', active:true},
  {id:'fallback-waxing', category:'Дополнительно', name:'Ваксинг', description:'Бережное удаление лишних волосков для гладкой кожи.', price:500, duration:15, image:'https://images.unsplash.com/photo-1596704017254-9b121068fb31?q=80&w=1000&auto=format&fit=crop', active:true}
];
const FALLBACK_WORKING_HOURS = [
  {day:1,label:'Понедельник',start:'09:00',end:'19:00',is_working:true},
  {day:2,label:'Вторник',start:'09:00',end:'19:00',is_working:true},
  {day:3,label:'Среда',start:'09:00',end:'19:00',is_working:true},
  {day:4,label:'Четверг',start:'09:00',end:'19:00',is_working:true},
  {day:5,label:'Пятница',start:'09:00',end:'19:00',is_working:true},
  {day:6,label:'Суббота',start:'10:00',end:'16:00',is_working:true},
  {day:0,label:'Воскресенье',start:'',end:'',is_working:false}
];
function imageFallback(img, fallback){
  if(img && fallback && img.dataset.fallbackApplied) return;
  if(img) img.dataset.fallbackApplied='1';
  if(img && fallback) img.src=fallback;
}
function setMainPhotos(services){
  const photos=(services||[]).map(s=>s.image).filter(Boolean);
  if(!photos.length) return;
  const hero=document.querySelector('.hero-media img');
  const about=document.querySelector('.about-media img');
  if(hero){ hero.src=photos[0]; hero.onerror=()=>imageFallback(hero, photos[1]||photos[0]); }
  if(about){ about.src=photos[1]||photos[0]; about.onerror=()=>imageFallback(about, photos[0]); }
}

/* =========================================================================
   DATA LAYER
   Тот же набор методов DB.*, что был в demo-версии на localStorage,
   но теперь каждый метод — асинхронный вызов Supabase. Сигнатуры почти
   не изменились (просто нужно await), чтобы остальной код меньше менялся.
   ========================================================================= */
window.addEventListener('error', (e)=>{
  console.error('Глобальная ошибка на странице:', e.message, 'в', e.filename+':'+e.lineno);
});
window.addEventListener('unhandledrejection', (e)=>{
  console.error('Необработанная ошибка промиса:', e.reason);
});

function uid(){ return crypto.randomUUID(); }

function unwrap(promise, label){
  return promise.then(({data, error})=>{
    if(error){ console.error(label, error); throw error; }
    return data;
  });
}

const DB = {
  async get(table){ return unwrap(supabase.from(table).select('*'), table); },

  async add(table, item){
    // id/created_at генерируются базой — не передаём их с клиента
    const { id, created_at, ...rest } = item;
    const rows = await unwrap(supabase.from(table).insert(rest).select(), 'add:'+table);
    return rows[0];
  },

  async update(table, id, patch){
    const rows = await unwrap(supabase.from(table).update(patch).eq('id', id).select(), 'update:'+table);
    return rows[0];
  },

  async remove(table, id){
    await unwrap(supabase.from(table).delete().eq('id', id), 'remove:'+table);
  },

  async getSettings(){
    const rows = await unwrap(supabase.from('settings').select('*'), 'settings');
    const obj = {};
    rows.forEach(r=>{ obj[r.key] = r.value; });
    return obj;
  },

  async setSettings(patch){
    const rows = Object.entries(patch).map(([key,value])=>({key, value:String(value)}));
    await unwrap(supabase.from('settings').upsert(rows), 'setSettings');
  },

  async getWorkingHours(){
    const rows = await unwrap(supabase.from('working_hours').select('*').order('day_of_week'), 'working_hours');
    // приводим к прежним именам полей (day/start/end), которыми пользуется остальной код
    return rows.map(w=>({day:w.day_of_week, label:w.label, start:w.start_time?w.start_time.slice(0,5):'', end:w.end_time?w.end_time.slice(0,5):'', is_working:w.is_working}));
  },

  async setWorkingHours(wh){
    const rows = wh.map(w=>({day_of_week:w.day, label:w.label, start_time:w.start||null, end_time:w.end||null, is_working:w.is_working}));
    await unwrap(supabase.from('working_hours').upsert(rows, {onConflict:'day_of_week'}), 'setWorkingHours');
  }
};

/* Вызов Edge Function get-available-slots — единственный источник правды
   о занятости времени (данные о bookings клиенту напрямую недоступны). */
async function fetchAvailableSlots(dateStr, serviceId){
  const { data, error } = await supabase.functions.invoke('get-available-slots', {
    body: { date: dateStr, service_id: serviceId }
  });
  if(error){
    console.error('get-available-slots', error);
    throw new Error('BOOKING_FUNCTION_UNAVAILABLE');
  }
  if(data && data.error){
    console.error('get-available-slots:', data.error);
    throw new Error(data.error);
  }
  return (data && data.slots) || [];
}

/* =========================================================================
   HELPERS
   ========================================================================= */
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toast._tm); toast._tm=setTimeout(()=>t.classList.remove('show'),2400);
}

/* =========================================================================
   ВРЕМЕННАЯ ПАНЕЛЬ ОТЛАДКИ (для диагностики с телефона, без F12)
   Показывает на экране последние ошибки. Убрать после того, как всё
   заработает — просто удалить этот блок и вызовы debugLog(...).
   ========================================================================= */
function debugLog(msg){
  try{
    let panel = document.getElementById('debug-panel');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'debug-panel';
      panel.style.cssText = 'position:fixed; left:8px; right:8px; bottom:8px; max-height:40vh; overflow:auto; background:#000; color:#0f0; font:11px/1.4 monospace; padding:10px; border-radius:8px; z-index:99999; white-space:pre-wrap; word-break:break-all; box-shadow:0 0 0 2px #333;';
      const closeBtn = document.createElement('div');
      closeBtn.textContent = '✕ закрыть отладку';
      closeBtn.style.cssText = 'color:#f66; text-align:right; cursor:pointer; margin-bottom:6px;';
      closeBtn.onclick = ()=>panel.remove();
      panel.appendChild(closeBtn);
      document.body.appendChild(panel);
    }
    const line = document.createElement('div');
    line.style.borderTop = '1px solid #333';
    line.style.paddingTop = '4px';
    line.style.marginTop = '4px';
    line.textContent = '['+new Date().toLocaleTimeString()+'] '+msg;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  }catch(e){ /* если даже это упало — молчим */ }
}
window.addEventListener('error', (e)=>{
  debugLog('ГЛОБАЛЬНАЯ ОШИБКА: '+e.message+' ('+e.filename+':'+e.lineno+')');
});
window.addEventListener('unhandledrejection', (e)=>{
  debugLog('НЕОБРАБОТАННЫЙ ПРОМИС: '+(e.reason && e.reason.message ? e.reason.message : JSON.stringify(e.reason)));
});
function fmtMoney(n){ return n.toLocaleString('ru-RU')+' ₸'; }
function pad(n){ return n<10?'0'+n:''+n; }
function ymd(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function timeToMin(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function minToTime(m){ return pad(Math.floor(m/60))+':'+pad(m%60); }
const MONTHS_RU=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_RU_NOM=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DOW_RU=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function fmtDateFull(d){ return d.getDate()+' '+MONTHS_RU[d.getMonth()]+' '+d.getFullYear(); }

/* slot generation: теперь делегируем расчёт на сервер (Edge Function),
   т.к. таблица bookings клиенту напрямую недоступна (RLS). */
async function getAvailableSlots(dateStr, durationMin, serviceId){
  return fetchAvailableSlots(dateStr, serviceId || (Booking.service && Booking.service.id));
}

async function isDayFullyBooked(dateStr, durationMin, serviceId){
  const slots = await getAvailableSlots(dateStr, durationMin, serviceId);
  return slots.length===0 || slots.every(s=>!s.available);
}

async function findNearestAvailableDate(fromDateStr, durationMin, serviceId){
  let d = new Date(fromDateStr+'T00:00:00');
  for(let i=0;i<60;i++){
    d.setDate(d.getDate()+1);
    const ds = ymd(d);
    if(!(await isDayFullyBooked(ds, durationMin, serviceId))) return ds;
  }
  return null;
}

/* =========================================================================
   RENDER: LANDING PAGE SECTIONS
   ========================================================================= */
async function renderSettings(){
  let s;
  try { s = await DB.getSettings(); }
  catch(e) {
    s = {phone:'+7 708 127 6005', whatsapp:'77081276005', instagram:'@snezhana.utesheva', address:'с. Новоишимское'};
    console.warn('Supabase settings недоступны, использую fallback', e);
  }
  document.getElementById('c-phone').textContent = s.phone || '';
  document.getElementById('c-wa').textContent = s.whatsapp ? '+'+s.whatsapp : '';
  document.getElementById('c-inst').textContent = s.instagram || '';
  document.getElementById('c-addr').textContent = s.address || '';
  document.getElementById('c-inst-link').href = 'https://instagram.com/'+String(s.instagram||'').replace('@','');
  document.getElementById('c-tel-link').href = 'tel:'+String(s.phone||'').replace(/[^\d+]/g,'');
  document.getElementById('f-phone').textContent = s.phone || '';
  document.getElementById('f-inst').textContent = s.instagram || '';
  document.getElementById('f-addr').textContent = s.address || '';
}

let currentServiceFilter='Все';
async function renderServices(){
  let all;
  try { all = await DB.get('services'); }
  catch(e) {
    console.warn('Supabase services недоступны, использую fallback', e);
    all = FALLBACK_SERVICES;
  }
  const services = (all || []).filter(s=>s.active);
  setMainPhotos(services);
  const dbPhotos = services.filter(s=>s.image).map(s=>({cat:s.category, img:s.image, title:s.name}));
  if(dbPhotos.length) { PORTFOLIO_ITEMS = dbPhotos; renderPortfolio(); }
  const cats = ['Все', ...new Set(services.map(s=>s.category))];
  document.getElementById('services-tabs').innerHTML = cats.map(c=>
    `<button class="tab-btn ${c===currentServiceFilter?'active':''}" onclick="setServiceFilter('${c}')">${c}</button>`).join('');
  const list = currentServiceFilter==='Все'?services:services.filter(s=>s.category===currentServiceFilter);
  document.getElementById('services-grid').innerHTML = list.map(s=>`
    <div class="service-card reveal visible">
      <div class="cat">${s.category}</div>
      <h3>${s.name}</h3>
      <p class="desc">${s.description}</p>
      <div class="service-meta">
        <div class="service-price">${fmtMoney(s.price)}</div>
        <div class="service-dur">${s.duration} мин</div>
      </div>
      <button class="btn btn-primary" onclick="Booking.open('${s.id}')">Записаться</button>
    </div>`).join('');
}
function setServiceFilter(c){ currentServiceFilter=c; renderServices(); }

let PORTFOLIO_ITEMS = FALLBACK_SERVICES.map(s=>({cat:s.category, img:s.image, title:s.name}));
let currentPfFilter='Все';
function renderPortfolio(){
  const cats=['Все','Брови','Ресницы','Комплекс'];
  document.getElementById('portfolio-tabs').innerHTML = cats.map(c=>
    `<button class="tab-btn ${c===currentPfFilter?'active':''}" onclick="setPfFilter('${c}')">${c}</button>`).join('');
  const list = currentPfFilter==='Все'?PORTFOLIO_ITEMS:PORTFOLIO_ITEMS.filter(p=>p.cat===currentPfFilter);
  document.getElementById('portfolio-grid').innerHTML = list.map(p=>
    `<div class="portfolio-item" onclick="openLightbox('${p.img}')"><img loading="lazy" src="${p.img}" alt="${p.title||p.cat}" onerror="this.style.display='none'; this.parentElement.classList.add('image-error')"></div>`).join('');
}
function setPfFilter(c){ currentPfFilter=c; renderPortfolio(); }
function openLightbox(src){ document.getElementById('pf-lightbox-img').src=src; document.getElementById('pf-lightbox').classList.add('open'); }
function closeLightbox(){ document.getElementById('pf-lightbox').classList.remove('open'); }

async function renderReviews(){
  const all = await DB.get('reviews');
  const reviews = all.filter(r=>r.visible);
  document.getElementById('reviews-grid').innerHTML = reviews.map(r=>`
    <div class="review-card reveal visible">
      <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
      <p>«${r.text}»</p>
      <div class="review-name">${r.name}</div>
    </div>`).join('');
}

const FAQ_ITEMS = [
  {q:'Сколько длится процедура?', a:'В среднем от 15 до 90 минут в зависимости от выбранной услуги. Точная длительность указана на карточке каждой услуги.'},
  {q:'Как подготовиться к процедуре?', a:'Приходите без макияжа на глазах и бровях — это поможет добиться наилучшего результата.'},
  {q:'Можно ли делать ламинирование повторно?', a:'Да, ламинирование можно повторять каждые 4–6 недель по мере роста волосков.'},
  {q:'Как долго сохраняется результат?', a:'Ламинирование держится 4–6 недель, коррекция формы — 3–4 недели, окрашивание — 3–5 недель.'},
  {q:'Можно ли отменить запись?', a:'Да, напишите в WhatsApp заранее, и мы подберём другое удобное время.'},
  {q:'Что делать, если я опаздываю?', a:'Пожалуйста, предупредите заранее в WhatsApp — по возможности мы скорректируем расписание.'},
  {q:'Есть ли противопоказания?', a:'Индивидуальная непереносимость компонентов состава, воспаления и повреждения кожи век. При сомнениях — проконсультируемся заранее.'},
];
function renderFaq(){
  document.getElementById('faq-list').innerHTML = FAQ_ITEMS.map((f,i)=>`
    <div class="faq-item" id="faq-${i}">
      <button class="faq-q" onclick="toggleFaq(${i})"><span>${f.q}</span><span class="plus">+</span></button>
      <div class="faq-a"><p>${f.a}</p></div>
    </div>`).join('');
}
function toggleFaq(i){
  const el = document.getElementById('faq-'+i);
  const a = el.querySelector('.faq-a');
  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(x=>{x.classList.remove('open'); x.querySelector('.faq-a').style.maxHeight=null;});
  if(!wasOpen){ el.classList.add('open'); a.style.maxHeight = a.scrollHeight+'px'; }
}

async function openWhatsApp(){
  const s = await DB.getSettings();
  window.open(`https://wa.me/${s.whatsapp}?text=${encodeURIComponent('Здравствуйте, Снежана! Хочу узнать подробнее об услугах.')}`,'_blank');
}

function toggleMobileMenu(open){
  try{
    debugLog('toggleMobileMenu('+open+') нажато');
    const el = document.getElementById('mobile-menu');
    if(!el){ debugLog('ОШИБКА: элемент #mobile-menu не найден в DOM'); return; }
    el.classList.toggle('open', open);
    debugLog('mobile-menu теперь: '+(el.classList.contains('open') ? 'открыто' : 'закрыто'));
  }catch(e){ debugLog('toggleMobileMenu упал: '+e.message); }
}

/* scroll reveal */
function initReveal(){
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); } });
  },{threshold:0.15});
  els.forEach(el=>io.observe(el));
}

/* =========================================================================
   BOOKING WIZARD
   ========================================================================= */
const Booking = {
  step:1, service:null, date:null, time:null, calDate:new Date(),
  async open(serviceId){
    debugLog('Кнопка "Записаться" нажата, serviceId='+serviceId);
    const overlay = document.getElementById('booking-overlay');
    if(!overlay){ debugLog('ОШИБКА: элемент #booking-overlay не найден в DOM'); return; }
    overlay.classList.add('open');
    document.body.style.overflow='hidden';
    this.step=1; this.date=null; this.time=null; this.calDate=new Date();
    let services;
    try{
      debugLog('Запрашиваю таблицу services из Supabase...');
      services = await DB.get('services');
      debugLog('Успех: получено услуг — '+(services ? services.length : 0));
    }catch(e){
      debugLog('Supabase services недоступны — включаю локальный fallback: '+(e && e.message ? e.message : JSON.stringify(e)));
      services = FALLBACK_SERVICES;
      toast('Сервер записи временно недоступен. Сайт открыт в резервном режиме.');
    }
    if(serviceId){
      this.service = services.find(s=>s.id===serviceId);
      this.step=2;
    } else {
      this.service=null;
    }
    this._allServices = services;
    this.renderServiceList();
    await this.renderStep();
  },
  close(){
    document.getElementById('booking-overlay').classList.remove('open');
    document.body.style.overflow='';
  },
  async renderStep(){
    document.querySelectorAll('.wstep').forEach(el=>el.classList.toggle('active', +el.dataset.step===this.step));
    const totalSteps=4;
    document.getElementById('wizard-steps').innerHTML = Array.from({length:totalSteps},(_,i)=>{
      const n=i+1;
      const cls = n<this.step?'done':(n===this.step?'active':'');
      return `<div class="ws ${cls}"></div>`;
    }).join('');
    if(this.step===2){ await this.renderCalendar(); document.getElementById('w2-service-label').textContent = 'Шаг 2 из 4 · '+this.service.name; document.getElementById('w2-next').disabled=!this.date; }
    if(this.step===3){ await this.renderSlots(); }
    if(this.step===4){ this.renderSummary(); }
  },
  renderServiceList(){
    const services = (this._allServices||[]).filter(s=>s.active);
    document.getElementById('wizard-service-list').innerHTML = services.map(s=>`
      <div class="service-option ${this.service&&this.service.id===s.id?'selected':''}" onclick="Booking.pickService('${s.id}')">
        <div class="so-l"><b>${s.name}</b><span>${s.duration} мин</span></div>
        <div class="so-r"><b>${fmtMoney(s.price)}</b></div>
      </div>`).join('');
    document.getElementById('w1-next').disabled = !this.service;
  },
  pickService(id){
    this.service = (this._allServices||[]).find(s=>s.id===id);
    this.renderServiceList();
  },
  async calShift(dir){
    this.calDate.setMonth(this.calDate.getMonth()+dir);
    await this.renderCalendar();
  },
  async renderCalendar(){
    const y=this.calDate.getFullYear(), m=this.calDate.getMonth();
    document.getElementById('cal-month').textContent = MONTHS_RU_NOM[m]+' '+y;
    const first = new Date(y,m,1);
    let startDow = first.getDay(); startDow = startDow===0?6:startDow-1; // Mon-first
    const daysInMonth = new Date(y,m+1,0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    let wh;
    try { wh = await DB.getWorkingHours(); }
    catch(e) { console.warn('working_hours недоступны, fallback', e); wh = FALLBACK_WORKING_HOURS; }
    let html = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="cal-dow">${d}</div>`).join('');
    for(let i=0;i<startDow;i++) html+='<div class="cal-day empty"></div>';
    for(let d=1; d<=daysInMonth; d++){
      const dateObj = new Date(y,m,d);
      const ds = ymd(dateObj);
      const isPast = dateObj < today;
      const dayCfg = wh.find(w=>w.day===dateObj.getDay());
      const isOff = !dayCfg || !dayCfg.is_working;
      const disabled = isPast || isOff;
      const sel = this.date===ds ? 'selected':'';
      html += `<div class="cal-day ${disabled?'disabled':''} ${sel}" ${disabled?'':`onclick="Booking.pickDate('${ds}')"`}>${d}</div>`;
    }
    document.getElementById('cal-grid').innerHTML = html;
  },
  pickDate(ds){
    this.date = ds; this.time=null;
    this.renderCalendar();
    document.getElementById('w2-next').disabled=false;
  },
  async renderSlots(){
    document.getElementById('w3-date-label').textContent = 'Шаг 3 из 4 · '+fmtDateFull(new Date(this.date+'T00:00:00'));
    const wrap = document.getElementById('w3-slots-wrap');
    wrap.innerHTML = `<div class="empty-state">Загружаем свободные слоты…</div>`;
    let slots;
    try {
      slots = await getAvailableSlots(this.date, this.service.duration, this.service.id);
    } catch(e) {
      console.error('Ошибка загрузки слотов', e);
      wrap.innerHTML = `<div class="empty-state">
        <b>Онлайн-запись временно недоступна</b><br>
        Сервер записи не подключён или Edge Function ещё не опубликована.<br>
        <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="Booking.contactFallback()">Записаться через WhatsApp</button>
      </div>`;
      document.getElementById('w3-next').disabled=true;
      return;
    }
    if(slots.length===0){
      wrap.innerHTML = `<div class="empty-state">На выбранную дату свободных мест нет.<br>Выберите другую дату.<br><button class="btn btn-ghost btn-sm" style="margin-top:14px;" onclick="Booking.jumpNearest()">Показать ближайшие свободные даты</button></div>`;
      document.getElementById('w3-next').disabled=true;
      return;
    }
    wrap.innerHTML = `<div class="slots-grid">${slots.map(s=>
      `<button class="slot-btn ${this.time===s.time?'selected':''}" ${s.available?'':'disabled'} onclick="Booking.pickTime('${s.time}')">${s.time}${s.available?'':' занято'}</button>`
    ).join('')}</div>`;
    document.getElementById('w3-next').disabled = !this.time;
  },
  contactFallback(){
    const phone='77081276005';
    const text=`Здравствуйте! Хочу записаться на услугу «${this.service?.name||'процедуру'}». Желаемая дата: ${this.date||'не выбрана'}, время: ${this.time||'не выбрано'}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');
  },
  async jumpNearest(){
    toast('Ищем ближайшую свободную дату…');
    const nd = await findNearestAvailableDate(this.date, this.service.duration, this.service.id);
    if(nd){ this.date=nd; this.step=2; this.calDate=new Date(nd+'T00:00:00'); await this.renderStep(); toast('Показана ближайшая свободная дата'); }
    else toast('Свободных дат в ближайшие 60 дней не найдено');
  },
  pickTime(t){ this.time=t; this.renderSlots(); },
  renderSummary(){
    document.getElementById('w4-summary').innerHTML = `
      <div><span>Услуга</span><b>${this.service.name}</b></div>
      <div><span>Дата</span><b>${fmtDateFull(new Date(this.date+'T00:00:00'))}</b></div>
      <div><span>Время</span><b>${this.time}</b></div>
      <div><span>Длительность</span><b>${this.service.duration} мин</b></div>
      <div><span>Стоимость</span><b>${fmtMoney(this.service.price)}</b></div>`;
  },
  async next(){
    if(this.step===1 && !this.service) return;
    if(this.step===2 && !this.date) return;
    if(this.step===3 && !this.time) return;
    this.step++; await this.renderStep();
  },
  back(){ this.step--; this.renderStep(); },
  validateForm(){
    let ok=true;
    const name=document.getElementById('f-name').value.trim();
    const phone=document.getElementById('f-phone2').value.trim();
    document.getElementById('err-name').style.display='none';
    document.getElementById('err-phone').style.display='none';
    if(name.length<2){ document.getElementById('err-name').style.display='block'; ok=false; }
    if(phone.replace(/\D/g,'').length<10){ document.getElementById('err-phone').style.display='block'; ok=false; }
    return ok;
  },
  async submit(){
    if(!this.validateForm()) return;
    const submitBtn = document.getElementById('w4-submit');
    if(submitBtn){ submitBtn.disabled=true; }
    const name=document.getElementById('f-name').value.trim();
    const phone=document.getElementById('f-phone2').value.trim();
    const wa=document.getElementById('f-wa').value.trim()||phone;
    const comment=document.getElementById('f-comment').value.trim();

    // Создание записи целиком идёт через Edge Function create-booking:
    // сервер сам пересчитывает занятость и не доверяет данным из браузера.
    let data, error;
    try {
      ({ data, error } = await supabase.functions.invoke('create-booking', {
        body: { service_id:this.service.id, date:this.date, start_time:this.time, name, phone, whatsapp:wa, comment }
      }));
    } catch(e) {
      console.error('create-booking unavailable', e);
      if(submitBtn){ submitBtn.disabled=false; }
      toast('Сервер записи недоступен. Попробуйте записаться через WhatsApp.');
      this.contactFallback();
      return;
    }
    if(submitBtn){ submitBtn.disabled=false; }

    if(error || (data && data.error)){
      const code = (data && data.error) || 'INTERNAL_ERROR';
      if(code==='SLOT_TAKEN'){
        toast('К сожалению, это время только что заняли. Выберите другое время.');
        this.step=3; await this.renderStep();
      } else if(code==='RATE_LIMITED'){
        toast('Слишком много попыток. Попробуйте через несколько минут.');
      } else {
        toast('Не удалось создать запись. Попробуйте ещё раз.');
      }
      return;
    }

    const booking = data.booking;
    this.lastBooking=booking;
    document.getElementById('success-card').innerHTML = `
      <div><span>Услуга</span><b>${this.service.name}</b></div>
      <div><span>Дата</span><b>${fmtDateFull(new Date(this.date+'T00:00:00'))}</b></div>
      <div><span>Время</span><b>${this.time}</b></div>
      <div><span>Продолжительность</span><b>${this.service.duration} минут</b></div>`;
    this.step=5; this.renderStep();
  },
  addToCalendar(){
    const b=this.lastBooking; if(!b) return;
    const start=new Date(b.date+'T'+b.start_time+':00');
    const end=new Date(b.date+'T'+b.end_time+':00');
    const fmt=d=>d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    const url=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(b.service_name+' — Снежана Утешева')}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent('Запись к Снежане Утешевой')}`;
    window.open(url,'_blank');
  },
  async sendWhatsAppConfirm(){
    const b=this.lastBooking; if(!b) return;
    const s=await DB.getSettings();
    const dateFmt = new Date(b.date+'T00:00:00');
    const msg = `Здравствуйте, Снежана!\nХочу записаться на услугу:\n\nУслуга: ${b.service_name}\nДата: ${pad(dateFmt.getDate())}.${pad(dateFmt.getMonth()+1)}.${dateFmt.getFullYear()}\nВремя: ${b.start_time}\nИмя: ${b.client_name}`;
    window.open(`https://wa.me/${s.whatsapp}?text=${encodeURIComponent(msg)}`,'_blank');
  }
};

/* =========================================================================
   ADMIN
   Авторизация полностью через Supabase Auth (supabase.auth.*), пароль
   нигде не хранится и не сравнивается в JS. Сессия — JWT, а не sessionStorage-флаг.
   ========================================================================= */
const Admin = {
  currentTab:'dashboard',
  async login(){
    const email=document.getElementById('admin-email').value.trim();
    const pass=document.getElementById('admin-pass').value;
    document.getElementById('admin-login-err').style.display='none';
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if(error){
      document.getElementById('admin-login-err').textContent = 'Неверный email или пароль';
      document.getElementById('admin-login-err').style.display='block';
      return;
    }
    // проверяем, что пользователь есть в allow-list admin_users (RLS это тоже проверит,
    // но явная проверка тут даёт понятное сообщение вместо тихих пустых списков)
    const { data: { user } } = await supabase.auth.getUser();
    const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', user.id).maybeSingle();
    if(!adminRow){
      await supabase.auth.signOut();
      document.getElementById('admin-login-err').textContent = 'У этого аккаунта нет прав администратора';
      document.getElementById('admin-login-err').style.display='block';
      return;
    }
    this.showShell();
  },
  async logout(){ await supabase.auth.signOut(); location.hash='#home'; location.reload(); },
  async isAuthed(){
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },
  showShell(){
    document.getElementById('admin-login-view').style.display='none';
    document.getElementById('admin-shell-view').style.display='flex';
    this.goTab('dashboard');
  },
  async init(){
    document.getElementById('admin-root').classList.add('active');
    document.getElementById('site-root').style.display='none';
    document.querySelectorAll('#admin-nav a').forEach(a=>a.addEventListener('click',()=>this.goTab(a.dataset.tab)));
    if(await this.isAuthed()) this.showShell();
    else { document.getElementById('admin-login-view').style.display='flex'; document.getElementById('admin-shell-view').style.display='none'; }
  },
  goTab(tab){
    this.currentTab=tab;
    document.querySelectorAll('#admin-nav a').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab));
    const fns={dashboard:this.renderDashboard, calendar:this.renderCalendar, bookings:this.renderBookings, services:this.renderServices, hours:this.renderHours, blocked:this.renderBlocked, reviews:this.renderReviews, settings:this.renderSettings};
    fns[tab].call(this);
  },
  statusMeta(st){
    return {confirmed:{label:'Подтверждено', color:'var(--green)'}, pending:{label:'Ожидает подтверждения', color:'var(--yellow)'}, cancelled:{label:'Отменено', color:'var(--red)'}, completed:{label:'Завершено', color:'#6b6058'}}[st] || {label:st,color:'#999'};
  },
  async renderDashboard(){
    const today = ymd(new Date());
    const allBookings = await DB.get('bookings');
    const bookings = allBookings.filter(b=>b.date===today);
    const confirmed = bookings.filter(b=>b.status==='confirmed').length;
    const cancelled = bookings.filter(b=>b.status==='cancelled').length;
    const wh = (await DB.getWorkingHours()).find(w=>w.day===new Date().getDay());
    let free=0;
    if(wh && wh.is_working){
      const services = (await DB.get('services')).filter(s=>s.active);
      if(services.length){
        const minService = services.reduce((a,b)=>a.duration<b.duration?a:b);
        const slots = await getAvailableSlots(today, minService.duration, minService.id);
        free = slots.filter(s=>s.available).length;
      }
    }
    document.getElementById('admin-main').innerHTML = `
      <h1>Дашборд</h1>
      <div class="stat-grid">
        <div class="stat-card"><div class="n">${bookings.length}</div><div class="l">Записей сегодня</div></div>
        <div class="stat-card"><div class="n">${free}</div><div class="l">Свободно слотов</div></div>
        <div class="stat-card"><div class="n">${confirmed}</div><div class="l">Подтверждено</div></div>
        <div class="stat-card"><div class="n">${cancelled}</div><div class="l">Отменено</div></div>
      </div>
      <div class="admin-card">
        <h3>Записи на сегодня</h3>
        ${this.bookingsTable(bookings)}
      </div>`;
    this.bindRowActions();
  },
  bookingsTable(list){
    if(list.length===0) return `<div class="empty-state">Записей нет</div>`;
    list = [...list].sort((a,b)=> a.date===b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date));
    return `<table class="admin-table"><thead><tr><th>Время</th><th>Клиент</th><th>Услуга</th><th>Статус</th><th></th></tr></thead><tbody>
      ${list.map(b=>{
        const sm=this.statusMeta(b.status);
        return `<tr>
          <td>${b.date}<br><b>${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</b></td>
          <td>${b.client_name}<br><small style="color:#8a8078">${b.phone}</small></td>
          <td>${b.service_name}<br><small style="color:#8a8078">${fmtMoney(b.price)}</small></td>
          <td><span class="status-pill"><span class="dot" style="background:${sm.color}"></span>${sm.label}</span></td>
          <td class="row-actions">
            <button onclick="Admin.openBooking('${b.id}')">Открыть</button>
            ${b.status!=='confirmed'?`<button class="primary" onclick="Admin.setStatus('${b.id}','confirmed')">Подтвердить</button>`:''}
            ${b.status!=='cancelled'?`<button class="danger" onclick="Admin.setStatus('${b.id}','cancelled')">Отменить</button>`:''}
          </td>
        </tr>`;
      }).join('')}
      </tbody></table>`;
  },
  bindRowActions(){},
  async renderCalendar(){
    const wrap = document.getElementById('admin-main');
    if(!this._calDate) this._calDate = ymd(new Date());
    const allBookings = await DB.get('bookings');
    const bookings = allBookings.filter(b=>b.date===this._calDate).sort((a,b)=>a.start_time.localeCompare(b.start_time));
    const allBlocked = await DB.get('blocked_slots');
    const blocked = allBlocked.filter(b=>b.date===this._calDate);
    wrap.innerHTML = `
      <h1>Календарь</h1>
      <div class="admin-flex">
        <input type="date" class="admin-input" style="width:220px; margin-bottom:0;" value="${this._calDate}" onchange="Admin.setCalDate(this.value)">
        <button class="btn btn-primary btn-sm" onclick="Admin.openManualBooking()">+ Новая запись</button>
      </div>
      <div class="admin-card">
        <h3>${fmtDateFull(new Date(this._calDate+'T00:00:00'))}</h3>
        ${bookings.length===0 && blocked.length===0 ? '<div class="empty-state">На этот день записей нет</div>' :
          `<table class="admin-table"><thead><tr><th>Время</th><th>Клиент / причина</th><th>Услуга</th><th>Статус</th><th></th></tr></thead><tbody>
          ${bookings.map(b=>{const sm=this.statusMeta(b.status); return `<tr>
            <td><b>${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</b></td><td>${b.client_name}</td><td>${b.service_name}</td>
            <td><span class="status-pill"><span class="dot" style="background:${sm.color}"></span>${sm.label}</span></td>
            <td class="row-actions"><button onclick="Admin.openBooking('${b.id}')">Открыть</button></td></tr>`;}).join('')}
          ${blocked.map(b=>`<tr><td><b>${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</b></td><td>🚫 ${b.reason}</td><td>—</td><td><span class="status-pill">Заблокировано</span></td>
            <td class="row-actions"><button class="danger" onclick="Admin.deleteBlocked('${b.id}')">Удалить</button></td></tr>`).join('')}
          </tbody></table>`}
      </div>`;
  },
  setCalDate(v){ this._calDate=v; this.renderCalendar(); },
  async renderBookings(){
    const all = await DB.get('bookings');
    document.getElementById('admin-main').innerHTML = `
      <h1>Все записи</h1>
      <div class="admin-flex"><button class="btn btn-primary btn-sm" onclick="Admin.openManualBooking()">+ Создать запись вручную</button></div>
      <div class="admin-card">${this.bookingsTable(all)}</div>`;
  },
  async openBooking(id){
    const bookings = await DB.get('bookings');
    const b = bookings.find(x=>x.id===id);
    const services = await DB.get('services');
    this._servicesCache = services;
    this.drawer(`
      <h3>Запись — ${b.client_name}</h3>
      <div class="admin-label">Имя клиента</div><input class="admin-input" id="d-name" value="${b.client_name}">
      <div class="admin-label">Телефон</div><input class="admin-input" id="d-phone" value="${b.phone}">
      <div class="admin-label">WhatsApp</div><input class="admin-input" id="d-wa" value="${b.whatsapp}">
      <div class="admin-label">Услуга</div>
      <select class="admin-input" id="d-service">${services.map(s=>`<option value="${s.id}" ${s.id===b.service_id?'selected':''}>${s.name} — ${fmtMoney(s.price)}</option>`).join('')}</select>
      <div class="admin-label">Дата</div><input type="date" class="admin-input" id="d-date" value="${b.date}">
      <div class="admin-label">Время</div><input type="time" class="admin-input" id="d-time" value="${b.start_time.slice(0,5)}">
      <div class="admin-label">Комментарий</div><textarea class="admin-textarea" id="d-comment">${b.comment||''}</textarea>
      <div class="admin-label">Статус: ${this.statusMeta(b.status).label}</div>
      <div class="admin-label" style="margin-top:10px;">Создано: ${new Date(b.created_at).toLocaleString('ru-RU')}</div>
      <div class="row-actions" style="margin-top:16px;">
        <button class="primary" onclick="Admin.saveBooking('${b.id}')">Изменить</button>
        <button onclick="Admin.setStatus('${b.id}','confirmed', true)">Подтвердить</button>
        <button class="danger" onclick="Admin.setStatus('${b.id}','cancelled', true)">Отменить</button>
        <button class="danger" onclick="Admin.deleteBooking('${b.id}')">Удалить</button>
      </div>`);
  },
  async saveBooking(id){
    const services = this._servicesCache || await DB.get('services');
    const service = services.find(s=>s.id===document.getElementById('d-service').value);
    const start = document.getElementById('d-time').value;
    const startMin = timeToMin(start);
    const patch = {
      client_name: document.getElementById('d-name').value,
      phone: document.getElementById('d-phone').value,
      whatsapp: document.getElementById('d-wa').value,
      service_id: service.id, service_name: service.name, price: service.price,
      date: document.getElementById('d-date').value,
      start_time: start, end_time: minToTime(startMin+service.duration),
      comment: document.getElementById('d-comment').value
    };
    try{
      await DB.update('bookings', id, patch);
      this.closeDrawer(); toast('Запись обновлена'); this.goTab(this.currentTab);
    }catch(e){
      toast(e.code==='23P01' ? 'Это время уже занято другой записью' : 'Не удалось сохранить запись');
    }
  },
  async setStatus(id, status, fromDrawer){
    try{
      await DB.update('bookings', id, {status});
      if(fromDrawer) this.closeDrawer();
      toast('Статус обновлён'); this.goTab(this.currentTab);
    }catch(e){
      toast('Не удалось обновить статус');
    }
  },
  async deleteBooking(id){
    await DB.remove('bookings', id); this.closeDrawer(); toast('Запись удалена'); this.goTab(this.currentTab);
  },
  async openManualBooking(){
    const services = (await DB.get('services')).filter(s=>s.active);
    this._servicesCache = services;
    this.drawer(`
      <h3>Новая запись</h3>
      <div class="admin-label">Имя клиента</div><input class="admin-input" id="d-name">
      <div class="admin-label">Телефон</div><input class="admin-input" id="d-phone">
      <div class="admin-label">WhatsApp</div><input class="admin-input" id="d-wa">
      <div class="admin-label">Услуга</div>
      <select class="admin-input" id="d-service">${services.map(s=>`<option value="${s.id}">${s.name} — ${fmtMoney(s.price)}</option>`).join('')}</select>
      <div class="admin-label">Дата</div><input type="date" class="admin-input" id="d-date" value="${ymd(new Date())}">
      <div class="admin-label">Время</div><input type="time" class="admin-input" id="d-time" value="10:00">
      <div class="admin-label">Комментарий</div><textarea class="admin-textarea" id="d-comment"></textarea>
      <div class="row-actions" style="margin-top:16px;"><button class="primary" onclick="Admin.createManualBooking()">Создать запись</button></div>`);
  },
  async createManualBooking(){
    const services = this._servicesCache || await DB.get('services');
    const service = services.find(s=>s.id===document.getElementById('d-service').value);
    const date = document.getElementById('d-date').value;
    const start = document.getElementById('d-time').value;
    const startMin = timeToMin(start);
    const booking = {
      client_name:document.getElementById('d-name').value||'Без имени',
      phone:document.getElementById('d-phone').value, whatsapp:document.getElementById('d-wa').value,
      service_id:service.id, service_name:service.name, price:service.price,
      date, start_time:start, end_time:minToTime(startMin+service.duration),
      status:'confirmed', comment:document.getElementById('d-comment').value
    };
    try{
      await DB.add('bookings', booking);
      this.closeDrawer(); toast('Запись создана'); this.goTab(this.currentTab);
    }catch(e){
      // 23P01 = exclusion_violation — время пересекается с другой активной записью
      toast(e.code==='23P01' ? 'Это время уже занято другой записью' : 'Не удалось создать запись');
    }
  },
  async renderServices(){
    const services = await DB.get('services');
    document.getElementById('admin-main').innerHTML = `
      <h1>Услуги</h1>
      <div class="admin-flex"><button class="btn btn-primary btn-sm" onclick="Admin.editService()">+ Новая услуга</button></div>
      <div class="admin-card"><table class="admin-table"><thead><tr><th>Название</th><th>Категория</th><th>Цена</th><th>Длит.</th><th>Активна</th><th></th></tr></thead><tbody>
      ${services.map(s=>`<tr>
        <td>${s.name}</td><td>${s.category}</td><td>${fmtMoney(s.price)}</td><td>${s.duration} мин</td>
        <td><div class="toggle ${s.active?'on':''}" onclick="Admin.toggleService('${s.id}')"></div></td>
        <td class="row-actions"><button onclick="Admin.editService('${s.id}')">Изменить</button><button class="danger" onclick="Admin.deleteService('${s.id}')">Удалить</button></td>
      </tr>`).join('')}
      </tbody></table></div>`;
  },
  async toggleService(id){ const services=await DB.get('services'); const s=services.find(x=>x.id===id); await DB.update('services', id, {active:!s.active}); this.renderServices(); renderServices(); },
  async deleteService(id){ if(confirm('Удалить услугу?')){ await DB.remove('services', id); this.renderServices(); renderServices(); } },
  async editService(id){
    const services = await DB.get('services');
    const s = id ? services.find(x=>x.id===id) : {name:'',category:'',description:'',price:0,duration:30,image:'',active:true};
    this.drawer(`
      <h3>${id?'Изменить услугу':'Новая услуга'}</h3>
      <div class="admin-label">Название</div><input class="admin-input" id="s-name" value="${s.name}">
      <div class="admin-label">Категория</div><input class="admin-input" id="s-cat" value="${s.category}">
      <div class="admin-label">Описание</div><textarea class="admin-textarea" id="s-desc">${s.description}</textarea>
      <div class="admin-label">Цена (₸)</div><input type="number" class="admin-input" id="s-price" value="${s.price}">
      <div class="admin-label">Длительность (мин)</div><input type="number" class="admin-input" id="s-dur" value="${s.duration}">
      <div class="admin-label">URL изображения</div><input class="admin-input" id="s-img" value="${s.image||''}">
      <div class="row-actions" style="margin-top:16px;"><button class="primary" onclick="Admin.saveService('${id||''}')">Сохранить</button></div>`);
  },
  async saveService(id){
    const patch = {
      name:document.getElementById('s-name').value, category:document.getElementById('s-cat').value,
      description:document.getElementById('s-desc').value, price:+document.getElementById('s-price').value,
      duration:+document.getElementById('s-dur').value, image:document.getElementById('s-img').value
    };
    if(id) await DB.update('services', id, patch);
    else await DB.add('services', {active:true, ...patch});
    this.closeDrawer(); toast('Услуга сохранена'); this.renderServices(); renderServices();
  },
  async renderHours(){
    let wh;
    try { wh = await DB.getWorkingHours(); }
    catch(e) { console.warn('working_hours недоступны, fallback', e); wh = FALLBACK_WORKING_HOURS; }
    const breaks = await DB.get('breaks');
    document.getElementById('admin-main').innerHTML = `
      <h1>Рабочее время</h1>
      <div class="admin-card">
        ${wh.map(w=>`<div class="wh-row">
          <b>${w.label}</b>
          <input type="time" value="${w.start}" ${w.is_working?'':'disabled'} onchange="Admin.updateHour(${w.day},'start',this.value)">
          <input type="time" value="${w.end}" ${w.is_working?'':'disabled'} onchange="Admin.updateHour(${w.day},'end',this.value)">
          <div class="toggle ${w.is_working?'on':''}" onclick="Admin.toggleWorkDay(${w.day})"></div>
        </div>`).join('')}
      </div>
      <div class="admin-card">
        <h3>Перерывы</h3>
        ${breaks.map(b=>`<div class="wh-row"><b>${b.label}</b><span>${b.start_time?b.start_time.slice(0,5):''}</span><span>${b.end_time?b.end_time.slice(0,5):''}</span><span></span></div>`).join('') || '<div class="empty-state">Перерывов нет</div>'}
      </div>`;
  },
  async updateHour(day, field, val){
    let wh;
    try { wh = await DB.getWorkingHours(); }
    catch(e) { console.warn('working_hours недоступны, fallback', e); wh = FALLBACK_WORKING_HOURS; } const w = wh.find(x=>x.day===day); w[field]=val; await DB.setWorkingHours(wh);
  },
  async toggleWorkDay(day){
    let wh;
    try { wh = await DB.getWorkingHours(); }
    catch(e) { console.warn('working_hours недоступны, fallback', e); wh = FALLBACK_WORKING_HOURS; } const w = wh.find(x=>x.day===day); w.is_working=!w.is_working;
    if(w.is_working && !w.start){ w.start='09:00'; w.end='19:00'; }
    await DB.setWorkingHours(wh); this.renderHours();
  },
  async renderBlocked(){
    const blocked = await DB.get('blocked_slots');
    document.getElementById('admin-main').innerHTML = `
      <h1>Блокировка времени</h1>
      <div class="admin-flex"><button class="btn btn-primary btn-sm" onclick="Admin.newBlock()">+ Заблокировать время</button></div>
      <div class="admin-card">${blocked.length===0?'<div class="empty-state">Заблокированных интервалов нет</div>':
        `<table class="admin-table"><thead><tr><th>Дата</th><th>Время</th><th>Причина</th><th></th></tr></thead><tbody>
        ${blocked.map(b=>`<tr><td>${b.date}</td><td>${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</td><td>${b.reason}</td>
          <td class="row-actions"><button class="danger" onclick="Admin.deleteBlocked('${b.id}')">Удалить</button></td></tr>`).join('')}
        </tbody></table>`}</div>`;
  },
  newBlock(){
    this.drawer(`
      <h3>Заблокировать время</h3>
      <div class="admin-label">Дата</div><input type="date" class="admin-input" id="b-date" value="${ymd(new Date())}">
      <div class="admin-label">Начало</div><input type="time" class="admin-input" id="b-start" value="13:00">
      <div class="admin-label">Конец</div><input type="time" class="admin-input" id="b-end" value="15:00">
      <div class="admin-label">Причина</div><input class="admin-input" id="b-reason" placeholder="Личные дела">
      <div class="row-actions" style="margin-top:16px;"><button class="primary" onclick="Admin.saveBlock()">Заблокировать</button></div>`);
  },
  async saveBlock(){
    await DB.add('blocked_slots', {date:document.getElementById('b-date').value, start_time:document.getElementById('b-start').value, end_time:document.getElementById('b-end').value, reason:document.getElementById('b-reason').value||'Занято'});
    this.closeDrawer(); toast('Время заблокировано'); this.renderBlocked();
  },
  async deleteBlocked(id){ await DB.remove('blocked_slots', id); this.renderBlocked(); this.renderCalendar(); },
  async renderReviews(){
    const reviews = await DB.get('reviews');
    document.getElementById('admin-main').innerHTML = `
      <h1>Отзывы</h1>
      <div class="admin-flex"><button class="btn btn-primary btn-sm" onclick="Admin.editReview()">+ Добавить отзыв</button></div>
      <div class="admin-card"><table class="admin-table"><thead><tr><th>Имя</th><th>Текст</th><th>Оценка</th><th>Видим</th><th></th></tr></thead><tbody>
      ${reviews.map(r=>`<tr><td>${r.name}</td><td style="max-width:280px; white-space:normal;">${r.text}</td><td>${'★'.repeat(r.rating)}</td>
        <td><div class="toggle ${r.visible?'on':''}" onclick="Admin.toggleReview('${r.id}')"></div></td>
        <td class="row-actions"><button onclick="Admin.editReview('${r.id}')">Изменить</button><button class="danger" onclick="Admin.deleteReview('${r.id}')">Удалить</button></td></tr>`).join('')}
      </tbody></table></div>`;
  },
  async toggleReview(id){ const reviews=await DB.get('reviews'); const r=reviews.find(x=>x.id===id); await DB.update('reviews', id, {visible:!r.visible}); this.renderReviews(); renderReviews(); },
  async deleteReview(id){ await DB.remove('reviews', id); this.renderReviews(); renderReviews(); },
  async editReview(id){
    const reviews = await DB.get('reviews');
    const r = id ? reviews.find(x=>x.id===id) : {name:'',text:'',rating:5,visible:true};
    this.drawer(`
      <h3>${id?'Изменить отзыв':'Новый отзыв'}</h3>
      <div class="admin-label">Имя</div><input class="admin-input" id="r-name" value="${r.name}">
      <div class="admin-label">Текст</div><textarea class="admin-textarea" id="r-text">${r.text}</textarea>
      <div class="admin-label">Оценка (1–5)</div><input type="number" min="1" max="5" class="admin-input" id="r-rating" value="${r.rating}">
      <div class="row-actions" style="margin-top:16px;"><button class="primary" onclick="Admin.saveReview('${id||''}')">Сохранить</button></div>`);
  },
  async saveReview(id){
    const patch = {name:document.getElementById('r-name').value, text:document.getElementById('r-text').value, rating:+document.getElementById('r-rating').value};
    if(id) await DB.update('reviews', id, patch);
    else await DB.add('reviews', {visible:true, ...patch});
    this.closeDrawer(); toast('Отзыв сохранён'); this.renderReviews(); renderReviews();
  },
  async renderSettings(){
    const s = await DB.getSettings();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: log } = await supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(50);
    document.getElementById('admin-main').innerHTML = `
      <h1>Настройки</h1>
      <div class="admin-card">
        <div class="admin-label">Имя мастера</div><input class="admin-input" id="set-name" value="${s.master_name||''}">
        <div class="admin-label">Телефон</div><input class="admin-input" id="set-phone" value="${s.phone||''}">
        <div class="admin-label">WhatsApp (только цифры, с кодом страны)</div><input class="admin-input" id="set-wa" value="${s.whatsapp||''}">
        <div class="admin-label">Instagram</div><input class="admin-input" id="set-inst" value="${s.instagram||''}">
        <div class="admin-label">Адрес</div><input class="admin-input" id="set-addr" value="${s.address||''}">
        <div class="admin-label">Telegram chat_id для уведомлений о новых записях</div><input class="admin-input" id="set-tg" value="${s.telegram_chat_id||''}" placeholder="узнать у @userinfobot">
        <button class="btn btn-primary btn-sm" onclick="Admin.saveSettings()">Сохранить настройки</button>
      </div>
      <div class="admin-card">
        <h3>Аккаунт администратора</h3>
        <p class="hint">Вы вошли как <b>${user ? user.email : ''}</b>. Смена пароля и добавление новых администраторов — через Supabase Dashboard → Authentication, либо через сброс пароля по email.</p>
      </div>
      <div class="admin-card">
        <h3>Журнал действий (последние 50)</h3>
        ${!log || log.length===0 ? '<div class="empty-state">Пока пусто</div>' :
          `<table class="admin-table"><thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Таблица</th></tr></thead><tbody>
          ${log.map(l=>`<tr><td>${new Date(l.created_at).toLocaleString('ru-RU')}</td><td>${l.admin_id?l.admin_id.slice(0,8):'клиент'}</td><td>${l.action}</td><td>${l.entity}</td></tr>`).join('')}
          </tbody></table>`}
      </div>`;
  },
  async saveSettings(){
    await DB.setSettings({
      master_name:document.getElementById('set-name').value, phone:document.getElementById('set-phone').value,
      whatsapp:document.getElementById('set-wa').value.replace(/\D/g,''), instagram:document.getElementById('set-inst').value,
      address:document.getElementById('set-addr').value, telegram_chat_id:document.getElementById('set-tg').value.trim()
    });
    toast('Настройки сохранены'); renderSettings();
  },
  drawer(html){
    document.getElementById('admin-drawer-content').innerHTML = html+`<button class="btn btn-ghost" style="width:100%; margin-top:10px;" onclick="Admin.closeDrawer()">Закрыть</button>`;
    document.getElementById('admin-drawer-overlay').classList.add('open');
  },
  closeDrawer(){ document.getElementById('admin-drawer-overlay').classList.remove('open'); }
};

/* =========================================================================
   ROUTER + INIT
   ========================================================================= */
function route(){
  const h = location.hash;
  if(h.startsWith('#admin')){
    Admin.init();
  } else {
    document.getElementById('admin-root').classList.remove('active');
    document.getElementById('site-root').style.display='';
  }
}
window.addEventListener('hashchange', route);

// если сессия истекла/пользователь вышел в другой вкладке — вернуть на логин
supabase.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT' && location.hash.startsWith('#admin')){
    document.getElementById('admin-login-view').style.display='flex';
    document.getElementById('admin-shell-view').style.display='none';
  }
});

function dbErrorMessage(e){
  const msg = (e && e.message) || '';
  if(msg.includes('relation') || msg.includes('does not exist') || msg.includes('42P01')){
    return 'База данных ещё не настроена (не выполнена SQL-миграция в Supabase).';
  }
  if(msg.includes('Invalid API key') || msg.includes('JWT') || msg.includes('401')){
    return 'Неверный ключ Supabase (SUPABASE_ANON_KEY) — проверьте настройки.';
  }
  return 'Не удалось загрузить данные с сервера. Проверьте подключение к Supabase.';
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderSettings().catch(e=>{ console.error('renderSettings failed:', e); });
  renderServices().catch(e=>{ console.error('renderServices failed:', e); toast(dbErrorMessage(e)); });
  renderPortfolio();
  renderReviews().catch(e=>{ console.error('renderReviews failed:', e); });
  renderFaq();
  initReveal();
  route();
  document.getElementById('booking-overlay').addEventListener('click', (e)=>{ if(e.target.id==='booking-overlay') Booking.close(); });
  document.getElementById('admin-drawer-overlay').addEventListener('click', (e)=>{ if(e.target.id==='admin-drawer-overlay') Admin.closeDrawer(); });
});
