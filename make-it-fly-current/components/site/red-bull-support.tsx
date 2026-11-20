import Image from "next/image";
import styles from "./red-bull-support.module.css";

const partners = [
  { name: "Red Bull", src: "/partners/red-bull-can-white.png", width: 1726, height: 4918, size: "20px", className: styles.can },
  { name: "Impact Hub Floripa", src: "/partners/impact-hub-floripa.webp", width: 936, height: 434, size: "112px" },
];

export function RedBullSupport() {
  return (
    <aside id="apoios" className={styles.support} aria-labelledby="apoios-titulo">
      <p id="apoios-titulo" className={styles.heading}>Energizados <em>por:</em></p>
      <div className={styles.window}>
        <div className={styles.belt}>
          {[0, 1].map(group => (
            <div className={styles.group} key={group} aria-hidden={group === 1 || undefined}>
              {[0, 1].flatMap(pair => partners.map(partner => (
                <div className={styles.slot} key={pair + partner.name} aria-hidden={pair === 1 || undefined}>
                  <Image className={partner.className} src={partner.src} alt={group === 0 && pair === 0 ? partner.name : ""} width={partner.width} height={partner.height} sizes={partner.size} />
                </div>
              )))}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
