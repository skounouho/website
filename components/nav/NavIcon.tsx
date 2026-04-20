import type { ComponentType, SVGProps } from "react";

interface NavIconProps {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  size?: number;
  className?: string;
}

// Bold-on-hover icon for nav chrome. Requires the immediate hoverable
// ancestor (Link or button) to carry `group/nav-item`.
export function NavIcon({ Icon, size = 20, className = "" }: NavIconProps) {
  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={1.5}
      className={`transition-[stroke-width] duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover/nav-item:stroke-2 group-focus-visible/nav-item:stroke-2 ${className}`}
    />
  );
}
