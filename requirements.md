# Requisitos Sistema
Escrevendo em formato de rascunho para elaborar corretamente depois

1. O sistema deve ter cadastro de usuarios
2. O cadastro deve ter 3 tipos: Solicitante, Desenvolvedor, Suporte
3. O sistema deve ter Grupos
4. O grupo so pode ser criado pelo técnico suporte.
5. O cadastro de solicitante só pode ser realizado se o suporte disponibilizar um codigo do grupo. 
6. O técnico (dev ou suporte) acessa o sistema e não vê informações; Para ver deve estar em um grupo.
7. O suporte pode convidar para o grupo
8. O cadastro do grupo é apenas o seu nome
9. O sistema deve permitir o tecnico alternar entre seus grupos - Mudando assim todas as informações de tickets, etc.
10. O sistema deve permitir a criação de tickets
11. Deve haver um algoritmo para atribuição automatica de tickets aos devs
12. Deve ser possivel atribuir o ticket manualmente.
13. O solicitante cria tickets que são atribuidos automaticamente
14. O solicitante vê todos os seus tickets em um dashboard
15. O solicitante consegue solicitar urgencia no ticket, para alertar o desenvolvedor
16. O desenvolvedor vê painel dashboard com diversas informações de tickets
17. O desenvolvedor pode criar ticket
18. O desenvolver pode escolher atribuir a si um ticket que não esta atribuido a ninguem
19. Deve ser possivel deixar o ticket sem atribuição
20. Tickets sem atribuição devem aparecer para todos os devs, em uma página especifica para isso (tipo dashboard)
21. O desenvolver pode escolher visualizar apenas seus proprios tickets
22. O sistema deve permitir configurar as categorias que o desenvolvedor atende
23. O sistema deve ter categorias de desenvolvedor
24. O desenvolvedor pode marcar tickets concluidos
25. 


# Categorizando Requisitos

## Requisitos de Cadastro
RC01 - O sistema deve ter cadastro e login de usuario
RC02 - Os cadastros do sistema são dividos em 3 tipos: Suporte, desenvolvedor, solicitante
RC03 - O suporte se cadastra normalmente.
RC04 - O desenvolvedor se cadastra normalmente
RC05 - O Solicitante só pode efetuar seu cadastro com um codigo fornecido pelo suporte.
RC06 - O Solicitante tambem deve informar sua cidade no cadastro
RC07 - Os usuarios do sistema devem conseguir visualizar seus proprios perfis

## Requisitos de Permissões
RP01 - O sistema deve permitir o suporte criar grupos
RP02 - O sistema deve permitir o suporte convidar usuarios para o grupo
RP03 - Grupos servirão para distinguir informações do sistema
RP04 - Cada grupo possui seu proprio "organismo" - Ou seja, se o usuario acessa o sistema sem estar em um grupo, ele não vê nada, além de seu perfil e configurações pessoais.
RP05 - Usuarios do grupo, com exceção do solicitante, devem conseguir visualizar todos os integrantes do grupo
RP06 - O usuario desenvolvedor deve ser capaz de aceitar ou recusar convites de grupos
RP07 - Para os técnicos: Suporte e Desenvolvedor, o grupo deve permiti-los realizarem criações, exclusões e edições.
RP08 - Informações do grupo são extritamente restritas a apenas aquele grupo, ou seja, os grupos são distintos em informações.
RP09 - O cadastro do grupo tem apenas o campo Nome do grupo e Descrição
RP10 - Suporte e desenvolvedor podem participar de varios grupos diferentes
RP11 - O usuario deve conseguir alternar entre seus grupos, mudando assim as informações que ele vê.
RP12 - O usuario, com exceção do solicitante, deve conseguir sair de um grupo se quiser
RP13 - Apenas suporte pode apagar um grupo, depois de passar por varias mensagens de aviso.
RP14 - No grupo, o suporte deve conseguir criar Categorias do usuario Desenvolvedor. Para que seja possivel definir se aquele usuario faz parte de Desenvolvimento web, desktop, etc...
RP15 - O desenvolvedor deve conseguir escolher qual categoria ele pertence. O suporte deve conseguir atribuir tambem aos desenvolvedores
RP16 - O sistema deve fornecer um log de auditoria de cada movimentação realizada no grupo.


## Requisitos de Conteudo do sistema
RCS01 - O sistema deve permitir a criação de tickets
RCS02 - O sistema deve permitir a interação por mensagem entre os tecnicos do grupo - Chat geral
RCS03 - O sistema deve possuir um chat interno em cada ticket.
RCS04 - O sistema deve permitir a criação de serviços para automatizar criação de tickets
RCS05 - O sistema deve permitir que o solicitante envie um alerta de pedido de urgencia no ticket.
RCS06 - 
