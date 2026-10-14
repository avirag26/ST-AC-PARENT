"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getAccessToken, getStoredUser } from "@/lib/auth-storage";

type ClassItem = { sessionId: string; studentId: string; studentName: string; title: string | null; subjectName: string | null; mode: "ONLINE" | "OFFLINE"; status: string; startsAt: string; endsAt: string; notes: string | null; tutorName: string; batch: { id: string; name: string; className: string } | null; attendance: { status: string; source: string } | null };
type Classes = { upcoming: ClassItem[]; completed: ClassItem[]; cancelled: ClassItem[] };

function ClassDetails() {
  const { id } = useParams<{ id: string }>();
  const studentId = useSearchParams().get("student");
  const router = useRouter();
  const [item, setItem] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken() || getStoredUser()?.role !== "PARENT") { router.replace("/login"); return; }
    let live = true;
    api.get<Classes>("/parent/classes").then(({ data }) => {
      if (!live) return;
      setItem([...data.upcoming, ...data.completed, ...data.cancelled].find((entry) => entry.sessionId === id && (!studentId || entry.studentId === studentId)) ?? null);
    }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Could not load this class."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, studentId, router]);

  return <main className="parent-shell"><div className="parent-container"><div className="parent-detail-top"><Link href="/classes" aria-label="Back to classes">←</Link><h1>Class Details</h1><span /></div>
    {loading ? <p className="parent-status">Loading class…</p> : error ? <p className="parent-status error" role="alert">{error}</p> : !item ? <div className="parent-card"><h2>Class not found</h2><p className="mt-2 text-sm text-text-secondary">It may have been changed or removed.</p><Link className="parent-detail-button outline" href="/classes">Back to classes</Link></div> : <div className="parent-detail-grid"><div className="parent-detail-main"><section className="parent-card parent-detail-feature"><span className="parent-icon-tile">✦</span><div><h2>{item.title || item.subjectName || "Class"}</h2><p>{new Date(item.startsAt).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "short" })} · {new Date(item.startsAt).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" })} – {new Date(item.endsAt).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" })}</p><span className="parent-badge">{item.status.replaceAll("_", " ")}</span></div></section>
      <section className="parent-card"><h2>Teacher</h2><div className="parent-detail-teacher"><span className="parent-avatar small">{item.tutorName.split(" ").slice(0, 2).map((s) => s[0]).join("")}</span><span><strong>{item.tutorName}</strong><small>{item.mode === "ONLINE" ? "Online tutor" : "Home tutor"}</small></span></div></section>
      <section className="parent-card"><h2>Class Information</h2><div className="parent-detail-info"><div><span>Student</span><strong>{item.studentName}</strong></div><div><span>Mode</span><strong>{item.mode === "ONLINE" ? "Online" : "Home tuition"}</strong></div>{item.batch && <div><span>Class / Batch</span><strong>{item.batch.className} · {item.batch.name}</strong></div>}{item.attendance && <div><span>Attendance</span><strong>{item.attendance.status === "ABSENT" && item.attendance.source === "default_absent" ? "Absent (unmarked)" : item.attendance.status}</strong></div>}</div></section>
      {item.notes && <section className="parent-card"><h2>Class Notes</h2><p className="parent-detail-note">{item.notes}</p></section>}</div><div className="parent-detail-actions"><Link className="parent-detail-button outline" href="/classes">All classes</Link><Link className="parent-detail-button" href="/resources">View resources</Link><div className="parent-detail-quick"><h2>Quick Actions</h2><Link href="/exams">Exams & results →</Link><Link href="/quizzes">Quizzes →</Link></div></div></div>}
  </div></main>;
}

export default function ClassDetailPage() { return <Suspense fallback={<main className="parent-shell"><p className="parent-status">Loading class…</p></main>}><ClassDetails /></Suspense>; }
