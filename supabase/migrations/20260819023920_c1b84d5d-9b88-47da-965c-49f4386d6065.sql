ALTER TABLE public.schedule_settings ADD COLUMN IF NOT EXISTS min_advance_hours integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.create_appointment(_service_type text, _date date, _time time without time zone, _email text, _supplier text, _other text, _orders integer, _purchase_order text, _items integer, _boxes integer, _vehicle text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.schedule_settings; day_count integer; slot_count integer; new_id uuid; local_now timestamp; slot_ts timestamp;
BEGIN
  SELECT * INTO s FROM public.schedule_settings LIMIT 1;
  local_now := (now() AT TIME ZONE 'America/Sao_Paulo');
  IF _date < (local_now)::date THEN RAISE EXCEPTION 'Data indisponível'; END IF;
  IF NOT s.allow_weekend AND EXTRACT(DOW FROM _date) IN (0,6) THEN
    RAISE EXCEPTION 'Não há entregas em finais de semana';
  END IF;
  IF EXTRACT(HOUR FROM _time) < s.start_hour OR EXTRACT(HOUR FROM _time) >= s.end_hour THEN
    RAISE EXCEPTION 'Horário fora da janela permitida';
  END IF;
  slot_ts := (_date + _time);
  IF slot_ts < local_now + make_interval(hours => coalesce(s.min_advance_hours,0)) THEN
    RAISE EXCEPTION 'É necessário agendar com no mínimo % hora(s) de antecedência', coalesce(s.min_advance_hours,0);
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
END; $function$;