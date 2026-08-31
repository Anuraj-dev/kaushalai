"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Matrices", matches: (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/matrices") },
  { href: "/admin/officials", label: "Officials", matches: (pathname: string) => pathname.startsWith("/admin/officials") },
  { href: "/admin/analytics", label: "Analytics", matches: (pathname: string) => pathname.startsWith("/admin/analytics") },
];

export function AdminSubnav() {
  const pathname = usePathname();

  return <nav className="admin-subnav" aria-label="Administrator workspace"><span className="admin-subnav-label">Administrator workspace</span>{links.map((link) => {
    const active = link.matches(pathname);
    return <Link href={link.href} key={link.href} aria-current={active ? "page" : undefined}>{link.label}</Link>;
  })}</nav>;
}
