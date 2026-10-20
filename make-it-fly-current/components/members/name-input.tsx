"use client";
import { useState, type InputHTMLAttributes } from "react";
import { nameSchema, NAME_ERROR } from "@/lib/members/validation";

export function NameInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [error, setError] = useState<string>();
  const errorId = `${props.id ?? "name"}-client-error`;
  return <>
    <input {...props} name="name" autoComplete="name" required maxLength={200}
      aria-invalid={error ? true : props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
      onChange={(event) => {
        const message = nameSchema.safeParse(event.currentTarget.value).success ? "" : NAME_ERROR;
        event.currentTarget.setCustomValidity(message);
        setError(message || undefined);
        props.onChange?.(event);
      }}
      onBlur={(event) => {
        const message = nameSchema.safeParse(event.currentTarget.value).success ? "" : NAME_ERROR;
        event.currentTarget.setCustomValidity(message);
        setError(message || undefined);
        props.onBlur?.(event);
      }} />
    {error && <span id={errorId} role="alert">{error}</span>}
  </>;
}
