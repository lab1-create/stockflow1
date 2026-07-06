import { apiRequest, getToken } from "./api.js";
import { $, $$, escapeHtml, formatDate, normalize, openModal, setLoading, toast } from "./utils.js";

// ==========================================
// 1. MÓDULOS INTEGRADOS (Substituem os ficheiros errados)
// ==========================================

async function login(email, senha) {
  const result = await apiRequest("/login", { method: "POST", body: JSON.stringify({ email, senha }) });
  localStorage.setItem("token", result.token);
  localStorage.setItem("user", JSON.stringify(result.user));
  return result;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function metric(label, value, className = "") {
  return `<article class="metric ${className}"><span>${label}</span><strong>${value}</strong></article>`;
}

function historyRow(entry) {
  return `
    <div class="table-row">
      <strong>${entry.itemName || "Item"}</strong>
      <span>${entry.user || "Sistema"}</span>
      <span>${entry.type || "-"}</span>
      <span>${entry.qty || 0} un. - ${formatDate(entry.at)}</span>
    </div>
  `;
}

function renderDashboard(state) {
  const dashboard = state.dashboard || {};
  const critical = (state.items || []).filter((item) => Number(item.qty) <= Number(item.min));
  const topUsed = [...(state.history || [])]
    .filter((entry) => entry.type === "Retirada" || entry.type === "Saida")
    .reduce((acc, entry) => {
      if (!entry.itemCode) return acc;
      acc[entry.itemCode] = acc[entry.itemCode] || { name: entry.itemName, code: entry.itemCode, qty: 0 };
      acc[entry.itemCode].qty += Number(entry.qty || 0);
      return acc;
    }, {});
  const topRows = Object.values(topUsed).sort((a, b) => b.qty - a.qty).slice(0, 6);

  return `
    <div class="metrics-grid">
      ${metric("Produtos", dashboard.produtos ?? (state.items?.length || 0))}
      ${metric("Entradas Hoje", dashboard.entradas_hoje ?? 0)}
      ${metric("Saídas Hoje", dashboard.saidas_hoje ?? 0)}
      ${metric("Estoque Crítico", critical.length, critical.length > 0 ? "danger" : "")}
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-head"><h3>Últimas Atividades</h3><span class="muted">${(state.history || []).length} registos</span></div>
        <div class="table" style="--cols: 4">
          <div class="table-head"><span>Produto</span><span>Usuário</span><span>Tipo</span><span>Quando</span></div>
          ${(state.history || []).slice(0, 8).map(historyRow).join("") || `<div class="table-row"><span class="muted">Nenhuma movimentação.</span></div>`}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Mais utilizados</h3></div>
        <div class="table" style="--cols: 3">
          <div class="table-head"><span>Produto</span><span>Código</span><span>Saídas</span></div>
          ${topRows.map((row) => `<div class="table-row"><strong>${row.name}</strong><span>${row.code}</span><span>${row.qty}</span></div>`).join("") || `<div class="table-row"><span class="muted">Sem dados.</span></div>`}
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top: 14px">
      <div class="panel-head"><h3>Estoque Crítico</h3></div>
      <div class="table" style="--cols: 4">
        <div class="table-head"><span>Produto</span><span>Código</span><span>Atual</span><span>Mínimo</span></div>
        ${critical.map((item) => `<div class="table-row"><strong>${item.name}</strong><span>${item.code}</span><span>${item.qty}</span><span>${item.min}</span></div>`).join("") || `<div class="table-row"><span class="muted">Nenhum item em nível crítico.</span></div>`}
      </div>
    </section>
  `;
}

async function renderUsuarios(container) {
  if (!container) return;
  try {
    const res = await apiRequest("/usuarios");
    const list = res.users || res || [];
    container.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h3>Utilizadores</h3></div>
        <div class="table" style="--cols: 3">
          <div class="table-head"><span>Nome</span><span>Email</span><span>Função</span></div>
          ${Array.isArray(list) ? list.map(u => `<div class="table-row"><strong>${escapeHtml(u.name)}</strong><span>${escapeHtml(u.email)}</span><span>${u.role}</span></div>`).join("") : `<div class="table-row"><span class="muted">Sem utilizadores.</span></div>`}
        </div>
      </section>
    `;
  } catch (err) {
    container.innerHTML = `<p class="muted">Erro ao carregar utilizadores.</p>`;
  }
}


// ==========================================
// 2. LÓGICA PRINCIPAL DO APP (O seu código revisto)
// ==========================================

const state = {
  user: null,
  data: { items: [], history: [], requests: [], technicians: [], destinations: [], dashboard: {} },
  view: "dashboard"
};

const titles = {
  dashboard: "Dashboard",
  produtos: "Produtos",
  entradas: "Entradas",
  saidas: "Saídas",
  historico: "Histórico",
  relatorios: "Relatórios",
  usuarios: "Usuários",
  configuracoes: "Configurações"
};

function isAdmin() {
  return state.user?.role === "admin";
}

function applyPermissions() {
  $$(".admin-only").forEach((node) => node.hidden = !isAdmin());
  $$("[data-view='relatorios']").forEach((node) => node.hidden = !isAdmin());
  $$("[data-view='usuarios']").forEach((node) => node.hidden = !isAdmin());
  $$("[data-view='configuracoes']").forEach((node) => node.hidden = !isAdmin());
  const lbl = $("#session-label");
  if (lbl) lbl.textContent = state.user ? `${state.user.name} - ${isAdmin() ? "Administrador" : "Técnico"}` : "Sessão";
}

async function loadBootstrap() {
  try {
    state.data = await apiRequest("/bootstrap");
  } catch (e) {
    console.error("Erro no bootstrap", e);
  }
}

function filteredItems() {
  const el = $("#global-search");
  const query = normalize(el ? el.value : "");
  if (!query) return state.data.items || [];
  return (state.data.items || []).filter((item) => 
    [item.code, item.name, item.category, item.supplier, item.note].some((value) => 
      normalize(value || "").includes(query)
    )
  );
}

function filteredHistory() {
  const el = $("#global-search");
  const query = normalize(el ? el.value : "");
  if (!query) return state.data.history || [];
  return (state.data.history || []).filter((entry) => 
    [entry.user, entry.type, entry.itemName, entry.itemCode, entry.destination].some((value) => 
      normalize(value || "").includes(query)
    )
  );
}

function statusFor(item) {
  if (Number(item.qty) <= Number(item.min)) return `<span class="pill danger">Crítico</span>`;
  if (Number(item.qty) <= Number(item.min) + 2) return `<span class="pill warning">Atenção</span>`;
  return `<span class="pill">Normal</span>`;
}

function productForm(item = {}) {
  return `
    <div class="panel-head">
      <h3>${item.code ? "Editar produto" : "Novo produto"}</h3>
      <button type="button" class="icon-button" data-close>×</button>
    </div>
    <div class="form-grid">
      <label>Código<input name="code" required value="${escapeHtml(item.code || "")}"></label>
      <label>Nome<input name="name" required value="${escapeHtml(item.name || "")}"></label>
      <label>Categoria<input name="category" required value="${escapeHtml(item.category || "")}"></label>
      <label>Quantidade atual<input name="qty" type="number" min="0" required value="${item.qty ?? 0}"></label>
      <label>Quantidade mínima<input name="min" type="number" min="0" required value="${item.min ?? 1}"></label>
      <label>Fornecedor<input name="supplier" value="${escapeHtml(item.supplier || "")}"></label>
      <label class="span-2">Observação<input name="note" value="${escapeHtml(item.note || "")}"></label>
    </div>
    <button class="primary-action wide">Salvar produto</button>
  `;
}

function renderProdutos() {
  const container = $("#produtos-view");
  if (!container) return;
  const items = filteredItems();
  container.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h3>Produtos</h3>
        ${isAdmin() ? `<button id="new-product" class="primary-action">Novo</button>` : ""}
      </div>
      <div class="table" style="--cols: 6">
        <div class="table-head"><span>Produto</span><span>Código</span><span>Categoria</span><span>Estoque</span><span>Status</span><span>Ações</span></div>
        ${items.map((item) => `
          <div class="table-row">
            <strong>${escapeHtml(item.name || "")}</strong>
            <span>${escapeHtml(item.code || "")}</span>
            <span>${escapeHtml(item.category || "")}</span>
            <span>${item.qty}/${item.min}</span>
            ${statusFor(item)}
            <span class="actions">
              <button class="ghost-action" data-withdraw="${item.code}">Saída</button>
              ${isAdmin() ? `<button class="ghost-action" data-edit="${item.code}">Editar</button>` : ""}
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
    const el = $("#withdraw-code");
    if (el) el.value = button.dataset.withdraw;
  }));
}

function openProduct(item = null) {
  openModal(productForm(item || {}), async (form) => {
    try {
      await apiRequest("/items", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) });
      await refresh();
      toast("Produto salvo.");
    } catch (err) {
      toast(err.message, "danger");
    }
  });
}

function renderEntradas() {
  const container = $("#entradas-view");
  if (!container) return;
  container.innerHTML = `
    <section class="panel flow-card">
      <div class="panel-head"><h3>Entrada de estoque</h3></div>
      <div class="form-grid">
        <label>Código<input id="replenish-code" placeholder="Ex: COD001"></label>
        <label>Quantidade<input id="replenish-qty" type="number" min="1" value="1"></label>
      </div>
      <button id="replenish-button" class="primary-action wide">Registrar entrada</button>
      <div id="replenish-result" class="result-box muted">Aguardando produto.</div>
    </section>
  `;
  $("#replenish-button")?.addEventListener("click", handleReplenish);
}

function renderSaidas() {
  const container = $("#saidas-view");
  if (!container) return;
  
  const technicians = state.data.technicians || [];
  const destinations = state.data.destinations || [];

  container.innerHTML = `
    <section class="panel flow-card">
      <div class="panel-head"><h3>Saída de estoque</h3><span class="muted">Técnico solicita, admin libera</span></div>
      <div class="form-grid">
        <label>Técnico
          <select id="withdraw-technician">
            ${technicians.map((name) => `<option value="${name}" ${state.user && name === state.user.name ? "selected" : ""}>${name}</option>`).join("")}
          </select>
        </label>
        <label>Destino
          <select id="withdraw-destination">${destinations.map((name) => `<option>${name}</option>`).join("")}</select>
        </label>
        <label>Código<input id="withdraw-code" placeholder="Bipe ou digite"></label>
        <label>Quantidade<input id="withdraw-qty" type="number" min="1" value="1"></label>
      </div>
      <button id="withdraw-button" class="primary-action wide">Solicitar saída</button>
      <div id="withdraw-result" class="result-box muted">Aguardando leitura.</div>
    </section>
    ${isAdmin() ? renderPendingRequests() : ""}
  `;
  $("#withdraw-button")?.addEventListener("click", handleWithdraw);
  if (isAdmin()) bindPendingRequests();
}

function renderPendingRequests() {
  const pending = (state.data.requests || []).filter((request) => request.status === "pending");
  return `
    <section class="panel" style="margin-top: 14px">
      <div class="panel-head"><h3>Solicitações pendentes</h3><span class="pill warning">${pending.length}</span></div>
      <div class="table" style="--cols: 6">
        <div class="table-head"><span>Técnico</span><span>Produto</span><span>Destino</span><span>Qtd</span><span>Código</span><span>Ações</span></div>
        ${pending.map((request) => `
          <div class="table-row">
            <strong>${escapeHtml(request.technician || "")}</strong>
            <span>${escapeHtml(request.itemName || "")}</span>
            <span>${escapeHtml(request.destination || "")}</span>
            <span>${request.qty}</span>
            <input data-scan="${request.id}" placeholder="${request.itemCode || ""}">
            <button class="primary-action" data-approve="${request.id}">Liberar</button>
          </div>
        `).join("") || `<div class="table-row"><span class="muted">Nenhuma solicitação pendente.</span></div>`}
      </div>
    </section>
  `;
}

function bindPendingRequests() {
  $$("[data-approve]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const input = $(`[data-scan="${button.dataset.approve}"]`);
      await apiRequest(`/requests/${button.dataset.approve}/approve`, { method: "POST", body: JSON.stringify({ code: input ? input.value : "" }) });
      await refresh();
      toast("Saída liberada.");
    } catch (e) {
      toast(e.message, "danger");
    }
  }));
}

async function handleWithdraw() {
  try {
    await apiRequest("/movements/withdraw", {
      method: "POST",
      body: JSON.stringify({
        code: $("#withdraw-code").value,
        technician: $("#withdraw-technician").value,
        destination: $("#withdraw-destination").value,
        quantity: Number($("#withdraw-qty").value || 1)
      })
    });
    await refresh();
    const el = $("#withdraw-result");
    if (el) el.textContent = "Solicitação enviada para liberação.";
  } catch (e) {
    toast(e.message, "danger");
  }
}

async function handleReplenish() {
  try {
    await apiRequest("/movements/replenish", {
      method: "POST",
      body: JSON.stringify({ code: $("#replenish-code").value, quantity: Number($("#replenish-qty").value || 1) })
    });
    await refresh();
    const el = $("#replenish-result");
    if (el) el.textContent = "Entrada registada.";
    toast("Estoque atualizado.");
  } catch (e) {
    toast(e.message, "danger");
  }
}

function renderHistorico() {
  const container = $("#historico-view");
  if (!container) return;
  const rows = filteredHistory();
  container.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Histórico</h3><span class="muted">${rows.length} registos</span></div>
      <div class="table" style="--cols: 5">
        <div class="table-head"><span>Produto</span><span>Usuário</span><span>Tipo</span><span>Destino</span><span>Data</span></div>
        ${rows.map((entry) => `
          <div class="table-row">
            <strong>${escapeHtml(entry.itemName || "")}</strong>
            <span>${escapeHtml(entry.user || "")}</span>
            <span>${escapeHtml(entry.type || "")}</span>
            <span>${escapeHtml(entry.destination || "")}</span>
            <span>${formatDate(entry.at)}</span>
          </div>
        `).join("") || `<div class="table-row"><span class="muted">Sem movimentações.</span></div>`}
      </div>
    </section>
  `;
}

function renderRelatorios() {
  const container = $("#relatorios-view");
  if (container) container.innerHTML = renderDashboard(state.data);
}

function renderConfiguracoes() {
  const container = $("#configuracoes-view");
  if (container) {
    container.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h3>Configurações</h3></div>
        <p class="muted">Módulo preparado para parâmetros de compras, fornecedores, inventário, QR Code e código de barras.</p>
      </section>
    `;
  }
}

async function renderActiveView() {
  const titleEl = $("#view-title");
  if (titleEl) titleEl.textContent = titles[state.view] || "Painel";
  
  $$(".view").forEach((node) => node.classList.toggle("active", node.id === `${state.view}-view`));
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));

  if (state.view === "dashboard") {
    const view = $("#dashboard-view");
    if (view) view.innerHTML = renderDashboard(state.data);
  }
  if (state.view === "produtos") renderProdutos();
  if (state.view === "entradas") renderEntradas();
  if (state.view === "saidas") renderSaidas();
  if (state.view === "historico") renderHistorico();
  if (state.view === "relatorios") renderRelatorios();
  if (state.view === "usuarios") await renderUsuarios($("#usuarios-view"));
  if (state.view === "configuracoes") renderConfiguracoes();
}

async function refresh() {
  try {
    state.data = await apiRequest("/bootstrap");
    await renderActiveView();
  } catch (e) {
    console.error(e);
  }
}

async function setView(view) {
  if (!isAdmin() && ["usuarios", "configuracoes", "relatorios"].includes(view)) view = "dashboard";
  state.view = view;
  await renderActiveView();
  const sb = $("#sidebar");
  if (sb) sb.classList.remove("open");
}

async function enterApp(user, initialState = null) {
  state.user = user;
  state.data = initialState || await apiRequest("/bootstrap").catch(() => state.data);
  document.body.classList.remove("locked");
  applyPermissions();
  await setView(isAdmin() ? "dashboard" : "produtos");
}

function bindShell() {
  $("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const err = $("#login-error");
    if (err) err.textContent = "";
    setLoading(true);
    try {
      const result = await login($("#login-email").value, $("#login-senha").value);
      await enterApp(result.user, result.state);
      toast("Login realizado com sucesso.");
    } catch (error) {
      if (err) err.textContent = error.message;
    } finally {
      setLoading(false);
    }
  });

  $("#logout-button")?.addEventListener("click", () => {
    logout();
    state.user = null;
    document.body.classList.add("locked");
  });
  $("#toggle-sidebar")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("collapsed"));
  $("#mobile-menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#global-search")?.addEventListener("input", () => renderActiveView());
}

async function init() {
  bindShell();
  const savedUser = currentUser();
  if (!getToken() || !savedUser) return;
  try {
    setLoading(true);
    await enterApp(savedUser);
  } catch {
    logout();
  } finally {
    setLoading(false);
  }
}

init();
