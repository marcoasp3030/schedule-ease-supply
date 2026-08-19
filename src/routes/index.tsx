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
      <div className="mx-auto max-w-2xl bg-card/85 p-10 text-center shadow-lg backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Bem Vindo a Central de Agendamentos NUTRICAR
        </h1>
        <p className="mt-2 text-lg text-foreground">
          Para seguir com sua solicitação clique no botão abaixo.
        </p>
        <Link
          to="/agendamento"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Clique aqui para iniciar o agendamento
        </Link>
      </div>
    </NutricarShell>
  );
}
