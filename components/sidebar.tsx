"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  GitBranch,
  Target,
  TrendingUp,
  Home,
  LogOut,
  User,
  UserCircle,
  History,
  Flame,
  ChevronUp,
  BookOpen,
  Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { signOut } from "@/lib/supabase/auth"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/scenarios", label: "Rebalance", icon: GitBranch },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/lessons", label: "Trading School", icon: BookOpen },
  { href: "/goals", label: "My Goals", icon: Target },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
        className="mt-auto"
      >
        {user ? (
          <div className="bg-accent rounded-lg overflow-hidden">
            {/* Clickable user info row */}
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="w-full p-4 flex items-center gap-2 hover:bg-accent/80 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
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
              <ChevronUp
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                  userMenuOpen ? "rotate-0" : "rotate-180"
                )}
              />
            </button>

            {/* Expandable menu with My Profile + Sign out */}
            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full",
                        pathname === "/profile"
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-background/60"
                      )}
                    >
                      <UserCircle className="w-4 h-4" />
                      My Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-background/60 transition-colors w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link href="/auth">
            <div className="p-4 bg-accent rounded-lg text-center">
              <p className="text-sm font-medium text-primary">Sign in</p>
              <p className="text-xs text-muted-foreground">to save your data</p>
            </div>
          </Link>
        )}
      </motion.div>
    </motion.aside>
  )
}
