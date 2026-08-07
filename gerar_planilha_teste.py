import pandas as pd
from datetime import datetime

def gerar_planilha():
    hoje = datetime.now().strftime("%d/%m/%Y")
    ontem = "28/07/2026"
    
    dados = {
        "DATA": [ontem, hoje, hoje, hoje],
        "OS": ["1001", "1002", "1003", "1004"],
        "IMEI": ["111111111111111", "222222222222222", "333333333333333", "444444444444444"],
        "PEÇA UTILIZADA": ["BATERIA", "BATERIA", "FRONTAL, TAMPA", "TAMPA"],
        "MODELO": ["APSN1234", "APSN5678", "APSN5678", "APSN9999"]
    }
    
    df = pd.DataFrame(dados)
    nome_arquivo = "PLANILHA DE REPARO LUIZ.xlsx"
    df.to_excel(nome_arquivo, index=False)
    print(f"Arquivo de teste '{nome_arquivo}' criado com sucesso para o dia {hoje}.")

if __name__ == "__main__":
    gerar_planilha()
