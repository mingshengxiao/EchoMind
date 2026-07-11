"use client";

import { BrainCircuit, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";

export function SiteHeader() {
  const { user, isGuest, logout } = useAuth();
  const pathname = usePathname();
  const navigation = [
    { href: "/resume-qa", label: "简历问答" },
    { href: "/questions-bank", label: "面试题集" },
    { href: "/#features", label: "功能亮点", active: pathname === "/" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2 text-lg font-bold text-zinc-950" href="/">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-zinc-950 text-white">
            <BrainCircuit aria-hidden="true" className="h-5 w-5" />
          </span>
          EchoMind
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="主导航">
          {navigation.map((item) => {
            const isActive = item.active ?? pathname === item.href;

            return (
              <Link
                key={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3 py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  isActive
                    ? "bg-brand/10 font-semibold text-brand shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-brand"
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-zinc-600 sm:inline">{user.username}</span>
              <Button aria-label="退出登录" onClick={logout} variant="secondary">
                <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
                退出
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant={isGuest ? "secondary" : "primary"}>
                <LogIn aria-hidden="true" className="mr-2 h-4 w-4" />
                {isGuest ? "游客模式" : "登录"}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
