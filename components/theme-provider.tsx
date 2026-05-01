"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { type ThemeProviderProps, useTheme as useNextTheme } from "next-themes"

const NextThemesProvider = dynamic(
  () => import("next-themes").then((mod) => mod.ThemeProvider),
  { ssr: false },
)

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light")
  }

  return { theme: resolvedTheme as "light" | "dark", toggleTheme, setTheme }
}
