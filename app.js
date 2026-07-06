const STORAGE_KEY = "stockflow-state-v2";
const API_BASE = "/api";
const LIVE_CHANNEL = "stockflow-live";
const TECHNICIAN_DESTINATIONS = {
  Luiz: "Bancada 01",
  Bruno: "Bancada 02",
  Joao: "Bancada 03",
  Placo: "Bancada 04",
  Kaique: "Bancada 05",
  Cauã: "Bancada 06"
};

const seedState = {
  users: [
    { name: "Administrador", role: "admin" },
    { name: "Luiz", role: "tecnico" },
    { name: "Bruno", role: "tecnico" },
    { name: "Joao", role: "tecnico" },
    { name: "Placo", role: "tecnico" },
    { name: "kaique", role: "tecnico" },
    { name: "Cauã", role: "tecnico" }
  ],
  technicians: ["Luiz", "Bruno", "Joao", "Placo", "Kaique", "Cauã"],
  destinations: ["Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Bancada 05", "Bancada 06", "Teste"],
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

const withdraw = {
  destination: "",
  step: 1
};

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function saveState() {
  if (!usingApi) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  options.headers = {
    ...options.headers,
    "Content-Type": "application/json"
  };
  const response = await fetch(url, options);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Erro na API: ${response.status}`);
  }
  return response.json();
}

async function loadInitialState() {
  try {
    const bootstrapData = await apiRequest("/bootstrap");
    replaceState(bootstrapData);
    usingApi = true;
    console.log("StockFlow conectado ao servidor de banco de dados.");
  } catch (e) {
    console.warn("Servidor indisponivel. Usando armazenamento local temporario.", e);
    usingApi = false;
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try { state = JSON.parse(local); } catch (err) { state = structuredClone(seedState); }
    } else {
      state = structuredClone(seedState);
    }
  }
}

function replaceState(nextState) {
  if (!nextState) return;
  state = nextState;
  renderAll();
}

function setupLocalRealtime() {
  if (!usingApi) return;
  const eventSource = new EventSource(`${API_BASE}/live`);
  eventSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "state") {
        replaceState(msg.data);
      }
    } catch (e) {
      console.error("Erro ao processar atualizacao em tempo real:", e);
    }
  };
  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(setupLocalRealtime, 5000);
  };
}

function isAdmin() { return currentUser && currentUser.role === "admin"; }
function isEstoque() { return currentUser && currentUser.role === "estoque"; }
function isTecnico() { return currentUser && currentUser.role === "tecnico"; }

function setView(viewId) {
  currentView = viewId;
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${viewId}-view`)?.classList.add("active");

  $$(".nav-item").forEach((btn) => btn.classList.remove("active"));
  $(`[data-view="${viewId}"]`)?.classList.add("active");

  if (viewId === "withdraw") {
    withdraw.step = 1;
    withdraw.destination = "";
    $("#withdraw-step-1").style.display = "block";
    $("#withdraw-step-2").style.display = "none";
    $("#withdraw-feedback").style.display = "none";
    $("#withdraw-code").value = "";
    renderDestinations();
  } else if (viewId === "return") {
    $("#return-code").value = "";
    $("#return-feedback").style.display = "none";
  }
}

function applyRoleUi() {
  if (!currentUser) return;
  $("#user-name").textContent = currentUser.name;
  $("#user-role").textContent = currentUser.role.toUpperCase();
  $("#user-avatar").textContent = currentUser.name.charAt(0).toUpperCase();

  if (isAdmin()) {
    document.body.classList.add("is-admin");
    document.body.classList.remove("is-technician");
    $$(".admin-only").forEach(el => el.style.display = "");
    if ($("#admin-user-panel")) $("#admin-user-panel").style.display = "block";
    $("#nav-dashboard").style.display = "";
    $("#nav-inventory").style.display = "";
    $("#nav-history").style.display = "";
  } else if (isEstoque()) {
    document.body.classList.remove("is-admin", "is-technician");
    $$(".admin-only").forEach(el => el.style.display = "none");
    if ($("#admin-user-panel")) $("#admin-user-panel").style.display = "none";
    $("#nav-dashboard").style.display = "";
    $("#nav-inventory").style.display = "";
    $("#nav-history").style.display = "";
  } else {
    document.body.classList.remove("is-admin");
    document.body.classList.add("is-technician");
    $$(".admin-only").forEach(el => el.style.display = "none");
    if ($("#admin-user-panel")) $("#admin-user-panel").style.display = "none";
    $("#nav-dashboard").style.display = "none";
    $("#nav-inventory").style.display = "none";
    $("#nav-history").style.display = "none";
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const usernameInput = $("#login-user").value.trim();
  const passwordInput = $("#login-pin").value;

  const user = state.users.find(u => u.name.toLowerCase() === usernameInput.toLowerCase());

  if (!user) {
    $("#login-error").textContent = "Usuário não encontrado.";
    return;
  }

  currentUser = user;
  document.body.classList.remove("locked");
  $("#login-screen").style.display = "none";
  
  applyRoleUi();
  
  if (isTecnico()) {
    setView("withdraw");
  } else {
    setView("dashboard");
  }
  saveSession();
}

function logout() {
  currentUser = null;
  localStorage.removeItem("stockflow-session");
  document.body.classList.add("locked");
  $("#login-screen").style.display = "flex";
  $("#login-user").value = "";
  $("#login-pin").value = "";
  $("#login-error").textContent = "";
}

function saveSession() {
  localStorage.setItem("stockflow-session", JSON.stringify(currentUser));
}

function restoreSession() {
  const saved = localStorage.getItem("stockflow-session");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      document.body.classList.remove("locked");
      $("#login-screen").style.display = "none";
      applyRoleUi();
      setView(isTecnico() ? "withdraw" : "dashboard");
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

function renderAll() {
  renderDashboard();
  renderInventory();
  renderHistorySelectors();
  renderHistory();
}

function getFilteredItems() {
  const query = $("#global-search").value.toLowerCase().trim();
  if (!query) return state.items;
  return state.items.filter(item => 
    item.code.toLowerCase().includes(query) ||
    item.name.toLowerCase().includes(query) ||
    item.category.toLowerCase().includes(query)
  );
}

function renderDashboard() {
  const alertsList = $("#alerts-list");
  alertsList.innerHTML = "";
  const criticalItems = state.items.filter(item => item.qty <= item.min);
  
  if (criticalItems.length === 0) {
    alertsList.innerHTML = `<div class="empty-state">Nenhum insumo com estoque critico.</div>`;
  } else {
    criticalItems.forEach(item => {
      const div = document.createElement("div");
      div.className = "alert-item";
      div.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <span class="eyebrow" style="margin-top:2px">${item.code} - ${item.category}</span>
        </div>
        <div style="text-align: right">
          <span class="stock-status critical">${item.qty} un</span>
          <span class="eyebrow" style="margin-top:2px">Minimo: ${item.min}</span>
        </div>
      `;
      alertsList.appendChild(div);
    });
  }

  const recentTable = $("#recent-table");
  recentTable.innerHTML = "";
  const recentMovements = state.history.slice(0, 5);

  if (recentMovements.length === 0) {
    recentTable.innerHTML = `<div class="empty-state">Nenhuma movimentacao recente.</div>`;
  } else {
    let html = `
      <table>
        <thead>
          <tr>
            <th>Insumo</th>
            <th>Tipo</th>
            <th>Qtd</th>
            <th>Responsavel</th>
            <th>Destino</th>
          </tr>
        </thead>
        <tbody>
    `;
    recentMovements.forEach(m => {
      let typeLabel = m.type;
      if (m.type === "withdrawal") typeLabel = "Retirada";
      if (m.type === "return") typeLabel = "Devolucao";
      if (m.type === "replenishment") typeLabel = "Abastecimento";

      html += `
        <tr>
          <td><strong>${m.itemName}</strong><br><span class="eyebrow">${m.code}</span></td>
          <td><span class="stock-status ${m.type === "withdrawal" ? "critical" : "normal"}">${typeLabel}</span></td>
          <td>${m.quantity}</td>
          <td>${m.userName}</td>
          <td>${m.destinationName}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    recentTable.innerHTML = html;
  }

  const reqCount = $("#requests-count");
  if (reqCount) reqCount.textContent = state.requests.length;

  const reqList = $("#requests-list");
  if (reqList) {
    reqList.innerHTML = "";
    if (state.requests.length === 0) {
      reqList.innerHTML = `<div class="empty-state">Nenhuma solicitacao pendente.</div>`;
    } else {
      state.requests.forEach(req => {
        const div = document.createElement("div");
        div.className = "request-item alert-item";
        div.innerHTML = `
          <div>
            <strong>${req.technicianName} solicita ${req.quantity} un</strong>
            <span class="eyebrow" style="margin-top:2px">${req.itemName} (${req.code}) para ${req.destination}</span>
          </div>
          <div class="request-actions" style="display:flex; gap:8px;">
            <button class="secondary-button" onclick="rejectRequest(${req.id})" style="padding:4px 8px; font-size:12px;">Recusar</button>
            <button class="primary-action" onclick="approveRequest(${req.id})" style="padding:4px 12px; font-size:12px;">Liberar</button>
          </div>
        `;
        reqList.appendChild(div);
      });
    }
  }
}

async function approveRequest(id) {
  try {
    if (usingApi) {
      const nextState = await apiRequest(`/requests/${id}/approve`, { method: "POST" });
      replaceState(nextState);
    }
  } catch (e) {
    alert(e.message);
  }
}

async function rejectRequest(id) {
  try {
    if (usingApi) {
      const nextState = await apiRequest(`/requests/${id}`, { method: "DELETE" });
      replaceState(nextState);
    }
  } catch (e) {
    alert(e.message);
  }
}

function renderInventory() {
  const invTable = $("#inventory-table");
  invTable.innerHTML = "";
  const filtered = getFilteredItems();

  if (filtered.length === 0) {
    invTable.innerHTML = `<div class="empty-state">Nenhum insumo encontrado.</div>`;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Codigo</th>
          <th>Nome</th>
          <th>Categoria</th>
          <th>Estoque</th>
          <th>Fornecedor</th>
          ${isAdmin() || isEstoque() ? "<th>Acoes</th>" : ""}
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach(item => {
    const isCritical = item.qty <= item.min;
    html += `
      <tr>
        <td><code>${item.code}</code></td>
        <td><strong>${item.name}</strong>${item.note ? `<br><span class="eyebrow">${item.note}</span>` : ""}</td>
        <td><span class="badge">${item.category}</span></td>
        <td><span class="stock-status ${isCritical ? "critical" : "normal"}">${item.qty} un</span><br><span class="eyebrow">Min: ${item.min}</span></td>
        <td>${item.supplier || "---"}</td>
        ${isAdmin() || isEstoque() ? `
          <td>
            <div style="display:flex; gap:6px;">
              <button class="secondary-button" style="padding:4px 8px; font-size:12px;" onclick="openItemDialog('${item.code}')">Editar</button>
              <button class="secondary-button" style="padding:4px 8px; font-size:12px; background:#221315; color:#ffb4a8; border-color:#431a1f" onclick="triggerReplenish('${item.code}')">Abastecer</button>
            </div>
          </td>
        ` : ""}
      </tr>
    `;
  });

  html += `</tbody></table>`;
  invTable.innerHTML = html;
}

function triggerReplenish(code) {
  const qtyStr = prompt("Quantidade para adicionar ao estoque:");
  const qty = parseInt(qtyStr, 10);
  if (isNaN(qty) || qty <= 0) return;
  
  if (usingApi) {
    apiRequest("/movements/replenish", {
      method: "POST",
      body: JSON.stringify({ code, quantity: qty })
    }).then(replaceState).catch(err => alert(err.message));
  } else {
    const item = state.items.find(i => i.code === code);
    if (item) {
      item.qty += qty;
      state.history.unshift({
        id: Date.now(),
        code,
        itemName: item.name,
        userName: currentUser ? currentUser.name : "Admin",
        userRole: currentUser ? currentUser.role : "admin",
        destinationName: "Estoque",
        type: "replenishment",
        quantity: qty,
        timestamp: new Date().toLocaleString("pt-BR")
      });
      saveState();
      renderAll();
    }
  }
}

function openItemDialog(code = "") {
  const dialog = $("#item-dialog");
  const form = $("#item-form");
  
  if (code) {
    const item = state.items.find(i => i.code === code);
    if (!item) return;
    $("#dialog-title").textContent = "Editar Insumo";
    $("#item-original-code").value = item.code;
    $("#item-code").value = item.code;
    $("#item-name").value = item.name;
    $("#item-category").value = item.category;
    $("#item-qty").value = item.qty;
    $("#item-min").value = item.min;
    $("#item-supplier").value = item.supplier || "";
    $("#item-note").value = item.note || "";
  } else {
    $("#dialog-title").textContent = "Novo Insumo";
    $("#item-original-code").value = "";
    form.reset();
  }
  dialog.showModal();
}

async function saveItem(event) {
  event.preventDefault();
  const originalCode = $("#item-original-code").value;
  const payload = {
    originalCode: originalCode || null,
    code: $("#item-code").value.trim(),
    name: $("#item-name").value.trim(),
    category: $("#item-category").value.trim(),
    qty: parseInt($("#item-qty").value, 10),
    min: parseInt($("#item-min").value, 10),
    supplier: $("#item-supplier").value.trim() || null,
    note: $("#item-note").value.trim() || null
  };

  try {
    if (usingApi) {
      const nextState = await apiRequest("/items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      replaceState(nextState);
    } else {
      if (originalCode) {
        const idx = state.items.findIndex(i => i.code === originalCode);
        if (idx !== -1) state.items[idx] = { code: payload.code, name: payload.name, category: payload.category, qty: payload.qty, min: payload.min, supplier: payload.supplier, note: payload.note };
      } else {
        state.items.push({ code: payload.code, name: payload.name, category: payload.category, qty: payload.qty, min: payload.min, supplier: payload.supplier, note: payload.note });
      }
      saveState();
      renderAll();
    }
    $("#item-dialog").close();
  } catch (e) {
    alert(e.message);
  }
}

function renderDestinations() {
  const grid = $("#destinations-grid");
  grid.innerHTML = "";
  
  state.destinations.forEach(dest => {
    const btn = document.createElement("button");
    btn.className = "selection-card";
    btn.innerHTML = `<h3>${dest}</h3><p class="eyebrow" style="margin-top:4px">Selecionar local</p>`;
    btn.addEventListener("click", () => {
      withdraw.destination = dest;
      withdraw.step = 2;
      $("#withdraw-step-1").style.display = "none";
      $("#withdraw-step-2").style.display = "block";
      $("#withdraw-step-2-eyebrow").textContent = `Local: ${dest}`;
      setTimeout(() => $("#withdraw-code").focus(), 50);
    });
    grid.appendChild(btn);
  });
}

function renderHistorySelectors() {
  const filter = $("#technician-filter");
  const currentVal = filter.value;
  filter.innerHTML = `<option value="">Todos os tecnicos</option>`;
  state.technicians.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    filter.appendChild(opt);
  });
  filter.value = currentVal;
}

function renderHistory() {
  const tableContainer = $("#history-table");
  tableContainer.innerHTML = "";
  const filterVal = $("#technician-filter").value;
  
  const filtered = filterVal 
    ? state.history.filter(h => h.userName === filterVal)
    : state.history;

  if (filtered.length === 0) {
    tableContainer.innerHTML = `<div class="empty-state">Nenhuma movimentacao registrada no historico.</div>`;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Insumo</th>
          <th>Tipo</th>
          <th>Qtd</th>
          <th>Responsavel</th>
          <th>Destino</th>
        </tr>
      </thead>
      <tbody>
  `;
  filtered.forEach(h => {
    let typeLabel = h.type;
    if (h.type === "withdrawal") typeLabel = "Retirada";
    if (h.type === "return") typeLabel = "Devolucao";
    if (h.type === "replenishment") typeLabel = "Abastecimento";

    html += `
      <tr>
        <td><span class="eyebrow">${h.timestamp}</span></td>
        <td><strong>${h.itemName}</strong><br><span class="eyebrow">${h.code}</span></td>
        <td><span class="stock-status ${h.type === "withdrawal" ? "critical" : "normal"}">${typeLabel}</span></td>
        <td>${h.quantity}</td>
        <td>${h.userName} <span class="badge" style="font-size:10px">${h.userRole}</span></td>
        <td>${h.destinationName}</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  tableContainer.innerHTML = html;
}

async function handleWithdrawScan(code) {
  const feedback = $("#withdraw-feedback");
  feedback.style.display = "block";
  feedback.className = "feedback-card loading";
  feedback.innerHTML = "Verificando insumo...";

  try {
    if (isTecnico()) {
      if (usingApi) {
        const nextState = await apiRequest("/requests", {
          method: "POST",
          body: JSON.stringify({
            code,
            quantity: 1,
            technicianName: currentUser.name,
            destination: withdraw.destination
          })
        });
        replaceState(nextState);
      }
      feedback.className = "feedback-card success";
      feedback.innerHTML = `<h3>Solicitado!</h3><p style="margin-top:4px">Pedido enviado para aprovacao do Administrador.</p>`;
    } else {
      if (usingApi) {
        const nextState = await apiRequest("/movements/withdraw", {
          method: "POST",
          body: JSON.stringify({
            code,
            quantity: 1,
            technician: currentUser ? currentUser.name : "Operador",
            destination: withdraw.destination
          })
        });
        replaceState(nextState);
      } else {
        const item = state.items.find(i => i.code === code);
        if (!item) throw new Error("Insumo nao cadastrado no sistema.");
        if (item.qty < 1) throw new Error("Estoque zerado para este insumo.");
        item.qty -= 1;
        state.history.unshift({
          id: Date.now(),
          code,
          itemName: item.name,
          userName: currentUser ? currentUser.name : "Operador",
          userRole: currentUser ? currentUser.role : "admin",
          destinationName: withdraw.destination,
          type: "withdrawal",
          quantity: 1,
          timestamp: new Date().toLocaleString("pt-BR")
        });
        saveState();
        renderAll();
      }
      feedback.className = "feedback-card success";
      feedback.innerHTML = `<h3>Retirado com sucesso!</h3><p style="margin-top:4px">1 unidade movimentada para ${withdraw.destination}.</p>`;
    }
  } catch (err) {
    feedback.className = "feedback-card error";
    feedback.innerHTML = `<h3>Erro na operacao</h3><p style="margin-top:4px">${err.message}</p>`;
  }
  $("#withdraw-code").value = "";
}

async function handleReturnScan(code) {
  const feedback = $("#return-feedback");
  feedback.style.display = "block";
  feedback.className = "feedback-card loading";
  feedback.innerHTML = "Processando devolucao...";

  try {
    if (usingApi) {
      const nextState = await apiRequest("/movements/return", {
        method: "POST",
        body: JSON.stringify({
          code,
          quantity: 1,
          technician: currentUser ? currentUser.name : "Tecnico"
        })
      });
      replaceState(nextState);
    } else {
      const item = state.items.find(i => i.code === code);
      if (!item) throw new Error("Insumo nao cadastrado no sistema.");
      item.qty += 1;
      state.history.unshift({
        id: Date.now(),
        code,
        itemName: item.name,
        userName: currentUser ? currentUser.name : "Tecnico",
        userRole: currentUser ? currentUser.role : "tecnico",
        destinationName: "Estoque",
        type: "return",
        quantity: 1,
        timestamp: new Date().toLocaleString("pt-BR")
      });
      saveState();
      renderAll();
    }
    feedback.className = "feedback-card success";
    feedback.innerHTML = `<h3>Devolvido!</h3><p style="margin-top:4px">1 unidade retornou ao estoque principal.</p>`;
  } catch (err) {
    feedback.className = "feedback-card error";
    feedback.innerHTML = `<h3>Erro na devolucao</h3><p style="margin-top:4px">${err.message}</p>`;
  }
  $("#return-code").value = "";
}

function restoreActiveRequest() {}

function bindEvents() {
  $("#login-form").addEventListener("submit", handleLogin);
  $("#logout-button").addEventListener("click", logout);
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-view-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewJump)));
  $("#global-search").addEventListener("input", renderAll);
  
  $("#withdraw-code").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const code = $("#withdraw-code").value.trim();
      if (code) handleWithdrawScan(code);
    }
  });

  $("#withdraw-back").addEventListener("click", () => {
    setView("withdraw");
  });

  $("#return-code").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const code = $("#return-code").value.trim();
      if (code) handleReturnScan(code);
    }
  });
  
  $("#new-item-button").addEventListener("click", () => openItemDialog());
  $("#close-dialog").addEventListener("click", () => $("#item-dialog").close());
  $("#item-form").addEventListener("submit", saveItem);
  $("#technician-filter").addEventListener("change", renderHistory);

  $("#create-user-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#new-user-name").value.trim();
    const role = $("#new-user-role").value;
    const messageEl = $("#create-user-message");

    try {
      if (usingApi) {
        const nextState = await apiRequest("/users", {
          method: "POST",
          body: JSON.stringify({ name, role })
        });
        replaceState(nextState);
      } else {
        state.users.push({ name, role });
        if (role === "tecnico") state.technicians.push(name);
        saveState();
        renderAll();
      }
      messageEl.style.color = "#39a96b";
      messageEl.textContent = "Usuário criado com sucesso!";
      $("#create-user-form").reset();
    } catch (err) {
      messageEl.style.color = "#ffb4a8";
      messageEl.textContent = err.message || "Erro ao criar usuário.";
    }
  });

  document.addEventListener("click", () => {
    if (currentView === "withdraw" && withdraw.step === 2) setTimeout(() => $("#withdraw-code")?.focus(), 30);
    if (currentView === "return") setTimeout(() => $("#return-code")?.focus(), 30);
  });
}

async function init() {
  document.body.classList.add("locked");
  await loadInitialState();
  setupLocalRealtime();
  restoreActiveRequest();
  bindEvents();
  if (!restoreSession()) {
    logout();
  }
}

window.addEventListener("DOMContentLoaded", init);
