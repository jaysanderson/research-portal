import { useEffect, useState } from 'react';
import { getConfig, currentKb, type PortalConfig, type KbInfo } from './api';
import { getCounters, type Counters } from './nuclia';
import { generateProfile, readProfileCache, type KbProfile } from './kbProfile';

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

/** KB-tailored copy (subject, tagline, example questions, topics). Cached per KB. */
export function useKbProfile(): { profile: KbProfile | null; loading: boolean } {
  const kb = useCurrentKb();
  const [profile, setProfile] = useState<KbProfile | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!kb?.id || !kb.connected) { setProfile(null); return; }
    const cached = readProfileCache(kb.id);
    if (cached) { setProfile(cached); return; }
    let active = true; const ctrl = new AbortController();
    setProfile(null); setLoading(true);
    generateProfile(kb.id, { signal: ctrl.signal })
      .then((p) => active && setProfile(p)).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; ctrl.abort(); };
  }, [kb?.id, kb?.connected]);
  return { profile, loading };
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
