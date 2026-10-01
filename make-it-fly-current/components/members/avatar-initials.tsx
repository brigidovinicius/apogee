import styles from "./members.module.css";

type Size = "small" | "normal" | "large";

const sizeClass: Record<Size, string> = {
  small: styles.avatarSmall,
  normal: styles.avatar,
  large: styles.avatarLarge,
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function AvatarInitials({ name, size = "normal" }: { name: string; size?: Size }) {
  return (
    <span className={sizeClass[size]} aria-hidden>
      {initials(name)}
    </span>
  );
}
