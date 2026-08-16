// The dashboard lives on a separate subdomain from the marketing site (see
// src/proxy.ts) -- marketing pages must link to it with an absolute URL
// rather than a relative "/app" path, since a relative Link would resolve
// against the marketing domain instead of crossing over.
export const APP_URL = "https://app.verlab.io";
