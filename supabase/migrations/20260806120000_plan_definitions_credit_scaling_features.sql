-- Updates pricing copy to a flat, scaling-quantity feature list, mirroring a
-- competitor's pricing page layout (bold amount + a parenthetical descriptor
-- per row). Plan names (Core/Pro/Scale) and ids are left untouched.
--
-- Core's price_monthly/price_yearly are updated for real here because the
-- underlying Whop plans were actually repriced to $17/mo + $153/yr (see
-- src/lib/config/whop.ts and .env.local) as part of enabling yearly billing
-- for Core. Pro/Scale's price columns are deliberately NOT touched by this
-- migration -- their Whop plans are still $39/mo and $89/mo, so changing
-- price_monthly/price_yearly here without also repricing Whop would make
-- this page quote a price different from what checkout actually charges.
update public.plan_definitions set
  info = 'Everything you need to get started finding winning videos.',
  price_monthly = 17,
  price_yearly = 17 * 9,
  monthly_only = false,
  cta = 'Start Core',
  features = '[
    {"text":"1,000 Credits (AI Tools)"},
    {"text":"20 Niche Bends (Per month)"},
    {"text":"Unlimited Transcripts (TikTok, Reels & Shorts)"},
    {"text":"5 Study Niches (Saved for reference)"},
    {"text":"100 Saved Videos (Your library)"},
    {"text":"1 Connected Channel (Your own audit)"}
  ]'::jsonb
where id = 'core';

update public.plan_definitions set
  info = 'The most popular plan if you''re serious about bending and scaling.',
  cta = 'Start Pro',
  features = '[
    {"text":"3,000 Credits (AI Tools)"},
    {"text":"Unlimited Niche Bends (No monthly cap)"},
    {"text":"Unlimited Transcripts (TikTok, Reels & Shorts)"},
    {"text":"15 Study Niches (Saved for reference)"},
    {"text":"Unlimited Saved Videos (Your library)"},
    {"text":"2 Connected Channels (Your own audit)"},
    {"text":"Viral AI Agents (Hooks, structure & pacing)"},
    {"text":"AI Exports (TXT, PDF & XML)"}
  ]'::jsonb
where id = 'pro';

update public.plan_definitions set
  info = 'The biggest plan to maximize your potential at scale.',
  cta = 'Start Scale',
  features = '[
    {"text":"7,000 Credits (AI Tools)"},
    {"text":"Unlimited Niche Bends (No monthly cap)"},
    {"text":"Unlimited Transcripts (TikTok, Reels & Shorts)"},
    {"text":"Unlimited Study Niches (Saved for reference)"},
    {"text":"Unlimited Saved Videos (Your library)"},
    {"text":"5 Connected Channels (Your own audit)"},
    {"text":"Viral AI Agents (Hooks, structure & pacing)"},
    {"text":"AI Exports (TXT, PDF & XML)"},
    {"text":"API Access (Build on Clypa)"},
    {"text":"MCP Connect (Claude & ChatGPT)"}
  ]'::jsonb
where id = 'scale';
