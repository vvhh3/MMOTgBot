import { useEffect,useState } from "react";
import { isImageReady,preloadImage } from "../lib/preloadImage";

export function usePreloadedImage(url: string | null) {
  const [result, setResult] = useState<{ url: string; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ready = !url || isImageReady(url);

  useEffect(() => {
    if (!url) return;
    // A background preload may finish between rendering and this effect.
    if (isImageReady(url)) {
      setResult({ url, error: null });
      return;
    }
    let cancelled = false;
    setResult(null);
    preloadImage(url).then(
      () => { if (!cancelled) setResult({ url, error: null }); },
      (error: unknown) => {
        if (!cancelled) {
          setResult({ url, error: error instanceof Error ? error.message : "Не удалось загрузить изображение." });
        }
      },
    );
    return () => { cancelled = true; };
  }, [url, attempt]);

  return {
    ready,
    error: !ready && result?.url === url ? result.error : null,
    retry: () => {
      setResult(null);
      setAttempt((value) => value + 1);
    },
  };
}
