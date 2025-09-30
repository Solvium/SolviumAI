"use client";

import React from "react";

interface HomeIconProps {
  className?: string;
  isActive?: boolean;
  color?: string; // fallback color when not active
  activeColor?: string; // color when active
  width?: number | string;
  height?: number | string;
}

const HomeIcon: React.FC<HomeIconProps> = ({
  className,
  isActive = false,
  color,
  activeColor,
  width = 21,
  height = 23,
}) => {
  const fillColor = isActive
    ? activeColor ?? "currentColor"
    : color ?? "currentColor";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 21 23"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d="M0 21.505V8.51082C0 8.12811 0.0859999 7.76583 0.258 7.42399C0.43 7.08214 0.667 6.80058 0.969 6.57933L9.0465 0.482874C9.4695 0.160958 9.9525 0 10.4955 0C11.0385 0 11.5245 0.160958 11.9535 0.482874L20.031 6.57784C20.334 6.79909 20.571 7.08114 20.742 7.42399C20.914 7.76583 21 8.12811 21 8.51082V21.505C21 21.9057 20.8505 22.255 20.5515 22.553C20.2525 22.851 19.902 23 19.5 23H14.424C14.08 23 13.792 22.8844 13.56 22.6532C13.328 22.4209 13.212 22.1339 13.212 21.7921V14.6626C13.212 14.3207 13.096 14.0342 12.864 13.803C12.631 13.5708 12.343 13.4547 12 13.4547H9C8.657 13.4547 8.3695 13.5708 8.1375 13.803C7.9045 14.0342 7.788 14.3207 7.788 14.6626V21.7936C7.788 22.1354 7.672 22.4219 7.44 22.6532C7.208 22.8844 6.9205 23 6.5775 23H1.5C1.098 23 0.7475 22.851 0.4485 22.553C0.1495 22.255 0 21.9057 0 21.505Z"
        fill={fillColor}
      />
    </svg>
  );
};

export default HomeIcon;
