import React, { useState, useEffect } from "react";
import { Clock, Plus, Trash2, Check, ShieldAlert, Sparkles, AlertCircle, Calendar } from "lucide-react";
import { Availability } from "../types.js";

interface AvailabilitySettingsProps {
  user: any;
  token: string;
}

export default function AvailabilitySettings({ user, token }: AvailabilitySettingsProps) {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [maxHours, setMaxHours] = useState(40);
  const [maxDays, setMaxDays] = useState(5);
  const [loading, setLoading] = useState(true);

  // New specific unavailable date form
  const [newDate, setNewDate] = useState("");
  const [newDateAvailable, setNewDateAvailable] = useState(false); // false means "unavailable" on this specific date

  const fetchAvailability = async () => {
    if (!user.employee) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/availabilities/${user.employee.id}`, { headers });
      const data = await res.json();
      setAvailabilities(data);

      setMaxHours(user.employee.maxWeeklyHours);
      setMaxDays(user.employee.maxConsecutiveDays);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [user, token]);

  const handleUpdatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/employees/${user.employee.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          maxWeeklyHours: maxHours,
          maxConsecutiveDays: maxDays,
        }),
      });

      if (res.ok) {
        alert("Beschikbaarheidsvoorkeuren succesvol bijgewerkt!");
      } else {
        alert("Fout bij het bijwerken van uw voorkeuren.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleWeekday = async (dayOfWeek: number, currentlyAvailable: boolean) => {
    try {
      const res = await fetch("/api/availabilities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId: user.employee.id,
          dayOfWeek,
          isAvailable: !currentlyAvailable,
          isSpecificDate: false,
        }),
      });

      if (res.ok) {
        fetchAvailability();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSpecificDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;

    try {
      const res = await fetch("/api/availabilities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId: user.employee.id,
          date: newDate,
          isAvailable: newDateAvailable,
          isSpecificDate: true,
        }),
      });

      if (res.ok) {
        setNewDate("");
        fetchAvailability();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (user.role !== "EMPLOYEE") {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Alleen voor medewerkers</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Alleen geregistreerde medewerkers kunnen hun wekelijkse urenlimieten en beschikbaarheidsvoorkeuren aanpassen.
        </p>
      </div>
    );
  }

  const daysOfWeekLabels = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

  // Group availabilities
  const recurringAvail = availabilities.filter((a) => !a.isSpecificDate);
  const specificAvail = availabilities.filter((a) => a.isSpecificDate);

  const getDayAvailabilityStatus = (dayNum: number) => {
    const found = recurringAvail.find((a) => a.dayOfWeek === dayNum);
    return found ? found.isAvailable : false;
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          Mijn Beschikbaarheid & Voorkeuren
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Configureer uw standaard werkvoorkeuren en geef specifieke datums op waarop u niet beschikbaar bent.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly limits preferences */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 h-fit">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-blue-500" /> Werkbeperkingen
          </h3>

          <form onSubmit={handleUpdatePreferences} className="space-y-4 text-sm text-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Max. wekelijkse uren</label>
              <input
                type="number"
                value={maxHours}
                onChange={(e) => setMaxHours(Number(e.target.value))}
                min="5"
                max="80"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">Waarschuwt beheerders als de planning deze limiet overschrijdt.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Max. opeenvolgende dagen</label>
              <input
                type="number"
                value={maxDays}
                onChange={(e) => setMaxDays(Number(e.target.value))}
                min="1"
                max="10"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">Bescherming om oververmoeidheid van zorgverleners te voorkomen.</p>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-xs cursor-pointer"
            >
              Voorkeuren Bijwerken
            </button>
          </form>
        </div>

        {/* Weekly Recurring Availability (Mon-Fri) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
            Standaard Wekelijkse Beschikbaarheid
          </h3>
          <p className="text-xs text-slate-400">
            Markeer de dagen waarop u normaal gesproken beschikbaar bent om diensten te accepteren. Klik om te wisselen.
          </p>

          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
              const isAvailable = getDayAvailabilityStatus(dayNum);
              return (
                <div
                  key={dayNum}
                  onClick={() => handleToggleWeekday(dayNum, isAvailable)}
                  className={`p-3 rounded-xl border transition flex justify-between items-center cursor-pointer ${
                    isAvailable
                      ? "bg-blue-50/50 border-blue-100 hover:bg-blue-100/50"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100/80"
                  }`}
                >
                  <span className="font-semibold text-sm text-slate-800">
                    {daysOfWeekLabels[dayNum]}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border uppercase ${
                    isAvailable 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-red-50 border-red-200 text-red-600"
                  }`}>
                    {isAvailable ? "Beschikbaar" : "Niet beschikbaar"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Specific Date exceptions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-blue-500" /> Specifieke Uitzonderingen
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            Geef specifieke datums op waarop u absoluut niet beschikbaar bent (bijv. doktersafspraken, persoonlijke uitjes).
          </p>

          <form onSubmit={handleAddSpecificDate} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Datum selecteren</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">Beschikbaarheidsstatus</label>
              <select
                value={newDateAvailable ? "true" : "false"}
                onChange={(e) => setNewDateAvailable(e.target.value === "true")}
                className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              >
                <option value="false">Niet beschikbaar / Geblokkeerd</option>
                <option value="true">Beschikbaar / Extra Dienst</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Uitzondering Opslaan
            </button>
          </form>

          {/* List of active specific overrides */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actieve Uitzonderingen</h4>
            {specificAvail.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nog geen specifieke uitzonderingen ingesteld.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {specificAvail.map((item) => (
                  <div key={item.id} className="p-2 border border-slate-200 rounded-lg bg-slate-50/50 flex justify-between items-center text-xs">
                    <span className="font-mono font-semibold text-slate-700">{item.date}</span>
                    <span className={`text-[9px] font-bold px-2 rounded-sm uppercase ${
                      item.isAvailable 
                        ? "bg-emerald-50 text-emerald-700" 
                        : "bg-red-50 text-red-600"
                    }`}>
                      {item.isAvailable ? "Beschikbaar" : "Onbeschikbaar"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
