# Verlab render worker. Build context is the REPO ROOT, since the worker
# bundles the app's own renderer from src/:
#   docker build -f worker/Dockerfile -t verlab-worker .
# On Railway: root directory = repo root, config file = worker/railway.json.

FROM node:22-bookworm-slim AS build
WORKDIR /app
# The app's dependencies supply the renderer's own imports (mediabunny,
# @mediapipe/tasks-vision, @fontsource, supabase-js) and esbuild.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY worker/package.json worker/package-lock.json ./worker/
RUN cd worker && npm ci --no-audit --no-fund
COPY src ./src
COPY worker ./worker
RUN node worker/build.mjs

FROM node:22-bookworm-slim
# Google Chrome, not Chromium: Chromium builds ship without H.264/AAC.
# ffmpeg for probing, cuts and the AAC remux; Noto Color Emoji so caption
# emojis draw in color (macOS previews use Apple's set, so they differ in style).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg ffmpeg fonts-noto-color-emoji \
  && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /worker
COPY --from=build /app/worker/package.json ./
COPY --from=build /app/worker/node_modules ./node_modules
COPY --from=build /app/worker/dist ./dist
COPY --from=build /app/worker/spike/ref ./spike/ref
COPY --from=build /app/worker/spike/run.sh ./spike/run.sh
COPY public/fonts ./fonts

ENV NODE_ENV=production \
    CHROME_PATH=/usr/bin/google-chrome \
    CHROME_NO_SANDBOX=1 \
    FONTS_DIR=/worker/fonts

USER node
# The render worker (src/index.ts). The Phase 0 render spike is still in the
# image: `sh spike/run.sh` prints a codec/speed/memory report.
CMD ["node", "dist/worker.mjs"]
