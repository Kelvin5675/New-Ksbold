import requests
import base64
import os
import time

API_URL = "https://ksbold-evolution-api.onrender.com"
API_KEY = "ksbold-secreta-1234"
INSTANCE_NAME = "ksbold-loja"

def run():
    print("⏳ A preparar a ligacao ao servidor (O Render demora uns minutos a acordar na primeira vez...)")
    
    # 1. Tentar criar a instância
    create_url = f"{API_URL}/instance/create"
    headers = {"Content-Type": "application/json", "apikey": API_KEY}
    data = {"instanceName": INSTANCE_NAME, "qrcode": True}
    
    try:
        res = requests.post(create_url, headers=headers, json=data, timeout=30)
        # Se ja existir, a api normalmente devolve erro 403 ou algo similar mas não quebra tudo
    except requests.exceptions.Timeout:
        print("❌ O servidor do Render está a dormir. Reinicia este script em 2 minutos!")
        return
    except Exception as e:
        print("❌ Ocorreu um erro a conectar:", e)
        return

    # 2. Buscar o QR Code para exibir
    print("📲 A obter o QR Code da tua loja...")
    connect_url = f"{API_URL}/instance/connect/{INSTANCE_NAME}"
    res = requests.get(connect_url, headers=headers)
    
    if res.status_code == 200:
        resp_data = res.json()
        if 'base64' in resp_data:
            qr_b64 = resp_data['base64'].split(",")[1] if "," in resp_data['base64'] else resp_data['base64']
            img_data = base64.b64decode(qr_b64)
            # Guardar e abrir a imagem
            file_path = "C:\\Users\\user\\Desktop\\New Ksbold\\qrcode_whatsapp.png"
            with open(file_path, "wb") as f:
                f.write(img_data)
            print("✅ PRONTO! A abrir o teu QR Code. Lê com o WhatsApp (Dispositivos Conectados)!")
            os.startfile(file_path)
        elif 'state' in resp_data and resp_data['state'] == 'open':
            print("🎉 O teu WhatsApp JÁ ESTÁ CONECTADO E PRONTO!")
        else:
            print("❌ O QR não veio, resposta do servidor:", resp_data)
    else:
        print("❌ Erro ao buscar QR Code. Pode ser que a maquina ainda nao esteja 100% pronta. Tenta de novo num minuto!")

if __name__ == "__main__":
    run()
