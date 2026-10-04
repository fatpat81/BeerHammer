// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Login Page Component
// Supabase email + Google OAuth authentication UI
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInAsGuest, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [callsign, setCallsign] = useState('');
  const [guestCallsign, setGuestCallsign] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const { error: authError } = await signInWithEmail(email, password);
        if (authError) {
          setError(`${authError.message}. Tip: You can also use Quick Launch below to start immediately.`);
        }
      } else {
        if (!callsign.trim()) {
          setError('Callsign is required.');
          setSubmitting(false);
          return;
        }
        const { error: authError } = await signUpWithEmail(email, password, callsign.trim());
        if (authError) {
          setError(`${authError.message}. Tip: You can also use Quick Launch below to start immediately.`);
        } else {
          setSuccessMessage('Check your email for a confirmation link.');
        }
      }
    } catch {
      setError('Cloud authentication server offline or unconfigured. You can use Quick Launch below to continue in offline mode.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    const { error: authError } = await signInWithGoogle();
    if (authError) setError(authError.message);
  };

  const handleGuestLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    signInAsGuest(guestCallsign.trim() || 'Battle-Brother');
  };

  if (isLoading) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-loading">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card animate-fade-in">
        {/* ── Branding ────────────────────────────────────────────────── */}
        <div className="login-brand">
          <h1 className="login-title">ForceOrg-40k</h1>
          <p className="login-subtitle">Warhammer 40K • 11th Edition Command Nexus</p>
        </div>

        {/* ── Quick Launch Section (Instant Access) ──────────────────── */}
        <div style={{
          background: 'rgba(200, 157, 60, 0.08)',
          border: '1px solid rgba(200, 157, 60, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1.25rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--c-trim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            ⚡ Instant Commander Access
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.35 }}>
            No password required. Build, edit, and save your battle forces directly in this browser.
          </p>

          <form onSubmit={handleGuestLaunch} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={guestCallsign}
              onChange={e => setGuestCallsign(e.target.value)}
              placeholder="Callsign (e.g. Captain Titus)"
              maxLength={40}
              className="login-input"
              style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
            />
            <button
              type="submit"
              className="login-btn login-btn--primary"
              style={{
                width: 'auto',
                padding: '0.45rem 0.9rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Enter ForceOrg →
            </button>
          </form>
        </div>

        <div className="login-divider" style={{ margin: '0.75rem 0' }}>
          <span>or sync with cloud account</span>
        </div>

        {/* ── Tab Toggle ──────────────────────────────────────────────── */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'login-tab--active' : ''}`}
            onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
          >
            Sign In
          </button>
          <button
            className={`login-tab ${mode === 'signup' ? 'login-tab--active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
          >
            Create Account
          </button>
        </div>

        {/* ── Form ────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'signup' && (
            <div className="login-field">
              <label htmlFor="callsign" className="login-label">Callsign</label>
              <input
                id="callsign"
                type="text"
                value={callsign}
                onChange={e => setCallsign(e.target.value)}
                placeholder="Commander Dante"
                maxLength={60}
                className="login-input"
                autoComplete="username"
              />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="battle-brother@imperium.io"
              className="login-input"
              autoComplete="email"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="login-input"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              <span className="login-error-icon">⚠</span>
              <div>
                <div>{error}</div>
                <button
                  type="button"
                  onClick={() => signInAsGuest('Commander')}
                  style={{
                    marginTop: '0.4rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--c-trim)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Enter as Guest Commander instead →
                </button>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="login-success" role="status">
              <span className="login-success-icon">✓</span>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            className="login-btn login-btn--primary"
            disabled={submitting}
          >
            {submitting
              ? 'Processing...'
              : mode === 'login'
                ? 'Sign In to Cloud'
                : 'Create Cloud Account'}
          </button>
        </form>

        {/* ── OAuth ───────────────────────────────────────────────────── */}
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="login-btn login-btn--google"
            onClick={handleGoogle}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" className="login-google-icon">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="login-footer">
          For the Emperor. Works online via Supabase Cloud or offline in local storage.
        </p>
      </div>
    </div>
  );
}
