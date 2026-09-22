# Migração para múltiplas cidades

Esta versão cria automaticamente no Firestore a coleção `cidades` com os 22 municípios do Acre quando um administrador abre o painel.

## Antes de usar
1. Entre como Admin.
2. Em Professores, defina a cidade de cada professor.
3. Em Turmas, novas turmas já exigem cidade. Para turmas antigas, recrie/ajuste os documentos antigos no Firestore adicionando `cidadeId` e `cidadeNome`.
4. Em Alunos, o Admin pode alterar cidade e turma. Professor só recebe alunos/turmas da sua cidade no painel.

## Campos novos
- usuarios (professor/aluno): cidadeId, cidadeNome, turmaId
- turmas: cidadeId, cidadeNome, professorIds
- alunos: cidadeId, cidadeNome, turmaId

Observação de segurança: o filtro por cidade desta versão também está na aplicação. Antes de produção multi-cidade, restrinja as Firestore Rules para impedir leitura direta entre cidades.
