"use client";

import Link from "next/link";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { COMMUNITY_SALES_DELIVERABLES } from "./community-deliverables";
import styles from "./community-editorial.module.css";

export function CommunityDirectory() {
  const [selected, setSelected] = useState<string | null>(COMMUNITY_SALES_DELIVERABLES[0].id);
  const prefix = useId();
  return <div className={styles.directory}>{COMMUNITY_SALES_DELIVERABLES.map(entry => {
    const open = selected === entry.id;
    const triggerId = `${prefix}-${entry.id}-trigger`;
    const panelId = `${prefix}-${entry.id}-panel`;
    return <div className={styles.directoryItem} key={entry.id}>
      <h3><button className={styles.directoryTrigger} id={triggerId} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setSelected(open ? null : entry.id)}><span>{entry.label}</span>{open ? <Minus size={24} aria-hidden="true" /> : <Plus size={24} aria-hidden="true" />}</button></h3>
      <div className={styles.directoryPanel} role="region" id={panelId} aria-labelledby={triggerId} hidden={!open}><p className={styles.eyebrow}>{entry.fact}</p><h4>{entry.title}</h4><p>{entry.description}</p>
        <Link className={styles.skyButton} href={entry.href} prefetch={false}>{entry.action}<ArrowUpRight size={18} aria-hidden="true" /></Link>
      </div>
    </div>;
  })}</div>;
}
