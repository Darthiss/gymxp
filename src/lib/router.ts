import { useEffect, useState } from 'react';

export interface Route {
  path: string[]; // e.g. ['guide', 'Leg_Press']
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string, replace = false) {
  const hash = '#/' + to.replace(/^\/+/, '');
  if (replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else location.hash = hash;
}

export function back(fallback = '') {
  if (history.length > 1) history.back();
  else navigate(fallback);
}
