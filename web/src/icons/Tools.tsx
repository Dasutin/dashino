import type { SVGProps } from "react";

export default function ToolsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M14.8 4.7a3 3 0 0 1 3.5 3.5l-1.7 1.7 2.5 2.5-2.4 2.4-2.5-2.5-1.7 1.7a3 3 0 0 1-3.5-3.5l4.2-4.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M6.5 6.5 9 9l-3 3-2.5-2.5a2 2 0 0 1 0-2.8L6.5 6.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
