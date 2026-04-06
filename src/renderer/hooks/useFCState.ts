import { useState, useEffect } from 'react';
import type { FCState } from '@shared/types/fcState.types';
import { EMPTY_FC_STATE } from '@shared/types/fcState.types';

export function useFCState(): FCState {
  const [state, setState] = useState<FCState>(EMPTY_FC_STATE);

  useEffect(() => {
    window.betaflight
      .getFCState()
      .then((cached) => {
        if (cached) setState(cached);
      })
      .catch(() => {});

    const unsub = window.betaflight.onFCStateChanged((newState) => {
      setState(newState);
    });

    return unsub;
  }, []);

  return state;
}
