// ============================================================================
// STOCKFLOW - APP.JS SIMPLIFICADO PARA SUPABASE
// ============================================================================

const API_BASE = "/api";

// Estado global
let state = {
    users: [],
    destinations: [],
    supplies: [],
    movements: [],
    requests: []
};

let currentUser = null;
let currentView = "dashboard";
let usingApi = false;

// ============================================================================
// UTILIDADES
// ============================================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function apiRequest(path, method = "GET", body = null) {
    try {
        const options = {
            method,
            headers: { "Content-Type": "application/json" }
        };
        if (body) options.body = JSON.stringify(body);
        
        const res = await fetch(`${API_BASE}${path}`, options);
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

async function login(name, pin) {
    try {
        const result = await apiRequest("/login", "POST", { name, pin });
        currentUser = result.user;
        state = result.state;
        usingApi = true;
        renderApp();
        return true;
    } catch (error) {
        alert(`Erro: ${error.message}`);
        return false;
    }
}

function logout() {
    currentUser = null;
    state = { users: [], destinations: [], supplies: [], movements: [], requests: [] };
    usingApi = false;
    renderApp();
}

// ============================================================================
// RENDERIZAÇÃO
// ============================================================================

function renderApp() {
    if (!currentUser) {
        renderLogin();
    } else {
        renderDashboard();
    }
}

function renderLogin() {
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f5f5f5;">
            <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px;">
                <h1 style="text-align: center; margin-bottom: 30px;">🔐 StockFlow</h1>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Usuário:</label>
                    <input 
                        id="login-user" 
                        type="text" 
                        placeholder="Nome do usuário"
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"
                    />
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">PIN:</label>
                    <input 
                        id="login-pin" 
                        type="password" 
                        placeholder="Seu PIN"
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"
                    />
                </div>
                
                <button 
                    onclick="handleLogin()"
                    style="width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer;"
                >
                    Entrar
                </button>
            </div>
        </div>
    `;
    
    $("#login-pin").addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleLogin();
    });
}

async function handleLogin() {
    const name = $("#login-user").value.trim();
    const pin = $("#login-pin").value.trim();
    
    if (!name || !pin) {
        alert("Preencha usuário e PIN!");
        return;
    }
    
    const success = await login(name, pin);
    if (success) {
        $("#login-user").value = "";
        $("#login-pin").value = "";
    }
}

function renderDashboard() {
    const isAdmin = currentUser.role === "admin";
    const supplies = state.supplies || [];
    const requests = state.requests || [];
    const pendingRequests = requests.filter(r => r.status === "pending");
    
    document.body.innerHTML = `
        <div style="font-family: Arial, sans-serif; background: #f5f5f5; min-height: 100vh; padding: 20px;">
            <div style="max-width: 1200px; margin: 0 auto;">
                
                <!-- Cabeçalho -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h1 style="margin: 0; color: #333;">📦 StockFlow</h1>
                            <p style="margin: 5px 0 0 0; color: #666;">Usuário: <strong>${currentUser.name}</strong> (${currentUser.role === "admin" ? "Administrador" : "Técnico"})</p>
                        </div>
                        <button 
                            onclick="logout()"
                            style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;"
                        >
                            Sair
                        </button>
                    </div>
                </div>
                
                <!-- Dashboard -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    
                    <!-- Card: Insumos -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 10px 0; color: #333;">📋 Insumos</h3>
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #007bff;">${supplies.length}</p>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Total no estoque</p>
                    </div>
                    
                    <!-- Card: Solicitações Pendentes -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 10px 0; color: #333;">📬 Solicitações</h3>
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${pendingRequests.length > 0 ? "#ffc107" : "#28a745"};">${pendingRequests.length}</p>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Aguardando aprovação</p>
                    </div>
                    
                    <!-- Card: Movimentações -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin: 0 0 10px 0; color: #333;">📊 Movimentações</h3>
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #6c757d;">${(state.movements || []).length}</p>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Últimas 100</p>
                    </div>
                    
                </div>
                
                <!-- Tabela de Insumos -->
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 30px;">
                    <h2 style="margin: 0 0 15px 0; color: #333;">Insumos Disponíveis</h2>
                    ${supplies.length === 0 ? `
                        <p style="color: #999; text-align: center; padding: 20px;">Nenhum insumo cadastrado</p>
                    ` : `
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                        <th style="padding: 10px; text-align: left; font-weight: bold;">Código</th>
                                        <th style="padding: 10px; text-align: left; font-weight: bold;">Nome</th>
                                        <th style="padding: 10px; text-align: left; font-weight: bold;">Categoria</th>
                                        <th style="padding: 10px; text-align: right; font-weight: bold;">Quantidade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${supplies.map(s => `
                                        <tr style="border-bottom: 1px solid #dee2e6;">
                                            <td style="padding: 10px;">${s.code || "-"}</td>
                                            <td style="padding: 10px;">${s.name || "-"}</td>
                                            <td style="padding: 10px;">${s.category || "-"}</td>
                                            <td style="padding: 10px; text-align: right; font-weight: bold;">${s.current_quantity || 0}</td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
                
                ${isAdmin ? `
                    <!-- Solicitações Pendentes (Apenas Admin) -->
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="margin: 0 0 15px 0; color: #333;">Solicitações Pendentes</h2>
                        ${pendingRequests.length === 0 ? `
                            <p style="color: #999; text-align: center; padding: 20px;">Nenhuma solicitação pendente</p>
                        ` : `
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                            <th style="padding: 10px; text-align: left; font-weight: bold;">Usuário</th>
                                            <th style="padding: 10px; text-align: left; font-weight: bold;">Insumo</th>
                                            <th style="padding: 10px; text-align: left; font-weight: bold;">Destino</th>
                                            <th style="padding: 10px; text-align: right; font-weight: bold;">Quantidade</th>
                                            <th style="padding: 10px; text-align: center; font-weight: bold;">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${pendingRequests.map(r => `
                                            <tr style="border-bottom: 1px solid #dee2e6;">
                                                <td style="padding: 10px;">${r.user_name || "-"}</td>
                                                <td style="padding: 10px;">${r.supply_name || "-"}</td>
                                                <td style="padding: 10px;">${r.dest_name || "-"}</td>
                                                <td style="padding: 10px; text-align: right; font-weight: bold;">${r.quantity || 0}</td>
                                                <td style="padding: 10px; text-align: center;">
                                                    <button 
                                                        onclick="approveRequest('${r.id}')"
                                                        style="padding: 5px 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;"
                                                    >
                                                        ✓ Aprovar
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join("")}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                ` : ""}
                
            </div>
        </div>
    `;
}

async function approveRequest(requestId) {
    if (!confirm("Confirmar aprovação?")) return;
    
    try {
        await apiRequest(`/requests/${requestId}/approve`, "POST", { admin_id: currentUser.id });
        const result = await apiRequest("/bootstrap");
        state = result;
        renderDashboard();
        alert("✅ Solicitação aprovada!");
    } catch (error) {
        alert(`❌ Erro: ${error.message}`);
    }
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

window.addEventListener("DOMContentLoaded", () => {
    renderLogin();
});

// Exponho funções globais para HTML
window.login = login;
window.logout = logout;
window.handleLogin = handleLogin;
window.approveRequest = approveRequest;
