"use client";

import { useActionState } from "react";
import { saveRadarPreferences } from "@/app/membros/perfil/radar/actions";
import { BRAZILIAN_STATE_CODES } from "@/lib/opportunities/location";
import { AREAS, OPPORTUNITY_CATEGORIES } from "@/lib/opportunities/vocabulary";
import {
  RADAR_EMAIL_OPTIONS, RADAR_FORMATS, RADAR_PROFILES, RADAR_STAGES,
  type RadarEmail, type RadarPreferences,
} from "@/lib/opportunities/radar-preferences";
import styles from "./radar-personalization.module.css";

function PreferencesGroup({ label, name, options, checked }: {
  label: string; name: string; options: readonly (readonly [string, string])[]; checked: readonly string[];
}) {
  return <fieldset className={styles.group}>
    <legend>{label}</legend>
    <div className={styles.options}>
      {options.map(([value, title]) => <label className={styles.option} key={value}>
        <input type="checkbox" name={name} value={value} defaultChecked={checked.includes(value)} />
        {title}
      </label>)}
    </div>
  </fieldset>;
}

export function RadarPreferencesForm({ settings, email, canEnableEmail }: {
  settings: RadarPreferences; email: RadarEmail; canEnableEmail: boolean;
}) {
  const [state, action, pending] = useActionState(saveRadarPreferences, {});
  return <form className={styles.form} action={action}>
    <PreferencesGroup label="Como você se identifica?" name="profiles" options={Object.entries(RADAR_PROFILES)} checked={settings.profiles} />
    <div className={styles.fields}>
      <label>Curso ou área de formação
        <input name="course" maxLength={100} defaultValue={settings.course} placeholder="Ciência da Computação" />
      </label>
      <label>Etapa da formação
        <select name="stage" defaultValue={settings.stage}>
          <option value="">Prefiro não informar</option>
          {Object.entries(RADAR_STAGES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <PreferencesGroup label="Quais assuntos você acompanha?" name="interests" options={Object.entries(AREAS)} checked={settings.interests} />
    <PreferencesGroup label="Quais tipos de oportunidade você quer ver?" name="categories"
      options={OPPORTUNITY_CATEGORIES.map(({ id, label }) => [id, label])} checked={settings.categories} />
    <fieldset className={styles.group}>
      <legend>Onde você consegue participar?</legend>
      <div className={styles.fields}>
        <label>Modalidade
          <select name="format" defaultValue={settings.format}>
            {Object.entries(RADAR_FORMATS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Estado
          <select name="state" defaultValue={settings.stateCode ?? ""}>
            <option value="">Selecione</option>
            {BRAZILIAN_STATE_CODES.map(code => <option key={code}>{code}</option>)}
          </select>
        </label>
        <label>Cidade (opcional)
          <input name="city" maxLength={80} defaultValue={settings.cityName ?? ""} />
        </label>
      </div>
    </fieldset>
    {(canEnableEmail || email !== "off") && <label className={styles.mail}>Avisos por e-mail
      <select name="email" defaultValue={email}>
        {Object.entries(RADAR_EMAIL_OPTIONS).filter(([key]) => canEnableEmail || key === email || key === "off")
          .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {!canEnableEmail && <small>O envio está temporariamente pausado.</small>}
    </label>}
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    <button type="submit" data-ap-button="primary" disabled={pending}>
      {pending ? "Salvando…" : "Salvar preferências do Radar"}
    </button>
  </form>;
}
