import { interfaceText } from "@/lib/presentation-text.mjs";
import Image from "next/image";
import { memberAvatarUrl } from "@/lib/members/avatar-url";
import styles from "./members.module.css";

type Size = "small" | "normal" | "large";

const sizeClass: Record<Size, string> = {
  small: styles.avatarSmall,
  normal: styles.avatar,
  large: styles.avatarLarge,
};

export function initials(name: string): string {
  const parts = interfaceText(name).trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function AvatarInitials({ name, userId, image, size = "normal" }: { name: string; userId: string; image?: string | null; size?: Size }) {
  const avatar = memberAvatarUrl(image, userId);
  return (
    <span className={sizeClass[size]} aria-hidden>
      {avatar ? <Image src={avatar} alt="" width={72} height={72} unoptimized /> : initials(name)}
    </span>
  );
}
