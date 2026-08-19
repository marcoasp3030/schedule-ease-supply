import { supabase } from "@/integrations/supabase/client";

export type Settings = {
  max_per_day: number;
  allow_weekend: boolean;
  start_hour: number;
  end_hour: number;
  slot_minutes: number;
  max_per_slot: number;
  min_advance_hours: number;
};

export type Availability = {
  scheduled_date: string;
  scheduled_time: string;
  total: number;
};

export async function fetchVehicleTypes() {
  const { data, error } = await supabase
    .from("vehicle_types")
    .select("id, name, active")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

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
    .select(
      "max_per_day, allow_weekend, start_hour, end_hour, slot_minutes, max_per_slot, min_advance_hours",
    )
    .maybeSingle();
  if (error) throw error;
  return data as Settings;
}

/** Instante mínimo permitido, considerando a antecedência exigida. */
export function earliestAllowed(s: Settings) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + (s.min_advance_hours ?? 0) * 60);
  return d;
}

export function slotDateTime(isoDate: string, slot: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = slot.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d, hh, mm, 0, 0);
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