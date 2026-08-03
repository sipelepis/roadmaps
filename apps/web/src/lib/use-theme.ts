import { useCallback, useEffect, useState } from 'react';

const KEY = 'rag-theme';

/**
 * Dark is the default, so only a stored `light` choice does anything — the
 * inline script in index.html applies it before first paint to avoid a flash.
 */
export function useTheme(): { light: boolean; toggle: () => void } {
  const [light, setLight] = useState(() => localStorage.getItem(KEY) === 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
    localStorage.setItem(KEY, light ? 'light' : 'dark');
  }, [light]);

  return { light, toggle: useCallback(() => setLight((v) => !v), []) };
}
