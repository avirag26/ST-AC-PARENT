"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/classes", label: "Classes", icon: "calendar" },
  { href: "/attendance", label: "Attendance", icon: "check" },
  { href: "/profile", label: "Profile", icon: "person" },
] as const;

const paths: Record<string, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M9 20v-7h6v7" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></>,
  person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
};

export function MobileNavigation() {
  const pathname = usePathname();
  if (["/", "/login", "/forgot-password"].includes(pathname)) return null;
  const active = pathname.startsWith("/classes") ? "/classes" : pathname === "/attendance" ? "/attendance" : pathname === "/dashboard" ? "/dashboard" : "/profile";
  return <nav aria-label="Quick navigation" className="parent-bottom-nav lg:hidden">
    {tabs.map(({ href, label, icon }) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={active === href ? "active" : ""}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill={active === href && icon === "home" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[icon]}</svg>
      <span>{label}</span>
    </Link>)}
  </nav>;
}
