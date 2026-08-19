import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  RotateCcw,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/entregas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entregas agendadas | NUTRICAR" },
      {
        name: "description",
        content:
          "Acompanhe as entregas agendadas dos fornecedores NUTRICAR, com status pendente, concluída ou cancelada.",
      },
      { property: "og:title", content: "Entregas agendadas | NUTRICAR" },
      {
        property: "og:description",
        content: "Lista de entregas de fornecedores com status e cancelamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EntregasPage,
});

type Appointment = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  email: string;
  supplier_name: string;
  other_supplier_name: string | null;
  purchase_order: string;
  total_items: number;
  box_volume: number;
  vehicle_type: string;
  status: string;
};

type StatusKey = "pendente" | "concluida" | "cancelada";

function statusOf(raw: string): StatusKey {
  const s = raw.toLowerCase();
  if (s.startsWith("cancel")) return "cancelada";
  if (s.startsWith("conclu")) return "concluida";
  return "pendente";
}

const STATUS_META: Record<StatusKey, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  concluida: {
    label: "Concluída",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function shiftDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
}

const PAGE_SIZE = 15;

function EntregasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"todas" | StatusKey>("todas");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vehicle, setVehicle] = useState("todos");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

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

  const rows = appointmentsQuery.data ?? [];

  // linhas dentro do período (base dos contadores)
  const inPeriod = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (from && r.scheduled_date < from) return false;
      if (to && r.scheduled_date > to) return false;
      if (vehicle !== "todos" && r.vehicle_type !== vehicle) return false;
      if (!term) return true;
      return [r.other_supplier_name || r.supplier_name, r.email, r.purchase_order]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [rows, search, from, to, vehicle]);

  const counts = useMemo(() => {
    const base = { pendente: 0, concluida: 0, cancelada: 0 } as Record<StatusKey, number>;
    for (const r of inPeriod) base[statusOf(r.status)] += 1;
    return base;
  }, [inPeriod]);

  const vehicles = useMemo(
    () => Array.from(new Set(rows.map((r) => r.vehicle_type).filter(Boolean))).sort(),
    [rows],
  );

  const visible = useMemo(() => {
    const list = inPeriod.filter(
      (r) => filter === "todas" || statusOf(r.status) === filter,
    );
    return [...list].sort((a, b) => {
      const ka = `${a.scheduled_date}T${a.scheduled_time}`;
      const kb = `${b.scheduled_date}T${b.scheduled_time}`;
      return sortDir === "desc" ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });
  }, [inPeriod, filter, sortDir]);

  const totals = useMemo(
    () =>
      visible.reduce(
        (acc, r) => ({
          items: acc.items + (r.total_items || 0),
          boxes: acc.boxes + (r.box_volume || 0),
        }),
        { items: 0, boxes: 0 },
      ),
    [visible],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, search, from, to, vehicle, sortDir]);

  function applyPreset(days: number | "mes") {
    if (days === "mes") {
      const d = new Date();
      setFrom(toISO(new Date(d.getFullYear(), d.getMonth(), 1)));
      setTo(toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
      return;
    }
    if (days === 0) {
      setFrom(toISO(new Date()));
      setTo(toISO(new Date()));
      return;
    }
    if (days > 0) {
      setFrom(toISO(new Date()));
      setTo(shiftDays(days));
    } else {
      setFrom(shiftDays(days));
      setTo(toISO(new Date()));
    }
  }

  function clearFilters() {
    setFilter("todas");
    setSearch("");
    setFrom("");
    setTo("");
    setVehicle("todos");
  }

  function exportExcel() {
    const data = visible.map((a) => ({
      Data: new Date(`${a.scheduled_date}T00:00:00`).toLocaleDateString("pt-BR"),
      Hora: a.scheduled_time.slice(0, 5),
      Empresa: a.other_supplier_name || a.supplier_name,
      "E-mail": a.email,
      Pedido: a.purchase_order,
      Itens: a.total_items,
      Caixas: a.box_volume,
      Veículo: a.vehicle_type,
      Status: STATUS_META[statusOf(a.status)].label,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 30 },
      { wch: 28 },
      { wch: 16 },
      { wch: 8 },
      { wch: 8 },
      { wch: 16 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entregas");
    XLSX.writeFile(wb, `entregas-${toISO(new Date())}.xlsx`);
  }

  async function setStatus(id: string, status: string) {
    await supabase.from("appointments").update({ status }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  }

  if (!ready) return null;

  if (!roleQuery.isLoading && roleQuery.data !== true) {
    return (
      <NutricarShell>
        <div className="surface-card p-6 text-sm text-destructive">
          Sua conta não tem permissão de administrador.
        </div>
      </NutricarShell>
    );
  }

  return (
    <NutricarShell>
      <div className="space-y-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 surface-card p-5">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">Entregas agendadas</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Acompanhamento e status
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportExcel} disabled={visible.length === 0}>
              <Download className="mr-2 size-4" /> Excel
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin">Voltar ao painel</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(["pendente", "concluida", "cancelada"] as StatusKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(filter === key ? "todas" : key)}
              className={`surface-card flex items-center gap-3 p-4 text-left transition-colors ${
                filter === key ? "ring-2 ring-primary" : "hover:bg-secondary/40"
              }`}
            >
              {key === "pendente" && <Clock className="size-5 text-amber-600" />}
              {key === "concluida" && <CheckCircle2 className="size-5 text-primary" />}
              {key === "cancelada" && <XCircle className="size-5 text-destructive" />}
              <div>
                <p className="text-2xl font-bold leading-none">{counts[key]}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {STATUS_META[key].label}
                </p>
              </div>
            </button>
          ))}
        </div>

        <section className="space-y-4 surface-card p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="de">De</Label>
              <Input id="de" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ate">Até</Label>
              <Input id="ate" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veiculo">Veículo</Label>
              <select
                id="veiculo"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="todos">Todos</option>
                {vehicles.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="busca">Buscar</Label>
              <Input
                id="busca"
                placeholder="Empresa, e-mail ou pedido"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Período rápido
            </span>
            <Button size="sm" variant="secondary" onClick={() => applyPreset(0)}>
              Hoje
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset(7)}>
              Próximos 7 dias
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset(30)}>
              Próximos 30 dias
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset(-30)}>
              Últimos 30 dias
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyPreset("mes")}>
              Mês atual
            </Button>
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <RotateCcw className="mr-2 size-4" /> Limpar
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["todas", "pendente", "concluida", "cancelada"] as const).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  onClick={() => setFilter(key)}
                >
                  {key === "todas" ? "Todas" : STATUS_META[key].label}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            >
              <ArrowDownUp className="mr-2 size-4" />
              {sortDir === "desc" ? "Mais recentes" : "Mais antigas"}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {visible.length} entrega(s) · {totals.items} itens · {totals.boxes} caixas
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Data / hora</th>
                  <th>Empresa</th>
                  <th>E-mail</th>
                  <th>Pedido</th>
                  <th>Itens</th>
                  <th>Caixas</th>
                  <th>Veículo</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => {
                  const st = statusOf(a.status);
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-border/60 transition-colors hover:bg-secondary/50"
                    >
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <CalendarDays className="size-4 text-muted-foreground" />
                          {new Date(`${a.scheduled_date}T00:00:00`).toLocaleDateString("pt-BR")}
                          <span className="text-muted-foreground">{a.scheduled_time.slice(0, 5)}</span>
                        </span>
                      </td>
                      <td>{a.other_supplier_name || a.supplier_name}</td>
                      <td>{a.email}</td>
                      <td>{a.purchase_order}</td>
                      <td>{a.total_items}</td>
                      <td>{a.box_volume}</td>
                      <td>{a.vehicle_type}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_META[st].className}`}
                        >
                          {STATUS_META[st].label}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className="flex justify-end gap-2">
                          {st === "pendente" ? (
                            <>
                              <Button size="sm" onClick={() => setStatus(a.id, "concluida")}>
                                Concluir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setStatus(a.id, "cancelada")}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatus(a.id, "confirmado")}
                            >
                              Reabrir
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      Nenhuma entrega encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Próxima
                </Button>
              </span>
            </div>
          )}
        </section>
      </div>
    </NutricarShell>
  );
}
