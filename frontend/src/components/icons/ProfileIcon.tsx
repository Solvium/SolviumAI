import React from "react";
import RawProfileSvg from "@/app/assets/icons/home/profile.svg";

export type ProfileIconProps = {
  className?: string;
};

export const ProfileIcon: React.FC<ProfileIconProps> = ({
  className = "w-10 h-10",
}) => {
  return <RawProfileSvg className={className} />;
};

export default ProfileIcon;
