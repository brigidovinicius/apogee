"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { availableDeliverables, type PublishedResources } from "./community-deliverables";
import styles from "./community-editorial.module.css";

export function CommunityDirectory({ resources }: { resources: PublishedResources }) {
  const entries = availableDeliverables(resources);
  const [selected, setSelected] = useState<string | null>(entries[0].id);
  const prefix = useId();
  return <div className={styles.directory}>{entries.map(entry => {
    const open = selected === entry.id;
    const artwork = entry.id === "encontros" ? "participar" : entry.id;
    const triggerId = `${prefix}-${entry.id}-trigger`;
    const panelId = `${prefix}-${entry.id}-panel`;
    return <div className={styles.directoryItem} key={entry.id}>
      <h3><button className={styles.directoryTrigger} id={triggerId} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setSelected(open ? null : entry.id)}><span>{entry.label}</span>{open ? <Minus size={24} aria-hidden="true" /> : <Plus size={24} aria-hidden="true" />}</button></h3>
      <div className={styles.directoryPanel} role="region" id={panelId} aria-labelledby={triggerId} hidden={!open}>
        {open && <Image className={styles.directoryArtwork} src={`/design-system/icons/${artwork}.webp`} alt="" width={104} height={96} />}
        {"fact" in entry && <p className={styles.eyebrow}>{entry.fact}</p>}
        <h4>{entry.title}</h4>
        <p>{entry.description}</p>
        <Link data-ap-button="primary" className={styles.skyButton} href={entry.href} prefetch={false}>{entry.action}</Link>
      </div>
    </div>;
  })}</div>;
}
