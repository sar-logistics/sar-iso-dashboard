"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    title: "Sales",
    colorClass: "text-sales-text",
    links: [{ href: "/dashboard", label: "Sales Performance" }],
  },
  {
    title: "M\u0026R",
    colorClass: "text-mr-text",
    links: [
      { href: "/dashboard/inventory", label: "Current Inventory" },
      { href: "/dashboard/depot", label: "Depot Report" },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-2 py-4 space-y-5">
      {NAV_SECTIONS.map((sec) => (
        <div key={sec.title}>
          <div className={`sidebar-section-label ${sec.colorClass}`}>
            {sec.title}
          </div>
          <div className="space-y-0.5">
            {sec.links.map((link) => {
              if ((link as any).disabled) {
                return (
                  <div
                    key={link.label}
                    className="sidebar-link cursor-not-allowed opacity-50"
                  >
                    {link.label}
                  </div>
                );
              }
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`sidebar-link ${
                    isActive ? "sidebar-link-active" : ""
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
