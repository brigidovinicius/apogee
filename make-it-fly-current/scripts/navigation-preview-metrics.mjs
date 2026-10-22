import { appendFileSync } from "node:fs";
import { getHeapStatistics } from "node:v8";

if (process.env.APOGEE_PREVIEW_METRICS_FILE) {
  const sample = () => appendFileSync(process.env.APOGEE_PREVIEW_METRICS_FILE, JSON.stringify({
    at: new Date().toISOString(), pid: process.pid, uptime: process.uptime(),
    ...process.memoryUsage(), heapLimit: getHeapStatistics().heap_size_limit,
  }) + "\n");
  sample();
  setInterval(sample, 5000).unref();
  process.once("exit", sample);
}
