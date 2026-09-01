declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export function getTelegramInitData(): string {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();

  if (webApp?.initData) {
    return webApp.initData;
  }

  if (import.meta.env.DEV && import.meta.env.VITE_DEV_MODE === "true") {
    return buildFakeInitData();
  }

  return "";
}

function buildFakeInitData(): string {
  // Поддержка ?devUser=<id>&devName=<имя> — в dev-режиме можно открыть
  // несколько вкладок браузера под разными игроками (для тестов обмена и PvP).
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("devUser")) || 999001;
  const name = params.get("devName") || "Дизайнер Тестовый";
  const user = {
    id,
    first_name: name.split(" ")[0] || "Дизайнер",
    last_name: name.split(" ").slice(1).join(" ") || "Тестовый",
    username: `designer_dev_${id}`
  };
  const initParams = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000))
  });
  initParams.set("hash", "dev-mode-fake-hash");
  return initParams.toString();
}
