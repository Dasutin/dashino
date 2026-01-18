import type { SVGProps } from "react";

export default function MoonIcon(props: SVGProps<SVGSVGElement>) {
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
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3.05 7 7 0 1 0 21 14.5z"
        fill="currentColor"
      />
    </svg>
  );
}
