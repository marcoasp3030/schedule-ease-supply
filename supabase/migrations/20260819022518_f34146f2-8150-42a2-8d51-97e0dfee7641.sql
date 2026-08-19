CREATE TABLE public.vehicle_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicle_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_types TO authenticated;
GRANT ALL ON public.vehicle_types TO service_role;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle types public read" ON public.vehicle_types FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "vehicle types admin all" ON public.vehicle_types FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER vehicle_types_updated_at BEFORE UPDATE ON public.vehicle_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vehicle_types (name) VALUES ('Carro'), ('Van'), ('Caminhão 3/4'), ('Caminhão Toco'), ('Caminhão Truck'), ('Moto');

CREATE TABLE public.smtp_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'NUTRICAR',
  from_email text NOT NULL DEFAULT '',
  use_tls boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT false,
  admin_recipients text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.smtp_settings TO authenticated;
GRANT ALL ON public.smtp_settings TO service_role;
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smtp admin all" ON public.smtp_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER smtp_settings_updated_at BEFORE UPDATE ON public.smtp_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.smtp_settings (id) VALUES (true);

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email templates admin all" ON public.email_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_templates (key, title, subject, body) VALUES
('confirmacao', 'Confirmação de agendamento', 'Agendamento confirmado - {{data}} {{hora}}', E'Olá {{fornecedor}},\n\nSeu agendamento de entrega foi confirmado.\n\nData: {{data}}\nHorário: {{hora}}\nPedido de compra: {{pedido}}\nVeículo: {{veiculo}}\n\nNUTRICAR'),
('cancelamento', 'Cancelamento de agendamento', 'Agendamento cancelado - {{data}} {{hora}}', E'Olá {{fornecedor}},\n\nSeu agendamento do dia {{data}} às {{hora}} foi cancelado.\n\nPedido de compra: {{pedido}}\n\nNUTRICAR'),
('conclusao', 'Entrega concluída', 'Entrega concluída - {{data}}', E'Olá {{fornecedor}},\n\nRegistramos a conclusão da sua entrega em {{data}} às {{hora}}.\n\nPedido de compra: {{pedido}}\n\nNUTRICAR');