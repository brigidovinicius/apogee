import { StatePanel } from "@/components/ui/state-panel";
import styles from "@/components/opportunities/opportunities.module.css";

export default function OpportunitiesLoading() {
  return (
    <main className={styles.loadingPage}>
      <StatePanel
        eyebrow="Radar de oportunidades"
        title="Atualizando o Radar"
        description="Estamos verificando as oportunidades disponíveis."
        busy
      />
    </main>
  );
}
