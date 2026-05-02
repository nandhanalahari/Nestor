"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  GitBranch,
  Target,
  Sun,
  Moon,
  TrendingUp,
  Home,
  LogOut,
  User,
  History,
  Flame,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { signOut } from "@/lib/supabase/auth"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/scenarios", label: "What-If Scenarios", icon: GitBranch },
  { href: "/goals", label: "My Goals", icon: Target },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light")
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/auth")
  }

  const displayName =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Investor"

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col p-6 transition-colors duration-300 sticky top-0"
    >
      <Link href="/" className="flex items-center gap-2 mb-10 group">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"
        >
          <TrendingUp className="w-5 h-5 text-primary-foreground" />
        </motion.div>
        <span className="text-2xl font-bold text-primary group-hover:opacity-80 transition-opacity">
          Nestor.
        </span>
      </Link>

      <nav className="flex flex-col gap-2 flex-grow">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href
          return (
            <motion.div
              key={item.href}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative",
                  isActive
                    ? "bg-sidebar-accent text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-sidebar-accent rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            </motion.div>
          )
        })}
      </nav>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-auto space-y-3"
      >
        {user ? (
          <div className="p-4 bg-accent rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors w-full mt-1"
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/auth">
            <div className="p-4 bg-accent rounded-lg text-center">
              <p className="text-sm font-medium text-primary">Sign in</p>
              <p className="text-xs text-muted-foreground">to save your data</p>
            </div>
          </Link>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg hover:opacity-90 transition-opacity font-medium shadow-md"
        >
          {mounted ? (
            resolvedTheme === "light" ? (
              <>
                <Moon className="w-4 h-4" />
                Dark Mode
              </>
            ) : (
              <>
                <Sun className="w-4 h-4" />
                Light Mode
              </>
            )
          ) : (
            <span className="h-4">Toggle Theme</span>
          )}
        </motion.button>
      </motion.div>
    </motion.aside>
  )
}
