import React, { useEffect, useState } from "react";
import { Clock, Calendar, CheckSquare, Megaphone, Bell, BellOff, User, ClipboardList, TrendingUp, Trash2, Archive } from "lucide-react";
import { Shift, Announcement, Notification } from "../types.js";
import { getUserColorStyle } from "../utils/userColor.ts";

interface DashboardProps {
  user: any;
  token: string;
}

export default function Dashboard({ user, token }: DashboardProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedAnnouncementId, setHighlightedAnnouncementId] = useState<string | null>(null);
  // Scope for the iCal subscription link: "mine" only shows shifts assigned to
  // this person, "all" shows the full team roster. Every account has an
  // Employee profile (even administrators), so this choice applies equally
  // to everyone rather than being tied to role.
  const [icalScope, setIcalScope] = useState<"mine" | "all">("mine");

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Get shifts for next 7 days
      const start = new Date().toISOString().split("T")[0];
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const endStr = end.toISOString().split("T")[0];

      const url = user.role === "EMPLOYEE" 
        ? `/api/shifts?startDate=${start}&endDate=${endStr}&employeeId=${user.employee?.id}`
        : `/api/shifts?startDate=${start}&endDate=${endStr}`;

      const [resShifts, resAnn, resNotif] = await Promise.all([
        fetch(url, { headers }),
        fetch("/api/announcements", { headers }),
        fetch("/api/notifications", { headers }),
      ]);

      const dataShifts = await resShifts.json();
      const dataAnn = await resAnn.json();
      const dataNotif = await resNotif.json();

      setShifts(dataShifts);
      setAnnouncements(dataAnn);
      setNotifications(dataNotif);
    } catch (error) {
      console.error("Fout bij het ophalen van dashboardgegevens:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user, token]);

  useEffect(() => {
    const targetId = new URLSearchParams(window.location.search).get("announcementId");
    if (!targetId) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(`announcement-${targetId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedAnnouncementId(targetId);
      }
    }, 150);

    const clearTimer = window.setTimeout(() => setHighlightedAnnouncementId(null), 5000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [announcements]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await fetch(`/api/notifications/${notifId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Update locally
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchiveNotification = async (notifId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notifId}/archive`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNotification = async (notifId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notifId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchiveAnnouncement = async (announcementId: string) => {
    try {
      const res = await fetch(`/api/announcements/${announcementId}/archive`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAnnouncements((prev) => prev.filter((ann) => ann.id !== announcementId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    try {
      const res = await fetch(`/api/announcements/${announcementId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAnnouncements((prev) => prev.filter((ann) => ann.id !== announcementId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenNotification = (notif: Notification) => {
    if (notif.link) {
      window.location.href = notif.link;
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayShifts = shifts.filter((s) => s.date === todayStr);
  const upcomingShifts = shifts.filter((s) => s.date > todayStr);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Welcome */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welkom terug, {user.name}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Rol: <span className="font-semibold text-slate-700">{user.role === "ADMINISTRATOR" ? "Beheerder" : "Verpleegkundige"}</span>
            {user.role === "EMPLOYEE" && " • Thuisverpleging Het Verband Ternat Planner"}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-blue-50 text-blue-700 px-4 py-2.5.5 rounded-xl border border-blue-100">
          <Clock className="h-5 w-5" />
          <div className="text-xs font-mono font-medium">
            Tijdstip: {new Date().toISOString().substring(0, 16).replace("T", " ")}
          </div>
        </div>
      </div>

      {/* Grid of contents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column (Shifts and Announcements) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Shifts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              Shifts van Vandaag ({todayShifts.length})
            </h3>

            {todayShifts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-sm">
                Geen geplande diensten voor vandaag.
              </div>
            ) : (
              <div className="space-y-3">
                {todayShifts.map((shift) => (
                  <div
                    key={shift.id}
                    style={{ borderLeftColor: shift.color }}
                    className="p-4 border-l-4 rounded-r-xl bg-slate-50/50 hover:bg-slate-50 transition border border-slate-200 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">{shift.name}</h4>
                      <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {shift.startTime} - {shift.endTime}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-sm font-medium text-[10px]">
                          Vandaag
                        </span>
                      </div>
                      {shift.notes && (
                        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 italic font-mono bg-white p-1 rounded border border-slate-200">
                          Opmerking: {shift.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {shift.assignments && shift.assignments.length > 0 ? (
                        shift.assignments.map((assign: any) => (
                          <span
                            key={assign.id}
                            style={getUserColorStyle(assign.employeeId, 0.14)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1"
                          >
                            <User className="h-3 w-3" /> {assign.employee.user.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-red-500 text-xs sm:text-sm font-semibold bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full">
                          Onbezet
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Shifts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-blue-500" />
              Komende Shifts (Volgende 7 Dagen)
            </h3>

            {upcomingShifts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-sm">
                Geen komende diensten gepland in de komende 7 dagen.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShifts.slice(0, 5).map((shift) => (
                  <div
                    key={shift.id}
                    style={{ borderLeftColor: shift.color }}
                    className="p-4 border-l-4 rounded-r-xl bg-slate-50/50 hover:bg-slate-50 transition border border-slate-200 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">{shift.name}</h4>
                      <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {shift.startTime} - {shift.endTime}
                        </span>
                        <span>•</span>
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-sm font-medium text-[10px]">
                          {shift.date}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      {shift.assignments && shift.assignments.length > 0 ? (
                        shift.assignments.map((assign: any) => (
                          <span
                            key={assign.id}
                            style={getUserColorStyle(assign.employeeId, 0.14)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1"
                          >
                            <User className="h-3 w-3" /> {assign.employee.user.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-red-500 text-xs sm:text-sm font-semibold bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full">
                          Onbezet
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Megaphone className="h-5 w-5 text-blue-500" />
              Laatste Mededelingen
            </h3>

            {announcements.length === 0 ? (
              <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-sm">
                Geen actieve organisatiemededelingen.
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    id={`announcement-${ann.id}`}
                    className={`p-4 rounded-xl bg-amber-50/30 border space-y-3 transition ${
                      highlightedAnnouncementId === ann.id ? "border-amber-400 ring-2 ring-amber-200" : "border-amber-100"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h4 className="font-bold text-amber-900 text-sm">{ann.title}</h4>
                        <p className="text-xs text-amber-800 mt-1 font-medium">
                          Geplaatst door {ann.author?.name} op {new Date(ann.createdAt).toLocaleDateString("nl-BE")}
                        </p>
                      </div>
                      {user.role === "ADMINISTRATOR" && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleArchiveAnnouncement(ann.id)}
                            className="p-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-100 transition"
                            title="Archiveren"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                            title="Verwijderen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Notifications Panel & Summary metrics) */}
        <div className="space-y-6">
          
          {/* Notifications Center */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-500" />
                Meldingen
              </h3>
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white font-semibold text-xs px-2.5 py-0.5 rounded-full">
                  {unreadCount} ongelezen
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                <BellOff className="h-8 w-8 text-slate-300" />
                Geen meldingsgeschiedenis.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleOpenNotification(notif)}
                    className={`p-3 rounded-xl border transition flex flex-col gap-1 ${
                      notif.link ? "cursor-pointer" : ""
                    } ${
                      notif.isRead
                        ? "bg-slate-50/50 border-slate-100"
                        : "bg-blue-50/30 border-blue-100"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className={`font-semibold text-xs ${notif.isRead ? "text-slate-700" : "text-blue-900"}`}>
                        {notif.title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!notif.isRead && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleMarkAsRead(notif.id);
                            }}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition hover:underline cursor-pointer"
                          >
                            Gelezen
                          </button>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleArchiveNotification(notif.id);
                          }}
                          className="p-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
                          title="Archiveren"
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteNotification(notif.id);
                          }}
                          className="p-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                          title="Verwijderen"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                    {notif.link && <span className="text-[10px] text-blue-600 font-semibold">Open artikel of actie</span>}
                    <span className="text-[10px] text-slate-400 self-end">
                      {new Date(notif.createdAt).toLocaleDateString("nl-BE")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* iCal Calendar Sync */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-4.5 w-4.5 text-blue-500" /> Kalender Synchroniseren
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Koppel je werkrooster direct aan je iPhone, Google Calendar of Outlook. Wijzigingen op het planbord worden automatisch gesynchroniseerd!
            </p>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setIcalScope("mine")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition cursor-pointer ${
                  icalScope === "mine" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Enkel mijn shifts
              </button>
              <button
                onClick={() => setIcalScope("all")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition cursor-pointer ${
                  icalScope === "all" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Alle shifts
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                readOnly
                value={`${window.location.protocol}//${window.location.host}/api/calendar/sync/${user.id}/feed.ics?scope=${icalScope}`}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-mono focus:outline-hidden cursor-pointer"
                title="Klik om te selecteren"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/api/calendar/sync/${user.id}/feed.ics?scope=${icalScope}`);
                    alert("iCal-link gekopieerd naar klembord!");
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition cursor-pointer text-center"
                >
                  Kopieer Link
                </button>
                <a
                  href={`webcal://${window.location.host}/api/calendar/sync/${user.id}/feed.ics?scope=${icalScope}`}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition cursor-pointer text-center flex items-center justify-center"
                >
                  Direct Abonneren
                </a>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              💡 <strong>iOS / macOS:</strong> Klik op 'Direct Abonneren' om direct toe te voegen aan Apple Calendar.
            </p>
          </div>

          {/* Quick Stats Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
              Wekelijks Overzicht
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs sm:text-sm text-slate-500">Geplande Shifts</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{shifts.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs sm:text-sm text-slate-500">Toegewezen Team</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {shifts.filter((s) => s.assignments && s.assignments.length > 0).length}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs sm:text-sm text-slate-500">Dekkingspercentage</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {shifts.length > 0
                    ? Math.round((shifts.filter((s) => s.assignments && s.assignments.length > 0).length / shifts.length) * 100)
                    : 100}%
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
