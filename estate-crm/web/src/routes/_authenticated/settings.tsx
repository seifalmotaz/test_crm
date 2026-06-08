import { useTheme } from "../../contexts/ThemeContext";

export default function SettingsPage() {
  const { theme, setTheme, accent, setAccent } = useTheme();

  const accents = [
    { name: "red", class: "bg-red-500" },
    { name: "blue", class: "bg-blue-500" },
    { name: "violet", class: "bg-violet-500" },
    { name: "emerald", class: "bg-emerald-500" },
    { name: "rose", class: "bg-rose-500" },
    { name: "amber", class: "bg-amber-500" },
    { name: "cyan", class: "bg-cyan-500" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="card-border rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Theme</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme("dark")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === "dark"
                  ? "bg-accent-500 text-white"
                  : "bg-navy-700 text-slate-400 hover:text-white"
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === "light"
                  ? "bg-accent-500 text-white"
                  : "bg-navy-700 text-slate-400 hover:text-white"
              }`}
            >
              Light
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Accent Color</h3>
          <div className="flex flex-wrap gap-3">
            {accents.map((a) => (
              <button
                key={a.name}
                onClick={() => setAccent(a.name)}
                className={`w-10 h-10 rounded-full ${a.class} ${
                  accent === a.name ? "ring-2 ring-white ring-offset-2 ring-offset-navy-900" : ""
                } transition-all`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}