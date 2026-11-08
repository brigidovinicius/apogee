"use client";

import { useId, useState, type PointerEvent } from "react";
import { BEHAVIOR_METRICS, type BehaviorInsights, type BehaviorMetric } from "@/lib/admin/behavior-insights";
import styles from "./behavior-insights.module.css";

const number = new Intl.NumberFormat("pt-BR");
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const date = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
const range = (start: string, end: string) => `${date(start)} a ${date(end)}`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${number.format(value)}`;

function chartScale(maximum: number) {
  const raw = Math.max(1, maximum / 4);
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 5, 10].find(unit => unit * power >= raw)! * power;
  return { maximum: unit * 4, ticks: [4, 3, 2, 1, 0].map(value => value * unit) };
}

export function BehaviorInsightsPanel({ data }: { data: BehaviorInsights }) {
  const [metric, setMetric] = useState<BehaviorMetric>("views");
  const [activeDay, setActiveDay] = useState(29);
  const id = useId();
  const selectedMetric = BEHAVIOR_METRICS.find(item => item.key === metric)!;
  const active = data.daily[activeDay];
  const scale = chartScale(Math.max(...data.daily.map(day => day.counts[metric])));
  const width = 1000, height = 240;
  const x = (index: number) => index / 29 * width;
  const y = (value: number) => height - value / scale.maximum * height;
  const points = data.daily.flatMap((day, index) => day.available ? [{ x: x(index), y: y(day.counts[metric]) }] : []);
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = points.length > 1 ? `${line} L${points.at(-1)!.x},${height} L${points[0].x},${height} Z` : "";
  const firstAvailable = data.daily.findIndex(day => day.available);
  const unknownWidth = firstAvailable === -1 ? width : x(firstAvailable);
  const explore = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width) setActiveDay(Math.max(0, Math.min(29, Math.round((event.clientX - bounds.left) / bounds.width * 29))));
  };

  return <div className={styles.insights}>
    <section className={styles.surface} aria-labelledby={`${id}-daily-title`}>
      <div className={styles.heading}>
        <div><h2 id={`${id}-daily-title`}>Evolução diária</h2><p>{range(data.daily[0].day, data.today)} · Horário de Brasília</p></div>
        <span className={styles.badge}>Hoje é parcial</span>
      </div>
      <div className={styles.metricTabs} role="group" aria-label="Métrica da evolução diária">
        {BEHAVIOR_METRICS.map(item => <button key={item.key} type="button" aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}>{item.label}</button>)}
      </div>
      <div className={styles.readout} aria-live="polite" aria-atomic="true">
        <div><span>{selectedMetric.label}</span><strong>{active.available ? number.format(active.counts[metric]) : "-"}</strong></div>
        <p>{date(active.day)}{active.today ? " · Hoje, parcial" : ""}<br />{active.available ? "Eventos registrados neste dia" : "Sem histórico disponível neste dia"}</p>
      </div>
      <div className={styles.chartFrame}>
        <div className={styles.yAxis} aria-hidden="true">{scale.ticks.map(tick => <span key={tick}>{number.format(tick)}</span>)}</div>
        <div className={styles.plot}>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`} onPointerMove={explore} onPointerDown={explore}>
            <title id={`${id}-chart-title`}>{selectedMetric.label} por dia nos últimos 30 dias</title>
            <desc id={`${id}-chart-desc`}>Contagens agregadas. Hoje é parcial. A faixa sombreada indica dias anteriores ao primeiro registro. Use Explorar dia ou a tabela de valores para consultar cada data.</desc>
            {unknownWidth > 0 && <rect x="0" y="0" width={unknownWidth} height={height} className={styles.noHistory} />}
            {[0, 1, 2, 3, 4].map(index => <line key={index} x1="0" x2={width} y1={index / 4 * height} y2={index / 4 * height} className={styles.gridLine} vectorEffect="non-scaling-stroke" />)}
            {area && <path d={area} className={styles.area} />}
            {line && <path d={line} className={styles.line} vectorEffect="non-scaling-stroke" />}
            <line x1={x(activeDay)} x2={x(activeDay)} y1="0" y2={height} className={styles.cursor} vectorEffect="non-scaling-stroke" />
          </svg>
          {active.available && <span aria-hidden="true" className={styles.point} style={{ left: `${activeDay / 29 * 100}%`, top: `${100 - active.counts[metric] / scale.maximum * 100}%` }} />}
        </div>
        <div className={styles.xAxis} aria-hidden="true">{[0, 7, 14, 21, 29].map(index => <span key={index}>{index === 29 ? "Hoje" : date(data.daily[index].day)}</span>)}</div>
      </div>
      <label className={styles.explorer} htmlFor={`${id}-day`}>Explorar dia<input id={`${id}-day`} type="range" min="0" max="29" step="1" value={activeDay} aria-valuetext={`${date(active.day)}: ${active.available ? `${number.format(active.counts[metric])} ${selectedMetric.label.toLowerCase()}` : "sem histórico"}${active.today ? ", hoje parcial" : ""}`} onChange={event => setActiveDay(Number(event.target.value))} /></label>
      <p className={styles.note}>{data.firstDay ? `Primeiro registro disponível em ${date(data.firstDay)}/${data.firstDay.slice(0, 4)}. ` : "Ainda não há registros de comportamento. "}Dias anteriores ficam sem histórico. Zero indica ausência de eventos registrados, não ausência de visitantes.</p>
      <details className={styles.dailyValues}><summary>Ver valores por dia</summary><div className={styles.tableScroll}><table className={styles.table}><caption>{selectedMetric.label} por dia</caption><thead><tr><th scope="col">Data</th><th scope="col">Contagem</th><th scope="col">Observação</th></tr></thead><tbody>{data.daily.map(day => <tr key={day.day}><th scope="row">{date(day.day)}/{day.day.slice(0, 4)}</th><td>{day.available ? number.format(day.counts[metric]) : "-"}</td><td>{!day.available ? "Sem histórico" : day.today ? "Hoje, parcial" : day.day === data.firstDay ? "Início do histórico" : "Eventos registrados"}</td></tr>)}</tbody></table></div></details>
    </section>

    <section className={styles.surface} aria-labelledby={`${id}-weekly-title`}>
      <div className={styles.heading}><div><h2 id={`${id}-weekly-title`}>Semana contra semana</h2><p>Sete dias completos: {range(data.currentWeek.start, data.currentWeek.end)}<br />Período anterior: {range(data.previousWeek.start, data.previousWeek.end)}</p></div><span className={styles.badge}>Hoje fica de fora</span></div>
      {!data.previousWeek.complete && <p className={styles.historyNotice}>Histórico ainda insuficiente para calcular percentuais entre dois períodos completos. Contagens parciais aparecem identificadas abaixo.</p>}
      <div className={styles.weekGrid}>{BEHAVIOR_METRICS.map(item => {
        const variation = data.variations[item.key];
        const change = variation.reason === "history" ? "Histórico incompleto" : variation.reason === "zero-base" ? "Sem base percentual" : variation.reason === "no-events" ? "Sem eventos nos dois períodos" : `${variation.percent! > 0 ? "+" : ""}${percentage.format(variation.percent!)}%`;
        return <article className={styles.weekCard} key={item.key}>
          <h3>{item.label}</h3><div className={styles.weekNumbers}><div><span>Últimos 7 dias</span><strong>{variation.current === null ? "-" : number.format(variation.current)}</strong><small>{!data.currentWeek.availableDays ? "Sem histórico" : data.currentWeek.complete ? "Período completo" : "Histórico parcial"}</small></div><div><span>7 dias anteriores</span><strong>{variation.previous === null ? "-" : number.format(variation.previous)}</strong><small>{!data.previousWeek.availableDays ? "Sem histórico" : data.previousWeek.complete ? "Período completo" : "Histórico parcial"}</small></div></div>
          <p className={styles.change}>{change}</p>{variation.difference !== null && <p className={styles.difference}>{signed(variation.difference)} {variation.difference === 1 || variation.difference === -1 ? "ocorrência" : "ocorrências"} em relação ao período anterior</p>}
        </article>;
      })}</div>
      <p className={styles.note}>Percentuais exigem dois períodos completos após o primeiro registro. As variações mostram volume de eventos, sem identificar pessoas ou comprovar vendas, satisfação ou sucesso de uma ação.</p>
    </section>
  </div>;
}
