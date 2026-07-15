import React, { useState } from "react";
import { User, LogIn, ShieldAlert, UserCheck } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDefaultLoginHint, setShowDefaultLoginHint] = useState(() => localStorage.getItem("hideDefaultLoginHint") !== "true");
  const [passwordChangedMessage, setPasswordChangedMessage] = useState(() => localStorage.getItem("passwordChangedMessage"));

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

      localStorage.setItem("hideDefaultLoginHint", "true");
      setShowDefaultLoginHint(false);
      localStorage.removeItem("passwordChangedMessage");
      setPasswordChangedMessage(null);
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

      localStorage.setItem("hideDefaultLoginHint", "true");
      setShowDefaultLoginHint(false);
      localStorage.removeItem("passwordChangedMessage");
      setPasswordChangedMessage(null);
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
          <div className="h-12 w-12 rounded-xl bg-blue-600 overflow-hidden shadow-md">
            <img src="/icon-512.png" alt="Logo" className="h-full w-full object-cover" />
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
        <div className="bg-white py-8 px-4 sm:px-6 shadow-sm sm:rounded-2xl border border-slate-200">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {passwordChangedMessage && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm flex items-start gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{passwordChangedMessage}</span>
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
                className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
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
                className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-xs text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition cursor-pointer active:scale-[0.98]"
            >
              {loading ? "Verwerken..." : <><LogIn className="h-5 w-5" /> Inloggen</>}
            </button>
          </form>

          {/* First Time Login Hint - Only show credentials */}
          {showDefaultLoginHint && (
          <div className="mt-8">
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">Eerste keer inloggen?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Gebruik deze standaard inloggegevens. 
                    <span className="font-medium text-slate-800">U wordt gevraagd uw wachtwoord te wijzigen na het inloggen.</span>
                  </p>
                  <div className="mt-3 p-2 bg-white border border-blue-200/50 rounded-xl">
                    <code className="text-sm font-mono text-blue-700 block">
                      admin@planner.com
                    </code>
                    <code className="text-sm font-mono text-blue-700 block mt-1">
                      admin123
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
