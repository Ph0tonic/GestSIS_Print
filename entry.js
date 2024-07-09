async function loadApp() {
    const { app } = await import("./app.js");
}
loadApp()