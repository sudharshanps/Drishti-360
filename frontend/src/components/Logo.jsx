import React from "react";
import officialLogo from "../assets/drishti-360-logo.jpg";

export default function Logo({ size = "md", showText = true, subtitle = false, lightText = false }) {
  const sizes = {
    sm: "h-9 w-9",
    md: "h-11 w-11",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <img
        src={officialLogo}
        alt="DRISHTI 360 Official Logo"
        className={`${sizes[size] || sizes.md} rounded-full object-cover ring-2 ring-[#A3E635]/80 shadow-sm bg-white shrink-0`}
      />
      {showText && (
        <div className="leading-tight">
          <div className={`font-extrabold tracking-tight text-lg ${lightText ? "text-white" : "text-[#14532D]"}`}>
            DRISHTI <span className={lightText ? "text-[#A3E635]" : "text-[#228B22]"}>360</span>
          </div>
          {subtitle && (
            <div className={`text-[11px] font-medium ${lightText ? "text-[#D9F99D]" : "text-[#228B22]"}`}>
              Farm-to-Market Intelligence
            </div>
          )}
        </div>
      )}
    </div>
  );
}
