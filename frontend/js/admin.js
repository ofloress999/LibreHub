import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.data().role !== "admin") {
            alert("Acesso negado!");
            window.location.href = "dashboard.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa a tabela com os usuários que se cadastraram no site
    renderizarUsuarios();
    
    // Configura a busca em tempo real na aba de lista (opcional, mas ajuda muito)
    const buscaLista = document.getElementById('inputBuscaUserLista');
    if (buscaLista) {
        buscaLista.addEventListener('input', () => renderizarUsuarios(buscaLista.value));
    }
});

// --- FUNÇÕES DE NAVEGAÇÃO ---

function mudarAba(idAba) {
    // Esconde todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    // Remove active de todos os botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Ativa a aba correta
    document.getElementById(idAba).classList.add('active');
    
    // Se o evento vier de um clique, marca o botão como active
    if (event && event.currentTarget && event.currentTarget.classList.contains('tab-btn')) {
        event.currentTarget.classList.add('active');
    } else {
        // Caso a mudança seja via código, procura o botão correspondente
        const botoes = document.querySelectorAll('.tab-btn');
        if (idAba === 'tab-lista') botoes[0].classList.add('active');
        if (idAba === 'tab-cadastro') botoes[1].classList.add('active');
        if (idAba === 'tab-pesquisa') botoes[2].classList.add('active');
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function renderizarUsuarios(filtro = "") {
    const tabela = document.getElementById('listaUsuariosTabela');
    if (!tabela) return;

    // Pega os usuários que vieram do cadastro do site
    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    const livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];

    // Filtra se o admin estiver digitando na busca
    const usuariosFiltrados = usuarios.filter(u => 
        u.nome.toLowerCase().includes(filtro.toLowerCase()) || 
        u.cpf.includes(filtro)
    );

    if (usuariosFiltrados.length === 0) {
        tabela.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum usuário encontrado.</td></tr>`;
        return;
    }

    tabela.innerHTML = usuariosFiltrados.map(u => {
        // Verifica se este usuário específico tem algum livro alugado
        const livroAtivo = livros.find(l => l.usuarioAluguel === u.nome);
        const statusHTML = livroAtivo 
            ? `<span class="status-alugado">Com Livro</span>` 
            : `<span class="status-livre">Sem Pendências</span>`;

        return `
            <tr>
                <td><strong>${u.nome}</strong></td>
                <td>${u.cpf}</td>
                <td>${u.email}</td>
                <td>${statusHTML}</td>
                <td>
                    <button class="btn edit" onclick="verDetalhes('${u.cpf}')">Ver Ficha</button>
                    <button class="btn delete" onclick="excluirUsuario('${u.cpf}')">Remover</button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- BUSCA E DETALHES ---

function buscarDetalhesUsuario() {
    const termo = document.getElementById('inputBuscaUserAdmin').value.toLowerCase();
    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    
    // Tenta achar por CPF exato ou Nome parcial
    const user = usuarios.find(u => u.cpf === termo || u.nome.toLowerCase().includes(termo));

    if (user) {
        exibirFichaUsuario(user);
    } else {
        alert("Usuário não encontrado. Verifique o CPF ou Nome.");
    }
}

// Função chamada pelo botão "Ver Ficha" na tabela
// --- FUNÇÃO VER DETALHES (CORRIGIDA) ---
// --- FUNÇÃO VER DETALHES (CORRIGIDA) ---
function verDetalhes(cpf) {
    // Convertemos para String e removemos espaços para evitar erro de busca
    const cpfBusca = String(cpf).trim();
    
    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    const livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    
    // Busca exata: garantimos que ambos são strings antes de comparar
    const user = usuarios.find(u => String(u.cpf).trim() === cpfBusca);

    if (!user) {
        console.error("CPF buscado:", cpfBusca);
        console.log("Lista de usuários no banco:", usuarios);
        alert("Erro: Usuário não encontrado no banco de dados.");
        return;
    }

    // Preencher o Modal (mesmo código anterior)
    document.getElementById('fichaNome').innerText = user.nome;
    document.getElementById('fichaCPF').innerText = user.cpf;
    document.getElementById('fichaEmail').innerText = user.email;
    document.getElementById('fichaTel').innerText = user.telefone || "Não informado";
    document.getElementById('fichaGrupo').innerText = user.grupo || "Geral";

    // Lógica do Livro Atual
    const livroAtual = livros.find(l => l.usuarioAluguel === user.nome);
    const containerLivro = document.getElementById('fichaLivroConteudo');
    
    if (livroAtual) {
        containerLivro.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <p><strong>Livro:</strong> ${livroAtual.nome}</p>
                    <p><strong>Devolução:</strong> <span style="color:red">${livroAtual.dataDevolucao}</span></p>
                </div>
                <button class="btn delete" onclick="devolverLivroFicha(${livroAtual.id}, '${user.cpf}')">Devolver</button>
            </div>`;
    } else {
        containerLivro.innerHTML = "<p>Nenhum empréstimo ativo.</p>";
    }

    // Histórico
    const containerHist = document.getElementById('fichaHistoricoLista');
    containerHist.innerHTML = (user.historico && user.historico.length > 0) 
        ? user.historico.map(h => `<div class="history-item">✔️ ${h}</div>`).join('')
        : "<p>Sem histórico.</p>";

    document.getElementById('modalFichaUsuario').style.display = 'flex';
}

// --- FUNÇÃO EXCLUIR (CORRIGIDA) ---
function excluirUsuario(cpf) {
    const cpfExcluir = String(cpf).trim();
    
    if (!confirm(`Tem certeza que deseja excluir o usuário com CPF ${cpfExcluir}?`)) return;

    let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    
    // Filtramos removendo o CPF correspondente
    const novaLista = usuarios.filter(u => String(u.cpf).trim() !== cpfExcluir);

    if (usuarios.length === novaLista.length) {
        alert("Erro ao excluir: Usuário não localizado.");
        return;
    }

    localStorage.setItem('usuarios', JSON.stringify(novaLista));
    alert("Usuário removido com sucesso.");
    
    // Recarrega a tabela para refletir a mudança
    renderizarUsuarios();
}

function fecharModalFicha() {
    document.getElementById('modalFichaUsuario').style.display = 'none';
}

// Função para devolver o livro diretamente pela ficha
function devolverLivroFicha(livroId, cpfUsuario) {
    if (!confirm("Confirmar devolução deste livro?")) return;
    
    // Chama a função de devolução que já criamos
    devolverLivroAdmin(livroId);
    
    // Pequeno atraso para atualizar os dados no modal após a devolução
    setTimeout(() => {
        verDetalhes(cpfUsuario); // Recarrega a ficha atualizada
    }, 100);
}

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    const modal = document.getElementById('modalFichaUsuario');
    if (event.target == modal) {
        fecharModalFicha();
    }
}

function exibirFichaUsuario(user) {
    const livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    
    document.getElementById('painelDetalhesUsuario').style.display = 'block';
    
    // Preenche Dados
    document.getElementById('detNome').innerText = user.nome;
    document.getElementById('detCPF').innerText = user.cpf;
    document.getElementById('detEmail').innerText = user.email;
    document.getElementById('detGrupo').innerText = user.grupo || "Geral";

    // Livro Atual
    const livroAtual = livros.find(l => l.usuarioAluguel === user.nome);
    const containerAtivo = document.getElementById('aluguelAtivoContainer');
    
    if (livroAtual) {
        containerAtivo.innerHTML = `
            <div style="background: var(--bg-main); padding: 15px; border-radius: 8px;">
                <p><strong>Livro:</strong> ${livroAtual.nome}</p>
                <p><strong>Devolução:</strong> <span style="color: #e74c3c; font-weight:bold;">${livroAtual.dataDevolucao}</span></p>
                <button class="btn delete" style="margin-top:10px; width:100%" onclick="devolverLivroAdmin(${livroAtual.id})">Registrar Devolução</button>
            </div>
        `;
    } else {
        containerAtivo.innerHTML = "<p>Nenhum empréstimo ativo.</p>";
    }

    // Histórico
    const histContainer = document.getElementById('historicoContainer');
    if (user.historico && user.historico.length > 0) {
        histContainer.innerHTML = user.historico.map(h => `<div class="history-item">✔️ ${h}</div>`).join('');
    } else {
        histContainer.innerHTML = "<p>Este usuário ainda não devolveu livros.</p>";
    }
}

// --- UTILITÁRIOS ---

function carregarGruposNoSelect() {
    const select = document.getElementById('regGrupo');
    if (!select) return;
    const grupos = JSON.parse(localStorage.getItem('biblioteca_grupos')) || ["Aluno", "Professor", "Funcionário", "Externo"];
    
    select.innerHTML = grupos.map(g => {
        const nome = typeof g === 'string' ? g : g.nome;
        return `<option value="${nome}">${nome}</option>`;
    }).join('');
}

function excluirUsuario(cpf) {
    if (!confirm("Deseja realmente remover este usuário?")) return;
    let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    usuarios = usuarios.filter(u => u.cpf !== cpf);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    renderizarUsuarios();
}

function devolverLivroAdmin(id) {
    // Reutiliza a lógica de devolução que já discutimos antes
    let livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    
    const livro = livros.find(l => l.id === id);
    if (!livro) return;

    const user = usuarios.find(u => u.nome === livro.usuarioAluguel);
    if (user) {
        if (!user.historico) user.historico = [];
        user.historico.push(`${livro.nome} (Devolvido em ${new Date().toLocaleDateString()})`);
    }

    livro.status = "Disponível";
    livro.usuarioAluguel = null;
    livro.dataDevolucao = null;

    localStorage.setItem('biblioteca_livros', JSON.stringify(livros));
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    
    alert("Devolução concluída!");
    renderizarUsuarios();
    buscarDetalhesUsuario(); // Atualiza a ficha na tela
}