"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

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

const TIPO_COLORS: Record<string, string> = {
  peticion: "#6366f1",
  queja: "#f59e0b",
  reclamo: "#ef4444",
  sugerencia: "#10b981",
};

const URGENCIA_COLORS: Record<string, string> = {
  alta: "#ef4444",
  media: "#f59e0b",
  baja: "#10b981",
};

function StatCard({
  label,
  value,
  sub,
  color = "text-slate-900",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function StatsPanel({ data }: { data: StatsData }) {
  const tipoData = Object.entries(data.por_tipo).map(([name, value]) => ({ name, value }));
  const urgenciaData = Object.entries(data.por_urgencia).map(([name, value]) => ({
    name,
    value,
    fill: URGENCIA_COLORS[name] ?? "#94a3b8",
  }));
  const slaData = [
    { name: "A tiempo", value: data.sla_status.a_tiempo, fill: "#10b981" },
    { name: "En riesgo", value: data.sla_status.en_riesgo, fill: "#f59e0b" },
    { name: "Vencidos", value: data.sla_status.vencidos, fill: "#ef4444" },
  ];

  const deltaSign = data.delta_semana >= 0 ? "+" : "";
  const deltaColor = data.delta_semana >= 0 ? "text-green-600" : "text-red-500";

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total casos" value={data.total_casos} />
        <StatCard
          label="Esta semana"
          value={data.this_week}
          sub={`${deltaSign}${data.delta_semana} vs semana anterior`}
          color={deltaColor}
        />
        <StatCard
          label="Revisión humana pendiente"
          value={data.pendientes_revision_humana}
          color={data.pendientes_revision_humana > 0 ? "text-amber-600" : "text-slate-900"}
        />
        <StatCard label="Costo LLM (semana)" value={`$${data.costo_llm_semana_usd} USD`} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Por tipo */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Por tipo
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={tipoData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  name && percent != null ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {tipoData.map((entry) => (
                  <Cell key={entry.name} fill={TIPO_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Por urgencia */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Por urgencia
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={urgenciaData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {urgenciaData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SLA status */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Estado SLA
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={slaData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {slaData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top áreas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Top áreas responsables
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.por_area} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="area" tick={{ fontSize: 10 }} width={110} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Casos por día */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Casos últimos 30 días
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.casos_por_dia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) =>
                  typeof v === "string" ? new Date(v).toLocaleDateString("es-CO") : String(v)
                }
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
