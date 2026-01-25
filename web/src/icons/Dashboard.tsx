import type { SVGProps } from "react";

export default function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect x="4" y="4" width="5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="17" width="5" height="3" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="4" width="4" height="4" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="9.5" width="8" height="10.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
