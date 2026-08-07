import time
import os
from playwright.sync_api import sync_playwright

def extrarir_html():
    print("Iniciando Navegador via Playwright...")
    
    with sync_playwright() as p:
        # Iniciamos o chromium em modo visível
        browser = p.chromium.launch(headless=False, args=['--disable-blink-features=AutomationControlled'])
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # Oculta flag webdriver do navigator para ajudar a passar do Cloudflare
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = context.new_page()
        
        try:
            url = "https://commerce.datasys.online/Geral/AcessoDatasys.aspx"
            print(f"Acessando: {url}")
            page.goto(url)
            
            print("Aguardando 5 segundos para a página carregar...")
            time.sleep(5)
            
            print("Preenchendo credenciais...")
            # Pela foto, os campos têm placeholders específicos
            campo_senha = page.locator('input[type="password"]')
            
            # Localiza o usuário e a empresa pelo atributo ou índice
            campo_usuario = page.locator('input[type="text"]').nth(0)
            campo_empresa = page.locator('input[type="text"]').nth(1)
            
            if campo_senha.count() > 0:
                campo_senha.first.fill("Luizinx778?")
            
            try:
                campo_usuario.fill("48441202800")
            except:
                pass
                
            try:
                # O campo da empresa
                campo_empresa.fill("OUTLETDOCELULAR")
            except:
                print("Não achei o campo da empresa automaticamente.")
                
            print("Aguardando 15 segundos para você corrigir qualquer campo errado, clicar em Acessar ou passar do Cloudflare...")
            time.sleep(15)
            
            print("\n" + "="*50)
            print(" 🚨 ATENÇÃO! 🚨")
            print("Faça o login se o robô não clicou.")
            print("Navegue até a tela de MUDAR DEPÓSITOS ou AJUSTE DE ESTOQUE.")
            print("Quando a tela estiver na sua frente, aperte ENTER aqui neste terminal.")
            print("="*50)
            
            input("Aperte ENTER quando estiver pronto para extrair o código...")
            
            # Pega o HTML da página atual
            html = page.content()
            
            caminho = os.path.join(os.getcwd(), "datasys_codigo.html")
            with open(caminho, "w", encoding="utf-8") as f:
                f.write(html)
                
            print(f"✅ SUCESSO! Código salvo em: {caminho}")
            print("Por favor, anexe este arquivo no chat!")
            
        except Exception as e:
            print(f"Erro: {e}")
            
        finally:
            browser.close()

if __name__ == "__main__":
    extrarir_html()
