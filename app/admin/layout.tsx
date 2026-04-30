import { requireAdmin } from "@/lib/auth/server";
import AdminSidebar from "./AdminSidebar";

export const metadata = {
  title: "Admin · SEO Manager",
};

// requireAdmin redirects non-admins to /. The /admin tree never renders for
// regular users, so child routes can trust that an admin session is present.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar email={session.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="mx-auto w-full max-w-[1400px] px-4 py-4 text-center text-[10px] tracking-widest text-muted swiss-num sm:px-6 sm:text-[11px] lg:px-12">
          © 2026 SEO MANAGER · ADMIN
        </footer>
      </div>
    </div>
  );
}
