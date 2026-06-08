import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Search, LogOut, Settings, Menu } from "lucide-react";

const NAV_PILLS = [
  { label: "Listings", to: "/properties" },
  { label: "Clients", to: "/clients" },
  { label: "Reports", to: "/analytics" },
];

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const isLight = theme === "light";

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  const displayName = user?.name || user?.email?.split("@")[0]?.replace(/[._-]/g, " ")?.replace(/\b\w/g, c => c.toUpperCase()) || "User";

  const bg = isLight ? "rgba(255,255,255,0.96)" : "#0e0e13";
  const border = isLight ? "1px solid #e5e7eb" : "none";
  const pillBg = isLight ? "#f3f4f6" : "#1d1d26";
  const pillColor = isLight ? "#374151" : "#ffffff";
  const iconBg = isLight ? "#f3f4f6" : "#1d1d26";
  const iconColor = isLight ? "#6b7280" : "rgba(255,255,255,0.65)";
  const inputBg = isLight ? "#f3f4f6" : "#1d1d26";
  const inputBorder = isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.07)";
  const inputColor = isLight ? "#374151" : "rgba(255,255,255,0.65)";
  const namColor = isLight ? "#111827" : "#ffffff";
  const emailColor = isLight ? "#6b7280" : "rgba(255,255,255,0.38)";

  return (
    <>
      <header
        style={{
          background: bg,
          borderBottom: border,
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 16,
          padding: "10px 20px",
          backdropFilter: "blur(8px)",
          position: "relative",
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2">
          <button onClick={onMenuClick} className="md:hidden w-9 h-9 rounded-full flex items-center justify-center transition-all" style={{ background: iconBg, color: iconColor }}>
            <Menu size={16} />
          </button>
          <div className="hidden md:flex items-center gap-2">
            {NAV_PILLS.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="rounded-full text-sm font-medium transition-all whitespace-nowrap"
                style={{ padding: "7px 20px", background: pillBg, color: pillColor, textDecoration: "none" }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <div className="relative w-full" style={{ maxWidth: 460 }}>
            <Search size={14} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: isLight ? "#9ca3af" : "rgba(255,255,255,0.30)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search properties, leads, deals…"
              style={{
                width: "100%",
                borderRadius: 999,
                padding: "9px 20px 9px 42px",
                background: inputBg,
                border: inputBorder,
                color: inputColor,
                fontSize: 13,
                outline: "none",
              }}
              onFocus={e => { e.target.style.borderColor = "rgba(229,57,53,0.35)" }}
              onBlur={e => { e.target.style.borderColor = isLight ? "#e5e7eb" : "rgba(255,255,255,0.07)" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 justify-end">
          <div style={{ position: "relative" }}>
            <button
              style={{
                width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: iconBg, color: iconColor,
                border: "none", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <Settings size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2.5" style={{ marginLeft: 4 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: isLight
                  ? "linear-gradient(145deg,#fca5a5,#f87171)"
                  : "linear-gradient(145deg,#d4a5c9,#b07cc0,#7a5fa8)",
                border: `2px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.14)"}`,
                position: "relative", overflow: "hidden", flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 36 36" width="36" height="36" style={{ position: "absolute", inset: 0 }}>
                <ellipse cx="18" cy="35" rx="13" ry="9" fill="rgba(255,255,255,0.55)" />
                <rect x="14.5" y="22" width="7" height="6" rx="3" fill={isLight ? "rgba(254,215,170,0.95)" : "rgba(255,220,190,0.90)"} />
                <circle cx="18" cy="15" r="8.5" fill={isLight ? "rgba(254,215,170,0.95)" : "rgba(255,220,190,0.95)"} />
                <path d="M9.5 14 Q10 5 18 4.5 Q26 5 26.5 14 Q25 8 18 8 Q11 8 9.5 14Z" fill="rgba(50,25,15,0.82)" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <p style={{ color: namColor, fontSize: 13, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap" }}>{displayName}</p>
              <p style={{ color: emailColor, fontSize: 11, lineHeight: 1.3, whiteSpace: "nowrap" }}>{user?.email || ""}</p>
            </div>
          </div>

          <button
            onClick={() => setConfirmLogout(true)}
            title="Sign out"
            style={{
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: iconBg, color: iconColor,
              border: "none", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#E53935"; e.currentTarget.style.background = "rgba(229,57,53,0.12)" }}
            onMouseLeave={e => { e.currentTarget.style.color = iconColor; e.currentTarget.style.background = iconBg }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl" style={{ background: isLight ? "#ffffff" : "#18181f", border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-col gap-1">
              <p style={{ color: isLight ? "#111827" : "#f1f5f9", fontWeight: 600, fontSize: 16 }}>Sign Out</p>
              <p style={{ color: isLight ? "#6b7280" : "#94a3b8", fontSize: 14 }}>Are you sure you want to sign out?</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmLogout(false)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.08)", color: isLight ? "#374151" : "#94a3b8" }}>Cancel</button>
              <button onClick={handleLogout} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#E53935" }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
