import { useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="relative flex h-screen bg-navy-900 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className="overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out"
        style={{ maxWidth: sidebarCollapsed ? 0 : 240 }}
      >
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <button
        onClick={() => setSidebarCollapsed((v) => !v)}
        className="hidden md:flex items-center justify-center"
        style={{
          position: "absolute",
          left: sidebarCollapsed ? 0 : 232,
          top: "50%",
          transform: "translateY(-50%)",
          transition: "left 0.3s ease-in-out",
          zIndex: 60,
          width: 14,
          height: 44,
          background: "rgb(var(--navy-800))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: sidebarCollapsed ? "1px solid rgba(255,255,255,0.08)" : "none",
          borderRadius: "0 5px 5px 0",
          color: "rgba(255,255,255,0.28)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "rgba(255,255,255,0.65)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "rgba(255,255,255,0.28)";
        }}
      >
        {sidebarCollapsed ? <ChevronRight size={9} /> : <ChevronLeft size={9} />}
      </button>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}