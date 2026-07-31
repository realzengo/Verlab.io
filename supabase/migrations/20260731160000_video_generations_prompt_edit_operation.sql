-- Adds "prompt_edit" and "uploaded" as valid operations for the Video
-- Generator's Edit tab. "prompt_edit": editing an existing generated video
-- with a natural-language prompt (+ up to 4 reference images), via fal's
-- Kling O1 video-to-video/edit endpoints (see EDIT_VIDEO_MODELS in
-- video-models.ts) -- distinct from "extend"/"upscale"/"reframe" (flat
-- single-purpose operations already in the original check) since this is
-- model-choice-driven like Create's text_to_video/image_to_video.
-- "uploaded": a row representing a user-supplied source video (not a fal
-- job at all -- status goes straight to 'completed' once the direct-to-
-- Storage upload confirms, no fal_request_id ever set), so it can be
-- attached as an Edit-tab source the same way a Create-tab generation is
-- (see /api/generate-video/edit/upload-source/route.ts).
alter table public.video_generations
  drop constraint video_generations_operation_check;

alter table public.video_generations
  add constraint video_generations_operation_check
  check (operation in ('text_to_video', 'image_to_video', 'upscale', 'reframe', 'extend', 'motion_transfer', 'prompt_edit', 'uploaded'));
