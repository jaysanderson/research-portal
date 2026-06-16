import { useEffect, useState } from 'react';
import { getConfig, currentKb, type PortalConfig, type KbInfo } from './api';
import { getCounters, type Counters } from './nuclia';

export function useConfig() {
  const [config, setConfig] = useState<PortalConfig | null>(null);
  useEffect(() => { getConfig().then(setConfig).catch(() => setConfig(null)); }, []);
  return config;
}

/** The currently-selected Knowledge Box; re-resolves when the user switches. */
export function useCurrentKb(): KbInfo | null {
  const config = useConfig();
  const [, bump] = useState(0);
  useEffect(() => {
    const h = () => bump((x) => x + 1);
    window.addEventListener('rp-kb-change', h);
    return () => window.removeEventListener('rp-kb-change', h);
  }, []);
  return currentKb(config);
}

export function useCounters(pollMs = 0) {
  const [counters, setCounters] = useState<Counters | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => getCounters().then((c) => active && setCounters(c)).catch((e) => active && setError(String(e)));
    load();
    const onKb = () => { setCounters(null); setError(null); load(); };
    window.addEventListener('rp-kb-change', onKb);
    let t: ReturnType<typeof setInterval> | undefined;
    if (pollMs > 0) t = setInterval(load, pollMs);
    return () => { active = false; if (t) clearInterval(t); window.removeEventListener('rp-kb-change', onKb); };
  }, [pollMs]);
  return { counters, error };
}
