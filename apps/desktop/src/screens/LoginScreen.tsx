import { FormEvent, useState } from "react";
import "./LoginScreen.css";

type LoginScreenProps = {
  onLogin: (email: string, password: string) => void;
  errorMessage?: string | null;
  isLoading?: boolean;
};

export function LoginScreen({
  onLogin,
  errorMessage,
  isLoading = false,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      return;
    }

    onLogin(email.trim(), password);
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-brand-header">
            <div className="login-brand-mark">X</div>

            <div>
              <div className="login-brand-name">
                Enterprise<span>X</span>
              </div>

              <div className="login-brand-subtitle">
                Enterprise Resource Planning
              </div>
            </div>
          </div>

          <div className="login-brand-message">
            <div className="login-eyebrow">
              ENTERPRISE PLATFORM
            </div>

            <h2>
              One system.
              <br />
              One data model.
            </h2>

            <p>
              Connected business processes across finance,
              procurement, supply chain, manufacturing and
              operations.
            </p>
          </div>
        </div>

        <div className="login-brand-footer">
          EnterpriseX ERP
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-header">
            <div className="login-eyebrow login-eyebrow-light">
              WORKSPACE ACCESS
            </div>

            <h1>Welcome back</h1>

            <p>
              Sign in to access your EnterpriseX workspace.
            </p>
          </div>

          {errorMessage && (
            <div className="login-error" role="alert">
              <span className="login-error-icon">!</span>

              <div>
                <strong>Sign-in failed</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isLoading || !email.trim() || !password}
            >
              {isLoading ? (
                <>
                  <span className="login-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <span className="login-arrow">→</span>
                </>
              )}
            </button>
          </form>

          <div className="login-security">
            <span className="login-status-dot" />
            Secure enterprise authentication
          </div>

          <div className="login-version">
            EnterpriseX · Foundation V1
          </div>
        </div>
      </section>
    </main>
  );
}