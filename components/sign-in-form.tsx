"use client";

import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithPopup,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { firebaseBrowserAuth } from "@/lib/firebase/browser";

type AuthStep = "email" | "sign-in" | "create";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
  { label: "One symbol", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("auth/wrong-password") || code.includes("auth/invalid-credential")) {
    return "That email and password did not match. Try again or use the magic link.";
  }
  if (code.includes("auth/email-already-in-use")) {
    return "This email already has an account. Please sign in, reset the password, or use Google.";
  }
  if (code.includes("auth/weak-password")) return "Please choose a stronger password.";
  if (code.includes("auth/too-many-requests")) return "Too many attempts. Please wait a moment, then try again.";
  if (code.includes("auth/invalid-email")) return "Please enter a valid email address.";
  if (code.includes("auth/user-disabled")) return "This account is disabled. Please contact StoryGlow support.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<AuthStep>("email");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordChecks = useMemo(() => PASSWORD_RULES.map(rule => ({
    ...rule,
    passed: rule.test(password),
  })), [password]);
  const passwordIsStrong = passwordChecks.every(rule => rule.passed);

  function rememberAuthContext() {
    localStorage.setItem("storyglow-post-auth-path", nextPath);
    localStorage.setItem("storyglow-email", email);
    localStorage.setItem("storyglow-pending-marketing", String(marketing));
  }

  async function createStoryGlowSession(idToken: string, source: "password_signin" | "google_signin" | "email_signin") {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, marketingOptIn: marketing, source }),
    });
    if (!response.ok) throw new Error("Could not create your StoryGlow session.");
    localStorage.removeItem("storyglow-post-auth-path");
    router.push(nextPath);
    router.refresh();
  }

  async function continueWithEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      rememberAuthContext();
      const auth = await firebaseBrowserAuth();
      const methods = await fetchSignInMethodsForEmail(auth, email);
      setStep(methods.includes("password") ? "sign-in" : "create");
      setMessage(methods.includes("password")
        ? "Welcome back. Enter your password to open your StoryGlow library."
        : "Create a password to keep this StoryGlow account safe.");
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function passwordAuth(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const auth = await firebaseBrowserAuth();
      const credential = step === "create"
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await createStoryGlowSession(idToken, "password_signin");
    } catch (error) {
      setMessage(authErrorMessage(error));
      setBusy(false);
    }
  }

  async function magicLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      rememberAuthContext();
      await sendSignInLinkToEmail(await firebaseBrowserAuth(), email, {
        url: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        handleCodeInApp: true,
      });
      setMessage("Check your email for your secure sign-in link.");
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setBusy(true);
    setMessage("");
    try {
      await sendPasswordResetEmail(await firebaseBrowserAuth(), email);
      setMessage("Password reset email sent. Check your inbox, then come back to sign in.");
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setMessage("");
    try {
      const credential = await signInWithPopup(await firebaseBrowserAuth(), new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();
      await createStoryGlowSession(idToken, "google_signin");
    } catch (error) {
      setMessage(authErrorMessage(error));
      setBusy(false);
    }
  }

  const passwordHelpId = "password-help";

  return (
    <div className="auth-panel">
      <p className="section-label">Keep their story safe</p>
      <h1>Sign in to StoryGlow</h1>
      <p>Use email and password, Google, or a secure email link to open your private story library on any device.</p>
      {step === "email" ? <form onSubmit={continueWithEmail}>
        <label>Email address<input value={email} onChange={event => setEmail(event.target.value)} type="email" required autoComplete="email" /></label>
        <label className="checkbox"><input checked={marketing} onChange={event => setMarketing(event.target.checked)} type="checkbox" /><span>Send me occasional StoryGlow news and new story ideas.</span></label>
        <button className="button full" disabled={busy}>Continue</button>
      </form> : <form onSubmit={passwordAuth}>
        <div className="auth-step-top">
          <strong>{email}</strong>
          <button className="text-button" type="button" onClick={() => setStep("email")} disabled={busy}>Change</button>
        </div>
        <label>
          Password
          <span className="password-input-wrap">
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              required
              autoComplete={step === "create" ? "new-password" : "current-password"}
              aria-describedby={step === "create" ? passwordHelpId : undefined}
            />
            <button type="button" onClick={() => setShowPassword(value => !value)} disabled={busy}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {step === "create" ? <>
          <ul className="password-rules" id={passwordHelpId}>
            {passwordChecks.map(rule => <li className={rule.passed ? "passed" : ""} key={rule.label}>{rule.label}</li>)}
          </ul>
          <label>Confirm password<input value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} type={showPassword ? "text" : "password"} required autoComplete="new-password" /></label>
        </> : <button className="text-button auth-inline-action" type="button" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
        <button className="button full" disabled={busy || (step === "create" && (!passwordIsStrong || password !== confirmPassword))}>
          {step === "create" ? "Create account" : "Sign in"}
        </button>
      </form>}
      {email ? <form className="magic-link-form" onSubmit={magicLink}>
        <button className="text-button" disabled={busy}>Email me a magic sign-in link instead</button>
      </form> : null}
      <div className="or"><span>or</span></div>
      <button className="google-button" onClick={google} disabled={busy}><b>G</b> Continue with Google</button>
      <p className="form-message" role="status">{message}</p>
      <small>Story access and service emails never depend on marketing consent.</small>
    </div>
  );
}
