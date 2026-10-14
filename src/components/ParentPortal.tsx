"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { clearSession, getAccessToken, getStoredUser, type AuthUser, type ParentStudent } from "@/lib/auth-storage";

type ClassItem = {
  sessionId: string; studentId: string; studentName: string; title: string | null; subjectName: string | null;
  mode: "ONLINE" | "OFFLINE"; status: string; startsAt: string; endsAt: string; notes: string | null;
  tutorName: string; batch: { id: string; name: string; className: string } | null;
  attendance: { status: "PRESENT" | "ABSENT"; source: "marked" | "default_absent" } | null;
};
type ClassesResponse = { students: ParentStudent[]; upcoming: ClassItem[]; completed: ClassItem[]; cancelled: ClassItem[] };
type AttendanceDay = { date: string; studentId: string; studentName: string; sessionId: string; status: "PRESENT" | "ABSENT"; mode: string; title: string | null };
type AttendanceResponse = { month: string; students: ParentStudent[]; days: AttendanceDay[] };
type View = "home" | "classes" | "attendance" | "profile";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const icons: Record<string, string> = {
  book: "M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4Zm0 16a3 3 0 0 1 3-3h13",
  calendar: "M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  check: "M4 12.5 9 17l11-11",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  quiz: "M8 4h8l3 3v14H5V4h3Zm0 6h8m-8 4h8m-8 4h5",
  arrow: "m9 5 7 7-7 7",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  logout: "M10 4H5v16h5m3-4 4-4-4-4m4 4H8",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
};
function Icon({ name, size = 20 }: { name: string; size?: number }) { return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase(); }
function Avatar({ name, small = false }: { name: string; small?: boolean }) { return <span className={`parent-avatar ${small ? "small" : ""}`} aria-hidden="true">{initials(name)}</span>; }
function title(item: ClassItem) { return item.title || item.subjectName || `${item.mode === "ONLINE" ? "Online" : "Offline"} class`; }
function dateLabel(value: string, options: Intl.DateTimeFormatOptions) { return new Date(value).toLocaleString("en-IN", options); }
function shiftMonth(month: string, delta: number) { const [year, n] = month.split("-").map(Number); const date = new Date(year, n - 1 + delta, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function currentMonth() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; }
function Status({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "error" }) { return <p className={`parent-status ${type}`} role={type === "error" ? "alert" : "status"}>{children}</p>; }

function ClassRow({ item, kind }: { item: ClassItem; kind: "upcoming" | "completed" | "cancelled" }) {
  const badge = kind === "upcoming" ? "Upcoming" : kind === "cancelled" ? "Cancelled" : item.attendance?.status === "PRESENT" ? "Present" : item.attendance?.status === "ABSENT" ? "Absent" : "Completed";
  return <Link href={`/classes/${encodeURIComponent(item.sessionId)}?student=${encodeURIComponent(item.studentId)}`} className="parent-class-row">
    <span className="parent-icon-tile"><Icon name="book" size={17} /></span>
    <span className="parent-row-copy"><strong>{title(item)}</strong><small>{dateLabel(item.startsAt, { weekday: "short", day: "numeric", month: "short" })} · {dateLabel(item.startsAt, { hour: "numeric", minute: "2-digit" })} – {dateLabel(item.endsAt, { hour: "numeric", minute: "2-digit" })}</small><small>{item.tutorName} · {item.studentName}</small></span>
    <span className={`parent-badge ${kind === "completed" && item.attendance?.status === "PRESENT" ? "success" : kind === "cancelled" || item.attendance?.status === "ABSENT" ? "danger" : ""}`}>{badge}</span>
  </Link>;
}

function ChildSelector({ students, selected, onChange }: { students: ParentStudent[]; selected: string; onChange: (value: string) => void }) {
  if (!students.length) return null;
  const child = students.find((s) => s.id === selected) ?? students[0];
  return <div className="parent-child-card"><Avatar name={child.fullName} /><div><strong>{child.fullName}</strong><small>{child.className || "Student"}</small></div>{students.length > 1 ? <select aria-label="Choose child" value={selected} onChange={(e) => onChange(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select> : <Icon name="arrow" size={16} />}</div>;
}

function ProgressRing({ percent, compact = false }: { percent: number | null; compact?: boolean }) {
  return <div className={`parent-progress-ring ${compact ? "compact" : ""}`} style={{ "--progress": `${percent ?? 0}%` } as React.CSSProperties}><div>{percent === null ? "—" : `${percent}%`}</div></div>;
}

export function ParentPortal({ view }: { view: View }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [classes, setClasses] = useState<ClassesResponse | null>(null);
  const [classesError, setClassesError] = useState("");
  const [classesLoading, setClassesLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth);
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(null);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [selected, setSelected] = useState("all");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!getAccessToken() || !stored || stored.role !== "PARENT") { router.replace("/login"); return; }
    setUser(stored); setReady(true);
    const saved = sessionStorage.getItem("stac_parent_selected_child");
    if (saved) setSelected(saved);
  }, [router]);
  useEffect(() => {
    if (!ready || view === "profile") return;
    let live = true;
    api.get<ClassesResponse>("/parent/classes").then(({ data }) => { if (live) setClasses(data); }).catch((error) => { if (live) setClassesError(error instanceof ApiError ? error.message : "Could not load classes."); }).finally(() => { if (live) setClassesLoading(false); });
    return () => { live = false; };
  }, [ready, view]);
  useEffect(() => {
    if (!ready || (view !== "home" && view !== "attendance")) return;
    let live = true;
    setAttendanceLoading(true); setAttendanceError("");
    api.get<AttendanceResponse>("/parent/attendance", { params: { month } }).then(({ data }) => { if (live) setAttendance(data); }).catch((error) => { if (live) setAttendanceError(error instanceof ApiError ? error.message : "Could not load attendance."); }).finally(() => { if (live) setAttendanceLoading(false); });
    return () => { live = false; };
  }, [ready, month, view]);

  const students = classes?.students ?? attendance?.students ?? user?.parentProfile?.students ?? [];
  const child = students.find((s) => s.id === selected) ?? students[0];
  const childId = child?.id;
  const filtered = (items: ClassItem[]) => childId ? items.filter((item) => item.studentId === childId) : items;
  const allDays = useMemo(() => attendance?.days.filter((day) => !childId || day.studentId === childId) ?? [], [attendance, childId]);
  const recordedDays = allDays.filter((day) => day.status === "PRESENT" || day.status === "ABSENT");
  const attendancePercent = recordedDays.length ? Math.round(recordedDays.filter((day) => day.status === "PRESENT").length / recordedDays.length * 100) : null;
  const monthDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1);
  const calendar = Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate() + monthDate.getDay() }, (_, i) => i < monthDate.getDay() ? null : i - monthDate.getDay() + 1);
  const dayMap = new Map<string, "PRESENT" | "ABSENT" | "MIXED">();
  for (const day of allDays) { const old = dayMap.get(day.date); dayMap.set(day.date, old && old !== day.status ? "MIXED" : day.status); }
  function chooseChild(id: string) { setSelected(id); sessionStorage.setItem("stac_parent_selected_child", id); }
  async function signOut() { setSigningOut(true); try { await api.post("/auth/logout"); } catch {} finally { clearSession(); router.replace("/login"); } }

  if (!ready || !user) return <main className="parent-shell"><Status>Checking your session…</Status></main>;
  const firstName = user.fullName.split(" ")[0];
  const upcoming = filtered(classes?.upcoming ?? []);
  const completed = filtered(classes?.completed ?? []);
  const cancelled = filtered(classes?.cancelled ?? []);
  const today = new Date().toDateString();
  const todaysClasses = upcoming.filter((item) => new Date(item.startsAt).toDateString() === today);

  return <main className="parent-shell">
    <div className="parent-container">
      <header className="parent-topbar">
        <Link href="/dashboard" className="parent-brand" aria-label="Straight Line Academy home"><span className="parent-brand-mark">S</span><span>Straight Line<br />Academy</span></Link>
        <div className="parent-top-actions"><Link href="/resources" aria-label="Learning resources" className="parent-header-icon"><Icon name="book" size={20} /></Link><Link href="/profile" aria-label="Profile"><Avatar name={user.fullName} small /></Link></div>
      </header>
      <nav className="parent-desktop-nav" aria-label="Parent sections"><Link href="/dashboard">Home</Link><Link href="/classes">Classes</Link><Link href="/attendance">Attendance</Link><Link href="/profile">Profile</Link></nav>

      {view === "home" && <>
        <div className="parent-page-heading"><p className="parent-eyebrow">YOUR FAMILY DASHBOARD</p><h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},<br />{firstName}</h1><p>Here’s what’s happening with your child today.</p></div>
        <ChildSelector students={students} selected={child?.id ?? ""} onChange={chooseChild} />
        <div className="parent-home-grid">
          <div className="parent-main-column">
            <section className="parent-hero-card"><span className="parent-eyebrow">STRAIGHT LINE ACADEMY</span><h2>Better Learning<br />Brighter Future</h2><p>Together we build a stronger tomorrow.</p><span className="parent-hero-art" aria-hidden="true">✦</span></section>
            <section className="parent-card parent-attendance-preview"><div className="parent-section-heading"><div><h2>Attendance</h2><p>This month</p></div><ProgressRing percent={attendancePercent} compact /></div>{attendanceLoading ? <Status>Loading attendance…</Status> : attendanceError ? <Status type="error">{attendanceError}</Status> : <><div className="parent-week-strip">{Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; const status = dayMap.get(dayKey); return <div key={dayKey}><span>{weekdays[d.getDay()]}</span><strong className={status === "PRESENT" ? "present" : status === "ABSENT" ? "absent" : ""}>{status === "PRESENT" ? "✓" : status === "ABSENT" ? "×" : "–"}</strong></div>; })}</div><Link className="parent-text-link" href="/attendance">View attendance <Icon name="arrow" size={14} /></Link></>}</section>
            <section className="parent-card"><div className="parent-section-heading"><h2>Upcoming Classes</h2><Link href="/classes">View all</Link></div>{classesLoading ? <Status>Loading classes…</Status> : classesError ? <Status type="error">{classesError}</Status> : upcoming.length ? <div className="parent-row-list">{upcoming.slice(0, 3).map((item) => <ClassRow key={`${item.sessionId}-${item.studentId}`} item={item} kind="upcoming" />)}</div> : <Status>No upcoming classes yet.</Status>}</section>
          </div>
          <div className="parent-side-column"><section className="parent-card"><div className="parent-section-heading"><h2>Today’s Classes</h2><Link href="/classes">View all</Link></div>{classesLoading ? <Status>Loading classes…</Status> : todaysClasses.length ? <div className="parent-row-list">{todaysClasses.map((item) => <ClassRow key={`${item.sessionId}-${item.studentId}`} item={item} kind="upcoming" />)}</div> : <Status>No classes scheduled for today.</Status>}</section>
            <section className="parent-card"><h2>Explore learning</h2><div className="parent-shortcuts">{[["/resources", "Learning resources", "book"], ["/exams", "Exams & results", "quiz"], ["/quizzes", "Quizzes", "check"], ["/finance", "Fees & payments", "card"]].map(([href, label, icon]) => <Link key={href} href={href}><span className="parent-icon-tile"><Icon name={icon} size={19} /></span><span>{label}</span><Icon name="arrow" size={16} /></Link>)}</div></section></div>
        </div>
      </>}

      {view === "classes" && <><div className="parent-page-heading"><p className="parent-eyebrow">LEARNING SCHEDULE</p><h1>Classes</h1><p>Your child’s class schedule and history.</p></div><ChildSelector students={students} selected={child?.id ?? ""} onChange={chooseChild} /><div className="parent-content-grid"><section className="parent-card"><div className="parent-section-heading"><div><h2>Upcoming Classes</h2><p>{upcoming.length} scheduled</p></div></div>{classesLoading ? <Status>Loading classes…</Status> : classesError ? <Status type="error">{classesError}</Status> : upcoming.length ? <div className="parent-row-list">{upcoming.map((item) => <ClassRow key={`${item.sessionId}-${item.studentId}`} item={item} kind="upcoming" />)}</div> : <Status>No upcoming classes yet.</Status>}</section><section className="parent-card"><h2>Past Classes</h2>{classesLoading ? <Status>Loading classes…</Status> : completed.length ? <div className="parent-row-list">{completed.map((item) => <ClassRow key={`${item.sessionId}-${item.studentId}`} item={item} kind="completed" />)}</div> : <Status>No completed classes yet.</Status>}</section>{cancelled.length > 0 && <section className="parent-card"><h2>Cancelled Classes</h2><div className="parent-row-list">{cancelled.map((item) => <ClassRow key={`${item.sessionId}-${item.studentId}`} item={item} kind="cancelled" />)}</div></section>}</div></>}

      {view === "attendance" && <><div className="parent-page-heading"><p className="parent-eyebrow">LEARNING PROGRESS</p><h1>Attendance</h1><p>Track each class and every day.</p></div><ChildSelector students={students} selected={child?.id ?? ""} onChange={chooseChild} /><div className="parent-content-grid"><section className="parent-card parent-attendance-summary"><ProgressRing percent={attendancePercent} /><h2>Overall Attendance</h2><p>{monthDate.toLocaleString("en-IN", { month: "long", year: "numeric" })}</p><div className="parent-summary-stats"><div><strong>{recordedDays.length}</strong><span>Classes</span></div><div><strong>{recordedDays.filter((d) => d.status === "PRESENT").length}</strong><span>Present</span></div><div><strong>{recordedDays.filter((d) => d.status === "ABSENT").length}</strong><span>Absent</span></div></div>{attendanceLoading && <Status>Loading attendance…</Status>}{attendanceError && <Status type="error">{attendanceError}</Status>}</section><section className="parent-card"><div className="parent-section-heading"><h2>Attendance Calendar</h2><div className="parent-month-controls"><button aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>‹</button><span>{monthDate.toLocaleString("en-IN", { month: "short", year: "numeric" })}</span><button aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>›</button></div></div><div className="parent-calendar"><div className="parent-calendar-days">{weekdays.map((d) => <span key={d}>{d[0]}</span>)}</div><div className="parent-calendar-cells">{calendar.map((day, i) => { const key = `${month}-${String(day).padStart(2, "0")}`; const status = day ? dayMap.get(key) : null; return day ? <span key={key} className={status?.toLowerCase()} title={`${key}${status ? `: ${status}` : ""}`}>{day}</span> : <span key={`blank-${i}`} />; })}</div></div><p className="parent-calendar-legend"><span className="present">● Present</span><span className="absent">● Absent</span><span>● No class</span></p></section><section className="parent-card"><h2>Class Attendance</h2>{attendanceLoading ? <Status>Loading records…</Status> : allDays.length ? <div className="parent-attendance-list">{allDays.slice().reverse().map((day) => <div key={`${day.sessionId}-${day.studentId}`}><span className={`parent-attendance-dot ${day.status.toLowerCase()}`}>{day.status === "PRESENT" ? "✓" : "×"}</span><span><strong>{day.title || "Class"}</strong><small>{dateLabel(day.date, { weekday: "short", day: "numeric", month: "short" })} · {day.studentName}</small></span><span className={day.status === "PRESENT" ? "present" : "absent"}>{day.status === "PRESENT" ? "Present" : "Absent"}</span></div>)}</div> : <Status>No attendance entries this month yet.</Status>}<p className="parent-footnote">Unmarked offline classes count as absent.</p></section></div></>}

      {view === "profile" && <><div className="parent-page-heading"><p className="parent-eyebrow">YOUR ACCOUNT</p><h1>Profile</h1><p>Family details and everything you need.</p></div><div className="parent-profile-grid"><section className="parent-card"><div className="parent-profile-person"><Avatar name={user.fullName} /><div><h2>{user.fullName}</h2><p>Parent account</p></div></div><div className="parent-profile-details"><div><span>Email</span><strong>{user.email}</strong></div>{user.phone && <div><span>Phone</span><strong>{user.phone}</strong></div>}</div></section><section className="parent-card"><h2>Children</h2>{students.length ? students.map((student) => <div className="parent-profile-child" key={student.id}><Avatar name={student.fullName} small /><span><strong>{student.fullName}</strong><small>{student.className || "Student"}</small></span></div>) : <Status>No children linked to this account yet.</Status>}</section><section className="parent-card"><h2>Learning & account</h2><div className="parent-shortcuts">{[["/resources", "Learning resources", "book"], ["/exams", "Exams & results", "quiz"], ["/quizzes", "Quizzes", "check"], ["/finance", "Fees & payments", "card"], ["/attendance", "Attendance", "calendar"]].map(([href, label, icon]) => <Link key={href} href={href}><span className="parent-icon-tile"><Icon name={icon} size={19} /></span><span>{label}</span><Icon name="arrow" size={16} /></Link>)}</div></section><button className="parent-logout" onClick={() => void signOut()} disabled={signingOut}><Icon name="logout" size={18} />{signingOut ? "Signing out…" : "Sign out"}</button></div></>}
    </div>
  </main>;
}
