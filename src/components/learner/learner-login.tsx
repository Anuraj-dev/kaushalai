"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

type Official = { id: string; name: string; jobRoleName: string; employeeCode: string };

const storageKey = "kaushal-active-assessment";
const officialStorageKey = "kaushal-active-official";
const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong");
  return body;
};

export function LearnerLogin() {
  const router = useRouter();
  const [officials, setOfficials] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("MOSPI-0001");
  const [password, setPassword] = useState("kaushal-demo");
  const [rememberDevice, setRememberDevice] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // If already signed in, redirect to workspace — different URL for auth vs workspace
        const saved = window.localStorage.getItem(storageKey);
        const savedOfficial = window.localStorage.getItem(officialStorageKey);
        if (saved) {
          try {
            const restored = await request(`/api/learner/session?assessmentId=${encodeURIComponent(saved)}`);
            if (mounted && restored?.assessment?.id) {
              window.localStorage.setItem(officialStorageKey, JSON.stringify({ name: restored.official.name }));
              window.dispatchEvent(new Event("kaushal-assessment-started"));
              router.replace("/learner");
              return;
            }
          } catch {
            // Stale assessment id — drop both markers and show sign-in.
          }
          window.localStorage.removeItem(storageKey);
          window.localStorage.removeItem(officialStorageKey);
          window.dispatchEvent(new Event("kaushal-assessment-started"));
        } else if (savedOfficial) {
          // Official marker without an assessment id would bounce login ↔ workspace.
          window.localStorage.removeItem(officialStorageKey);
          window.dispatchEvent(new Event("kaushal-assessment-started"));
        }
        const list = await request("/api/officials?selectable=true");
        if (mounted) setOfficials(list);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load the official workspace");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function start(officialId: string) {
    setBusy(true);
    setError(null);
    try {
      const value = await request("/api/learner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", officialId }),
      });
      window.localStorage.setItem(storageKey, value.assessment.id);
      window.localStorage.setItem(officialStorageKey, JSON.stringify({ name: value.official.name }));
      window.dispatchEvent(new Event("kaushal-assessment-started"));
      router.push("/learner");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start assessment");
    } finally {
      setBusy(false);
    }
  }

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const official = officials.find((item) => item.employeeCode.toLowerCase() === employeeCode.trim().toLowerCase());
    if (!employeeCode.trim() || !password.trim()) {
      setError("Enter your employee code and password to continue.");
      return;
    }
    if (!official) {
      setError("We could not find that employee code. Try MOSPI-0001, MOSPI-0002, or MOSPI-0003.");
      return;
    }
    setError(null);
    void start(official.id);
  }

  if (loading) {
    return (
      <section className="loading-workspace" aria-busy="true" aria-live="polite">
        <div className="loading-header">
          <div>
            <span className="tag tag-lime">Official workspace</span>
            <h1>
              Preparing your
              <br />
              official workspace
            </h1>
            <p>Loading seeded profiles and checking for a saved assessment.</p>
          </div>
          <div className="loading-status">
            <span className="loading-mark" aria-hidden="true" />
            <span>Loading workspace data</span>
            <b>01</b>
          </div>
        </div>
        <div className="loading-progress" aria-hidden="true">
          <span />
        </div>
      </section>
    );
  }

  if (error && officials.length === 0) {
    return (
      <div className="surface error-state">
        <div className="alert" role="alert">
          {error}
        </div>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Try again <span aria-hidden="true">→</span>
        </Button>
      </div>
    );
  }

  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-intro">
        <div className="login-title-wrap">
          <h1 id="login-title">
            Sign in to your
            <br />
            official workspace
          </h1>
          <p>Use your employee code to access your competency assessment. Assessment remains pinned to its starting matrix version.</p>
        </div>
      </div>
      <form className="login-card" onSubmit={signIn}>
        <div className="login-fields">
          <label htmlFor="employee-code">Employee code</label>
          <div className={`login-input-wrap ${error ? "has-error" : ""}`}>
            <input
              id="employee-code"
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              autoComplete="username"
              placeholder="MOSPI-0001"
            />
            <Pencil size={16} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <span className="field-help">Enter your employee code to continue</span>
          <label htmlFor="password">Password</label>
          <div className="login-input-wrap">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
            </button>
          </div>
          <label className="remember-row">
            <input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} /> <span>Remember this device</span>
          </label>
        </div>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <Button className="login-submit" variant="primary" type="submit" disabled={busy}>
          Sign in <ArrowRight size={18} strokeWidth={1.7} />
        </Button>
        <button
          className="credential-toggle"
          type="button"
          onClick={() => {
            setShowCredentials((value) => !value);
            setError(null);
          }}
        >
          <span>{showCredentials ? "Use prefilled credentials" : "Change credentials"}</span>
          <span aria-hidden="true">{showCredentials ? "↑" : "↓"}</span>
        </button>
        {showCredentials && (
          <div className="credential-note">
            <strong>Demo credentials</strong>
            <p>Use one of the seeded employee codes to enter as a different official. This prototype stores no real credentials.</p>
            <div className="credential-codes">
              {["MOSPI-0001", "MOSPI-0002", "MOSPI-0003"].map((code) => (
                <button
                  className="credential-code-button"
                  key={code}
                  type="button"
                  onClick={() => {
                    setEmployeeCode(code);
                    setError(null);
                  }}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
