-- Website leads always default to Adra (AP01).

CREATE OR REPLACE FUNCTION public.website_create_visitor(
  p_gym_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_intake_source text,
  p_notes text DEFAULT NULL,
  p_interest_plan text DEFAULT NULL,
  p_goal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_source text;
  v_branch uuid;
  v_external text;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Name required');
  END IF;
  IF p_mobile IS NULL OR length(trim(p_mobile)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mobile required');
  END IF;

  v_source := COALESCE(NULLIF(trim(p_intake_source), ''), 'website');
  IF v_source NOT IN ('website', 'website_trial', 'website_contact', 'website_newsletter') THEN
    v_source := 'website';
  END IF;

  -- Default branch: Adra (AP01)
  SELECT gc.id INTO v_branch
  FROM gym_codes gc
  WHERE gc.gym_id = p_gym_id
    AND upper(gc.code) = 'AP01'
  LIMIT 1;

  -- Fallback only if AP01 is missing for this gym
  IF v_branch IS NULL THEN
    SELECT gc.id INTO v_branch
    FROM gym_codes gc
    WHERE gc.gym_id = p_gym_id
    ORDER BY
      CASE upper(gc.code)
        WHEN 'HQ' THEN 0
        ELSE 1
      END,
      gc.code
    LIMIT 1;
  END IF;

  v_external := 'W-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO visitors (
    gym_id, external_visitor_id, full_name, email, mobile, status, intake_source,
    notes, interest_plan, goal, assigned_gym_code_id,
    added_at, created_at, updated_at, call_back_required
  ) VALUES (
    p_gym_id,
    v_external,
    trim(p_full_name),
    COALESCE(trim(p_email), ''),
    trim(p_mobile),
    'New',
    v_source,
    p_notes,
    p_interest_plan,
    p_goal,
    v_branch,
    now(),
    now(),
    now(),
    true
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'external_visitor_id', v_external,
    'assigned_gym_code_id', v_branch
  );
END;
$$;

-- Move any website leads not already on AP01 onto Adra.
UPDATE visitors v
SET assigned_gym_code_id = gc.id,
    updated_at = now()
FROM gym_codes gc
WHERE v.gym_id = gc.gym_id
  AND upper(gc.code) = 'AP01'
  AND v.intake_source LIKE 'website%'
  AND (
    v.assigned_gym_code_id IS NULL
    OR v.assigned_gym_code_id IS DISTINCT FROM gc.id
  );
