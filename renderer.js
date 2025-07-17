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
    const rememberMe = document.getElementById("rememberMe").checked;

    ipcRenderer.send("credentials-entered", {
      email,
      password,
      remember: rememberMe,
    });
  });
});

ipcRenderer.on("load-credentials", (event, creds) => {
  document.getElementById("email").value = creds.email || "";
  document.getElementById("password").value = creds.password || "";
  document.getElementById("rememberMe").checked = true;
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
  <select id="risk" class="p-2 mb-2 focus:scale-105 rounded-md text-black border-2 border-indigo-400 focus:outline-none focus:border-blue-800 transition-all ease-in-out">
    <option value="5">5%</option>
    <option value="10">10%</option>
    <option value="20">20%</option>
    <option value="25">25%</option>
    <option value="40">40%</option>
    <option value="50">50%</option>
    <option value="60">60%</option>
  </select>
  <br />
  <button id="runBot" class="shadow-md rounded-md bg-indigo-900 p-2 hover:bg-blue-800">Run Bot</button>
`;

  document.getElementById("runBot").addEventListener("click", () => {
    const autoStash = document.getElementById("autoStash").checked;
    const risk = parseInt(document.getElementById("risk").value, 10);

    ipcRenderer.send("run-bot", { autoStash, risk });
  });
});
