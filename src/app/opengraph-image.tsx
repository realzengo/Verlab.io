import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Verlab AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const iconData = await readFile(join(process.cwd(), "src/app/icon.png"));
  const iconSrc = `data:image/png;base64,${iconData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 22% 18%, rgba(51,92,255,0.35), transparent 42%), radial-gradient(circle at 82% 88%, rgba(51,92,255,0.22), transparent 45%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={128} height={128} style={{ borderRadius: 28 }} />
        <div
          style={{
            marginTop: 40,
            fontSize: 84,
            fontWeight: 700,
            color: "#f5f5f6",
            letterSpacing: -2,
          }}
        >
          Verlab AI
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 32,
            color: "#a1a1aa",
            maxWidth: 820,
            textAlign: "center",
          }}
        >
          Find the faceless niches blowing up on TikTok, and bend them into a
          repeatable system for your channel.
        </div>
      </div>
    ),
    { ...size }
  );
}
