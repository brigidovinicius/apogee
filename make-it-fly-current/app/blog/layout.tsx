import localFont from "next/font/local";
import type { ReactNode } from "react";
import styles from "./editorial.module.css";

const editorialDisplay = localFont({
  src: "./fonts/GFSDidot-Regular.ttf",
  variable: "--font-editorial-display",
  weight: "400",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export default function BlogLayout({ children }: { children: ReactNode }) {
  return <div className={`${editorialDisplay.variable} ${styles.scope}`} data-apogee-editorial>{children}</div>;
}
