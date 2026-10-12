"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  type AuthUser,
} from "@/lib/auth-storage";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored || stored.role !== "PARENT") {
      router.replace("/login");
      return;
    }
    setUser(stored);
    setReady(true);
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await api.post("/auth/logout");
    } catch {
      // clear anyway
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  if (!ready || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
        <p className="text-sm text-text-secondary">Checking your session…</p>
      </main>
    );
  }

  const students = user.parentProfile?.students ?? [];

  return (
    <main className="min-h-dvh bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-primary">
              Straight Line Academy
            </p>
            <h1 className="text-lg font-semibold text-text">Parent</h1>
          </div>
          <Button
            variant="secondary"
            onClick={handleSignOut}
            isLoading={signingOut}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h2 className="text-xl font-semibold text-text">
            Welcome, {user.fullName}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            You are signed in. Classes, attendance, exams, and fees will be
            added next.
          </p>
          {user.mustChangePassword ? (
            <p className="mt-3 rounded-md border border-warning/30 bg-amber-50 px-3 py-2 text-sm text-warning">
              Please change your temporary password when that feature is ready.
            </p>
          ) : null}
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-secondary">Email</dt>
              <dd className="mt-0.5 font-medium text-text">{user.email}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Phone</dt>
              <dd className="mt-0.5 font-medium text-text">
                {user.parentProfile?.phone || user.phone || "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h3 className="text-base font-semibold text-text">Your students</h3>
          {students.length === 0 ? (
            <p className="mt-2 text-sm text-text-secondary">
              No students linked yet. Ask the CEO to register your child.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {students.map((student) => (
                <li
                  key={student.id}
                  className="rounded-xl border border-border bg-surface-muted px-4 py-3"
                >
                  <p className="font-medium text-text">{student.fullName}</p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {student.className ?? "Class not set"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
