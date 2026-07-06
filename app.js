import { apiRequest, getToken } from "./api.js";
import { currentUser, loadCurrentUser, login, logout } from "./auth.js";
import { renderDashboard } from "./dashboard.js";
import { renderUsuarios } from "./usuarios.js";
import { $, $$, escapeHtml, formatDate, normalize, openModal, setLoading, toast } from "./utils.js";

const state = {
  user: null,
  data: { items: [], history: [], requests: [], technicians: [], destinations: [], dashboard: {} },
  view: "dashboard"
};

const titles = {
  dashboard: "Dashboard",
  produtos: "Produtos",
  entradas: "Entradas",
  saidas: "Saidas",
  historico: "Historico",
  relatorios: "Relatorios",
  usuarios: "Usuarios",
  configuracoes: "Configuracoes"
};

function isAdmin() {
  return state.user?.role === "admin";
}

function applyPermissions() {
  $$(".admin-only").forEach((node) => node.hidden = !isAdmin());
  $$("[data-view='relatorios']").forEach((node) => node.hidden = !isAdmin());
  $$("[data-view='usuarios']").forEach((node) => node.hidden = !isAdmin());
  $$("[data-view='configuracoes']").forEach((node) => node.hidden = !isAdmin());
  $("#session-label").textContent = state.user ? `${state.user.name} - ${isAdmin() ? "Administrador" : "Tecnico"}` : "Sessao";
}

async function loadBootstrap() {
  state.data = await apiRequest("/bootstrap");
}

function filteredItems() {
  const query = normalize($("#global-search").value);
  if (!query) return state.data.items;
  return state.data.items.filter((item) => [item.code, item.name, item.category, item.supplier, item.note].some((value) => normalize(value).includes(query)));
}

function filteredHistory() {
  const query = normalize($("#global-search").value);
  if (!query) return state.data.history;
  return state.data.history.filter((entry) => [entry.user, entry.type, entry.itemName, entry.itemCode, entry.destination].some((value) => normalize(value).includes(query)));
}

function statusFor(item) {
  if (Number(item.qty) <= Number(item.min)) return `<span class="pill danger">Critico</span>`;
  if (Number(item.qty) <= Number(item.min) + 2) return `<span class="pill warning">Atencao</span>`;
  return `<span class="pill">Normal</span>`;
}

function productForm(item = {}) {
  return `
    <div class="panel-head">
      <h3>${item.code ? "Editar produto" : "Novo produto"}</h3>
      <button type="button" class="icon-button" data-close>&times;</button>
    </div>
    <div class="form-grid">
      <label>Codigo<input name="code" required value="${escapeHtml(item.code)}"></label>
      <label>Nome<input name="name" required value="${escapeHtml(item.name)}"></label>
      <label>Categoria<input name="category" required value="${escapeHtml(item.category)}"></label>
      <label>Quantidade atual<input name="qty" type="number" min="0" required value="${item.qty ?? 0}"></label>
      <label>Quantidade minima<input name="min" type="number" min="0" required value="${item.min ?? 1}"></label>
      <label>Fornecedor<input name="supplier" value="${escapeHtml(item.supplier)}"></label>
      <label class="span-2">Observacao<input name="note" value="${escapeHtml(item.note)}"></label>
    </div>
    <button class="primary-action wide">Salvar produto</button>
  `;
}

function renderProdutos() {
  const container = $("#produtos-view");
  const items = filteredItems();
  container.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h3>Produtos</h3>
        <button id="new-product" class="primary-action">Novo</button>
      </div>
      <div class="table" style="--cols: 6">
        <div class="table-head"><span>Produto</span><span>Codigo</span><span>Categoria</span><span>Estoque</span><span>Status</span><span>Acoes</span></div>
        ${items.map((item) => `
          <div class="table-row">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.code)}</span>
            <span>${escapeHtml(item.category)}</span>
            <span>${item.qty}/${item.min}</span>
            ${statusFor(item)}
            <span class="actions">
              <button class="ghost-action" data-withdraw="${item.code}">Saida</button>
              <button class="ghost-action" data-edit="${item.code}">Editar</button>
            </span>
          </div>
        `).join("") || `<div class="table-row"><span class="muted">Nenhum produto encontrado.</span></div>`}
      </div>
    </section>
  `;

  container.querySelector("#new-product")?.addEventListener("click", () => openProduct());
  container.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openProduct(state.data.items.find((item) => item.code === button.dataset.edit))));
  container.querySelectorAll("[data-withdraw]").forEach((button) => button.addEventListener("click", () => {
    setView("saidas");
    $("#withdraw-code").value = button.dataset.withdraw;
  }));
}

function openProduct(item = null) {
  openModal(productForm(item || {}), async (form) => {
    await apiRequest("/items", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) });
    await refresh();
    toast("Produto salvo.");
  });
}

function renderEntradas() {
  $("#entradas-view").innerHTML = `
    <section class="panel flow-card">
      <div class="panel-head"><h3>Entrada de estoque</h3></div>
      <div class="form-grid">
        <label>Codigo<input id="replenish-code" placeholder="Ex: COD001"></label>
        <label>Quantidade<input id="replenish-qty" type="number" min="1" value="1"></label>
      </div>
      <button id="replenish-button" class="primary-action wide">Registrar entrada</button>
      <div id="replenish-result" class="result-box muted">Aguardando produto.</div>
    </section>
  `;
  $("#replenish-button").addEventListener("click", handleReplenish);
}

function renderSaidas() {
  $("#saidas-view").innerHTML = `
    <section class="panel flow-card">
      <div class="panel-head"><h3>Saida de estoque</h3><span class="muted">Tecnico solicita, admin libera</span></div>
      <div class="form-grid">
        <label>Tecnico
          <select id="withdraw-technician">
            ${state.data.technicians.map((name) => `<option value="${name}" ${name === state.user.name ? "selected" : ""}>${name}</option>`).join("")}
          </select>
        </label>
        <label>Destino
          <select id="withdraw-destination">${state.data.destinations.map((name) => `<option>${name}</option>`).join("")}</select>
        </label>
        <label>Codigo<input id="withdraw-code" placeholder="Bipe ou digite"></label>
        <label>Quantidade<input id="withdraw-qty" type="number" min="1" value="1"></label>
      </div>
      <button id="withdraw-button" class="primary-action wide">Solicitar saida</button>
      <div id="withdraw-result" class="result-box muted">Aguardando leitura.</div>
    </section>
    ${isAdmin() ? renderPendingRequests() : ""}
  `;
  $("#withdraw-button").addEventListener("click", handleWithdraw);
  bindPendingRequests();
}

function renderPendingRequests() {
  const pending = state.data.requests.filter((request) => request.status === "pending");
  return `
    <section class="panel" style="margin-top: 14px">
      <div class="panel-head"><h3>Solicitacoes pendentes</h3><span class="pill warning">${pending.length}</span></div>
      <div class="table" style="--cols: 6">
        <div class="table-head"><span>Tecnico</span><span>Produto</span><span>Destino</span><span>Qtd</span><span>Codigo</span><span>Acoes</span></div>
        ${pending.map((request) => `
          <div class="table-row">
            <strong>${escapeHtml(request.technician)}</strong>
            <span>${escapeHtml(request.itemName)}</span>
            <span>${escapeHtml(request.destination)}</span>
            <span>${request.qty}</span>
            <input data-scan="${request.id}" placeholder="${request.itemCode}">
            <button class="primary-action" data-approve="${request.id}">Liberar</button>
          </div>
        `).join("") || `<div class="table-row"><span class="muted">Nenhuma solicitacao pendente.</span></div>`}
      </div>
    </section>
  `;
}

function bindPendingRequests() {
  $$("[data-approve]").forEach((button) => button.addEventListener("click", async () => {
    const input = $(`[data-scan="${button.dataset.approve}"]`);
    await apiRequest(`/requests/${button.dataset.approve}/approve`, { method: "POST", body: JSON.stringify({ code: input.value }) });
    await refresh();
    toast("Saida liberada.");
  }));
}

async function handleWithdraw() {
  await apiRequest("/movements/withdraw", {
    method: "POST",
    body: JSON.stringify({
      code: $("#withdraw-code").value,
      technician: $("#withdraw-technician").value,
      destination: $("#withdraw-destination").value,
      quantity: Number($("#withdraw-qty").value || 1)
    })
  });
  $("#withdraw-result").textContent = "Solicitacao enviada para liberacao.";
  await refresh();
}

async function handleReplenish() {
  await apiRequest("/movements/replenish", {
    method: "POST",
    body: JSON.stringify({ code: $("#replenish-code").value, quantity: Number($("#replenish-qty").value || 1) })
  });
  $("#replenish-result").textContent = "Entrada registrada.";
  await refresh();
  toast("Estoque atualizado.");
}

function renderHistorico() {
  const rows = filteredHistory();
  $("#historico-view").innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Historico</h3><span class="muted">${rows.length} registros</span></div>
      <div class="table" style="--cols: 5">
        <div class="table-head"><span>Produto</span><span>Usuario</span><span>Tipo</span><span>Destino</span><span>Data</span></div>
        ${rows.map((entry) => `<div class="table-row"><strong>${escapeHtml(entry.itemName)}</strong><span>${escapeHtml(entry.user)}</span><span>${escapeHtml(entry.type)}</span><span>${escapeHtml(entry.destination)}</span><span>${formatDate(entry.at)}</span></div>`).join("") || `<div class="table-row"><span class="muted">Sem movimentacoes.</span></div>`}
      </div>
    </section>
  `;
}

function renderRelatorios() {
  $("#relatorios-view").innerHTML = renderDashboard(state.data);
}

function renderConfiguracoes() {
  $("#configuracoes-view").innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Configuracoes</h3></div>
      <p class="muted">Modulo preparado para parametros de compras, fornecedores, inventario, QR Code e codigo de barras.</p>
    </section>
  `;
}

async function renderActiveView() {
  $("#view-title").textContent = titles[state.view];
  $$(".view").forEach((node) => node.classList.toggle("active", node.id === `${state.view}-view`));
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));

  if (state.view === "dashboard") $("#dashboard-view").innerHTML = renderDashboard(state.data);
  if (state.view === "produtos") renderProdutos();
  if (state.view === "entradas") renderEntradas();
  if (state.view === "saidas") renderSaidas();
  if (state.view === "historico") renderHistorico();
  if (state.view === "relatorios") renderRelatorios();
  if (state.view === "usuarios") await renderUsuarios($("#usuarios-view"));
  if (state.view === "configuracoes") renderConfiguracoes();
}

async function refresh() {
  state.data = await apiRequest("/bootstrap");
  await renderActiveView();
}

async function setView(view) {
  if (!isAdmin() && ["usuarios", "configuracoes", "relatorios"].includes(view)) view = "dashboard";
  state.view = view;
  await renderActiveView();
  $("#sidebar").classList.remove("open");
}

async function enterApp(user, initialState = null) {
  state.user = user;
  state.data = initialState || await apiRequest("/bootstrap");
  document.body.classList.remove("locked");
  applyPermissions();
  await setView(isAdmin() ? "dashboard" : "produtos");
}

function bindShell() {
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#login-error").textContent = "";
    setLoading(true);
    try {
      const result = await login($("#login-email").value, $("#login-senha").value);
      await enterApp(result.user, result.state);
      toast("Login realizado.");
    } catch (error) {
      $("#login-error").textContent = error.message;
    } finally {
      setLoading(false);
    }
  });

  $("#logout-button").addEventListener("click", () => {
    logout();
    state.user = null;
    document.body.classList.add("locked");
  });
  $("#toggle-sidebar").addEventListener("click", () => $("#sidebar").classList.toggle("collapsed"));
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#global-search").addEventListener("input", () => renderActiveView());
}

async function init() {
  bindShell();
  const savedUser = currentUser();
  if (!getToken() && !savedUser) {
    try {
      setLoading(true);
      const user = await loadCurrentUser();
      await enterApp(user);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
    return;
  }
  try {
    setLoading(true);
    const user = await loadCurrentUser();
    await enterApp(user);
  } catch {
    logout();
  } finally {
    setLoading(false);
  }
}

init();
