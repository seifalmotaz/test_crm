import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Users,
  TrendingUp,
  Heart,
  CheckSquare,
  BarChart3,
  Settings,
  HelpCircle,
  X,
} from "lucide-react";
import PinLogo from "../shared/PinLogo";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/deals", label: "Deals", icon: TrendingUp },
  { to: "/agents", label: "Agents", icon: Users },
  { to: "/clients", label: "Clients", icon: Heart },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const isLight = theme === "light";

  const displayName = user?.name
    || user?.email?.split("@")[0]?.replace(/[._-]/g, " ")?.replace(/\b\w/g, c => c.toUpperCase())
    || "User";
  const displayRole = user?.role === "admin" ? "Administrator" : (user?.role ?? "Agent");

  return (
    <aside
      className={`fixed inset-y-0 start-0 z-50 flex flex-col h-screen w-64 py-6 px-4 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:z-auto md:translate-x-0 md:w-60 md:flex-shrink-0`}
      style={{
        background: isLight ? "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)" : "#0e0e13",
        borderInlineEnd: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mb-8 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PinLogo size={42} />
          <div className="flex flex-col leading-none select-none">
            <div className="relative inline-block">
              <span style={{ fontSize: 20, fontFamily: "'Sora', sans-serif", lineHeight: 1, letterSpacing: "-0.02em", color: isLight ? "#0B1320" : "#ffffff", fontWeight: 800 }}>
                pin
              </span>
              <span className="absolute" style={{ width: 5, height: 5, background: "#E53935", transform: "rotate(45deg)", top: 0, left: "0.62em", borderRadius: 1 }} />
            </div>
            <div className="flex items-center gap-1.5 mt-[5px]">
              <span style={{ height: 1.5, width: 8, background: "#E53935", display: "block" }} />
              <span style={{ fontSize: 8, color: "#E53935", fontFamily: "'Sora', sans-serif", fontWeight: 700, letterSpacing: "0.28em" }}>CRM</span>
              <span style={{ height: 1.5, width: 8, background: "#E53935", display: "block" }} />
            </div>
            <span style={{ fontSize: 6.5, marginTop: 3, fontFamily: "'Sora', sans-serif", letterSpacing: "0.15em", color: isLight ? "#9ca3af" : "#4B5563" }}>BY TRIPLE SHIELD</span>
          </div>
        </div>
        <button onClick={onClose} className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg transition-all" style={{ color: isLight ? "#6b7280" : "#94a3b8", background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }}>
          <X size={16} />
        </button>
      </div>

      <div className="mb-6 px-2">
        <p style={{ color: "#E53935", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4, opacity: 0.9 }}>Welcome back</p>
        <p style={{ color: isLight ? "#0B1320" : "#f1f5f9", fontWeight: 600, fontSize: 14 }}>{displayName}</p>
        <p style={{ color: isLight ? "#6b7280" : "#64748b", fontSize: 12 }}>{displayRole}</p>
      </div>

      <div className="flex-1 overflow-y-auto mb-2 min-h-0">
        <p className="px-2 mb-3" style={{ color: isLight ? "#9ca3af" : "#4B5563", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>Main Menu</p>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(({ icon: Icon, to, label }) => {
          const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? "" : isLight ? "text-gray-500 hover:text-gray-900 hover:bg-black/5" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                style={isActive ? {
                  background: isLight ? "linear-gradient(135deg, rgba(229,57,53,0.12) 0%, rgba(229,57,53,0.06) 100%)" : "rgba(255,255,255,0.05)",
                  borderInlineStart: "2.5px solid #E53935",
                  paddingInlineStart: 10,
                  color: isLight ? "#E53935" : "#ffffff",
                } : { color: isLight ? "#4b5563" : undefined }}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-2 pt-4" style={{ borderTop: `1px solid ${isLight ? "#e5e7eb" : "rgba(255,255,255,0.05)"}` }}>
        <button onClick={logout} className="w-full flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E53935]" />
          <span style={{ color: isLight ? "#9ca3af" : "#4B5563", fontSize: 10, letterSpacing: "0.15em", fontWeight: 500 }}>TRIPLE SHIELD</span>
        </button>
      </div>
    </aside>
  );
}
