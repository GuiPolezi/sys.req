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
