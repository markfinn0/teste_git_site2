import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from 'axios';

// Configurações do GitHub
const GITHUB_TOKEN = process.env.REACT_APP_API_KEY; // Substitua pelo token correto
const REPO_OWNER = "markfinn0";
const REPO_NAME = "dados_teste";
const FILE_PATH = "data.json";
const BRANCH_BASE = "teste";

// URLs da API do GitHub
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const CONTENTS_URL = `${API_URL}/contents/${FILE_PATH}`;

const App = () => {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5;

  // Função para carregar os usuários atuais
  const fetchUsers = async () => {
    setLoading(true);
    setMessage("");

    try {
        const timestamp = new Date().getTime();

        // Primeira requisição: tenta obter o conteúdo diretamente
        const response = await fetch(`${CONTENTS_URL}?ref=${BRANCH_BASE}&t=${timestamp}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error("Erro ao carregar os usuários");
        }

        const data = await response.json();
        console.log("Resposta da API (1ª requisição):", data);

        let content;

        // Se houver conteúdo diretamente disponível, usa ele
        if (data.content) {
            const decodedContent = atob(data.content);
            console.log("Conteúdo decodificado:", decodedContent);

            // Compacta o JSON (remove espaços desnecessários)
            const compactJson = JSON.stringify(JSON.parse(decodedContent)).replace(/\s/g, "");
            console.log("Conteúdo compactado:", compactJson);

            content = JSON.parse(compactJson);
        } else if (data.git_url) {
            // Se não houver conteúdo direto, tenta buscar via git_url
            const gitResponse = await fetch(data.git_url, {
                headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
                cache: "no-store",
            });

            if (!gitResponse.ok) {
                throw new Error("Erro ao carregar o conteúdo do arquivo.");
            }

            const gitData = await gitResponse.json();
            console.log("Resposta da API (2ª requisição):", gitData);

            if (!gitData.content) {
                throw new Error("O conteúdo não está presente na resposta.");
            }

            const decodedGitContent = atob(gitData.content);

            // Compacta o JSON (remove espaços desnecessários)
            const compactGitJson = JSON.stringify(JSON.parse(decodedGitContent)).replace(/\s/g, "");
            console.log("Conteúdo compactado:", compactGitJson);

            content = JSON.parse(compactGitJson);
        } else {
            throw new Error("Nenhum conteúdo disponível na resposta.");
        }

        // Verifica se o conteúdo contém a lista de usuários
        if (content.users) {
            setUsers(content.users || []);
        } else {
            throw new Error("O conteúdo não contém a lista de usuários.");
        }
    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        setMessage(error.message || "Erro ao carregar os usuários.");
    } finally {
        setLoading(false);
    }
};
  // Função para inserir um novo usuário
  const insertUser = async () => {
    setLoading(true);
    setMessage("");
    setIsModalVisible(true);

    let success = false;
    let tempBranch = null;

    try {
      while (retryCount < MAX_RETRIES && !success) {
        try {
          const baseSHA = await getBranchSHA();
          tempBranch = await createBranch(baseSHA);
          const { content: fileContent, sha: fileSHA } = await getFileContent(tempBranch);

          const newUser = { id: fileContent.users.length + 1, username, status };
          fileContent.users.push(newUser);

          await updateFile(fileContent, fileSHA, tempBranch);

          await mergeBranch(tempBranch);

          await deleteBranch(tempBranch);

          success = true;
          setMessage("Usuário inserido com sucesso!");
          setUsername("");
          setStatus("");
          await fetchUsers();
        } catch (error) {
          if (tempBranch) {
            console.log(`Tentativa falhada, deletando a branch temporária ${tempBranch}`);
            await deleteBranch(tempBranch);
          }
          console.error(error);
          setMessage(`Erro ao inserir o usuário. Tentando novamente...`);
          setRetryCount(retryCount + 1);
        }
      }

      if (!success) {
        setMessage("Falha ao inserir o usuário após múltiplas tentativas.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Erro ao tentar inserir o usuário.");
    } finally {
      setLoading(false);
      setIsModalVisible(false);
    }
  };

  // Função para editar um usuário
  const editUser = async (userId, newUsername, newStatus) => {
    setLoading(true); // Ativa o estado de carregamento
    setMessage("Atualizando usuário..."); // Define a mensagem de carregamento
    setIsModalVisible(true); // Exibe o modal de carregamento

    try {
        // Obtém o SHA da branch base
        const baseSHA = await getBranchSHA();

        // Cria uma branch temporária
        const tempBranch = await createBranch(baseSHA);

        // Obtém o conteúdo do arquivo na branch temporária
        const { content: fileContent, sha: fileSHA } = await getFileContent(tempBranch);

        // Encontra o índice do usuário a ser editado
        const userIndex = fileContent.users.findIndex(user => user.id === userId);

        // Verifica se o usuário foi encontrado
        if (userIndex === -1) {
            throw new Error("Usuário não encontrado.");
        }

        // Atualiza os dados do usuário
        fileContent.users[userIndex] = {
            ...fileContent.users[userIndex], // Mantém os dados existentes
            username: newUsername, // Atualiza o nome de usuário
            status: newStatus, // Atualiza o status
        };

        // Atualiza o arquivo na branch temporária
        await updateFile(fileContent, fileSHA, tempBranch);

        // Faz o merge da branch temporária para a branch base
        await mergeBranch(tempBranch);

        // Exclui a branch temporária
        await deleteBranch(tempBranch);

        // Mensagem de sucesso
        setMessage("Usuário atualizado com sucesso!");

        // Limpa os campos de entrada
        setUsername("");
        setStatus("");

        // Recarrega a lista de usuários
        await fetchUsers();
    } catch (error) {
        console.error("Erro ao editar o usuário:", error);
        setMessage(error.message || "Erro ao editar o usuário.");
    } finally {
        // Desativa o estado de carregamento e fecha o modal
        setLoading(false);
        setIsModalVisible(false);
    }
};

  // Função para deletar um usuário
  const deleteUser = async (userId) => {
    setLoading(true);
    setMessage("Deletando usuário...");
    setIsModalVisible(true);

    try {
      const baseSHA = await getBranchSHA();
      const tempBranch = await createBranch(baseSHA);
      const { content: fileContent, sha: fileSHA } = await getFileContent(tempBranch);

      const newUserList = fileContent.users.filter(user => user.id !== userId);
      fileContent.users = newUserList;

      await updateFile(fileContent, fileSHA, tempBranch);
      await mergeBranch(tempBranch);
      await deleteBranch(tempBranch);

      setMessage("Usuário deletado com sucesso!");
      await fetchUsers();
    } catch (error) {
      console.error(error);
      setMessage("Erro ao deletar o usuário.");
    } finally {
      setLoading(false);
      setIsModalVisible(false);
    }
  };

  // Função para obter o SHA da branch base
  const getBranchSHA = async () => {
    const timestamp = new Date().getTime();
    const response = await fetch(`${API_URL}/commits/${BRANCH_BASE}?t=${timestamp}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Erro ao obter o SHA da branch base.");
    }

    const data = await response.json();
    return data.sha;
  };

  // Função para criar uma nova branch
  const createBranch = async (baseSHA) => {
    const branchName = `temp-branch-${Date.now()}`;
    const response = await fetch(`${API_URL}/git/refs?t=${new Date().getTime()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSHA,
      }),
    }, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Erro ao criar a branch temporária.");
    }
    return branchName;
  };

  // Função para obter o conteúdo do arquivo
  const getFileContent = async (branchName) => {
    setLoading(true); // Ativa o estado de carregamento
    setMessage(""); // Limpa mensagens anteriores

    try {
        const timestamp = new Date().getTime();

        // Primeira requisição: obtém o git_url
        const response = await fetch(`${CONTENTS_URL}?ref=${branchName}&t=${timestamp}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
            cache: "no-store",
        });

        console.log("Resposta da API (1ª requisição):", response); // Log da resposta

        // Verifica se a requisição foi bem-sucedida
        if (!response.ok) {
            const errorData = await response.json(); // Tenta obter detalhes do erro
            throw new Error(errorData.message || "Erro ao carregar o arquivo.");
        }

        const data = await response.json();
        console.log("Dados recebidos (1ª requisição):", data); // Log dos dados recebidos

        // Verifica se o git_url está presente
        if (!data.git_url) {
            throw new Error("O git_url não está presente na resposta.");
        }

        // Segunda requisição: busca o conteúdo usando o git_url
        const gitResponse = await fetch(data.git_url, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
            cache: "no-store",
        });

        console.log("Resposta da API (2ª requisição):", gitResponse); // Log da resposta

        // Verifica se a requisição foi bem-sucedida
        if (!gitResponse.ok) {
            const errorData = await gitResponse.json(); // Tenta obter detalhes do erro
            throw new Error(errorData.message || "Erro ao carregar o conteúdo do arquivo.");
        }

        const gitData = await gitResponse.json();
        console.log("Dados recebidos (2ª requisição):", gitData); // Log dos dados recebidos

        // Verifica se o conteúdo está presente
        if (!gitData.content) {
            throw new Error("O conteúdo não está presente na resposta.");
        }

        // Decodifica o conteúdo (se necessário)
        const decodedContent = atob(gitData.content); // Decodifica o conteúdo

        // Compacta o JSON (remove espaços desnecessários)
        const compactJson = JSON.stringify(JSON.parse(decodedContent)).replace(/\s/g, "");
        console.log("Conteúdo compactado:", compactJson); // Log do conteúdo compactado

        const content = JSON.parse(compactJson); // Converte para JSON

        // Verifica se o conteúdo tem a estrutura esperada
        if (!content) {
            throw new Error("O conteúdo decodificado não é um JSON válido.");
        }

        // Retorna o conteúdo e o SHA do arquivo
        return { content, sha: data.sha };
    } catch (error) {
        console.error("Erro ao carregar o conteúdo do arquivo:", error);
        setMessage(error.message || "Erro ao carregar o conteúdo do arquivo.");
        throw error; // Propaga o erro para ser tratado externamente
    } finally {
        setLoading(false); // Desativa o estado de carregamento
    }
};

  // Função para atualizar o arquivo
  const updateFile = async (newContent, fileSHA, branchName) => {
    try {
        const timestamp = new Date().getTime();

        // Compacta o JSON (remove espaços desnecessários)
        const compactJson = JSON.stringify(newContent).replace(/\s/g, "");

        // Faz a requisição para atualizar o arquivo
        const response = await fetch(CONTENTS_URL, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: "Atualizando dados dos usuários",
                content: btoa(compactJson), // Codifica o conteúdo compactado em Base64
                sha: fileSHA,
                branch: branchName,
            }),
            cache: "no-store",
        });

        console.log("Resposta da API (updateFile):", response); // Log da resposta

        // Verifica se a requisição foi bem-sucedida
        if (!response.ok) {
            const errorData = await response.json(); // Tenta obter detalhes do erro
            throw new Error(errorData.message || "Erro ao atualizar o arquivo.");
        }

        console.log("Arquivo atualizado com sucesso!");
    } catch (error) {
        console.error("Erro ao atualizar o arquivo:", error);
        throw error; // Propaga o erro para ser tratado externamente
    }
};
  // Função para fazer o merge da branch temporária
  const mergeBranch = async (branchName) => {
    const timestamp = new Date().getTime();
    const response = await fetch(`${API_URL}/merges?t=${timestamp}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base: BRANCH_BASE,
        head: branchName,
        commit_message: "Merge automático da branch temporária.",
      }),
    }, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Erro ao fazer o merge da branch.");
    }
  };

  // Função para deletar a branch temporária
  const deleteBranch = async (branchName) => {
    const timestamp = new Date().getTime();
    const response = await fetch(`${API_URL}/git/refs/heads/${branchName}?t=${timestamp}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Erro ao deletar a branch temporária.");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="container mt-5">
      <h2>Gerenciar Usuários</h2>

      {message && <div className={`alert ${loading ? "alert-info" : "alert-success"} mt-3`}>{message}</div>}

      <div className="card my-4">
        <div className="card-body">
          <h5>Adicionar Novo Usuário</h5>
          <div className="row">
            <div className="col-md-5">
              <input
                type="text"
                className="form-control"
                placeholder="Nome de Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="col-md-5">
              <input
                type="text"
                className="form-control"
                placeholder="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" onClick={insertUser} disabled={loading}>
                {loading ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <h5>Lista de Usuários</h5>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuário</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.username}</td>
              <td>{user.status}</td>
              <td>
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => editUser(user.id, prompt("Novo nome:", user.username), prompt("Novo status:", user.status))}
                >
                  Editar
                </button>
                <button
                  className="btn btn-danger btn-sm ml-2"
                  onClick={() => deleteUser(user.id)}
                >
                  Deletar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal de Loading */}
      {isModalVisible && (
        <div className="modal show" style={{ display: "block" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Carregando...</h5>
              </div>
              <div className="modal-body text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
                <p>{message || "Tentando adicionar o usuário..."}</p>
                {retryCount > 0 && <p>Tentativa {retryCount} de {MAX_RETRIES}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
