import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Área restrita | NUTRICAR" },
      {
        name: "description",
        content: "Acesso restrito para administradores da central de agendamentos NUTRICAR.",
      },
      { property: "og:title", content: "Área restrita | NUTRICAR" },
      { property: "og:description", content: "Login de administradores NUTRICAR." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setMessage(error.message);
      navigate({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setLoading(false);
      if (error) return setMessage(error.message);
      setMessage("Conta criada. Confirme o e-mail para acessar.");
    }
  }

  return (
    <NutricarShell>
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-md space-y-4 surface-card p-8"
      >
        <h1 className="text-2xl font-bold tracking-tight">Área restrita</h1>
        <p className="text-sm text-muted-foreground">
          Acesso exclusivo da equipe NUTRICAR.
        </p>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            className="mt-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            className="mt-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {message && <p className="text-sm text-destructive">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Criar conta de administrador" : "Já tenho conta"}
        </button>
      </form>
    </NutricarShell>
  );
}