import { type FormEvent, useState } from "react";
import styles from "../../App.module.css";
import { Icon } from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { useAuth } from "@shared/auth/AuthContext";
import { HeaderButton } from "../../components/CustomerUi";

export function AuthScreen({
  kind,
  onBack,
  onContinue,
}: {
  kind: "login" | "signup";
  onBack: () => void;
  onContinue: () => void;
}) {
  const signup = kind === "signup";
  const {
    signInWithOAuth,
    signInWithPassword,
    signUp,
    loading: authLoading,
  } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = pending || authLoading;

  // Social providers stay visible but disabled until each is configured in
  // Supabase. Email is the only live method for now — flip `enabled` to true
  // once a provider's credentials are set up.
  const providers = [
    { id: "apple", label: "Apple", enabled: false },
    { id: "google", label: "Google", enabled: true },
    { id: "facebook", label: "Facebook", enabled: false },
  ] as const;

  const handleOAuth = async (provider: "google" | "apple" | "facebook") => {
    setError("");
    setPending(true);
    const { error: oauthError } = await signInWithOAuth(provider);
    // A successful call redirects the browser away; only errors return here.
    if (oauthError) {
      setError(oauthError.message);
      setPending(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (signup && password !== passwordConfirmation) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPending(true);
    const { error: submitError } = signup
      ? await signUp({ email, password, firstName, lastName })
      : await signInWithPassword(email, password);
    if (submitError) {
      setError(submitError.message);
      setPending(false);
      return;
    }
    onContinue();
  };

  return (
    <main className={`${styles["page-screen"]} auth-screen`}>
      <header className={`${styles["page-header"]} ${styles["auth-header"]}`}>
        <HeaderButton
          icon="back"
          label="Back to order confirmation"
          onClick={onBack}
        />
        <h1>{signup ? "Create account" : "Log in"}</h1>
        <span
          className={`${styles["auth-header-spacer"]}`}
          aria-hidden="true"
        />
      </header>
      <p className={`${styles["auth-intro"]}`}>
        {signup
          ? "Create your account with your email to order faster next time."
          : "Welcome back. Log in with your email."}
      </p>
      <div className={`${styles["auth-social"]}`}>
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className={`${styles["auth-social-button"]}`}
            disabled={!provider.enabled || busy}
            title={provider.enabled ? undefined : "Coming soon"}
            onClick={() => handleOAuth(provider.id)}
          >
            <Icon name={provider.id} size={18} />
            <span>
              {signup ? "Sign up" : "Log in"} with {provider.label}
            </span>
            {!provider.enabled && (
              <span className={`${styles["auth-social-soon"]}`}>
                Coming soon
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={`${styles["auth-divider"]}`} role="separator">
        <span>or continue with email</span>
      </div>
      <form className={`${styles["auth-form"]}`} onSubmit={handleSubmit}>
        {signup && (
          <div className={`${styles["auth-name-row"]}`}>
            <label>
              First name
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </label>
            <label>
              Last name
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </label>
          </div>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError("");
            }}
            required
          />
        </label>
        {signup && (
          <label>
            Re-enter password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwordConfirmation}
              onChange={(event) => {
                setPasswordConfirmation(event.target.value);
                setPasswordError("");
              }}
              aria-describedby={passwordError ? "password-error" : undefined}
              required
            />
          </label>
        )}
        {passwordError && (
          <p
            className={`${styles["auth-error"]}`}
            id="password-error"
            role="alert"
          >
            {passwordError}
          </p>
        )}
        {error && (
          <p className={`${styles["auth-error"]}`} role="alert">
            {error}
          </p>
        )}
        <Button
          variant="outline"
          fullWidth
          type="submit"
          className="mt-1"
          disabled={busy}
        >
          {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
        </Button>
      </form>
    </main>
  );
}
