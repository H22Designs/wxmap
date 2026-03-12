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
        border: '1px solid var(--wx-border, #d1d5db)',
        borderRadius: 999,
        padding: '7px 12px',
        fontSize: 13,
        fontWeight: 600,
        background: session
          ? 'linear-gradient(120deg, rgba(16, 185, 129, 0.2), rgba(14, 165, 233, 0.2))'
          : 'linear-gradient(120deg, rgba(148, 163, 184, 0.16), rgba(148, 163, 184, 0.08))',
        color: 'var(--wx-text, #111827)',
        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
        backdropFilter: 'blur(4px)'
      }}
    >
      {session ? `Session: ${session.user.username} (${session.user.role})` : 'Session: guest'}
    </div>
  );
}
