import { AdminLogin } from "@/components/admin/admin-login";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main id="main-content" className="page-shell">
      <AdminLogin />
    </main>
  );
}
