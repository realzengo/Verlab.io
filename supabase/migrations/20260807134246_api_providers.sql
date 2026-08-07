create table public.api_providers (
  id text primary key,
  name text not null,
  category text not null,
  env_var text,
  website_url text,
  notes text,
  monthly_cost numeric not null default 0,
  currency text not null default 'usd',
  is_active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.api_providers enable row level security;
-- Service-role only (no RLS grants): admin reads/writes go through
-- /api/admin/api-providers. monthly_cost is an admin-entered budget figure,
-- not a live pull from any provider's billing API.

create trigger api_providers_set_updated_at
  before update on public.api_providers
  for each row
  execute function public.set_updated_at();

insert into public.api_providers (id, name, category, env_var, website_url, notes, sort_order) values
  ('anthropic', 'Anthropic', 'AI / LLM', 'ANTHROPIC_API_KEY', 'https://console.anthropic.com', 'Claude — script & copy generation', 0),
  ('openrouter', 'OpenRouter', 'AI / LLM', 'OPENROUTER_API_KEY', 'https://openrouter.ai', 'Routed models (DeepSeek, Sonar, etc.)', 1),
  ('replicate', 'Replicate', 'AI / Media generation', 'REPLICATE_API_TOKEN', 'https://replicate.com', 'Image, video & voiceover generation models', 2),
  ('cloudflare', 'Cloudflare Workers AI', 'AI / Media generation', 'CLOUDFLARE_API_TOKEN', 'https://dash.cloudflare.com', 'Image generation & translation', 3),
  ('apify', 'Apify', 'Scraping', 'APIFY_API_TOKEN', 'https://apify.com', 'YouTube/TikTok scraper actors', 4),
  ('scrapecreators', 'ScrapeCreators', 'Scraping', 'SCRAPECREATORS_API_KEY', 'https://scrapecreators.com', 'Social video metadata', 5),
  ('sociavault', 'SociaVault', 'Scraping', 'SOCIAVAULT_API_KEY', 'https://sociavault.com', 'Social video metadata', 6),
  ('youtube', 'YouTube Data API', 'Scraping', 'YOUTUBE_API_KEY', 'https://console.cloud.google.com', 'YouTube metadata & search', 7),
  ('whop', 'Whop', 'Billing', 'WHOP_API_KEY', 'https://whop.com', 'Payments & subscriptions (current provider)', 8),
  ('supabase', 'Supabase', 'Infra', 'NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.com', 'Database, auth & storage', 9);
