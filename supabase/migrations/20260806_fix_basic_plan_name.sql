-- Rename only exact "Basic" plan names to "Basic Plan".
-- Safe: does not touch "Basic Plus", "basic", or other variants.

BEGIN;

-- Preview how many rows will change.
-- Expected count (checked before creating this script): 456
SELECT count(*) AS will_update
FROM public.members
WHERE deleted_at IS NULL
  AND btrim(plan_name) = 'Basic';

-- Apply update.
UPDATE public.members
SET plan_name = 'Basic Plan'
WHERE deleted_at IS NULL
  AND btrim(plan_name) = 'Basic';

-- Verify after update.
SELECT
  count(*) FILTER (WHERE btrim(plan_name) = 'Basic') AS remaining_basic,
  count(*) FILTER (WHERE btrim(plan_name) = 'Basic Plan') AS now_basic_plan
FROM public.members
WHERE deleted_at IS NULL;

COMMIT;
