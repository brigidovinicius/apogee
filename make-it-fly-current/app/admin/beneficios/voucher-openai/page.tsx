import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import styles from "@/components/community/deliverables.module.css";
import { VoucherForm } from "@/components/workshop-voucher/form";
import { VoucherParticipants } from "@/components/workshop-voucher/participants";
import { requireAdmin } from "@/lib/members/dal";
import { memberMailAvailable } from "@/lib/members/mail";
import { manageVoucherAction } from "@/lib/workshop-voucher/actions";
import { VOUCHER_ADMIN_PATH, VOUCHER_LIMIT, VOUCHER_PATH } from "@/lib/workshop-voucher/input";
import { voucherConfigured } from "@/lib/workshop-voucher/secrets";
import { adminVoucherStatus } from "@/lib/workshop-voucher/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voucher OpenAI" };

function ImportFields({ label }: { label: string }) {
  return <>
    <p><label>Arquivo CSV <input type="file" name="arquivo" accept=".csv,.tsv,.txt,text/csv,text/plain" /></label></p>
    <p><label>{label}<textarea name="conteudo" rows={5} maxLength={450000} autoComplete="off" spellCheck={false} /></label></p>
  </>;
}

export default async function WorkshopVoucherAdmin() {
  await requireAdmin(VOUCHER_ADMIN_PATH);
  const configured = voucherConfigured();
  const status = configured ? await adminVoucherStatus().catch(() => null) : null;

  return <div className={styles.admin}>
    <AdminPageHeader title="Voucher OpenAI" description="Codex Community Workshop de 21 de novembro de 2026, em Florianópolis." />
    <p><Link href="/admin/beneficios">← Benefícios</Link> · <Link href={VOUCHER_PATH} prefetch={false}>Abrir página de resgate</Link></p>
    {!status ? <p role="alert">{configured ? "O banco do workshop está indisponível. Confira a migração antes de usar o painel." :
      "Configure WORKSHOP_VOUCHER_KEY para habilitar o lote e a página de resgate."}</p> : (() => {
      const { batch, stock, guests } = status;
      const revision = <input type="hidden" name="revision" value={batch.revision} />;
      return <>
        <h2>Lote do workshop</h2>
        <p>{stock} de {VOUCHER_LIMIT} links carregados · {guests.length} contemplados · {guests.filter(g => g.opened_at).length} links abertos.</p>
        {batch.released_at ? <p role="status">Lote liberado. A abertura do link é registrada na Apogee. A ativação é feita na OpenAI.</p> : <>
          <h3>1. Links de ativação</h3>
          <p>Carregue 50 links distintos. Use uma coluna chamada Link no CSV ou cole um link por linha.</p>
          <VoucherForm key={`stock-${batch.revision}`} action={manageVoucherAction} label="Carregar links">
            {revision}<input type="hidden" name="operation" value="stock" />
            <ImportFields label="Ou cole os links" />
          </VoucherForm>
        </>}
        <VoucherParticipants revision={batch.revision} stockReady={stock === VOUCHER_LIMIT}
          released={guests.map(guest => ({ email: guest.email, slot: guest.slot, linked: Boolean(guest.linked_at), opened: Boolean(guest.opened_at) }))} />
        {batch.released_at && <section>
          <h3>Avisos por e-mail</h3>
          {batch.notice_accepted_at ? <p role="status">O provedor aceitou os {guests.length} avisos.</p> : <>
            <p>O aviso individual leva o participante à Apogee e inclui um código para vincular sua conta. O link da OpenAI fica em Benefícios.</p>
            {!memberMailAvailable() ? <p role="alert">O envio de e-mail da Apogee está indisponível.</p> :
              <VoucherForm action={manageVoucherAction} label={batch.notice_started_at ? "Conferir ou repetir envio" : "Enviar avisos aos contemplados"}>
                {revision}<input type="hidden" name="operation" value="notify" />
                <p><label><input type="checkbox" name="confirm" required /> Confirmo o envio de {guests.length} e-mails aos contemplados.</label></p>
              </VoucherForm>}
          </>}
        </section>}
      </>;
    })()}
  </div>;
}
