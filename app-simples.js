// STOCKFLOW - VERSÃO SIMPLIFICADA PARA SUPABASE
const API_BASE = "/api";
const STORAGE_KEY = "stockflow-state-v2";

let state = { users: [], destinations: [], items: [], history: [], requests: [] };
let currentUser = null;
let currentView = "dashboard";
let usingApi = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function apiRequest(path, method = "GET", body = null) {
    try {
        const opts = { method, headers: { "Content-Type": "application/json" } };
        if (body) opts.body = JSON.stringify(body);
        
        const res = await fetch(`${API_BASE}${path}`, opts);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `Erro ${res.status}`);
        }
        return await res.json();
    } catch (error) {
        console.error(`Erro em ${path}:`, error);
        throw error;
    }
}

function mapSupabaseData(apiData) {
    return {
        users: apiData.users || [],
        destinations: apiData.destinations || [],
        items: (apiData.supplies || []).map(s => ({
            code: s.code,
            name: s.name,
            category: s.category,
            qty: s.current_quantity
        })),
        history: (apiData.movements || []).map(m => ({
            type: "Retirada",
            itemCode: m.code,
            itemName: m.supply_name,
            destination: m.dest_name,
            qty: m.quantity,
            user: m.user_name,
            at: m.created_at
        })),
        requests: (apiData.requests || []).map(r => ({
            id: r.id,
            itemCode: r.code,
            itemName: r.supply_name,
            technician: r.user_name,
            destination: r.dest_name,
            qty: r.quantity,
            status: r.status
        }))
    };
}

async function doLogin() {
    const name = $("#login-user").value.trim();
    const pin = $("#login-pin").value.trim();
    const error = $("#login-error");
    error.textContent = "";

    if (!name || !pin) {
        error.textContent = "Preencha usuário e PIN!";
        return;
    }

    try {
        const result = await apiRequest("/login", "POST", { name, pin });
        currentUser = result.user;
        state = mapSupabaseData(result.state);
        usingApi = true;
        
        document.body.classList.remove("locked");
        renderApp();
    } catch (err) {
        error.textContent = err.message;
    }
}

function logout() {
    currentUser = null;
    state = { users: [], destinations: [], items: [], history: [], requests: [] };
    usingApi = false;
    document.body.classList.add("locked");
    $("#login-user").value = "";
    $("#login-pin").value = "";
    renderApp();
}

function setView(view) {
    currentView = view;
    renderApp();
}

function renderApp() {
    if (!currentUser) {
        renderLogin();
    } else {
        renderDashboard();
    }
}

function renderLogin() {
    const loginForm = $("#login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            doLogin();
        });
    }
}

function renderDashboard() {
    if (!$("#login-screen")) return;
    
    const isAdmin = currentUser.role === "admin";
    const supplies = state.items || [];
    const pendingRequests = (state.requests || []).filter(r => r.status === "pending");
    
    // Mostrar conteúdo
    const shell = document.querySelector(".app-shell");
    if (shell) {
        shell.style.display = "block";
    }
    
    // Atualizar dados nos elementos
    updateDashboardData();
}

function updateDashboardData() {
    // Dashboard view
    if (currentView === "dashboard") {
        const supplies = state.items || [];
        const container = $("#dashboard-view");
        if (container) {
            container.innerHTML = `
                <h1>Dashboard</h1>
                <p>Total de Insumos: ${supplies.length}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nome</th>
                            <th>Quantidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${supplies.map(s => `
                            <tr>
                                <td>${s.code}</td>
                                <td>${s.name}</td>
                                <td>${s.qty}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        }
    }
}

// Evento de envio do login form
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = $("#login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            doLogin();
        });
    }
    
    // Logout
    document.addEventListener("click", (e) => {
        if (e.target.dataset.logout) {
            logout();
        }
    });
    
    renderApp();
});

// Expor funções globais
window.setView = setView;
window.logout = logout;
