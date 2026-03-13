type Toast = {
  type: 'info' | 'success' | 'error';
  message: string;
  actionLabel?: string;
};

type ToastBannerProps = {
  toast: Toast;
  onClose: () => void;
  onAction?: () => void;
};

function getBackgroundColor(type: Toast['type']): string {
  if (type === 'success') {
    return '#dcfce7';
  }

  if (type === 'error') {
    return '#fee2e2';
  }

  return '#dbeafe';
}

function getForegroundColor(type: Toast['type']): string {
  if (type === 'success') {
    return '#14532d';
  }

  if (type === 'error') {
    return '#7f1d1d';
  }

  return '#1e3a8a';
}

export function ToastBanner({ toast, onClose, onAction }: ToastBannerProps): JSX.Element {
  const foreground = getForegroundColor(toast.type);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 1100,
        border: '1px solid #d1d5db',
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 260,
        backgroundColor: getBackgroundColor(toast.type),
        color: foreground,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        {toast.actionLabel && onAction ? (
          <button
            aria-label={toast.actionLabel}
            type="button"
            onClick={onAction}
            style={{
              border: '1px solid #94a3b8',
              borderRadius: 8,
              padding: '2px 8px',
              background: 'rgba(255,255,255,0.7)',
              color: foreground,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {toast.actionLabel}
          </button>
        ) : null}
        <button
          aria-label="Dismiss notification"
          type="button"
          onClick={onClose}
          style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: foreground }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export type { Toast };
