"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./login.module.css";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("Sorry, your password was incorrect.");
        setLoading(false);
        return;
      }

      const from = searchParams.get("from") || "/";
      window.location.href = from;
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.wordmark}>Guardrails</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="password"
            placeholder="Password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.button} disabled={loading || !password}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
