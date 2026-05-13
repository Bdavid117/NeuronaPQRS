"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const ESTADOS = ["abierto", "en_proceso", "escalado", "cerrado"];

export default function AdminCaseDetail({ params }: { params: Promise<{ radicado: string }> }) {
  const { radicado } = use(params);
  const [estado, setEstado] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<{ tipo: string | null; categoria: string | null; area: string | null; urgencia: string } | null>(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/cases/${radicado}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setCaseData(d);
        setEstado(d.estado ?? "");
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoadingCase(false));
  }, [radicado]);

  async function handleStatusChange(newEstado: string) {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/cases/${radicado}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: newEstado }),
      });
      if (res.ok) {
        setEstado(newEstado);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setSaveError("Error al actualizar el estado. Intenta de nuevo.");
      }
    } catch {
      setSaveError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin"
          aria-label="Volver al dashboard"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{radicado}</h1>
          <p className="text-sm text-slate-500">Detalle del caso</p>
        </div>
      </div>

      {/* Case info */}
      {loadingCase ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4 text-sm text-slate-400 text-center">Cargando información del caso…</div>
      ) : loadError ? (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 mb-4 text-sm text-red-600">{loadError}</div>
      ) : caseData ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Información</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {caseData.tipo && <><dt className="text-slate-500">Tipo</dt><dd className="text-slate-900 capitalize">{caseData.tipo}</dd></>}
            {caseData.categoria && <><dt className="text-slate-500">Categoría</dt><dd className="text-slate-900">{caseData.categoria}</dd></>}
            {caseData.area && <><dt className="text-slate-500">Área</dt><dd className="text-slate-900">{caseData.area}</dd></>}
            {caseData.urgencia && <><dt className="text-slate-500">Urgencia</dt><dd className="text-slate-900 capitalize">{caseData.urgencia}</dd></>}
          </dl>
        </div>
      ) : null}

      {/* Status changer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Actualizar estado</h2>
        <div className="flex gap-2 flex-wrap">
          {ESTADOS.map((e) => (
            <button
              key={e}
              onClick={() => handleStatusChange(e)}
              disabled={saving || estado === e}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border capitalize ${
                estado === e
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {e.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        {saved && <p className="text-xs text-green-600 mt-2">✓ Estado actualizado</p>}
        {saving && <p className="text-xs text-slate-400 mt-2">Guardando…</p>}
        {saveError && <p className="text-xs text-red-500 mt-2">{saveError}</p>}
      </div>

      {/* Links */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Acciones</h2>
        <div className="space-y-2">
          <Link
            href={`/r/${radicado}`}
            target="_blank"
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Ver página pública del caso →
          </Link>
        </div>
      </div>
    </div>
  );
}
