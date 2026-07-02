require("dotenv").config();

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, spawnSync, execFile } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const url = `http://localhost:${port}`;
const logDir = path.join(rootDir, "logs");
const serverLog = path.join(logDir, "stockflow-server.log");
const launcherLog = path.join(logDir, "stockflow-launcher.log");

fs.mkdirSync(logDir, { recursive: true });

function appendLog(message) {
  fs.appendFileSync(launcherLog, `[${new Date().toISOString()}] ${message}\n`);
}

function openBrowser() {
  execFile("cmd.exe", ["/c", "start", "", url], { windowsHide: true });
}

function isRunning() {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function waitForServer() {
  return new Promise((resolve) => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (await isRunning()) {
        clearInterval(timer);
        resolve(true);
      }

      if (attempts >= 20) {
        clearInterval(timer);
        resolve(false);
      }
    }, 500);
  });
}

function runCommand(command, args) {
  const log = fs.openSync(launcherLog, "a");
  try {
    return spawnSync(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", log, log],
      windowsHide: true,
      timeout: 45000
    });
  } finally {
    fs.closeSync(log);
  }
}

function startServer() {
  const log = fs.openSync(serverLog, "a");
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: process.env,
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true
  });

  child.unref();
  fs.closeSync(log);
  appendLog(`Servidor iniciado em segundo plano. PID: ${child.pid}`);
}

async function main() {
  appendLog("Abrindo StockFlow.");

  if (await isRunning()) {
    appendLog("Servidor ja estava rodando.");
    openBrowser();
    return;
  }

  if (!fs.existsSync(path.join(rootDir, "node_modules"))) {
    appendLog("Instalando dependencias.");
    const install = runCommand("npm.cmd", ["install"]);
    appendLog(`npm install finalizou com codigo ${install.status}.`);
  }

  appendLog("Preparando banco de dados.");
  const dbInit = runCommand("npm.cmd", ["run", "db:init"]);
  appendLog(`db:init finalizou com codigo ${dbInit.status}.`);

  startServer();

  if (await waitForServer()) {
    openBrowser();
  } else {
    appendLog("Servidor nao respondeu dentro do tempo esperado.");
    openBrowser();
  }
}

main().catch((error) => {
  appendLog(error.stack || error.message || String(error));
  openBrowser();
});
