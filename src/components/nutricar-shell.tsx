import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import loja from "@/assets/loja.jpg";
import logoAsset from "@/assets/nutricar-logo.png.asset.json";

export function NutricarShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Logo NUTRICAR"
              width={44}
              height={44}
              className="size-11 rounded-full bg-primary-foreground/10 object-contain p-0.5"
            />
            <span className="text-2xl font-bold tracking-[0.2em]">NUTRICAR</span>
          </Link>
        </div>
      </header>
      <div className="bg-nutri-bar text-nutri-bar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-sm">
          <Link to="/" className="opacity-80 transition-opacity hover:opacity-100">
            Início
          </Link>
          <Link to="/admin" className="opacity-80 transition-opacity hover:opacity-100">
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
        <div className="absolute inset-0 bg-background/40" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-10">{children}</div>
      </main>
      <footer className="bg-primary py-4 text-center text-xs text-primary-foreground">
        Central de Agendamentos NUTRICAR
      </footer>
    </div>
  );
}