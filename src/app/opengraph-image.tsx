import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Verlab AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = await readFile(
    join(process.cwd(), "public/logo-full-dark.png")
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050914",
          backgroundImage:
            "radial-gradient(1100px 700px at 28% 68%, rgba(37,84,255,0.55), transparent 60%), radial-gradient(900px 600px at 75% 15%, rgba(59,102,255,0.28), transparent 55%), linear-gradient(155deg, #04060f 0%, #070c22 35%, #101c47 58%, #060a1c 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={620} height={183.6} />
      </div>
    ),
    { ...size }
  );
}
