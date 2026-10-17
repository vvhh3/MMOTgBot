const pendingImages = new Map<string, Promise<void>>();
const readyImages = new Map<string, HTMLImageElement>();

export function isImageReady(url: string): boolean {
  return readyImages.has(url);
}

// Keep decoded images available when a route mounts, and share concurrent loads.
export function preloadImage(url: string): Promise<void> {
  if (isImageReady(url)) return Promise.resolve();
  const pending = pendingImages.get(url);
  if (pending) return pending;

  const request = new Promise<void>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (error) {
        reject(error);
      } else {
        readyImages.set(url, image);
        resolve();
      }
    };
    const timeout = window.setTimeout(
      () => finish(new Error("Не удалось дождаться загрузки изображения. Попробуйте ещё раз.")),
      15_000,
    );
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().then(() => finish(), () => finish(new Error("Не удалось подготовить изображение.")));
      } else {
        finish();
      }
    };
    image.onerror = () => finish(new Error("Не удалось загрузить изображение. Попробуйте ещё раз."));
    image.src = url;
  }).finally(() => pendingImages.delete(url));

  pendingImages.set(url, request);
  return request;
}
