import { useCallback, useEffect, useRef, useState } from 'react';

export interface Countdown {
  secondsLeft: number;
  start: (seconds: number) => void;
}

export function useCountdown(): Countdown {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (seconds: number): void => {
      clear();
      if (seconds <= 0) {
        setSecondsLeft(0);
        return;
      }
      setSecondsLeft(seconds);
      timerRef.current = setInterval(() => {
        setSecondsLeft((current) => Math.max(current - 1, 0));
      }, 1000);
    },
    [clear]
  );

  useEffect(() => {
    if (secondsLeft === 0) clear();
  }, [secondsLeft, clear]);

  useEffect(() => clear, [clear]);

  return { secondsLeft, start };
}
