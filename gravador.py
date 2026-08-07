import pynput
import time
import os

eventos = []
inicio = time.time()
gravando = True

def mapear_tecla(k):
    # Mapeia os nomes do pynput para o pyautogui
    mapa = {
        'enter': 'enter', 'tab': 'tab', 'space': 'space', 'down': 'down', 'up': 'up', 
        'left': 'left', 'right': 'right', 'backspace': 'backspace', 'delete': 'delete',
        'ctrl_l': 'ctrl', 'ctrl_r': 'ctrl', 'shift': 'shift', 'shift_r': 'shift',
        'alt_l': 'alt', 'alt_gr': 'altright', 'esc': 'esc', 'home': 'home', 'end': 'end'
    }
    return mapa.get(k, k)

def on_click(x, y, button, pressed):
    if gravando and pressed:
        t = time.time() - inicio
        eventos.append(('click', t, x, y, button.name))

def on_press(key):
    global gravando
    if key == pynput.keyboard.Key.f12:
        gravando = False
        print("\n[GRAVAÇÃO FINALIZADA]")
        return False
        
    if gravando:
        t = time.time() - inicio
        try:
            k = key.char
        except AttributeError:
            k = key.name
            
        if k != 'f12':
            eventos.append(('press', t, k))

print("="*50)
print(" GRAVADOR DE MACRO INICIADO ".center(50, '='))
print("="*50)
print("1. Vá para a tela onde deseja começar.")
print("2. Faça todos os cliques e digite o que precisar.")
print("3. Quando terminar TUDO, pressione a tecla 'F12' para salvar.")
print("="*50)

mouse_listener = pynput.mouse.Listener(on_click=on_click)
keyboard_listener = pynput.keyboard.Listener(on_press=on_press)

mouse_listener.start()
keyboard_listener.start()

keyboard_listener.join()
mouse_listener.stop()

# Gerar código
codigo = [
    "import pyautogui",
    "import time",
    "",
    "print('=================================')",
    "print(' INICIANDO O ROBÔ EM 3 SEGUNDOS ')",
    "print(' NÃO MEXA O MOUSE NEM O TECLADO ')",
    "print('=================================')",
    "time.sleep(3)",
    ""
]

ultimo_t = 0
for ev in eventos:
    tipo = ev[0]
    t = ev[1]
    espera = t - ultimo_t
    if espera > 0.05: # Ignorar pausas muito pequenas menores que 50ms
        codigo.append(f"time.sleep({espera:.2f})")
    
    if tipo == 'click':
        x, y, button = ev[2], ev[3], ev[4]
        b = 'left' if button == 'left' else 'right'
        codigo.append(f"pyautogui.click(x={int(x)}, y={int(y)}, button='{b}')")
    elif tipo == 'press':
        k = mapear_tecla(ev[2])
        if k is not None:
            # Verifica se é uma letra normal ou tecla especial
            if len(k) == 1:
                codigo.append(f"pyautogui.write('{k}')")
            else:
                codigo.append(f"pyautogui.press('{k}')")
    
    ultimo_t = t

caminho_salvar = os.path.join(os.getcwd(), "meu_robo_gravado.py")
with open(caminho_salvar, "w", encoding='utf-8') as f:
    f.write("\n".join(codigo))

print(f"\n[SUCESSO] Código gerado e salvo em: {caminho_salvar}")
print("Para testar se o robô aprendeu, digite no terminal:")
print("python meu_robo_gravado.py")
