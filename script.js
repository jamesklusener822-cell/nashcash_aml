const PLACEHOLDER_TOKEN = 'PASTE_TELEGRAM_BOT_TOKEN_HERE';
const PLACEHOLDER_CHAT = 'PASTE_TELEGRAM_CHAT_ID_HERE';

const TELEGRAM_BOT_TOKEN =
  window.NASHCASH_TELEGRAM_BOT_TOKEN || PLACEHOLDER_TOKEN;
const TELEGRAM_CHAT_ID = window.NASHCASH_TELEGRAM_CHAT_ID || PLACEHOLDER_CHAT;
const SESSION_USER_TAG = '#USER1001';
const ENTRY_PHOTO_PATH = 'assets/telegram-entry.svg';
const EXIT_PHOTO_PATH = 'assets/telegram-exit.svg';
const SITE_DOMAIN = (() => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname || window.location.href;
  }
  return 'nashcash.cc';
})();

let visitorSnapshot = null;
let exitNotified = false;
const isTelegramConfigured =
  TELEGRAM_BOT_TOKEN &&
  TELEGRAM_CHAT_ID &&
  !TELEGRAM_BOT_TOKEN.includes('PASTE_') &&
  !TELEGRAM_CHAT_ID.includes('PASTE_');
let telegramWarningShown = false;

async function fetchVisitorDetails(signal) {
  const device = describeDevice();

  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Failed to load IP info');
    }
    const data = await response.json();
    const countryName = data.country_name || 'Неизвестно';
    const countryCode = data.country_code || data.country || '';
    return {
      ip: data.ip || '—',
      countryName,
      countryCode,
      countryFlag: countryCodeToFlag(countryCode),
      city: data.city || '',
      isp: data.org || '',
      device,
    };
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.warn('Не удалось получить IP-данные:', error);
    }
    return {
      ip: 'Неизвестно',
      countryName: 'Неизвестно',
      countryCode: '',
      countryFlag: '',
      city: '',
      isp: '',
      device,
    };
  }
}

function describeDevice() {
  const ua = navigator.userAgent;
  let deviceType = 'ПК/ноутбук';
  if (/tablet|ipad/i.test(ua)) {
    deviceType = 'Планшет';
  } else if (/mobile|iphone|android/i.test(ua)) {
    deviceType = 'Мобильное устройство';
  }

  let os = 'Неизвестная ОС';
  if (/windows nt 10|windows nt 11/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/windows nt 6\.3/i.test(ua)) {
    os = 'Windows 8.1';
  } else if (/windows nt 6\.2/i.test(ua)) {
    os = 'Windows 8';
  } else if (/windows nt 6\.1/i.test(ua)) {
    os = 'Windows 7';
  } else if (/mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Браузер не определён';
  if (/edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = 'Safari';
  } else if (/opera|opr/i.test(ua)) {
    browser = 'Opera';
  }

  return {
    type: deviceType,
    os,
    browser,
  };
}

function countryCodeToFlag(code) {
  if (!code || typeof code !== 'string') {
    return '';
  }
  const uppercase = code.trim().toUpperCase();
  if (uppercase.length !== 2) {
    return '';
  }
  const OFFSET = 127397;
  return String.fromCodePoint(
    ...uppercase.split('').map((char) => char.charCodeAt(0) + OFFSET)
  );
}

function buildEntryMessage(snapshot) {
  const flag = snapshot.countryFlag ? `${snapshot.countryFlag} ` : '';
  const location = snapshot.city
    ? `${flag}${snapshot.countryName} (${snapshot.city})`
    : `${flag}${snapshot.countryName}`;
  const deviceParts = [];
  if (snapshot.device.os && snapshot.device.os !== 'Неизвестная ОС') {
    deviceParts.push(snapshot.device.os);
  }
  if (snapshot.device.type) {
    deviceParts.push(snapshot.device.type);
  }
  if (snapshot.device.browser && snapshot.device.browser !== 'Браузер не определён') {
    deviceParts.push(snapshot.device.browser);
  }
  const deviceLine = deviceParts.length ? deviceParts.join(' • ') : 'Неизвестно';

  const lines = [
    `🚀 <b>Пользователь ${SESSION_USER_TAG}</b> зашёл на сайт <code>${SITE_DOMAIN}</code>`,
    `🌍 <b>Страна:</b> ${location}`,
    `💻 <b>Устройство:</b> ${deviceLine}`,
    `📡 <b>IP:</b> <code>${snapshot.ip}</code>`,
  ];

  if (snapshot.isp) {
    lines.push(`🛰 <b>Провайдер:</b> ${snapshot.isp}`);
  }

  return lines.join('\n');
}

function buildExitMessage() {
  return `👋 Пользователь <b>${SESSION_USER_TAG}</b> покинул сайт <code>${SITE_DOMAIN}</code>`;
}

async function sendTelegramPhoto(imagePath, caption, { keepalive = false } = {}) {
  if (!isTelegramConfigured || typeof FormData !== 'function') {
    return false;
  }

  try {
    const response = await fetch(imagePath, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Не удалось загрузить изображение: ${imagePath}`);
    }

    const blob = await response.blob();
    const fileName = imagePath.split('/').pop() || 'image.jpg';
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }
    formData.append('photo', blob, fileName);

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const telegramResponse = await fetch(url, {
      method: 'POST',
      body: formData,
      keepalive,
    });

    if (!telegramResponse.ok) {
      throw new Error(`Telegram API вернул статус ${telegramResponse.status}`);
    }

    return true;
  } catch (error) {
    console.error('Ошибка отправки фото в Telegram:', error);
    return false;
  }
}

function sendTelegramMessage(message, { keepalive = false } = {}) {
  if (!isTelegramConfigured) {
    if (!telegramWarningShown && typeof console !== 'undefined') {
      console.info(
        'Telegram бот не настроен. Укажите токен и chat_id в script.js или задайте window.NASHCASH_TELEGRAM_*.'
      );
      telegramWarningShown = true;
    }
    return Promise.resolve(false);
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const params = new URLSearchParams({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML',
  });

  if (keepalive && navigator.sendBeacon) {
    const blob = new Blob([params.toString()], {
      type: 'application/x-www-form-urlencoded',
    });
    const sent = navigator.sendBeacon(url, blob);
    return Promise.resolve(sent);
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    keepalive,
  })
    .then(() => true)
    .catch((error) => {
      console.error('Ошибка отправки в Telegram:', error);
      return false;
    });
}

function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('[data-animate]');
  if (!animatedElements.length) {
    return;
  }

  const prefersReducedMotionQuery =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion =
    Boolean(prefersReducedMotionQuery && prefersReducedMotionQuery.matches);

  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    animatedElements.forEach((element) => {
      element.classList.add('is-visible');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries, observerInstance) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const { delay } = element.dataset;
          if (delay) {
            const delayValue = Number(delay);
            if (!Number.isNaN(delayValue)) {
              element.style.transitionDelay = `${delayValue}ms`;
            }
          }
          element.classList.add('is-visible');
          observerInstance.unobserve(element);
        }
      });
    },
    {
      threshold: 0.2,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  animatedElements.forEach((element) => observer.observe(element));
}

function initInteractiveGlow() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) {
    return;
  }

  const pointerQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: hover) and (pointer: fine)')
      : null;
  const motionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  if ((pointerQuery && !pointerQuery.matches) || (motionQuery && motionQuery.matches)) {
    return;
  }

  let rafId = null;
  let fadeTimeout = null;

  function scheduleUpdate(xRatio, yRatio) {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    rafId = window.requestAnimationFrame(() => {
      root.style.setProperty('--pointer-x', String(xRatio));
      root.style.setProperty('--pointer-y', String(yRatio));
    });
  }

  function handlePointerMove(event) {
    if (!window.innerWidth || !window.innerHeight) {
      return;
    }

    const xRatio = Math.min(Math.max(event.clientX / window.innerWidth, 0), 1);
    const yRatio = Math.min(Math.max(event.clientY / window.innerHeight, 0), 1);

    scheduleUpdate(xRatio.toFixed(4), yRatio.toFixed(4));

    body.classList.add('glow-active');
    if (fadeTimeout) {
      window.clearTimeout(fadeTimeout);
    }
    fadeTimeout = window.setTimeout(() => {
      body.classList.remove('glow-active');
      fadeTimeout = null;
    }, 1200);
  }

  function resetGlow() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (fadeTimeout) {
      window.clearTimeout(fadeTimeout);
      fadeTimeout = null;
    }
    body.classList.remove('glow-active');
    root.style.removeProperty('--pointer-x');
    root.style.removeProperty('--pointer-y');
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerdown', handlePointerMove, { passive: true });
  window.addEventListener('pointerleave', resetGlow);
  window.addEventListener('pointercancel', resetGlow);
  window.addEventListener('blur', resetGlow);
}

async function handleVisitorEntry() {
  if (!isTelegramConfigured) {
    return;
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 5000) : null;

  try {
    visitorSnapshot = await fetchVisitorDetails(controller?.signal);
    const message = buildEntryMessage(visitorSnapshot);
    const photoSent = await sendTelegramPhoto(ENTRY_PHOTO_PATH, message);
    if (!photoSent) {
      await sendTelegramMessage(message);
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('Ошибка при обработке входа пользователя:', error);
    }
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

function notifyVisitorExit() {
  if (!isTelegramConfigured || !visitorSnapshot || exitNotified) {
    return;
  }

  exitNotified = true;
  const message = buildExitMessage();

  sendTelegramPhoto(EXIT_PHOTO_PATH, message, { keepalive: true }).then((sent) => {
    if (!sent) {
      sendTelegramMessage(message, { keepalive: true });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initInteractiveGlow();
  handleVisitorEntry();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    notifyVisitorExit();
  }
});

window.addEventListener('pagehide', notifyVisitorExit);
window.addEventListener('beforeunload', notifyVisitorExit);
