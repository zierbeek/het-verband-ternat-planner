import React, { useState, useEffect } from "react";
import { ClipboardList, Plus, FileText, Calendar, Check, X, ShieldAlert, BadgeInfo } from "lucide-react";
import { LeaveRequest } from "../types.js";

interface LeaveManagementProps {
  user: any;
  token: string;
}

export default function LeaveManagement({ user, token }: LeaveManagementProps) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("VACATION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Admin Response State
  const [adminComment, setAdminComment] = useState("");
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [responseAction, setResponseAction] = useState<"approve" | "reject" | null>(null);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leave-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLeaves(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [user, token]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: leaveType,
          startDate,
          endDate,
          reason,
        }),
      });

      if (res.ok) {
        setIsNewRequestOpen(false);
        setReason("");
        setStartDate("");
        setEndDate("");
        fetchLeaves();
      } else {
        const err = await res.json();
        alert(err.error || "Fout bij het indienen van de verlofaanvraag");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveRequest = async (leaveId: string, approve: boolean) => {
    try {
      const endpoint = approve ? "approve" : "reject";
      const res = await fetch(`/api/leave-requests/${leaveId}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment: adminComment }),
      });

      if (res.ok) {
        setSelectedLeaveId(null);
        setResponseAction(null);
        setAdminComment("");
        fetchLeaves();
      } else {
        const err = await res.json();
        alert(err.error || "Fout bij het verwerken van de verlofaanvraag");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">Goedgekeurd</span>;
      case "REJECTED":
        return <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-1 rounded-full">Geweigerd</span>;
      default:
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full animate-pulse">Wacht op goedkeuring</span>;
    }
  };

  const translateLeaveType = (type: string) => {
    switch (type) {
      case "VACATION":
        return "Betaald Verlof / Vakantie";
      case "SICK_LEAVE":
        return "Ziekteverlof";
      case "TRAINING":
        return "Opleiding / Training";
      case "PERSONAL":
        return "Persoonlijk Verlof";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title / Action bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            Verlof & Afwezigheidsbeheer
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {user.role === "ADMINISTRATOR" 
              ? "Beoordeel, keur goed of weiger verlofaanvragen van medewerkers"
              : "Vraag verlof aan, bekijk uw saldo en volg de goedkeuringsstatus"}
          </p>
        </div>

        {user.role === "EMPLOYEE" && (
          <button
            onClick={() => setIsNewRequestOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-semibold text-white transition shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Verlof Aanvragen
          </button>
        )}
      </div>

      {/* Main Leave Request Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
          {user.role === "ADMINISTRATOR" ? "Alle Verlofaanvragen Medewerkers" : "Uw Verlofaanvragen Geschiedenis"}
        </h3>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
          </div>
        ) : leaves.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/40 text-sm">
            Geen verlofaanvragen geregistreerd.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaves.map((leave) => (
              <div key={leave.id} className="p-5 border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition space-y-4 flex flex-col justify-between shadow-2xs">
                
                {/* Header info */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100 uppercase">
                        {translateLeaveType(leave.type)}
                      </span>
                      {user.role === "ADMINISTRATOR" && leave.employee?.user && (
                        <p className="font-bold text-slate-800 text-sm mt-1.5 flex items-center gap-1.5">
                          {leave.employee.user.name}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(leave.status)}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium pt-1.5">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{leave.startDate} tot {leave.endDate}</span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Reden</p>
                    <p className="text-xs text-slate-700 mt-1">{leave.reason}</p>
                  </div>

                  {leave.comment && (
                    <div className="p-2.5 bg-amber-50/30 border border-amber-100 rounded-lg">
                      <p className="text-xs text-amber-800 font-semibold uppercase tracking-wider text-[10px]">Opmerking beheerder</p>
                      <p className="text-xs text-amber-900 mt-1 italic">{leave.comment}</p>
                    </div>
                  )}
                </div>

                {/* Approve/Reject triggers for Admin */}
                {user.role === "ADMINISTRATOR" && leave.status === "PENDING" && (
                  <div className="border-t border-slate-200 pt-3">
                    {selectedLeaveId === leave.id ? (
                      <div className="space-y-2.5">
                        <textarea
                          placeholder="Optionele feedback / opmerkingen..."
                          value={adminComment}
                          onChange={(e) => setAdminComment(e.target.value)}
                          rows={2}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => {
                              setSelectedLeaveId(null);
                              setResponseAction(null);
                            }}
                            className="px-2.5 py-1 text-xs border border-slate-200 hover:bg-slate-50 rounded-md font-semibold text-slate-500 cursor-pointer"
                          >
                            Annuleren
                          </button>
                          <button
                            onClick={() => handleResolveRequest(leave.id, responseAction === "approve")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md text-white cursor-pointer ${
                              responseAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            {responseAction === "approve" ? "Bevestig Goedkeuring" : "Bevestig Weigering"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedLeaveId(leave.id);
                            setResponseAction("approve");
                          }}
                          className="flex-1 flex justify-center items-center gap-1.5 py-1.5 border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" /> Goedkeuren
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLeaveId(leave.id);
                            setResponseAction("reject");
                          }}
                          className="flex-1 flex justify-center items-center gap-1.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-700 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" /> Weigeren
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      {/* NEW REQUEST MODAL */}
      {isNewRequestOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Verlof / Afwezigheid Aanvragen</h3>
            
            <form onSubmit={handleSubmitRequest} className="space-y-3 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Type Verlof</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="VACATION">Betaald Verlof / Vakantie</option>
                  <option value="SICK_LEAVE">Ziekteverlof</option>
                  <option value="TRAINING">Opleiding / Training</option>
                  <option value="PERSONAL">Persoonlijk Verlof</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Startdatum</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Einddatum</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Reden / Toelichting</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Leg uit waarom u afwezig zult zijn..."
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewRequestOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold text-slate-600 transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Versturen..." : "Aanvraag Verzenden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
