-- Pricing copy was written before Image Generation, Video Generation, AI
-- Voiceover, and Niche Finder existed as product surfaces, and bundled the
-- three generation tools behind a vague "AI Media Studio" line that named
-- none of them. It also advertised "Viral AI Agents", "AI Exports", and
-- "Connected Channels" -- none of which correspond to anything in the
-- product (grepped across src/, no match outside this copy). This brings
-- `features` up to date with the real tool suite (see TOOLS in
-- src/app/app/(protected)/tools/page.tsx and TOOL_CREDIT_COSTS in
-- src/lib/config/pricing.ts), and lists Verlab MCP on every plan rather
-- than Scale-only -- MCP access isn't actually gated by plan anywhere in
-- the backend (no plan checks in src/lib/server/mcp/tools.ts), so the old
-- Scale-exclusive copy misrepresented what Core/Pro users already get.
-- Deliberately does NOT touch price_monthly/price_yearly/name/info/cta --
-- those reflect live Whop billing and admin-made copy edits that may have
-- drifted from earlier seed migrations, and this migration has no way to
-- know the current values are still correct, so it only ever touches
-- `features`. The credit figures below (1,250/2,600/5,900) match
-- SUBSCRIPTION_PLANS.monthlyCreditsPerPeriod in src/lib/config/whop.ts (the
-- real monthly grant) and plan_definitions.credits_per_period as seeded by
-- 20260728120000_polar_billing.sql -- the older "1,000/3,000/7,000" copy
-- this replaces never matched what Whop actually grants on renewal.
-- Niche Finder is now Pro/Scale only (dropped from Core's list below) --
-- matches the real server-side gate added in requireNicheFinderAccess
-- (src/lib/server/subscription.ts), applied to the /niches page and its
-- API routes, not just this copy.
update public.plan_definitions set
  features = '[
    {"text":"1,250 Credits (Across every AI tool)"},
    {"text":"20 Niche Bends (Per month)"},
    {"text":"AI Script Writer (Generate & edit scripts)"},
    {"text":"AI Image Generator (Thumbnails & cover art)"},
    {"text":"AI Video Generator (Veo 3, Kling 3.0, Seedance 2 & more)"},
    {"text":"AI Voiceover (Natural, multi-voice narration)"},
    {"text":"Unlimited Transcripts & Downloads (TikTok, Reels, Shorts & YouTube)"},
    {"text":"Verlab MCP (Connect Claude & ChatGPT to your account)"}
  ]'::jsonb
where id = 'core';

update public.plan_definitions set
  features = '[
    {"text":"2,600 Credits (Across every AI tool)"},
    {"text":"Unlimited Niche Bends (No monthly cap)"},
    {"text":"Niche Finder (Spot trending niches early)"},
    {"text":"AI Script Writer (Generate & edit scripts)"},
    {"text":"AI Image Generator (Thumbnails & cover art)"},
    {"text":"AI Video Generator (Veo 3, Kling 3.0, Seedance 2 & more)"},
    {"text":"AI Voiceover (Natural, multi-voice narration)"},
    {"text":"Unlimited Transcripts & Downloads (TikTok, Reels, Shorts & YouTube)"},
    {"text":"Creator & Channel Analysis (Any channel, real transcripts)"},
    {"text":"Verlab MCP (Connect Claude & ChatGPT to your account)"}
  ]'::jsonb
where id = 'pro';

update public.plan_definitions set
  features = '[
    {"text":"5,900 Credits (Across every AI tool)"},
    {"text":"Unlimited Niche Bends (No monthly cap)"},
    {"text":"Niche Finder (Spot trending niches early)"},
    {"text":"AI Script Writer (Generate & edit scripts)"},
    {"text":"AI Image Generator (Thumbnails & cover art)"},
    {"text":"AI Video Generator (Every model, including Sora 2 & Seedance 2.5)"},
    {"text":"AI Voiceover (Natural, multi-voice narration)"},
    {"text":"Unlimited Transcripts & Downloads (TikTok, Reels, Shorts & YouTube)"},
    {"text":"Creator & Channel Analysis (Any channel, real transcripts)"},
    {"text":"Verlab MCP (Connect Claude & ChatGPT to your account)"}
  ]'::jsonb
where id = 'scale';
