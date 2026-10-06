/**
 * Minimalist Countdown Timer App
 * Supports bilingual switching (RU/EN), local storage persistence,
 * real-time countdown updates, and clean UI transitions.
 */

// --- Localization Dictionary ---
const i18n = {
  ru: {
    pageTitle: "Обратный Таймер",
    createTitle: "Новое событие",
    createSubtitle: "Укажите название и дату, чтобы запустить отсчет",
    eventTitleLabel: "Название события",
    eventTitlePlaceholder: "Например: Новый Год или Отпуск",
    dateTimeLabel: "Дата и время события",
    presetsTitle: "Быстрый выбор:",
    presetNewYear: "🎉 Новый Год",
    presetSummer: "☀️ Лето",
    presetIn24h: "⏱️ +24 часа",
    submitBtn: "Запустить отсчет",
    cancelBtn: "Отменить событие",
    untilPrefix: "до",
    eventReached: "🎉 Событие наступило!",
    validationEmptyTitle: "Пожалуйста, введите название события",
    validationInvalidDate: "Укажите дату и время в будущем",
    confirmCancel: "Отменить текущее событие?",
    units: {
      days: ["день", "дня", "дней"],
      hours: ["час", "часа", "часов"],
      minutes: ["минута", "минуты", "минут"],
      seconds: ["секунда", "секунды", "секунд"]
    }
  },
  en: {
    pageTitle: "Countdown Timer",
    createTitle: "New Event",
    createSubtitle: "Specify event title and date to start countdown",
    eventTitleLabel: "Event Title",
    eventTitlePlaceholder: "e.g. New Year or Vacation",
    dateTimeLabel: "Event Date & Time",
    presetsTitle: "Quick presets:",
    presetNewYear: "🎉 New Year",
    presetSummer: "☀️ Summer",
    presetIn24h: "⏱️ +24 Hours",
    submitBtn: "Start Countdown",
    cancelBtn: "Cancel event",
    untilPrefix: "until",
    eventReached: "🎉 Event has arrived!",
    validationEmptyTitle: "Please enter an event title",
    validationInvalidDate: "Please select a date and time in the future",
    confirmCancel: "Cancel current event?",
    units: {
      days: ["day", "days"],
      hours: ["hour", "hours"],
      minutes: ["minute", "minutes"],
      seconds: ["second", "seconds"]
    }
  }
};

// --- Helper Functions for Pluralization ---
function getRussianPlural(number, [one, two, five]) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
}

function getEnglishPlural(number, [singular, plural]) {
  return number === 1 ? singular : plural;
}

function formatUnitLabel(number, unitKey, lang) {
  const unitList = i18n[lang].units[unitKey];
  if (lang === 'ru') {
    return getRussianPlural(number, unitList);
  } else {
    return getEnglishPlural(number, unitList);
  }
}

// --- App State ---
const STORAGE_KEY_EVENT = 'back_timer_event_data';
const STORAGE_KEY_LANG = 'back_timer_lang_pref';

let currentLang = 'ru';
let activeEvent = null; // { title: string, targetTime: number (timestamp ms) }
let timerInterval = null;

// --- DOM Elements ---
const dom = {
  langBtns: document.querySelectorAll('.lang-btn'),
  formSection: document.getElementById('formSection'),
  countdownSection: document.getElementById('countdownSection'),
  eventForm: document.getElementById('eventForm'),
  eventTitleInput: document.getElementById('eventTitleInput'),
  eventDateTimeInput: document.getElementById('eventDateTimeInput'),
  formError: document.getElementById('formError'),
  submitBtn: document.getElementById('submitBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  cancelBtnText: document.getElementById('cancelBtnText'),
  
  // Localized static texts
  createTitle: document.getElementById('createTitle'),
  createSubtitle: document.getElementById('createSubtitle'),
  eventTitleLabel: document.getElementById('eventTitleLabel'),
  dateTimeLabel: document.getElementById('dateTimeLabel'),
  presetsLabel: document.getElementById('presetsLabel'),
  presetNewYearBtn: document.getElementById('presetNewYearBtn'),
  presetSummerBtn: document.getElementById('presetSummerBtn'),
  presetIn24hBtn: document.getElementById('presetIn24hBtn'),
  untilText: document.getElementById('untilText'),
  eventReachedText: document.getElementById('eventReachedText'),
  
  // Countdown display
  activeEventTitle: document.getElementById('activeEventTitle'),
  daysValue: document.getElementById('daysValue'),
  daysLabel: document.getElementById('daysLabel'),
  hoursValue: document.getElementById('hoursValue'),
  hoursLabel: document.getElementById('hoursLabel'),
  minutesValue: document.getElementById('minutesValue'),
  minutesLabel: document.getElementById('minutesLabel'),
  secondsValue: document.getElementById('secondsValue'),
  secondsLabel: document.getElementById('secondsLabel'),
  timerDisplay: document.getElementById('timerDisplay'),
  eventCompletedBanner: document.getElementById('eventCompletedBanner')
};

// --- Initialization ---
function initApp() {
  // 1. Load language preference
  const savedLang = localStorage.getItem(STORAGE_KEY_LANG);
  if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
    currentLang = savedLang;
  } else {
    const userBrowserLang = navigator.language || navigator.userLanguage || 'ru';
    currentLang = userBrowserLang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }

  // 2. Set default date picker min and initial value (tomorrow this time)
  setupDatePickerDefaults();

  // 3. Update UI texts according to current language
  updateLanguageUI();

  // 4. Load saved event if present
  const savedEventJson = localStorage.getItem(STORAGE_KEY_EVENT);
  if (savedEventJson) {
    try {
      const parsed = JSON.parse(savedEventJson);
      if (parsed && parsed.title && parsed.targetTime) {
        activeEvent = parsed;
        showCountdownView();
      } else {
        showFormView();
      }
    } catch (e) {
      console.error('Failed to parse saved event:', e);
      showFormView();
    }
  } else {
    showFormView();
  }

  // 5. Attach Event Listeners
  attachEventListeners();
}

function setupDatePickerDefaults() {
  const now = new Date();
  
  // Format now + 1 day as YYYY-MM-DDTHH:mm for default datetime-local
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
  const defaultIso = tomorrow.toISOString().slice(0, 16);

  // Set min time to current time
  const nowLocal = new Date(now.getTime() - now.getTimezoneOffset());
  const minIso = nowLocal.toISOString().slice(0, 16);

  dom.eventDateTimeInput.min = minIso;
  dom.eventDateTimeInput.value = defaultIso;
}

// --- Language Switching ---
function setLanguage(lang) {
  if (lang !== 'ru' && lang !== 'en') return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY_LANG, lang);
  updateLanguageUI();
  
  // Refresh timer labels if countdown is active
  if (activeEvent) {
    updateTimerValues();
  }
}

function updateLanguageUI() {
  const t = i18n[currentLang];
  document.title = `${t.pageTitle} | ${activeEvent ? activeEvent.title : t.createTitle}`;
  document.documentElement.lang = currentLang;

  // Language switcher button active state
  dom.langBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  // Form strings
  dom.createTitle.textContent = t.createTitle;
  dom.createSubtitle.textContent = t.createSubtitle;
  dom.eventTitleLabel.textContent = t.eventTitleLabel;
  dom.eventTitleInput.placeholder = t.eventTitlePlaceholder;
  dom.dateTimeLabel.textContent = t.dateTimeLabel;
  dom.presetsLabel.textContent = t.presetsTitle;
  dom.presetNewYearBtn.textContent = t.presetNewYear;
  dom.presetSummerBtn.textContent = t.presetSummer;
  dom.presetIn24hBtn.textContent = t.presetIn24h;
  
  // Submit button text (preserve icon)
  const submitTextSpan = dom.submitBtn.querySelector('span');
  if (submitTextSpan) submitTextSpan.textContent = t.submitBtn;

  // Display strings
  dom.untilText.textContent = t.untilPrefix;
  dom.eventReachedText.textContent = t.eventReached;
  dom.cancelBtnText.textContent = t.cancelBtn;
  dom.cancelBtn.setAttribute('title', t.cancelBtn);

  if (activeEvent) {
    const titleFormatted = currentLang === 'ru' ? `«${activeEvent.title}»` : `"${activeEvent.title}"`;
    dom.activeEventTitle.textContent = titleFormatted;
  }
}

// --- Event Handlers & View Management ---
function attachEventListeners() {
  // Language Switcher
  dom.langBtns.forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // Form Submit
  dom.eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    createEvent();
  });

  // Cancel Event
  dom.cancelBtn.addEventListener('click', () => {
    cancelEvent();
  });

  // Presets
  dom.presetNewYearBtn.addEventListener('click', () => applyPreset('new_year'));
  dom.presetSummerBtn.addEventListener('click', () => applyPreset('summer'));
  dom.presetIn24hBtn.addEventListener('click', () => applyPreset('in_24h'));

  // Clear error on input typing
  dom.eventTitleInput.addEventListener('input', () => clearError());
  dom.eventDateTimeInput.addEventListener('input', () => clearError());
}

function applyPreset(type) {
  const now = new Date();
  let targetDate = new Date();
  let title = '';

  if (type === 'new_year') {
    const nextYear = now.getFullYear() + 1;
    targetDate = new Date(nextYear, 0, 1, 0, 0, 0);
    title = currentLang === 'ru' ? `Нового ${nextYear} Года` : `New Year ${nextYear}`;
  } else if (type === 'summer') {
    let year = now.getFullYear();
    // June 1st of current or next year
    let summerDate = new Date(year, 5, 1, 0, 0, 0);
    if (now >= summerDate) {
      summerDate = new Date(year + 1, 5, 1, 0, 0, 0);
    }
    targetDate = summerDate;
    title = currentLang === 'ru' ? 'Лета' : 'Summer';
  } else if (type === 'in_24h') {
    targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    title = currentLang === 'ru' ? 'Завтрашнего дня' : 'Tomorrow';
  }

  dom.eventTitleInput.value = title;
  
  // Format local string for input
  const localTarget = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000);
  dom.eventDateTimeInput.value = localTarget.toISOString().slice(0, 16);
  clearError();
}

function showError(msg) {
  dom.formError.textContent = msg;
}

function clearError() {
  dom.formError.textContent = '';
}

function createEvent() {
  const title = dom.eventTitleInput.value.trim();
  const dateTimeVal = dom.eventDateTimeInput.value;
  const t = i18n[currentLang];

  if (!title) {
    showError(t.validationEmptyTitle);
    dom.eventTitleInput.focus();
    return;
  }

  if (!dateTimeVal) {
    showError(t.validationInvalidDate);
    dom.eventDateTimeInput.focus();
    return;
  }

  const targetTimestamp = new Date(dateTimeVal).getTime();
  const nowTimestamp = Date.now();

  if (isNaN(targetTimestamp) || targetTimestamp <= nowTimestamp) {
    showError(t.validationInvalidDate);
    return;
  }

  // Create active event object
  activeEvent = {
    title: title,
    targetTime: targetTimestamp
  };

  // Save to LocalStorage
  localStorage.setItem(STORAGE_KEY_EVENT, JSON.stringify(activeEvent));

  // Render view
  showCountdownView();
}

function cancelEvent() {
  const t = i18n[currentLang];
  // Simple confirmation check or direct reset for super smooth UX
  if (confirm(t.confirmCancel)) {
    activeEvent = null;
    localStorage.removeItem(STORAGE_KEY_EVENT);
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    showFormView();
  }
}

function showFormView() {
  dom.countdownSection.classList.add('hidden');
  dom.cancelBtn.classList.add('hidden');
  dom.formSection.classList.remove('hidden');

  // Reset form errors
  clearError();
  setupDatePickerDefaults();
  dom.eventTitleInput.focus();
}

function showCountdownView() {
  if (!activeEvent) return;

  dom.formSection.classList.add('hidden');
  dom.countdownSection.classList.remove('hidden');
  dom.cancelBtn.classList.remove('hidden');

  // Set Event Title text with quotes
  const titleFormatted = currentLang === 'ru' ? `«${activeEvent.title}»` : `"${activeEvent.title}"`;
  dom.activeEventTitle.textContent = titleFormatted;

  // Start real-time timer loop
  if (timerInterval) clearInterval(timerInterval);
  updateTimerValues(); // Immediate first tick
  timerInterval = setInterval(updateTimerValues, 1000);
}

// --- Real-time Countdown Calculator ---
function updateTimerValues() {
  if (!activeEvent) return;

  const now = Date.now();
  const diff = activeEvent.targetTime - now;

  if (diff <= 0) {
    // Event Reached!
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    dom.daysValue.textContent = '00';
    dom.hoursValue.textContent = '00';
    dom.minutesValue.textContent = '00';
    dom.secondsValue.textContent = '00';

    const t = i18n[currentLang];
    dom.daysLabel.textContent = formatUnitLabel(0, 'days', currentLang);
    dom.hoursLabel.textContent = formatUnitLabel(0, 'hours', currentLang);
    dom.minutesLabel.textContent = formatUnitLabel(0, 'minutes', currentLang);
    dom.secondsLabel.textContent = formatUnitLabel(0, 'seconds', currentLang);

    dom.eventCompletedBanner.classList.remove('hidden');
    return;
  }

  dom.eventCompletedBanner.classList.add('hidden');

  // Math breakdown
  const secondsTotal = Math.floor(diff / 1000);
  const days = Math.floor(secondsTotal / (3600 * 24));
  const hours = Math.floor((secondsTotal % (3600 * 24)) / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = secondsTotal % 60;

  // Render padded numbers
  dom.daysValue.textContent = String(days).padStart(2, '0');
  dom.hoursValue.textContent = String(hours).padStart(2, '0');
  dom.minutesValue.textContent = String(minutes).padStart(2, '0');
  dom.secondsValue.textContent = String(seconds).padStart(2, '0');

  // Grammatically correct unit labels
  dom.daysLabel.textContent = formatUnitLabel(days, 'days', currentLang);
  dom.hoursLabel.textContent = formatUnitLabel(hours, 'hours', currentLang);
  dom.minutesLabel.textContent = formatUnitLabel(minutes, 'minutes', currentLang);
  dom.secondsLabel.textContent = formatUnitLabel(seconds, 'seconds', currentLang);
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
