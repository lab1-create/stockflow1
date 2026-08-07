import pandas as pd
from datetime import datetime
import os
import time
import pyautogui

NOME_PLANILHA = r"G:\.shortcut-targets-by-id\1AnC76YAQSdc01859KhtPLRHwKF96Q2Nr\ECOSSISTEMA PEDIDO DE PEÇAS\PLANILHA DE REPARO LUIZ.xlsx"

# Peças físicas que levam "trocado" na frente
PECAS_FISICAS = [
    "bateria", "frontal", "lente", "tampa", "tela", "display",
    "conector", "flex", "alto falante", "auto falante", "microfone",
    "camera", "câmera", "botao", "botão", "placa", "carcaca",
    "carcaça", "aro", "moldura", "touch", "lcd", "sensor",
    "antena", "vibrador", "gaveta", "slot", "película"
]

def formatar_descricao_reparo(lista_pecas):
    """
    Recebe uma LISTA de peças (já agrupadas por IMEI).
    Peças físicas: 'trocado bateria', 'trocado frontal e bateria'
    Serviços (recolagem, limpeza, etc): 'realizado recolagem'
    """
    if not lista_pecas:
        return "reparo realizado"
    
    # Limpar e filtrar peças válidas
    pecas_limpas = []
    for p in lista_pecas:
        if p is None or str(p).strip() == '' or str(p).strip().lower() in ['nan', 'none']:
            continue
        pecas_limpas.append(str(p).strip().lower())
    
    if not pecas_limpas:
        return "reparo realizado"
    
    # Separar peças físicas de serviços
    fisicas = []
    servicos = []
    
    for peca in pecas_limpas:
        eh_fisica = False
        for pf in PECAS_FISICAS:
            if pf in peca:
                eh_fisica = True
                break
        if eh_fisica:
            fisicas.append(peca)
        else:
            servicos.append(peca)
    
    # Montar o texto final
    partes = []
    if fisicas:
        texto_fisicas = " e ".join(fisicas)
        partes.append(f"trocado {texto_fisicas}")
    if servicos:
        texto_servicos = " e ".join(servicos)
        partes.append(f"realizado {texto_servicos}")
    
    return ", ".join(partes) if partes else "reparo realizado"

def ler_e_filtrar_planilha():
    print(f"Lendo planilha: {NOME_PLANILHA}")
    try:
        from python_calamine import CalamineWorkbook
        wb = CalamineWorkbook.from_path(NOME_PLANILHA)
        dados = wb.get_sheet_by_name('REPAROS').to_python()
    except Exception as e:
        print(f"Erro ao ler a planilha: {e}")
        return []

    data_hoje = datetime.now().strftime("%d/%m/%Y")
    print(f"Data de hoje identificada: {data_hoje}")
    
    if not dados:
        print("Planilha vazia.")
        return []
        
    headers = [str(x).strip().upper() for x in dados[0]]
    colunas_necessarias = ["DATA", "OS", "IMEI", "PEÇA UTILIZADA", "MODELO"]
    for col in colunas_necessarias:
        if col not in headers:
            print(f"Erro: Coluna '{col}' não encontrada na planilha.")
            return []
            
    idx_data = headers.index("DATA")
    idx_os = headers.index("OS")
    idx_imei = headers.index("IMEI")
    idx_peca = headers.index("PEÇA UTILIZADA")
    idx_modelo = headers.index("MODELO")

    # Primeiro, agrupar por IMEI para juntar linhas duplicadas (ex: 2 peças pro mesmo aparelho)
    imei_agrupado = {}  # {imei: {dados_base..., pecas: [peca1, peca2]}}
    
    for index, row in enumerate(dados[1:]):
        if len(row) <= max(idx_data, idx_os, idx_imei, idx_peca, idx_modelo):
            continue
            
        val_data = row[idx_data]
        if hasattr(val_data, 'strftime'):
            data_linha = val_data.strftime("%d/%m/%Y")
        else:
            data_linha = str(val_data).strip()
            if " " in data_linha:
                data_linha = data_linha.split(" ")[0]
            try:
                dt_obj = datetime.strptime(data_linha, "%Y-%m-%d")
                data_linha = dt_obj.strftime("%d/%m/%Y")
            except ValueError:
                pass
                
        if data_linha == data_hoje:
            imei = str(row[idx_imei]).strip()
            if imei.endswith('.0'): imei = imei[:-2]
                
            os_num = str(row[idx_os]).strip()
            if os_num.endswith('.0'): os_num = os_num[:-2]
            
            peca = row[idx_peca] if idx_peca < len(row) else None
            modelo_apsn = str(row[idx_modelo]).strip()
            
            if imei not in imei_agrupado:
                imei_agrupado[imei] = {
                    "linha": index + 2,
                    "data": data_linha,
                    "os": os_num,
                    "imei": imei,
                    "modelo": modelo_apsn,
                    "pecas": []
                }
            imei_agrupado[imei]["pecas"].append(peca)
    
    # Agora formatar o texto de reparo para cada IMEI (com todas as peças juntas)
    aparelhos_para_processar = []
    for imei, dados_ap in imei_agrupado.items():
        dados_ap["reparo_formatado"] = formatar_descricao_reparo(dados_ap["pecas"])
        aparelhos_para_processar.append(dados_ap)
            
    return aparelhos_para_processar

def clicar_imagem(nome_imagem, confianca=0.8, timeout=10, duplo_clique=False):
    """
    Procura uma imagem na tela e clica nela.
    Retorna True se achou e clicou, False se não achou.
    """
    caminho_imagem = os.path.join("imagens_botoes", nome_imagem)
    if not os.path.exists(caminho_imagem):
        print(f"Erro: Imagem {nome_imagem} não encontrada na pasta 'imagens_botoes'.")
        return False
        
    print(f"Procurando {nome_imagem} na tela...")
    tempo_inicio = time.time()
    
    while time.time() - tempo_inicio < timeout:
        try:
            posicao = pyautogui.locateCenterOnScreen(caminho_imagem, confidence=confianca)
            if posicao:
                if duplo_clique:
                    pyautogui.doubleClick(posicao)
                else:
                    pyautogui.click(posicao)
                print(f"Cliquei em {nome_imagem}!")
                return True
        except pyautogui.ImageNotFoundException:
            pass
        except Exception as e:
            try:
                posicao = pyautogui.locateCenterOnScreen(caminho_imagem, confidence=confianca)
                if posicao:
                    if duplo_clique:
                        pyautogui.doubleClick(posicao)
                    else:
                        pyautogui.click(posicao)
                    print(f"Cliquei em {nome_imagem}!")
                    return True
            except:
                pass
                
        time.sleep(0.5)
        
    print(f"Tempo esgotado: não encontrei {nome_imagem} na tela.")
    return False

def digitar_texto(texto):
    """
    Digita um texto usando o teclado simulado.
    """
    pyautogui.write(texto, interval=0.05)

def iniciar_robo():
    print("========================================")
    print("INICIANDO ROBO DE REPAROS")
    print("========================================\n")
    
    lista_aparelhos = ler_e_filtrar_planilha()
    
    if not lista_aparelhos:
        print("Nenhum aparelho encontrado para a data de hoje ou ocorreu um erro.")
        return
        
    print(f"\nEncontrados {len(lista_aparelhos)} aparelhos para hoje!\n")
    
    for ap in lista_aparelhos:
        print(f"Linha {ap['linha']} | OS: {ap['os']} | IMEI: {ap['imei']} | MODELO (APSN): {ap['modelo']}")
        print(f"   Texto p/ SHOficina: '{ap['reparo_formatado']}'")
        print(f"   Ação Data Sys: Movimentar IMEI p/ Triagem")
        print("-" * 40)
        
    print("\nFase 1 completa. O robô conseguiu ler e processar os dados perfeitamente!")
def automacao_shoficina_busca_alternativa(aparelho):
    print(f"\n--- Iniciando Busca Alternativa SHOficina para IMEI {aparelho['imei']} ---")
    
    import pyautogui
    
    # Passo 1: Clicar no botão "Localizar OS"
    if not clicar_imagem("sh_btn_localizar_os.png", confianca=0.8):
        print("Botão 'Localizar OS' não encontrado. Abortando.")
        return
    time.sleep(3)
    
    # Passo 2: Fechar qualquer popup de erro que possa ter aparecido (aperta Enter/OK)
    pyautogui.press('enter')
    time.sleep(1)
    
    # Passo 3: Mudar o filtro "Situação" de "OS's abertas" para "Todas as situações"
    # Clicamos no combobox e selecionamos o primeiro item (Todas as situações)
    try:
        pos_combo = pyautogui.locateCenterOnScreen(
            os.path.join("imagens_botoes", "sh_combo_situacao.png"), confidence=0.6
        )
        if pos_combo:
            pyautogui.click(pos_combo)
            print("Cliquei no combobox Situação!")
        else:
            raise Exception("Imagem não encontrada")
    except Exception:
        print("Combobox Situação não encontrado por imagem. Abortando.")
        return
    time.sleep(0.5)
    
    # Selecionar "Todas as situações" (primeiro item da lista)
    pyautogui.press('home')
    time.sleep(0.2)
    pyautogui.press('enter')
    time.sleep(1)
    print("Filtro 'Todas as situações' selecionado!")
    
    # Passo 4: Clicar no botão "Clique para localizar por Aparelho"
    if not clicar_imagem("sh_btn_localizar_aparelho.png", confianca=0.8):
        print("Botão 'Localizar Aparelho' não encontrado. Abortando.")
        return
    time.sleep(3)
    
    # Passo 5: Na janela que abrir, selecionar o radio "IMEI" e colar o IMEI
    try:
        pos_radio = pyautogui.locateCenterOnScreen(
            os.path.join("imagens_botoes", "sh_radio_imei_cortado.png"), confidence=0.7
        )
        if pos_radio:
            # Clicar exatamente no radio "Imei"
            pyautogui.click(pos_radio)
            print("Radio IMEI selecionado!")
            time.sleep(0.5)
            
            # Clicar no campo de texto (fica logo abaixo dos radios)
            pyautogui.click(pos_radio.x, pos_radio.y + 50)
            time.sleep(0.3)
            
            # Colar o IMEI (Ctrl+V é mais seguro que digitar)
            import pyperclip
            pyperclip.copy(aparelho['imei'])
            pyautogui.hotkey('ctrl', 'v')
            print(f"IMEI {aparelho['imei']} colado!")
            
            # NÃO dar Enter! Esperar alguns segundos para o sistema processar
            time.sleep(4)
            
            # Passo 6: A linha azul aparece. Dar duplo clique nela.
            # A tabela fica cerca de 115 pixels abaixo dos radios
            pyautogui.moveTo(pos_radio.x, pos_radio.y + 115)
            pyautogui.doubleClick()
            print("Duplo clique na linha azul do aparelho!")
            time.sleep(3)
            
            # Passo 7: Agora aparece a lista de OSs do aparelho. 
            # Vamos usar o cabeçalho da tabela "OS Nº" como âncora 100% segura
            print("Aguardando janela com lista de OS aparecer...")
            tempo_inicio = time.time()
            pos_cabecalho = None
            
            # Loop de espera de até 10 segundos
            while time.time() - tempo_inicio < 10:
                try:
                    pos_cabecalho = pyautogui.locateCenterOnScreen(
                        os.path.join("imagens_botoes", "sh_cabecalho_os.png"), confidence=0.7
                    )
                    if pos_cabecalho:
                        break
                except:
                    pass
                time.sleep(0.5)
                
            if pos_cabecalho:
                # A primeira linha da OS fica logo abaixo do cabeçalho
                pyautogui.moveTo(pos_cabecalho.x, pos_cabecalho.y + 30)
                pyautogui.doubleClick()
                print("Duplo clique na OS da lista (usando cabeçalho)!")
            else:
                # Se não achar, tenta dar duplo clique um pouco abaixo de onde estava antes
                print("Cabeçalho não encontrado. Tentando duplo clique centralizado...")
                pyautogui.moveRel(0, 50)
                pyautogui.doubleClick()
            time.sleep(3)
            
            # Passo 8: Agora estamos na tela da OS aberta! Alterar a OS
            if clicar_imagem("sh_alterar_os.png", confianca=0.8):
                time.sleep(1)
                
                # Ir no campo defeito/reclamação e posicionar no FINAL do texto existente
                if clicar_imagem("sh_campo_descricao.png", confianca=0.8):
                    # Ir pro final do campo (End vai pro fim da linha atual)
                    pyautogui.hotkey('ctrl', 'end')  # Vai pro fim absoluto do campo
                    time.sleep(0.3)
                    
                    # Dar 2x Enter para criar nova linha abaixo do último histórico
                    pyautogui.press('enter')
                    pyautogui.press('enter')
                    time.sleep(0.3)
                    
                    # Agora digitar o reparo formatado
                    digitar_texto(aparelho['reparo_formatado'])
                    time.sleep(0.5)
                    
                    clicar_imagem("sh_botao_salvar.png", confianca=0.8)
                    print(f"OS alterada com sucesso para IMEI {aparelho['imei']}!")
        else:
            print("Radio IMEI não encontrado na tela.")
    except Exception as e:
        print(f"Erro na busca alternativa: {e}")

def automacao_shoficina(aparelho):
    print(f"\n--- Iniciando SHOficina para OS {aparelho['os']} ---")
    # 1. Clicar no campo de busca de OS
    if clicar_imagem("sh_campo_busca.png", confianca=0.8):
        digitar_texto(aparelho['os'])
        pyautogui.press('enter')
        time.sleep(2)
        
    # 2. Clicar em "Alterar O.S"
    if clicar_imagem("sh_alterar_os.png", confianca=0.8):
        time.sleep(1)
        # 3. Clicar no campo de descrição e ir até o FINAL
        if clicar_imagem("sh_campo_descricao.png", confianca=0.8):
            # Ir pro final do campo
            pyautogui.hotkey('ctrl', 'end')
            time.sleep(0.3)
            
            # Dar 2x Enter para criar nova linha abaixo do histórico
            pyautogui.press('enter')
            pyautogui.press('enter')
            time.sleep(0.3)
            
            # Digitar o reparo
            digitar_texto(aparelho['reparo_formatado'])
            time.sleep(0.5)
            # Salvar
            clicar_imagem("sh_botao_salvar.png", confianca=0.8)

def automacao_datasys_login():
    print("\n--- Abrindo 2 abas para o Data Sys ---")
    
    # Abre o navegador padrão diretamente na URL do Data Sys
    url = "https://commerce.datasys.online/Geral/AcessoDatasys.aspx"
    print(f"Abrindo URL: {url}")
    os.system(f'start "" "{url}"')
    
    # Pausa BEM LONGA (15s) para garantir que a página carregou E o usuário fez login/captcha
    print("Aguardando 15 segundos para carregar o Data Sys (e resolver captcha/login)...")
    time.sleep(15)
    
    # Clicar no centro da tela para garantir que o navegador está em foco
    print("Garantindo foco no navegador...")
    screen_width, screen_height = pyautogui.size()
    pyautogui.click(screen_width / 2, screen_height / 4)
    time.sleep(1)
    
    # Duplicar aba (Método universal: Copiar URL e abrir em nova aba)
    print("Duplicando a aba (Ctrl+L, Ctrl+C, Ctrl+T, Ctrl+V, Enter)...")
    pyautogui.hotkey('ctrl', 'l') # Seleciona a barra de endereço
    time.sleep(1)
    pyautogui.hotkey('ctrl', 'c') # Copia a URL
    time.sleep(1)
    pyautogui.hotkey('ctrl', 't') # Abre nova aba
    time.sleep(2)
    pyautogui.hotkey('ctrl', 'v') # Cola a URL
    time.sleep(1)
    pyautogui.press('enter')      # Acessa a página
    time.sleep(5)
    
    # Na aba 1 (atual), vamos deixá-la reservada para as Movimentações
    print("Aba 1 (atual) será usada para o Módulo Administrativo via URL direta.")
    time.sleep(1)
    
    # Voltar para a primeira aba (Aba 0) usando Ctrl+Shift+Tab
    print("Voltando para a aba inicial para abrir o Módulo Loja...")
    pyautogui.hotkey('ctrl', 'shift', 'tab')
    time.sleep(1)
    
    print("Acessando Módulo Loja na Aba 0...")
    clicar_imagem("ds_modulo_loja.png", confianca=0.8)
    time.sleep(5)

def buscar_dados_loja(imei):
    print(f"\nBuscando dados no Módulo Loja para IMEI: {imei}")
    
    if not clicar_imagem("ds_icone_codigo_barras.png", confianca=0.8):
        return None
    time.sleep(1.5)
    
    if clicar_imagem("ds_campo_serial_loja.png", confianca=0.8):
        # Limpar o campo antes de digitar
        pyautogui.hotkey('ctrl', 'a')
        pyautogui.press('backspace')
        time.sleep(0.5)
        digitar_texto(imei)
        time.sleep(0.5)
        pyautogui.press('enter')
        time.sleep(3)
        
        # Verificar se está indisponível
        if clicar_imagem("ds_status_indisponivel.png", confianca=0.8, timeout=4):
            print(f"👎 IMEI {imei} consta como Serial Indisponível. Pulando.")
            return None
            
        # Verificar se está disponível
        if clicar_imagem("ds_status_disponivel.png", confianca=0.8, timeout=4):
            print(f"👍 IMEI {imei} está Disponível! Copiando APSN...")
            # Copiar tela inteira para pegar a APSN
            import pyperclip
            import re
            
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(0.5)
            pyautogui.hotkey('ctrl', 'c')
            time.sleep(0.5)
            pyautogui.click() # Clica em qualquer lugar para tirar a selecao
            
            texto = pyperclip.paste()
            apsns = re.findall(r'APSN\d+', texto.upper())
            
            if apsns:
                ultima_apsn = apsns[-1]
                print(f"Última APSN encontrada: {ultima_apsn}")
                return ultima_apsn
            else:
                print("Nenhuma APSN encontrada no histórico dessa tela.")
                return None
    return None

def automacao_datasys_movimentar(apsn, imeis_da_apsn):
    print(f"\n--- Movimentando APSN {apsn} - com {len(imeis_da_apsn)} aparelhos ---")
    
    # 1. Acessar a tela de Mudar Depósitos usando o Link Direto (ignora os menus)
    print("Acessando URL direta de Mudar Depósitos...")
    pyautogui.hotkey('ctrl', 'l')
    time.sleep(1)
    digitar_texto("https://commerce.datasys.online/View/Administrativo/MudarDepositos.aspx")
    pyautogui.press('enter')
    
    # Pausa para a tela carregar por completo
    time.sleep(6)
    
    # 2. Preencher "Referencia" com a APSN
    if clicar_imagem("ds_campo_referencia.png", confianca=0.8):
        pyautogui.hotkey('ctrl', 'a')
        pyautogui.press('backspace')
        digitar_texto(apsn)
        pyautogui.press('enter')
        time.sleep(2) # Espera carregar a descriçao
        
    # 3. Informar a quantidade de IMEIs
    if clicar_imagem("ds_campo_qtde.png", confianca=0.8):
        pyautogui.hotkey('ctrl', 'a')
        pyautogui.press('backspace')
        digitar_texto(str(len(imeis_da_apsn)))
        
    # 4. Selecionar depósito destino
    if clicar_imagem("ds_campo_destino.png", confianca=0.8):
        pyautogui.click() # O bug do 2 cliques
        time.sleep(0.5)
        digitar_texto("TRIAGEM")
        pyautogui.press('enter')
        
    # 5. Clicar em Adicionar Item
    clicar_imagem("ds_btn_adicionar.png", confianca=0.8)
    time.sleep(2)
    
    # 6. Informar Seriais (IMEIs)
    if clicar_imagem("ds_btn_informar_seriais.png", confianca=0.8):
        time.sleep(2)
        for imei in imeis_da_apsn:
            digitar_texto(imei)
            pyautogui.press('enter')
            time.sleep(0.5)
            
        # Salvar os seriais
        clicar_imagem("ds_btn_salvar_seriais.png", confianca=0.8)
        time.sleep(2)
        
    # 7. Salvar movimentação final
    clicar_imagem("ds_btn_salvar_movimentacao.png", confianca=0.8)
    time.sleep(3)
    print(f"Movimentação da APSN {apsn} concluída!")
        
def iniciar_robo():
    print("=" * 40)
    print("INICIANDO ROBO DE REPAROS")
    print("=" * 40)
    
    lista_aparelhos = ler_e_filtrar_planilha()
    
    if not lista_aparelhos:
        print("Nenhum aparelho encontrado para a data de hoje ou ocorreu um erro.")
        return
        
    print(f"\nEncontrados {len(lista_aparelhos)} aparelhos para processar:")
    for ap in lista_aparelhos:
        print(f" - IMEI: {ap['imei']} | APSN Planilha: {ap['modelo']} | OS: {ap['os']}")
        print("-" * 40)
        
    print("\nFase 1 completa. O robô conseguiu ler e processar os dados perfeitamente!")
    
    print("\n>>> 1. Iniciando automação do SHOficina...")
    for ap in lista_aparelhos:
        os_limpa = str(ap['os']).strip().upper()
        if not os_limpa or os_limpa in ['N/D', '#N/D', 'NAN', 'NONE']:
            print(f"OS está vazia ou N/D para o IMEI {ap['imei']}. Usando busca alternativa...")
            automacao_shoficina_busca_alternativa(ap)
        else:
            automacao_shoficina(ap)
        
    print("\n>>> 2. Iniciando automação do Data Sys...")
    automacao_datasys_login()
    
    # Fase de Busca no Módulo Loja
    print("\n>>> Buscando as APSNs reais no Módulo Loja (Aba 0)...")
    aparelhos_validados = []
    
    for ap in lista_aparelhos:
        apsn_real = buscar_dados_loja(ap['imei'])
        if apsn_real:
            ap['apsn_real'] = apsn_real
            aparelhos_validados.append(ap)
            
    # Ir para Aba 1 (Módulo Administrativo)
    print("\n>>> Indo para o Módulo Administrativo (Aba 1) para movimentar...")
    pyautogui.hotkey('ctrl', 'tab')
    time.sleep(2)
    
    # Agrupar por APSN REAL
    grupos_apsn_real = {}
    for ap in aparelhos_validados:
        apsn = ap['apsn_real']
        if apsn not in grupos_apsn_real:
            grupos_apsn_real[apsn] = []
        grupos_apsn_real[apsn].append(ap['imei'])
        
    for apsn, imeis in grupos_apsn_real.items():
        automacao_datasys_movimentar(apsn, imeis)
        
    print("\nPROCESSO 100% CONCLUÍDO!")

if __name__ == "__main__":
    # Pausa de segurança: se o mouse for levado rapidamente para um dos cantos da tela, o robô para
    pyautogui.FAILSAFE = True
    iniciar_robo()
