-- Update Globe Pitch prices: Peak £50, Off-peak £30, Weekend £40
UPDATE slots SET price = CASE
  WHEN type = 'peak'    THEN 50
  WHEN type = 'offpeak' THEN 30
  WHEN type = 'weekend' THEN 40
END
WHERE type IN ('peak', 'offpeak', 'weekend');
