import { defineConfig } from "vitest/config";

// Integration suites share one seeded event (check-in inserts and removes attendees that the
// listings paging test is reading), so files run one at a time. The suite is small and fast.
export default defineConfig({
  test: { environment: "node", fileParallelism: false },
});
