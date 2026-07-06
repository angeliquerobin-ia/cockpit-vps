import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Compass,
  Lightbulb,
  Calendar,
  CalendarClock,
  PenLine,
  Film,
  BarChart3,
  Users,
  Settings,
  Trash2,
  Archive,
  Recycle,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
const cockpitLogo = { url: "/cockpit-logo.png" };

const nav = [
  { to: "/strategie", label: "Stratégie", icon: Compass },
  { to: "/timing", label: "Timing Business", icon: CalendarClock },
  { to: "/idees", label: "Idées", icon: Lightbulb },
  { to: "/calendrier", label: "Calendrier", icon: Calendar },
  { to: "/studio", label: "Studio de rédaction", icon: PenLine },
  { to: "/reels", label: "Réels", icon: Film },
  { to: "/statistiques", label: "Statistiques", icon: BarChart3 },
  { to: "/concurrents", label: "Veille stratégique", icon: Users },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/recyclage", label: "Recyclage", icon: Recycle },
  { to: "/corbeille", label: "Corbeille", icon: Trash2 },
  { to: "/reglages", label: "Réglages", icon: Settings },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-6 py-5 border-b border-sidebar-border flex flex-col items-center">
          <img
            src={cockpitLogo.url}
            alt="Cockpit"
            className="h-24 w-auto select-none mix-blend-multiply"
            draggable={false}
          />
          <p className="tagline text-xs mt-1 text-center">Création de contenu</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-10 py-12">{children}</div>
      </main>
    </div>
  );
}
