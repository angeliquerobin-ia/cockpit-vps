import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Info, MailWarning } from "lucide-react";
import cockpitLogo from "@/assets/cockpit-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Connexion — Cockpit" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/strategie", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Compte créé. Vérifiez votre boîte mail (et vos spams).");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/strategie", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(
        "Email envoyé. Pensez à vérifier vos spams si vous ne le voyez pas.",
      );
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err: any) {
      toast.error(err.message ?? "Une erreur est survenue");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <Toaster />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <img
            src={cockpitLogo.url}
            alt="Cockpit"
            className="h-40 w-auto mb-3 select-none"
            draggable={false}
          />
          <p className="tagline text-sm">Création de contenu, en un seul lieu.</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-card)]">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
                mode === "signin" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
                mode === "signup" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              Inscription
            </button>
          </div>

          {mode === "signup" && (
            <div className="mb-5 flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs leading-relaxed">
              <MailWarning className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="opacity-85">
                L'email de confirmation peut atterrir dans les <strong>spams</strong> ou
                la catégorie <em>Promotions</em>. Pensez à le marquer comme
                « non-hameçonnage » / « pas de spam » pour recevoir correctement
                les futurs messages de l'app.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1.5 opacity-70">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-muted px-4 py-2.5 text-foreground placeholder:opacity-50 outline-none focus:ring-2 focus:ring-ring"
                placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="block text-xs uppercase tracking-wider opacity-70">Mot de passe</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotOpen(true);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "..." : mode === "signin" ? "Se connecter" : "Créer le compte"}
            </button>
          </form>

          {forgotOpen && (
            <div className="mt-6 rounded-xl border border-border bg-background/60 p-4 space-y-3">
              <div className="flex gap-2 items-start">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs opacity-80 leading-relaxed">
                  Entrez votre email : un lien de réinitialisation vous sera
                  envoyé. Si vous ne le voyez pas, vérifiez vos spams.
                </p>
              </div>
              <form onSubmit={handleForgot} className="space-y-3">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full rounded-lg bg-muted px-4 py-2.5 text-sm text-foreground placeholder:opacity-50 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="vous@exemple.com"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {forgotLoading ? "…" : "Envoyer le lien"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="rounded-lg bg-muted px-3 py-2 text-sm hover:opacity-80"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
