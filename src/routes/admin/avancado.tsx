import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/avancado")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurações avançadas | NUTRICAR" },
      {
        name: "description",
        content: "Servidor de e-mail (SMTP) e modelos de notificação para fornecedores e administradores.",
      },
      { property: "og:title", content: "Configurações avançadas | NUTRICAR" },
      { property: "og:description", content: "Configure SMTP e templates de notificação." },
    ],
  }),
  component: AvancadoPage,
});

type Smtp = {
  host: string;
  port: number;
  username: string;
  password: string;
  from_name: string;
  from_email: string;
  use_tls: boolean;
  enabled: boolean;
  admin_recipients: string;
};

function AvancadoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [smtp, setSmtp] = useState<Smtp | null>(null);
  const [templates, setTemplates] = useState<
    { id: string; key: string; title: string; subject: string; body: string; active: boolean }[]
  >([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth", replace: true });
      else setReady(true);
    });
  }, [navigate]);

  const roleQuery = useQuery({
    queryKey: ["is-admin"],
    enabled: ready,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      return data === true;
    },
  });

  const smtpQuery = useQuery({
    queryKey: ["smtp"],
    enabled: ready && roleQuery.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smtp_settings")
        .select(
          "host, port, username, password, from_name, from_email, use_tls, enabled, admin_recipients",
        )
        .maybeSingle();
      if (error) throw error;
      return data as Smtp | null;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["email_templates"],
    enabled: ready && roleQuery.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, key, title, subject, body, active")
        .order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (smtpQuery.data) setSmtp(smtpQuery.data);
  }, [smtpQuery.data]);

  useEffect(() => {
    if (templatesQuery.data) setTemplates(templatesQuery.data);
  }, [templatesQuery.data]);

  async function saveSmtp() {
    if (!smtp) return;
    setMsg(null);
    const { error } = await supabase.from("smtp_settings").update(smtp).eq("id", true);
    if (error) return setMsg(`Erro: ${error.message}`);
    setMsg("Configuração de e-mail salva.");
    await queryClient.invalidateQueries({ queryKey: ["smtp"] });
  }

  async function saveTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setMsg(null);
    const { error } = await supabase
      .from("email_templates")
      .update({ subject: t.subject, body: t.body, active: t.active })
      .eq("id", id);
    if (error) return setMsg(`Erro: ${error.message}`);
    setMsg(`Modelo "${t.title}" salvo.`);
    await queryClient.invalidateQueries({ queryKey: ["email_templates"] });
  }

  if (!ready) return null;

  if (roleQuery.data === false) {
    return (
      <NutricarShell>
        <div className="surface-card p-6">
          <p className="text-sm text-destructive">Acesso restrito a administradores.</p>
        </div>
      </NutricarShell>
    );
  }

  const fieldClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <NutricarShell>
      <div className="space-y-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 surface-card p-5">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">Avançado</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Servidor de e-mail e modelos de notificação
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin">Voltar ao painel</Link>
          </Button>
        </div>

        {smtp && (
          <div className="space-y-4 surface-card p-5">
            <h2 className="text-lg font-semibold">Servidor de e-mail (SMTP)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="host">Servidor</Label>
                <Input
                  id="host"
                  className="mt-2"
                  value={smtp.host}
                  placeholder="smtp.empresa.com.br"
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="port">Porta</Label>
                <Input
                  id="port"
                  className="mt-2"
                  inputMode="numeric"
                  value={String(smtp.port)}
                  onChange={(e) =>
                    setSmtp({ ...smtp, port: Number(e.target.value.replace(/\D/g, "")) || 0 })
                  }
                />
              </div>
              <div>
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  className="mt-2"
                  value={smtp.username}
                  onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  className="mt-2"
                  value={smtp.password}
                  onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="from_name">Nome do remetente</Label>
                <Input
                  id="from_name"
                  className="mt-2"
                  value={smtp.from_name}
                  onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="from_email">E-mail do remetente</Label>
                <Input
                  id="from_email"
                  className="mt-2"
                  value={smtp.from_email}
                  onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="admins">
                  E-mails dos administradores que recebem cópia (separados por vírgula)
                </Label>
                <Input
                  id="admins"
                  className="mt-2"
                  value={smtp.admin_recipients}
                  placeholder="ti@nutricarbrasil.com.br, logistica@nutricarbrasil.com.br"
                  onChange={(e) => setSmtp({ ...smtp, admin_recipients: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={smtp.use_tls}
                  onChange={(e) => setSmtp({ ...smtp, use_tls: e.target.checked })}
                />
                Usar TLS/SSL
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={smtp.enabled}
                  onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
                />
                Notificações por e-mail ativadas
              </label>
            </div>
            <Button onClick={saveSmtp}>Salvar configuração</Button>
          </div>
        )}

        <div className="space-y-4 surface-card p-5">
          <div>
            <h2 className="text-lg font-semibold">Modelos de mensagem</h2>
            <p className="text-sm text-muted-foreground">
              Variáveis disponíveis: {"{{fornecedor}}"}, {"{{data}}"}, {"{{hora}}"}, {"{{pedido}}"},{" "}
              {"{{veiculo}}"}, {"{{email}}"}.
            </p>
          </div>
          {templates.map((t) => (
            <div key={t.id} className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{t.title}</h3>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={t.active}
                    onChange={(e) =>
                      setTemplates(
                        templates.map((x) =>
                          x.id === t.id ? { ...x, active: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  Ativo
                </label>
              </div>
              <div>
                <Label htmlFor={`subject-${t.id}`}>Assunto</Label>
                <Input
                  id={`subject-${t.id}`}
                  className="mt-2"
                  value={t.subject}
                  onChange={(e) =>
                    setTemplates(
                      templates.map((x) => (x.id === t.id ? { ...x, subject: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor={`body-${t.id}`}>Mensagem</Label>
                <textarea
                  id={`body-${t.id}`}
                  rows={8}
                  className={`${fieldClass} mt-2`}
                  value={t.body}
                  onChange={(e) =>
                    setTemplates(
                      templates.map((x) => (x.id === t.id ? { ...x, body: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <Button variant="secondary" onClick={() => saveTemplate(t.id)}>
                Salvar modelo
              </Button>
            </div>
          ))}
        </div>

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
    </NutricarShell>
  );
}
