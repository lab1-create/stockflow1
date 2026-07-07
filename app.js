const STORAGE_KEY = "stockflow-state-v2";
const API_BASE = "/api";
const LIVE_CHANNEL = "stockflow-live";

const seedState = {
  users: [],
  technicians: [],
  destinations: [],
  adminName: "Administrador",
  items: [],
  history: [],
  requests: [],
  usageKpis: []
};

let state = structuredClone(seedState);
let usingApi = true; // Força o uso da API em produção
let currentUser = null;
let currentView = "dashboard";
let withdraw = { step: 0, technician: "", destination: "", item: null, qty: 1 };
let activeRequest = null;
let refreshTimer = null;
let liveEvents = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
    const data = await apiRequest("/bootstrap");
    replaceState(data);
    usingApi = true;
  } catch (err) {
    console.error("Erro ao carregar dados iniciais:", err);
    usingApi = false;
  }
}

function replaceState(nextState) {
  state = { ...structuredClone(seedState), ...nextState };
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function allowedViews() {
  if (isAdmin()) return ["dashboard", "withdraw", "return", "replenish", "items", "history"];
  return ["withdraw", "return"];
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function findItem(code) {
  return state.items.find((item) => normalize(item.code) === normalize(code));
}

function statusFor(item) {
  if (item.qty <= item.min) return { label: "CRÍTICO", className: "critical" };
  if (item.qty <= item.min + 2) return { label: "ATENÇÃO", className: "warning" };
  return { label: "NORMAL", className: "" };
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function filteredItems() {
  const query = normalize($("#global-search")?.value || "");
  if (!query) return state.items;
  return state.items.filter((item) => {
    return [item.code, item.name, item.category, item.supplier, item.note].some((field) => normalize(field).includes(query));
  });
}

function filteredHistory() {
  const query = normalize($("#global-search")?.value || "");
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
  
  const titleNode = $("#view-title");
  if (titleNode) {
    titleNode.textContent = {
      dashboard: "Dashboard",
      withdraw: "Retirar Insumo",
      return: "Devolver Insumo",
      replenish: "Repor Estoque",
      items: "Insumos",
      history: "Histórico"
    }[view];
  }

  if (view === "withdraw") {
    withdraw = {
      step: isAdmin() ? 0 : 2,
      technician: isAdmin() ? "" : currentUser.name,
      destination: isAdmin() ? "" : (state.destinations[0] || "Bancada 01"),
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

  const label = $("#session-label");
  if (label) {
    label.textContent = currentUser
      ? `${currentUser.name} - ${isAdmin() ? "Administrador" : "Técnico"}`
      : "Operação rápida ativa";
  }
}

function applyLiveState(nextState) {
  replaceState(nextState);
  applyRoleUi();
  renderAll();
  showActiveRequestIfPending();
}

function showActiveRequestIfPending() {
  if (!currentUser || isAdmin() || !activeRequest) return;
  const pending = state.requests.find((r) => r.status === "pending" && r.technician === currentUser.name);
  if (pending) {
    showWaitingApprovalScreen({ name: pending.itemName });
  } else if (activeRequest) {
    // Se sumiu das pendências, significa que foi aprovado
    activeRequest = null;
    setView("withdraw");
  }
}

function renderAll() {
  renderDashboard();
  renderItems();
  renderHistory();
  renderTechnicianFilter();
}

function renderDashboard() {
  const stockTotal = state.items.reduce((sum, item) => sum + Number(item.qty), 0);
  const critical = state.items.filter((item) => item.qty <= item.min);
  const withdrawalsToday = state.history.filter((entry) => entry.type === "Retirada").length;

  if ($("#metric-total-items")) $("#metric-total-items").textContent = state.items.length;
  if ($("#metric-critical")) $("#metric-critical").textContent = critical.length;
  if ($("#metric-withdrawals")) $("#metric-withdrawals").textContent = withdrawalsToday;
  if ($("#metric-stock")) $("#metric-stock").textContent = stockTotal.toLocaleString("pt-BR");
  
  renderPendingRequests();

  const critList = $("#critical-list");
  if (critList) {
    critList.innerHTML = critical.length
      ? critical.map((item) => compactItemRow(item)).join("")
      : `<p class="muted">Nenhum item crítico no momento.</p>`;
  }

  const recHist = $("#recent-history");
  if (recHist) {
    const history = filteredHistory().slice(0, 6);
    recHist.innerHTML = history.length
      ? history.map(historyRow).join("")
      : `<p class="muted">Nenhuma movimentação encontrada.</p>`;
  }
}

function renderPendingRequests() {
  const pendingRequests = state.requests.filter((r) => r.status === "pending");
  const countNode = $("#pending-count");
  if (countNode) countNode.textContent = `${pendingRequests.length} pendente${pendingRequests.length === 1 ? "" : "s"}`;
  
  const reqList = $("#pending-requests");
  if (!reqList) return;

  reqList.innerHTML = pendingRequests.length
    ? pendingRequests.map((request) => `
        <article class="request-card">
          <div>
            <strong>${request.technician} solicitou ${request.itemName}</strong>
            <span>${request.itemCode} - ${request.destination} - ${request.qty} un. - ${formatDate(request.at)}</span>
          </div>
          <div class="scan-row">
            <input class="request-scan scan-input" data-request-code="${request.id}" placeholder="Bipe ${request.itemCode}">
            <button class="primary-action" data-approve-request="${request.id}">Liberar</button>
          </div>
        </article>
      `).join("")
    : `<p class="muted">Nenhuma solicitação pendente agora.</p>`;

  $$("[data-approve-request]").forEach((button) => {
    button.addEventListener("click", () => approveRequest(button.dataset.approveRequest));
  });
  $$(".request-scan").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") approveRequest(input.dataset.requestCode);
    });
  });
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
  const stepper = $("#withdraw-stepper");
  if (stepper) {
    stepper.innerHTML = [0, 1, 2, 3].map((step) => `<span class="step ${step <= withdraw.step ? "done" : ""}"></span>`).join("");
  }

  const content = $("#withdraw-content");
  if (!content) return;

  if (withdraw.step === 0) {
    content.innerHTML = `
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
        withdraw.step = 2;
        renderWithdraw();
      });
    });
    return;
  }

  if (withdraw.step === 2) {
    content.innerHTML = `
      <div class="flow-title">
        <p class="eyebrow">${withdraw.technician}</p>
        <h2>Aguardando leitura do produto...</h2>
      </div>
      <div class="scan-row">
        <input id="withdraw-code" class="scan-input" placeholder="Bipe ou digite o código">
        <button id="scan-button" class="primary-action">Identificar</button>
      </div>
      <div class="result-box muted">Bipe ou digite o código do produto cadastrado.</div>
    `;
    $("#scan-button").addEventListener("click", identifyWithdrawItem);
    $("#withdraw-code").addEventListener("keydown", (event) => {
      if (event.key === "Enter") identifyWithdrawItem();
    });
    setTimeout(() => $("#withdraw-code")?.focus(), 50);
    return;
  }

  if (withdraw.step === 3) {
    const item = withdraw.item;
    const status = statusFor(item);
    content.innerHTML = `
      <div class="flow-title">
        <p class="eyebrow">Etapa Final</p>
        <h2>Confirmar Solicitação?</h2>
      </div>
      <div class="confirm-box">
        <div class="item-preview">
          <strong>${item.name}</strong>
          <span>Código ${item.code} - Estoque atual: ${item.qty}</span>
          <span class="pill ${status.className}">${status.label}</span>
        </div>
        <label class="qty-row">
          Quantidade
          <input id="withdraw-qty" type="number" min="1" max="${item.qty}" value="${withdraw.qty}">
        </label>
        <label class="qty-row">
          Destino/Bancada
          <select id="withdraw-dest">
            ${state.destinations.map(d => `<option value="${d}">${d}</option>`).join("")}
          </select>
        </label>
        <button id="confirm-withdraw" class="primary-action wide" ${item.qty <= 0 ? "disabled" : ""}>Solicitar Liberação</button>
      </div>
    `;
    $("#confirm-withdraw").addEventListener("click", confirmWithdraw);
  }
}

function identifyWithdrawItem() {
  const item = findItem($("#withdraw-code").value);
  if (!item) {
    $(".result-box").textContent = "Insumo não encontrado.";
    return;
  }
  withdraw.item = item;
  withdraw.qty = 1;
  withdraw.step = 3;
  renderWithdraw();
}

async function confirmWithdraw() {
  const qty = Math.max(1, Number($("#withdraw-qty").value || 1));
  const destination = $("#withdraw-dest").value;
  const item = withdraw.item;

  try {
    const nextState = await apiRequest("/movements/withdraw", {
      method: "POST",
      body: JSON.stringify({
        code: item.code,
        technician: withdraw.technician,
        destination: destination,
        quantity: qty
      })
    });
    activeRequest = { technician: withdraw.technician, itemCode: item.code };
    applyLiveState(nextState);
  } catch (error) {
    alert(error.message);
  }
}

async function approveRequest(requestId) {
  const input = $(`[data-request-code="${requestId}"]`);
  if (input && !input.value.trim()) {
    input.focus();
    return;
  }
  try {
    const nextState = await apiRequest(`/requests/${requestId}/approve`, { method: "POST" });
    applyLiveState(nextState);
  } catch (error) {
    alert(error.message);
  }
}

function showWaitingApprovalScreen(item) {
  const content = $("#withdraw-content");
  if (content) {
    content.innerHTML = `
      <div class="status-screen waiting">
        <span class="status-signal"></span>
        <p class="eyebrow">Ação necessária</p>
        <h2>Aguardando liberação do Administrador</h2>
        <div class="result-box"><strong>${item.name}</strong></div>
      </div>
    `;
  }
}

function renderItems() {
  const grid = $("#items-grid");
  if (!grid) return;

  const items = filteredItems();
  grid.innerHTML = items.length
    ? items.map((item) => {
        const status = statusFor(item);
        return `
          <article class="item-card">
            <div class="panel-head">
              <h3>${item.name}</h3>
              <span class="pill ${status.className}">${status.label}</span>
            </div>
            <div class="item-meta">
              <span>Código: ${item.code}</span>
              <span>Categoria: ${item.category}</span>
              <span>Estoque Atual: ${item.qty}</span>
              <span>Mínimo: ${item.min}</span>
            </div>
          </article>
        `;
      }).join("")
    : `<p class="muted">Nenhum insumo encontrado.</p>`;
}

function renderHistory() {
  const table = $("#history-table");
  if (table) {
    table.innerHTML = filteredHistory().length
      ? filteredHistory().map(historyRow).join("")
      : `<p class="muted">Nenhuma movimentação encontrada.</p>`;
  }
}

function renderTechnicianFilter() {
  const select = $("#technician-filter");
  if (!select) return;
  const selected = select.value;
  select.innerHTML = `<option value="">Todos os técnicos</option>${state.technicians.map((name) => `<option value="${name}">${name}</option>`).join("")}`;
  select.value = selected;
}

async function handleLogin(event) {
  event.preventDefault();
  const name = $("#login-user").value.trim();
  const pin = $("#login-pin").value.trim();
  const error = $("#login-error");
  if (error) error.textContent = "";

  try {
    const result = await apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ name, pin })
    });
    currentUser = result.user;
    sessionStorage.setItem("stockflow-user", JSON.stringify(currentUser));
    document.body.classList.remove("locked");
    applyLiveState(result.state);
    startRealtimeRefresh();
    setView(isAdmin() ? "dashboard" : "withdraw");
  } catch (loginError) {
    if (error) error.textContent = loginError.message;
  }
}

async function handleReturn() {
  const code = $("#return-code").value;
  const result = $("#return-result");
  try {
    const nextState = await apiRequest("/movements/return", {
      method: "POST",
      body: JSON.stringify({ code, quantity: 1, technician: currentUser.name })
    });
    if (result) result.textContent = "Devolvido com sucesso!";
    $("#return-code").value = "";
    applyLiveState(nextState);
  } catch (error) {
    if (result) result.textContent = error.message;
  }
}

function renderReplenishStart() {
  const card = $("#replenish-view .flow-card");
  if (card) {
    card.innerHTML = `
      <button id="open-replenish" class="primary-action wide">Iniciar Entrada de Insumos</button>
      <div id="replenish-result" class="result-box muted"></div>
    `;
    $("#open-replenish").addEventListener("click", renderReplenishForm);
  }
}

function renderReplenishForm() {
  const card = $("#replenish-view .flow-card");
  if (card) {
    card.innerHTML = `
      <input id="replenish-code" class="scan-input" placeholder="Código do Insumo">
      <input id="replenish-qty" type="number" value="1" min="1" style="margin-top:10px;">
      <button id="replenish-button" class="primary-action wide" style="margin-top:10px;">Salvar Entrada</button>
    `;
    $("#replenish-button").addEventListener("click", handleReplenish);
  }
}

async function handleReplenish() {
  const code = $("#replenish-code").value;
  const qty = Number($("#replenish-qty").value);
  try {
    const nextState = await apiRequest("/movements/replenish", {
      method: "POST",
      body: JSON.stringify({ code, quantity: qty })
    });
    alert("Estoque reposto!");
    setView("dashboard");
    applyLiveState(nextState);
  } catch (error) {
    alert(error.message);
  }
}

async function refreshFromApi() {
  if (!currentUser) return;
  try {
    const nextState = await apiRequest("/bootstrap");
    applyLiveState(nextState);
  } catch (e) {
    console.error("Erro no polling:", e);
  }
}

function startRealtimeRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshFromApi, 3000); // Sincroniza a cada 3 segundos
}

document.addEventListener("DOMContentLoaded", () => {
  $("#login-form")?.addEventListener("submit", handleLogin);
  $("#return-code")?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleReturn(); });
  $("#global-search")?.addEventListener("input", renderAll);
  $("#technician-filter")?.addEventListener("change", renderAll);
  
  $$(".nav-item").forEach(item => {
    item.addEventListener("click", () => setView(item.dataset.view));
  });

  loadInitialState().then(() => {
    const stored = sessionStorage.getItem("stockflow-user");
    if (stored) {
      currentUser = JSON.parse(stored);
      document.body.classList.remove("locked");
      applyRoleUi();
      startRealtimeRefresh();
      setView(isAdmin() ? "dashboard" : "withdraw");
    }
  });
});