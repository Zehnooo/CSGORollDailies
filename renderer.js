const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) {
    console.error("Login form not found in DOM");
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    ipcRenderer.send("credentials-entered", { email, password });
  });
});

ipcRenderer.on("show-settings", () => {
  document.body.innerHTML = `
    <h2>Settings</h2>
    <label><input type="checkbox" id="autoStash" /> Auto Stash Coins</label><br>
    <label>Risk %: <input type="range" id="risk" min="1" max="100" value="50" /></label><br>
    <button id="runBot">Run Bot</button>
  `;

  document.getElementById("runBot").addEventListener("click", () => {
    const autoStash = document.getElementById("autoStash").checked;
    const risk = parseInt(document.getElementById("risk").value, 10);

    ipcRenderer.send("run-bot", { autoStash, risk });
  });
});
