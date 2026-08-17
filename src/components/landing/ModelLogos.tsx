import type { SVGProps } from "react";

export function KlingLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 512 512" {...props}>
      <g clipPath="url(#kling-clip0)">
        <g clipPath="url(#kling-clip1)">
          <path
            d="M115.456 293.867a494.813 494.813 0 0142.624-95.04C225.707 81.664 324.373 12.011 378.453 43.221 256.811-27.008 98.091 20.14 23.936 148.565a285.458 285.458 0 00-22.123 48.128c-5.525 15.766 1.963 32.726 16.427 41.088l97.216 56.107v-.021z"
            fill="url(#kling-paint0)"
          />
          <path
            d="M396.544 216.832a494.717 494.717 0 01-42.645 95.04c-67.627 117.163-166.294 186.837-220.374 155.605 121.664 70.251 280.384 23.083 354.539-105.344a285.665 285.665 0 0022.123-48.106c5.525-15.744-1.963-32.726-16.427-41.067l-97.216-56.107v-.021z"
            fill="url(#kling-paint1)"
          />
          <path
            d="M353.92 311.893c67.627-117.162 78.635-237.44 24.533-268.672-54.037-31.21-152.704 38.486-220.373 155.606 44.245-76.587 123.925-113.387 178.005-82.176 54.059 31.232 62.038 118.613 17.814 195.221l.021.021z"
            fill="url(#kling-paint2)"
          />
          <path
            d="M158.08 198.827c-67.627 117.162-78.635 237.44-24.533 268.65 54.058 31.232 152.725-38.442 220.373-155.605-44.245 76.608-123.925 113.408-178.005 82.176-54.059-31.211-62.038-118.613-17.814-195.2l-.021-.021z"
            fill="url(#kling-paint3)"
          />
        </g>
      </g>
      <defs>
        <radialGradient
          id="kling-paint0"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="rotate(-59.132 311.591 48.195) scale(310.927 426.086)"
        >
          <stop offset=".095" stopColor="#FFF959" />
          <stop offset=".326" stopColor="#0DF35E" />
          <stop offset=".64" stopColor="#0BF2F9" />
          <stop offset="1" stopColor="#04A6F0" />
        </radialGradient>
        <radialGradient
          id="kling-paint1"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="rotate(120.868 138.475 223.808) scale(310.927 426.086)"
        >
          <stop offset=".095" stopColor="#FFF959" />
          <stop offset=".326" stopColor="#0DF35E" />
          <stop offset=".64" stopColor="#0BF2F9" />
          <stop offset="1" stopColor="#04A6F0" />
        </radialGradient>
        <linearGradient id="kling-paint2" x1="332.331" y1="38.357" x2="385.323" y2="210.368" gradientUnits="userSpaceOnUse">
          <stop stopColor="#003EFF" />
          <stop offset="1" stopColor="#0BFFE7" />
        </linearGradient>
        <linearGradient id="kling-paint3" x1="179.669" y1="472.363" x2="126.677" y2="300.352" gradientUnits="userSpaceOnUse">
          <stop stopColor="#003EFF" />
          <stop offset="1" stopColor="#0BFFE7" />
        </linearGradient>
        <clipPath id="kling-clip0">
          <path fill="#fff" d="M0 0h512v512H0z" />
        </clipPath>
        <clipPath id="kling-clip1">
          <path fill="#fff" d="M0 0h512v512H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}
