# Edge Sidebar Lite 0.2 — Espaço reservado no Windows (teste)

Agora o modo **Fixar na borda do monitor** pode registrar a própria janela do Electron como uma **Application Desktop Toolbar** do Windows (`SHAppBarMessage`). Isso faz com que o Windows trate a faixa lateral como área ocupada ao calcular a área disponível para janelas maximizadas.

## Instalação

1. Saia completamente da Sidebar pelo ícone na bandeja do Windows.
2. Faça um backup da pasta `C:\Users\geanr\edge-sidebar-lite`.
3. Extraia o ZIP de atualização nessa pasta, **mantendo a estrutura** `src/...` e substituindo os arquivos presentes.
4. Abra um PowerShell na pasta e execute:

```powershell
cd C:\Users\geanr\edge-sidebar-lite
npm install
npm run check
npm test
npm start
```

`npm install` é necessário **nesta versão** para obter a dependência opcional `koffi` (ligação com a API Win32) e atualizar o lockfile local. Não execute `npm audit fix --force` para evitar alterar várias dependências de uma vez. Verifique as dependências ao distribuir o aplicativo.

## Ativação

1. Nas Configurações, marque **Fixar na borda do monitor (altura total)**.
2. Marque **Reservar espaço no Windows ao fixar a barra**.
3. Escolha esquerda ou direita e salve.
4. Maximize uma outra janela para observar a área reservada. Janelas que já estavam dimensionadas manualmente podem precisar de um novo ajuste — a Sidebar não move todas as janelas existentes à força.

O modo **Janela independente** continua flutuante, sem reservar espaço. Recolher a barra mantém uma faixa de 60 px; ocultá-la na bandeja ou sair libera a reserva. A mudança de lado, o tamanho da faixa e o fechamento devem atualizar a área útil automaticamente.

## Se o Windows não reservar a faixa

Verifique primeiro `npm ls koffi`. Se o pacote não estiver instalado, execute `npm install` outra vez. Passe o mouse sobre o botão de fixar ou abra as configurações: o aplicativo apresenta um aviso em caso de falha de integração. Se estiver com comportamento estranho, **desmarque Reservar espaço no Windows**, salve e reinicie a Sidebar. Isso restaura o funcionamento anterior sem afetar sites e logins. Não altere o Registro do Windows nem a configuração da barra de tarefas para contornar falhas.

## Segurança e limites de validação

Desenvolvido no contexto de **Security Research & App Hardening**, para testes locais controlados. Nenhum arquivo do Edge ou de outros programas é alterado. A integração usa o HWND da própria janela e os métodos públicos `ABM_NEW`, `ABM_QUERYPOS`, `ABM_SETPOS` e `ABM_REMOVE` do Windows. Em caso de falha, o aplicativo continua como janela comum.

**Validação realizada:** checagem de sintaxe, testes automatizados de navegação/posicionamento e simulação da ponte Win32 (incluindo liberar a reserva e ausência da dependência). **Validação ainda necessária:** uso gráfico real no Windows 10, diferentes configurações de DPI, múltiplos monitores e barra de tarefas movida de posição. Por isso este recurso é considerado experimental.
