"use client";

import React from "react";

interface WalletIconProps {
  className?: string;
  isActive?: boolean;
  color?: string;
  activeColor?: string;
  width?: number | string;
  height?: number | string;
}

const WalletIcon: React.FC<WalletIconProps> = ({
  className,
  isActive = false,
  color,
  activeColor,
  width = 21,
  height = 16,
}) => {
  const fillColor = isActive
    ? activeColor ?? "currentColor"
    : color ?? "currentColor";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 21 16"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.5 0.75C2.77065 0.75 2.07118 1.03973 1.55546 1.55546C1.03973 2.07118 0.75 2.77065 0.75 3.5V12.5C0.75 13.2293 1.03973 13.9288 1.55546 14.4445C2.07118 14.9603 2.77065 15.25 3.5 15.25H17.5C18.2293 15.25 18.9288 14.9603 19.4445 14.4445C19.9603 13.9288 20.25 13.2293 20.25 12.5V3.5C20.25 2.77065 19.9603 2.07118 19.4445 1.55546C18.9288 1.03973 18.2293 0.75 17.5 0.75H3.5ZM15 6.75C14.6685 6.75 14.3505 6.8817 14.1161 7.11612C13.8817 7.35054 13.75 7.66848 13.75 8C13.75 8.33152 13.8817 8.64946 14.1161 8.88388C14.3505 9.1183 14.6685 9.25 15 9.25C15.3315 9.25 15.6495 9.1183 15.8839 8.88388C16.1183 8.64946 16.25 8.33152 16.25 8C16.25 7.66848 16.1183 7.35054 15.8839 7.11612C15.6495 6.8817 15.3315 6.75 15 6.75Z"
        fill={fillColor}
      />
    </svg>
  );
};

export default WalletIcon;
