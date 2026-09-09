export async function register() {
  // Keep the import inside the check: webpack constant-folds NEXT_RUNTIME per layer, so the
  // edge bundle never pulls in mysql2 through the job loop.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobLoop } = await import("./lib/notifications/loop");
    startJobLoop();
  }
}
