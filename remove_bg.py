from PIL import Image
import os

def remove_white_bg(filepath):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return
    
    img = Image.open(filepath).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # Check if the pixel is white (or very close to white)
        if item[0] > 230 and item[1] > 230 and item[2] > 230:
            # changing alpha to 0
            newData.append((255, 255, 255, 0))
        else:
            # slightly smooth edges if it's kinda whitish
            newData.append(item)
            
    img.putdata(newData)
    img.save(filepath, "PNG")
    print(f"Processed {filepath}")

remove_white_bg("Public/logo-full.png")
remove_white_bg("Public/logo-icon.png")
