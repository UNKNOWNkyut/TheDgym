"use client";
import { createContext, useContext } from "react";

const ThemeContext = createContext("light");

export function useThemeContext() {
  return useContext(ThemeContext);
}

export default function DotGrid({ theme: themeProp, spacing = 20 }: { theme?: string, spacing?: number }) {
  const ctx = useThemeContext();
  const theme = themeProp || ctx;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle, ${theme === "light" ? "#d4d4d4" : "#333"} 1px, transparent 1px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
        borderRadius: "inherit",
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
}
