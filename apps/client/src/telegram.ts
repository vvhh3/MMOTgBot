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
  const user = {
    id: 999001,
    first_name: "Дизайнер",
    last_name: "Тестовый",
    username: "designer_dev"
  };
  const params = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000))
  });
  params.set("hash", "dev-mode-fake-hash");
  return params.toString();
}
