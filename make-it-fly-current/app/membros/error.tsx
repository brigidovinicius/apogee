"use client";

import { RouteErrorState } from "@/components/ui/route-error-state";
import styles from "@/components/members/members.module.css";

export default function MembersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={styles.narrow}>
      <RouteErrorState retry={reset} />
    </div>
  );
}
