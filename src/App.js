import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useState, useEffect } from 'react';

const GITHUB_TOKEN = ''; // Substitua pelo seu token do GitHub
const REPO_OWNER = 'markfinn0'; // Dono do repositório
const REPO_NAME = 'dados_teste'; // Nome do repositório
const FILE_PATH = 'data.json'; // Caminho para o arquivo no repositório

const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

const UserTable = () => {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [editUser, setEditUser] = useState(null); // Armazena o usuário que está sendo editado

  // Função para carregar usuários da API do GitHub
  const fetchUsers = async () => {
    try {
      const response = await fetch(API_URL, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar o arquivo do GitHub');
      }

      const data = await response.json();
      const fileContent = atob(data.content); // Decodifica o conteúdo base64
      const parsedData = JSON.parse(fileContent);
      setUsers(parsedData.users || []); // Assumindo que os dados estão na chave "users"
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  // Função para adicionar um novo usuário via API do GitHub
  const addUser = async () => {
    if (!username || !status) {
      alert('Por favor, preencha o nome de usuário e o status.');
      return;
    }

    const newUser = { username, status };

    try {
      const response = await fetch(API_URL, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar o arquivo do GitHub');
      }

      const data = await response.json();
      const fileContent = atob(data.content); // Decodifica o conteúdo base64
      const parsedData = JSON.parse(fileContent);

      // Adiciona o novo usuário
      const updatedData = {
        ...parsedData,
        users: [...parsedData.users, { ...newUser, id: parsedData.users.length + 1 }],
      };

      // Atualiza o arquivo no GitHub
      await updateFileOnGitHub(updatedData, data.sha);

      alert('Usuário adicionado com sucesso!');
      fetchUsers(); // Recarrega os usuários
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
    }
  };

  // Função para editar um usuário
  const editExistingUser = async () => {
    if (!editUser || !username || !status) {
      alert('Por favor, preencha o nome de usuário e o status.');
      return;
    }

    try {
      const response = await fetch(API_URL, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar o arquivo do GitHub');
      }

      const data = await response.json();
      const fileContent = atob(data.content); // Decodifica o conteúdo base64
      const parsedData = JSON.parse(fileContent);

      // Atualiza o usuário existente
      const updatedUsers = parsedData.users.map((user) =>
        user.id === editUser.id ? { ...user, username, status } : user
      );

      const updatedData = { ...parsedData, users: updatedUsers };

      // Atualiza o arquivo no GitHub
      await updateFileOnGitHub(updatedData, data.sha);

      alert('Usuário editado com sucesso!');
      fetchUsers(); // Recarrega os usuários
      setEditUser(null); // Reseta o formulário de edição
      setUsername('');
      setStatus('');
    } catch (error) {
      console.error('Erro ao editar usuário:', error);
    }
  };

  // Função para deletar um usuário via API do GitHub
  const deleteUser = async (userId) => {
    try {
      const response = await fetch(API_URL, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar o arquivo do GitHub');
      }

      const data = await response.json();
      const fileContent = atob(data.content); // Decodifica o conteúdo base64
      const parsedData = JSON.parse(fileContent);

      // Filtra o usuário a ser deletado
      const updatedUsers = parsedData.users.filter((user) => user.id !== userId);

      // Atualiza os dados no GitHub
      const updatedData = { ...parsedData, users: updatedUsers };
      await updateFileOnGitHub(updatedData, data.sha);

      alert('Usuário deletado com sucesso!');
      fetchUsers(); // Recarrega os usuários
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
    }
  };

  // Função para atualizar o arquivo no GitHub
  const updateFileOnGitHub = async (newContent, sha) => {
    try {
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: 'Atualizando dados dos usuários',
          content: btoa(JSON.stringify(newContent, null, 2)), // Codifica o conteúdo como base64
          sha: sha,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar arquivo no GitHub');
      }
    } catch (error) {
      console.error('Erro ao atualizar arquivo no GitHub:', error);
    }
  };

  // Carrega os usuários assim que o componente for montado
  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Lista de Usuários</h2>

      {users.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Nome de Usuário</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.status}</td>
                  <td>
                    <button
                      className="btn btn-warning btn-sm me-2"
                      onClick={() => {
                        setEditUser(user);
                        setUsername(user.username);
                        setStatus(user.status);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteUser(user.id)}
                    >
                      Deletar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="alert alert-info">Carregando usuários...</div>
      )}

      {/* Formulário para adicionar ou editar um usuário */}
      <div className="card mt-4">
        <div className="card-header">
          <h4>{editUser ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</h4>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="username">Nome de Usuário</label>
            <input
              id="username"
              className="form-control"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <input
              id="status"
              className="form-control"
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
          {editUser ? (
            <button className="btn btn-primary mt-2" onClick={editExistingUser}>
              Salvar Alterações
            </button>
          ) : (
            <button className="btn btn-primary mt-2" onClick={addUser}>
              Adicionar Usuário
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserTable;

