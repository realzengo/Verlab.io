-- Core reprice ($19/mo -> $25/mo, yearly billed at the $19/mo-equivalent
-- rate -- $19 * 12 = $228/yr, replacing the old $204/yr = $17 * 12 rate that
-- was left over from the since-reverted Aug 6 $17 experiment) and Niche
-- Finder unlocked for Core -- it's no longer Pro/Scale-only, matching the
-- gate removal in hasNicheFinderAccess (src/lib/server/subscription.ts).
-- The matching Whop plan prices (WHOP_PLAN_CORE_MONTHLY / _YEARLY) were
-- updated via the Whop API in the same change -- see plans.update calls,
-- no new plan IDs needed since plan_definitions showed 0 active Core
-- subscribers at the time of this migration.
update public.plan_definitions set
  price_monthly = 25,
  price_yearly = 19 * 12,
  features = '[
    {"text":"1,250 Credits (Across every AI tool)"},
    {"text":"20 Niche Bends (Per month)"},
    {"text":"Niche Finder (Spot trending niches early)"},
    {"text":"AI Script Writer (Generate & edit scripts)"},
    {"text":"AI Image Generator (Thumbnails & cover art)"},
    {"text":"AI Video Generator (Veo 3, Kling 3.0, Seedance 2 & more)"},
    {"text":"AI Voiceover (Natural, multi-voice narration)"},
    {"text":"Unlimited Transcripts & Downloads (TikTok, Reels, Shorts & YouTube)"},
    {"text":"Verlab MCP (Connect Claude & ChatGPT to your account)"}
  ]'::jsonb
where id = 'core';
