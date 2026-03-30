import os

css_content = """

/* ==========================================
   KSBOLD - ESTILOS COMPACTOS ETAPA 4 
   (DIETA EXTREMA E CONTROLES DE FORMULÁRIO)
=========================================== */

.step-4 .step-title {
  font-size: 20px;
  margin-bottom: 8px;
}

.step-4 .finalize-text {
  font-size: 11px;
  line-height: 1.4;
  margin-bottom: 12px;
  max-width: 90%;
  opacity: 0.8;
}

.step-4 .step-content {
  padding: 10px 15px 15px;
}

.btn-add-more {
  width: 100%;
  max-width: 320px;
  padding: 10px;
  border: 1.5px solid var(--accent-gold) !important;
  border-radius: 30px;
  background: transparent !important;
  color: var(--accent-gold) !important;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 15px;
  font-size: 13px;
  transition: all 0.3s ease;
  display: block;
}

.btn-add-more:hover {
  background: rgba(212, 184, 150, 0.1) !important;
  transform: translateY(-2px);
}

.contact-form-area {
  width: 100%;
  max-width: 320px;
  text-align: left;
  margin-top: 10px;
}

.contact-form-area p {
  font-size: 11px;
  color: #999;
  margin-bottom: 12px;
  border-left: 3px solid var(--accent-gold);
  padding-left: 10px;
  line-height: 1.4;
}

.form-group {
  margin-bottom: 10px;
}

.contact-form-area input {
  width: 100%;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}

.contact-form-area input:focus {
  border-color: var(--accent-gold);
  background: rgba(255, 255, 255, 0.05);
}

.btn-whatsapp {
  width: 100%;
  max-width: 320px;
  height: 50px;
  margin-top: 10px;
  background: linear-gradient(135deg, #10c200cb 0%, #008708cb 100%);
  color: #fff;
  border: none;
  font-weight: 700;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  box-shadow: 0 4px 15px rgba(16, 194, 0, 0.2);
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-whatsapp:active {
  transform: scale(0.98);
}
"""

with open(r"c:\Users\user\Desktop\New Ksbold\style.css", "a", encoding="utf-8") as f:
    f.write(css_content)

print("CSS appended successfully.")
