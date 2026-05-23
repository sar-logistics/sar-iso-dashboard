interface CustomerAvatarProps {
  name: string;
  size?: "sm" | "md";
}

const PALETTE = [
  "bg-sales text-sales-text",
  "bg-mr text-mr-text",
  "bg-finance text-finance-text",
  "bg-info text-info-text",
  "bg-warning text-warning-text",
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function CustomerAvatar({ name, size = "sm" }: CustomerAvatarProps) {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${dim} ${hashColor(name)} rounded-full inline-flex items-center justify-center font-bold flex-shrink-0`}
    >
      {initials(name)}
    </div>
  );
}
