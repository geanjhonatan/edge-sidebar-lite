# Edge Sidebar Lite

**Uma barra lateral independente para Windows, inspirada na antiga Sidebar do Microsoft Edge.**

*An independent desktop sidebar for Windows, inspired by the classic Microsoft Edge Sidebar.*

![Versão](https://img.shields.io/badge/vers%C3%A3o-0.2.0-4f8cff)
![Plataforma](https://img.shields.io/badge/plataforma-Windows%2010-0078D6)
![Electron](https://img.shields.io/badge/feito%20com-Electron-47848F)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)

O **Edge Sidebar Lite** permite acessar sites e ferramentas em um painel lateral sem depender do Microsoft Edge. Você pode deixá-lo flutuando, fixá-lo à esquerda ou à direita ou **reservar espaço na área de trabalho**, para que as janelas maximizadas do Windows respeitem a faixa da Sidebar.

> **Projeto independente e não oficial.** Não é desenvolvido, mantido ou endossado pela Microsoft.

## ✨ Funcionalidades

- 📌 **Barra fixada ou flutuante:** escolha entre encaixar na borda da tela e mover como uma janela independente.
- 🖥️ **Espaço próprio no desktop:** integração experimental com a API AppBar do Windows, evitando sobreposição a janelas maximizadas.
- ↔️ **Esquerda ou direita:** alterne o lado da barra e ajuste a largura do painel.
- ➕ **Sites ilimitados:** adicione, edite, remova e reorganize seus atalhos.
- 🌐 **Navegação incorporada:** abra sites no painel, com botões de voltar, avançar e recarregar.
- 🎨 **Personalização:** opções de aparência, cores, opacidade e comportamento.
- 🖼️ **Favicons automáticos:** aproveita os ícones dos sites para identificar seus atalhos.
- 🔐 **Sessões persistentes por site:** sites podem manter seus próprios dados locais de navegação entre execuções.
- 🧠 **Uso de memória controlado:** limita a quantidade de visualizações web mantidas simultaneamente.
- 🗂️ **Ícone na bandeja:** o aplicativo pode ser ocultado e reaberto pela área de notificação.

## 📸 Capturas de tela

As capturas do aplicativo serão adicionadas em uma próxima atualização.

## 💻 Requisitos

- **Windows 10 x64** (ambiente principal de desenvolvimento e testes).
- **Node.js e npm** instalados para executar o projeto a partir do código-fonte.
- Dependências do projeto instaladas com `npm install`.

O funcionamento no Windows 11 ainda precisa de validação específica. A reserva nativa de espaço na tela depende da integração do Windows via `koffi`; caso ela esteja indisponível, o aplicativo pode continuar no modo sem reserva de espaço.

## 🚀 Como executar

No **PowerShell**, execute:

```powershell
git clone https://github.com/geanjhonatan/edge-sidebar-lite.git
cd edge-sidebar-lite
npm install
npm start
```

O aplicativo será iniciado em modo de desenvolvimento. **Ainda não há instalador público verificado** nesta versão.

### Testes e verificações

```powershell
npm run check
npm test
```

Para tentar gerar um instalador Windows pelo `electron-builder`:

```powershell
npm run dist:win
```

> O processo de empacotamento está configurado no projeto, mas o instalador gerado ainda deve ser testado e auditado antes de distribuição pública.

## ⚙️ Como usar

1. Abra a Sidebar e clique no botão **+** para adicionar um endereço HTTPS.
2. Selecione um atalho para abrir o site no painel lateral.
3. Use **Voltar**, **Avançar** e **Recarregar** para navegar entre páginas.
4. Abra **Configurações** para mudar lado, largura, aparência e comportamento.
5. Para que a barra ocupe um espaço próprio no Windows, ative **Fixar na borda do monitor** e **Reservar espaço no Windows ao fixar a barra**.

Alguns sites podem limitar recursos de autenticação, mídia ou navegação em navegadores incorporados. O comportamento pode variar conforme o site.

## 🏗️ Estrutura do projeto

```text
edge-sidebar-lite/
├── src/
│   ├── main.js             # Processo principal do Electron
│   ├── preload.js          # Ponte IPC controlada
│   ├── windows-appbar.js   # Integração AppBar com o Windows
│   └── renderer/
│       ├── index.html      # Interface
│       ├── styles.css      # Estilos
│       └── app.js          # Controles e estado da interface
├── test/
│   ├── appbar.test.js      # Testes da integração AppBar
│   └── layout.test.js      # Testes de layout
└── package.json
```

**Tecnologias:** Electron, Node.js, JavaScript, HTML, CSS e integração nativa ao Windows usando `koffi`.

## 🔒 Privacidade e segurança

Este projeto é desenvolvido no contexto de **Security Research & App Hardening**, com foco em testes de robustez em ambientes controlados.

- Cookies, sessões e preferências são armazenados **localmente pelo Electron**, no diretório de dados do usuário do aplicativo; não fazem parte do repositório de código-fonte.
- Cada site usa uma partição de sessão persistente própria.
- A interface utiliza mecanismos de isolamento do Electron e restrições para conteúdo web incorporado.
- **Atenção:** a versão atual utiliza Electron `30.5.1`, que precisa ser atualizado, junto com outras dependências, antes de recomendar o aplicativo para uso com contas sensíveis ou distribuição pública.
- Nenhum navegador incorporado elimina os riscos dos próprios sites. Utilize somente páginas em que você confia.

**Não envie** pastas de perfis, bancos de cookies, arquivos `.env`, senhas ou tokens em Issues e Pull Requests. Se identificar uma possível vulnerabilidade, evite publicar dados exploráveis ou credenciais reais.

## 🛣️ Próximos passos

- [ ] Atualizar Electron e revisar alertas de dependências.
- [ ] Criar instalador `.exe` validado para Windows.
- [ ] Adicionar opção nativa de **iniciar com o Windows**.
- [ ] Ampliar testes de resolução, escala DPI e múltiplos monitores.
- [ ] Melhorar acessibilidade, estabilidade e documentação.
- [ ] Adicionar capturas de tela e uma página de Releases.

## 🤝 Contribuições

Sugestões, relatos de bugs e contribuições são bem-vindos! Abra uma [Issue](https://github.com/geanjhonatan/edge-sidebar-lite/issues) com o problema encontrado, os passos para reproduzi-lo e a versão do Windows.

## 📄 Licença

O repositório **ainda não possui uma licença de código aberto definida**. Uma licença será escolhida antes de uma versão de distribuição pública. Até lá, a disponibilização do código no GitHub não concede automaticamente permissão para redistribuição ou modificação.

---

**Desenvolvido por [geanjhonatan](https://github.com/geanjhonatan).** ⭐ Se o projeto for útil, considere deixar uma estrela no repositório.
