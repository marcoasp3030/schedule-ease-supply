import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  SERVICES,
  VEHICLES,
  buildSlots,
  fetchAvailability,
  fetchSettings,
  fetchSuppliers,
  normalizeTime,
  toISODate,
} from "@/lib/agendamento";

export const Route = createFileRoute("/agendamento")({
  head: () => ({
    meta: [
      { title: "Agendamento de fornecedores | NUTRICAR" },
      {
        name: "description",
        content:
          "Selecione data e horário disponíveis e informe os dados do pedido para agendar a entrega na NUTRICAR.",
      },
      { property: "og:title", content: "Agendamento de fornecedores | NUTRICAR" },
      {
        property: "og:description",
        content: "Escolha data, horário e informe os dados da entrega.",
      },
    ],
  }),
  component: Agendamento,
});

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Agendamento() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [service, setService] = useState(SERVICES[0]!);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [supplier, setSupplier] = useState("");
  const [other, setOther] = useState("");
  const [orders, setOrders] = useState(1);
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [items, setItems] = useState("");
  const [boxes, setBoxes] = useState("");
  const [vehicle, setVehicle] = useState("");

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });

  const range = useMemo(() => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return { from: toISODate(from), to: toISODate(to) };
  }, [month]);

  const availabilityQuery = useQuery({
    queryKey: ["availability", range.from, range.to],
    queryFn: () => fetchAvailability(range.from, range.to),
  });

  const settings = settingsQuery.data;
  const availability = availabilityQuery.data ?? [];

  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of availability) {
      map.set(row.scheduled_date, (map.get(row.scheduled_date) ?? 0) + Number(row.total));
    }
    return map;
  }, [availability]);

  const slots = settings ? buildSlots(settings) : [];
  const selectedISO = date ? toISODate(date) : null;

  const takenSlots = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedISO) return map;
    for (const row of availability) {
      if (row.scheduled_date === selectedISO) {
        map.set(normalizeTime(row.scheduled_time), Number(row.total));
      }
    }
    return map;
  }, [availability, selectedISO]);

  function isDayDisabled(day: Date) {
    if (!settings) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return true;
    const dow = day.getDay();
    if (!settings.allow_weekend && (dow === 0 || dow === 6)) return true;
    return (dayTotals.get(toISODate(day)) ?? 0) >= settings.max_per_day;
  }

  async function submit() {
    setError(null);
    if (!date || !time) return;
    if (!email || !supplier || !purchaseOrder || !items || !boxes || !vehicle) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (supplier === "OUTROS" && !other.trim()) {
      setError("Informe o nome da empresa no campo OUTROS.");
      return;
    }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("create_appointment", {
      _service_type: service,
      _date: toISODate(date),
      _time: `${time}:00`,
      _email: email.trim(),
      _supplier: supplier,
      _other: other.trim() || null,
      _orders: orders,
      _purchase_order: purchaseOrder.trim(),
      _items: Number(items),
      _boxes: Number(boxes),
      _vehicle: vehicle,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message.replace(/^.*?:\s*/, ""));
      return;
    }
    setStep(3);
  }

  if (step === 3) {
    return (
      <NutricarShell>
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <div className="bg-card/90 px-6 py-5 shadow-lg">
            <h1 className="text-2xl font-bold">Agendamento realizado com sucesso</h1>
            {date && time && (
              <p className="mt-2 text-sm text-muted-foreground">
                {date.toLocaleDateString("pt-BR")} às {time} — {service}
              </p>
            )}
          </div>
          <Button onClick={() => navigate({ to: "/" })}>Voltar para inicio</Button>
        </div>
      </NutricarShell>
    );
  }

  return (
    <NutricarShell>
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voltar para inicio
        </Link>

        <div className="w-full max-w-xl bg-card/95 p-6 shadow-xl">
          <h1 className="text-xl text-muted-foreground">Agendamento de fornecedores</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Passo <span className="text-primary">{step}</span> de 2
          </p>
          <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="flex h-full items-center justify-center bg-primary text-[10px] text-primary-foreground transition-all"
              style={{ width: step === 1 ? "8%" : "50%" }}
            >
              {step === 1 ? "" : "50%"}
            </div>
          </div>

          {step === 1 ? (
            <div className="mt-5 space-y-4">
              <div>
                <Label className="font-bold">Selecione o tipo de serviço abaixo</Label>
                <select
                  className={`${fieldClass} mt-2`}
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  {SERVICES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="font-bold">
                  Selecione uma data e horário disponível{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <div className="mt-2 rounded-md border border-border bg-background">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    month={month}
                    onMonthChange={setMonth}
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setTime(null);
                    }}
                    disabled={isDayDisabled}
                    className="pointer-events-auto p-3"
                  />
                  {date && settings && (
                    <div className="border-t border-border bg-muted/40 p-3">
                      <p className="text-center text-sm">
                        {date.toLocaleDateString("pt-BR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {slots.map((slot) => {
                          const full = (takenSlots.get(slot) ?? 0) >= settings.max_per_slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={full}
                              onClick={() => setTime(slot)}
                              className={`rounded-md border px-2 py-2 text-sm transition-colors ${
                                time === slot
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background hover:bg-accent"
                              } disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                disabled={!date || !time}
                onClick={() => setStep(2)}
              >
                Seguinte
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <Label className="font-bold">
                  E-mail - Fornecedor{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <Input
                  type="email"
                  className="mt-2"
                  value={email}
                  maxLength={255}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Label className="font-bold">
                  Fornecedores - Escolha abaixo a empresa a qual representa{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <select
                  className={`${fieldClass} mt-2`}
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">Selecione o nome da empresa</option>
                  {(suppliersQuery.data ?? []).map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="font-bold uppercase">Opção outros informar nome abaixo.</Label>
                <Input
                  className="mt-2"
                  value={other}
                  maxLength={200}
                  onChange={(e) => setOther(e.target.value)}
                />
              </div>

              <div>
                <Label className="font-bold">
                  Selecione a quantidade de pedidos para ser agendado{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <div className="mt-2 space-y-1">
                  {[1, 2, 3, 4].map((n) => (
                    <label key={n} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="orders"
                        checked={orders === n}
                        onChange={() => setOrders(n)}
                      />
                      {n}
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-sm text-primary">
                Informar Pedido de Compras NUTRICAR (5 dígitos). Para agendar mais de um pedido por
                carro, selecionar acima a quantidade de pedidos. Caso queira agendar mais de 1
                veículo, realizar nova solicitação. Informar apenas os números. Horário para
                solicitações de agendamento é das {settings?.start_hour ?? 8}h as{" "}
                {settings?.end_hour ?? 17}h. !!! Importante !!! É obrigatório conter o número do(s)
                pedido(s), no campo XPED e/ou Observação da NF
              </p>

              <div>
                <Label className="font-bold">
                  Pedido de Compra{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <Input
                  className="mt-2 max-w-[200px]"
                  value={purchaseOrder}
                  maxLength={100}
                  onChange={(e) => setPurchaseOrder(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="font-bold">
                    Total de Itens{" "}
                    <span className="italic font-normal text-destructive">(obrigatório)</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    className="mt-2"
                    value={items}
                    onChange={(e) => setItems(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="font-bold">
                    Volume em Caixas{" "}
                    <span className="italic font-normal text-destructive">(obrigatório)</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    className="mt-2"
                    value={boxes}
                    onChange={(e) => setBoxes(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="font-bold">
                  Tipo de Veículo{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <select
                  className={`${fieldClass} mt-2`}
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                >
                  <option value="">Selecione o tipo de veículo</option>
                  {VEHICLES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                  Voltar
                </Button>
                <Button variant="outline" onClick={submit} disabled={saving}>
                  {saving ? "Enviando..." : "Clique aqui para confirmar o agendamento"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </NutricarShell>
  );
}