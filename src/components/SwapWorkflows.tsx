import React, { useState, useEffect } from "react";
import { ArrowLeftRight, Check, X, ClipboardCheck, Plus, AlertCircle, Info, MessageSquare } from "lucide-react";
import { SwapRequest, Shift, Employee, ShiftAssignment } from "../types.js";

interface SwapWorkflowsProps {
  user: any;
  token: string;
}

export default function SwapWorkflows({ user, token }: SwapWorkflowsProps) {
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isNewSwapOpen, setIsNewSwapOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [selectedTargetColleagueId, setSelectedTargetColleagueId] = useState("");
  const [selectedTargetShiftId, setSelectedTargetShiftId] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSwapsAndData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resSwaps, resEmployees] = await Promise.all([
        fetch("/api/swaps", { headers }),
        fetch("/api/employees", { headers }),
      ]);

      const dataSwaps = await resSwaps.json();
      const dataEmployees = await resEmployees.json();

      setSwaps(dataSwaps);
      setEmployees(dataEmployees);

      // If user is employee, fetch their current assigned shifts to swap
      if (user.role === "EMPLOYEE") {
        const resShifts = await fetch(`/api/shifts?employeeId=${user.employee?.id}`, { headers });
        const dataShifts = await resShifts.json();
        setShifts(dataShifts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwapsAndData();
  }, [user, token]);

  const handleCreateSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId || !selectedTargetColleagueId || !reason) {
      alert("Vul alstublieft alle verplichte velden in.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shiftId: selectedShiftId,
          targetId: selectedTargetColleagueId,
          targetShiftId: selectedTargetShiftId || undefined,
          reason,
          comment,
        }),
      });

      if (res.ok) {
        setIsNewSwapOpen(false);
        setSelectedShiftId("");
        setSelectedTargetColleagueId("");
        setSelectedTargetShiftId("");
        setReason("");
        setComment("");
        fetchSwapsAndData();
      } else {
        const err = await res.json();
        alert(err.error || "Fout bij het voorstellen van de ruildienst");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondentAction = async (swapId: string, accept: boolean) => {
    try {
      const res = await fetch(`/api/swaps/${swapId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          response: accept ? "ACCEPT" : "DECLINE",
          comment: "Overeengekomen om te ruilen.",
        }),
      });

      if (res.ok) {
        alert(accept ? "U heeft de ruildienst geaccepteerd! Goedkeuring van de beheerder is nu vereist." : "U heeft de ruildienst geweigerd.");
        fetchSwapsAndData();
      } else {
        const err = await res.json();
        alert(err.error || "Actie mislukt");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdminApproval = async (swapId: string, approve: boolean) => {
    try {
      const res = await fetch(`/api/swaps/${swapId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: approve ? "APPROVED_ADMIN" : "REJECTED_ADMIN",
        }),
      });

      if (res.ok) {
        alert(approve ? "Dienstruil goedgekeurd! De planning is automatisch bijgewerkt." : "Dienstruil geweigerd door de beheerder.");
        fetchSwapsAndData();
      } else {
        const err = await res.json();
        alert(err.error || "Actie mislukt");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING_TARGET":
        return <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase">Wacht op collega</span>;
      case "ACCEPTED_TARGET":
        return <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase">Wacht op goedkeuring beheerder</span>;
      case "REJECTED_TARGET":
        return <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase">Geweigerd door collega</span>;
      case "APPROVED_ADMIN":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase">Geruild & Voltooid</span>;
      case "REJECTED_ADMIN":
        return <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase">Geweigerd door beheerder</span>;
      default:
        return <span className="bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-sm">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-500" />
            Dienstruilen & Ruilbord
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Ruil geplande shifts met uw collega's van de verpleging. Alle ruilen moeten eerst door uw collega en ten slotte door een beheerder worden goedgekeurd.
          </p>
        </div>

        {user.role === "EMPLOYEE" && (
          <button
            onClick={() => setIsNewSwapOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-semibold text-white transition shadow-xs"
          >
            <Plus className="h-4 w-4" /> Ruildienst Voorstellen
          </button>
        )}
      </div>

      {/* List of Trade Proposals */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
          Actief Ruilbord
        </h3>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
          </div>
        ) : swaps.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/40 text-sm">
            Geen actieve ruildienst aanvragen gevonden.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {swaps.map((swap) => {
              const isRequester = user.employee?.id === swap.requesterId;
              const isTarget = user.employee?.id === swap.targetId;

              return (
                <div key={swap.id} className="p-5 border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between space-y-4 shadow-2xs">
                  
                  {/* Swap participants & status */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-slate-500">Voorgesteld door</p>
                        <p className="text-sm font-bold text-slate-800">{swap.requester?.user?.name}</p>
                      </div>
                      {getStatusLabel(swap.status)}
                    </div>

                    {/* Trade items */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase">HUN SHIFT (TE GEVEN)</span>
                        <p className="text-xs font-bold text-slate-800">{swap.shift?.name}</p>
                        <p className="text-[10px] text-slate-500">{swap.shift?.date} • {swap.shift?.startTime} - {swap.shift?.endTime}</p>
                      </div>

                      {swap.targetShift ? (
                        <div className="border-t border-slate-200 pt-2">
                          <span className="text-[10px] font-bold text-amber-600 uppercase">UW SHIFT (TE ONTVANGEN)</span>
                          <p className="text-xs font-bold text-slate-800">{swap.targetShift?.name}</p>
                          <p className="text-[10px] text-slate-500">{swap.targetShift?.date} • {swap.targetShift?.startTime} - {swap.targetShift?.endTime}</p>
                        </div>
                      ) : (
                        <div className="border-t border-slate-200 pt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">UW SHIFT (TE ONTVANGEN)</span>
                          <p className="text-xs italic text-slate-400">Open Ruil (Collega heeft geen shift om terug te geven)</p>
                        </div>
                      )}
                    </div>

                    {/* Reason / comments */}
                    <div className="text-xs bg-slate-100 p-2.5 rounded-lg text-slate-600 space-y-1">
                      <p className="font-semibold text-[10px] text-slate-400 uppercase">Reden</p>
                      <p className="leading-relaxed">{swap.reason}</p>
                    </div>
                  </div>

                  {/* Actions depending on Role and State */}
                  <div className="border-t border-slate-200 pt-3">
                    {/* Respondent Action Panel */}
                    {isTarget && swap.status === "PENDING_TARGET" && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                          <Info className="h-3.5 w-3.5" /> Ruilvoorstel aan u gericht:
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespondentAction(swap.id, true)}
                            className="flex-1 flex justify-center items-center gap-1 py-1.5 border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg transition"
                          >
                            <Check className="h-3.5 w-3.5" /> Accepteren
                          </button>
                          <button
                            onClick={() => handleRespondentAction(swap.id, false)}
                            className="flex-1 flex justify-center items-center gap-1 py-1.5 border border-red-200 hover:bg-red-50 text-red-700 text-xs font-bold rounded-lg transition"
                          >
                            <X className="h-3.5 w-3.5" /> Weigeren
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin Approval Panel */}
                    {user.role === "ADMINISTRATOR" && swap.status === "ACCEPTED_TARGET" && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <ClipboardCheck className="h-3.5 w-3.5" /> Onderling akkoord. Goedkeuring Beheerder vereist:
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAdminApproval(swap.id, true)}
                            className="flex-1 flex justify-center items-center gap-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                          >
                            <Check className="h-3.5 w-3.5" /> Ruil Goedkeuren
                          </button>
                          <button
                            onClick={() => handleAdminApproval(swap.id, false)}
                            className="flex-1 flex justify-center items-center gap-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition"
                          >
                            <X className="h-3.5 w-3.5" /> Ruil Weigeren
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Standard helper states */}
                    {isRequester && swap.status === "PENDING_TARGET" && (
                      <p className="text-[10px] text-slate-400 text-center italic">
                        Wachten op reactie van uw collega...
                      </p>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW PROPOSAL MODAL */}
      {isNewSwapOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              <ArrowLeftRight className="h-5 w-5 text-blue-500" /> Ruildienst Voorstellen
            </h3>
            
            <form onSubmit={handleCreateSwap} className="space-y-3 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">1. Selecteer uw shift om weg te geven</label>
                <select
                  required
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">-- Kies Uw Shift --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.date} • {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">2. Kies de collega om mee te ruilen</label>
                <select
                  required
                  value={selectedTargetColleagueId}
                  onChange={(e) => setSelectedTargetColleagueId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">-- Kies Collega --</option>
                  {employees
                    .filter((emp) => emp.id !== user.employee?.id)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.user?.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">3. Selecteer gewenste shift van collega (Optioneel)</label>
                <input
                  type="text"
                  placeholder="Bijv. Vroege dienst volgende dinsdag"
                  value={selectedTargetShiftId}
                  onChange={(e) => setSelectedTargetShiftId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Reden voor ruil</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Leg uit waarom u deze ruildienst aanvraagt..."
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewSwapOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold text-slate-600 transition"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Versturen..." : "Voorstel Verzenden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
