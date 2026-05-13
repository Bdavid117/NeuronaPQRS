"use client";

import { AgoraLogo } from "@/components/AgoraLogo";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, LogIn, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function setCookie(name: string, value: string, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body =
        tab === "login"
          ? { email, password }
          : { email, password, name };
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Error al autenticar");
        return;
      }
      const data = await res.json();
      setCookie("pae_auth", data.token);
      localStorage.setItem(
        "pae_user",
        JSON.stringify({ type: "user", name: data.name, email: data.email, token: data.token })
      );
      router.push("/chat");
    } catch {
      setError("No se pudo conectar al servidor");
    } finally {
      setLoading(false);
    }
  }

  function handleAnonymous() {
    const id = uuidv4();
    setCookie("pae_auth", `anon:${id}`);
    localStorage.setItem("pae_user", JSON.stringify({ type: "anon", name: "Anónimo", id }));
    router.push("/chat");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center justify-center mb-10">
        <AgoraLogo size="md" />
      </div>

      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-[#0D0D1C] border border-[#222233] rounded-2xl p-7 shadow-2xl shadow-black/50">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5 mb-6">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={cn(
                  "flex-1 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
                  tab === t
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                {t === "login" ? "Iniciar sesión" : "Registrarse"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {tab === "register" && (
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-medium">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">
                Correo institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="usuario@universidad.edu.co"
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
            >
              <LogIn size={15} />
              {loading ? "Verificando…" : tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-[11px] text-white/30">o continúa sin cuenta</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {/* Anonymous */}
          <button
            onClick={handleAnonymous}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:text-white/80 transition-all duration-200"
          >
            <UserX size={15} />
            Entrar de forma anónima
          </button>
        </div>

        <p className="text-center text-[11px] text-white/20 mt-5 tracking-wide">
          Sistema PQRS Institucional · Ley 1755 de 2015
        </p>
      </div>
    </div>
  );
}
