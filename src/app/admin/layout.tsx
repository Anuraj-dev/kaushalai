import { AdminSubnav } from "@/components/admin/admin-subnav";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <div className="admin-shell"><AdminSubnav/><main id="main-content">{children}</main></div>; }
