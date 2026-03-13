import type { ReactNode } from 'react';
import type { LoginResult } from '../services/api';
import { panelStyle } from '../styles/ui';

type AuthPanelProps = {
  username: string;
  email: string;
  password: string;
  authStatus: string;
  authError: string;
  session: LoginResult | null;
  isSubmitting: boolean;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRegister: () => void;
  onLogin: () => void;
  onLogout: () => void;
  adminActions?: ReactNode;
};

export function AuthPanel({
  username,
  email,
  password,
  authStatus,
  authError,
  session,
  isSubmitting,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onRegister,
  onLogin,
  onLogout,
  adminActions
}: AuthPanelProps): JSX.Element {
  return (
    <section style={panelStyle} aria-label="Authentication panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Account access</h2>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 999,
            padding: '3px 10px',
            background: 'var(--wx-surface-strong, #f8fafc)',
            border: '1px solid var(--wx-border, #d1d5db)'
          }}
        >
          {session ? `Signed in as ${session.user.role}` : 'Signed out'}
        </span>
      </div>
      <p style={{ marginTop: 6, marginBottom: 12, color: 'var(--wx-muted, #475569)', fontSize: 13 }}>
        Sign in to save preferences, add stations, and access admin controls.
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 440 }}>
        <input
          aria-label="Username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="username"
          autoComplete="username"
        />
        <input
          aria-label="Email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="email"
          autoComplete="email"
        />
        <input
          aria-label="Password"
          value={password}
          type="password"
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="password (min 8 chars)"
          autoComplete="current-password"
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onRegister} disabled={isSubmitting}>
            {isSubmitting ? 'Working...' : 'Register'}
          </button>
          <button type="button" onClick={onLogin} disabled={isSubmitting}>
            {isSubmitting ? 'Working...' : 'Login'}
          </button>
        </div>
      </div>
      <p aria-live="polite" style={{ marginTop: 10 }}>
        Auth status: <strong>{authStatus}</strong>
      </p>
      {authError ? <p role="alert" style={{ color: '#a40000', marginTop: 0 }}>{authError}</p> : null}
      {session ? (
        <>
          <p style={{ marginBottom: 8 }}>
            Logged in as <strong>{session.user.username}</strong> ({session.user.role})
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
          <p style={{ wordBreak: 'break-all', marginBottom: 0, fontSize: 12, color: 'var(--wx-muted, #475569)' }}>
            Token: <code style={{ fontSize: 11 }}>{session.accessToken}</code>
          </p>
        </>
      ) : null}
      {adminActions}
    </section>
  );
}
