import React, { useState } from "react";
import { User, LogIn, ShieldAlert, Sparkles, UserCheck } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Inloggen mislukt.");
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Demo inloggen mislukt.");
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
          Het Verband Ternat planner
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Zelf-gehost, lichtgewicht planningssysteem voor thuisverpleging
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">E-mailadres</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="u@homenursing.org"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Wachtwoord</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? "Verwerken..." : "Inloggen"}
            </button>
          </form>

          {/* Quick Admin Login Panel */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <UserCheck className="h-4 w-4 text-blue-500" /> Eerste Keer Inloggen
            </h4>
            <div className="space-y-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                Log in met het standaard beheerdersaccount om de configuratie te starten. Pas uw wachtwoord na de eerste inlogbeurt aan in het Beheercentrum.
              </p>
              <button
                type="button"
                onClick={() => handleDemoLogin("admin@homenursing.org", "admin123")}
                className="w-full flex items-center justify-between p-3 border border-amber-200 rounded-xl bg-amber-50 hover:bg-amber-100/70 transition text-xs cursor-pointer"
              >
                <div className="text-left">
                  <span className="font-semibold block text-amber-900">Beheerder Account</span>
                  <span className="text-amber-700 text-[10px] block font-mono">admin@homenursing.org / admin123</span>
                </div>
                <span className="text-amber-800 font-bold bg-amber-100/80 px-2 py-1 rounded-lg">Snel Inloggen</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
