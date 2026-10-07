import { StatePanel } from "@/components/ui/state-panel";
import styles from "@/components/members/members.module.css";

export default function MembersLoading() {
  return (
    <div className={styles.narrow}>
      <StatePanel
        eyebrow="Área de membros"
        title="Preparando sua área"
        description="Estamos reunindo as informações da comunidade."
        busy
      />
    </div>
  );
}
