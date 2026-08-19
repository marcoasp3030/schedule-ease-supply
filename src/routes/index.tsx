import { createFileRoute, Link } from "@tanstack/react-router";
import { NutricarShell } from "@/components/nutricar-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central de Agendamentos NUTRICAR" },
      {
        name: "description",
        content:
          "Agende a entrega de mercadorias na NUTRICAR: escolha data, horário e informe os dados do pedido em poucos passos.",
      },
      { property: "og:title", content: "Central de Agendamentos NUTRICAR" },
      {
        property: "og:description",
        content: "Agendamento de recebimento para fornecedores NUTRICAR.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <NutricarShell>
      <div className="mx-auto max-w-3xl surface-card p-8 text-center sm:p-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
          Fornecedores NUTRICAR
        </span>
        <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Bem Vindo a Central de Agendamentos NUTRICAR
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Para seguir com sua solicitação clique no botão abaixo.
        </p>
        <Link
          to="/agendamento"
          className="mt-8 inline-flex items-center justify-center rounded-xl gradient-primary px-8 py-4 text-base font-semibold text-primary-foreground transition hover:brightness-110 hover:-translate-y-0.5"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          Clique aqui para iniciar o agendamento
        </Link>
        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          {[
            { t: "1. Data e horário", d: "Escolha um dia e um horário disponível na agenda." },
            { t: "2. Dados do pedido", d: "Informe empresa, pedido de compra, itens e veículo." },
            { t: "3. Confirmação", d: "Receba a confirmação do agendamento na hora." },
          ].map((s) => (
            <div key={s.t} className="rounded-xl border border-border/70 bg-secondary/50 p-4">
              <p className="text-sm font-semibold text-foreground">{s.t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </NutricarShell>
  );
}
