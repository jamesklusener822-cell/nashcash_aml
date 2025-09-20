const PLACEHOLDER_TOKEN = 'PASTE_TELEGRAM_BOT_TOKEN_HERE';
const PLACEHOLDER_CHAT = 'PASTE_TELEGRAM_CHAT_ID_HERE';

const TELEGRAM_BOT_TOKEN =
  window.NASHCASH_TELEGRAM_BOT_TOKEN || PLACEHOLDER_TOKEN;
const TELEGRAM_CHAT_ID = window.NASHCASH_TELEGRAM_CHAT_ID || PLACEHOLDER_CHAT;
const USER_LABEL = '#USER1001';

let visitorSnapshot = null;
const isTelegramConfigured =
  TELEGRAM_BOT_TOKEN &&
  TELEGRAM_CHAT_ID &&
  !TELEGRAM_BOT_TOKEN.includes('PASTE_') &&
  !TELEGRAM_CHAT_ID.includes('PASTE_');
let telegramWarningShown = false;

async function fetchVisitorDetails() {
  const device = describeDevice();

  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) {
      throw new Error('Failed to load IP info');
    }
    const data = await response.json();
    return {
      ip: data.ip || '—',
      country: data.country_name || 'Неизвестно',
      city: data.city || '',
      isp: data.org || '',
      device,
    };
  } catch (error) {
    console.warn('Не удалось получить IP-данные:', error);
    return {
      ip: 'Неизвестно',
      country: 'Неизвестно',
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

  return `${deviceType} — ${os}, ${browser}`;
}

function buildMessage(prefix, snapshot) {
  const location = snapshot.city
    ? `${snapshot.country}, ${snapshot.city}`
    : snapshot.country;
  const ispText = snapshot.isp ? `\nПровайдер: ${snapshot.isp}` : '';

  return (
    `${prefix} ${USER_LABEL}.` +
    `\nIP: ${snapshot.ip}` +
    `\nСтрана: ${location}` +
    `\nУстройство: ${snapshot.device}` +
    ispText
  );
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

document.addEventListener('DOMContentLoaded', async () => {
  visitorSnapshot = await fetchVisitorDetails();
  const message = buildMessage('👤 Пользователь вошёл на сайт', visitorSnapshot);
  await sendTelegramMessage(message);
});

window.addEventListener('beforeunload', () => {
  if (!visitorSnapshot) {
    return;
  }
  const message = buildMessage('🚪 Пользователь покинул страницу', visitorSnapshot);
  sendTelegramMessage(message, { keepalive: true });
});
