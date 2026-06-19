"use client";
import Link from "next/link";
import Image from "next/image";
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
    links: [{ href: "/dashboard/mr", label: "M\u0026R Operations" }],
  },
  {
    title: "Admin",
    colorClass: "text-finance-text",
    links: [{ href: "/dashboard/admin", label: "Admin Panel" }],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-surface-border h-screen sticky top-0 flex flex-col">
      {/* Header with SAR logo */}
      <div className="px-5 pt-5 pb-4 border-b border-surface-border">
        <div className="flex justify-center mb-2">
          <Image
            src="/sar-logo.jpg"
            alt="SAR · Connecting Continents"
            width={140}
            height={79}
            priority
            className="object-contain"
          />
        </div>
        <p className="text-[10px] text-ink-tertiary text-center uppercase tracking-wider">
          ISO Tank Business Dashboard
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div
              className={`sidebar-section-label ${section.colorClass} px-2 mb-1.5`}
            >
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block px-2 py-1.5 rounded-md text-sm transition ${
                      isActive(link.href)
                        ? "bg-sales/40 text-ink-primary font-medium"
                        : "text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
