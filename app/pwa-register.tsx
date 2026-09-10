'use client';

import { useEffect, useState } from 'react';

export function PwaRegister() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (
      'serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')
    )
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return (
    <output
      className={`connection-status ${online ? 'online' : 'offline'}`}
      aria-live="polite"
    >
      {online ? 'Online' : 'Sem conexão — alterações não serão salvas'}
    </output>
  );
}
