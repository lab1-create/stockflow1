import json
import time
import argparse
import sys
from pynput import mouse, keyboard

ACTIONS_FILE = 'acoes.json'
events = []
start_time = 0

# ===============================
# MODO GRAVAÇÃO
# ===============================

def on_press(key):
    global start_time
    try:
        k = key.char
        is_char = True
    except AttributeError:
        k = key.name
        is_char = False
    
    events.append({
        'type': 'keypress',
        'key': k,
        'is_char': is_char,
        'time': time.time() - start_time
    })

def on_release(key):
    global start_time
    try:
        k = key.char
        is_char = True
    except AttributeError:
        k = key.name
        is_char = False

    events.append({
        'type': 'keyrelease',
        'key': k,
        'is_char': is_char,
        'time': time.time() - start_time
    })

    # Aperte ESC para parar de gravar
    if key == keyboard.Key.esc:
        return False

def on_move(x, y):
    global start_time
    # Descomente a linha abaixo se quiser gravar os movimentos do mouse (pode gerar um arquivo gigante)
    # events.append({'type': 'mousemove', 'x': x, 'y': y, 'time': time.time() - start_time})
    pass

def on_click(x, y, button, pressed):
    global start_time
    events.append({
        'type': 'mouseclick',
        'x': x,
        'y': y,
        'button': button.name,
        'pressed': pressed,
        'time': time.time() - start_time
    })

def on_scroll(x, y, dx, dy):
    global start_time
    events.append({
        'type': 'mousescroll',
        'x': x,
        'y': y,
        'dx': dx,
        'dy': dy,
        'time': time.time() - start_time
    })

def gravar():
    global start_time
    print("========================================")
    print("🔴 INICIANDO GRAVAÇÃO EM 3 SEGUNDOS...")
    print("Faça as ações que deseja que o robô aprenda.")
    print("Para PARAR a gravação, aperte a tecla [ESC].")
    print("========================================")
    time.sleep(3)
    print("🔴 GRAVANDO AGORA!")
    
    start_time = time.time()
    
    keyboard_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
    mouse_listener = mouse.Listener(on_move=on_move, on_click=on_click, on_scroll=on_scroll)
    
    keyboard_listener.start()
    mouse_listener.start()
    
    keyboard_listener.join()
    mouse_listener.stop()
    
    # Salvar em JSON
    # Remove a última tecla pressionada se for o ESC (para não apertar ESC sozinho na repetição)
    acoes_limpas = [e for e in events if not (e['type'] in ('keypress', 'keyrelease') and e['key'] == 'esc')]

    with open(ACTIONS_FILE, 'w') as f:
        json.dump(acoes_limpas, f, indent=4)
        
    print(f"✅ Gravação concluída. {len(acoes_limpas)} ações foram salvas no arquivo {ACTIONS_FILE}.")

# ===============================
# MODO REPETIÇÃO
# ===============================

def get_key(k_str, is_char):
    if is_char:
        return k_str
    else:
        # Tenta achar a tecla especial em keyboard.Key
        try:
            return getattr(keyboard.Key, k_str)
        except AttributeError:
            return None

def get_button(btn_str):
    try:
        return getattr(mouse.Button, btn_str)
    except AttributeError:
        return mouse.Button.left

def repetir():
    try:
        with open(ACTIONS_FILE, 'r') as f:
            acoes = json.load(f)
    except FileNotFoundError:
        print("❌ Erro: Arquivo de gravação não encontrado. Grave uma ação primeiro.")
        return

    print("========================================")
    print("🟢 INICIANDO REPETIÇÃO EM 3 SEGUNDOS...")
    print("Tire as mãos do teclado e do mouse!")
    print("========================================")
    time.sleep(3)
    print("▶️ REPRODUZINDO...")

    keyboard_controller = keyboard.Controller()
    mouse_controller = mouse.Controller()

    start_time_exec = time.time()

    for acao in acoes:
        # Calcula o tempo que deve esperar até a próxima ação
        tempo_esperado = acao['time']
        tempo_decorrido = time.time() - start_time_exec
        if tempo_esperado > tempo_decorrido:
            time.sleep(tempo_esperado - tempo_decorrido)

        if acao['type'] == 'mousemove':
            mouse_controller.position = (acao['x'], acao['y'])
        
        elif acao['type'] == 'mouseclick':
            # Move para a posição exata antes de clicar, garantindo precisão
            mouse_controller.position = (acao['x'], acao['y'])
            btn = get_button(acao['button'])
            if acao['pressed']:
                mouse_controller.press(btn)
            else:
                mouse_controller.release(btn)
        
        elif acao['type'] == 'mousescroll':
            mouse_controller.position = (acao['x'], acao['y'])
            mouse_controller.scroll(acao['dx'], acao['dy'])
        
        elif acao['type'] == 'keypress':
            k = get_key(acao['key'], acao['is_char'])
            if k:
                keyboard_controller.press(k)
        
        elif acao['type'] == 'keyrelease':
            k = get_key(acao['key'], acao['is_char'])
            if k:
                keyboard_controller.release(k)

    print("✅ Repetição concluída!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Robô Macro Recorder")
    parser.add_argument("--gravar", action="store_true", help="Gravar ações do mouse e teclado")
    parser.add_argument("--repetir", action="store_true", help="Repetir ações gravadas")
    
    args = parser.parse_args()
    
    if args.gravar:
        gravar()
    elif args.repetir:
        repetir()
    else:
        print("Por favor, escolha --gravar ou --repetir")
