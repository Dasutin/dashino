import type { SVGProps } from "react";

export default function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="12" y1="2.5" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="4.22" y1="4.22" x2="5.9" y2="5.9" />
        <line x1="18.1" y1="18.1" x2="19.78" y2="19.78" />
        <line x1="2.5" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="21.5" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.9" y2="18.1" />
        <line x1="18.1" y1="5.9" x2="19.78" y2="4.22" />
      </g>
    </svg>
  );
}
