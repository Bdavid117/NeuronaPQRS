"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const URGENCIA_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-green-100 text-green-700",
};

const ESTADO_COLORS: Record<string, string> = {
  abierto: "bg-blue-100 text-blue-700",
  en_proceso: "bg-violet-100 text-violet-700",
  escalado: "bg-orange-100 text-orange-700",
  cerrado: "bg-slate-100 text-slate-600",
  resuelto_automaticamente: "bg-green-100 text-green-700",
};

interface CaseRow {
  id: number;
  radicado: string;
  tipo: string | null;
  categoria: string | null;
  area: string | null;
  urgencia: string;
  estado: string;
  requiere_revision_humana: boolean;
  plazo_respuesta: string | null;
  created_at: string;
}

interface CasesResponse {
  total: number;
  page: number;
  per_page: number;
  cases: CaseRow[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ tipo: "", estado: "", urgencia: "" });

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (filters.tipo) params.set("tipo", filters.tipo);
    if (filters.estado) params.set("estado", filters.estado);
    if (filters.urgencia) params.set("urgencia", filters.urgencia);

    fetch(`/api/admin/cases?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}: no se pudieron cargar los casos`);
        return r.json() as Promise<CasesResponse>;
      })
      .then((d) => setData(d))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, filters]);

  const metrics = data
    ? [
        { label: "Total casos", value: data.total },
        { label: "Esta página", value: data.cases.length },
        { label: "Requieren revisión", value: data.cases.filter((c) => c.requiere_revision_humana).length },
        { label: "Abiertos", value: data.cases.filter((c) => c.estado === "abierto").length },
      ]
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Gestión de casos PQRS</p>
      </div>

      {/* Metrics */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Filtros</span>
          {[
            { key: "tipo", options: ["", "peticion", "queja", "reclamo", "sugerencia"], label: "Tipo" },
            { key: "estado", options: ["", "abierto", "en_proceso", "escalado", "cerrado"], label: "Estado" },
            { key: "urgencia", options: ["", "alta", "media", "baja"], label: "Urgencia" },
          ].map(({ key, options, label }) => (
            <select
              key={key}
              value={filters[key as keyof typeof filters]}
              onChange={(e) => {
                setFilters((f) => ({ ...f, [key]: e.target.value }));
                setPage(1);
              }}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">{label}: todos</option>
              {options.filter(Boolean).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Radicado", "Tipo", "Categoría", "Área", "Urgencia", "Estado", "Fecha", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Cargando…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-red-500 text-sm">
                    {error}
                  </td>
                </tr>
              ) : data?.cases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No hay casos con estos filtros.
                  </td>
                </tr>
              ) : (
                data?.cases.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-slate-700">{c.radicado}</code>
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{c.tipo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.area ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.urgencia && (
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                            URGENCIA_COLORS[c.urgencia] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.urgencia}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          ESTADO_COLORS[c.estado] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.estado.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/cases/${c.radicado}`}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > data.per_page && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Mostrando {(page - 1) * data.per_page + 1}–{Math.min(page * data.per_page, data.total)} de {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.per_page >= data.total}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
