
ALTER TABLE public.barbers 
ADD COLUMN phone text,
ADD COLUMN commission_percent numeric NOT NULL DEFAULT 50;
