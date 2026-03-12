import type { LoginResult } from '../services/api';

type SessionBadgeProps = {
  session: LoginResult | null;
};

export function SessionBadge({ session }: SessionBadgeProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: '1px solid #d1d5db',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 13,
        backgroundColor: session ? '#ecfdf5' : '#f9fafb',
        color: '#111827'
      }}
    >
      {session ? `Session: ${session.user.username} (${session.user.role})` : 'Session: guest'}
    </div>
  );
}
