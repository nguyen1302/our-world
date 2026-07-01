import { claimNext, completeJob, failJob } from "@/lib/jobs";
import { processPhoto } from "./processPhoto";

const POLL_MS = 2000;
let running = true;

async function handle(job: { id: string; type: string; payload: any; attempts: number }) {
  try {
    if (job.type === "process_photo") {
      await processPhoto(job.payload.photoId, job.payload.fallbackMemoryId);
    } else {
      throw new Error(`unknown job type: ${job.type}`);
    }
    await completeJob(job.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`job ${job.id} failed: ${msg}`);
    await failJob(job.id, job.attempts, msg);
  }
}

async function loop() {
  console.log("worker started");
  while (running) {
    let job = null;
    try {
      job = await claimNext();
    } catch (e) {
      console.error("claim failed:", e);
    }
    if (job) {
      await handle(job);
    } else {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  console.log("worker stopped");
}

function shutdown() {
  running = false;
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
