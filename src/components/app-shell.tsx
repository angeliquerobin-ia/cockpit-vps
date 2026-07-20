import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Compass,
  Lightbulb,
  Calendar,
  CalendarClock,
  Film,
  BarChart3,
  Users,
  Settings,
  Trash2,
  Archive,
  Recycle,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
const cockpitLogo = { url: "/cockpit-logo.png" };

const nav = [
  { to: "/strategie", label: "Stratégie", icon: Compass },
  { to: "/timing", label: "Timing Business", icon: CalendarClock },
  { to: "/idees", label: "Studio de Création", icon: Lightbulb },
  { to: "/calendrier", label: "Calendrier", icon: Calendar },
  { to: "/reels", label: "Réels", icon: Film },
  { to: "/statistiques", label: "Statistiques", icon: BarChart3 },
  { to: "/concurrents", label: "Veille stratégique", icon: Users },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/recyclage", label: "Recyclage", icon: Recycle },
  { to: "/corbeille", label: "Corbeille", icon: Trash2 },
  { to: "/reglages", label: "Réglages", icon: Settings },
] as const;

// Navigation basse mobile : les 4 espaces du quotidien (style Stitch),
// le reste passe par le tiroir.
const bottomNav = [
  { to: "/idees", label: "Studio", icon: Lightbulb },
  { to: "/calendrier", label: "Calendrier", icon: Calendar },
  { to: "/reels", label: "Réels", icon: Film },
  { to: "/reglages", label: "Réglages", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Le tiroir se referme à chaque navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navLinks = (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
  );

  const signOutButton = (
    <div className="p-3 border-t border-sidebar-border">
      <button
        onClick={signOut}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span>Déconnexion</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Barre latérale — ordinateur uniquement */}
      <aside className="hidden lg:flex print:hidden w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col">
        <div className="px-6 py-5 border-b border-sidebar-border flex flex-col items-center">
          <img
            src={cockpitLogo.url}
            alt="Cockpit"
            className="h-24 w-auto select-none mix-blend-multiply"
            draggable={false}
          />
          <p className="tagline text-xs mt-1 text-center">Création de contenu</p>
        </div>
        {navLinks}
        {signOutButton}
      </aside>

      {/* En-tête mobile : hamburger + logo */}
      <header className="lg:hidden print:hidden fixed top-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur border-b border-sidebar-border flex items-center justify-between px-4 h-14">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="p-2 -ml-2 rounded-lg text-primary hover:bg-sidebar-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/strategie" className="flex items-center gap-2">
          <img
            src={cockpitLogo.url}
            alt=""
            className="h-8 w-auto mix-blend-multiply"
            draggable={false}
          />
          <span className="font-serif text-xl text-[var(--title-accent)]">Cockpit</span>
        </Link>
        <div className="w-9" aria-hidden="true" />
      </header>

      {/* Tiroir mobile */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground flex flex-col shadow-[var(--shadow-card)]">
            <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={cockpitLogo.url}
                  alt=""
                  className="h-10 w-auto mix-blend-multiply"
                  draggable={false}
                />
                <span className="font-serif text-2xl text-[var(--title-accent)]">Cockpit</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="p-2 rounded-lg hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navLinks}
            {signOutButton}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-28 lg:px-10 lg:py-12 print:p-0 print:max-w-none">
          {children}
        </div>
      </main>

      {/* Navigation basse mobile (style Stitch) */}
      <nav className="lg:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around px-2 py-1.5">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[11px] transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
