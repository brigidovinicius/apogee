import Link from "next/link";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { RadarPreferencesForm } from "@/components/members/radar-preferences-form";
import personal from "@/components/members/radar-personalization.module.css";
import styles from "@/components/members/members.module.css";
import { requireSignedInMember } from "@/lib/members/dal";
import { EMPTY_RADAR_PREFERENCES, RADAR_FOR_YOU, RADAR_PREFERENCES } from "@/lib/opportunities/radar-preferences";
import { radarPreferenceMailSecret } from "@/lib/opportunities/radar-preference-mail-config";
import { getRadarPreference } from "@/lib/opportunities/radar-preference-store";

export const metadata = { title: "Preferências do Radar", robots: { index: false, follow: false } };

export default async function RadarPreferencesPage() {
  const member = await requireSignedInMember(RADAR_PREFERENCES);
  const preference = await getRadarPreference(member.id);
  return <MemberWorkspace member={member} current="perfil">
    <div className={`${styles.container} ${personal.page}`}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Preferências do Radar</h1>
          <p className={styles.lead}>Escolha quantos perfis e interesses quiser. Suas escolhas ficam visíveis só para você.</p>
        </div>
        <Link href={RADAR_FOR_YOU} data-ap-button="secondary">Voltar ao Radar</Link>
      </header>
      <RadarPreferencesForm settings={preference?.settings ?? EMPTY_RADAR_PREFERENCES}
        email={preference?.emailOption ?? "off"} canEnableEmail={Boolean(radarPreferenceMailSecret())} />
    </div>
  </MemberWorkspace>;
}
