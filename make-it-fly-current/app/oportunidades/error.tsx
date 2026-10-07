"use client";

import { RouteErrorState } from "@/components/ui/route-error-state";
import styles from "@/components/opportunities/opportunities.module.css";

export default function OpportunitiesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.loadingPage}>
      <RouteErrorState retry={reset} />
    </main>
  );
}
