"use client";
import { flushBehavior, trackBehavior } from "./behavior-client";

// Compatibility adapter for the application UI. Context is never copied.
export function trackJourney(eventName: string, context = "", step: number | null = null) {
  void context; // Deliberately discard legacy free-form context.
  if (eventName === "cta_click") { trackBehavior("action", "application_start"); return; }
  const targets: Record<string, string> = {
    form_view: "view", form_started: "started", form_validation_error: "validation_error",
    form_submit_started: "submit_started", form_submit_succeeded: "submit_succeeded", form_submit_failed: "submit_failed",
  };
  const target = eventName === "form_step_completed" && step && [1, 2, 3].includes(step) ? `step_${step}` : targets[eventName];
  if (target) trackBehavior("form_progress", target);
}
export const flushJourneyEvents = flushBehavior;
