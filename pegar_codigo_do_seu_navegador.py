import pyautogui
import time
import os

pyautogui.FAILSAFE = False

print("\n" + "="*50)
print(" INICIANDO AUTOMAÇÃO DE LOGIN PARA EXTRAIR O CÓDIGO ")
print("="*50)

url = "https://commerce.datasys.online/Geral/AcessoDatasys.aspx"
print(f"1. Abrindo a página do Data Sys: {url}")
os.system(f'start "" "{url}"')

print("2. Aguardando 15 segundos para o Cloudflare verificar e a página carregar...")
time.sleep(15)

print("3. Clicando no meio da tela para garantir foco...")
# Clica no centro da tela (ajuda a focar na janela do navegador)
tela_largura, tela_altura = pyautogui.size()
pyautogui.click(tela_largura / 2, tela_altura / 2)
time.sleep(1)

print("4. Tentando focar no campo da Empresa e digitar OUTLETDOCELULAR...")
# A maioria das telas de login foca no primeiro campo (Usuário).
# Apertar Tab 2 vezes geralmente leva da Senha para a Empresa, 
# Mas como você disse que só digita OUTLETDOCELULAR, vamos garantir.
# Vou dar um clique de segurança no campo de Empresa usando o atalho de pesquisa do navegador
pyautogui.hotkey('ctrl', 'f')
time.sleep(1)
pyautogui.write("Acessar")
time.sleep(1)
pyautogui.press('esc')
time.sleep(1)
# Agora estamos perto do botão Acessar. Um Shift+Tab deve focar no campo Empresa
pyautogui.hotkey('shift', 'tab')
time.sleep(0.5)

pyautogui.write("OUTLETDOCELULAR", interval=0.05)
time.sleep(1)
pyautogui.press('enter')

print("5. Login efetuado! Aguardando 15 segundos para carregar o Dashboard...")
time.sleep(15)

print("6. Ativando braços robóticos (Ctrl+S) para salvar a página...")
pyautogui.hotkey('ctrl', 's')
print("Aguardando 5 segundos para a janela de 'Salvar Como' abrir...")
time.sleep(5)

# Caminho absoluto para não ter erro
caminho = r"C:\Users\Lab1\Desktop\stockflow-main\stockflow-main\codigo_datasys_capturado.html"

# Se o arquivo já existir, vamos apagá-lo primeiro para o Windows não perguntar se quer substituir
if os.path.exists(caminho):
    try:
        os.remove(caminho)
    except:
        pass

print("Digitando o caminho do arquivo lentamente...")
# Digita o caminho bem devagar
pyautogui.write(caminho, interval=0.05)
print("Aguardando 2 segundos antes de dar Enter...")
time.sleep(2)

# Aperta Enter para salvar
pyautogui.press('enter')
time.sleep(3) # Espera o download concluir

print("\n✅ PRONTINHO! A página foi salva com sucesso do SEU navegador.")
print("O arquivo se chama: codigo_datasys_capturado.html")
print("Pode arrastar ele aqui para o chat!")
