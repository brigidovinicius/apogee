"use client";

import { useId } from "react";
import styles from "./store-product-visual.module.css";

export type StoreProductKind = "wearable" | "notebook" | "object" | "edition" | "bag" | "ticket";

type StoreProductVisualProps = {
  kind: StoreProductKind;
  className?: string;
};

const starPath = "M544 0 420 393 607 307 456 424 703 465 421 475 504 665 375 513 190 870 308 497 128 586 267 471 0 422 302 417 232 203 350 376Z";
const sculpturePath = "M314 110C363 90 420 124 437 178C460 228 435 251 450 293C474 360 418 428 362 447C303 470 243 448 212 403C184 363 150 355 151 305C152 252 188 224 211 191C239 151 266 128 314 110Z";

/** Self-contained product studies. The parent controls position and motion. */
export function StoreProductVisual({ kind, className }: StoreProductVisualProps) {
  const reactId = useId();
  const id = `product-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      viewBox="0 0 600 600"
      className={[styles.visual, className].filter(Boolean).join(" ")}
      data-product-kind={kind}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <symbol id={`${id}-star`} viewBox="0 0 703 870"><path d={starPath} fill="currentColor" /></symbol>
        <linearGradient id={`${id}-navy`} x1="0" y1="0" x2="1" y2="0.8">
          <stop stopColor="#24425c" /><stop offset=".3" stopColor="#102b45" /><stop offset=".65" stopColor="#07182d" /><stop offset="1" stopColor="#142e45" />
        </linearGradient>
        <linearGradient id={`${id}-fabric`} x1="0" y1="0" x2="1" y2="0.25">
          <stop stopColor="#0b1e33" /><stop offset=".18" stopColor="#1d3b55" /><stop offset=".42" stopColor="#122d47" /><stop offset=".75" stopColor="#091b31" /><stop offset="1" stopColor="#18354c" />
        </linearGradient>
        <linearGradient id={`${id}-canvas`} x1="0" y1="0" x2="1" y2="0.6">
          <stop stopColor="#d4e2eb" /><stop offset=".17" stopColor="#bad0df" /><stop offset=".6" stopColor="#b1c9dc" /><stop offset=".91" stopColor="#89a8c1" /><stop offset="1" stopColor="#9bb8cf" />
        </linearGradient>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" /><stop offset=".65" stopColor="#f5f8fb" /><stop offset="1" stopColor="#e7eef5" />
        </linearGradient>
        <linearGradient id={`${id}-pages`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#b6b4ad" /><stop offset=".12" stopColor="#f7f5ec" /><stop offset=".88" stopColor="#dfddd5" /><stop offset="1" stopColor="#aaa9a4" />
        </linearGradient>
        <radialGradient id={`${id}-glass`} cx=".34" cy=".25" r=".83">
          <stop stopColor="#fff" stopOpacity=".91" /><stop offset=".28" stopColor="#d6e7f2" stopOpacity=".8" /><stop offset=".52" stopColor="#a7c8de" stopOpacity=".9" /><stop offset=".76" stopColor="#709eba" stopOpacity=".86" /><stop offset="1" stopColor="#315c80" stopOpacity=".96" />
        </radialGradient>
        <radialGradient id={`${id}-glass-core`} cx=".63" cy=".67" r=".56">
          <stop stopColor="#e9f7ff" stopOpacity=".9" /><stop offset=".35" stopColor="#bdd6e8" stopOpacity=".15" /><stop offset=".7" stopColor="#4e7c9d" stopOpacity=".28" /><stop offset="1" stopColor="#f4faff" stopOpacity=".65" />
        </radialGradient>
        <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2=".7">
          <stop stopColor="#6e879a" /><stop offset=".23" stopColor="#f6fbff" /><stop offset=".5" stopColor="#adc9df" /><stop offset=".7" stopColor="#6384a0" /><stop offset="1" stopColor="#d3e5ef" />
        </linearGradient>
        <pattern id={`${id}-weave`} width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M0 .5H5M.5 0V5" stroke="#fff" strokeOpacity=".08" strokeWidth=".65" />
          <path d="M0 3H5M3 0V5" stroke="#07182d" strokeOpacity=".08" strokeWidth=".5" />
        </pattern>
        <pattern id={`${id}-page-lines`} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 .5H3" stroke="#8d908e" strokeOpacity=".42" strokeWidth=".5" />
        </pattern>
        <filter id={`${id}-shadow`} x="-35%" y="-30%" width="180%" height="185%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="7" dy="20" stdDeviation="13" floodColor="#07182d" floodOpacity=".2" />
          <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#07182d" floodOpacity=".12" />
        </filter>
        <filter id={`${id}-soft-shadow`} x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="10" /></filter>
        <clipPath id={`${id}-sculpture-clip`}><path d={sculpturePath} /></clipPath>
      </defs>

      {kind === "wearable" && (
        <g transform="rotate(-6 300 300)">
          <path d="M193 124 249 104Q273 145 308 144Q342 143 359 104L407 123 502 205 458 288 410 259 422 488Q306 508 185 487L194 257 148 287 100 206Z" fill={ref("fabric")} filter={ref("shadow")} />
          <path d="M193 124 249 104Q273 145 308 144Q342 143 359 104L407 123 502 205 458 288 410 259 422 488Q306 508 185 487L194 257 148 287 100 206Z" fill={ref("weave")} />
          <path d="M249 104Q300 88 359 104Q345 151 308 153Q269 152 249 104" fill="#071628" />
          <path d="M257 109Q303 99 351 109Q336 140 307 141Q279 139 257 109" fill="#040f1d" />
          <path d="M249 104Q271 150 308 151Q344 147 359 104" className={styles.fineLine} stroke="#486176" strokeWidth="4" opacity=".58" />
          <path d="M246 110Q271 157 308 158Q346 154 362 111M195 133Q212 186 194 257M403 135Q394 207 410 259M108 208 149 278M493 209 457 278M188 478Q307 497 420 479" className={styles.fineLine} stroke="#496177" opacity=".4" strokeWidth="1.2" />
          <path d="M195 151Q217 222 204 312L187 455Q217 321 232 282M402 164Q378 235 395 304L414 456Q387 320 367 284" fill="#020b17" opacity=".2" />
          <path d="M232 169Q220 252 229 365M390 270Q368 354 396 450M244 468Q300 480 370 471" className={styles.fineLine} stroke="#69869b" opacity=".12" strokeWidth="5" />
          <image href="/brand/apogee-logo-white.svg" x="235" y="212" width="140" height="128" />
          <text x="304" y="345" fill="#b9d3ee" fontSize="7.2" textAnchor="middle" className={styles.micro}>BUILDING THE FUTURE</text>
          <path d="M369 467h29v22h-29Z" fill="#d8dfdd" />
          <text x="383.5" y="481" fill="#07182d" fontSize="6.6" textAnchor="middle" className={styles.label}>APOGEE</text>
        </g>
      )}

      {kind === "notebook" && (
        <g transform="rotate(-10 300 300)">
          <path d="M176 99 410 92Q427 94 427 111L428 473Q427 485 412 489L185 502Q171 502 171 486L168 117Q168 102 176 99" fill="#07182d" filter={ref("shadow")} />
          <path d="m182 109 231-9 2 377-231 14Z" fill={ref("pages")} />
          <path d="m181 470 234-9v15l-233 15Z" fill={ref("page-lines")} />
          <path d="m411 111 5-7 1 369-6 6Z" fill="#edece5" />
          <path d="M173 96 405 86Q419 86 420 102L420 461Q419 473 407 475L177 488Q166 488 164 476L162 113Q162 99 173 96Z" fill={ref("navy")} />
          <path d="M175 96 188 95 191 486 178 487Q166 487 165 474L163 114Q162 100 175 96Z" fill="#06182d" />
          <path d="m185 98 3 383" stroke="#71869a" strokeOpacity=".36" />
          <path d="m168 114 2 360" stroke="#aac0cf" strokeOpacity=".14" strokeWidth="2" />
          <path d="M192 101 406 92Q413 92 413 104L414 459Q414 467 406 469L194 481" fill="none" stroke="#829aaa" strokeOpacity=".2" />
          <image href="/brand/apogee-logo-white.svg" x="216" y="185" width="180" height="150" />
          <path d="M216 344 385 338" stroke="#b9d3ee" strokeOpacity=".45" />
          <text x="216" y="369" fill="#b9cbd7" fontSize="8" className={styles.micro}>IDEIAS EM ÓRBITA</text>
          <text x="216" y="440" fill="#d5dbd9" fontSize="9" className={styles.label}>APOGEE</text>
          <text x="383" y="433" fill="#93a8b7" fontSize="6.5" textAnchor="end" className={styles.micro}>CADERNO · A5</text>
          <path d="m390 90 3 380" stroke="#010b18" strokeOpacity=".7" strokeWidth="6" />
          <path d="m393 92 3 375" stroke="#31516a" strokeOpacity=".6" strokeWidth="1" />
          <path d="m329 483 1 30 11-9 7 10-2-32" fill="#b8cee0" />
        </g>
      )}

      {kind === "object" && (
        <g>
          <ellipse cx="306" cy="481" rx="149" ry="19" fill="#183c5a" opacity=".2" filter={ref("soft-shadow")} />
          <ellipse cx="300" cy="285" rx="222" ry="67" transform="rotate(-23 300 285)" fill="none" stroke="#809bac" strokeWidth="1.7" opacity=".65" />
          <ellipse cx="300" cy="285" rx="206" ry="67" transform="rotate(48 300 285)" fill="none" stroke="#9db4c5" strokeWidth="1.1" opacity=".5" />
          <path d={sculpturePath} fill={ref("glass")} stroke="#d7e8f4" strokeOpacity=".7" strokeWidth="1.3" filter={ref("shadow")} />
          <g clipPath={ref("sculpture-clip")}>
            <path d="M156 198Q304 40 414 182Q448 255 367 290Q220 343 234 426Q120 354 156 198" fill={ref("glass-core")} />
            <ellipse cx="336" cy="336" rx="83" ry="135" transform="rotate(27 336 336)" fill={ref("glass-core")} opacity=".86" />
            <path d="M310 124Q388 98 423 184Q441 239 406 279" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="5" strokeLinecap="round" />
            <path d="M220 203Q263 142 304 136M176 298Q168 359 218 392" fill="none" stroke="#effaff" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
            <path d="M280 428Q343 453 401 403Q426 380 436 349" fill="none" stroke="#315d7c" strokeOpacity=".43" strokeWidth="9" strokeLinecap="round" />
            <path d="M254 278Q295 219 360 270Q401 305 355 361Q310 410 269 365Q240 333 254 278" fill="none" stroke="#e8f5ff" strokeOpacity=".35" strokeWidth="1.2" />
            <ellipse cx="290" cy="286" rx="131" ry="42" transform="rotate(-23 290 286)" fill="none" stroke="#3b6380" strokeOpacity=".18" strokeWidth="3" />
          </g>
          <path d="M96 334C103 373 208 366 321 323C430 280 512 225 504 191" fill="none" stroke={ref("foil")} strokeWidth="3" />
          <path d="M96 334C103 373 208 366 321 323C430 280 512 225 504 191" fill="none" stroke="#fff" strokeOpacity=".46" strokeWidth=".65" />
          <circle cx="123" cy="347" r="7" fill={ref("foil")} /><circle cx="450" cy="250" r="4.5" fill="#dcecf7" />
          <path d="M234 411Q297 460 365 453" fill="none" stroke="#fff" strokeOpacity=".67" strokeWidth="1.5" />
          <use href={`#${id}-star`} x="274" y="304" width="33" height="41" color="#fff" opacity=".55" />
        </g>
      )}

      {kind === "edition" && (
        <g>
          <g transform="rotate(-13 300 300)" filter={ref("shadow")}>
            <path d="M144 92h304v423H144Z" fill="#b4cede" />
            <path d="M164 112h264v383H164Z" fill="none" stroke="#1f4965" strokeOpacity=".25" />
            <circle cx="296" cy="301" r="104" fill="none" stroke="#235777" strokeWidth=".8" />
          </g>
          <g transform="rotate(7 300 300)" filter={ref("shadow")}>
            <path d="M155 74h301v424H155Z" fill={ref("paper")} />
            <path d="M155 74h301v424H155Z" fill="none" stroke="#fff" strokeOpacity=".8" />
            <text x="177" y="103" fill="#07182d" fontSize="8" className={styles.label}>APOGEE BUILDERS CLUB</text>
            <text x="433" y="102" fill="#07182d" fontSize="5.8" textAnchor="end" className={styles.micro}>BUILDING THE FUTURE</text>
            <path d="M177 115h256" stroke="#183349" strokeOpacity=".3" strokeWidth=".6" />
            <text x="175" y="176" fill="#102b42" fontSize="47" className={styles.display}>Ganhar</text>
            <text x="175" y="220" fill="#102b42" fontSize="47" className={styles.display}>o mundo.</text>
            <circle cx="306" cy="328" r="78" fill="#bfd5e3" />
            <circle cx="306" cy="328" r="57" fill="none" stroke="#3f6a88" strokeWidth=".7" />
            <circle cx="306" cy="328" r="96" fill="none" stroke="#49748f" strokeWidth=".55" />
            <ellipse cx="306" cy="328" rx="124" ry="38" transform="rotate(-33 306 328)" fill="none" stroke="#284d68" strokeWidth=".85" />
            <path d="M192 328h228M306 227v204" stroke="#49748f" strokeOpacity=".45" strokeWidth=".5" strokeDasharray="2 4" />
            <use href={`#${id}-star`} x="275" y="290" width="60" height="74" color="#102b42" />
            <circle cx="398" cy="268" r="3.5" fill="#102b42" />
            <path d="M177 445h256" stroke="#183349" strokeOpacity=".3" strokeWidth=".6" />
            <text x="177" y="463" fill="#102b42" fontSize="6" className={styles.micro}>IDEIAS EM MOVIMENTO</text>
            <text x="433" y="477" fill="#71818a" fontSize="5.3" textAnchor="end" className={styles.micro}>ESTUDO DE TRAJETÓRIA</text>
          </g>
        </g>
      )}

      {kind === "bag" && (
        <g transform="rotate(-5 300 300)">
          <path d="M233 258 235 162Q239 91 300 91Q364 91 365 162L366 258" fill="none" stroke="#7e9db5" strokeWidth="22" />
          <path d="M236 259 238 162Q241 96 300 96Q358 96 360 162L361 257" fill="none" stroke="#bfd1df" strokeWidth="13" />
          <path d="M210 263 213 164Q216 87 280 86Q344 86 345 164L346 264" fill="none" stroke="#8dacc3" strokeWidth="21" />
          <path d="M211 263 215 164Q220 92 280 92Q338 92 339 164L340 264" fill="none" stroke="#c8d9e4" strokeWidth="12" />
          <path d="M157 228Q300 240 440 226L458 467Q459 502 420 511L190 512Q151 507 151 477Z" fill={ref("canvas")} filter={ref("shadow")} />
          <path d="M157 228Q300 240 440 226L458 467Q459 502 420 511L190 512Q151 507 151 477Z" fill={ref("weave")} />
          <path d="M159 230Q178 354 167 476L190 504Q163 399 193 260M439 230Q416 322 435 476L419 504Q443 371 407 258" fill="#345a78" opacity=".15" />
          <path d="M170 239Q298 251 428 238M173 248Q300 260 428 247M170 471Q287 489 438 471M172 478Q287 496 436 478" fill="none" stroke="#60849f" strokeWidth="1.1" strokeDasharray="3 3" opacity=".64" />
          <path d="M205 236v56h22v-55M330 236v57h22v-57" fill="#a4bed0" />
          <path d="M209 242v42h14v-42M334 242v43h14v-43M209 244l14 36M223 244l-14 36M334 244l14 36M348 244l-14 36" fill="none" stroke="#7394ad" strokeWidth="1" strokeDasharray="2 2" />
          <image href="/brand/apogee-logo-navy.svg" x="230" y="298" width="140" height="128" />
          <text x="300" y="435" fill="#34586f" fontSize="7.4" textAnchor="middle" className={styles.micro}>LEVE SUAS IDEIAS</text>
          <path d="M443 396h15v40h-13Z" fill="#17364e" />
          <text x="450" y="402" fill="#e1e8e9" fontSize="5.5" transform="rotate(90 450 402)" className={styles.label}>APOGEE</text>
        </g>
      )}

      {kind === "ticket" && (
        <g>
          <g transform="rotate(-10 300 300)">
            <path d="M77 173H523V275Q506 288 523 301V420H77V302Q94 289 77 276Z" fill="#779bb5" filter={ref("shadow")} />
            <path d="M93 188H507V404H93Z" fill="none" stroke="#d5e2eb" strokeOpacity=".5" />
          </g>
          <g transform="rotate(7 300 300)">
            <path d="M67 168H534V272Q516 286 534 300V418H67V300Q85 286 67 272Z" fill={ref("paper")} filter={ref("shadow")} />
            <path d="M67 168H411V418H67V300Q85 286 67 272Z" fill="#d2e0e9" />
            <path d="M67 168H411V221H67Z" fill="#102b42" />
            <text x="90" y="201" fill="#fff" fontSize="12" className={styles.label}>APOGEE BUILDERS CLUB · MAKE IT FLY</text>
            <text x="90" y="273" fill="#102b42" fontSize="37" className={styles.display}>Boas ideias.</text>
            <text x="90" y="310" fill="#102b42" fontSize="37" className={styles.display}>Novos voos.</text>
            <path d="M91 340h294" stroke="#173b55" strokeOpacity=".3" strokeWidth=".8" />
            <text x="91" y="365" fill="#244b66" fontSize="7.7" className={styles.micro}>EDIÇÃO DE ENCONTRO</text>
            <text x="91" y="392" fill="#244b66" fontSize="6.5" className={styles.micro}>FEITO PARA ESTAR JUNTO.</text>
            <path d="M411 170v246" stroke="#637d8e" strokeWidth="1" strokeDasharray="3 5" />
            <use href={`#${id}-star`} x="449" y="196" width="43" height="54" color="#102b42" />
            <text x="472" y="276" fill="#102b42" fontSize="7.8" textAnchor="middle" className={styles.micro}>MAKE IT FLY</text>
            <text x="472" y="293" fill="#102b42" fontSize="6.3" textAnchor="middle" className={styles.micro}>EVENTO</text>
            {[0, 5, 9, 17, 21, 28, 33, 41, 46, 51, 60, 64, 71].map((x, index) => (
              <rect key={x} x={434 + x} y="329" width={index % 3 === 0 ? 3 : 1.3} height={index % 4 === 0 ? 41 : 36} fill="#19384e" />
            ))}
            <text x="471" y="392" fill="#466070" fontSize="5.2" textAnchor="middle" className={styles.micro}>OBJETO DE COLEÇÃO</text>
            <path d="M69 170h463" stroke="#fff" strokeOpacity=".7" />
          </g>
        </g>
      )}
    </svg>
  );
}
