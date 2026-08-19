CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.schedule_settings (
  id boolean PRIMARY KEY DEFAULT true,
  max_per_day integer NOT NULL DEFAULT 10,
  allow_weekend boolean NOT NULL DEFAULT false,
  start_hour integer NOT NULL DEFAULT 8,
  end_hour integer NOT NULL DEFAULT 17,
  slot_minutes integer NOT NULL DEFAULT 60,
  max_per_slot integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id),
  CONSTRAINT valid_hours CHECK (start_hour >= 0 AND end_hour <= 23 AND end_hour > start_hour),
  CONSTRAINT valid_slot CHECK (slot_minutes IN (30,60))
);
GRANT SELECT ON public.schedule_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.schedule_settings TO authenticated;
GRANT ALL ON public.schedule_settings TO service_role;
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.schedule_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings admin write" ON public.schedule_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.schedule_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.schedule_settings (id) VALUES (true);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.suppliers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers public read" ON public.suppliers FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "suppliers admin all" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.suppliers (name) VALUES
 ('A F DAS NEVES RODRIGUES // A F DAS NEVES RODRIGUES'),
 ('AMBEV S.A.'),
 ('COCA-COLA ANDINA BRASIL'),
 ('NESTLE BRASIL LTDA'),
 ('UNILEVER BRASIL LTDA'),
 ('M DIAS BRANCO S.A.'),
 ('BRF S.A.'),
 ('OUTROS');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  email text NOT NULL,
  supplier_name text NOT NULL,
  other_supplier_name text,
  orders_count integer NOT NULL,
  purchase_order text NOT NULL,
  total_items integer NOT NULL,
  box_volume integer NOT NULL,
  vehicle_type text NOT NULL,
  status text NOT NULL DEFAULT 'confirmado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_range CHECK (orders_count BETWEEN 1 AND 4),
  CONSTRAINT positive_amounts CHECK (total_items > 0 AND box_volume > 0),
  CONSTRAINT email_len CHECK (char_length(email) BETWEEN 5 AND 255),
  CONSTRAINT status_valid CHECK (status IN ('confirmado','cancelado'))
);
CREATE INDEX appointments_date_idx ON public.appointments (scheduled_date);
GRANT SELECT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments admin all" ON public.appointments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.day_availability(_from date, _to date)
RETURNS TABLE (scheduled_date date, scheduled_time time, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.scheduled_date, a.scheduled_time, count(*)
  FROM public.appointments a
  WHERE a.status = 'confirmado' AND a.scheduled_date BETWEEN _from AND _to
  GROUP BY 1,2;
$$;
GRANT EXECUTE ON FUNCTION public.day_availability(date, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_appointment(
  _service_type text, _date date, _time time, _email text, _supplier text,
  _other text, _orders integer, _purchase_order text, _items integer,
  _boxes integer, _vehicle text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.schedule_settings; day_count integer; slot_count integer; new_id uuid;
BEGIN
  SELECT * INTO s FROM public.schedule_settings LIMIT 1;
  IF _date < current_date THEN RAISE EXCEPTION 'Data indisponível'; END IF;
  IF NOT s.allow_weekend AND EXTRACT(DOW FROM _date) IN (0,6) THEN
    RAISE EXCEPTION 'Não há entregas em finais de semana';
  END IF;
  IF EXTRACT(HOUR FROM _time) < s.start_hour OR EXTRACT(HOUR FROM _time) >= s.end_hour THEN
    RAISE EXCEPTION 'Horário fora da janela permitida';
  END IF;
  SELECT count(*) INTO day_count FROM public.appointments
    WHERE scheduled_date = _date AND status = 'confirmado';
  IF day_count >= s.max_per_day THEN RAISE EXCEPTION 'Limite de agendamentos do dia atingido'; END IF;
  SELECT count(*) INTO slot_count FROM public.appointments
    WHERE scheduled_date = _date AND scheduled_time = _time AND status = 'confirmado';
  IF slot_count >= s.max_per_slot THEN RAISE EXCEPTION 'Horário já reservado'; END IF;
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido'; END IF;

  INSERT INTO public.appointments (service_type, scheduled_date, scheduled_time, email,
    supplier_name, other_supplier_name, orders_count, purchase_order, total_items, box_volume, vehicle_type)
  VALUES (left(_service_type,100), _date, _time, left(_email,255), left(_supplier,200),
    nullif(left(coalesce(_other,''),200),''), _orders, left(_purchase_order,100), _items, _boxes, left(_vehicle,60))
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_appointment(text,date,time,text,text,text,integer,text,integer,integer,text) TO anon, authenticated;