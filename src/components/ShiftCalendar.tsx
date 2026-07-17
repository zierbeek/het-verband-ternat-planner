import React, { useState, useEffect, useRef } from "react";
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
  Pencil,
  Trash2,
  X,
  CheckSquare,
  Square,
  Repeat,
  CalendarClock,
} from "lucide-react";
import { Shift, Employee, ShiftPreset, ShiftTemplate } from "../types.js";
import { getUserColorStyle } from "../utils/userColor.ts";

interface ShiftCalendarProps {
  user: any;
  token: string;
}

type PlannerSlot = "morning" | "afternoon";

type PlannerDragItem =
  | { type: "template"; presetId: string }
  | { type: "shift"; shiftId: string };

// Fallback used only until presets have loaded from the server, or if fewer
// than two presets exist. The first two presets (by `order`) define the
// two quick-planning columns; administrators can rename/retime/recolor them
// (and add further presets) via the "Presets beheren" panel.
const FALLBACK_SLOT_PRESETS: Record<PlannerSlot, ShiftPreset> = {
  morning: { id: "fallback-morning", label: "Voormiddag", startTime: "07:00", endTime: "15:00", color: "#10b981", order: 0 },
  afternoon: { id: "fallback-afternoon", label: "Namiddag", startTime: "15:00", endTime: "23:00", color: "#f59e0b", order: 1 },
};

const parseTimeToMinutes = (time: string) => {
  if (!time) return 0;
  if (time.includes("T")) {
    const date = new Date(time);
    return date.getHours() * 60 + date.getMinutes();
  }

  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const getShiftSlot = (shift: Shift): PlannerSlot => {
  const normalizedName = shift.name.toLowerCase();
  if (normalizedName.includes("voormiddag") || normalizedName.includes("morning")) return "morning";
  if (normalizedName.includes("namiddag") || normalizedName.includes("afternoon") || normalizedName.includes("late")) return "afternoon";
  return parseTimeToMinutes(shift.startTime) < 12 * 60 ? "morning" : "afternoon";
};

const getEmployeeBadgeStyle = (employeeId?: string) => getUserColorStyle(employeeId, 0.14);

export default function ShiftCalendar({ user, token }: ShiftCalendarProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewType, setViewType] = useState<"month" | "week" | "day">("week");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [isPrintMode, setIsPrintMode] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // Preset management modal state
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState("");
  const [newPresetStart, setNewPresetStart] = useState("06:00");
  const [newPresetEnd, setNewPresetEnd] = useState("14:00");
  const [newPresetColor, setNewPresetColor] = useState("#6366f1");
  const [newPresetDefaultEmployeeId, setNewPresetDefaultEmployeeId] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetDraft, setEditPresetDraft] = useState<{ label: string; startTime: string; endTime: string; color: string; defaultEmployeeId: string } | null>(null);

  // Shift template (recurring pattern) management state
  const DOW_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
  const [templateFormMode, setTemplateFormMode] = useState<"list" | "create" | "edit">("list");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateStart, setTemplateStart] = useState("07:00");
  const [templateEnd, setTemplateEnd] = useState("15:00");
  const [templateColor, setTemplateColor] = useState("#8b5cf6");
  const [templateRequiredEmployees, setTemplateRequiredEmployees] = useState(1);
  const [templateNotes, setTemplateNotes] = useState("");
  const [templateDaysOfWeek, setTemplateDaysOfWeek] = useState<number[]>([]);
  const [templateRecurrence, setTemplateRecurrence] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [templateStartDate, setTemplateStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [templateEndDate, setTemplateEndDate] = useState("");
  const [templateDefaultEmployeeId, setTemplateDefaultEmployeeId] = useState("");
  const [isTemplateSubmitting, setIsTemplateSubmitting] = useState(false);
  const [templateDeleteConfirmId, setTemplateDeleteConfirmId] = useState<string | null>(null);

  // Generate-from-template panel state
  const [generatingTemplateId, setGeneratingTemplateId] = useState<string | null>(null);
  const [generateRangeStart, setGenerateRangeStart] = useState(new Date().toISOString().split("T")[0]);
  const [generateRangeEnd, setGenerateRangeEnd] = useState("");
  const [generateAssignEmployee, setGenerateAssignEmployee] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

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

  // --- Bulk shift selection & operations ---
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"assign" | "shift-dates" | "delete">("assign");
  const [bulkAssignEmployeeId, setBulkAssignEmployeeId] = useState("");
  const [bulkDayOffset, setBulkDayOffset] = useState(7);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // Leave requests state
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

  // Deletion confirmation inline state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Custom feedback state
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draggedItem, setDraggedItem] = useState<PlannerDragItem | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<string | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState<string>("");

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMessage({ text, type });
  };

  const resetTemplateForm = () => {
    setTemplateName("");
    setTemplateStart("07:00");
    setTemplateEnd("15:00");
    setTemplateColor("#8b5cf6");
    setTemplateRequiredEmployees(1);
    setTemplateNotes("");
    setTemplateDaysOfWeek([]);
    setTemplateRecurrence("WEEKLY");
    setTemplateStartDate(new Date().toISOString().split("T")[0]);
    setTemplateEndDate("");
    setTemplateDefaultEmployeeId("");
    setEditingTemplateId(null);
  };

  const toggleTemplateDay = (day: number) => {
    setTemplateDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const startEditingTemplate = (tmpl: ShiftTemplate) => {
    setEditingTemplateId(tmpl.id);
    setTemplateName(tmpl.name);
    setTemplateStart(tmpl.startTime);
    setTemplateEnd(tmpl.endTime);
    setTemplateColor(tmpl.color);
    setTemplateRequiredEmployees(tmpl.requiredEmployees);
    setTemplateNotes(tmpl.notes || "");
    let days: number[] = [];
    try {
      days = JSON.parse(tmpl.daysOfWeek || "[]");
    } catch {
      days = [];
    }
    setTemplateDaysOfWeek(days);
    setTemplateRecurrence(tmpl.recurrencePattern);
    setTemplateStartDate(tmpl.startDate);
    setTemplateEndDate(tmpl.endDate || "");
    setTemplateDefaultEmployeeId(tmpl.defaultEmployeeId || "");
    setTemplateFormMode("edit");
  };

  const handleTemplateSubmit = async () => {
    if (!templateName || !templateStart || !templateEnd || templateDaysOfWeek.length === 0) {
      showFeedback("Vul de naam, tijden en minstens één dag van de week in.", "error");
      return;
    }
    setIsTemplateSubmitting(true);
    try {
      const payload = {
        name: templateName,
        startTime: templateStart,
        endTime: templateEnd,
        color: templateColor,
        requiredEmployees: templateRequiredEmployees,
        notes: templateNotes || null,
        daysOfWeek: templateDaysOfWeek,
        recurrencePattern: templateRecurrence,
        startDate: templateStartDate,
        endDate: templateEndDate || null,
        defaultEmployeeId: templateDefaultEmployeeId || null,
      };

      const url = editingTemplateId ? `/api/shift-templates/${editingTemplateId}` : "/api/shift-templates";
      const method = editingTemplateId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showFeedback(editingTemplateId ? "Sjabloon bijgewerkt!" : "Sjabloon aangemaakt!");
        resetTemplateForm();
        setTemplateFormMode("list");
        fetchTemplates();
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het opslaan van het sjabloon", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    } finally {
      setIsTemplateSubmitting(false);
    }
  };

  const handleTemplateDelete = async (templateId: string, deleteGeneratedShifts: boolean) => {
    try {
      const res = await fetch(`/api/shift-templates/${templateId}?deleteGeneratedShifts=${deleteGeneratedShifts}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showFeedback("Sjabloon verwijderd!");
        setTemplateDeleteConfirmId(null);
        fetchTemplates();
        fetchShifts();
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het verwijderen van het sjabloon", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    }
  };

  const handleGenerateFromTemplate = async () => {
    if (!generatingTemplateId || !generateRangeStart || !generateRangeEnd) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/shift-templates/${generatingTemplateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rangeStart: generateRangeStart,
          rangeEnd: generateRangeEnd,
          assignEmployee: generateAssignEmployee,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const notes = [];
        if (data.skippedExisting) notes.push(`${data.skippedExisting} al bestaand`);
        if (data.skippedConflicts) notes.push(`${data.skippedConflicts} overgeslagen door conflict`);
        showFeedback(`${data.count} shift(en) gegenereerd${notes.length ? ` (${notes.join(", ")})` : ""}!`);
        setGeneratingTemplateId(null);
        setGenerateRangeEnd("");
        fetchShifts();
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het genereren van shifts", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const openShiftEditor = (shift: Shift) => {
    setSelectedShift(shift);
    setEditEmployeeId(shift.assignments?.[0]?.employeeId || "");
    setIsEditModalOpen(true);
  };

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShiftIds((prev) =>
      prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]
    );
  };

  const exitBulkMode = () => {
    setIsBulkMode(false);
    setSelectedShiftIds([]);
    setIsBulkActionOpen(false);
  };

  const handleBulkSubmit = async () => {
    if (selectedShiftIds.length === 0) return;
    setIsBulkSubmitting(true);
    try {
      let url = "";
      let body: any = { shiftIds: selectedShiftIds };

      if (bulkAction === "assign") {
        url = "/api/shifts/bulk-assign";
        body.employeeId = bulkAssignEmployeeId || null;
      } else if (bulkAction === "shift-dates") {
        url = "/api/shifts/bulk-shift-dates";
        body.dayOffset = Number(bulkDayOffset);
      } else {
        url = "/api/shifts/bulk-delete";
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
        const conflictNote = data.skippedConflicts ? ` (${data.skippedConflicts} overgeslagen door dubbele boeking)` : "";
        showFeedback(
          bulkAction === "assign"
            ? `${data.count} shift(en) bijgewerkt${conflictNote}!`
            : bulkAction === "shift-dates"
            ? `${data.count} shift(en) verplaatst${conflictNote}!`
            : `${data.count} shift(en) verwijderd!`
        );
        setIsBulkActionOpen(false);
        setIsBulkDeleteConfirmOpen(false);
        exitBulkMode();
        fetchShifts();
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij de bulkbewerking", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Some browsers (Chrome/Edge in particular) don't reliably update
  // event.ctrlKey/metaKey on dragover/drop events while a native drag is in
  // progress. To make Ctrl(+drag)-to-copy work everywhere, we track the
  // modifier key state ourselves via plain keydown/keyup listeners - the key
  // just needs to be pressed before the drag starts and released after the
  // drop, which is how users naturally hold it anyway.
  const isCopyModifierPressed = useRef(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCopyModifierPressed.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCopyModifierPressed.current = false;
    };
    const handleBlur = () => {
      isCopyModifierPressed.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

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

  const fetchPresets = async () => {
    try {
      const res = await fetch("/api/shift-presets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/shift-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
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
    fetchPresets();
    fetchTemplates();
    fetchLeaveRequests();
  }, [currentDate, selectedEmployeeFilter, token]);

  // The first two presets (by `order`) drive the two quick-planning columns
  // used throughout week/day view, falling back to sensible defaults until
  // presets have loaded (or if an admin deletes down to fewer than two).
  const sortedPresets = [...presets].sort((a, b) => a.order - b.order);
  const slotPresets: Record<PlannerSlot, ShiftPreset> = {
    morning: sortedPresets[0] || FALLBACK_SLOT_PRESETS.morning,
    afternoon: sortedPresets[1] || FALLBACK_SLOT_PRESETS.afternoon,
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetLabel || !newPresetStart || !newPresetEnd) return;
    try {
      const res = await fetch("/api/shift-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label: newPresetLabel,
          startTime: newPresetStart,
          endTime: newPresetEnd,
          color: newPresetColor,
          defaultEmployeeId: newPresetDefaultEmployeeId || null,
        }),
      });
      if (res.ok) {
        setNewPresetLabel("");
        setNewPresetStart("06:00");
        setNewPresetEnd("14:00");
        setNewPresetColor("#6366f1");
        setNewPresetDefaultEmployeeId("");
        fetchPresets();
        showFeedback("Preset toegevoegd!");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het toevoegen van de preset", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    }
  };

  const startEditingPreset = (preset: ShiftPreset) => {
    setEditingPresetId(preset.id);
    setEditPresetDraft({
      label: preset.label,
      startTime: preset.startTime,
      endTime: preset.endTime,
      color: preset.color,
      defaultEmployeeId: preset.defaultEmployeeId || "",
    });
  };

  const handleSavePreset = async (presetId: string) => {
    if (!editPresetDraft) return;
    try {
      const res = await fetch(`/api/shift-presets/${presetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editPresetDraft,
          defaultEmployeeId: editPresetDraft.defaultEmployeeId || null,
        }),
      });
      if (res.ok) {
        setEditingPresetId(null);
        setEditPresetDraft(null);
        fetchPresets();
        showFeedback("Preset bijgewerkt!");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het bijwerken van de preset", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!window.confirm("Weet u zeker dat u deze preset wilt verwijderen?")) return;
    try {
      const res = await fetch(`/api/shift-presets/${presetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchPresets();
        showFeedback("Preset verwijderd!");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het verwijderen van de preset", "error");
      }
    } catch (e) {
      console.error(e);
      showFeedback("Fout bij het verbinden met de server", "error");
    }
  };

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

  const handleSaveAssignment = async () => {
    if (!selectedShift) return;

    try {
      const res = await fetch(`/api/shifts/${selectedShift.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employeeId: editEmployeeId || null }),
      });

      if (res.ok) {
        showFeedback(editEmployeeId ? "Shift succesvol toegewezen!" : "Shift weer onbezet gemaakt!");
        fetchShifts();
        // Small delay so the confirmation message is actually visible before the
        // dialog disappears, instead of closing instantly on the same tick.
        setTimeout(() => setIsEditModalOpen(false), 700);
      } else {
        const err = await res.json();
        showFeedback(err.error || "Fout bij het bijwerken van de toewijzing", "error");
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

  const getShiftsForDateAndSlot = (date: Date, slot: PlannerSlot) => {
    return getShiftsForDate(date).filter((shift) => getShiftSlot(shift) === slot);
  };

  const handlePlannerDrop = async (event: React.DragEvent, date: Date, slot: PlannerSlot) => {
    if (!draggedItem || user.role !== "ADMINISTRATOR") return;

    // Holding Ctrl (or Cmd on macOS) while dropping duplicates the shift onto the
    // target day/slot instead of moving the original one. Only applies to an
    // existing shift being re-dropped - dragging a preset template already creates
    // a new shift, so there's nothing extra to "copy" there.
    const isCopyDrag =
      draggedItem.type === "shift" && (isCopyModifierPressed.current || event.ctrlKey || event.metaKey);

    const dateStr = date.toISOString().split("T")[0];

    try {
      if (draggedItem.type === "template") {
        // Use the dragged preset's own name/time/color - it lands in the
        // correct visual column automatically via getShiftSlot() below,
        // regardless of which of the two columns it was physically dropped on.
        const preset =
          presets.find((p) => p.id === draggedItem.presetId) ||
          slotPresets[slot];

        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: preset.label,
            startTime: preset.startTime,
            endTime: preset.endTime,
            date: dateStr,
            color: preset.color,
            requiredEmployees: 1,
            ...(preset.defaultEmployeeId ? { employeeId: preset.defaultEmployeeId } : {}),
          }),
        });

        if (res.ok) {
          showFeedback(`${preset.label} gepland op ${dateStr}`);
          fetchShifts();
        } else {
          const err = await res.json();
          showFeedback(err.error || "Fout bij het aanmaken van de shift", "error");
        }
      } else if (isCopyDrag) {
        const sourceShift = shifts.find((s) => s.id === draggedItem.shiftId);
        const slotConfig = slotPresets[slot];
        const employeeId = sourceShift?.assignments?.[0]?.employeeId;

        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: sourceShift?.name || slotConfig.label,
            startTime: slotConfig.startTime,
            endTime: slotConfig.endTime,
            date: dateStr,
            color: sourceShift?.color || slotConfig.color,
            requiredEmployees: sourceShift?.requiredEmployees || 1,
            notes: sourceShift?.notes,
            ...(employeeId ? { employeeId } : {}),
          }),
        });

        if (res.ok) {
          showFeedback(`${sourceShift?.name || slotConfig.label} gekopieerd naar ${dateStr}`);
          fetchShifts();
        } else {
          const err = await res.json();
          showFeedback(err.error || "Fout bij het kopiëren van de shift", "error");
        }
      } else {
        const slotConfig = slotPresets[slot];
        const res = await fetch(`/api/shifts/${draggedItem.shiftId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            date: dateStr,
            startTime: slotConfig.startTime,
            endTime: slotConfig.endTime,
          }),
        });

        if (res.ok) {
          showFeedback(`Shift verplaatst naar ${slotConfig.label.toLowerCase()} op ${dateStr}`);
          fetchShifts();
        } else {
          const err = await res.json();
          showFeedback(err.error || "Fout bij het verplaatsen van de shift", "error");
        }
      }
    } catch (error) {
      console.error(error);
      showFeedback("Fout bij het verwerken van de sleepactie", "error");
    } finally {
      setDraggedItem(null);
      setDraggedSlot(null);
    }
  };

  const getLeavesForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return leaveRequests.filter((leave) => {
      if (leave.status === "CANCELLED") return false;
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
            <div className="flex items-center border border-slate-200 rounded-lg sm:rounded-xl overflow-hidden ml-4">
              <button
                onClick={prevDate}
                className="p-1.5 hover:bg-slate-50 border-r border-slate-200 text-slate-600 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-xs sm:text-sm font-semibold hover:bg-slate-50 border-r border-slate-200 text-slate-700 transition cursor-pointer"
              >
                Vandaag
              </button>
              <button
                onClick={nextDate}
                className="p-1.5 hover:bg-slate-50 border-l border-slate-200 text-slate-600 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Utility controls: view switcher, employee filter, print */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Switcher */}
              <div className="flex rounded-lg sm:rounded-xl bg-slate-100 p-1">
                {[
                  { view: "month", label: "Maand" },
                  { view: "week", label: "Week" },
                  { view: "day", label: "Dag" },
                ].map(({ view, label }) => (
                  <button
                    key={view}
                    onClick={() => setViewType(view as any)}
                    className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition cursor-pointer ${
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
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl px-2 py-1.5 text-xs sm:text-sm text-slate-700">
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
                  const viewBeforePrint = viewType;
                  if (viewType !== "month") setViewType("month");
                  setIsPrintMode(true);
                  setTimeout(() => {
                    window.print();
                    setIsPrintMode(false);
                    if (viewBeforePrint !== "month") setViewType(viewBeforePrint);
                  }, 500);
                }}
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl text-slate-600 transition cursor-pointer"
                title="Afdrukken (maandkalender)"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>

            {/* Admin Controls */}
            {user.role === "ADMINISTRATOR" && (
              <>
                <div className="hidden lg:block w-px self-stretch bg-slate-200" />
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => (isBulkMode ? exitBulkMode() : setIsBulkMode(true))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
                      isBulkMode
                        ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <CheckSquare className="h-3.5 w-3.5" /> {isBulkMode ? "Selectie Sluiten" : "Bulk Bewerken"}
                  </button>
                  <button
                    onClick={() => setIsCopyWeekOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="h-3.5 w-3.5" /> Week Kopiëren
                  </button>
                  <button
                    onClick={() => setIsTemplatesModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer whitespace-nowrap"
                  >
                    <Repeat className="h-3.5 w-3.5" /> Terugkerende Sjablonen
                  </button>
                  <button
                    onClick={() => {
                      setShiftDate(currentDate.toISOString().split("T")[0]);
                      setIsCreateModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-white transition shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" /> Shift Aanmaken
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk Selection Action Bar */}
      {isBulkMode && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white rounded-2xl px-4 py-3 mb-3 shadow-md">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <CheckSquare className="h-4 w-4 text-blue-400" />
            {selectedShiftIds.length} shift(en) geselecteerd
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkAction("assign");
                setBulkAssignEmployeeId("");
                setIsBulkActionOpen(true);
              }}
              disabled={selectedShiftIds.length === 0}
              className="px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Medewerker toewijzen
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkAction("shift-dates");
                setIsBulkActionOpen(true);
              }}
              disabled={selectedShiftIds.length === 0}
              className="px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Data verschuiven
            </button>
            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              disabled={selectedShiftIds.length === 0}
              className="px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-red-500/20 text-red-200 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Verwijderen
            </button>
            <button
              type="button"
              onClick={exitBulkMode}
              className="px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold border border-white/20 hover:bg-white/10 transition cursor-pointer"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Calendar Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Month View */}
        {viewType === "month" && (
          <div className="overflow-x-auto touch-pan-x">
            <div className="min-w-[700px] sm:min-w-0">
              <div className="grid grid-cols-7 bg-slate-50/70 border-b border-slate-200 py-3 text-center text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
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
                      <span className="text-xs sm:text-sm font-bold text-slate-700">
                        {date.getDate()}
                      </span>
                      <div className="space-y-1 overflow-y-auto max-h-[85px]">
                        {dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            onClick={() => {
                              if (isBulkMode) {
                                toggleShiftSelection(shift.id);
                              } else if (user.role === "ADMINISTRATOR") {
                                openShiftEditor(shift);
                              }
                            }}
                            style={{ backgroundColor: shift.color + "22", borderLeftColor: shift.color }}
                            className={`px-1.5 py-0.5 border-l-2 rounded-r text-[10px] font-semibold text-slate-800 cursor-pointer hover:opacity-85 transition truncate ${
                              isBulkMode && selectedShiftIds.includes(shift.id) ? "ring-2 ring-blue-400" : ""
                            }`}
                            title={`${shift.name} (${shift.startTime}-${shift.endTime})`}
                          >
                            {isBulkMode && (selectedShiftIds.includes(shift.id) ? "☑ " : "☐ ")}
                            {shift.startTime} {shift.name}
                          </div>
                        ))}
                        {getLeavesForDate(date).map((leave) => (
                          <div
                            key={`leave-${leave.id}`}
                            style={{
                              borderLeftColor: leave.status === "APPROVED" ? "#f43f5e" : "#f59e0b",
                              ...getEmployeeBadgeStyle(leave.employeeId),
                            }}
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
          </div>
        )}

        {/* Week View */}
        {viewType === "week" && (
          <div>
            {user.role === "ADMINISTRATOR" && !isPrintMode && (
              <div className="p-4 bg-slate-900 text-white border-b border-slate-800">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:p-3">
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Snelle planning</h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                      Sleep een preset naar een dagdeel, of versleep een bestaande shift naar een ander vak of een andere dag.
                      Houd Ctrl (of Cmd) ingedrukt tijdens het slepen om de shift te kopiëren in plaats van te verplaatsen.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sortedPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        draggable
                        onDragStart={() => setDraggedItem({ type: "template", presetId: preset.id })}
                        onDragEnd={() => setDraggedItem(null)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-bold transition cursor-grab active:cursor-grabbing"
                        title={`${preset.startTime} - ${preset.endTime}`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsPresetsModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-white/20 hover:bg-white/10 text-xs sm:text-sm font-bold transition cursor-pointer text-slate-200"
                    >
                      <Settings className="h-3.5 w-3.5" /> Presets beheren
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto overflow-y-auto touch-pan-x max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-240px)] md:max-h-[calc(100vh-200px)]">
              <div className="min-w-[980px] lg:min-w-0">
                <div className="grid grid-cols-7 bg-slate-50/70 border-b border-slate-200 py-3.5 text-center sticky top-0 z-10">
                  {weekDates.map((date, idx) => (
                    <div key={idx} className="space-y-1">
                      <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                        {date.toLocaleDateString("nl-BE", { weekday: "short" })}
                      </span>
                      <p className="text-lg font-extrabold text-slate-800">
                        {date.getDate()}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 divide-x divide-slate-200 min-h-[400px]" role="region" aria-label="Weekweergave dienstregeling">
                  {weekDates.map((date, idx) => {
                    const morningShifts = getShiftsForDateAndSlot(date, "morning");
                    const afternoonShifts = getShiftsForDateAndSlot(date, "afternoon");
                    const dayKey = date.toISOString().split("T")[0];
                    return (
                      <div key={idx} className="p-2 bg-white space-y-2 flex flex-col">
                        {[
                          { key: "morning" as const, label: "Voormiddag", shifts: morningShifts },
                          { key: "afternoon" as const, label: "Namiddag", shifts: afternoonShifts },
                        ].map((slot) => {
                          const slotKey = `${dayKey}-${slot.key}`;

                          return (
                            <div
                              key={slot.key}
                              onDragOver={(event) => {
                                event.preventDefault();
                                setDraggedSlot(slotKey);
                              }}
                              onDragLeave={() => {
                                if (draggedSlot === slotKey) setDraggedSlot(null);
                              }}
                              onDrop={(event) => handlePlannerDrop(event, date, slot.key)}
                              className={`rounded-xl border p-2 min-h-[130px] flex flex-col gap-2 transition ${
                                draggedSlot === slotKey
                                  ? "border-blue-400 bg-blue-50/60"
                                  : "border-slate-200 bg-slate-50/40"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{slot.label}</span>
                                {user.role === "ADMINISTRATOR" && <span className="text-[9px] text-slate-400">Drop hier</span>}
                              </div>

                              <div className="space-y-1.5 flex-1">
                                {slot.shifts.length === 0 ? (
                                  <div className="text-[10px] text-slate-300 italic border border-dashed border-slate-200 rounded-lg sm:rounded-xl px-2 py-3 text-center">
                                    Sleep een shift of template hier
                                  </div>
                                ) : (
                                  slot.shifts.map((shift) => (
                                    <div
                                      key={shift.id}
                                      draggable={!isBulkMode && user.role === "ADMINISTRATOR" && window.innerWidth > 768}
                                      onDragStart={() => setDraggedItem({ type: "shift", shiftId: shift.id })}
                                      onDragEnd={() => setDraggedItem(null)}
                                      onClick={() => {
                                        if (isBulkMode) {
                                          toggleShiftSelection(shift.id);
                                        } else if (user.role === "ADMINISTRATOR") {
                                          openShiftEditor(shift);
                                        }
                                      }}
                                      style={{ borderLeftColor: shift.color }}
                                      className={`p-2 border-l-4 rounded-r-xl bg-white hover:bg-slate-50 border transition cursor-pointer flex flex-col gap-1 shadow-2xs ${
                                        isBulkMode && selectedShiftIds.includes(shift.id)
                                          ? "border-blue-400 ring-2 ring-blue-400 bg-blue-50/60"
                                          : "border-slate-200"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {isBulkMode && (
                                          selectedShiftIds.includes(shift.id) ? (
                                            <CheckSquare className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                          ) : (
                                            <Square className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                          )
                                        )}
                                        <span className="font-bold text-slate-800 text-[11px] truncate">{shift.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                        <Clock className="h-3 w-3 shrink-0" /> {shift.startTime} - {shift.endTime}
                                      </div>

                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {shift.assignments && shift.assignments.length > 0 ? (
                                          shift.assignments.map((assign: any) => (
                                            <span
                                              key={assign.id}
                                              style={getEmployeeBadgeStyle(assign.employeeId)}
                                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border truncate max-w-full"
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
                              </div>
                            </div>
                          );
                        })}

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

            {user.role === "ADMINISTRATOR" && !isPrintMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:p-3 mb-5">
                {(Object.keys(slotPresets) as PlannerSlot[]).map((slot) => {
                  const config = slotPresets[slot];
                  const slotKey = `${currentDate.toISOString().split("T")[0]}-${slot}`;
                  const slotShifts = getShiftsForDateAndSlot(currentDate, slot);

                  return (
                    <div
                      key={slot}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDraggedSlot(slotKey);
                      }}
                      onDragLeave={() => {
                        if (draggedSlot === slotKey) setDraggedSlot(null);
                      }}
                      onDrop={(event) => handlePlannerDrop(event, currentDate, slot)}
                      className={`rounded-2xl border p-4 transition ${
                        draggedSlot === slotKey ? "border-blue-400 bg-blue-50/60" : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{config.label}</h4>
                          <p className="text-[11px] text-slate-500">Sleep een shift of template hier</p>
                        </div>
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }} />
                      </div>

                      <div className="space-y-2 min-h-[110px]">
                        {slotShifts.length === 0 ? (
                          <div className="text-[10px] italic text-slate-400 border border-dashed border-slate-200 rounded-lg sm:rounded-xl px-3 py-6 text-center bg-white/70">
                            Nog geen shift in dit dagdeel
                          </div>
                        ) : (
                          slotShifts.map((shift) => (
                            <div
                              key={shift.id}
                              draggable
                              onDragStart={() => setDraggedItem({ type: "shift", shiftId: shift.id })}
                              onDragEnd={() => setDraggedItem(null)}
                              onClick={() => {
                                openShiftEditor(shift);
                              }}
                              style={{ borderLeftColor: shift.color }}
                              className="p-2.5 sm:p-3 border-l-4 rounded-r-xl bg-white border border-slate-200 shadow-2xs cursor-pointer"
                            >
                              <div className="font-bold text-slate-800 text-xs sm:text-sm truncate">{shift.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {shift.startTime} - {shift.endTime}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
                      if (isBulkMode) {
                        toggleShiftSelection(shift.id);
                      } else if (user.role === "ADMINISTRATOR") {
                        openShiftEditor(shift);
                      }
                    }}
                    style={{ borderLeftColor: shift.color }}
                    className={`p-5 border-l-4 rounded-r-2xl bg-slate-50/50 hover:bg-slate-50 transition border flex justify-between items-center cursor-pointer shadow-2xs ${
                      isBulkMode && selectedShiftIds.includes(shift.id) ? "border-blue-400 ring-2 ring-blue-400" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isBulkMode && (
                        selectedShiftIds.includes(shift.id) ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300 shrink-0" />
                        )
                      )}
                      <div>
                      <h4 className="font-bold text-slate-800 text-sm">{shift.name}</h4>
                      <div className="flex items-center gap-2.5 sm:p-3 text-xs sm:text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3.5 w-3.5 text-slate-400" /> {shift.startTime} - {shift.endTime}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600">
                          Vereist personeel: {shift.requiredEmployees}
                        </span>
                      </div>
                      {shift.notes && (
                        <p className="text-xs sm:text-sm text-slate-500 mt-2 italic font-mono bg-white p-1.5 rounded border border-slate-200">
                          Opmerkingen: {shift.notes}
                        </p>
                      )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {shift.assignments && shift.assignments.length > 0 ? (
                        shift.assignments.map((assign: any) => (
                          <span
                            key={assign.id}
                            style={getEmployeeBadgeStyle(assign.employeeId)}
                            className="text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5"
                          >
                            <User className="h-3.5 w-3.5" /> {assign.employee.user.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-red-500 text-xs sm:text-sm font-semibold bg-red-50 border border-red-100 px-3 py-1 rounded-full">
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">Nieuwe Shift Toevoegen</h3>
            
            <form onSubmit={handleCreateShift} className="space-y-3 text-sm text-slate-700">
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Dienst / Type Shift</label>
                <select
                  value={shiftName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShiftName(val);
                    const matchedPreset = presets.find((p) => p.label === val);
                    if (matchedPreset) {
                      setStartTime(matchedPreset.startTime);
                      setEndTime(matchedPreset.endTime);
                      setShiftColor(matchedPreset.color);
                      setAssignEmployeeId(matchedPreset.defaultEmployeeId || "");
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl font-medium"
                >
                  {sortedPresets.map((preset) => (
                    <option key={preset.id} value={preset.label}>
                      {preset.label} ({preset.startTime} - {preset.endTime})
                    </option>
                  ))}
                  <option value="Aangepaste Shift">Aangepaste Shift</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Beheer de beschikbare presets via "Presets beheren" boven de weekkalender.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:p-3">
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Starttijd</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="07:00"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Eindtijd</label>
                  <input
                    type="text"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="15:00"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Datum</label>
                <input
                  type="date"
                  required
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Direct toewijzen aan</label>
                <select
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl font-medium"
                >
                  <option value="">-- Nog niet toewijzen --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:p-3">
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Kleur Label</label>
                  <input
                    type="color"
                    value={shiftColor}
                    onChange={(e) => setShiftColor(e.target.value)}
                    className="mt-1 block w-full h-10 p-1 border border-slate-300 rounded-lg sm:rounded-xl cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Vereist Personeel</label>
                  <input
                    type="number"
                    min="1"
                    value={requiredEmployees}
                    onChange={(e) => setRequiredEmployees(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Opmerkingen / Instructies</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Bijv. speciale ICU-verpleging vereist"
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl font-semibold text-slate-600 transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg sm:rounded-xl font-semibold text-white transition shadow-xs cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">Shift Beheren</h3>
            
            <div className="space-y-3 text-sm text-slate-700">
              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-800">{selectedShift.name}</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Datum: {selectedShift.date}</p>
                <p className="text-xs sm:text-sm text-slate-500">Tijd: {selectedShift.startTime} - {selectedShift.endTime}</p>
              </div>

              <div className="p-2.5 sm:p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-700">Medewerker toewijzen</label>
                <select
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg sm:rounded-xl bg-white text-sm"
                >
                  <option value="">-- Shift onbezet laten --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition"
                >
                  Toewijzing opslaan
                </button>
              </div>

              {!isDeleteConfirmOpen ? (
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="w-full flex justify-center py-2 border border-red-200 hover:bg-red-50 text-red-600 font-semibold rounded-lg sm:rounded-xl transition cursor-pointer"
                >
                  Shift Verwijderen
                </button>
              ) : (
                <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-center">
                  <p className="text-xs sm:text-sm text-red-800 font-semibold">Weet u zeker dat u deze shift wilt verwijderen?</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteShift(selectedShift.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition cursor-pointer"
                    >
                      Ja, verwijder
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirmOpen(false)}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition cursor-pointer"
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg sm:rounded-xl font-semibold transition cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              <Copy className="h-5 w-5 text-blue-500" /> Planning Kopiëren & Lange Termijn Plannen
            </h3>

            {/* Tab switchers */}
            <div className="flex rounded-lg sm:rounded-xl bg-slate-100 p-1">
              {[
                { mode: "week", label: "Week Kopiëren" },
                { mode: "repeat", label: "Week Herhalen" },
                { mode: "month", label: "Maand Kopiëren" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCopyMode(mode as any)}
                  className={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-md transition cursor-pointer ${
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
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Startdatum bronweek (Ma)</label>
                    <input
                      type="date"
                      required
                      value={sourceWeekStart}
                      onChange={(e) => setSourceWeekStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Startdatum doelweek (Ma)</label>
                    <input
                      type="date"
                      required
                      value={targetWeekStart}
                      onChange={(e) => setTargetWeekStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
                    />
                  </div>
                </div>
              )}

              {copyMode === "repeat" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Startdatum bronweek (Ma)</label>
                    <input
                      type="date"
                      required
                      value={sourceWeekStart}
                      onChange={(e) => setSourceWeekStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Aantal weken herhalen (Lange termijn)</label>
                    <select
                      value={repeatWeeksCount}
                      onChange={(e) => setRepeatWeeksCount(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
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
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Bronmaand</label>
                    <input
                      type="month"
                      required
                      placeholder="YYYY-MM"
                      value={sourceMonth}
                      onChange={(e) => setSourceMonth(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Doelmaand</label>
                    <input
                      type="month"
                      required
                      placeholder="YYYY-MM"
                      value={targetMonth}
                      onChange={(e) => setTargetMonth(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl"
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
                <label htmlFor="copyEmployees" className="text-xs sm:text-sm font-medium text-slate-600 cursor-pointer select-none">
                  Inclusief toegewezen medewerkers kopiëren
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsCopyWeekOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl font-semibold text-slate-600 transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg sm:rounded-xl font-semibold text-white transition shadow-xs cursor-pointer"
                >
                  {copyMode === "week" ? "Week Kopiëren" : copyMode === "repeat" ? "Lange Termijn Herhalen" : "Maand Kopiëren"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK SHIFT ACTION MODAL */}
      {isBulkActionOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <CheckSquare className="h-5 w-5 text-blue-500" />
                {bulkAction === "assign" ? "Medewerker Toewijzen" : "Data Verschuiven"}
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkActionOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Deze bewerking wordt toegepast op {selectedShiftIds.length} geselecteerde shift(en). Shifts die tot een
              dubbele boeking zouden leiden, worden overgeslagen.
            </p>

            {bulkAction === "assign" && (
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Medewerker
                </label>
                <select
                  value={bulkAssignEmployeeId}
                  onChange={(e) => setBulkAssignEmployeeId(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                >
                  <option value="">-- Alle geselecteerde shifts onbezet maken --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkAction === "shift-dates" && (
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Aantal dagen verschuiven
                </label>
                <input
                  type="number"
                  value={bulkDayOffset}
                  onChange={(e) => setBulkDayOffset(Number(e.target.value))}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                  placeholder="Bijv. 7 (vooruit) of -7 (terug)"
                />
                <p className="text-[11px] text-slate-400 mt-1">Positief getal = vooruit in de tijd, negatief = terug.</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsBulkActionOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl font-semibold text-slate-600 transition cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={isBulkSubmitting || (bulkAction === "shift-dates" && !bulkDayOffset)}
                onClick={handleBulkSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg sm:rounded-xl font-semibold text-white transition shadow-xs cursor-pointer"
              >
                {isBulkSubmitting ? "Bezig..." : "Toepassen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRM MODAL */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Shifts Verwijderen</h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Weet u zeker dat u <strong>{selectedShiftIds.length}</strong> geselecteerde shift(en) wilt verwijderen?
              Dit kan niet ongedaan gemaakt worden.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl font-semibold text-slate-600 transition cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={isBulkSubmitting}
                onClick={() => {
                  setBulkAction("delete");
                  handleBulkSubmit();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg sm:rounded-xl font-semibold text-white transition shadow-xs cursor-pointer"
              >
                {isBulkSubmitting ? "Bezig..." : "Ja, verwijderen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE SHIFT PRESETS MODAL */}
      {isPresetsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Presets Beheren</h3>
              <button
                type="button"
                onClick={() => {
                  setIsPresetsModalOpen(false);
                  setEditingPresetId(null);
                  setEditPresetDraft(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Deze presets verschijnen als sleepbare snelkeuzes bij "Snelle planning" en in de lijst van de "Nieuwe Shift"-modal.
              De eerste twee (op volgorde) bepalen ook de twee kolommen in de week- en dagweergave.
              Stel je een standaard medewerker in, dan wordt die automatisch toegewezen zodra de preset gebruikt wordt
              (de dubbele-boeking restrictie blijft hierbij van toepassing).
            </p>

            <div className="space-y-2">
              {sortedPresets.length === 0 && (
                <p className="text-xs sm:text-sm text-slate-400 italic">Nog geen presets. Voeg er hieronder een toe.</p>
              )}
              {sortedPresets.map((preset) => (
                <div key={preset.id} className="border border-slate-200 rounded-xl p-2.5 sm:p-3">
                  {editingPresetId === preset.id && editPresetDraft ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editPresetDraft.label}
                        onChange={(e) => setEditPresetDraft({ ...editPresetDraft, label: e.target.value })}
                        className="block w-full px-3 py-1.5 border border-slate-300 rounded-lg sm:rounded-xl text-sm font-medium"
                        placeholder="Naam"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editPresetDraft.startTime}
                          onChange={(e) => setEditPresetDraft({ ...editPresetDraft, startTime: e.target.value })}
                          className="px-2 py-1.5 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono text-center"
                          placeholder="07:00"
                        />
                        <input
                          type="text"
                          value={editPresetDraft.endTime}
                          onChange={(e) => setEditPresetDraft({ ...editPresetDraft, endTime: e.target.value })}
                          className="px-2 py-1.5 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono text-center"
                          placeholder="15:00"
                        />
                        <input
                          type="color"
                          value={editPresetDraft.color}
                          onChange={(e) => setEditPresetDraft({ ...editPresetDraft, color: e.target.value })}
                          className="h-8 w-full p-1 border border-slate-300 rounded-lg sm:rounded-xl cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Standaard medewerker (optioneel)
                        </label>
                        <select
                          value={editPresetDraft.defaultEmployeeId}
                          onChange={(e) => setEditPresetDraft({ ...editPresetDraft, defaultEmployeeId: e.target.value })}
                          className="block w-full px-2 py-1.5 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium"
                        >
                          <option value="">-- Geen, telkens handmatig kiezen --</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.user?.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPresetId(null);
                            setEditPresetDraft(null);
                          }}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl font-semibold text-slate-600 text-xs sm:text-sm transition cursor-pointer"
                        >
                          Annuleren
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePreset(preset.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg sm:rounded-xl font-semibold text-white text-xs sm:text-sm transition cursor-pointer"
                        >
                          Opslaan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: preset.color }} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{preset.label}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{preset.startTime} - {preset.endTime}</p>
                          {preset.defaultEmployeeId && (
                            <p className="text-[10px] text-blue-600 font-semibold truncate">
                              Standaard: {employees.find((emp) => emp.id === preset.defaultEmployeeId)?.user?.name || "Onbekend"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditingPreset(preset)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg sm:rounded-xl transition cursor-pointer"
                          title="Naam/tijd/kleur wijzigen"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg sm:rounded-xl transition cursor-pointer"
                          title="Preset verwijderen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleCreatePreset} className="border-t border-slate-200 pt-4 space-y-2">
              <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Nieuwe Preset Toevoegen</label>
              <input
                type="text"
                required
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
                placeholder="Bijv. Nachtdienst"
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={newPresetStart}
                  onChange={(e) => setNewPresetStart(e.target.value)}
                  placeholder="22:00"
                  className="px-2 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono text-center"
                />
                <input
                  type="text"
                  required
                  value={newPresetEnd}
                  onChange={(e) => setNewPresetEnd(e.target.value)}
                  placeholder="06:00"
                  className="px-2 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono text-center"
                />
                <input
                  type="color"
                  value={newPresetColor}
                  onChange={(e) => setNewPresetColor(e.target.value)}
                  className="h-9 w-full p-1 border border-slate-300 rounded-lg sm:rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Standaard medewerker (optioneel)
                </label>
                <select
                  value={newPresetDefaultEmployeeId}
                  onChange={(e) => setNewPresetDefaultEmployeeId(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                >
                  <option value="">-- Geen, telkens handmatig kiezen --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg sm:rounded-xl font-semibold text-white text-sm transition shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Preset Toevoegen
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE SHIFT TEMPLATES / RECURRING PATTERNS MODAL */}
      {isTemplatesModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <Repeat className="h-5 w-5 text-purple-500" /> Terugkerende Sjablonen
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsTemplatesModalOpen(false);
                  setTemplateFormMode("list");
                  resetTemplateForm();
                  setGeneratingTemplateId(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Een sjabloon definieert een terugkerende shift (bv. elke maandag en dinsdag, 07:00-15:00). Gebruik
              "Genereren" om er echte shifts van te maken voor een bepaalde periode.
            </p>

            {templateFormMode === "list" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    resetTemplateForm();
                    setTemplateFormMode("create");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg sm:rounded-xl font-semibold text-white text-sm transition shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Nieuw Sjabloon
                </button>

                <div className="space-y-2">
                  {templates.length === 0 && (
                    <p className="text-xs sm:text-sm text-slate-400 text-center py-4">Nog geen sjablonen aangemaakt.</p>
                  )}
                  {templates.map((tmpl) => {
                    let days: number[] = [];
                    try {
                      days = JSON.parse(tmpl.daysOfWeek || "[]");
                    } catch {
                      days = [];
                    }
                    return (
                      <div key={tmpl.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: tmpl.color }}
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-800 truncate">
                                {tmpl.name}
                                {!tmpl.isActive && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                    Inactief
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                {tmpl.startTime} - {tmpl.endTime} • {tmpl.recurrencePattern === "BIWEEKLY" ? "Om de 2 weken" : "Wekelijks"} •{" "}
                                {days.map((d) => DOW_LABELS[d]).join(", ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setGeneratingTemplateId(tmpl.id);
                                setGenerateRangeStart(new Date().toISOString().split("T")[0]);
                                setGenerateRangeEnd("");
                              }}
                              title="Genereren"
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                            >
                              <CalendarClock className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditingTemplate(tmpl)}
                              title="Bewerken"
                              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTemplateDeleteConfirmId(tmpl.id)}
                              title="Verwijderen"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {generatingTemplateId === tmpl.id && (
                          <div className="bg-purple-50/60 border border-purple-100 rounded-lg p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                  Van
                                </label>
                                <input
                                  type="date"
                                  value={generateRangeStart}
                                  onChange={(e) => setGenerateRangeStart(e.target.value)}
                                  className="block w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                  Tot
                                </label>
                                <input
                                  type="date"
                                  value={generateRangeEnd}
                                  onChange={(e) => setGenerateRangeEnd(e.target.value)}
                                  className="block w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                            {tmpl.defaultEmployeeId && (
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                <input
                                  type="checkbox"
                                  checked={generateAssignEmployee}
                                  onChange={(e) => setGenerateAssignEmployee(e.target.checked)}
                                  className="rounded border-slate-300"
                                />
                                Standaard medewerker meteen toewijzen
                              </label>
                            )}
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setGeneratingTemplateId(null)}
                                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 transition cursor-pointer"
                              >
                                Annuleren
                              </button>
                              <button
                                type="button"
                                disabled={isGenerating || !generateRangeEnd}
                                onClick={handleGenerateFromTemplate}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition cursor-pointer"
                              >
                                {isGenerating ? "Bezig..." : "Shifts Genereren"}
                              </button>
                            </div>
                          </div>
                        )}

                        {templateDeleteConfirmId === tmpl.id && (
                          <div className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-2">
                            <p className="text-xs text-red-700">
                              Sjabloon "{tmpl.name}" verwijderen? Reeds gegenereerde shifts kunnen behouden blijven
                              (als losse shifts) of mee verwijderd worden.
                            </p>
                            <div className="flex flex-wrap gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setTemplateDeleteConfirmId(null)}
                                className="px-3 py-1.5 border border-slate-200 hover:bg-white rounded-lg text-xs font-semibold text-slate-600 transition cursor-pointer"
                              >
                                Annuleren
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTemplateDelete(tmpl.id, false)}
                                className="px-3 py-1.5 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-semibold text-red-700 transition cursor-pointer"
                              >
                                Sjabloon Verwijderen, Shifts Behouden
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTemplateDelete(tmpl.id, true)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold text-white transition cursor-pointer"
                              >
                                Alles Verwijderen
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {(templateFormMode === "create" || templateFormMode === "edit") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Naam
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                    placeholder="Bijv. Nachtdienst weekend"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Starttijd
                    </label>
                    <input
                      type="time"
                      value={templateStart}
                      onChange={(e) => setTemplateStart(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Eindtijd
                    </label>
                    <input
                      type="time"
                      value={templateEnd}
                      onChange={(e) => setTemplateEnd(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Dagen van de week
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DOW_LABELS.map((label, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleTemplateDay(idx)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          templateDaysOfWeek.includes(idx)
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Herhaling
                    </label>
                    <select
                      value={templateRecurrence}
                      onChange={(e) => setTemplateRecurrence(e.target.value as "WEEKLY" | "BIWEEKLY")}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                    >
                      <option value="WEEKLY">Elke week</option>
                      <option value="BIWEEKLY">Om de 2 weken</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Benodigd aantal
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={templateRequiredEmployees}
                      onChange={(e) => setTemplateRequiredEmployees(Number(e.target.value))}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Startdatum patroon
                    </label>
                    <input
                      type="date"
                      value={templateStartDate}
                      onChange={(e) => setTemplateStartDate(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Einddatum (optioneel)
                    </label>
                    <input
                      type="date"
                      value={templateEndDate}
                      onChange={(e) => setTemplateEndDate(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Kleur
                  </label>
                  <input
                    type="color"
                    value={templateColor}
                    onChange={(e) => setTemplateColor(e.target.value)}
                    className="h-9 w-16 border border-slate-300 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Standaard medewerker (optioneel)
                  </label>
                  <select
                    value={templateDefaultEmployeeId}
                    onChange={(e) => setTemplateDefaultEmployeeId(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                  >
                    <option value="">-- Geen (onbezet genereren) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.user?.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Notities (optioneel)
                  </label>
                  <input
                    type="text"
                    value={templateNotes}
                    onChange={(e) => setTemplateNotes(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg sm:rounded-xl text-sm"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetTemplateForm();
                      setTemplateFormMode("list");
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl font-semibold text-slate-600 transition cursor-pointer"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    disabled={isTemplateSubmitting}
                    onClick={handleTemplateSubmit}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg sm:rounded-xl font-semibold text-white transition shadow-xs cursor-pointer"
                  >
                    {isTemplateSubmitting ? "Bezig..." : editingTemplateId ? "Sjabloon Bijwerken" : "Sjabloon Aanmaken"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
