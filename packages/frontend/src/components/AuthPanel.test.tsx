import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthPanel } from './AuthPanel';

describe('AuthPanel', () => {
  it('disables auth action buttons when submitting', () => {
    render(
      <AuthPanel
        username="demo"
        email="demo@example.com"
        password="password123"
        authStatus="logging-in"
        authError=""
        session={null}
        isSubmitting={true}
        onUsernameChange={vi.fn()}
        onEmailChange={vi.fn()}
        onPasswordChange={vi.fn()}
        onRegister={vi.fn()}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const workingButtons = screen.getAllByRole('button', { name: 'Working...' });
    expect(workingButtons).toHaveLength(2);
    expect(workingButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('calls login and register handlers', () => {
    const onRegister = vi.fn();
    const onLogin = vi.fn();

    render(
      <AuthPanel
        username="demo"
        email="demo@example.com"
        password="password123"
        authStatus="idle"
        authError=""
        session={null}
        isSubmitting={false}
        onUsernameChange={vi.fn()}
        onEmailChange={vi.fn()}
        onPasswordChange={vi.fn()}
        onRegister={onRegister}
        onLogin={onLogin}
        onLogout={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
