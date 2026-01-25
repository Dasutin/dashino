import type { SVGProps } from "react";

export default function BackupIcon(props: SVGProps<SVGSVGElement>) {
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
        d="M7.5 10.5a4.5 4.5 0 0 1 8.7-1.6 3.4 3.4 0 0 1-.7 6.7H9.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.5 12.5 8 15l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
