-- Local dev demo data only (loaded by `supabase db reset`, never by
-- `db:push`/`db:diff` -- see supabase/config.toml `[db.seed] sql_paths`).
-- Six verified faceless channels, one per top US Shorts format, so the
-- Niche Finder page (src/app/app/niches/page.tsx) has real rows to render
-- through the normal getFacelessChannels() -> FacelessNicheFinder path
-- instead of an empty state. Thumbnails are placeholder images (picsum.photos,
-- grayscale for a dark/cinematic feel) -- swap for real ingested channel data
-- once the TikTok/YouTube discovery pipeline has run.

insert into public.niche_channels
  (platform, channel_url, channel_title, channel_description, avatar_url,
   subscriber_count, total_views, niche, visual_tags, recent_videos,
   is_faceless, faceless_confidence, faceless_category, complexity,
   viral_velocity_score, classification_reasoning, verified_at, created_at)
values
  (
    'youtube', 'https://youtube.com/@demo-aicompanions', 'Seed: AI Companions Desk', '', null,
    420000, 210000000, 'Commentary', array['ai', 'commentary', 'voiceover'],
    '[{"title": "The Dark Reality of AI Companions", "description": "Commentary breakdown over AI-generated imagery.", "viewsCount": "18.4M", "likesCount": "1.2M", "viewCount": 18400000, "likeCount": 1200000, "coverUrl": "https://picsum.photos/seed/ai-companions/720/1280?grayscale", "postedAt": "2026-07-25T12:00:00Z", "videoUrl": null}]'::jsonb,
    true, 92, 'AI Pictures', 'MEDIUM', 88, 'Seed data for local dev -- not a real classification.', now(), now()
  ),
  (
    'youtube', 'https://youtube.com/@demo-redditreads', 'Seed: Reddit Reads Nightly', '', null,
    680000, 540000000, 'Reddit Story', array['reddit', 'tts', 'gameplay'],
    '[{"title": "AITA for exposed my boss at dinner?", "description": "TTS Reddit story over satisfying background gameplay.", "viewsCount": "34.2M", "likesCount": "2.8M", "viewCount": 34200000, "likeCount": 2800000, "coverUrl": "https://picsum.photos/seed/reddit-reads/720/1280?grayscale", "postedAt": "2026-07-08T12:00:00Z", "videoUrl": null}]'::jsonb,
    true, 90, 'Screen Recording', 'EASY', 91, 'Seed data for local dev -- not a real classification.', now(), now()
  ),
  (
    'youtube', 'https://youtube.com/@demo-deepwatermysteries', 'Seed: Deep Water Mysteries', '', null,
    510000, 300000000, 'Mystery', array['mystery', 'true-crime', 'documentary'],
    '[{"title": "What Divers Found at the Bottom of Lake Superior", "description": "Unsolved mystery breakdown.", "viewsCount": "22.1M", "likesCount": "1.5M", "viewCount": 22100000, "likeCount": 1500000, "coverUrl": "https://picsum.photos/seed/lake-superior/720/1280?grayscale", "postedAt": "2026-07-18T12:00:00Z", "videoUrl": null}]'::jsonb,
    true, 89, 'Documentary', 'HARD', 85, 'Seed data for local dev -- not a real classification.', now(), now()
  ),
  (
    'youtube', 'https://youtube.com/@demo-retailtoons', 'Seed: Retail Toons', '', null,
    290000, 150000000, 'Animation', array['animation', 'storytime', '2d'],
    '[{"title": "Working Retail on Black Friday", "description": "2D animated storytime.", "viewsCount": "12.8M", "likesCount": "940K", "viewCount": 12800000, "likeCount": 940000, "coverUrl": "https://picsum.photos/seed/retail-toons/720/1280?grayscale", "postedAt": "2026-07-25T12:00:00Z", "videoUrl": null}]'::jsonb,
    true, 87, '2D Animation', 'MEDIUM', 80, 'Seed data for local dev -- not a real classification.', now(), now()
  ),
  (
    'youtube', 'https://youtube.com/@demo-cgiwatch', 'Seed: CGI Watch', '', null,
    950000, 780000000, 'Cinema', array['movies', 'vfx', 'breakdown'],
    '[{"title": "Why This Movie CGI Cost $200 Million", "description": "Movie VFX breakdown.", "viewsCount": "41.5M", "likesCount": "3.1M", "viewCount": 41500000, "likeCount": 3100000, "coverUrl": "https://picsum.photos/seed/cgi-watch/720/1280?grayscale", "postedAt": "2026-07-08T12:00:00Z", "videoUrl": null}]'::jsonb,
    true, 93, 'Stock Footage', 'LEGENDARY', 95, 'Seed data for local dev -- not a real classification.', now(), now()
  ),
  (
    'youtube', 'https://youtube.com/@demo-implosionlab', 'Seed: Implosion Lab', '', null,
    610000, 400000000, 'Science', array['science', '3d', 'physics'],
    '[{"title": "How Implosions Actually Happen in 3D", "description": "3D mechanical physics breakdown.", "viewsCount": "29.7M", "likesCount": "2.1M", "viewCount": 29700000, "likeCount": 2100000, "coverUrl": "https://picsum.photos/seed/implosion-lab/720/1280?grayscale", "postedAt": "2026-07-25T12:00:00Z", "videoUrl": null}]'::jsonb,
    true, 91, '3D Animation', 'HARD', 89, 'Seed data for local dev -- not a real classification.', now(), now()
  )
on conflict (channel_url) do nothing;
