import { useEffect, useState } from 'react';
import { getConfig, type PortalConfig } from './api';
import { getCounters, type Counters } from './nuclia';

export function useConfig() {
  const [config, setConfig] = useState<PortalConfig | null>(null);
  useEffect(() => { getConfig().then(setConfig).catch(() => setConfig(null)); }, []);
  return config;
}

export function useCounters(pollMs = 0) {
  const [counters, setCounters] = useState<Counters | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => getCounters().then((c) => active && setCounters(c)).catch((e) => active && setError(String(e)));
    load();
    if (pollMs > 0) {
      const t = setInterval(load, pollMs);
      return () => { active = false; clearInterval(t); };
    }
    return () => { active = false; };
  }, [pollMs]);
  return { counters, error };
}
