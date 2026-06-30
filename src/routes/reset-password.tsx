import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import cockpitLogo from "@/assets/cockpit-logo.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — Cockpit" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and emits a session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour. Vous pouvez vous reconnecter.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Toaster />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <img
            src={cockpitLogo.url}
            alt="Cockpit"
            className="h-40 w-auto mb-3 select-none"
            draggable={false}
          />
          <p className="tagline text-sm">Choisissez un nouveau mot de passe.</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-card)]">
          {!ready ? (
            <p className="text-sm opacity-70 text-center">
              Vérification du lien de réinitialisation…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1.5 opacity-70">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-muted px-4 py-2.5 text-foreground placeholder:opacity-50 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1.5 opacity-70">
                  Confirmer
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg bg-muted px-4 py-2.5 text-foreground placeholder:opacity-50 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "…" : "Mettre à jour le mot de passe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
