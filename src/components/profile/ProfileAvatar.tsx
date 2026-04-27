import { cn, initials } from "@/lib/utils";

export function ProfileAvatar({
  name,
  avatarUrl,
  size = 36,
  className,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover shadow-soft", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white shadow-soft",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(name) || "DC"}
    </div>
  );
}
