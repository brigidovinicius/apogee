import { notFound } from "next/navigation";
import { FotosDoEvento } from "@/components/eventos/fotos-do-evento";
import styles from "@/components/eventos/eventos.module.css";
import { MemberWorkspace } from "@/components/members/member-workspace";
import shared from "@/components/members/members.module.css";
import { requireSignedInMember } from "@/lib/members/dal";
import { EVENTS_PATH, VIDEO_API, WORKSHOP, WORKSHOP_MEDIA_PATH } from "@/lib/eventos/catalogo";
import { albumConfig, canAccessAlbum, readAlbum } from "@/lib/eventos/fotos";

export const metadata = { title: WORKSHOP.title, referrer: "no-referrer" as const };

export default async function EventMediaPage({ params }: { params: Promise<{ slug: string }> }) {
  if ((await params).slug !== WORKSHOP.slug) notFound();
  const member = await requireSignedInMember(WORKSHOP_MEDIA_PATH);
  const config = albumConfig();
  const permitted = config ? canAccessAlbum(member.id, config) : false;
  const album = permitted && config ? await readAlbum(config).catch(() => null) : null;
  const expires = album?.expires ? new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(album.expires * 1000) : null;

  return <MemberWorkspace member={member} current="eventos">
    <div className={`${shared.container} ${styles.page}`}>
      <header className={styles.section}>
        <a href={EVENTS_PATH} className={styles.support}>Voltar para Eventos</a>
        <h1 className={shared.title}>{WORKSHOP.title}</h1>
        <p className={styles.meta}><time dateTime={WORKSHOP.startsAt}>{WORKSHOP.dateLabel}</time> · {WORKSHOP.location}</p>
      </header>
      {album ? <FotosDoEvento album={album.photos} browse={album.browse} expires={expires} selfieEnabled={config?.selfie === true} /> :
        <section data-ap-card="" className={styles.panel} aria-labelledby="fotos">
          <h2 id="fotos" data-ap-title="">Fotos do evento</h2>
          <p>{permitted ? "O álbum está indisponível no momento." : "O álbum ainda não está disponível para sua conta."}</p>
        </section>}
      <section data-ap-card="" className={styles.panel} aria-labelledby="videos">
        <h2 id="videos" data-ap-title="">Vídeos do evento</h2>
        <div className={styles.actions}>
          <a href={WORKSHOP.recording} data-ap-button="secondary">Assistir à gravação</a>
          {album?.video && <a href={VIDEO_API} data-ap-button="primary" download>Baixar vídeo do workshop</a>}
        </div>
        {!album?.video && <p>Download de vídeo indisponível.</p>}
      </section>
      <a className={styles.support} href="mailto:contato@apogee.community?subject=Excluir%20foto%20do%20Workshop%20Codex">
        Solicitar exclusão de fotos ou dados do álbum
      </a>
    </div>
  </MemberWorkspace>;
}
