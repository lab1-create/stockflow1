import time
from playwright.sync_api import sync_playwright

print("Iniciando Playwright invisível...")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--disable-blink-features=AutomationControlled'])
    context = browser.new_context(
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    page = context.new_page()
    page.goto("https://commerce.datasys.online/Geral/AcessoDatasys.aspx")
    print("Página carregada, aguardando Cloudflare (10s)...")
    time.sleep(10)
    
    print("Preenchendo credenciais...")
    try:
        # Preenche os campos
        page.locator('input[type="password"]').first.fill("Luizinx778?")
        page.locator('input[type="text"]').nth(0).fill("48441202800")
        page.locator('input[type="text"]').nth(1).fill("OUTLETDOCELULAR")
        
        # Clica em Acessar (geralmente é o primeiro botão ou input submit)
        btn = page.locator('button, input[type="submit"]').first
        btn.click()
    except Exception as e:
        print(f"Erro ao preencher: {e}")
        
    print("Aguardando carregamento do painel (15s)...")
    time.sleep(15)
    
    html = page.content()
    with open("codigo_datasys.html", "w", encoding="utf-8") as f:
        f.write(html)
        
    print("HTML SALVO COM SUCESSO!")
    browser.close()
