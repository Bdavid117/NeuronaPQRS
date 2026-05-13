import Link from "next/link";
import { LayoutDashboard, ListChecks, LogOut } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-surface-alt">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">N</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">NeuronaPQRS</p>
              <p className="text-[10px] text-slate-500">Administración</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
          >
            <LayoutDashboard size={15} className="text-slate-500" />
            Dashboard
          </Link>
          <Link
            href="/admin?estado=abierto"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ListChecks size={15} className="text-slate-500" />
            Casos abiertos
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-slate-100">
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 w-full transition-colors"
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
