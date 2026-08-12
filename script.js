/* =========================================================
   Снежана Утешева — script.js
   Vanilla JS. No dependencies. No backend.
   ========================================================= */
(function () {
  "use strict";

  /* ================= BUSINESS CONFIG ================= */
  /* Edit these values to customize the site for a real business. */
  const BUSINESS_CONFIG = {
    masterName: "Снежана Утешева",
    whatsapp: "77081276005", // digits only, international format, no "+"
    phone: "+7 708 127 6005",
    instagram: "https://www.instagram.com/snezhana.utesheva",
    address: "с. Новоишимское",
    slotInterval: 30, // minutes between bookable slot start times
    workingHours: {
      1: { start: "09:00", end: "19:00" }, // Mon
      2: { start: "09:00", end: "19:00" }, // Tue
      3: { start: "09:00", end: "19:00" }, // Wed
      4: { start: "09:00", end: "19:00" }, // Thu
      5: { start: "09:00", end: "19:00" }, // Fri
      6: { start: "10:00", end: "16:00" }, // Sat
      0: null                              // Sun — day off
    },
    // Manually blocked ranges (lunch breaks, personal time, etc.)
    // date format: YYYY-MM-DD
    blockedSlots: [
      // { date: "2026-08-15", start: "13:00", end: "14:00" }
    ]
  };

  /* ================= SUPABASE ================= */
  const SUPABASE_URL = "https://temjwwglowbuarxuixpa.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_6kcF4N5DLCpLMSoaPDNmgQ_LHFDFZUq";
  const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  async function callEdgeFunction(name, payload) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || `HTTP_${res.status}`);
      err.status = res.status;
      err.code = data && data.error;
      throw err;
    }
    return data;
  }

  const STORAGE_KEY = "snezhana_bookings";
  const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

  /* ================= SERVICES (loaded from Supabase; empty until fetchServices() resolves) ================= */
  let SERVICES = [];

  async function fetchServices() {
    if (!supabase) throw new Error("SUPABASE_CLIENT_MISSING");
    const { data, error } = await supabase
      .from("services")
      .select("id, name, description, price, duration, image, active")
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    SERVICES = (data || []).map(s => ({
      id: s.id,
      name: s.name,
      desc: s.description || "",
      price: Number(s.price),
      duration: s.duration,
      img: s.image || "assets/service-lash-lam.jpg",
    }));
    return SERVICES;
  }

  const PORTFOLIO = [
    { id: 1, category: "brows",  img: "assets/portfolio-1.jpg" },
    { id: 2, category: "lashes", img: "assets/portfolio-2.jpg" },
    { id: 3, category: "combo",  img: "assets/portfolio-3.jpg" },
    { id: 4, category: "brows",  img: "assets/portfolio-4.jpg" },
    { id: 5, category: "lashes", img: "assets/portfolio-5.jpg" },
    { id: 6, category: "combo",  img: "assets/portfolio-6.jpg" },
    { id: 7, category: "brows",  img: "assets/brows-1.jpg" },
    { id: 8, category: "brows",  img: "assets/brows-2.jpg" },
    { id: 9, category: "lashes", img: "assets/lashes-1.jpg" }
  ];

  const REVIEWS = [
    { name: "Анна П.", stars: 5, text: "Очень аккуратная работа, форма бровей держится уже третью неделю. Обязательно вернусь на ламинирование ресниц." },
    { name: "Мария И.", stars: 5, text: "Атмосфера супер спокойная, а результат превзошёл ожидания — взгляд стал выразительнее без лишней вычурности." },
    { name: "Алина С.", stars: 5, text: "Записалась онлайн прямо с телефона, всё заняло минуту. Снежана подобрала форму именно под моё лицо." },
    { name: "Екатерина К.", stars: 5, text: "Ламинирование держится больше месяца, ресницы выглядят ухоженно каждый день без туши." }
  ];

  const FAQ = [
    { q: "Сколько длится процедура?", a: "В зависимости от услуги — от 15 минут (ваксинг) до 90 минут (полный комплекс). Точное время указано в карточке каждой услуги." },
    { q: "Как подготовиться?", a: "Приходите без макияжа на бровях и глазах — так мастер точнее оценит естественную форму и цвет." },
    { q: "Как долго держится результат?", a: "Ламинирование держится 4–6 недель, коррекция формы — 3–4 недели, в зависимости от особенностей роста волосков." },
    { q: "Можно ли отменить запись?", a: "Да, напишите в WhatsApp или позвоните заранее — мы предложим другое удобное время." },
    { q: "Что делать при опоздании?", a: "Пожалуйста, предупредите заранее в WhatsApp. При опоздании более чем на 15 минут время процедуры может быть сокращено." }
  ];

  /* ================= STORAGE HELPERS ================= */
  function getBookings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Не удалось прочитать записи из localStorage", e);
      return [];
    }
  }

  function saveBooking(booking) {
    const bookings = getBookings();
    bookings.push(booking);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  }

  /* ================= TIME HELPERS ================= */
  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  function toHHMM(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  function dateKey(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function isPastDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }
  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function getWorkingHoursFor(date) {
    return BUSINESS_CONFIG.workingHours[date.getDay()] || null;
  }

  function getBusySlotsForDate(dk) {
    const busy = [];
    getBookings()
      .filter(b => b.date === dk && b.status !== "cancelled")
      .forEach(b => busy.push([toMinutes(b.startTime), toMinutes(b.endTime)]));
    BUSINESS_CONFIG.blockedSlots
      .filter(b => b.date === dk)
      .forEach(b => busy.push([toMinutes(b.start), toMinutes(b.end)]));
    return busy;
  }

  function generateSlotsForDate(date, durationMinutes) {
    const wh = getWorkingHoursFor(date);
    if (!wh) return [];
    const dk = dateKey(date);
    const busy = getBusySlotsForDate(dk);
    const startMin = toMinutes(wh.start);
    const endMin = toMinutes(wh.end);
    const interval = BUSINESS_CONFIG.slotInterval;
    const now = new Date();
    const isToday = dateKey(now) === dk;
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    for (let t = startMin; t + durationMinutes <= endMin; t += interval) {
      if (isToday && t <= nowMin) continue;
      const slotEnd = t + durationMinutes;
      const busyHit = busy.some(([bs, be]) => rangesOverlap(t, slotEnd, bs, be));
      slots.push({ time: toHHMM(t), available: !busyHit });
    }
    return slots;
  }

  /* ================= STATE ================= */
  const state = {
    step: 1,
    service: null,
    calendarMonth: new Date().getMonth(),
    calendarYear: new Date().getFullYear(),
    selectedDate: null, // Date
    selectedTime: null,
    customer: { name: "", phone: "", whatsapp: "", comment: "" },
    lastBooking: null,
    portfolioFilter: "all",
    lightboxIndex: 0
  };

  /* ================= DOM READY ================= */
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    setupBurgerMenu();
    setupBookingModal();
    setupLightbox();
    setupPortfolioFilter();
    setupFaqAccordion();
    setupSmoothAnchors();
    setupRevealAnimations();
    setupContactLinks();
    setupFooterYear();
    renderPortfolio();
    renderReviews();
    renderFaq();

    try {
      await fetchServices();
      renderServices();
      renderMiniServiceList();
    } catch (e) {
      console.error("fetchServices failed:", e);
      document.getElementById("servicesGrid").innerHTML =
        `<p style="grid-column:1/-1; font-size:13px; opacity:.7;">Не удалось загрузить прайс-лист. Проверьте подключение к интернету и обновите страницу.</p>`;
      showToast("Не удалось загрузить услуги с сервера");
    }
  }

  /* ================= RENDER: SERVICES ================= */
  function renderServices() {
    const grid = document.getElementById("servicesGrid");
    grid.innerHTML = SERVICES.map(s => `
      <div class="service-card reveal">
        <div class="service-photo"><img src="${s.img}" alt="${escapeHtml(s.name)}" loading="lazy" width="700" height="700"></div>
        <div class="service-body">
          <div class="service-name">${escapeHtml(s.name)}</div>
          <div class="service-desc">${escapeHtml(s.desc)}</div>
          <div class="service-meta">
            <span class="service-price">${formatPrice(s.price)}</span>
            <span class="service-duration">${s.duration} мин</span>
          </div>
          <button class="btn btn-primary btn-sm service-book" data-service-book="${s.id}" aria-label="Записаться на услугу ${escapeHtml(s.name)}">Записаться</button>
        </div>
      </div>
    `).join("");

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-service-book]");
      if (!btn) return;
      const service = SERVICES.find(s => s.id === btn.dataset.serviceBook);
      openBooking(service);
    });
  }

  /* ================= RENDER: PORTFOLIO ================= */
  function renderPortfolio() {
    const grid = document.getElementById("portfolioGrid");
    grid.innerHTML = PORTFOLIO.map((p, i) => `
      <button class="portfolio-item" data-category="${p.category}" data-index="${i}" aria-label="Открыть фото работы ${i + 1}">
        <img src="${p.img}" alt="Работа: ${categoryLabel(p.category)}" loading="lazy" width="700" height="700">
      </button>
    `).join("");
  }

  function categoryLabel(cat) {
    return { brows: "брови", lashes: "ресницы", combo: "комплекс" }[cat] || cat;
  }

  function setupPortfolioFilter() {
    const chips = document.querySelectorAll(".filter-chip");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chips.forEach(c => { c.classList.remove("is-active"); c.setAttribute("aria-selected", "false"); });
        chip.classList.add("is-active");
        chip.setAttribute("aria-selected", "true");
        state.portfolioFilter = chip.dataset.filter;
        applyPortfolioFilter();
      });
    });
  }

  function applyPortfolioFilter() {
    document.querySelectorAll(".portfolio-item").forEach(item => {
      const match = state.portfolioFilter === "all" || item.dataset.category === state.portfolioFilter;
      item.classList.toggle("is-hidden", !match);
    });
  }

  /* ================= LIGHTBOX ================= */
  function setupLightbox() {
    const lightbox = document.getElementById("lightbox");
    const img = document.getElementById("lightboxImg");
    const grid = document.getElementById("portfolioGrid");

    function visibleItems() {
      return Array.from(document.querySelectorAll(".portfolio-item")).filter(el => !el.classList.contains("is-hidden"));
    }

    function openAt(index) {
      const items = visibleItems();
      if (!items.length) return;
      state.lightboxIndex = (index + items.length) % items.length;
      const el = items[state.lightboxIndex];
      img.src = el.querySelector("img").src;
      img.alt = el.querySelector("img").alt;
      lightbox.classList.add("is-open");
      document.body.classList.add("menu-open");
    }

    grid.addEventListener("click", (e) => {
      const item = e.target.closest(".portfolio-item");
      if (!item) return;
      const items = visibleItems();
      const idx = items.indexOf(item);
      openAt(idx);
    });

    document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
    document.getElementById("lightboxPrev").addEventListener("click", () => openAt(state.lightboxIndex - 1));
    document.getElementById("lightboxNext").addEventListener("click", () => openAt(state.lightboxIndex + 1));
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      if (!document.getElementById("bookingModal").classList.contains("is-open") &&
          !document.getElementById("mobileNav").classList.contains("is-open")) {
        document.body.classList.remove("menu-open");
      }
    }

    document.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") openAt(state.lightboxIndex - 1);
      if (e.key === "ArrowRight") openAt(state.lightboxIndex + 1);
    });
  }

  /* ================= RENDER: REVIEWS ================= */
  function renderReviews() {
    const track = document.getElementById("reviewsTrack");
    track.innerHTML = REVIEWS.map(r => `
      <div class="review-card reveal">
        <div class="review-stars" aria-label="${r.stars} из 5 звёзд">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</div>
        <div class="review-name">${escapeHtml(r.name)}</div>
        <p class="review-text">${escapeHtml(r.text)}</p>
      </div>
    `).join("");
  }

  /* ================= RENDER: FAQ ================= */
  function renderFaq() {
    const list = document.getElementById("faqList");
    list.innerHTML = FAQ.map((item, i) => `
      <div class="faq-item">
        <button class="faq-question" aria-expanded="false" aria-controls="faqAnswer${i}" id="faqQuestion${i}">
          <span>${escapeHtml(item.q)}</span>
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
        <div class="faq-answer" id="faqAnswer${i}" role="region" aria-labelledby="faqQuestion${i}">
          <p>${escapeHtml(item.a)}</p>
        </div>
      </div>
    `).join("");
  }

  function setupFaqAccordion() {
    document.querySelectorAll(".faq-question").forEach(btn => {
      btn.addEventListener("click", () => {
        const answer = document.getElementById(btn.getAttribute("aria-controls"));
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        // close others
        document.querySelectorAll(".faq-question").forEach(b => {
          if (b !== btn) {
            b.setAttribute("aria-expanded", "false");
            document.getElementById(b.getAttribute("aria-controls")).style.maxHeight = null;
          }
        });
        btn.setAttribute("aria-expanded", String(!isOpen));
        answer.style.maxHeight = isOpen ? null : answer.scrollHeight + "px";
      });
    });
  }

  /* ================= BURGER MENU ================= */
  function setupBurgerMenu() {
    const burgerBtn = document.getElementById("burgerBtn");
    const nav = document.getElementById("mobileNav");
    const closeBtn = document.getElementById("navCloseBtn");

    function openMenu() {
      nav.classList.add("is-open");
      nav.setAttribute("aria-hidden", "false");
      burgerBtn.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
    }
    function closeMenu() {
      nav.classList.remove("is-open");
      nav.setAttribute("aria-hidden", "true");
      burgerBtn.setAttribute("aria-expanded", "false");
      if (!document.getElementById("bookingModal").classList.contains("is-open") &&
          !document.getElementById("lightbox").classList.contains("is-open")) {
        document.body.classList.remove("menu-open");
      }
    }

    burgerBtn.addEventListener("click", () => {
      const isOpen = nav.classList.contains("is-open");
      isOpen ? closeMenu() : openMenu();
    });
    closeBtn.addEventListener("click", closeMenu);
    nav.querySelectorAll("[data-nav-link]").forEach(link => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) closeMenu();
    });
    // click outside (nav covers full screen so clicking backdrop area beyond list closes via close button;
    // additional safety: click on nav itself but not on content)
    nav.addEventListener("click", (e) => { if (e.target === nav) closeMenu(); });
  }

  /* ================= SMOOTH ANCHORS ================= */
  function setupSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  /* ================= REVEAL ON SCROLL ================= */
  function setupRevealAnimations() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(el => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(el => observer.observe(el));
  }

  /* ================= CONTACT LINKS ================= */
  function setupContactLinks() {
    const wa = document.getElementById("contactWhatsapp");
    const message = `Здравствуйте, ${BUSINESS_CONFIG.masterName}! Хочу узнать подробнее об услугах.`;
    wa.href = `https://wa.me/${BUSINESS_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`;
  }

  function setupFooterYear() {
    const el = document.querySelector(".footer-copy");
    if (el) el.textContent = `© ${new Date().getFullYear()} ${BUSINESS_CONFIG.masterName}. Все права защищены.`;
  }

  /* ================= FORMAT HELPERS ================= */
  function formatPrice(num) {
    return num.toLocaleString("ru-RU") + " ₸";
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     BOOKING MODAL
     ========================================================= */
  function setupBookingModal() {
    const modal = document.getElementById("bookingModal");
    const closeBtn = document.getElementById("bookingCloseBtn");
    const backBtn = document.getElementById("stepBackBtn");
    const nextBtn = document.getElementById("stepNextBtn");

    document.querySelectorAll("[data-open-booking]").forEach(btn => {
      btn.addEventListener("click", () => openBooking(null));
    });

    closeBtn.addEventListener("click", closeBooking);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeBooking(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeBooking();
    });

    backBtn.addEventListener("click", () => goToStep(state.step - 1));
    nextBtn.addEventListener("click", handleNext);

    renderMiniServiceList();
    setupCalendarNav();

    document.getElementById("goHomeBtn").addEventListener("click", () => {
      closeBooking();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  window.openBooking = openBooking; // exposed for the inline onclick fallback safety
  function openBooking(service) {
    // Fresh session each time the modal opens, to avoid stale selections from a previous visit.
    state.service = service || null;
    state.selectedDate = null;
    state.selectedTime = null;
    state.customer = { name: "", phone: "", whatsapp: "", comment: "" };
    state.calendarMonth = new Date().getMonth();
    state.calendarYear = new Date().getFullYear();
    resetDetailsForm();

    const modal = document.getElementById("bookingModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("menu-open");

    renderMiniServiceList();
    goToStep(state.service ? 2 : 1);
    if (state.service) renderCalendar();
  }

  function resetDetailsForm() {
    const form = document.getElementById("detailsForm");
    form.reset();
    ["fieldName", "fieldPhone", "fieldWhatsapp", "fieldConsent"].forEach(id => {
      document.getElementById(id).classList.remove("has-error");
    });
  }

  function closeBooking() {
    const modal = document.getElementById("bookingModal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (!document.getElementById("mobileNav").classList.contains("is-open") &&
        !document.getElementById("lightbox").classList.contains("is-open")) {
      document.body.classList.remove("menu-open");
    }
  }

  function goToStep(step) {
    step = Math.max(1, Math.min(5, step));
    state.step = step;

    document.querySelectorAll(".booking-step").forEach(panel => {
      panel.classList.toggle("is-active", Number(panel.dataset.stepPanel) === step);
    });
    document.querySelectorAll(".progress-step").forEach(el => {
      const n = Number(el.dataset.step);
      el.classList.toggle("is-active", n === step);
      el.classList.toggle("is-done", n < step);
    });

    const footer = document.getElementById("bookingFooter");
    const backBtn = document.getElementById("stepBackBtn");
    const nextBtn = document.getElementById("stepNextBtn");

    if (step === 5) {
      footer.style.display = "none";
    } else {
      footer.style.display = "flex";
      backBtn.style.visibility = step === 1 ? "hidden" : "visible";
      nextBtn.textContent = step === 4 ? "Подтвердить запись" : "Далее";
    }

    if (step === 2) { updateSummary("summaryStep2"); renderCalendar(); }
    if (step === 3) { updateSummary("summaryStep3", true); renderTimeGrid(); }
    if (step === 4) { updateSummary("summaryStep4", true); }

    updateNextButtonState();
    document.querySelector(".booking-body").scrollTo({ top: 0 });
  }

  function updateSummary(elId, withDate) {
    const el = document.getElementById(elId);
    if (!state.service) { el.classList.remove("is-visible"); return; }
    el.classList.add("is-visible");
    let dateRow = "";
    if (withDate && state.selectedDate) {
      dateRow = `<div class="selected-summary-row"><span>Дата</span><span>${formatDateRu(state.selectedDate)}</span></div>`;
    }
    el.innerHTML = `
      <div class="selected-summary-label">Выбранная услуга</div>
      <div class="selected-summary-name">${escapeHtml(state.service.name)}</div>
      <div class="selected-summary-row"><span>Цена</span><span>${formatPrice(state.service.price)}</span></div>
      <div class="selected-summary-row"><span>Длительность</span><span>${state.service.duration} мин</span></div>
      ${dateRow}
    `;
  }

  async function handleNext() {
    if (state.step === 1) {
      if (!state.service) { showToast("Выберите услугу, чтобы продолжить"); return; }
      goToStep(2);
    } else if (state.step === 2) {
      if (!state.selectedDate) { showToast("Выберите дату"); return; }
      goToStep(3);
    } else if (state.step === 3) {
      if (!state.selectedTime) { showToast("Выберите время"); return; }
      goToStep(4);
    } else if (state.step === 4) {
      if (validateDetailsForm()) {
        const nextBtn = document.getElementById("stepNextBtn");
        nextBtn.disabled = true;
        const originalLabel = nextBtn.textContent;
        nextBtn.textContent = "Отправка…";
        try {
          await submitBooking();
          goToStep(5);
        } catch (e) {
          console.error("submitBooking failed:", e);
          showToast(bookingErrorMessage(e));
        } finally {
          nextBtn.textContent = originalLabel;
          nextBtn.disabled = false;
        }
      }
    }
  }

  function bookingErrorMessage(e) {
    switch (e && e.code) {
      case "SLOT_TAKEN": return "Это время уже заняли, пока вы заполняли форму. Выберите другое.";
      case "RATE_LIMITED": return "Слишком много попыток записи подряд. Попробуйте через несколько минут.";
      case "DATE_IN_PAST":
      case "TIME_IN_PAST": return "Выбранное время уже прошло. Выберите другое.";
      case "OUTSIDE_WORKING_HOURS":
      case "DAY_OFF": return "В это время мастер не работает. Выберите другой день или время.";
      default: return "Не удалось отправить запись. Проверьте интернет и попробуйте ещё раз.";
    }
  }

  function updateNextButtonState() {
    const nextBtn = document.getElementById("stepNextBtn");
    if (state.step === 1) nextBtn.disabled = !state.service;
    else if (state.step === 2) nextBtn.disabled = !state.selectedDate;
    else if (state.step === 3) nextBtn.disabled = !state.selectedTime;
    else nextBtn.disabled = false;
  }

  /* ---------- STEP 1: SERVICE LIST ---------- */
  function renderMiniServiceList() {
    const list = document.getElementById("miniServiceList");
    list.innerHTML = SERVICES.map(s => `
      <button class="mini-service ${state.service && state.service.id === s.id ? "is-selected" : ""}" data-mini-service="${s.id}" type="button">
        <img src="${s.img}" alt="" loading="lazy">
        <span class="mini-service-info">
          <span class="mini-service-name">${escapeHtml(s.name)}</span>
          <span class="mini-service-sub">${s.duration} мин</span>
        </span>
        <span class="mini-service-price">${formatPrice(s.price)}</span>
        <span class="mini-service-check">✓</span>
      </button>
    `).join("");

    list.querySelectorAll("[data-mini-service]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.service = SERVICES.find(s => s.id === btn.dataset.miniService);
        renderMiniServiceList();
        updateNextButtonState();
      });
    });
  }

  /* ---------- STEP 2: CALENDAR ---------- */
  function setupCalendarNav() {
    document.getElementById("calPrev").addEventListener("click", () => shiftMonth(-1));
    document.getElementById("calNext").addEventListener("click", () => shiftMonth(1));
  }

  function shiftMonth(delta) {
    let m = state.calendarMonth + delta;
    let y = state.calendarYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    // Prevent navigating before current month
    const now = new Date();
    if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth())) return;
    state.calendarMonth = m;
    state.calendarYear = y;
    renderCalendar();
  }

  function renderCalendar() {
    const title = document.getElementById("calendarTitle");
    const daysEl = document.getElementById("calendarDays");
    const y = state.calendarYear, m = state.calendarMonth;
    title.textContent = `${MONTHS_RU[m]} ${y}`;

    const firstDay = new Date(y, m, 1);
    // Monday-first index: 0=Mon..6=Sun
    let startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    let html = "";
    for (let i = 0; i < startOffset; i++) html += `<span class="cal-day is-empty"></span>`;

    const today = new Date(); today.setHours(0,0,0,0);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const wh = getWorkingHoursFor(date);
      const past = isPastDate(date);
      const dayOff = !wh;
      const disabled = past || dayOff;
      const isToday = date.getTime() === today.getTime();
      const isSelected = state.selectedDate && dateKey(state.selectedDate) === dateKey(date);
      html += `<button type="button" class="cal-day ${disabled ? "is-disabled" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}"
        data-date="${dateKey(date)}" ${disabled ? "disabled" : ""} aria-label="${d} ${MONTHS_RU[m]}">${d}</button>`;
    }
    daysEl.innerHTML = html;

    daysEl.querySelectorAll(".cal-day:not(.is-disabled):not(.is-empty)").forEach(btn => {
      btn.addEventListener("click", () => {
        const [yy, mm, dd] = btn.dataset.date.split("-").map(Number);
        state.selectedDate = new Date(yy, mm - 1, dd);
        state.selectedTime = null;
        renderCalendar();
        updateSummary("summaryStep2");
        updateNextButtonState();
      });
    });
  }

  function formatDateRu(date) {
    return `${date.getDate()} ${MONTHS_RU[date.getMonth()].toLowerCase()} ${date.getFullYear()}`;
  }

  /* ---------- STEP 3: TIME SLOTS ---------- */
  async function renderTimeGrid() {
    const grid = document.getElementById("timeGrid");
    const label = document.getElementById("timeSectionLabel");
    if (!state.selectedDate || !state.service) { grid.innerHTML = ""; return; }

    label.textContent = `${formatDateRu(state.selectedDate)} — свободное время`;
    grid.innerHTML = `<p style="grid-column:1/-1; font-size:13px; opacity:.6;">Загрузка расписания…</p>`;

    let slots;
    try {
      const res = await callEdgeFunction("get-available-slots", {
        date: dateKey(state.selectedDate),
        service_id: state.service.id,
      });
      slots = res.slots || [];
    } catch (e) {
      console.error("get-available-slots failed:", e);
      grid.innerHTML = `<p style="grid-column:1/-1; font-size:13px; opacity:.7;">Не удалось загрузить расписание. Возможно, серверная функция ещё не задеплоена в Supabase. Попробуйте позже.</p>`;
      return;
    }

    if (!slots.length) {
      grid.innerHTML = `<p style="grid-column:1/-1; font-size:13px; opacity:.6;">На эту дату нет доступного времени. Пожалуйста, выберите другой день.</p>`;
      return;
    }

    grid.innerHTML = slots.map(s => `
      <button type="button" class="time-slot ${state.selectedTime === s.time ? "is-selected" : ""}"
        data-time="${s.time}" ${s.available ? "" : "disabled"} aria-label="${s.time} ${s.available ? "свободно" : "занято"}">
        ${s.time}${s.available ? "" : "<br><small style=\"font-weight:400;\">занято</small>"}
      </button>
    `).join("");

    grid.querySelectorAll(".time-slot:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        state.selectedTime = btn.dataset.time;
        renderTimeGrid();
        updateSummary("summaryStep3", true);
        updateNextButtonState();
      });
    });
  }

  /* ---------- STEP 4: DETAILS FORM ---------- */
  function validateDetailsForm() {
    let valid = true;
    const name = document.getElementById("inputName").value.trim();
    const phone = document.getElementById("inputPhone").value.trim();
    const whatsapp = document.getElementById("inputWhatsapp").value.trim();
    const consent = document.getElementById("inputConsent").checked;
    const phonePattern = /^[+]?[\d\s()-]{7,}$/;

    toggleFieldError("fieldName", name.length < 2);
    if (name.length < 2) valid = false;

    const phoneInvalid = !phonePattern.test(phone);
    toggleFieldError("fieldPhone", phoneInvalid);
    if (phoneInvalid) valid = false;

    const waInvalid = !phonePattern.test(whatsapp);
    toggleFieldError("fieldWhatsapp", waInvalid);
    if (waInvalid) valid = false;

    const consentField = document.getElementById("fieldConsent");
    consentField.classList.toggle("has-error", !consent);
    if (!consent) valid = false;

    if (!valid) showToast("Проверьте, пожалуйста, поля формы");

    state.customer = {
      name,
      phone,
      whatsapp,
      comment: document.getElementById("inputComment").value.trim()
    };

    return valid;
  }

  function toggleFieldError(fieldId, hasError) {
    document.getElementById(fieldId).classList.toggle("has-error", hasError);
  }

  /* ---------- STEP 4->5: SUBMIT ---------- */
  async function submitBooking() {
    const s = state.service;
    const res = await callEdgeFunction("create-booking", {
      client_name: state.customer.name,
      phone: state.customer.phone,
      whatsapp: state.customer.whatsapp,
      service_id: s.id,
      date: dateKey(state.selectedDate),
      start_time: state.selectedTime,
      comment: state.customer.comment,
    });
    const b = res.booking;
    const booking = {
      id: b.id,
      name: b.client_name,
      phone: b.phone,
      whatsapp: b.whatsapp,
      service: b.service_name,
      price: Number(b.price),
      duration: s.duration,
      date: b.date,
      startTime: b.start_time.slice(0, 5),
      endTime: b.end_time.slice(0, 5),
      comment: b.comment,
      status: b.status,
    };
    state.lastBooking = booking;
    renderSuccessCard(booking);
  }

  function renderSuccessCard(booking) {
    document.getElementById("successCard").innerHTML = `
      <div class="confirm-list" style="border:none; padding:0; margin:0;">
        <div class="confirm-row"><span>Мастер</span><span>${escapeHtml(BUSINESS_CONFIG.masterName)}</span></div>
        <div class="confirm-row"><span>Услуга</span><span>${escapeHtml(booking.service)}</span></div>
        <div class="confirm-row"><span>Дата</span><span>${formatDateRu(state.selectedDate)}</span></div>
        <div class="confirm-row"><span>Время</span><span>${booking.startTime}</span></div>
        <div class="confirm-row"><span>Длительность</span><span>${booking.duration} минут</span></div>
        <div class="confirm-row"><span>Стоимость</span><span>${formatPrice(booking.price)}</span></div>
      </div>
    `;

    const message = [
      `Здравствуйте, ${BUSINESS_CONFIG.masterName}!`,
      ``,
      `Хочу записаться.`,
      ``,
      `Имя: ${booking.name}`,
      `Услуга: ${booking.service}`,
      `Дата: ${formatDateRu(state.selectedDate)}`,
      `Время: ${booking.startTime}`,
      `Цена: ${formatPrice(booking.price)}`
    ].join("\n");

    document.getElementById("whatsappConfirmBtn").href =
      `https://wa.me/${BUSINESS_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`;

    document.getElementById("addToCalendarBtn").onclick = () => downloadIcs(booking);
  }

  /* ---------- ADD TO CALENDAR (.ics) ---------- */
  function downloadIcs(booking) {
    const [y, m, d] = booking.date.split("-").map(Number);
    const [sh, sm] = booking.startTime.split(":").map(Number);
    const [eh, em] = booking.endTime.split(":").map(Number);
    const dtStart = icsDate(y, m, d, sh, sm);
    const dtEnd = icsDate(y, m, d, eh, em);
    const now = new Date();
    const dtStamp = icsDate(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Snezhana Utesheva//Booking//RU",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${booking.id}@snezhana-utesheva`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${icsEscape(booking.service + " — " + BUSINESS_CONFIG.masterName)}`,
      `DESCRIPTION:${icsEscape("Запись к " + BUSINESS_CONFIG.masterName + ". Клиент: " + booking.name)}`,
      `LOCATION:${icsEscape(BUSINESS_CONFIG.address)}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zapis-${booking.date}-${booking.startTime.replace(":", "")}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Событие сохранено");
  }

  function icsDate(y, m, d, h, min) {
    const pad = (n) => n.toString().padStart(2, "0");
    return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
  }
  function icsEscape(str) {
    return String(str).replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
  }

  /* ================= TOAST ================= */
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  // Expose config/data for admin.html (function form so it always reflects
  // the current SERVICES value, not a stale reference captured before fetch).
  window.__SNEZHANA__ = {
    BUSINESS_CONFIG,
    getServices: () => SERVICES,
    getBookings,
    STORAGE_KEY,
  };
})();
