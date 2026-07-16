import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  ArrowLeftRight,
  Settings,
  LogOut,
  User,
  HelpCircle,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Login from "./components/Login.tsx";
import Dashboard from "./components/Dashboard.tsx";
import ShiftCalendar from "./components/ShiftCalendar.tsx";
import LeaveManagement from "./components/LeaveManagement.tsx";
import SwapWorkflows from "./components/SwapWorkflows.tsx";
import AdminPanel from "./components/AdminPanel.tsx";
import FirstTimeGuide from "./components/FirstTimeGuide.tsx";
import PasswordChangeModal from "./components/PasswordChangeModal.tsx";
import { getUserColorStyle } from "./utils/userColor.ts";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });
  const [loading, setLoading] = useState(true);
  const [adminOpenRequests, setAdminOpenRequests] = useState<number>(0);
  const [showFirstTimeGuide, setShowFirstTimeGuide] = useState(false);
  const [hasCompletedGuide, setHasCompletedGuide] = useState(() => {
    return localStorage.getItem("completedFirstTimeGuide") === "true";
  });

  // Quick state synchronization
  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        // Check if password change is required
        if (userData.requiresPasswordChange) {
          setRequiresPasswordChange(true);
          setShowPasswordModal(true);
        }
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

  // Check if we should show first-time guide
  useEffect(() => {
    if (user && user.role === "ADMINISTRATOR" && !hasCompletedGuide) {
      // Show guide after a short delay to allow UI to settle
      const timer = setTimeout(() => {
        setShowFirstTimeGuide(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, hasCompletedGuide]);

  const handleCompleteGuide = () => {
    setHasCompletedGuide(true);
    localStorage.setItem("completedFirstTimeGuide", "true");
  };

  const handleOpenGuide = () => {
    setShowFirstTimeGuide(true);
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

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      localStorage.setItem("sidebarCollapsed", String(!prev));
      return !prev;
    });
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
  const primaryMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calendar", label: "Dienstregeling", icon: Calendar },
    { id: "leave", label: "Verlofaanvragen", icon: ClipboardList },
    { id: "swaps", label: "Ruilbord", icon: ArrowLeftRight },
  ];
  const adminMenuItems =
    user.role === "ADMINISTRATOR"
      ? [{ id: "admin", label: "Beheercentrum", icon: Settings, badge: adminOpenRequests }]
      : [];
  const menuItems = [...primaryMenuItems, ...adminMenuItems];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Upper Navigation Header */}
      <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex justify-between items-center px-4 sm:px-6 sticky top-0 z-40 shadow-xs touch-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 overflow-hidden shadow-xs">
              <img src="/icon-512.png" alt="Logo" className="h-full w-full object-cover" />
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
            onClick={handleOpenGuide}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition"
            title="Snelle start handleiding"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

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
      <div className="flex-1 flex overflow-hidden safe-area-inset-top">

        {/* Sidebar Left Navigation - Desktop */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-slate-200 shrink-0 transition-[width] duration-200 ${
            isSidebarCollapsed ? "w-20" : "w-64"
          }`}
        >
          <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
            {primaryMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`relative w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-all touch-manipulation ${
                    isSidebarCollapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-blue-600" />
                  )}
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!isSidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                </button>
              );
            })}

            {adminMenuItems.length > 0 && (
              <>
                <div className={`pt-3 mt-2 border-t border-slate-100 ${isSidebarCollapsed ? "px-0" : "px-3.5"}`}>
                  {!isSidebarCollapsed && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Beheer
                    </span>
                  )}
                </div>
                {adminMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={`relative w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-all touch-manipulation ${
                        isSidebarCollapsed ? "justify-center" : ""
                      } ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-blue-600" />
                      )}
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      {!isSidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                      {item.badge ? (
                        <span
                          className={`min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-extrabold shadow-sm ${
                            isSidebarCollapsed ? "absolute -top-1 -right-1" : ""
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </>
            )}
          </nav>

          <div className="p-3 border-t border-slate-100">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
              title={isSidebarCollapsed ? "Uitklappen" : "Inklappen"}
            >
              {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              {!isSidebarCollapsed && <span>Inklappen</span>}
            </button>
          </div>
        </aside>

        {/* Content Frame */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-24 md:pb-6 safe-area-inset-bottom">
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
              className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative active:scale-95 ${
                isActive ? "text-blue-600 font-extrabold" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-full transition-all ${
                  isActive ? "bg-blue-50 h-7 w-7" : "h-7 w-7"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-transform ${isActive ? "scale-110 text-blue-600" : ""}`} />
              </div>
              <span className="text-[9px] mt-0.5 tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
              {item.badge ? (
                <span className="absolute top-0.5 right-3 min-w-4.5 h-4.5 px-1 inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-extrabold shadow-sm">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Start Guide - shown automatically on first admin login, or on demand via the header help button */}
      {showFirstTimeGuide && (
        <FirstTimeGuide
          onClose={() => setShowFirstTimeGuide(false)}
          onComplete={handleCompleteGuide}
        />
      )}

    </div>
  );
}
