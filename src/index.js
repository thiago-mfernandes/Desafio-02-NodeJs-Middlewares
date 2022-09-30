const express = require('express');
const cors = require('cors');

const { v4: uuidv4, validate } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors());

const users = [];

function checksExistsUserAccount(request, response, next) {
  //Esse middleware é responsável por receber o username do usuário pelo header
  const { username } = request.headers;
  //validar se existe ou não um usuário com o username passado.
  const user = users.find(user => user.username === username);
  //mensaagem de erro se o usuário nao existe
  if(!user) {
    return response.status(404).json({ error: 'User Not Found!'});
  }
  //Caso exista, o usuário deve ser repassado para o request
  request.user = user;
  //e a função next deve ser chamada.
  return next();
}

function checksCreateTodosUserAvailability(request, response, next) {
  //receba o objeto user (considere sempre que o objeto existe) da request
  const { user } = request;

  //se o usuario estiver no plano ilimitado, isto é, usuario.pro true --> pode prosseguir
  if(user.pro) {
    return next();
    //se o usuario NAO estiver no plano ilimitado, e tiver menos de 10 todos --> pode prosseguir 
  } else if(!user.pro && user.todos.length + 1 <= 10) {
    return next();
  }

  return response.status(403).json({error: "You have reached the free todos limit! Change to Pro Plan!"});

}

function checksTodoExists(request, response, next) {
  //o middleware **checksTodoExists** deve receber o `username` de dentro do header
  const { username } = request.headers;
  //e o `id` de um *todo* de dentro de `request.params`. 
  const { id: todoId } = request.params;
  //Você deve validar que o usuário exista
  const user = users.find(user => user.username === username);
  if(!user) {
    return response.status(404).json({ error: "User Not Found!" });
  }

  //validar que o `id` seja um uuid - validate eh uma funcao do pacote uuidV4
  if(!validate(todoId)) {
    return response.status(400).json({ error: "Todo ID is incorrect." });
  }

  //validar se esse `id` pertence a um *todo* do usuário informado.
  const userTodo = user.todos.find(todo => todo.id === todoId);
  if(!userTodo) {
    return response.status(404).json({ error: "Todo not exist." });
  }
  
  //apos tudo estar validado repasso o todo e o user
  request.todo = userTodo;
  request.user = user;

  return next();
  
}

function findUserById(request, response, next) {

  //estou validando o user apenas pelo id!
  
  const { id } = request.params;
  //Você deve validar que o usuário exista,
  const user = users.find(user => user.id === id);
  //caso o usuario nao exista, retornar 404 e mensagem de erro
  if(!user) {
    return response.status(404).json({ error: "User Not Found!" });
  }
  //repassar ele para request.user
  request.user = user;
  //e retornar a chamada da função next.
  return next();
}

app.post('/users', (request, response) => {
  const { name, username } = request.body;
  const usernameAlreadyExists = users.some((user) => user.username === username);
  if (usernameAlreadyExists) {
    return response.status(400).json({ error: 'Username already exists' });
  }

  const user = {
    id: uuidv4(),
    name,
    username,
    pro: false,
    todos: []
  };

  users.push(user);
  return response.status(201).json(user);
}); 

app.get('/users/:id', findUserById, (request, response) => {
  const { user } = request;
  return response.json(user);
}); 

app.patch('/users/:id/pro', findUserById, (request, response) => {
  const { user } = request;
  if (user.pro) {
    return response.status(400).json({ error: 'Pro plan is already activated.' });
  }
  user.pro = true;
  return response.json(user);
}); 

app.get('/todos', checksExistsUserAccount, (request, response) => {
  const { user } = request;
  return response.json(user.todos);
}); 

app.post('/todos', checksExistsUserAccount, checksCreateTodosUserAvailability, (request, response) => {
  const { title, deadline } = request.body;
  const { user } = request;

  const newTodo = {
    id: uuidv4(),
    title,
    deadline: new Date(deadline),
    done: false,
    created_at: new Date()
  };

  user.todos.push(newTodo);
  return response.status(201).json(newTodo);
}); 

app.put('/todos/:id', checksTodoExists, (request, response) => {
  const { title, deadline } = request.body;
  const { todo } = request;

  todo.title = title;
  todo.deadline = new Date(deadline);

  return response.json(todo);
});

app.patch('/todos/:id/done', checksTodoExists, (request, response) => {
  const { todo } = request;
  todo.done = true;
  return response.json(todo);
});

app.delete('/todos/:id', checksExistsUserAccount, checksTodoExists, (request, response) => {
  const { user, todo } = request;
  const todoIndex = user.todos.indexOf(todo);
  if (todoIndex === -1) {
    return response.status(404).json({ error: 'Todo not found' });
  }

  user.todos.splice(todoIndex, 1);
  return response.status(204).send();
});

module.exports = {
  app,
  users,
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  checksTodoExists,
  findUserById
};