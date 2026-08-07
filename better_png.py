from PIL import Image, ImageFilter
import os

def smooth_cutout(filepath):
    if not os.path.exists(filepath): return
    
    img = Image.open(filepath).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    
    for item in datas:
        r, g, b, a = item
        
        # Se a imagem já foi processada antes e está transparente, ignoramos o cálculo
        if a == 0:
            new_data.append(item)
            continue
            
        # Distância Euclidiana da cor do pixel para o Branco puro (255, 255, 255)
        dist_to_white = ((255 - r)**2 + (255 - g)**2 + (255 - b)**2)**0.5
        
        # Pixels muito brancos (fundo e artefatos JPEG)
        if dist_to_white < 50:
            new_data.append((255, 255, 255, 0))
            
        # Pixels distantes do branco (a cor real do logo, vermelho vivo)
        elif dist_to_white > 120:
            new_data.append((r, g, b, 255))
            
        # Área de transição (bordas com antialiasing)
        else:
            # Transição suave de transparência de 0 a 255
            alpha = int(((dist_to_white - 50) / 70.0) * 255)
            
            # Forçamos a cor original, mas com alpha reduzido para mesclar suavemente no escuro
            new_data.append((r, g, b, alpha))
            
    img.putdata(new_data)
    
    # Aplica um leve desfoque gaussiano apenas no canal alpha para suavizar o "serrilhado" (jagged edges)
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=0.7))
    img = Image.merge("RGBA", (r, g, b, a))
    
    img.save(filepath, "PNG")
    print(f"Qualidade melhorada em: {filepath}")

smooth_cutout("Public/logo-full.png")
smooth_cutout("Public/logo-icon.png")
