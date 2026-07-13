import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  Calendar,
  Download,
  Trash2,
  Megaphone,
  Mail,
  Users,
  Settings,
  RefreshCw,
  UserPlus,
  Check,
  AlertTriangle,
  Edit
} from "lucide-react";
import { AuditLog, Announcement } from "../types.js";
import { getUserColorStyle } from "../utils/userColor.ts";

interface AdminPanelProps {
  user: any;
  token: string;
}

export default function AdminPanel({ user, token }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"reports" | "logs" | "announcements" | "emails" | "employees" | "settings">("reports");

  // Reports states
  const [reportsData, setReportsData] = useState<any>(null);
  const [loadingReports, setLoadingReports] = useState(true);

  // Logs states
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Email states
  const [emails, setEmails] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [searchTermEmail, setSearchTermEmail] = useState("");

  // New Announcement states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submittingAnn, setSubmittingAnn] = useState(false);

  // Month Send Email states
  const [sendMonthYear, setSendMonthYear] = useState(new Date().toISOString().substring(0, 7));
  const [sendingMonthEmail, setSendingMonthEmail] = useState(false);

  // Employees states
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("EMPLOYEE");
  const [newEmpMaxHours, setNewEmpMaxHours] = useState("40");
  const [newEmpMaxDays, setNewEmpMaxDays] = useState("5");
  const [submittingEmp, setSubmittingEmp] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);

  // Editing user/employee states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("EMPLOYEE");
  const [editPassword, setEditPassword] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Settings states
  const [settings, setSettings] = useState<any>({
    email_service_type: "simulation",
    sender_email: "noreply@hetverbandternat.be",
    resend_api_key: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // DB Reset states
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/reports/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReportsData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/audit-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch("/api/emails", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch("/api/admin/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployeesList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Convert setting array to object map
        const obj: any = {
          email_service_type: "simulation",
          sender_email: "noreply@hetverbandternat.be",
          resend_api_key: "",
          smtp_host: "",
          smtp_port: "587",
          smtp_user: "",
          smtp_pass: "",
        };
        data.forEach((s: any) => {
          obj[s.key] = s.value;
        });
        setSettings(obj);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (activeTab === "reports") fetchReports();
    if (activeTab === "logs") fetchLogs();
    if (activeTab === "emails") fetchEmails();
    if (activeTab === "employees") fetchEmployees();
    if (activeTab === "settings") fetchSettings();
  }, [activeTab, token]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setSubmittingAnn(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });

      if (res.ok) {
        alert("Mededeling geplaatst en meldingen verstuurd!");
        setTitle("");
        setContent("");
      } else {
        alert("Fout bij het plaatsen van de mededeling.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingAnn(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpEmail || !newEmpPassword) {
      alert("Vul alle verplichte velden in.");
      return;
    }

    setSubmittingEmp(true);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newEmpName,
          email: newEmpEmail,
          password: newEmpPassword,
          role: newEmpRole,
          maxWeeklyHours: newEmpRole === "EMPLOYEE" ? Number(newEmpMaxHours) : null,
          maxConsecutiveDays: newEmpRole === "EMPLOYEE" ? Number(newEmpMaxDays) : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Account succesvol aangemaakt voor ${newEmpName}!`);
        setNewEmpName("");
        setNewEmpEmail("");
        setNewEmpPassword("");
        setNewEmpRole("EMPLOYEE");
        fetchEmployees();
      } else {
        alert(data.error || "Fout bij aanmaken medewerker.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingEmp(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editName || !editEmail) {
      alert("Vul alle verplichte velden in.");
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/admin/employees/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          role: editRole,
          password: editPassword || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Account voor ${editName} succesvol bijgewerkt!`);
        setEditingUser(null);
        setEditName("");
        setEditEmail("");
        setEditPassword("");
        fetchEmployees();
      } else {
        alert(data.error || "Fout bij bijwerken account.");
      }
    } catch (err: any) {
      alert(`Fout: ${err.message}`);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleSendMonthSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendMonthYear) return;

    setSendingMonthEmail(true);
    try {
      const res = await fetch("/api/shifts/send-month-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ yearMonth: sendMonthYear }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Succes: De persoonlijke roosters van ${sendMonthYear} zijn per e-mail verzonden naar ${data.count} medewerkers!`);
      } else {
        const errData = await res.json();
        alert(`Fout bij verzenden roosters: ${errData.error || "Onbekende fout"}`);
      }
    } catch (err: any) {
      alert(`Netwerkfout: ${err.message}`);
    } finally {
      setSendingMonthEmail(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (id === user.id) {
      alert("U kunt uw eigen ingelogde account niet verwijderen.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        alert("Account succesvol verwijderd.");
        setDeletingEmployeeId(null);
        fetchEmployees();
      } else {
        const data = await res.json();
        alert(data.error || "Fout bij verwijderen.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        alert("E-mail & Systeem instellingen succesvol opgeslagen!");
        fetchSettings();
      } else {
        alert("Fout bij opslaan instellingen.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient) return;

    setSendingTestEmail(true);
    try {
      // Save current configuration first
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: testEmailRecipient }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Test e-mail succesvol verzonden naar ${testEmailRecipient}! Bekijk de status in het e-mailnotificatielogboek.`);
        setTestEmailRecipient("");
        fetchEmails();
      } else {
        alert(data.error || "Fout bij verzenden test e-mail.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleResetDB = async () => {
    setResettingDb(true);
    try {
      const res = await fetch("/api/admin/reset-db", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        alert("Database succesvol gereset naar de standaard Nederlandse seeddata! U wordt nu uitgelogd om de sessie te vernieuwen.");
        window.location.reload();
      } else {
        alert("Fout bij het herstellen van de database.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResettingDb(false);
      setResetConfirmOpen(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      (log.user?.name && log.user.name.toLowerCase().includes(term))
    );
  });

  const filteredEmails = emails.filter((mail) => {
    const term = searchTermEmail.toLowerCase();
    return (
      (mail.to && mail.to.toLowerCase().includes(term)) ||
      (mail.subject && mail.subject.toLowerCase().includes(term)) ||
      (mail.body && mail.body.toLowerCase().includes(term))
    );
  });

  const handleExportCSV = () => {
    if (!reportsData || !reportsData.employeeStats) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Naam Medewerker,Email,Toegewezen Uren,Aantal Shifts\n";

    reportsData.employeeStats.forEach((row: any) => {
      csvContent += `"${row.name}","${row.email}",${row.assignedHours},${row.assignmentCount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dienstregeling_rapport_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (user.role !== "ADMINISTRATOR") {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Toegang Geweigerd</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Het beheercentrum bevat gevoelige organisatiegegevens, logboeken en rapporten en is alleen toegankelijk voor beheerders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Upper Navigation/Toggle tab bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "reports" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Planning & Rapporten
          </button>
          <button
            onClick={() => setActiveTab("employees")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "employees" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Personeelsleden Beheer
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "settings" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            E-mail & Systeem Instellingen
          </button>
          <button
            onClick={() => setActiveTab("emails")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "emails" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Verzonden E-mails
          </button>
          <button
            onClick={() => setActiveTab("announcements")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "announcements" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Mededeling Plaatsen
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "logs" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Audit Logboeken
          </button>
        </div>

        {activeTab === "reports" && reportsData && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs bg-white cursor-pointer"
          >
            <Download className="h-4 w-4" /> Rapport Exporteren (CSV)
          </button>
        )}
      </div>

      {/* Reports tab */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {loadingReports ? (
            <div className="py-12 flex justify-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
            </div>
          ) : reportsData ? (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Totaal Personeelsleden</span>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">{reportsData.employeeCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Totaal Geplande Shifts</span>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">{reportsData.totalShifts}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Wachtende Verlofaanvragen</span>
                  <p className="text-3xl font-extrabold text-amber-600 mt-1">{reportsData.pendingLeaveCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Wachtende Dienstruilen</span>
                  <p className="text-3xl font-extrabold text-blue-600 mt-1">{reportsData.pendingSwapCount}</p>
                </div>
              </div>

              {/* Employee allocations list */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Medewerker Toewijzing & Uren Statistieken
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4 rounded-l-lg">Medewerker</th>
                        <th className="py-3 px-4">E-mailadres</th>
                        <th className="py-3 px-4 text-center">Toegewezen Diensturen</th>
                        <th className="py-3 px-4 rounded-r-lg text-center">Totaal Shifts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {reportsData.employeeStats.map((stat: any) => {
                        return (
                          <tr key={stat.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-4 font-bold text-slate-800">
                              <span style={getUserColorStyle(stat.id, 0.14)} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border">
                                {stat.name}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono">{stat.email}</td>
                            <td className="py-4 px-4 text-center font-bold text-slate-900">{stat.assignedHours.toFixed(1)} uur</td>
                            <td className="py-4 px-4 text-center font-mono rounded-r-lg">{stat.assignmentCount} shifts</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Employees Management tab */}
      {activeTab === "employees" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create or Edit Employee Column */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {editingUser ? (
              <>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit className="h-4.5 w-4.5 text-blue-600" /> Account Aanpassen
                </h3>
                <p className="text-xs text-slate-400">
                  Pas de naam, het e-mailadres, de rol of het wachtwoord aan van <strong>{editingUser.name}</strong>.
                </p>

                <form onSubmit={handleUpdateEmployee} className="space-y-4 text-sm text-slate-700">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Volledige Naam</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Bijv. Alice Peeters"
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mailadres</label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="alice@homenursing.org"
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Nieuw Wachtwoord <span className="text-[10px] text-slate-400 font-normal">(leeglaten om te behouden)</span>
                    </label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Voer nieuw wachtwoord in"
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    >
                      <option value="EMPLOYEE">Verpleegkundige / Zorgverlener (EMPLOYEE)</option>
                      <option value="ADMINISTRATOR">Beheerder (ADMINISTRATOR)</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={submittingEdit}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition shadow-xs disabled:opacity-50 cursor-pointer text-center"
                    >
                      {submittingEdit ? "Opslaan..." : "Wijzigingen Opslaan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(null);
                        setEditName("");
                        setEditEmail("");
                        setEditPassword("");
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-lg transition cursor-pointer"
                    >
                      Annuleren
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="h-4.5 w-4.5 text-blue-600" /> Nieuwe Medewerker Toevoegen
                </h3>
                <p className="text-xs text-slate-400">
                  Maak een nieuw account aan voor een teamlid. Alleen beheerders kunnen accounts aanmaken.
                </p>

                <form onSubmit={handleAddEmployee} className="space-y-4 text-sm text-slate-700">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Volledige Naam</label>
                    <input
                      type="text"
                      required
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      placeholder="Bijv. Alice Peeters"
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mailadres</label>
                    <input
                      type="email"
                      required
                      value={newEmpEmail}
                      onChange={(e) => setNewEmpEmail(e.target.value)}
                      placeholder="alice@homenursing.org"
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Wachtwoord</label>
                    <input
                      type="password"
                      required
                      value={newEmpPassword}
                      onChange={(e) => setNewEmpPassword(e.target.value)}
                      placeholder="Kies een wachtwoord"
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol</label>
                    <select
                      value={newEmpRole}
                      onChange={(e) => setNewEmpRole(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    >
                      <option value="EMPLOYEE">Verpleegkundige / Zorgverlener (EMPLOYEE)</option>
                      <option value="ADMINISTRATOR">Beheerder (ADMINISTRATOR)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingEmp}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submittingEmp ? "Bezig met aanmaken..." : "Account Aanmaken"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* List Employees Column */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4.5 w-4.5 text-blue-600" /> Geregistreerde Gebruikers & Rollen ({employeesList.length})
            </h3>

            {loadingEmployees ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
              </div>
            ) : employeesList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Geen accounts gevonden.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 rounded-l-lg">Naam</th>
                      <th className="py-3 px-4">E-mail / Rol</th>
                      <th className="py-3 px-4 text-right rounded-r-lg">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {employeesList.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-4 font-bold text-slate-800">
                          <span style={getUserColorStyle(emp.id, 0.14)} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border">
                            {emp.name}
                          </span>
                          {emp.id === user.id && (
                            <span className="ml-1.5 bg-blue-50 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              U bent dit
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-mono text-[11px] text-slate-500">{emp.email}</div>
                          <div className="mt-0.5">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                              emp.role === "ADMINISTRATOR"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-blue-50 text-blue-700 border border-blue-100"
                            }`}>
                              {emp.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {deletingEmployeeId === emp.id ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] text-red-600 font-semibold">Zeker weten?</span>
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => handleDeleteEmployee(emp.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded cursor-pointer"
                                >
                                  Ja
                                </button>
                                <button
                                  onClick={() => setDeletingEmployeeId(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded cursor-pointer"
                                >
                                  Nee
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingUser(emp);
                                  setEditName(emp.name);
                                  setEditEmail(emp.email);
                                  setEditRole(emp.role);
                                  setEditPassword("");
                                }}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition cursor-pointer inline-flex items-center"
                                title="Wijzig dit account (e-mail, rol, wachtwoord)"
                              >
                                <Edit className="h-4.5 w-4.5" />
                              </button>
                              <button
                                onClick={() => setDeletingEmployeeId(emp.id)}
                                disabled={emp.id === user.id}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 cursor-pointer inline-flex items-center"
                                title="Verwijder dit account"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings & DB Reset tab */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Email Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-4.5 w-4.5 text-blue-600" /> E-mailnotificaties & SMTP / Resend Configureren
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kies hoe de planner e-mails verzendt. U kunt kiezen voor een gratis Resend API Key, of uw eigen SMTP-servergegevens (bijv. van uw provider of Google App Password) invoeren.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">E-maildienst Type</label>
                <select
                  value={settings.email_service_type}
                  onChange={(e) => setSettings({ ...settings, email_service_type: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                >
                  <option value="simulation">Simulatiemodus (E-mails worden alleen opgeslagen in logboeken)</option>
                  <option value="resend">Resend API (Vereist Resend API-sleutel)</option>
                  <option value="smtp">Eigen SMTP-server (Gmail, SMTP-host, poort, app wachtwoord)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Afzender E-mailadres (From:)</label>
                <input
                  type="email"
                  required
                  value={settings.sender_email}
                  onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                  placeholder="noreply@hetverbandternat.be"
                />
                <span className="text-[10px] text-slate-400">Let op: bij Resend moet dit domein geverifieerd zijn.</span>
              </div>

              {settings.email_service_type === "resend" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Resend API Key</label>
                  <input
                    type="password"
                    value={settings.resend_api_key}
                    onChange={(e) => setSettings({ ...settings, resend_api_key: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                    placeholder="re_xxxxxxxxxxxxxxxx"
                  />
                </div>
              )}

              {settings.email_service_type === "smtp" && (
                <div className="space-y-4 border-l-2 border-blue-100 pl-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">SMTP Host</label>
                      <input
                        type="text"
                        value={settings.smtp_host}
                        onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">SMTP Poort</label>
                      <input
                        type="text"
                        value={settings.smtp_port}
                        onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">SMTP Gebruikersnaam / E-mail</label>
                    <input
                      type="text"
                      value={settings.smtp_user}
                      onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                      placeholder="uwnaam@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">SMTP Wachtwoord / App Wachtwoord</label>
                    <input
                      type="password"
                      value={settings.smtp_pass}
                      onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? "Bezig met opslaan..." : "Instellingen Opslaan"}
              </button>
            </form>

            {/* Send Month Schedule Form */}
            <div className="border-t border-slate-100 pt-5 mt-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Mail className="h-4 w-4 text-blue-600" /> Maandplanning Versturen via E-mail
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Stuur de vastgestelde roosters van alle medewerkers voor een gekozen maand rechtstreeks naar hun e-mailadres. Elke medewerker ontvangt zijn persoonlijke overzicht.
              </p>
              <form onSubmit={handleSendMonthSchedule} className="flex gap-2">
                <input
                  type="month"
                  required
                  placeholder="YYYY-MM"
                  value={sendMonthYear}
                  onChange={(e) => setSendMonthYear(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={sendingMonthEmail || !sendMonthYear}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                >
                  {sendingMonthEmail ? "Versturen..." : "Verstuur Planning"}
                </button>
              </form>
            </div>

            {/* Test Email Form */}
            <div className="border-t border-slate-100 pt-5 mt-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Test E-mailnotificatie Verzenden</h4>
              <p className="text-xs text-slate-400">
                Stuur een testbericht om te controleren of de gekozen configuratie werkt. Dit bewaart tevens uw ingevoerde instellingen.
              </p>
              <form onSubmit={handleSendTestEmail} className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="test@hetverbandternat.be"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={sendingTestEmail || !testEmailRecipient}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                >
                  {sendingTestEmail ? "Versturen..." : "Test E-mail"}
                </button>
              </form>
            </div>
          </div>

          {/* Database Reset & System Stats */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500" /> Systeem Database Reset & Vertaling
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Als u de database wilt herinitialiseren naar de nieuw vertaalde, Nederlandstalige seeddata van Het Verband Ternat (met verpleegkundigen, zorgverleners en geplande shifts in het Nederlands), kunt u hieronder een volledige herstart uitvoeren.
              </p>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> Waarschuwing: Gegevensverlies
                </h4>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Dit herstelt de database volledig naar de fabrieksinstellingen. Alle handmatig geplaatste shifts, geregistreerde medewerkers en ingediende verlofaanvragen worden onomkeerbaar gewist en vervangen door het vertaalde verpleegkundigenteam-seed.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {resetConfirmOpen ? (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-red-900">
                    Weet u dit absoluut zeker? Dit kan niet ongedaan worden gemaakt. U wordt automatisch uitgelogd.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleResetDB}
                      disabled={resettingDb}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                    >
                      {resettingDb ? "Resetten..." : "Ja, Wis Alles & Seed in het Nederlands"}
                    </button>
                    <button
                      onClick={() => setResetConfirmOpen(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                    >
                      Annuleer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setResetConfirmOpen(true)}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl uppercase tracking-wider transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" /> Reset Database naar Nederlandse Seeddata
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Audit Logs tab */}
      {activeTab === "logs" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Systeem Actie Trail & Audit Logboeken
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Volg alle shiftcreaties, ruilingen, registraties en verwijderingen.</p>
            </div>

            {/* Log Search */}
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 max-w-sm w-full sm:w-auto">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Zoek acties of gebruikers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 focus:outline-hidden focus:ring-0 w-full text-xs"
              />
            </div>
          </div>

          {loadingLogs ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Geen acties gevonden die voldoen aan de zoekterm.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Tijdstip</th>
                    <th className="py-3 px-4">Gebruiker</th>
                    <th className="py-3 px-4">Actie</th>
                    <th className="py-3 px-4">Omschrijving</th>
                    <th className="py-3 px-4">IP-adres</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 text-slate-400">{new Date(log.createdAt).toLocaleString("nl-BE")}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-semibold">{log.user?.name || "Systeem Event"}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded-sm text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{log.details}</td>
                      <td className="py-3.5 px-4 text-slate-400">{log.ipAddress || "127.0.0.1"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Email Logs tab */}
      {activeTab === "emails" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-4.5 w-4.5 text-blue-500" /> Verzonden E-mailnotificaties Logboek
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Overzicht van alle e-mailnotificaties verstuurd door de planner.</p>
            </div>

            {/* Email Search */}
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 max-w-sm w-full sm:w-auto">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Zoek e-mail, onderwerp of inhoud..."
                value={searchTermEmail}
                onChange={(e) => setSearchTermEmail(e.target.value)}
                className="bg-transparent border-0 focus:outline-hidden focus:ring-0 w-full text-xs"
              />
            </div>
          </div>

          {loadingEmails ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Geen verzonden e-mails gevonden die voldoen aan de zoekterm.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Tijdstip</th>
                    <th className="py-3 px-4">Ontvanger</th>
                    <th className="py-3 px-4">Onderwerp</th>
                    <th className="py-3 px-4">Bericht (HTML)</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px]">
                  {filteredEmails.map((mail, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{new Date(mail.sentAt).toLocaleString("nl-BE")}</td>
                      <td className="py-3.5 px-4 text-slate-800 font-bold font-mono">{mail.to}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-semibold">{mail.subject}</td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-md truncate">
                        <div className="prose prose-sm font-sans max-h-16 overflow-y-auto bg-slate-50 p-2 rounded-lg border border-slate-100" dangerouslySetInnerHTML={{ __html: mail.body }} />
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-bold px-1.5 py-0.5 rounded-sm text-[9px] uppercase border ${
                          mail.status.includes("Fout")
                            ? "bg-red-50 text-red-600 border-red-100"
                            : mail.status.includes("Simulatie")
                            ? "bg-blue-50 text-blue-600 border-blue-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        }`}>
                          {mail.status || "VERSTUURD"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Post Announcement tab */}
      {activeTab === "announcements" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 max-w-xl">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Megaphone className="h-4.5 w-4.5 text-blue-500" /> Mededeling Verspreiden naar het Team
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Schrijf een belangrijk bericht dat onmiddellijk op de dashboards van alle medewerkers zal verschijnen. Dit verstuurt tevens meldingen naar alle verpleegkundigen.
          </p>

          <form onSubmit={handlePostAnnouncement} className="space-y-4 text-sm text-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Titel van Mededeling</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Wijzigingen in de feestdagenregeling"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Inhoud</label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Schrijf hier uw mededeling..."
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-hidden resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingAnn}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submittingAnn ? "Versturen..." : "Mededeling Nu Plaatsen"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
