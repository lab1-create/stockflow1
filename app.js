const STORAGE_KEY = "stockflow-state-v2";
const API_BASE = "/api";
const LIVE_CHANNEL = "stockflow-live";
const TECHNICIAN_DESTINATIONS = {
  Luiz: "Bancada 01",
  Henrique: "Bancada 02",
  Joao: "Bancada 03",
  Gabriel: "Bancada 04"
};

const seedState = {
  users: [
    { name: "Administrador", role: "admin" },
    { name: "Luiz", role: "tecnico" },
    { name: "Henrique", role: "tecnico" },
    { name: "Joao", role: "tecnico" },
    { name: "Gabriel", role: "tecnico" }
  ],
  technicians: ["Luiz", "Henrique", "Joao", "Gabriel"],
  destinations: ["Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Servico interno", "Estoque de testes", "Outro"],
  adminName: "Administrador",
  items: [],
  history: [],
  requests: [],
  usageKpis: []
};

let state = structuredClone(seedState);
let usingApi = false;
let currentUser = null;
let currentView = "dashboard";
let withdraw = { step: 0, technician: "", destination: "", item: null, qty: 1 };
let activeRequest = null;
let refreshTimer = null;
let liveEvents = null;
let localEvents = null;
let applyingRemoteState = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(seedState);

  try {
    return { ...structuredClone(seedState), ...JSON.parse(stored) };
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  if (!usingApi) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!applyingRemoteState) {
      localEvents?.postMessage({ type: "state", state });
    }
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro na API.");
  return data;
}

async function loadInitialState() {
  try {
    replaceState(await apiRequest("/bootstrap"));
    usingApi = true;
  } catch {
    state = loadState();
    usingApi = false;
  }
}

function replaceState(nextState) {
  state = { ...structuredClone(seedState), ...nextState };
  saveState();
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function allowedViews() {
  if (isAdmin()) return ["dashboard", "withdraw", "return", "replenish", "items", "history"];
  return ["withdraw", "return"];
}

function assignedDestination(name) {
  return TECHNICIAN_DESTINATIONS[name] || "Bancada 01";
}

function rememberActiveRequest(request) {
  activeRequest = request;
  if (request) {
    sessionStorage.setItem("stockflow-active-request", JSON.stringify(request));
  } else {
    sessionStorage.removeItem("stockflow-active-request");
  }
}

function restoreActiveRequest() {
  const stored = sessionStorage.getItem("stockflow-active-request");
  if (!stored) return;

  try {
    activeRequest = JSON.parse(stored);
  } catch {
    rememberActiveRequest(null);
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function findItem(code) {
  return state.items.find((item) => item.code.toLowerCase() === normalize(code));
}

function statusFor(item) {
  if (item.qty <= item.min) return { label: "CRITICO", className: "critical" };
  if (item.qty <= item.min + 2) return { label: "ATENCAO", className: "warning" };
  return { label: "NORMAL", className: "" };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function daysBetween(start, end) {
  return Math.floor((new Date(end) - new Date(start)) / 86400000);
}

function usageInsight(request) {
  const kpi = (state.usageKpis || []).find((entry) => {
    return entry.itemCode === request.itemCode && entry.technician === request.technician;
  });
  const lastWithdrawal = state.history
    .filter((entry) => entry.type === "Retirada" && entry.itemCode === request.itemCode && entry.user === request.technician)
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];

  const expectedDays = kpi?.averageDays || null;
  if (!lastWithdrawal || !expectedDays) return { label: "Sem historico suficiente", className: "" };

  const elapsedDays = daysBetween(lastWithdrawal.at, request.at || new Date().toISOString());
  if (elapsedDays < expectedDays) {
    return {
      label: `OBSERVACAO: ${elapsedDays}d de uso, esperado ${expectedDays}d`,
      className: "warning"
    };
  }

  return { label: `Dentro do tempo medio: ${elapsedDays}d`, className: "" };
}

function filteredItems() {
  const query = normalize($("#global-search").value);
  if (!query) return state.items;
  return state.items.filter((item) => {
    return [item.code, item.name, item.category, item.supplier, item.note].some((field) => normalize(field).includes(query));
  });
}

function filteredHistory() {
  const query = normalize($("#global-search").value);
  const technician = $("#technician-filter")?.value || "";
  return state.history.filter((entry) => {
    const matchesSearch = !query || [entry.user, entry.type, entry.itemName, entry.itemCode, entry.destination].some((field) => normalize(field).includes(query));
    const matchesTechnician = !technician || entry.user === technician;
    return matchesSearch && matchesTechnician;
  });
}

function setView(view) {
  if (!allowedViews().includes(view)) view = allowedViews()[0];
  currentView = view;
  $$(".view").forEach((node) => node.classList.toggle("active", node.id === `${view}-view`));
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("#view-title").textContent = {
    dashboard: "Dashboard",
    withdraw: "Retirar Insumo",
    return: "Devolver Insumo",
    replenish: "Repor Estoque",
    items: "Insumos",
    history: "Historico"
  }[view];

  if (view === "withdraw") {
    withdraw = {
      step: isAdmin() ? 0 : 2,
      technician: isAdmin() ? "" : currentUser.name,
      destination: isAdmin() ? "" : assignedDestination(currentUser.name),
      item: null,
      qty: 1
    };
    renderWithdraw();
  }

  if (view === "return") setTimeout(() => $("#return-code")?.focus(), 50);
  if (view === "replenish") renderReplenishStart();

  renderAll();
}

function applyRoleUi() {
  const allowed = allowedViews();
  $$(".nav-item").forEach((button) => {
    button.hidden = !allowed.includes(button.dataset.view);
  });
  $$("[data-view-jump]").forEach((button) => {
    button.hidden = !allowed.includes(button.dataset.viewJump);
  });

  $("#session-label").textContent = currentUser
    ? `${currentUser.name} - ${isAdmin() ? "Administrador" : "Tecnico"}`
    : "Operacao rapida ativa";
}

function applyLiveState(nextState) {
  const previousState = state;
  applyingRemoteState = true;
  replaceState(nextState);
  applyingRemoteState = false;
  detectReleasedRequest(previousState, state);
  applyRoleUi();
  renderAll();
}

function detectReleasedRequest(previousState, nextState) {
  if (!currentUser || isAdmin() || !activeRequest) return;
  if (activeRequest.technician !== currentUser.name) return;

  const stillPending = (nextState.requests || []).some((request) => {
    return request.status === "pending"
      && (String(request.id) === String(activeRequest.id)
        || (request.technician === activeRequest.technician
          && request.itemCode === activeRequest.itemCode
          && request.destination === activeRequest.destination
          && Number(request.qty) === Number(activeRequest.qty)));
  });
  if (stillPending) return;

  const released = (nextState.history || []).find((entry) => {
    return entry.type === "Retirada"
      && entry.user === activeRequest.technician
      && entry.itemCode === activeRequest.itemCode
      && entry.destination === activeRequest.destination
      && new Date(entry.at) >= new Date(activeRequest.at);
  });

  if (!released) return;

  rememberActiveRequest(null);
  showReleasedScreen({
    itemName: released.itemName,
    itemCode: released.itemCode,
    destination: released.destination,
    qty: released.qty
  });
}

function showActiveRequestIfPending() {
  if (!currentUser || isAdmin() || !activeRequest) return;
  const pending = (state.requests || []).find((request) => {
    return String(request.id) === String(activeRequest.id)
      || (request.technician === activeRequest.technician
        && request.itemCode === activeRequest.itemCode
        && request.destination === activeRequest.destination
        && Number(request.qty) === Number(activeRequest.qty));
  });
  if (!pending) {
    detectReleasedRequest(state, state);
    return;
  }

  withdraw = {
    step: 2,
    technician: pending.technician,
    destination: pending.destination,
    item: findItem(pending.itemCode),
    qty: pending.qty
  };
  showWaitingApprovalScreen({
    name: pending.itemName
  });
}

function setupLocalRealtime() {
  if ("BroadcastChannel" in window) {
    localEvents = new BroadcastChannel(LIVE_CHANNEL);
    localEvents.addEventListener("message", (event) => {
      if (usingApi || event.data?.type !== "state") return;
      applyLiveState(event.data.state);
    });
  }

  window.addEventListener("storage", (event) => {
    if (usingApi || event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      applyLiveState(JSON.parse(event.newValue));
    } catch {
      /* Mantem o estado atual se outra aba gravar algo invalido. */
    }
  });
}

function renderAll() {
  renderDashboard();
  renderItems();
  renderHistory();
  renderTechnicianFilter();
}

function renderDashboard() {
  const items = filteredItems();
  const stockTotal = state.items.reduce((sum, item) => sum + Number(item.qty), 0);
  const critical = state.items.filter((item) => item.qty <= item.min);
  const withdrawalsToday = state.history.filter((entry) => entry.type === "Retirada").length;

  $("#metric-total-items").textContent = state.items.length;
  $("#metric-critical").textContent = critical.length;
  $("#metric-withdrawals").textContent = withdrawalsToday;
  $("#metric-stock").textContent = stockTotal.toLocaleString("pt-BR");
  renderPendingRequests();
  renderUsageKpis();

  $("#critical-list").innerHTML = critical.length
    ? critical.map((item) => compactItemRow(item)).join("")
    : `<p class="muted">Nenhum item critico no momento.</p>`;

  const history = filteredHistory().slice(0, 6);
  $("#recent-history").innerHTML = history.length
    ? history.map(historyRow).join("")
    : `<p class="muted">Nenhuma movimentacao encontrada.</p>`;

  if (currentView === "dashboard" && $("#global-search").value && items.length === 0) {
    $("#critical-list").innerHTML = `<p class="muted">Busca sem resultados em insumos.</p>`;
  }
}

function renderPendingRequests() {
  const requests = (state.requests || []).filter((request) => request.status === "pending");
  $("#pending-count").textContent = `${requests.length} pendente${requests.length === 1 ? "" : "s"}`;
  $("#pending-requests").innerHTML = requests.length
    ? requests.map((request) => {
        const insight = usageInsight(request);
        return `
          <article class="request-card">
            <div>
              <strong>${request.technician} solicitou ${request.itemName}</strong>
              <span>${request.itemCode} - ${request.destination} - ${request.qty} un. - ${formatDate(request.at)}</span>
              <span class="pill ${insight.className}">${insight.label}</span>
            </div>
            <div class="scan-row">
              <input class="request-scan scan-input" data-request-code="${request.id}" placeholder="Bipe ${request.itemCode}">
              <button class="primary-action" data-approve-request="${request.id}">Liberar</button>
            </div>
          </article>
        `;
      }).join("")
    : `<p class="muted">Nenhuma solicitacao pendente agora.</p>`;

  $$("[data-approve-request]").forEach((button) => {
    button.addEventListener("click", () => approveRequest(button.dataset.approveRequest));
  });
  $$(".request-scan").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") approveRequest(input.dataset.requestCode);
    });
  });
}

function renderUsageKpis() {
  const rows = state.usageKpis || [];
  $("#usage-kpis").innerHTML = rows.length
    ? rows.map((row) => {
        const status = row.averageDays < 60 ? { label: "OBSERVACAO", className: "warning" } : { label: "NORMAL", className: "" };
        return `
          <div class="table-row">
            <strong>${row.itemName}</strong>
            <span>${row.technician}</span>
            <span>${row.averageDays || "-"} dias</span>
            <span class="pill ${status.className}">${status.label}</span>
          </div>
        `;
      }).join("")
    : `<p class="muted">Ainda nao ha historico suficiente para calcular tempo medio.</p>`;
}

function compactItemRow(item) {
  const status = statusFor(item);
  return `
    <div class="compact-row">
      <strong>${item.name}</strong>
      <span>${item.code}</span>
      <span>${item.qty}/${item.min}</span>
      <span class="pill ${status.className}">${status.label}</span>
    </div>
  `;
}

function historyRow(entry) {
  return `
    <div class="table-row">
      <strong>${entry.itemName}</strong>
      <span>${entry.user}</span>
      <span>${entry.type}</span>
      <span>${entry.qty} un. - ${formatDate(entry.at)}</span>
    </div>
  `;
}

function renderWithdraw() {
  $("#withdraw-stepper").innerHTML = [0, 1, 2, 3].map((step) => `<span class="step ${step <= withdraw.step ? "done" : ""}"></span>`).join("");

  if (withdraw.step === 0) {
    $("#withdraw-content").innerHTML = `
      <div class="flow-title">
        <p class="eyebrow">Etapa 1</p>
        <h2>Quem vai utilizar?</h2>
      </div>
      <div class="choice-grid">
        ${state.technicians.map((name) => `<button class="choice" data-technician="${name}">${name}</button>`).join("")}
      </div>
    `;
    $$("[data-technician]").forEach((button) => {
      button.addEventListener("click", () => {
        withdraw.technician = button.dataset.technician;
        withdraw.destination = assignedDestination(withdraw.technician);
        withdraw.step = 2;
        renderWithdraw();
        setTimeout(() => $("#withdraw-code")?.focus(), 50);
      });
    });
    return;
  }

  if (withdraw.step === 1) {
    $("#withdraw-content").innerHTML = `
      <div class="flow-title">
        <p class="eyebrow">Etapa 2 - ${withdraw.technician}</p>
        <h2>Para qual destino?</h2>
      </div>
      <div class="choice-grid">
        ${state.destinations.map((name) => `<button class="choice" data-destination="${name}">${name}</button>`).join("")}
      </div>
    `;
    $$("[data-destination]").forEach((button) => {
      button.addEventListener("click", () => {
        withdraw.destination = button.dataset.destination;
        withdraw.step = 2;
        renderWithdraw();
        setTimeout(() => $("#withdraw-code")?.focus(), 50);
      });
    });
    return;
  }

  if (withdraw.step === 2) {
    $("#withdraw-content").innerHTML = `
      <div class="flow-title">
        <p class="eyebrow">${withdraw.technician} - ${withdraw.destination}</p>
        <h2>Aguardando leitura...</h2>
      </div>
      <div class="scan-row">
        <input id="withdraw-code" class="scan-input" placeholder="Bipe ou digite o codigo">
        <button id="scan-button" class="primary-action">Identificar</button>
      </div>
      <div class="result-box muted">Bipe ou digite o codigo do produto cadastrado.</div>
    `;
    $("#scan-button").addEventListener("click", identifyWithdrawItem);
    $("#withdraw-code").addEventListener("keydown", (event) => {
      if (event.key === "Enter") identifyWithdrawItem();
    });
    setTimeout(() => $("#withdraw-code")?.focus(), 50);
    return;
  }

  const item = withdraw.item;
  const status = statusFor(item);
  $("#withdraw-content").innerHTML = `
    <div class="flow-title">
      <p class="eyebrow">Etapa 4</p>
      <h2 style="font-size:1.5rem;">Confirmar retirada?</h2>
    </div>
    <div class="confirm-box">
      <div class="item-preview">
        <strong>${item.name}</strong>
        <span>Codigo ${item.code} - Estoque atual: ${item.qty}</span>
        <span class="pill ${status.className}">${status.label}</span>
      </div>
      <label class="qty-row">
        Quantidade
        <input id="withdraw-qty" type="number" min="1" max="${item.qty}" value="${withdraw.qty}">
      </label>
      <button id="confirm-withdraw" class="primary-action wide" ${item.qty <= 0 ? "disabled" : ""}>Confirmar</button>
      ${item.qty <= 0 ? `<p class="muted">Sem estoque disponivel para retirada.</p>` : ""}
    </div>
  `;
  $("#confirm-withdraw").addEventListener("click", confirmWithdraw);
}

function showWaitingApprovalScreen(item) {
  $("#withdraw-content").innerHTML = `
    <div class="status-screen waiting">
      <span class="status-signal"></span>
      <p class="eyebrow">Solicitacao enviada</p>
      <h2>Aguardando liberacao do ADM</h2>
      <div class="result-box">
        <strong>${item.name}</strong><br>
        ${withdraw.destination} - ${withdraw.qty} unidade(s)
      </div>
    </div>
  `;
}

function showReleasedScreen(released) {
  setView("withdraw");
  $("#withdraw-content").innerHTML = `
    <div class="status-screen released">
      <span class="status-signal"></span>
      <p class="eyebrow">Liberado para uso</p>
      <h2>Insumo liberado</h2>
      <div class="result-box">
        <strong>${released.itemName}</strong><br>
        ${released.itemCode} - ${released.destination} - ${released.qty} unidade(s)
      </div>
      <button class="primary-action wide" id="new-withdraw">Nova solicitacao</button>
    </div>
  `;
  $("#new-withdraw").addEventListener("click", () => setView("withdraw"));
}

function identifyWithdrawItem() {
  const item = findItem($("#withdraw-code").value);
  if (!item) {
    $(".result-box").textContent = "Insumo nao encontrado.";
    return;
  }

  withdraw.item = item;
  withdraw.qty = 1;
  withdraw.step = 3;
  renderWithdraw();
}

async function confirmWithdraw() {
  const qty = Math.max(1, Number($("#withdraw-qty").value || 1));
  const item = findItem(withdraw.item.code);
  if (!item || item.qty < qty) return;
  withdraw.qty = qty;

  try {
    if (usingApi) {
      const nextState = await apiRequest("/movements/withdraw", {
        method: "POST",
        body: JSON.stringify({
          code: item.code,
          technician: withdraw.technician,
          destination: withdraw.destination,
          quantity: qty
        })
      });
      replaceState(nextState);
      const request = (state.requests || []).find((entry) => {
        return entry.status === "pending"
          && entry.technician === withdraw.technician
          && entry.itemCode === item.code
          && entry.destination === withdraw.destination
          && Number(entry.qty) === qty;
      });
      rememberActiveRequest(request || {
        id: `pending-${Date.now()}`,
        at: new Date().toISOString(),
        technician: withdraw.technician,
        itemCode: item.code,
        itemName: item.name,
        destination: withdraw.destination,
        qty,
        status: "pending"
      });
    } else {
      const request = {
        id: `local-${Date.now()}`,
        at: new Date().toISOString(),
        technician: withdraw.technician,
        qty,
        itemCode: item.code,
        itemName: item.name,
        destination: withdraw.destination,
        status: "pending"
      };
      state.requests.unshift(request);
      rememberActiveRequest(request);
      saveState();
    }
  } catch (error) {
    $("#withdraw-content").insertAdjacentHTML("beforeend", `<div class="result-box">${error.message}</div>`);
    return;
  }

  renderAll();
  showWaitingApprovalScreen(item);
}

async function approveRequest(requestId) {
  const request = (state.requests || []).find((entry) => entry.id === requestId);
  if (!request) return;

  const input = $(`[data-request-code="${requestId}"]`);
  const scannedCode = input?.value?.trim();
  if (!scannedCode) {
    input?.focus();
    return;
  }

  if (normalize(scannedCode) !== normalize(request.itemCode)) {
    input.value = "";
    input.placeholder = `Codigo errado. Bipe ${request.itemCode}`;
    input.focus();
    return;
  }

  try {
    if (usingApi) {
      replaceState(await apiRequest(`/requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ code: scannedCode, adminName: currentUser?.name || "Administrador" })
      }));
    } else {
      const item = findItem(request.itemCode);
      if (!item || item.qty < request.qty) throw new Error("Estoque insuficiente.");
      const before = item.qty;
      item.qty -= request.qty;
      request.status = "approved";
      state.history.unshift({
        at: new Date().toISOString(),
        user: request.technician,
        type: "Retirada",
        qty: request.qty,
        itemCode: request.itemCode,
        itemName: request.itemName,
        destination: request.destination
      });
      state.requests = state.requests.filter((entry) => entry.id !== requestId);
      saveState();
      if ($("#replenish-result")) {
        $("#replenish-result").textContent = `${request.itemName}: ${before} -> ${item.qty}`;
      }
    }
  } catch (error) {
    input.value = "";
    input.placeholder = error.message;
    input.focus();
    return;
  }

  renderAll();
}

function renderItems() {
  const items = filteredItems();
  $("#items-grid").innerHTML = items.length
    ? items.map((item) => {
        const status = statusFor(item);
        return `
          <article class="item-card">
            <div class="panel-head">
              <h3>${item.name}</h3>
              <span class="pill ${status.className}">${status.label}</span>
            </div>
            <div class="item-meta">
              <span>Codigo: ${item.code}</span>
              <span>Categoria: ${item.category}</span>
              <span>Atual: ${item.qty}</span>
              <span>Minimo: ${item.min}</span>
              <span>Fornecedor: ${item.supplier || "Opcional"}</span>
              <span>${item.note || "Sem observacao"}</span>
            </div>
            <div class="item-actions">
              <button class="ghost-action" data-withdraw-code="${item.code}">Retirar</button>
              <button class="ghost-action" data-edit-code="${item.code}">Editar</button>
              <button class="ghost-action" data-history-code="${item.code}">Historico</button>
            </div>
          </article>
        `;
      }).join("")
    : `<p class="muted">Nenhum insumo encontrado.</p>`;

  $$("[data-edit-code]").forEach((button) => button.addEventListener("click", () => openItemDialog(findItem(button.dataset.editCode))));
  $$("[data-withdraw-code]").forEach((button) => button.addEventListener("click", () => {
    setView("withdraw");
    withdraw.step = 2;
    renderWithdraw();
    $("#withdraw-code").value = button.dataset.withdrawCode;
    identifyWithdrawItem();
  }));
  $$("[data-history-code]").forEach((button) => button.addEventListener("click", () => {
    $("#global-search").value = button.dataset.historyCode;
    setView("history");
  }));
}

function renderHistory() {
  const rows = filteredHistory();
  $("#history-table").innerHTML = rows.length
    ? rows.map(historyRow).join("")
    : `<p class="muted">Nenhuma movimentacao encontrada.</p>`;
}

function renderTechnicianFilter() {
  const select = $("#technician-filter");
  if (!select) return;
  const selected = select.value;
  select.innerHTML = `<option value="">Todos os tecnicos</option>${state.technicians.map((name) => `<option value="${name}">${name}</option>`).join("")}`;
  select.value = selected;
}

function renderLoginUsers() {
  // Mantida sem ação conforme sua estrutura de campo de texto livre
}

async function handleLogin(event) {
  event.preventDefault();
  const name = $("#login-user").value.trim(); 
  const pin = $("#login-pin").value.trim();
  const error = $("#login-error");
  error.textContent = "";

  if (!name) {
    error.textContent = "Por favor, digite o seu nome de usuário.";
    return;
  }

  try {
    if (usingApi) {
      const result = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ name, pin })
      });
      replaceState(result.state);
      currentUser = result.user;
    } else {
      const user = (state.users || seedState.users).find((entry) => normalize(entry.name) === normalize(name));
      if (!user) throw new Error("Usuário não encontrado no sistema local.");
      
      const expectedPin = user?.role === "admin" ? "0000" : "1111";
      if (pin !== expectedPin) throw new Error("Senha / PIN incorreto.");
      currentUser = user;
    }

    sessionStorage.setItem("stockflow-user", JSON.stringify(currentUser));
    document.body.classList.remove("locked");
    $("#login-pin").value = "";
    applyRoleUi();
    startRealtimeRefresh();
    setView(isAdmin() ? "dashboard" : "withdraw");
    showActiveRequestIfPending();
  } catch (loginError) {
    error.textContent = loginError.message;
  }
}

function restoreSession() {
  const stored = sessionStorage.getItem("stockflow-user");
  if (!stored) return false;

  try {
    currentUser = JSON.parse(stored);
    document.body.classList.remove("locked");
    applyRoleUi();
    startRealtimeRefresh();
    setView(isAdmin() ? "dashboard" : "withdraw");
    showActiveRequestIfPending();
    return true;
  } catch {
    sessionStorage.removeItem("stockflow-user");
    return false;
  }
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem("stockflow-user");
  if (refreshTimer) clearInterval(refreshTimer);
  if (liveEvents) liveEvents.close();
  refreshTimer = null;
  liveEvents = null;
  document.body.classList.add("locked");
  $("#login-user").value = "";
  $("#login-pin").value = "";
  $("#login-user").focus();
}

async function refreshFromApi() {
  if (!usingApi || !currentUser) return;

  try {
    applyLiveState(await apiRequest("/bootstrap"));
  } catch {
    usingApi = false;
  }
}

function startRealtimeRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (liveEvents) liveEvents.close();
  refreshTimer = null;
  liveEvents = null;

  if (!usingApi || !currentUser) return;

  refreshTimer = setInterval(refreshFromApi, 2000);

  if ("EventSource" in window) {
    liveEvents = new EventSource(`${API_BASE}/events`);
    liveEvents.addEventListener("state", (event) => {
      applyLiveState(JSON.parse(event.data));
    });
    liveEvents.addEventListener("error", () => {
      liveEvents?.close();
      liveEvents = null;
    });
    return;
  }
}

async function handleReturn() {
  const item = findItem($("#return-code").value);
  const result = $("#return-result");
  if (!item) {
    result.textContent = "Insumo nao encontrado.";
    return;
  }

  try {
    if (usingApi) {
      replaceState(await apiRequest("/movements/return", {
        method: "POST",
        body: JSON.stringify({ code: item.code, quantity: 1, technician: currentUser?.name || "Tecnico" })
      }));
    } else {
      item.qty += 1;
      state.history.unshift({
        at: new Date().toISOString(),
        user: currentUser?.name || "Tecnico",
        type: "Devolucao",
        qty: 1,
        itemCode: item.code,
        itemName: item.name,
        destination: "Estoque"
      });
      saveState();
    }
  } catch (error) {
    result.textContent = error.message;
    return;
  }

  const updatedItem = findItem(item.code);
  result.innerHTML = `<strong>${updatedItem.name}</strong><br>Estoque atualizado para ${updatedItem.qty} unidade(s).`;
  $("#return-code").value = "";
  renderAll();
}

function renderReplenishStart() {
  $("#replenish-view .flow-card").innerHTML = `
    <div class="status-screen replenish-home">
      <span class="status-signal"></span>
      <p class="eyebrow">Administrador</p>
      <h2>Reposicao de estoque</h2>
      <div class="result-box muted">Bipe o codigo do insumo e informe a quantidade recebida.</div>
      <button id="open-replenish" class="primary-action wide">Repor insumos</button>
    </div>
  `;
  $("#open-replenish").addEventListener("click", renderReplenishForm);
}

function renderReplenishForm() {
  $("#replenish-view .flow-card").innerHTML = `
    <div class="flow-title">
      <p class="eyebrow">Entrada de estoque</p>
      <h2>Repor insumos</h2>
    </div>
    <div class="form-grid">
      <label>
        Codigo
        <input id="replenish-code" placeholder="Ex: COD001">
      </label>
      <label>
        Quantidade recebida
        <input id="replenish-qty" type="number" min="1" value="1">
      </label>
    </div>
    <button id="replenish-button" class="primary-action wide">Adicionar ao estoque</button>
    <div id="replenish-result" class="result-box muted">Aguardando leitura...</div>
  `;
  $("#replenish-button").addEventListener("click", handleReplenish);
  $("#replenish-code").addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleReplenish();
  });
  setTimeout(() => $("#replenish-code")?.focus(), 50);
}

function renderReplenishDone(item, before, qty) {
  $("#replenish-view .flow-card").innerHTML = `
    <div class="status-screen released">
      <span class="status-signal"></span>
      <p class="eyebrow">Reposicao registrada</p>
      <h2>Estoque atualizado</h2>
      <div class="result-box">
        <strong>${item.name}</strong><br>
        ${before} -> ${item.qty} unidades (+${qty})
      </div>
      <button id="open-replenish" class="primary-action wide">Repor insumos</button>
    </div>
  `;
  $("#open-replenish").addEventListener("click", renderReplenishForm);
}

async function handleReplenish() {
  const item = findItem($("#replenish-code").value);
  const qty = Math.max(1, Number($("#replenish-qty").value || 1));
  const result = $("#replenish-result");
  if (!item) {
    result.textContent = "Insumo nao encontrado.";
    return;
  }

  const before = item.qty;
  try {
    if (usingApi) {
      replaceState(await apiRequest("/movements/replenish", {
        method: "POST",
        body: JSON.stringify({ code: item.code, quantity: qty })
      }));
    } else {
      item.qty += qty;
      state.history.unshift({
        at: new Date().toISOString(),
        user: state.adminName,
        type: "Reposicao",
        qty,
        itemCode: item.code,
        itemName: item.name,
        destination: "Estoque"
      });
      saveState();
    }
  } catch (error) {
    result.textContent = error.message;
    return;
  }

  const updatedItem = findItem(item.code);
  renderReplenishDone(updatedItem, before, qty);
  saveState();
}

function openItemDialog(item) {
  const dialog = $("#item-dialog");
  $("#dialog-title").textContent = item ? "Editar Insumo" : "Novo Insumo";
  $("#item-original-code").value = item?.code || "";
  $("#item-code").value = item?.code || "";
  $("#item-name").value = item?.name || "";
  $("#item-category").value = item?.category || "";
  $("#item-qty").value = item?.qty ?? 0;
  $("#item-min").value = item?.min ?? 1;
  $("#item-supplier").value = item?.supplier || "";
  $("#item-note").value = item?.note || "";
  dialog.showModal();
}

function openUserDialog() {
  const dialog = $("#user-dialog");
  $("#user-name").value = "";
  $("#user-role").value = "tecnico";
  $("#user-pin").value = "";
  dialog.showModal();
}

async function saveUser(event) {
  event.preventDefault();
  const userPayload = {
    name: $("#user-name").value.trim(),
    role: $("#user-role").value,
    pin: $("#user-pin").value.trim()
  };

  try {
    if (usingApi) {
      const nextState = await apiRequest("/usuarios", {
        method: "POST",
        body: JSON.stringify(userPayload)
      });
      replaceState(nextState);
    } else {
      const newUser = { name: userPayload.name, role: userPayload.role };
      state.users = state.users || [];
      
      const existingIdx = state.users.findIndex(u => normalize(u.name) === normalize(newUser.name));
      if (existingIdx >= 0) {
        state.users[existingIdx] = newUser;
      } else {
        state.users.push(newUser);
      }
      
      if (newUser.role === "tecnico" && !state.technicians.includes(newUser.name)) {
        state.technicians.push(newUser.name);
      }
      saveState();
    }
    
    $("#user-dialog").close();
    renderAll();
  } catch (error) {
    alert(error.message);
  }
}
