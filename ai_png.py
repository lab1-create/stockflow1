import os
import sys
from rembg import remove
from PIL import Image

def perfect_cutout(filepath):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return
    
    try:
        input_image = Image.open(filepath)
        # Using rembg to magically remove the background
        output_image = remove(input_image)
        output_image.save(filepath, "PNG")
        print(f"Fundo removido com perfeição via IA em: {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

perfect_cutout("Public/logo-full.png")
perfect_cutout("Public/logo-icon.png")
