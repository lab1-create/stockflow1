from PIL import Image
import os

def make_transparent(filepath):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return
    
    img = Image.open(filepath).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        r, g, b, a = item
        
        # A imagem é vermelha no fundo branco.
        # No fundo branco, RGB são todos altos (~255).
        # No vermelho, Green e Blue são mais baixos.
        # O nível de 'brancura' pode ser medido pelo menor valor entre Green e Blue.
        # Se for branco, min(G,B) é ~255. Se for vermelho, min(G,B) é ~40.
        
        # Calcula o quão "não branco" o pixel é (de 0 a 1)
        # alpha = 1.0 (totalmente opaco/vermelho), alpha = 0.0 (totalmente transparente/branco)
        alpha_factor = (255 - min(g, b)) / 255.0
        
        if alpha_factor < 0.05:
            # É fundo branco
            newData.append((255, 255, 255, 0))
        else:
            # É a borda ou o logo. 
            # Reverte a cor para o vermelho puro recuperando o que foi misturado com branco
            new_a = int(alpha_factor * 255)
            
            # Recupera a cor original sem o branco
            try:
                new_r = int((r - 255 * (1 - alpha_factor)) / alpha_factor)
                new_g = int((g - 255 * (1 - alpha_factor)) / alpha_factor)
                new_b = int((b - 255 * (1 - alpha_factor)) / alpha_factor)
                
                # Limita entre 0 e 255
                new_r = max(0, min(255, new_r))
                new_g = max(0, min(255, new_g))
                new_b = max(0, min(255, new_b))
                
                newData.append((new_r, new_g, new_b, new_a))
            except ZeroDivisionError:
                newData.append((255, 255, 255, 0))
                
    img.putdata(newData)
    img.save(filepath, "PNG")
    print(f"Bordas perfeitamente corrigidas em: {filepath}")

make_transparent("Public/logo-full.png")
make_transparent("Public/logo-icon.png")
