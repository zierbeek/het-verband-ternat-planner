import React, { useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, X, Send, CheckCircle2 } from "lucide-react";

interface FeedbackWidgetProps {
  token: string | null;
  currentPage: string;
}

type FeedbackType = "bug" | "feature";

export default function FeedbackWidget({ token, currentPage }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [page, setPage] = useState(currentPage);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const openModal = () => {
    setPage(currentPage);
    setType("bug");
    setDescription("");
    setError(null);
    setIsSent(false);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("Beschrijf kort wat er aan de hand is.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, page, description: description.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Er ging iets mis bij het verzenden.");
      }
      setIsSent(true);
      setTimeout(() => setIsOpen(false), 1800);
    } catch (e: any) {
      setError(e.message || "Er ging iets mis bij het verzenden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating action button - stays clear of the mobile bottom nav (72px) */}
      <button
        onClick={openModal}
        className="fixed z-30 bottom-[88px] right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-transform active:scale-95"
        title="Bug melden of feature voorstellen"
        aria-label="Feedback geven"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4"
          onClick={closeModal}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-900">Feedback geven</h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                aria-label="Sluiten"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isSent ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-bold text-slate-700">Bedankt! Je melding is verzonden.</p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Type melding</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setType("bug")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition ${
                        type === "bug"
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Bug className="h-4 w-4" /> Bug
                    </button>
                    <button
                      onClick={() => setType("feature")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition ${
                        type === "feature"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Lightbulb className="h-4 w-4" /> Idee
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide" htmlFor="feedback-page">
                    Pagina
                  </label>
                  <input
                    id="feedback-page"
                    type="text"
                    value={page}
                    onChange={(e) => setPage(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide" htmlFor="feedback-description">
                    {type === "bug" ? "Wat ging er mis?" : "Wat stel je voor?"}
                  </label>
                  <textarea
                    id="feedback-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder={
                      type === "bug"
                        ? "Beschrijf de stappen die tot het probleem leidden..."
                        : "Beschrijf welke functie je zou willen zien..."
                    }
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                  />
                </div>

                {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? "Bezig met verzenden..." : "Versturen"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
