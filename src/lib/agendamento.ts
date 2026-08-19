import { supabase } from "@/integrations/supabase/client";

export type Settings = {
  max_per_day: number;
  allow_weekend: boolean;
  start_hour: number;
  end_hour: number;
  slot_minutes: number;
  max_per_slot: number;
};

export type Availability = {
  scheduled_date: string;
  scheduled_time: string;
  total: number;
};

export const VEHICLES = [
  "Utilitário",
  "VUC",
  "Toco",
  "Truck",
  "Carreta",
  "Van",
  "Moto",
];

export const SERVICES = ["Entrega de Mercadoria", "Coleta / Devolução"];

export function toISODate(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function buildSlots(s: Settings) {
  const slots: string[] = [];
  for (let min = s.start_hour * 60; min < s.end_hour * 60; min += s.slot_minutes) {
    const h = `${Math.floor(min / 60)}`.padStart(2, "0");
    const mm = `${min % 60}`.padStart(2, "0");
    slots.push(`${h}:${mm}`);
  }
  return slots;
}

export function normalizeTime(t: string) {
  return t.slice(0, 5);
}

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from("schedule_settings")
    .select("max_per_day, allow_weekend, start_hour, end_hour, slot_minutes, max_per_slot")
    .maybeSingle();
  if (error) throw error;
  return data as Settings;
}

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchAvailability(from: string, to: string): Promise<Availability[]> {
  const { data, error } = await supabase.rpc("day_availability", { _from: from, _to: to });
  if (error) throw error;
  return (data ?? []) as Availability[];
}