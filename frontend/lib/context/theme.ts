import { Theme } from "@/types/theme"
import { createContext } from "react"

type ThemeProviderState = {
  theme: Theme
  selected: Omit<Theme, 'system'>,
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "dark",
  selected: "dark",
  setTheme: () => null,
}

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState)