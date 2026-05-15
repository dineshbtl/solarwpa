-- Atomic ID counters + lookup indexes for warehouse/installations flows

CREATE TABLE IF NOT EXISTS public.id_counters (
  key TEXT PRIMARY KEY,
  current_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.next_prefixed_id(
  p_key TEXT,
  p_prefix TEXT,
  p_width INT DEFAULT 3
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_value BIGINT;
BEGIN
  INSERT INTO public.id_counters AS c (key, current_value, updated_at)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET current_value = c.current_value + 1,
        updated_at = now()
  RETURNING current_value INTO next_value;

  RETURN p_prefix || lpad(next_value::TEXT, p_width, '0');
END;
$$;

CREATE INDEX IF NOT EXISTS idx_house_material_delivery_lookup_ci
  ON public.house_material_delivery (to_household_id, lower(material_name), status);

