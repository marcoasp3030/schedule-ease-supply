import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings, type Settings } from "@/lib/agendamento";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel do administrador | NUTRICAR" },
      {
        name: "description",
        content:
          "Defina limites diários, entregas em finais de semana e janela de horários dos agendamentos NUTRICAR.",
      },
      { property: "og:title", content: "Painel do administrador | NUTRICAR" },
      {
        property: "og:description",
        content: "Configurações e lista de agendamentos de fornecedores.",
      },
    ],
  }),
  component: AdminPage,
});

type Appointment = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  service_type: string;
  email: string;
  supplier_name: string;
  other_supplier_name: string | null;
  orders_count: number;
  purchase_order: string;
  total_items: number;
  box_volume: number;
  vehicle_type: string;
  status: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth" });
      else setReady(true);
    });
  }, [navigate]);

  const roleQuery = useQuery({
    queryKey: ["is-admin"],
    enabled: ready,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (error) throw error;
      return Boolean(data);
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    enabled: ready,
  });

  const appointmentsQuery = useQuery({
    queryKey: ["appointments"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("scheduled_date", { ascending: false })
        .order("scheduled_time");
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data && !form) setForm(settingsQuery.data);
  }, [settingsQuery.data, form]);

  async function saveSettings() {
    if (!form) return;
    setSaved(null);
    const { error } = await supabase
      .from("schedule_settings")
      .update({
        max_per_day: form.max_per_day,
        allow_weekend: form.allow_weekend,
        start_hour: form.start_hour,
        end_hour: form.end_hour,
        slot_minutes: form.slot_minutes,
        max_per_slot: form.max_per_slot,
      })
      .eq("id", true);
    if (error) return setSaved(`Erro: ${error.message}`);
    setSaved("Configurações salvas.");
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  async function cancelAppointment(id: string) {
    await supabase.from("appointments").update({ status: "cancelado" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function claimAdmin() {
    const { data, error } = await supabase.rpc("claim_admin");
    if (error) return setSaved(`Erro: ${error.message}`);
    if (!data) return setSaved("Já existe um administrador definido.");
    queryClient.invalidateQueries();
  }

  if (!ready) return null;

  const isAdmin = roleQuery.data === true;

  return (
    <NutricarShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 bg-card/95 p-4 shadow">
          <h1 className="text-xl font-bold">Painel do administrador</h1>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>

        {!roleQuery.isLoading && !isAdmin && (
          <div className="space-y-3 bg-card/95 p-4 shadow">
            <p className="text-sm text-destructive">
              Sua conta ainda não tem permissão de administrador.
            </p>
            <Button onClick={claimAdmin}>Tornar-me administrador (primeiro acesso)</Button>
            {saved && <p className="text-sm text-muted-foreground">{saved}</p>}
          </div>
        )}

        {isAdmin && form && (
          <section className="space-y-4 bg-card/95 p-6 shadow">
            <h2 className="text-lg font-semibold">Regras de agendamento</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Agendamentos por dia</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-2"
                  value={form.max_per_day}
                  onChange={(e) => setForm({ ...form, max_per_day: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Agendamentos por horário</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-2"
                  value={form.max_per_slot}
                  onChange={(e) => setForm({ ...form, max_per_slot: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Intervalo entre horários (min)</Label>
                <select
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.slot_minutes}
                  onChange={(e) => setForm({ ...form, slot_minutes: Number(e.target.value) })}
                >
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>
              <div>
                <Label>Horário inicial</Label>
                <Input
                  type="number"
                  min={0}
                  max={22}
                  className="mt-2"
                  value={form.start_hour}
                  onChange={(e) => setForm({ ...form, start_hour: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Horário final</Label>
                <Input
                  type="number"
                  min={1}
                  max={23}
                  className="mt-2"
                  value={form.end_hour}
                  onChange={(e) => setForm({ ...form, end_hour: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.allow_weekend}
                  onCheckedChange={(v) => setForm({ ...form, allow_weekend: v })}
                />
                <Label>Permitir entregas aos finais de semana</Label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveSettings}>Salvar configurações</Button>
              {saved && <span className="text-sm text-muted-foreground">{saved}</span>}
            </div>
          </section>
        )}

        {isAdmin && (
        <section className="space-y-3 bg-card/95 p-6 shadow">
          <h2 className="text-lg font-semibold">Agendamentos</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Data</th>
                  <th>Hora</th>
                  <th>Empresa</th>
                  <th>E-mail</th>
                  <th>Pedido</th>
                  <th>Itens</th>
                  <th>Caixas</th>
                  <th>Veículo</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(appointmentsQuery.data ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2">
                      {new Date(`${a.scheduled_date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td>{a.scheduled_time.slice(0, 5)}</td>
                    <td>{a.other_supplier_name || a.supplier_name}</td>
                    <td>{a.email}</td>
                    <td>{a.purchase_order}</td>
                    <td>{a.total_items}</td>
                    <td>{a.box_volume}</td>
                    <td>{a.vehicle_type}</td>
                    <td>{a.status}</td>
                    <td>
                      {a.status === "confirmado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelAppointment(a.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(appointmentsQuery.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-muted-foreground">
                      Nenhum agendamento registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </NutricarShell>
  );
}