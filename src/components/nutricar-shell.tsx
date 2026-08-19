import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import loja from "@/assets/loja.jpg";
import logoAsset from "@/assets/nutricar-logo.png.asset.json";

export function NutricarShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="gradient-primary text-primary-foreground shadow-lg">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Logo NUTRICAR"
              width={44}
              height={44}
              className="size-12 shrink-0 rounded-full bg-primary-foreground/15 object-contain p-0.5 ring-1 ring-primary-foreground/25"
            />
            <span className="min-w-0">
              <span className="block truncate text-2xl font-bold tracking-[0.22em]">NUTRICAR</span>
              <span className="block text-[11px] uppercase tracking-[0.28em] opacity-80">
                Central de agendamentos
              </span>
            </span>
          </Link>
        </div>
      </header>
      <div className="bg-nutri-bar text-nutri-bar-foreground" style={{ backgroundImage: "var(--gradient-bar)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-[0.14em]">
          <Link to="/" className="rounded-full px-3 py-1 opacity-80 transition hover:bg-primary-foreground/10 hover:opacity-100">
            Início
          </Link>
          <Link to="/admin" className="rounded-full px-3 py-1 opacity-80 transition hover:bg-primary-foreground/10 hover:opacity-100">
            Área restrita
          </Link>
        </div>
      </div>
      <main className="relative flex-1">
        <img
          src={loja}
          alt="Interior da loja NUTRICAR"
          width={1920}
          height={1088}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/90" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">{children}</div>
      </main>
      <footer className="gradient-primary py-5 text-center text-xs tracking-[0.18em] uppercase text-primary-foreground">
        Central de Agendamentos NUTRICAR
      </footer>
    </div>
  );
}