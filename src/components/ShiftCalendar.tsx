import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  Clock,
  Settings,
  Filter,
  Copy,
  Printer,
  ChevronDown,
} from "lucide-react";
import { Shift, Employee } from "../types.js";

interface ShiftCalendarProps {
  user: any;
  token: string;
}

export default function ShiftCalendar({ user, token }: ShiftCalendarProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewType, setViewType] = useState<"month" | "week" | "day">("week");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [isPrintMode, setIsPrintMode] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // Form states for Create Shift
  const [shiftName, setShiftName] = useState("Voormiddag");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftColor, setShiftColor] = useState("#10b981");
  const [requiredEmployees, setRequiredEmployees] = useState(1);
  const [notes, setNotes] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");

  // Planning Copy states (Multiple modes)
  const [isCopyWeekOpen, setIsCopyWeekOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<"week" | "repeat" | "month">("week");
  const [sourceWeekStart, setSourceWeekStart] = useState("");
  const [targetWeekStart, setTargetWeekStart] = useState("");
  const [repeatWeeksCount, setRepeatWeeksCount] = useState(4);
  const [sourceMonth, setSourceMonth] = useState("");
  const [targetMonth, setTargetMonth] = useState("");
  const [copyEmployees, setCopyEmployees] = useState(true);

  // Leave requests state
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

  // Deletion confirmation inline state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Custom feedback state
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMessage({ text, type });
  };

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const fetchShifts = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      // Range calculation: standard 30 days before/after current date
      const start = new Date(currentDate);
      start.setDate(start.getDate() - 31);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 31);

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      let url = `/api/shifts?startDate=${startStr}&endDate=${endStr}`;
      if (selectedEmployeeFilter !== "all") {
        url += `&employeeId=${selectedEmployeeFilter}`;
      }

      const res = await fetch(url, { headers });
      const data = await res.json();
      setShifts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEmployees(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await fetch("/api/leave-requests?all=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaveRequests(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchEmployees();
    fetchLeaveRequests();
  }, [currentDate, selectedEmployeeFilter, token]);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: shiftName,
          startTime,
          endTime,
          date: shiftDate,
          color: shiftColor,
          requiredEmployees,
          notes,
          employeeId: assignEmployeeId || undefined,
        }),
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setNotes("");
        setAssignEmployeeId("");
        showFeedback("Shift succesvol aangemaakt!");
        fetchShifts();
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het aanmaken van de shift", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        setIsDeleteConfirmOpen(false);
        showFeedback("Shift succesvol verwijderd!");
        fetchShifts();
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het verwijderen van de shift", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    }
  };

  const handlePlanningCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let url = "/api/shifts/copy-week";
      let body: any = {};

      if (copyMode === "week") {
        url = "/api/shifts/copy-week";
        body = {
          sourceStartDate: sourceWeekStart,
          targetStartDate: targetWeekStart,
          copyEmployees,
        };
      } else if (copyMode === "repeat") {
        url = "/api/shifts/repeat-week";
        body = {
          sourceStartDate: sourceWeekStart,
          repeatWeeksCount: Number(repeatWeeksCount),
          copyEmployees,
        };
      } else if (copyMode === "month") {
        url = "/api/shifts/copy-month";
        body = {
          sourceYearMonth: sourceMonth,
          targetYearMonth: targetMonth,
          copyEmployees,
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        showFeedback(
          copyMode === "week"
            ? `Succesvol shifts gekopieerd naar de geselecteerde week!`
            : copyMode === "repeat"
            ? `Succesvol week herhaald voor de komende ${repeatWeeksCount} weken (${data.count} shifts aangemaakt)!`
            : `Succesvol maand gekopieerd van ${sourceMonth} naar ${targetMonth} (${data.count} shifts aangemaakt)!`,
          "success"
        );
        setIsCopyWeekOpen(false);
        fetchShifts();
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het kopiëren van de planning", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    }
  };

  // Date Nav Helpers
  const nextDate = () => {
    const d = new Date(currentDate);
    if (viewType === "month") d.setMonth(d.getMonth() + 1);
    else if (viewType === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const prevDate = () => {
    const d = new Date(currentDate);
    if (viewType === "month") d.setMonth(d.getMonth() - 1);
    else if (viewType === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  // Grid Calculation Helpers
  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    startOfWeek.setDate(diff);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const getMonthDates = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Padding for front
    const startDay = start.getDay();
    const padFront = startDay === 0 ? 6 : startDay - 1;

    const dates = [];
    for (let i = padFront; i > 0; i--) {
      const d = new Date(start);
      d.setDate(start.getDate() - i);
      dates.push(d);
    }

    const totalDays = end.getDate();
    for (let i = 1; i <= totalDays; i++) {
      dates.push(new Date(date.getFullYear(), date.getMonth(), i));
    }

    return dates;
  };

  const weekDates = getWeekDates(currentDate);
  const monthDates = getMonthDates(currentDate);

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return shifts.filter((s) => s.date === dateStr);
  };

  const getLeavesForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return leaveRequests.filter((leave) => {
      return dateStr >= leave.startDate && dateStr <= leave.endDate;
    });
  };

  return (
    <div className={`space-y-6 ${isPrintMode ? "p-12 bg-white max-w-5xl mx-auto" : ""}`}>
      {feedbackMessage && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${
          feedbackMessage.type === "success" 
            ? "bg-green-50 text-green-800 border-green-200" 
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {feedbackMessage.text}
        </div>
      )}
      {/* Upper Navigation/Controls bar */}
      {!isPrintMode && (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-500" />
              {currentDate.toLocaleDateString("nl-BE", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden ml-4">
              <button
                onClick={prevDate}
                className="p-1.5 hover:bg-slate-50 border-r border-slate-200 text-slate-600 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-xs font-semibold hover:bg-slate-50 border-r border-slate-200 text-slate-700 transition cursor-pointer"
              >
                Vandaag
              </button>
              <button
                onClick={nextDate}
                className="p-1.5 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* View Switcher */}
            <div className="flex rounded-lg bg-slate-100 p-1">
              {[
                { view: "month", label: "Maand" },
                { view: "week", label: "Week" },
                { view: "day", label: "Dag" },
              ].map(({ view, label }) => (
                <button
                  key={view}
                  onClick={() => setViewType(view as any)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                    viewType === view
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Filter by Staff */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedEmployeeFilter}
                onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                className="bg-transparent font-medium border-0 focus:ring-0 cursor-pointer"
              >
                <option value="all">Alle Medewerkers</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.user?.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Print Trigger */}
            <button
              onClick={() => {
                setIsPrintMode(true);
                setTimeout(() => {
                  window.print();
                  setIsPrintMode(false);
                }, 500);
              }}
              className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer"
              title="Afdrukken"
            >
              <Printer className="h-4 w-4" />
            </button>

            {/* Admin Controls */}
            {user.role === "ADMINISTRATOR" && (
              <>
                <button
                  onClick={() => setIsCopyWeekOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" /> Week Kopiëren
                </button>
                <button
                  onClick={() => {
                    setShiftDate(currentDate.toISOString().split("T")[0]);
                    setIsCreateModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold text-white transition shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Shift Aanmaken
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Grid Calendar Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Month View */}
        {viewType === "month" && (
          <div>
            <div className="grid grid-cols-7 bg-slate-50/70 border-b border-slate-200 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-slate-200">
              {monthDates.map((date, idx) => {
                const dayShifts = getShiftsForDate(date);
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();

                return (
                  <div
                    key={idx}
                    className={`min-h-[110px] p-2 border-r border-b border-slate-200 flex flex-col gap-1 transition ${
                      isCurrentMonth ? "bg-white" : "bg-slate-50/40 text-slate-400"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-700">
                      {date.getDate()}
                    </span>
                    <div className="space-y-1 overflow-y-auto max-h-[85px]">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          onClick={() => {
                            if (user.role === "ADMINISTRATOR") {
                              setSelectedShift(shift);
                              setIsEditModalOpen(true);
                            }
                          }}
                          style={{ backgroundColor: shift.color + "22", borderLeftColor: shift.color }}
                          className="px-1.5 py-0.5 border-l-2 rounded-r text-[10px] font-semibold text-slate-800 cursor-pointer hover:opacity-85 transition truncate"
                          title={`${shift.name} (${shift.startTime}-${shift.endTime})`}
                        >
                          {shift.startTime} {shift.name}
                        </div>
                      ))}
                      {getLeavesForDate(date).map((leave) => (
                        <div
                          key={`leave-${leave.id}`}
                          style={{ borderLeftColor: leave.status === "APPROVED" ? "#f43f5e" : "#f59e0b" }}
                          className={`px-1.5 py-0.5 border-l-2 rounded-r text-[10px] font-semibold truncate ${
                            leave.status === "APPROVED"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700 italic"
                          }`}
                          title={`Verlof (${leave.type}): ${leave.employee.user.name} (${leave.status === "APPROVED" ? "Goedgekeurd" : "In afwachting"})`}
                        >
                          🌴 {leave.employee.user.name.split(" ")[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewType === "week" && (
          <div>
            <div className="grid grid-cols-7 bg-slate-50/70 border-b border-slate-200 py-3.5 text-center">
              {weekDates.map((date, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {date.toLocaleDateString("nl-BE", { weekday: "short" })}
                  </span>
                  <p className="text-lg font-extrabold text-slate-800">
                    {date.getDate()}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-slate-200 min-h-[400px]">
              {weekDates.map((date, idx) => {
                const dayShifts = getShiftsForDate(date);
                return (
                  <div key={idx} className="p-3 bg-white space-y-2 flex flex-col">
                    {dayShifts.length === 0 ? (
                      <span className="text-[11px] text-slate-300 italic self-center mt-8">
                        Geen shifts
                      </span>
                    ) : (
                      dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          onClick={() => {
                            if (user.role === "ADMINISTRATOR") {
                              setSelectedShift(shift);
                              setIsEditModalOpen(true);
                            }
                          }}
                          style={{ borderLeftColor: shift.color }}
                          className="p-2.5 border-l-4 rounded-r-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200 transition cursor-pointer flex flex-col gap-1.5 shadow-2xs"
                        >
                          <span className="font-bold text-slate-800 text-[11px] truncate">
                            {shift.name}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                            <Clock className="h-3 w-3 shrink-0" /> {shift.startTime} - {shift.endTime}
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-1">
                            {shift.assignments && shift.assignments.length > 0 ? (
                              shift.assignments.map((assign: any) => (
                                <span
                                  key={assign.id}
                                  className="bg-blue-50 text-blue-700 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-blue-100/50 truncate max-w-full"
                                >
                                  {assign.employee.user.name.split(" ")[0]}
                                </span>
                              ))
                            ) : (
                              <span className="text-red-500 text-[9px] font-bold bg-red-50 px-1.5 rounded-full">
                                Onbezet
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Approved Leaves in Week View */}
                    {getLeavesForDate(date).length > 0 && (
                      <div className="pt-2 border-t border-slate-100 mt-auto space-y-1">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <span>Verlof 🌴</span>
                        </div>
                        {getLeavesForDate(date).map((leave) => (
                          <div
                            key={`leave-${leave.id}`}
                            className={`p-1 border-l-2 text-[10px] leading-tight rounded-r ${
                              leave.status === "APPROVED"
                                ? "bg-red-50 border-red-400 text-red-700"
                                : "bg-amber-50 border-amber-400 text-amber-700 italic"
                            }`}
                            title={`Verlof (${leave.type}): ${leave.employee.user.name} (${leave.status === "APPROVED" ? "Goedgekeurd" : "In afwachting"})`}
                          >
                            <span className="font-semibold block truncate">{leave.employee.user.name.split(" ")[0]}</span>
                            <span className="text-[8px] text-slate-500 block truncate">{leave.reason || leave.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewType === "day" && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-500" />
              Dienstregeling voor {currentDate.toLocaleDateString("nl-BE", { weekday: "long", month: "long", day: "numeric" })}
            </h3>

            <div className="space-y-3">
              {getShiftsForDate(currentDate).length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30 text-sm">
                  Geen shifts gepland voor deze dag.
                </div>
              ) : (
                getShiftsForDate(currentDate).map((shift) => (
                  <div
                    key={shift.id}
                    onClick={() => {
                      if (user.role === "ADMINISTRATOR") {
                        setSelectedShift(shift);
                        setIsEditModalOpen(true);
                      }
                    }}
                    style={{ borderLeftColor: shift.color }}
                    className="p-5 border-l-4 rounded-r-2xl bg-slate-50/50 hover:bg-slate-50 transition border border-slate-200 flex justify-between items-center cursor-pointer shadow-2xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{shift.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3.5 w-3.5 text-slate-400" /> {shift.startTime} - {shift.endTime}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600">
                          Vereist personeel: {shift.requiredEmployees}
                        </span>
                      </div>
                      {shift.notes && (
                        <p className="text-xs text-slate-500 mt-2 italic font-mono bg-white p-1.5 rounded border border-slate-200">
                          Opmerkingen: {shift.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {shift.assignments && shift.assignments.length > 0 ? (
                        shift.assignments.map((assign: any) => (
                          <span
                            key={assign.id}
                            className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5"
                          >
                            <User className="h-3.5 w-3.5" /> {assign.employee.user.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-red-500 text-xs font-semibold bg-red-50 border border-red-100 px-3 py-1 rounded-full">
                          Onbezet
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* CREATE SHIFT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Nieuwe Shift Toevoegen</h3>
            
            <form onSubmit={handleCreateShift} className="space-y-3 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Dienst / Type Shift</label>
                <select
                  value={shiftName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShiftName(val);
                    if (val === "Voormiddag" || val === "Vroege Dienst" || val === "Morning Shift") {
                      setStartTime("07:00");
                      setEndTime("15:00");
                      setShiftColor("#10b981");
                    } else if (val === "Namiddag" || val === "Late Dienst" || val === "Afternoon Shift") {
                      setStartTime("15:00");
                      setEndTime("23:00");
                      setShiftColor("#f59e0b");
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="Voormiddag">Voormiddag (07:00 - 15:00)</option>
                  <option value="Namiddag">Namiddag (15:00 - 23:00)</option>
                  <option value="Aangepaste Shift">Aangepaste Shift</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Starttijd</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="07:00"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Eindtijd</label>
                  <input
                    type="text"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="15:00"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Datum</label>
                <input
                  type="date"
                  required
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Direct toewijzen aan</label>
                <select
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="">-- Nog niet toewijzen --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Kleur Label</label>
                  <input
                    type="color"
                    value={shiftColor}
                    onChange={(e) => setShiftColor(e.target.value)}
                    className="mt-1 block w-full h-10 p-1 border border-slate-300 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Vereist Personeel</label>
                  <input
                    type="number"
                    min="1"
                    value={requiredEmployees}
                    onChange={(e) => setRequiredEmployees(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Opmerkingen / Instructies</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Bijv. speciale ICU-verpleging vereist"
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold text-slate-600 transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition shadow-xs cursor-pointer"
                >
                  Shift Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SHIFT MODAL */}
      {isEditModalOpen && selectedShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Shift Beheren</h3>
            
            <div className="space-y-3 text-sm text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-800">{selectedShift.name}</p>
                <p className="text-xs text-slate-500 mt-1">Datum: {selectedShift.date}</p>
                <p className="text-xs text-slate-500">Tijd: {selectedShift.startTime} - {selectedShift.endTime}</p>
              </div>

              {!isDeleteConfirmOpen ? (
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="w-full flex justify-center py-2 border border-red-200 hover:bg-red-50 text-red-600 font-semibold rounded-lg transition cursor-pointer"
                >
                  Shift Verwijderen
                </button>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-center">
                  <p className="text-xs text-red-800 font-semibold">Weet u zeker dat u deze shift wilt verwijderen?</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteShift(selectedShift.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      Ja, verwijder
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirmOpen(false)}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      Annuleer
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COPY WEEK MODAL */}
      {isCopyWeekOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              <Copy className="h-5 w-5 text-blue-500" /> Planning Kopiëren & Lange Termijn Plannen
            </h3>

            {/* Tab switchers */}
            <div className="flex rounded-lg bg-slate-100 p-1">
              {[
                { mode: "week", label: "Week Kopiëren" },
                { mode: "repeat", label: "Week Herhalen" },
                { mode: "month", label: "Maand Kopiëren" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCopyMode(mode as any)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                    copyMode === mode
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handlePlanningCopy} className="space-y-4 text-sm text-slate-700">
              {copyMode === "week" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Startdatum bronweek (Ma)</label>
                    <input
                      type="date"
                      required
                      value={sourceWeekStart}
                      onChange={(e) => setSourceWeekStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Startdatum doelweek (Ma)</label>
                    <input
                      type="date"
                      required
                      value={targetWeekStart}
                      onChange={(e) => setTargetWeekStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {copyMode === "repeat" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Startdatum bronweek (Ma)</label>
                    <input
                      type="date"
                      required
                      value={sourceWeekStart}
                      onChange={(e) => setSourceWeekStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Aantal weken herhalen (Lange termijn)</label>
                    <select
                      value={repeatWeeksCount}
                      onChange={(e) => setRepeatWeeksCount(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="1">1 week</option>
                      <option value="2">2 weken</option>
                      <option value="3">3 weken</option>
                      <option value="4">4 weken (1 maand)</option>
                      <option value="8">8 weken (2 maanden)</option>
                      <option value="12">12 weken (3 maanden)</option>
                      <option value="16">16 weken (4 maanden)</option>
                      <option value="24">24 weken (half jaar)</option>
                    </select>
                  </div>
                </div>
              )}

              {copyMode === "month" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Bronmaand</label>
                    <input
                      type="month"
                      required
                      placeholder="YYYY-MM"
                      value={sourceMonth}
                      onChange={(e) => setSourceMonth(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Doelmaand</label>
                    <input
                      type="month"
                      required
                      placeholder="YYYY-MM"
                      value={targetMonth}
                      onChange={(e) => setTargetMonth(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Shared Option: Copy assignments */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="copyEmployees"
                  checked={copyEmployees}
                  onChange={(e) => setCopyEmployees(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="copyEmployees" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                  Inclusief toegewezen medewerkers kopiëren
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsCopyWeekOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold text-slate-600 transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition shadow-xs cursor-pointer"
                >
                  {copyMode === "week" ? "Week Kopiëren" : copyMode === "repeat" ? "Lange Termijn Herhalen" : "Maand Kopiëren"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
