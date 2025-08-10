-- Update display names to remove PII and add three finance-themed candidates with anonymized display_name
DO $$
DECLARE
  v_candidate_id uuid;
  v_skill_id uuid;
BEGIN
  -- Anonymize display names for existing candidates
  UPDATE public.candidates
  SET display_name = 'Equity Research Analyst (CFA)'
  WHERE name = 'John Smith';

  UPDATE public.candidates
  SET display_name = 'Corporate Accountant (CPA)'
  WHERE name = 'Sara Johnson';

  -- Candidate 1: Portfolio Manager - Emerging Markets
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE email = 'candidate_pm_em@example.com') THEN
    INSERT INTO public.candidates (
      name, display_name, email, location, experience, education, highest_education_level, label, profile_description, open_to_opportunities
    ) VALUES (
      'Priya Desai',
      'Portfolio Manager - Emerging Markets',
      'candidate_pm_em@example.com',
      'New York, NY',
      8,
      'MBA, Finance',
      'Masters',
      'Portfolio Manager',
      'PM focusing on EM equities and FX, with consistent alpha generation and disciplined risk controls.',
      true
    ) RETURNING id INTO v_candidate_id;

    -- Skill: Portfolio Management
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Portfolio Management' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Portfolio Management') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Equity Research
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Equity Research' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Equity Research') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Bloomberg
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Bloomberg' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Bloomberg') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Risk Management
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Risk Management' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Risk Management') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;
  END IF;

  -- Candidate 2: Credit Risk Analyst - Corporate Banking
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE email = 'candidate_credit_risk@example.com') THEN
    INSERT INTO public.candidates (
      name, display_name, email, location, experience, education, highest_education_level, label, profile_description, open_to_opportunities
    ) VALUES (
      'Miguel Alvarez',
      'Credit Risk Analyst - Corporate Banking',
      'candidate_credit_risk@example.com',
      'Chicago, IL',
      5,
      'B.S. in Finance',
      'Bachelors',
      'Credit Risk Analyst',
      'Corporate credit risk analyst specializing in middle-market portfolios, PD/LGD modeling, and regulatory reporting.',
      true
    ) RETURNING id INTO v_candidate_id;

    -- Skill: Credit Risk
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Credit Risk' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Credit Risk') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: SQL
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'SQL' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('SQL') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Regulatory Compliance
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Regulatory Compliance' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Regulatory Compliance') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Excel
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Excel' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Excel') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;
  END IF;

  -- Candidate 3: Quantitative Analyst - Derivatives
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE email = 'candidate_quant_derivatives@example.com') THEN
    INSERT INTO public.candidates (
      name, display_name, email, location, experience, education, highest_education_level, label, profile_description, open_to_opportunities
    ) VALUES (
      'Emily Chen',
      'Quantitative Analyst - Derivatives',
      'candidate_quant_derivatives@example.com',
      'San Francisco, CA',
      6,
      'M.S. in Financial Engineering',
      'Masters',
      'Quantitative Analyst',
      'Quant researcher building derivatives pricing models and time-series strategies; strong Python, statistics, and data engineering skills.',
      true
    ) RETURNING id INTO v_candidate_id;

    -- Skill: Python
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Python' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Python') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Options Pricing
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Options Pricing' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Options Pricing') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Time Series Analysis
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Time Series Analysis' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Time Series Analysis') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;

    -- Skill: Statistics
    SELECT id INTO v_skill_id FROM public.skills WHERE skill = 'Statistics' LIMIT 1;
    IF v_skill_id IS NULL THEN
      INSERT INTO public.skills (skill) VALUES ('Statistics') RETURNING id INTO v_skill_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_id = v_candidate_id AND skill_id = v_skill_id) THEN
      INSERT INTO public.candidate_skills (candidate_id, skill_id) VALUES (v_candidate_id, v_skill_id);
    END IF;
  END IF;
END $$;