import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
import { ProfileForm } from "@/components/members/profile-form";
import { requireMember } from "@/lib/members/dal";
import { getOwnProfile } from "@/lib/members/forum";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function EditProfilePage() {
  const member = await requireMember("/membros/perfil/editar");
  const profile = await getOwnProfile(member.id);
  if (!profile) redirect("/membros/entrar");

  return (
    <div className={styles.container}>
      <MemberBar member={member} current="perfil" />
      <ol className={styles.breadcrumbs}>
        <li>
          <Link href={`/membros/perfil/${member.username}`}>Meu perfil</Link>
        </li>
        <li aria-current="page">Editar</li>
      </ol>
      <h1 className={styles.title}>Editar perfil</h1>
      <div className={styles.panel} style={{ marginTop: "2rem", maxWidth: "40rem" }}>
        <ProfileForm name={profile.name} bio={profile.bio ?? ""} />
      </div>
    </div>
  );
}
