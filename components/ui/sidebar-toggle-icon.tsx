import * as React from "react";

export function SidebarToggleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="6" y="8" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="15" y="8" width="2" height="16" fill="currentColor" />
    </svg>
  );
}
