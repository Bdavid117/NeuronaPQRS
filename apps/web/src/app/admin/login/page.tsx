"use client";

import { AgoraLogo } from "@/components/AgoraLogo";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      router.push("/admin");
    } catch {
      setError("Error de conexión. Verifica que el servidor esté activo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="mb-6">
            <AgoraLogo size="md" className="mb-1" />
            <p className="text-xs text-slate-500 mt-1">Panel de Administración</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder-slate-400"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder-slate-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
