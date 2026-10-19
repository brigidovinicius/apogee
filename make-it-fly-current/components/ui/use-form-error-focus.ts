"use client";

import { useEffect, useRef } from "react";

/** Keep server validation within reach after a form action resets browser focus. */
export function useFormErrorFocus(state: { errors?: Record<string, string | undefined>; message?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const fieldName = Object.keys(state.errors ?? {})[0];
    const field = fieldName ? formRef.current?.elements.namedItem(fieldName) : null;
    if (field instanceof HTMLElement) {
      field.focus();
    } else if (state.message) {
      formRef.current?.querySelector<HTMLElement>("[data-form-message]")?.focus();
    }
  }, [state]);
  return formRef;
}
