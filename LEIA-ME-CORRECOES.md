# Edge Sidebar Lite — versão corrigida

Este arquivo contém os ajustes no projeto original enviado para correção.
Não contém `node_modules`, executável, dados de sessão, senhas, cookies ou o `config.json` do usuário.

## O que mudou

- **Janela independente** (modo padrão para instalações novas): flutuante, altura de 720 px ou menor conforme a tela, arrastável pela **pequena alça na parte superior da barra**. O último posicionamento é salvo.
- **Janela fixada**: opção `Fixar na borda do monitor (altura total)` nas configurações, botão `▣` na barra e item no menu da bandeja.
- A barra respeita os lados esquerdo/direito. O painel abre para dentro da tela. Redimensionar/recolher preserva a âncora do lado escolhido.
- Largura padrão de 420 px; valores antigos exagerados (por exemplo, 1736) são recuperados automaticamente. Limite atual: 780 px ou menos conforme o monitor. Campo numérico aceita passos de 1 px.
- O site é encaixado pelo tamanho **real** da janela. O `WebContentsView` não é recriado a cada ajuste de tamanho e não fica sobre as configurações.
- Corrigida a ativação das páginas que podia se atropelar enquanto os sites carregavam.
- Proteção contra segunda instância e validação da origem das mensagens IPC.
- Preservados os sites ilimitados, favicons, sessões isoladas e as configurações preexistentes.

## Como instalar no Windows

1. **Feche todas as instâncias antigas da Sidebar**, pelo ícone na bandeja (`Sair`) e `Ctrl+C` em terminais com `npm start`. Isso é importante para evitar duas janelas abertas ao mesmo tempo.
2. Faça uma cópia de segurança da pasta `C:\Users\geanr\edge-sidebar-lite\src`.
3. Extraia o ZIP corrigido sobre `C:\Users\geanr\edge-sidebar-lite`, **substituindo os arquivos de mesmo nome**. Não exclua a pasta `node_modules` original.
4. Abra o PowerShell:

```powershell
cd C:\Users\geanr\edge-sidebar-lite
npm run check
npm test
npm start
```

Se você extraiu em **uma pasta nova**, sem dependências instaladas, execute `npm install` antes de `npm start`.

## Controles

- Arraste a **alça pequena acima dos botões** para mover a janela independente.
- Clique no botão **▣** para alternar janela independente/fixada.
- **⇆** muda o lado (esquerda/direita).
- **⚙** abre as configurações; **+** adiciona sites.
- A largura pode ser alterada no campo ou pela borda estreita entre a barra e o site.

## Validação e limitações

Os comandos `npm run check` e `npm test` passaram no ambiente de desenvolvimento. Os testes usam objetos simulados do Electron para validar geometria, IPC, persistência, alternância dos lados e até 20 sites; **não são testes gráficos reais no Windows**. Verifique no Windows se os controles estão clicáveis e se os sites que você usa permitem a incorporação.

O projeto mantém o Electron **30.5.1**, conforme o original; recomenda-se planejar uma atualização de versão com testes de regressão antes de distribuir o executável. Não execute `npm audit fix --force` sem avaliar as dependências.

Contexto: **Security Research & App Hardening**, com testes controlados no aplicativo de propriedade do usuário.
