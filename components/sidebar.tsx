"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  GitBranch,
  Target,
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
  { href: "/scenarios", label: "What-If Scenarios", icon: GitBranch },
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
      className="sidebar-shadow fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white py-6 font-display transition-colors duration-300"
    >
      <Link href="/" className="group mb-10 px-6">
        <span className="block text-xl font-bold tracking-tight text-[#003666] transition-opacity group-hover:opacity-80">
          Nestor
        </span>
      </Link>

      <nav className="flex flex-grow flex-col gap-1 px-3">
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
                  "relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all duration-200 active:scale-[0.98]",
                  isActive
                    ? "border-r-4 border-[#003666] bg-slate-50 font-semibold text-[#003666]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 -z-10 rounded-lg bg-slate-50"
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
        className="mt-auto px-6"
      >
        {user ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80">
            {/* Clickable user info row */}
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex w-full items-center gap-2 p-4 text-left transition-colors hover:bg-white"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
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
                          ? "bg-white text-primary font-medium"
                          : "text-foreground hover:bg-white"
                      )}
                    >
                      <UserCircle className="w-4 h-4" />
                      My Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white hover:text-destructive"
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm font-medium text-primary">Sign in</p>
              <p className="text-xs text-muted-foreground">to save your data</p>
            </div>
          </Link>
        )}
      </motion.div>
    </motion.aside>
  )
}
