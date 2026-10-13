import { useEffect, useState } from 'react';
import { useStore } from '../store/store';

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div className={`toast${visible ? ' show' : ''}`} role="status" aria-live="polite">
      {toast?.message}
    </div>
  );
}
