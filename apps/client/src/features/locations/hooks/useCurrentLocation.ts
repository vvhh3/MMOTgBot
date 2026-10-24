import type { LocationStateResponse } from "@mmobot/shared";
import { useEffect,useState } from "react";
import { getLocationState } from "../api";

export function useCurrentLocation(token: string | null, locationId: string | null) {
  const [state, setState] = useState<LocationStateResponse | null>(null);
  const [failure, setFailure] = useState<{ locationId: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ready = locationId === null || state?.location.id === locationId;

  useEffect(() => {
    if (!locationId) {
      setState(null);
      setFailure(null);
      return;
    }
    if (!token || ready) return;

    const controller = new AbortController();
    setFailure(null);
    getLocationState(token, locationId, controller.signal).then(
      (nextState) => { if (!controller.signal.aborted) setState(nextState); },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setFailure({ locationId, message: error instanceof Error ? error.message : "Не удалось загрузить локацию." });
        }
      },
    );
    return () => controller.abort();
  }, [token, locationId, ready, attempt]);

  return {
    state: locationId !== null && ready ? state : null,
    onState: setState,
    ready,
    error: !ready && failure?.locationId === locationId ? failure.message : null,
    retry: () => {
      setFailure(null);
      setAttempt((value) => value + 1);
    },
  };
}
