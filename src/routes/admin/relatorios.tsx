import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/relatorios")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Relatório de entregas | NUTRICAR" },
      {
        name: "description",
        content:
          "Relatório de entregas de fornecedores NUTRICAR por período, com exportação para Excel.",
      },
      { property: "og:title", content: "Relatório de entregas | NUTRICAR" },
      {
        property: "og:description",
        content: "Consulte entregas por período e baixe a planilha em Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatoriosPage,
});

type Appointment = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  email: string;
  supplier_name: string;
  other_supplier_name: string | null;
  purchase_order: string;
  orders_count: number;
  total_items: number;
  box_volume: number;
  vehicle_type: string;
  status: string;
  created_at: string;
};

function statusLabel(raw: string) {
  const s = raw.toLowerCase();
  if (s.startsWith("cancel")) return "Cancelada";
  if (s.startsWith("conclu")) return "Concluída";
  return "Pendente";
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function isoMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function RelatoriosPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [from, setFrom] = useState(isoMonthStart());
  const [to, setTo] = useState(isoToday());
  const [status, setStatus] = useState("todas");

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

  const reportQuery = useQuery({
    queryKey: ["report", from, to],
    enabled: ready && Boolean(from) && Boolean(to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .order("scheduled_date")
        .order("scheduled_time");
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const rows = useMemo(() => {
    const all = reportQuery.data ?? [];
    if (status === "todas") return all;
    return all.filter((r) => statusLabel(r.status).toLowerCase().startsWith(status.slice(0, 6)));
  }, [reportQuery.data, status]);

  const totals = useMemo(
    () => ({
      entregas: rows.length,
      itens: rows.reduce((a, r) => a + (r.total_items || 0), 0),
      caixas: rows.reduce((a, r) => a + (r.box_volume || 0), 0),
      fornecedores: new Set(rows.map((r) => r.other_supplier_name || r.supplier_name)).size,
    }),
    [rows],
  );

  function exportExcel() {
    const data = rows.map((r) => ({
      Data: fmtDate(r.scheduled_date),
      Hora: r.scheduled_time.slice(0, 5),
      Fornecedor: r.other_supplier_name || r.supplier_name,
      "E-mail": r.email,
      "Pedido de compra": r.purchase_order,
      Pedidos: r.orders_count,
      "Total de itens": r.total_items,
      "Volume em caixas": r.box_volume,
      Veículo: r.vehicle_type,
      Status: statusLabel(r.status),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 38 },
      { wch: 30 },
      { wch: 18 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entregas");
    XLSX.writeFile(wb, `entregas_${from}_a_${to}.xlsx`);
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
            <h1 className="truncate text-xl font-bold tracking-tight">Relatório de entregas</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Por período, com exportação em Excel
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin">Voltar ao painel</Link>
          </Button>
        </div>

        <div className="surface-card grid gap-4 p-5 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
          <div>
            <Label htmlFor="de" className="font-bold">
              De
            </Label>
            <Input
              id="de"
              type="date"
              className="mt-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ate" className="font-bold">
              Até
            </Label>
            <Input
              id="ate"
              type="date"
              className="mt-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="status" className="font-bold">
              Status
            </Label>
            <select
              id="status"
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <Button onClick={exportExcel} disabled={rows.length === 0} className="gap-2">
            <Download className="size-4" /> Baixar Excel
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Entregas", value: totals.entregas },
            { label: "Fornecedores", value: totals.fornecedores },
            { label: "Total de itens", value: totals.itens },
            { label: "Volume em caixas", value: totals.caixas },
          ].map((c) => (
            <div key={c.label} className="surface-card p-4">
              <p className="text-2xl font-bold leading-none">{c.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {c.label}
              </p>
            </div>
          ))}
        </div>

        <div className="surface-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="p-3">Data/Hora</th>
                <th className="p-3">Fornecedor</th>
                <th className="p-3">Pedido</th>
                <th className="p-3">Itens</th>
                <th className="p-3">Caixas</th>
                <th className="p-3">Veículo</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="p-3 whitespace-nowrap">
                    {fmtDate(r.scheduled_date)} · {r.scheduled_time.slice(0, 5)}
                  </td>
                  <td className="p-3">{r.other_supplier_name || r.supplier_name}</td>
                  <td className="p-3">{r.purchase_order}</td>
                  <td className="p-3">{r.total_items}</td>
                  <td className="p-3">{r.box_volume}</td>
                  <td className="p-3">{r.vehicle_type}</td>
                  <td className="p-3">{statusLabel(r.status)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    <FileSpreadsheet className="mx-auto mb-2 size-5" />
                    Nenhuma entrega no período selecionado.
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
