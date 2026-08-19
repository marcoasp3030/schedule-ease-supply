import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchVehicleTypes } from "@/lib/agendamento";

export const Route = createFileRoute("/admin/veiculos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tipos de veículo | NUTRICAR" },
      { name: "description", content: "Cadastro e gestão dos tipos de veículo aceitos nas entregas." },
      { property: "og:title", content: "Tipos de veículo | NUTRICAR" },
      { property: "og:description", content: "Gerencie os tipos de veículo do agendamento." },
    ],
  }),
  component: VeiculosPage,
});

function VeiculosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

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

  const listQuery = useQuery({
    queryKey: ["vehicle_types_admin"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_types")
        .select("id, name, active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["vehicle_types_admin"] });
    await queryClient.invalidateQueries({ queryKey: ["vehicle_types"] });
    void fetchVehicleTypes;
  }

  async function create() {
    setMsg(null);
    const value = name.trim();
    if (!value) return setMsg("Informe o nome do tipo de veículo.");
    const { error } = await supabase.from("vehicle_types").insert({ name: value });
    if (error) return setMsg(`Erro: ${error.message}`);
    setName("");
    setMsg("Tipo de veículo cadastrado.");
    await refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    const value = editing.name.trim();
    if (!value) return;
    const { error } = await supabase
      .from("vehicle_types")
      .update({ name: value })
      .eq("id", editing.id);
    if (error) return setMsg(`Erro: ${error.message}`);
    setEditing(null);
    await refresh();
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("vehicle_types").update({ active: !active }).eq("id", id);
    if (error) return setMsg(`Erro: ${error.message}`);
    await refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("vehicle_types").delete().eq("id", id);
    if (error) return setMsg(`Erro: ${error.message}`);
    await refresh();
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

  const rows = listQuery.data ?? [];

  return (
    <NutricarShell>
      <div className="space-y-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 surface-card p-5">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">Tipos de veículo</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Opções exibidas no agendamento
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin">Voltar ao painel</Link>
          </Button>
        </div>

        <div className="space-y-3 surface-card p-5">
          <Label htmlFor="novo-veiculo">Novo tipo de veículo</Label>
          <div className="flex flex-wrap gap-3">
            <Input
              id="novo-veiculo"
              className="max-w-xs"
              value={name}
              placeholder="Ex.: Caminhão Truck"
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={create}>Cadastrar</Button>
          </div>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </div>

        <div className="overflow-x-auto surface-card p-5">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Nome</th>
                <th className="py-2">Situação</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2">
                    {editing?.id === row.id ? (
                      <Input
                        className="max-w-xs"
                        value={editing.name}
                        onChange={(e) => setEditing({ id: row.id, name: e.target.value })}
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="py-2">{row.active ? "Ativo" : "Inativo"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      {editing?.id === row.id ? (
                        <>
                          <Button size="sm" onClick={saveEdit}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing({ id: row.id, name: row.name })}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleActive(row.id, row.active)}
                          >
                            {row.active ? "Desativar" : "Ativar"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => remove(row.id)}>
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    Nenhum tipo de veículo cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </NutricarShell>
  );
}
