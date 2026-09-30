-- Current product commission rate: 13%.
-- Keep the rate in app_settings so Local/Server can use the same business rule.
UPDATE app_settings
SET value_num = 13.000
WHERE key = 'commission_rate';

INSERT INTO app_settings (key, value_num, is_public)
SELECT 'commission_rate', 13.000, false
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE key = 'commission_rate'
);
