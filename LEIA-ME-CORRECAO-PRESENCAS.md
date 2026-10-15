# Correção de presença – 14/10/2026

## Erros encontrados
1. Professor usava data UTC (`new Date().toISOString().split('T')[0]`), mas aluno usava a data local. Depois de 19h no Acre, a data inicial do professor avançava um dia.
2. Aluno e professor utilizavam `addDoc`, criando IDs aleatórios, sem prevenção de duplicação para a mesma pessoa/data.
3. Professor buscava alunos apenas por `turma.tipo`, misturando turmas diferentes do mesmo tipo.
4. Consulta da lista de presentes não era em tempo real; relatório contava documentos duplicados.

## Alterações
- `America/Rio_Branco` em ambas as telas.
- Chamada do professor acompanha alterações via Firestore `onSnapshot`.
- Check-in e professor verificam registros legados no servidor antes de gravar e usam transação no documento `presencas/{alunoId}_{AAAA-MM-DD}`.
- Antes de cada chamada, professor consulta os registros atuais no servidor, sem salvar por engano caso falhe a leitura.
- Preserva a turma específica por `turmaId`; alunos legados sem ID ainda suportados.
- Dashboard e relatórios não contam mais duas vezes um mesmo aluno/dia.
- Admin vê um quadro de auditoria com registros repetidos em 14 e 15 (quando a data atual do Acre é 14), incluindo IDs. **Não apaga nem modifica registros antigos.**

## Instalação
Copie os arquivos do ZIP de correção para a raiz do projeto (preservando as pastas). Antes, faça backup dos arquivos que você alterou localmente. Execute `npm run build` e só publique se compilar. Use `git add .`, `git commit -m "Corrige sincronizacao e duplicidade de presencas"`, `git push origin main`.

## Importante
- A versão antiga do site poderá continuar acessível em abas abertas; peça a professores e alunos para atualizar/reabrir o site após o deploy.
- O uso de transações exige leitura e criação dos documentos nas regras existentes do Firestore; se as regras exigirem padrão de ID anterior, deverão ser revisadas.
- Se uma aula puder ter dois encontros no mesmo dia para o mesmo aluno, a chave precisa incluir também um identificador de sessão. A implementação atual usa **uma presença por aluno por dia**, conforme o problema reportado.
- Não apague registros antigos antes de analisar horários (`dataCriacao`), status e método. Um registro marcado em 15/10 pode ter sido lançado na noite local de 14/10.
- Na auditoria do Admin, múltiplos registros em datas consecutivas são apenas **suspeitos**. Não os exclua sem confirmar quando ocorreu a aula.
