"use client";

import { useEffect, useState } from "react";
import StatsPanel from "@/components/admin/StatsPanel";

interface StatsData {
  total_casos: number;
  delta_semana: number;
  this_week: number;
  por_tipo: Record<string, number>;
  por_urgencia: Record<string, number>;
  por_area: { area: string; count: number }[];
  sla_status: { vencidos: number; en_riesgo: number; a_tiempo: number };
  pendientes_revision_humana: number;
  costo_llm_semana_usd: number;
  casos_por_dia: { date: string; count: number }[];
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}: no se pudieron cargar las estadísticas`);
        return r.json() as Promise<StatsData>;
      })
      .then((d) => setData(d))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Estadísticas</h1>
        <p className="text-sm text-slate-500">Métricas de casos PQRS en tiempo real</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Cargando estadísticas…
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">
          {error}. Verifica que hayas iniciado sesión como admin.
        </p>
      )}

      {data && <StatsPanel data={data} />}
    </div>
  );
}
