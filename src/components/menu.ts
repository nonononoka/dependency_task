import { useEffect, useState, type CSSProperties, type RefObject } from 'react';

const MENU_MAX_HEIGHT = 280;

/**
 * 入力欄にぶら下がる候補リスト（position: fixed）の開閉と位置。
 * スクロールやリサイズに合わせて位置を追従させる。
 */
export function useAnchoredMenu(anchorRef: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const reposition = () => setRect(anchorRef.current?.getBoundingClientRect() ?? null);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, anchorRef]);

  const show = () => {
    setRect(anchorRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  return { open: open && rect !== null, show, hide: () => setOpen(false), style: rect ? menuPosition(rect) : undefined };
}

/** キーボードで選んだ候補が見えるようにスクロールする */
export function useScrollActiveIntoView(menuRef: RefObject<HTMLElement | null>, active: number) {
  useEffect(() => {
    menuRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [menuRef, active]);
}

/** 入力欄の下に出し、下に入りきらなければ上に出す。高さは画面内に収める */
function menuPosition(rect: DOMRect): CSSProperties {
  const margin = 8;
  const below = window.innerHeight - rect.bottom - margin;
  const above = rect.top - margin;
  if (below >= Math.min(MENU_MAX_HEIGHT, 160) || below >= above) {
    return { top: rect.bottom + 4, left: rect.left, maxHeight: Math.min(MENU_MAX_HEIGHT, below - 4) };
  }
  return { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxHeight: Math.min(MENU_MAX_HEIGHT, above - 4) };
}
