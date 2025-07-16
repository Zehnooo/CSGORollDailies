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
  <h2>Bot Settings</h2>
  <label>
    <input type="checkbox" id="autoStash" />
    Deposit Earnings to Stash
  </label>
  <br />

  <label for="risk">Case Risk %:</label>
  <select id="risk">
    <option value="5">5%</option>
    <option value="10">10%</option>
    <option value="20">20%</option>
    <option value="25">25%</option>
    <option value="40">40%</option>
    <option value="50">50%</option>
    <option value="60">60%</option>
  </select>
  <br />
  <button id="runBot">Run Bot</button>
`;

  document.getElementById("runBot").addEventListener("click", () => {
    const autoStash = document.getElementById("autoStash").checked;
    const risk = parseInt(document.getElementById("risk").value, 10);

    ipcRenderer.send("run-bot", { autoStash, risk });
  });
});
