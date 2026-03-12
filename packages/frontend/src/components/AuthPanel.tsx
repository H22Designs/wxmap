import type { ReactNode } from 'react';
import type { LoginResult } from '../services/api';

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
    <>
      <h2>Auth test panel</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
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
      <p aria-live="polite">
        Auth status: <strong>{authStatus}</strong>
      </p>
      {authError ? <p role="alert" style={{ color: '#a40000' }}>{authError}</p> : null}
      {session ? (
        <>
          <p>
            Logged in as <strong>{session.user.username}</strong> ({session.user.role})
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
          <p style={{ wordBreak: 'break-all' }}>
            Token: <code>{session.accessToken}</code>
          </p>
        </>
      ) : null}
      {adminActions}
    </>
  );
}
