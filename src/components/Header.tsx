"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/lib/demo-context";

const navItems = [
  { href: "/", label: "Verify Label" },
  { href: "/batch", label: "Batch Upload" },
  { href: "/about", label: "How It Works" },
];

export function Header() {
  const pathname = usePathname();
  const { demoMode, toggleDemoMode } = useDemo();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900 text-sm font-bold text-white">
            TTB
          </div>
          <span className="text-lg font-semibold text-gray-900">
            Label Verification
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-blue-50 text-blue-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-3 border-l pl-3">
            <button
              onClick={toggleDemoMode}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                demoMode
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {demoMode ? "Demo ON" : "Demo"}
            </button>
          </div>
        </div>
      </div>
      {demoMode && (
        <div className="border-t border-amber-200 bg-amber-50 px-6 py-2">
          <p className="mx-auto max-w-5xl text-xs text-amber-700">
            Demo mode is active. Example labels are available for quick testing. Debug console is visible at the bottom of the page.
          </p>
        </div>
      )}
    </header>
  );
}
