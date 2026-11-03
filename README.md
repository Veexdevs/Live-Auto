# 🎯 TikTok Live Auto Quiz (IA OpenRouter + Presentes Interativos)

Sistema completo de **Live Interativa de Quiz Automático para TikTok** com geração contínua de perguntas via **OpenRouter IA**, **Ranking Top 5 em tempo real** no canto da tela e **5 poderes ativados por presentes específicos**!

---

## ✨ Funcionalidades Principais

- 🤖 **Quiz 100% Automático com IA (OpenRouter)**: Gera perguntas inéditas, 4 alternativas embaralhadas (`A`, `B`, `C`, `D`) e dicas inteligentes em Português, com fila pré-carregada e banco local de contingência (zero travamentos na live!).
- 💬 **Pontuação pelo Chat da Live**: Quem comentar a alternativa certa (`A`, `B`, `C` ou `D`, ou o texto da resposta) ganha **+1 ponto** automaticamente, com proteção opcional contra chute repetido na mesma rodada.
- 🏆 **Ranking Top 5 no Canto da Tela**: Placar atualizado ao vivo no canto superior direito da tela vertical (`9:16`), salvo automaticamente em disco.
- 🎁 **5 Poderes por Presentes Específicos** (100% configuráveis no painel):
  1. 🌹 **Rosa (`Rose`)** → **Eliminar Alternativa Errada**
  2. 🫰 **Coração (`Finger Heart`)** → **Pedir Dica**
  3. 🍩 **Rosquinha (`Doughnut`)** → **Ver Resposta na Tela**
  4. 👑 **Coroa (`Little Crown`)** → **Comprar +1 Ponto no Ranking**
  5. 🎉 **Confete (`Confetti`)** → **Gerar Outra Pergunta na Hora**
- 🎬 **Tela Limpa 9:16 para OBS / TikTok Live Studio (`/overlay`)**: Suporte a fundo neon animado ou fundo transparente (`?bg=transparent`) para sobrepor na sua webcam ou gameplay.
- 🧪 **Simulador Integrado**: Teste respostas, todos os 5 presentes e até uma plateia inteira de bots antes de abrir a live!

---

## 🚀 Como Rodar no seu PC (para conectar ao TikTok Real + OBS)

1. Copie `.env.example` para `.env` e coloque sua chave da OpenRouter:
   ```bash
   cp .env.example .env
   ```
2. Instale as dependências e inicie:
   ```bash
   npm install
   npm run dev
   ```
3. Abra o **Estúdio de Controle** em `http://localhost:3000`:
   - Digite seu `@usuario` do TikTok (quando já estiver ao vivo) e clique em **Conectar Live**.
4. No **OBS Studio** ou **TikTok Live Studio**:
   - Adicione uma fonte **Navegador (Browser Source)**
   - URL: `http://localhost:3000/overlay`
   - Largura: `1080` | Altura: `1920`
   - Para fundo transparente sobre câmera/jogo: `http://localhost:3000/overlay?bg=transparent`
