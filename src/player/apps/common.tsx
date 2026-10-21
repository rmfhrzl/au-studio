import { useEffect, type ReactNode } from 'react';
import { Icon } from '../icons';

/** Top navigation bar used by every app page. */
export function NavBar({
  title,
  onBack,
  right,
  left,
  backLabel = 'Back',
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  left?: ReactNode;
  backLabel?: string;
}) {
  return (
    <div className="nav-bar">
      {onBack ? (
        <button className="nav-btn" onClick={onBack} aria-label={backLabel}>
          <Icon name="chevron-left" size={18} />
          <span>{backLabel}</span>
        </button>
      ) : (
        <span style={{ width: 8 }} />
      )}
      <span className="nav-title">{title}</span>
      {right ?? <span style={{ width: 8 }} />}
      {left}
    </div>
  );
}

/** Circular avatar rendered from a character colour or an image source. */
export function Avatar({
  name,
  color,
  src,
  size = 'normal',
}: {
  name: string;
  color?: string;
  src?: string;
  size?: 'small' | 'normal' | 'large';
}) {
  const className = size === 'normal' ? 'avatar' : `avatar ${size}`;
  const style: React.CSSProperties = {
    background: src ? `url("${src}") center/cover` : color ?? 'linear-gradient(180deg,#6f8cff,#3b4fc4)',
  };
  return (
    <span className={className} style={style} aria-hidden="true">
      {!src && (name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Bottom sheet with a backdrop and ESC handling. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/** Generic scrollable page body. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="scroll">{children}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
