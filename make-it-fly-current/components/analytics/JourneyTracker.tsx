import { BehaviorTracker } from "./BehaviorTracker";

// Runtime gate: preparing code never starts production collection.
export function JourneyTracker() {
  if (process.env.APOGEE_BEHAVIOR_ENABLED !== "true") return null;
  return <BehaviorTracker />;
}
