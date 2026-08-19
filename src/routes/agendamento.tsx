import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NutricarShell } from "@/components/nutricar-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  SERVICES,
  buildSlots,
  earliestAllowed,
  slotDateTime,
  fetchAvailability,
  fetchSettings,
  fetchSuppliers,
  fetchVehicleTypes,
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
  const [cnpj, setCnpj] = useState("");
  const [cnpjStatus, setCnpjStatus] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [other, setOther] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [orders, setOrders] = useState(1);
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [items, setItems] = useState("");
  const [boxes, setBoxes] = useState("");
  const [vehicle, setVehicle] = useState("");

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const vehiclesQuery = useQuery({ queryKey: ["vehicle_types"], queryFn: fetchVehicleTypes });

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
    const lastSlot = buildSlots(settings).at(-1);
    if (lastSlot) {
      const end = slotDateTime(toISODate(day), lastSlot);
      if (end < earliestAllowed(settings)) return true;
    }
    return (dayTotals.get(toISODate(day)) ?? 0) >= settings.max_per_day;
  }

  function onlyDigits(v: string) {
    return v.replace(/\D/g, "");
  }

  function formatCnpj(v: string) {
    const d = onlyDigits(v).slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  async function handleCnpjChange(value: string) {
    const masked = formatCnpj(value);
    setCnpj(masked);
    const digits = onlyDigits(masked);
    if (digits.length < 14) {
      setCnpjStatus(null);
      return;
    }
    setCnpjLoading(true);
    setCnpjStatus(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("not found");
      const data = (await res.json()) as {
        razao_social?: string;
        nome_fantasia?: string;
      };
      const name = (data.razao_social || data.nome_fantasia || "").trim();
      if (!name) throw new Error("empty");
      const match = (suppliersQuery.data ?? []).find(
        (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (match) {
        setSupplier(match.name);
        setOther("");
      } else {
        setSupplier("OUTROS");
        setOther(name.slice(0, 200));
      }
      setRazaoSocial(name);
      setCnpjStatus(null);
    } catch {
      setRazaoSocial("");
      setCnpjStatus("CNPJ não encontrado. Verifique o número informado.");
    } finally {
      setCnpjLoading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!date || !time) return;
    if (!email || !razaoSocial || !purchaseOrder || !items || !boxes || !vehicle) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("create_appointment", {
      _service_type: service,
      _date: toISODate(date),
      _time: `${time}:00`,
      _email: email.trim(),
      _supplier: supplier,
      _other: other.trim(),
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
        <div className="mx-auto max-w-xl surface-card p-10 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full gradient-primary text-3xl text-primary-foreground">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-bold">Agendamento realizado com sucesso</h1>
          {date && time && (
            <p className="mt-2 text-sm text-muted-foreground">
              {date.toLocaleDateString("pt-BR")} às {time} — {service}
            </p>
          )}
          <Button className="mt-8" onClick={() => navigate({ to: "/" })}>
            Voltar para inicio
          </Button>
        </div>
      </NutricarShell>
    );
  }

  return (
    <NutricarShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition hover:bg-card"
        >
          ← Voltar para inicio
        </Link>

        <div className="w-full surface-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Agendamento de fornecedores</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Passo <span className="font-semibold text-primary">{step}</span> de 2
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full gradient-primary transition-all duration-500"
              style={{ width: step === 1 ? "8%" : "50%" }}
            />
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

                <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
                      <CalendarDays className="size-4 shrink-0 text-primary" />
                      <span className="text-sm font-semibold">Escolha a data da entrega</span>
                    </div>
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
                      className="pointer-events-auto w-full p-4 [--cell-size:2.6rem]"
                      classNames={{
                        root: "w-full",
                        month: "flex w-full flex-col gap-3",
                        caption_label: "text-sm font-semibold capitalize",
                        weekday:
                          "flex-1 select-none text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground",
                        day: "group/day relative aspect-square h-full w-full select-none p-0.5 text-center",
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-primary" /> Selecionado
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full border border-border bg-card" />{" "}
                        Disponível
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-muted" /> Indisponível
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 shrink-0 text-primary" />
                      <span className="text-sm font-semibold">Horários</span>
                    </div>
                    {date && settings ? (
                      <>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {date.toLocaleDateString("pt-BR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </p>
                        <div className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 lg:grid-cols-2">
                          {slots.map((slot) => {
                            const full = (takenSlots.get(slot) ?? 0) >= settings.max_per_slot;
                            const tooSoon = selectedISO
                              ? slotDateTime(selectedISO, slot) < earliestAllowed(settings)
                              : false;
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={full || tooSoon}
                                title={
                                  tooSoon
                                    ? `Necessário agendar com ${settings.min_advance_hours}h de antecedência`
                                    : undefined
                                }
                                onClick={() => setTime(slot)}
                                className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                                  time === slot
                                    ? "border-primary gradient-primary text-primary-foreground shadow"
                                    : "border-border bg-background hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent"
                                } disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-40 disabled:hover:translate-y-0`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center text-xs text-muted-foreground">
                        Escolha um dia no calendário para ver os horários disponíveis.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {date && time && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm">
                  <CalendarDays className="size-4 shrink-0 text-primary" />
                  <span>
                    Selecionado: <strong>{date.toLocaleDateString("pt-BR")}</strong> às{" "}
                    <strong>{time}</strong>
                  </span>
                </div>
              )}

              <Button className="w-full sm:w-auto" disabled={!date || !time} onClick={() => setStep(2)}>
                Seguinte
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="email" className="font-bold">
                  E-mail - Fornecedor{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  className="mt-2"
                  value={email}
                  maxLength={255}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="cnpj" className="font-bold">
                  CNPJ do fornecedor{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <Input
                  id="cnpj"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  className="mt-2 max-w-[260px]"
                  value={cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {cnpjLoading
                    ? "Buscando razão social..."
                    : (cnpjStatus ?? "Informe o CNPJ para preencher a razão social automaticamente.")}
                </p>
              </div>

              <div>
                <Label htmlFor="razao" className="font-bold">
                  Fornecedores - Empresa a qual representa
                </Label>
                <Input
                  id="razao"
                  readOnly
                  className="mt-2 bg-muted/60"
                  placeholder="Preenchido automaticamente pelo CNPJ"
                  value={razaoSocial}
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

              <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/80">
                Informar Pedido de Compras NUTRICAR (5 dígitos). Para agendar mais de um pedido por
                carro, selecionar acima a quantidade de pedidos. Caso queira agendar mais de 1
                veículo, realizar nova solicitação. Informar apenas os números. Horário para
                solicitações de agendamento é das {settings?.start_hour ?? 8}h as{" "}
                {settings?.end_hour ?? 17}h. !!! Importante !!! É obrigatório conter o número do(s)
                pedido(s), no campo XPED e/ou Observação da NF
              </p>

              <div>
                <Label htmlFor="po" className="font-bold">
                  Pedido de Compra{" "}
                  <span className="italic font-normal text-destructive">(obrigatório)</span>
                </Label>
                <Input
                  id="po"
                  className="mt-2 max-w-[200px]"
                  inputMode="numeric"
                  value={purchaseOrder}
                  maxLength={20}
                  onChange={(e) => setPurchaseOrder(onlyDigits(e.target.value))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="items" className="font-bold">
                    Total de Itens{" "}
                    <span className="italic font-normal text-destructive">(obrigatório)</span>
                  </Label>
                  <Input
                    id="items"
                    inputMode="numeric"
                    className="mt-2"
                    value={items}
                    maxLength={6}
                    onChange={(e) => setItems(onlyDigits(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="boxes" className="font-bold">
                    Volume em Caixas{" "}
                    <span className="italic font-normal text-destructive">(obrigatório)</span>
                  </Label>
                  <Input
                    id="boxes"
                    inputMode="numeric"
                    className="mt-2"
                    value={boxes}
                    maxLength={6}
                    onChange={(e) => setBoxes(onlyDigits(e.target.value))}
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
                  {(vehiclesQuery.data ?? []).map((v) => (
                    <option key={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                  Voltar
                </Button>
                <Button onClick={submit} disabled={saving}>
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