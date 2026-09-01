"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

const adminSessionKey = "kaushal-admin-session";

export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("ADMIN-001");
  const [password, setPassword] = useState("admin-demo");
  const [rememberDevice, setRememberDevice] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(adminSessionKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { name?: string; employeeCode?: string };
        if (parsed && typeof parsed === "object") {
          router.replace("/admin");
          return;
        }
        router.replace("/admin");
      } catch {
        window.localStorage.removeItem(adminSessionKey);
      }
    }
  }, [router]);

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeCode.trim() || !password.trim()) {
      setError("Enter your employee code and password to continue.");
      return;
    }
    if (employeeCode.trim().toUpperCase() !== "ADMIN-001" || password !== "admin-demo") {
      setError("We could not find that administrator code. Try ADMIN-001 with password admin-demo.");
      return;
    }
    setError(null);
    window.localStorage.setItem(
      adminSessionKey,
      JSON.stringify({ name: "Administrator", employeeCode: "ADMIN-001" }),
    );
    window.dispatchEvent(new Event("kaushal-admin-signed-in"));
    router.push("/admin");
  }

  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-intro">
        <div className="login-title-wrap">
          <h1 id="login-title">
            Sign in to your
            <br />
            administrator workspace
          </h1>
          <p>Use your administrator code to manage competency matrices. Prototype stores no real credentials.</p>
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
              placeholder="ADMIN-001"
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
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
            />{" "}
            <span>Remember this device</span>
          </label>
        </div>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <Button className="login-submit" variant="primary" type="submit">
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
            <p>Use the seeded administrator code to sign in as an administrator. This prototype stores no real credentials.</p>
            <div className="credential-codes">
              {["ADMIN-001"].map((code) => (
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
