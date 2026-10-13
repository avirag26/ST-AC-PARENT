"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError, api } from "@/lib/api";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  type AuthUser,
} from "@/lib/auth-storage";

type ClassItem = {
  sessionId: string;
  studentId: string;
  studentName: string;
  title: string | null;
  subjectName: string | null;
  mode: "ONLINE" | "OFFLINE";
  status: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  tutorName: string;
  batch: { id: string; name: string; className: string } | null;
  attendance: {
    status: "PRESENT" | "ABSENT";
    source: "marked" | "default_absent";
  } | null;
};

type ClassesResponse = {
  students: { id: string; fullName: string; className: string | null }[];
  upcoming: ClassItem[];
  completed: ClassItem[];
  cancelled: ClassItem[];
};

type AttendanceDay = {
  date: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  status: "PRESENT" | "ABSENT";
  mode: string;
  title: string | null;
};

type AttendanceResponse = {
  month: string;
  students: { id: string; fullName: string; className: string | null }[];
  days: AttendanceDay[];
};

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  return `${start.toLocaleString()} → ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarCells(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startWeekday = first.getDay(); // 0 Sun
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [classes, setClasses] = useState<ClassesResponse | null>(null);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [classesLoading, setClassesLoading] = useState(true);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState<string>("all");

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

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      setClassesLoading(true);
      setClassesError(null);
      try {
        const { data } = await api.get<ClassesResponse>("/parent/classes");
        setClasses(data);
      } catch (error) {
        setClasses(null);
        setClassesError(
          error instanceof ApiError
            ? error.message
            : "Could not load classes.",
        );
      } finally {
        setClassesLoading(false);
      }
    })();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      try {
        const { data } = await api.get<AttendanceResponse>("/parent/attendance", {
          params: { month },
        });
        setAttendance(data);
      } catch (error) {
        setAttendance(null);
        setAttendanceError(
          error instanceof ApiError
            ? error.message
            : "Could not load attendance.",
        );
      } finally {
        setAttendanceLoading(false);
      }
    })();
  }, [ready, month]);

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

  const dayStatusMap = useMemo(() => {
    const map = new Map<string, "PRESENT" | "ABSENT" | "MIXED">();
    if (!attendance) return map;
    for (const day of attendance.days) {
      if (studentFilter !== "all" && day.studentId !== studentFilter) continue;
      const existing = map.get(day.date);
      if (!existing) {
        map.set(day.date, day.status);
      } else if (existing !== day.status) {
        map.set(day.date, "MIXED");
      }
    }
    return map;
  }, [attendance, studentFilter]);

  const dayDetails = useMemo(() => {
    if (!attendance) return [] as AttendanceDay[];
    return attendance.days.filter(
      (d) => studentFilter === "all" || d.studentId === studentFilter,
    );
  }, [attendance, studentFilter]);

  const calendarCells = useMemo(() => buildCalendarCells(month), [month]);
  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [month]);

  if (!ready || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
        <p className="text-sm text-text-secondary">Checking your session…</p>
      </main>
    );
  }

  const students =
    classes?.students ??
    attendance?.students ??
    user.parentProfile?.students ??
    [];

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
            See upcoming classes and attendance for your children.
          </p>
          {students.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {students.map((student) => (
                <li
                  key={student.id}
                  className="rounded-full bg-surface-muted px-3 py-1 text-sm text-text"
                >
                  {student.fullName}
                  {student.className ? ` · ${student.className}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h3 className="text-base font-semibold text-text">Upcoming classes</h3>
          {classesLoading ? (
            <p className="mt-3 text-sm text-text-secondary">Loading…</p>
          ) : classesError ? (
            <p className="mt-3 text-sm text-error" role="alert">
              {classesError}
            </p>
          ) : !classes || classes.upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">
              No upcoming classes yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {classes.upcoming.map((item) => (
                <article
                  key={`${item.sessionId}-${item.studentId}`}
                  className="rounded-xl border border-border bg-surface-muted px-4 py-3"
                >
                  <p className="font-medium text-text">
                    {item.title || item.subjectName || `${item.mode} class`}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {item.studentName} · {formatRange(item.startsAt, item.endsAt)}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Tutor: {item.tutorName}
                    {item.batch
                      ? ` · ${item.batch.className} — ${item.batch.name}`
                      : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h3 className="text-base font-semibold text-text">Completed classes</h3>
          {classesLoading ? (
            <p className="mt-3 text-sm text-text-secondary">Loading…</p>
          ) : !classes || classes.completed.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">
              No completed classes yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {classes.completed.slice(0, 10).map((item) => (
                <article
                  key={`${item.sessionId}-${item.studentId}-done`}
                  className="rounded-xl border border-border px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text">
                      {item.title || item.subjectName || `${item.mode} class`}
                    </p>
                    {item.attendance ? (
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          item.attendance.status === "PRESENT"
                            ? "bg-emerald-50 text-success"
                            : "bg-error-bg text-error",
                        ].join(" ")}
                      >
                        {item.attendance.status}
                        {item.attendance.source === "default_absent"
                          ? " (unmarked)"
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {item.studentName} · {formatRange(item.startsAt, item.endsAt)}
                  </p>
                  {item.notes ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      Note: {item.notes}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-text">
              Attendance calendar
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="!min-h-10 px-3"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
              >
                Prev
              </Button>
              <p className="min-w-36 text-center text-sm font-medium text-text">
                {monthLabel}
              </p>
              <Button
                variant="secondary"
                className="!min-h-10 px-3"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
              >
                Next
              </Button>
            </div>
          </div>

          {students.length > 1 ? (
            <div className="mt-3">
              <label
                htmlFor="studentFilter"
                className="text-sm font-medium text-text"
              >
                Student
              </label>
              <select
                id="studentFilter"
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text"
              >
                <option value="all">All students</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <p className="mt-3 text-xs text-text-secondary">
            Green = Present · Red = Absent (unmarked offline classes count as
            Absent)
          </p>

          {attendanceLoading ? (
            <p className="mt-3 text-sm text-text-secondary">Loading calendar…</p>
          ) : attendanceError ? (
            <p className="mt-3 text-sm text-error" role="alert">
              {attendanceError}
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-text-secondary">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((day, index) => {
                  if (day == null) {
                    return <div key={`e-${index}`} className="aspect-square" />;
                  }
                  const dateKey = `${month}-${String(day).padStart(2, "0")}`;
                  const status = dayStatusMap.get(dateKey);
                  return (
                    <div
                      key={dateKey}
                      className={[
                        "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm",
                        status === "PRESENT"
                          ? "border-success/40 bg-emerald-50 text-success"
                          : status === "ABSENT"
                            ? "border-error/40 bg-error-bg text-error"
                            : status === "MIXED"
                              ? "border-warning/40 bg-amber-50 text-warning"
                              : "border-border bg-surface text-text-secondary",
                      ].join(" ")}
                      title={
                        status
                          ? `${dateKey}: ${status}`
                          : dateKey
                      }
                    >
                      <span className="font-medium">{day}</span>
                    </div>
                  );
                })}
              </div>

              {dayDetails.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {dayDetails.map((d) => (
                    <li
                      key={`${d.sessionId}-${d.studentId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <span>
                        {d.date} · {d.studentName}
                        {d.title ? ` · ${d.title}` : ""}
                      </span>
                      <span
                        className={
                          d.status === "PRESENT" ? "text-success" : "text-error"
                        }
                      >
                        {d.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-text-secondary">
                  No attendance entries this month yet.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
