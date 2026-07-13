import React, { useState, useEffect } from "react";
import {
  Sparkles,
  LayoutDashboard,
  Calendar,
  ClipboardList,
  ArrowLeftRight,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  User,
} from "lucide-react";
import Login from "./components/Login.tsx";
import Dashboard from "./components/Dashboard.tsx";
import ShiftCalendar from "./components/ShiftCalendar.tsx";
import LeaveManagement from "./components/LeaveManagement.tsx";
import SwapWorkflows from "./components/SwapWorkflows.tsx";
import AdminPanel from "./components/AdminPanel.tsx";
import { getUserColorStyle } from "./utils/userColor.ts";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminOpenRequests, setAdminOpenRequests] = useState<number>(0);

  // Quick state synchronization
  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        handleLogout();
      }
    } catch (e) {
      console.error(e);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const fetchAdminBadge = async () => {
      if (!user || user.role !== "ADMINISTRATOR" || !token) return;

      try {
        const res = await fetch("/api/reports/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setAdminOpenRequests((data.pendingLeaveCount || 0) + (data.pendingSwapCount || 0));
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchAdminBadge();
  }, [user, token]);

  const handleLoginSuccess = (newToken: string, loggedInUser: any) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(loggedInUser);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setActiveTab("dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600"></div>
          <p className="text-xs text-slate-500 font-semibold tracking-wide">Planner synchroniseren...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login form
  if (!token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Sidebar Menu Items filtered by Role
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calendar", label: "Dienstregeling", icon: Calendar },
    { id: "leave", label: "Verlofaanvragen", icon: ClipboardList },
    { id: "swaps", label: "Ruilbord", icon: ArrowLeftRight },
    ...(user.role === "ADMINISTRATOR"
      ? [{ id: "admin", label: `Beheercentrum (${adminOpenRequests})`, icon: Settings }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Upper Navigation Header */}
      <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex justify-between items-center px-4 sm:px-6 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 md:hidden transition"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900">
              Het Verband Ternat planner
            </span>
          </div>
        </div>

        {/* User Identity and Log Out panel */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold text-slate-800">{user.name}</span>
            <span className="text-[10px] bg-slate-100 border border-slate-200/60 font-bold uppercase text-slate-500 px-2 py-0.5 rounded-sm mt-0.5">
              {user.role === "ADMINISTRATOR" ? "Beheerder" : "Verpleegkundige"}
            </span>
          </div>

          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200/50">
            <User className="h-5 w-5" style={getUserColorStyle(user.id, 0.25)} />
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition"
            title="Afmelden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main layout frame */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Left Navigation - Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 p-4 space-y-1.5 shrink-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </aside>

        {/* Slide-out Sidebar - Mobile */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
            <aside className="relative flex flex-col w-64 bg-slate-900 h-full p-4 space-y-1.5 shadow-xl animate-slide-in">
              <div className="flex justify-between items-center mb-6 px-2">
                <span className="font-extrabold text-sm tracking-tight text-white">Menu Navigatie</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-slate-800 text-white shadow-xs"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </aside>
          </div>
        )}

        {/* Content Frame */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 md:pb-6">
          {activeTab === "dashboard" && <Dashboard user={user} token={token} />}
          {activeTab === "calendar" && <ShiftCalendar user={user} token={token} />}
          {activeTab === "leave" && <LeaveManagement user={user} token={token} />}
          {activeTab === "swaps" && <SwapWorkflows user={user} token={token} />}
          {activeTab === "admin" && <AdminPanel user={user} token={token} />}
        </main>

      </div>

      {/* Mobile Bottom Tab Navigation - iOS & Android Optimized */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/80 backdrop-blur-md flex justify-around items-center h-16 safe-bottom z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all relative ${
                isActive ? "text-blue-600 font-extrabold" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110 text-blue-600" : ""}`} />
              <span className="text-[9px] mt-1 tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>


    </div>
  );
}
