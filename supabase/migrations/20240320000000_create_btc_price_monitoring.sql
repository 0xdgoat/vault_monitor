-- Drop existing table if it exists
DROP TABLE IF EXISTS public.btc_price_monitoring;

-- Create btc_price_monitoring table with new structure
CREATE TABLE public.btc_price_monitoring (
    id SERIAL PRIMARY KEY,
    btc_price DECIMAL NOT NULL,
    ubtc_price DECIMAL NOT NULL,
    price_difference_percent DECIMAL NOT NULL,
    btc_liquidity DECIMAL,
    ubtc_liquidity DECIMAL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX idx_btc_price_monitoring_timestamp ON public.btc_price_monitoring(timestamp);
CREATE INDEX idx_btc_price_monitoring_price_diff ON public.btc_price_monitoring(price_difference_percent);

-- Add RLS policies
ALTER TABLE public.btc_price_monitoring ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users" ON public.btc_price_monitoring
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow insert access to service role
CREATE POLICY "Allow insert access to service role" ON public.btc_price_monitoring
    FOR INSERT
    TO service_role
    WITH CHECK (true); 