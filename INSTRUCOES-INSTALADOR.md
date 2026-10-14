# Edge Sidebar Lite 0.3 — Instalador e links externos

## O que mudou

- Ao clicar em um link que abre nova janela/aba, o programa pergunta onde abrir: Sidebar, navegador padrão ou um navegador detectado no computador (Edge, Chrome, Vivaldi, Firefox, Brave, Opera). Também é possível copiar o link ou cancelar.
- Links HTTP/HTTPS apenas. Endereços perigosos como `javascript:`, `file:` e `data:` são recusados. A opção de abrir na própria Sidebar aceita apenas HTTPS.
- Nova opção **Iniciar com o Windows** nas configurações e na bandeja do sistema (somente aplicativo instalado, não `npm start`).
- Atualização prevista para Electron 44.7.1; testes visuais de compatibilidade ainda necessários.

## Como gerar o EXE no Windows

Recomendado: mantenha uma cópia da pasta antiga. **Feche a Sidebar completamente** antes da atualização.

```powershell
cd C:\Users\geanr\edge-sidebar-lite
npm install
npm run check
npm test
npm run dist:win
```

O instalador NSIS gerado fica na pasta `dist/` e não inclui suas sessões/cookies do perfil do usuário. Teste-o no Windows antes de distribuir.

## GitHub Actions

O arquivo `.github/workflows/windows-installer.yml` também constrói o instalador em `windows-latest`, e o disponibiliza na aba **Actions → Windows installer (test build) → Artifacts**. Como ainda não temos assinatura digital nem teste gráfico no Windows, ele **não cria uma Release pública automaticamente**.

## Limitações

- O mecanismo de escolha de navegador é para links que sites tentam abrir em nova aba/janela (`target=_blank`/`window.open`). Links de navegação normal dentro do site permanecem dentro do painel.
- Os navegadores instalados em caminhos não convencionais podem não ser detectados; ainda é possível selecionar o navegador padrão.
- A integração AppBar com o Windows deve ser testada depois da atualização do Electron.
- O `.exe` não está assinado digitalmente: o SmartScreen pode exibir avisos.
- As dependências exigem conexão com o registro npm; o ZIP não inclui `node_modules` nem um binário pronto.
