async function loadApp() {
  const { app } = await import("./app.mjs");
}
loadApp();
