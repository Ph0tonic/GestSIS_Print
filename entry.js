async function loadApp() {
    const { app } = await import("./app.cjs");
}
loadApp()