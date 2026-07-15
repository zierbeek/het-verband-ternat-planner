import React, { useState } from "react";
import { X, ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";

interface PasswordChangeModalProps {
  onClose: () => void;
  onPasswordChanged: (newPassword: string, accountDisabled: boolean) => void;
  token: string;
  userId: string;
  isDefaultAdmin?: boolean;
}

export default function PasswordChangeModal({ 
  onClose, 
  onPasswordChanged, 
  token,
  userId 
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validatePassword = (password: string) => {
    // Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return regex.test(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Vul alle velden in.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("De nieuwe wachtwoorden komen niet overeen.");
      setLoading(false);
      return;
    }

    if (!validatePassword(newPassword)) {
      setError("Wachtwoord moet minstens 8 tekens bevatten, met 1 hoofdletter, 1 kleine letter en 1 cijfer.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Wachtwoord wijzigen mislukt.");
      }

      onPasswordChanged(newPassword);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    if (!newPassword) return 0;
    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[a-z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength++;
    return strength;
  };

  const getStrengthColor = () => {
    const strength = passwordStrength();
    if (strength <= 1) return "bg-red-500";
    if (strength <= 3) return "bg-amber-500";
    return "bg-green-500";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-area-inset-top">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-600 flex items-center justify-center text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-amber-900">Wachtwoord Wijzigen</h2>
              <p className="text-xs text-amber-700">Verplicht voor eerste gebruik</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-amber-100/50 rounded-lg text-amber-700 hover:text-amber-900 transition"
            title="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Huidig Wachtwoord
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                placeholder="Voer huidig wachtwoord in"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Nieuw Wachtwoord
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base pr-12"
                placeholder="Minimaal 8 tekens"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-200 ${
                        i < passwordStrength() ? getStrengthColor() : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {passwordStrength() <= 1 && "Zwak"}
                  {passwordStrength() <= 3 && passwordStrength() > 1 && "Matig"}
                  {passwordStrength() > 3 && "Sterk"}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Bevestig Nieuw Wachtwoord
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base pr-12"
                placeholder="Bevestig nieuw wachtwoord"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-800">
              ⚠️ Uw wachtwoord moet minstens 8 tekens bevatten, met 1 hoofdletter, 1 kleine letter en 1 cijfer. 
              Dit standaard beheerdersaccount wordt uitgeschakeld na wachtwoordwijziging.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !newPassword || newPassword !== confirmPassword}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-xs text-base font-semibold text-white bg-amber-600 hover:bg-amber-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98]"
          >
            {loading ? "Bezig met opslaan..." : "Wachtwoord Wijzigen"}
          </button>
        </form>
      </div>
    </div>
  );
}
