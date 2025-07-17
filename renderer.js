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
  <div class="min-h-screen bg-gray-900 text-white font-mono flex items-center justify-center p-4">
    <div class="bg-gray-800 shadow-lg rounded-lg p-6 max-w-md w-full space-y-6">
      <h2 class="text-2xl font-bold text-indigo-300 text-center">Bot Settings</h2>

      <div class="flex items-center space-x-2">
        <input type="checkbox" id="autoStash" class="h-5 w-5 text-indigo-600 border-gray-300 rounded" />
        <label for="autoStash" class="text-white font-medium">Deposit Earnings to Stash</label>
      </div>

      <div class="flex flex-col">
        <label for="risk" class="mb-1 text-white font-medium">Case Risk %</label>
        <select
          id="risk"
          class="p-2 rounded-md text-black border border-indigo-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        >
          <option value="5">5%</option>
          <option value="10">10%</option>
          <option value="20">20%</option>
          <option value="25">25%</option>
          <option value="40">40%</option>
          <option value="50">50%</option>
          <option value="60">60%</option>
        </select>
      </div>

      <button
        id="runBot"
        class="w-full py-2 px-4 bg-indigo-900 text-white font-semibold rounded-md hover:bg-blue-800 transition hover:scale-105"
      >
        Run Bot
      </button>
    </div>
  </div>
`;

  document.getElementById("runBot").addEventListener("click", () => {
    const autoStash = document.getElementById("autoStash").checked;
    const risk = parseInt(document.getElementById("risk").value, 10);

    ipcRenderer.send("run-bot", { autoStash, risk });
  });
});
