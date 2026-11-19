"use client";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import styles from "./red-bull-support.module.css";

const partners = [
  { name: "Red Bull", src: "/partners/red-bull.png", width: 520, height: 339, size: "76px" },
  { name: "Impact Hub Floripa", src: "/partners/impact-hub-floripa.webp", width: 936, height: 434, size: "112px" },
];

export function RedBullSupport() {
  const [paused, setPaused] = useState(false);
  return (
    <aside id="apoios" className={styles.support} aria-label="Red Bull e Impact Hub Floripa">
      <p className={styles.heading}>Energizados <em>por:</em></p>
      <div className={styles.window}>
        <div className={styles.belt} data-paused={paused}>
          {[0, 1].map(group => (
            <div className={styles.group} key={group} aria-hidden={group === 1 || undefined}>
              {[0, 1].flatMap(pair => partners.map(partner => (
                <div className={styles.slot} key={pair + partner.name} aria-hidden={pair === 1 || undefined}>
                  <Image src={partner.src} alt={group === 0 && pair === 0 ? partner.name : ""} width={partner.width} height={partner.height} sizes={partner.size} />
                </div>
              )))}
            </div>
          ))}
        </div>
      </div>
      <button type="button" className={styles.toggle} aria-label={paused ? "Retomar movimento das marcas" : "Pausar movimento das marcas"} onClick={() => setPaused(value => !value)}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
      </button>
    </aside>
  );
}
