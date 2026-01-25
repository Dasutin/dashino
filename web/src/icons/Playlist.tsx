import type { SVGProps } from "react";

export default function PlaylistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M4 7.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 16.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 8v9.5a2 2 0 1 0 2-1.9V8h-2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
