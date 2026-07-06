import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      // Valide le jeton côté serveur : une session locale peut être orpheline
      // (compte supprimé, secret JWT changé) et bloquerait toutes les pages.
      const { error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error) {
        await supabase.auth.signOut().catch(() => {});
        navigate({ to: "/auth", replace: true });
      } else {
        setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
