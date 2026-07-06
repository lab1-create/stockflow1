import { apiRequest, getToken } from "./api.js";
import { currentUser, login, logout } from "./auth.js";
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
  $("#session-label").textContent = state.user ? `${state.user.name} - ${isAdmin() ? "Administrador" : "Técnico"}` : "Sessão";
}

async function loadBootstrap() {
  state.data = await apiRequest("/bootstrap");
}

function filteredItems() {
  const query = normalize($("#global-search").value);
  if (!query) return state.data.items;
  return state.data.items.filter((item) => normalize(item.name).includes(query) || normalize(item.code).includes(query));
}

function renderActiveView() {
  const container = $(`#${state.view}-view`);
  if (!container) return;
  if (state.view === "dashboard") {
    container.innerHTML = renderDashboard(state.data);
  } else if (state.view === "usuarios") {
    container.innerHTML = renderUsuarios(state.data.users);
  } else {
    container.innerHTML = `<p class="muted">Tela em desenvolvimento: ${titles[state.view]}</p>`;
  }
}

async function setView(viewName) {
  state.view = viewName;
  $("#view-title").textContent = titles[viewName] || "Painel";
  $$(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === viewName));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${viewName}-view`));
  renderActiveView();
}

async function enterApp(user, initialState = null) {
  state.user = user;
  state.data = initialState || await apiRequest("/bootstrap");
  
  // Atualiza classes do body para refletir o cargo dinamicamente no CSS
  document.body.classList.remove("locked", "is-tech");
  if (!isAdmin()) {
    document.body.classList.add("is-tech");
  }
  
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
    document.body.classList.remove("is-tech");
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
  if (!getToken() || !savedUser) return;
  try {
    setLoading(true);
    await enterApp(savedUser);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
}

init();
