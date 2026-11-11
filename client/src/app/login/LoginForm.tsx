'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import styles from './page.module.css';

const roleOptions = [
  { value: 'provider', label: 'Healthcare Provider' },
  { value: 'coordinator', label: 'Care Coordinator' },
  { value: 'respiratory', label: 'Respiratory Care Team' },
] as const;

type LoginRole = (typeof roleOptions)[number]['value'];

const roleIndicatorClass: Record<LoginRole, string> = {
  provider: styles.roleIndicatorProvider,
  coordinator: styles.roleIndicatorCoordinator,
  respiratory: styles.roleIndicatorRespiratory,
};

export default function LoginForm({
  showUnauthenticatedMessage,
}: {
  showUnauthenticatedMessage: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(
    showUnauthenticatedMessage
      ? 'You are not authenticated. Sign in to continue.'
      : '',
  );
  const [busy, setBusy] = useState(false);
  const [activeRole, setActiveRole] = useState<LoginRole>('provider');
  const [view, setView] = useState<'signin' | 'forgot'>('signin');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const router = useRouter();

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api<{ authenticated: boolean }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      router.replace('/overview');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Sign in could not be completed. Try again.',
      );
      setBusy(false);
    }
  }

  function openForgotPassword() {
    setForgotEmail('');
    setForgotError('');
    setResetNotice('');
    setView('forgot');
  }

  function returnToSignIn() {
    setForgotError('');
    setResetNotice('');
    setView('signin');
  }

  function requestResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = forgotEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) {
      setForgotError(
        'Enter a valid email address, for example you@clinic.org.',
      );
      return;
    }

    setForgotEmail(normalizedEmail);
    setForgotError('');
    setResetNotice(
      `If an account exists for ${normalizedEmail}, a reset link is on its way. In this demo no email is sent.`,
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-label="Adherium sign in">
        <div className={styles.formPanel}>
          <div className={styles.brand}>
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="11" cy="11" r="8" fill="#087bff" />
              <circle cx="21" cy="11" r="8" fill="#087bff" />
              <circle cx="16" cy="21" r="8" fill="#111" />
              <circle cx="16" cy="15.5" r="3" fill="#fff" />
            </svg>
            <span>Adherium</span>
          </div>

          <div className={styles.formBody}>
            {view === 'signin' ? (
              <>
                <h1 id="login-title">Sign in to Adherium</h1>
                <p className={styles.subtitle}>
                  Respiratory monitoring for care teams.
                </p>

                <div
                  className={styles.roleSelector}
                  role="radiogroup"
                  aria-label="Sign in as"
                >
                  <span
                    className={`${styles.roleIndicator} ${roleIndicatorClass[activeRole]}`}
                    aria-hidden="true"
                  />
                  {roleOptions.map((role) => (
                    <button
                      className={`${styles.roleOption} ${
                        activeRole === role.value
                          ? styles.roleOptionSelected
                          : ''
                      }`}
                      key={role.value}
                      type="button"
                      role="radio"
                      aria-checked={activeRole === role.value}
                      onClick={() => setActiveRole(role.value)}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>

                <form className={styles.form} onSubmit={signIn}>
                  <div className={styles.field}>
                    <label htmlFor="email">Work email</label>
                    <input
                      className={styles.input}
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="you@clinic.org"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="password">Password</label>
                    <div className={styles.passwordWrap}>
                      <input
                        className={styles.input}
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                      <span className={styles.eye} aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  {message ? (
                    <p className={styles.message} role="alert">
                      {message}
                    </p>
                  ) : null}
                  <div className={styles.formRow}>
                    <label className={styles.remember}>
                      <input type="checkbox" />
                      <span>Keep me signed in</span>
                    </label>
                    <button
                      className={styles.link}
                      type="button"
                      onClick={openForgotPassword}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <button
                    className={styles.submit}
                    type="submit"
                    disabled={busy}
                  >
                    <span className={styles.submitLabel}>
                      {busy ? 'Signing in…' : 'Sign in'}
                    </span>
                    <i className={styles.submitIcon} aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 17 17 7M8 7h9v9" />
                      </svg>
                    </i>
                  </button>
                </form>
                <div className={styles.or}>or</div>
                <button
                  className={styles.sso}
                  type="button"
                  aria-disabled="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6 6 0 0 1 3 6" />
                  </svg>
                  Continue with organization SSO
                </button>
                <div className={styles.demo}>
                  <span>
                    Demo sign-in. Any work email and a password of 8 or more
                    characters.
                  </span>
                  <button type="button" aria-disabled="true">
                    Fill demo details
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 id="reset-title">Reset your password</h1>
                <p className={styles.subtitle}>
                  Enter your work email and we’ll send a link to choose a new
                  password.
                </p>

                {resetNotice ? (
                  <p className={styles.resetNotice} role="status">
                    {resetNotice}
                  </p>
                ) : null}

                <form
                  className={styles.form}
                  onSubmit={requestResetLink}
                  noValidate
                >
                  <div className={styles.field}>
                    <label htmlFor="reset-email">Work email</label>
                    <input
                      className={styles.input}
                      id="reset-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      aria-describedby={
                        forgotError ? 'forgot-error' : undefined
                      }
                      placeholder="you@clinic.org"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                      required
                    />
                    {forgotError ? (
                      <span
                        className={styles.fieldError}
                        id="forgot-error"
                        role="alert"
                      >
                        {forgotError}
                      </span>
                    ) : null}
                  </div>
                  <button
                    className={`${styles.submit} ${styles.resetSubmit}`}
                    type="submit"
                  >
                    <span className={styles.submitLabel}>Send reset link</span>
                    <i className={styles.submitIcon} aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 17 17 7M8 7h9v9" />
                      </svg>
                    </i>
                  </button>
                </form>
                <button
                  className={`${styles.link} ${styles.backLink}`}
                  type="button"
                  onClick={returnToSignIn}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>

          <div className={styles.foot}>
            <span>Synthetic demo. No real accounts or patient data.</span>
            <span>Respiratory remote monitoring</span>
          </div>
        </div>

        <aside className={styles.visual}>
          <span className={styles.pill}>Demo data</span>
          <h2 className={styles.visualHeading}>
            Controller doses and rescue use, <b>synced from every inhaler.</b>
          </h2>
          <p className={styles.visualCopy}>
            Sign in to see which patients are on track this week and who needs a
            call.
          </p>
          <div className={styles.matrix} aria-hidden="true">
            <span className={styles.dayLabel}>M</span>
            <span className={styles.dayLabel}>T</span>
            <span className={styles.dayLabel}>W</span>
            <span className={styles.dayLabel}>T</span>
            <span className={styles.dayLabel}>F</span>
            <span className={styles.dayLabel}>S</span>
            <span className={styles.dayLabel}>S</span>
            <i className={styles.dotBlue} />
            <i className={styles.dotBlue} />
            <i className={styles.dotSky} />
            <i className={styles.dotInk} />
            <i className={styles.dotBlue} />
            <i className={styles.dotSky} />
            <i className={styles.dotBlue} />
            <i className={styles.dotSky} />
            <i className={styles.dotInk} />
            <i className={styles.dotBlue} />
            <i className={styles.dotBlue} />
            <i className={styles.dotSky} />
            <i className={styles.dotBlue} />
            <i className={styles.dotInk} />
            <i className={styles.dotInk} />
            <i className={styles.dotSky} />
            <i className={styles.dotBlue} />
            <i className={styles.dotInk} />
            <i className={styles.dotSky} />
            <i className={styles.dotBlue} />
            <i className={styles.dotBlue} />
          </div>
          <div className={styles.stats} aria-label="Synthetic demo snapshot">
            <div className={styles.stat}>
              <span className={styles.statLabel}>Patients monitored</span>
              <strong className={styles.statValue}>248</strong>
            </div>
            <div className={`${styles.stat} ${styles.highlight}`}>
              <span className={styles.statLabel}>Doses taken this week</span>
              <strong className={styles.statValue}>83%</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Inhalers connected</span>
              <strong className={styles.statValue}>214</strong>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
