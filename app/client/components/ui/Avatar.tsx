interface AvatarProps {
  name: string;
  size?: number;
}

const COLOR_RAMP = [
  "bg-indigo-500",
  "bg-purple-500",
  "bg-blue-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-amber-500",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_RAMP[Math.abs(hash) % COLOR_RAMP.length];
}

export default function Avatar({ name, size = 36 }: AvatarProps) {
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${getColor(
        name,
      )}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {getInitials(name)}
    </div>
  );
}
