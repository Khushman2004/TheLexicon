import { useState } from "react";
import { ArrowRight, BookOpen, Eye, EyeOff, Feather, Sparkles } from "lucide-react";

export default function AuthPage({ onAuthenticate }) {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isRegistering = mode === "register";

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const details = {
      email: form.get("email").trim(),
      password: form.get("password"),
    };
    if (isRegistering) {
      details.username = form.get("username").trim();
      details.fullName = form.get("fullName").trim();
    }

    try {
      await onAuthenticate(mode, details);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setError("");
    setMode(nextMode);
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <div className="brand-mark"><Feather size={21} strokeWidth={1.8} /></div>
          <span>the lexicon</span>
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow"><Sparkles size={14} /> A little more wonder, every day</p>
          <h1>Keep the words<br />that <em>stay with you.</em></h1>
          <p className="auth-intro">
            A personal home for new words, half-remembered phrases, books in progress,
            and all the language you don&apos;t want to lose.
          </p>
          <div className="story-note">
            <span className="note-rule" />
            <p>“Words are, of course, the most powerful drug used by mankind.”</p>
            <span className="note-byline">— Rudyard Kipling</span>
          </div>
        </div>
        <div className="story-bottom">
          <span>YOUR PRIVATE CORNER OF THE INTERNET</span>
          <span>EST. FOR THE CURIOUS</span>
        </div>
        <div className="story-orbit orbit-one" />
        <div className="story-orbit orbit-two" />
        <div className="story-seed">a.</div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <div className="brand-mark"><Feather size={19} /></div>
          <span>the lexicon</span>
        </div>
        <div className="auth-card">
          <div className="auth-card-icon"><BookOpen size={20} /></div>
          <p className="eyebrow">{isRegistering ? "YOUR STORY STARTS HERE" : "WELCOME BACK"}</p>
          <h2>{isRegistering ? "Make room for words." : "Good to see you."}</h2>
          <p className="auth-subtitle">
            {isRegistering
              ? "Create your account and start collecting."
              : "Pick up right where your curiosity left off."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              className={!isRegistering ? "active" : ""}
              onClick={() => changeMode("login")}
              role="tab"
              aria-selected={!isRegistering}
              type="button"
            >
              Sign in
            </button>
            <button
              className={isRegistering ? "active" : ""}
              onClick={() => changeMode("register")}
              role="tab"
              aria-selected={isRegistering}
              type="button"
            >
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegistering && (
              <>
                <label>
                  Your name <span className="optional-label">OPTIONAL</span>
                  <input name="fullName" type="text" autoComplete="name" placeholder="How should we call you?" maxLength={100} />
                </label>
                <label>
                  Username
                  <input
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="A name for your corner"
                    minLength={3}
                    maxLength={32}
                    pattern="[a-zA-Z0-9_]{3,32}"
                    title="Use 3–32 letters, numbers, or underscores."
                    required
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>
            <label>
              Password
              <span className="password-wrap">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  placeholder={isRegistering ? "At least 8 characters" : "Your password"}
                  minLength={isRegistering ? 8 : undefined}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" disabled={busy} type="submit">
              {busy ? "One moment…" : isRegistering ? "Create my account" : "Sign in to your library"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-footnote">
            {isRegistering ? "Already have a little corner here?" : "New to The Lexicon?"}
            {" "}
            <button type="button" onClick={() => changeMode(isRegistering ? "login" : "register")}>
              {isRegistering ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="privacy-note">Your library is yours alone. Always.</p>
        </div>
        <span className="auth-decoration decoration-one">Aa</span>
        <span className="auth-decoration decoration-two">“ ”</span>
      </section>
    </main>
  );
}
