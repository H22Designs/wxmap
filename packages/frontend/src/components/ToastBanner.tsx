type Toast = {
  type: 'info' | 'success' | 'error';
  message: string;
};

type ToastBannerProps = {
  toast: Toast;
  onClose: () => void;
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

export function ToastBanner({ toast, onClose }: ToastBannerProps): JSX.Element {
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
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10
      }}
    >
      <span>{toast.message}</span>
      <button
        aria-label="Dismiss notification"
        type="button"
        onClick={onClose}
        style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }}
      >
        ×
      </button>
    </div>
  );
}

export type { Toast };
