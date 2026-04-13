import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, getDocs, deleteDoc, doc, getDoc, 
    query, where, updateDoc, addDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * --- 1. VARIÁVEIS GLOBAIS ---
 * Armazenam o estado local da aplicação para busca e controle de acesso.
 */
let todosOsLivros = [];
let tipoUsuario = String(localStorage.getItem('tipoUsuario') || "").replace(/["']/g, "").trim().toLowerCase();

/**
 * --- 2. AUTENTICAÇÃO E CONTROLE DE ACESSO ---
 * Monitora se o usuário está logado e define as permissões (Admin ou Usuário).
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const profileIcon = document.getElementById('profileBtn');
                if (userData.fotoUrl && profileIcon) profileIcon.src = userData.fotoUrl;

                const cargoNoBanco = userData.role || "usuario"; 
                localStorage.setItem('tipoUsuario', cargoNoBanco);
                tipoUsuario = cargoNoBanco.toLowerCase();

                configurarLayoutPorCargo();
                carregarDadosDoFirebase();
            }
        } catch (error) { console.error("Erro na autenticação:", error); }
    } else { 
        window.location.href = "../index.html"; 
    }
});

/**
 * --- 3. INICIALIZAÇÃO DA INTERFACE ---
 * Configura eventos após o carregamento do HTML.
 */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-cadastrar-livro');
    if (form) {
        form.addEventListener('submit', cadastrarOuAtualizarLivro);
    }
    setupFiltros();
    aplicarMascaraCPFAluguel();

    // Evento do botão de confirmação de empréstimo dentro do modal
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', salvarEmprestimoNoFirebase);
    }
});

/**
 * --- 4. UTILITÁRIOS DE MATRÍCULA ---
 * Gera IDs únicos (LIB-001) para cada exemplar físico do livro.
 */
async function gerarProximasMatriculas(quantidade) {
    const contadorRef = doc(db, "configuracoes", "contadores");
    try {
        const snap = await getDoc(contadorRef);
        let ultimoNumero = snap.exists() ? (Number(snap.data().ultimoIdLivro) || 0) : 0;

        let matriculas = [];
        for (let i = 1; i <= quantidade; i++) {
            const novoNumero = ultimoNumero + i;
            matriculas.push(`LIB-${String(novoNumero).padStart(3, '0')}`);
        }

        // Atualiza o contador global no Firebase
        await updateDoc(contadorRef, { ultimoIdLivro: ultimoNumero + quantidade });
        return matriculas;
    } catch (e) {
        console.error("Erro ao gerar IDs:", e);
        return [];
    }
}

/**
 * --- 5. CADASTRO E ATUALIZAÇÃO ---
 * Cria um novo livro ou adiciona exemplares a um livro já existente.
 */
async function cadastrarOuAtualizarLivro(e) {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const autor = document.getElementById('autor').value.trim();
    const quantidadeDigitada = parseInt(document.getElementById('quantidade').value) || 0;
    const sinopse = document.getElementById('sinopse').value.trim();

    try {
        // 1. Gera as matrículas/IDs
        const novasMatriculas = await gerarProximasMatriculas(quantidadeDigitada);
        const livrosRef = collection(db, "livros");
        const q = query(livrosRef, where("titulo", "==", titulo), where("autor", "==", autor));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const ref = doc(db, "livros", docSnap.id);
            const dados = docSnap.data();
            await updateDoc(ref, {
                quantidade: (Number(dados.quantidade) || 0) + quantidadeDigitada,
                quantidadeDisponivel: (Number(dados.quantidadeDisponivel) || 0) + quantidadeDigitada,
                exemplaresDisponiveis: [...(dados.exemplaresDisponiveis || []), ...novasMatriculas]
            });
        } else {
            const novoLivro = {
                titulo, autor, sinopse,
                quantidade: quantidadeDigitada,
                quantidadeDisponivel: quantidadeDigitada,
                quantidadeEmprestada: 0,
                exemplaresDisponiveis: novasMatriculas,
                alugueisAtivos: [],
                capa: "../img/default-book.png",
                dataCadastro: new Date().toISOString()
            };
            await addDoc(livrosRef, novoLivro);
        }

        // 2. MOSTRAR MODAL COM OS IDS GERADOS
        mostrarModalIdsGerados(titulo, novasMatriculas);

        e.target.reset();
        carregarDadosDoFirebase();
    } catch (error) {
        console.error("Erro no cadastro:", error);
        alert("Erro ao cadastrar livro.");
    }
}

/**
 * --- 6. RENDERIZAÇÃO E BUSCA ---
 * Busca os livros no Firebase e desenha na tabela (admin) ou nos cards (usuário).
 */
// --- 5. RENDERIZAÇÃO COM AUTO-CORREÇÃO ---
async function carregarDadosDoFirebase() {
    const corpoTabela = document.getElementById('tabelaLivrosCorpo'); 
    const containerCards = document.getElementById('container-cards-livros'); 
    const areaAdminCadastro = document.getElementById('area-admin-cadastro'); 
    const visaoAdminTabela = document.getElementById('visao-admin'); 

    const role = String(localStorage.getItem('tipoUsuario') || "").replace(/["']/g, "").trim().toLowerCase();
    const isAdmin = (role === 'admin');

    if (isAdmin) {
        if (containerCards) containerCards.style.display = 'none'; 
        if (visaoAdminTabela) visaoAdminTabela.style.display = 'block';
        if (areaAdminCadastro) areaAdminCadastro.style.display = 'block';
    } else {
        if (containerCards) containerCards.style.display = 'grid'; 
        if (visaoAdminTabela) visaoAdminTabela.style.display = 'none'; 
        if (areaAdminCadastro) areaAdminCadastro.style.display = 'none';
    }

    const snap = await getDocs(collection(db, "livros"));
    todosOsLivros = [];

    if (corpoTabela) corpoTabela.innerHTML = "";
    if (containerCards) containerCards.innerHTML = "";

    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const livro = { 
            id: docSnap.id, 
            ...data,
            quantidade: Number(data.quantidade || 0),
            quantidadeDisponivel: Number(data.quantidadeDisponivel || 0)
        };
        
        todosOsLivros.push(livro);

        if (isAdmin) {
            if (corpoTabela) renderizarLinhaTabela(livro);
        } else {
            if (containerCards) renderizarCardUsuario(livro);
        }
    });

    // --- ADICIONE ESTAS DUAS LINHAS AQUI (DEPOIS DO FOR-EACH) ---
    atualizarOpcoesFiltroGenero(); // Povoa o select com os gêneros reais
    filtrarLivros();              // Aplica filtros caso o usuário já tenha digitado algo
}

function renderizarLinhaTabela(l) {
    const corpo = document.getElementById('tabelaLivrosCorpo');
    if (!corpo) return;

    const disponiveis = l.quantidadeDisponivel;
    const isDisponivel = disponiveis > 0;

    const tr = document.createElement('tr');
    tr.setAttribute('data-id', l.id);
    tr.innerHTML = `
        <td><img src="${l.capa || '../img/default-book.png'}" style="width:40px;height:50px;object-fit:cover;border-radius:4px;"></td>
        <td><strong>${l.titulo}</strong></td>
        <td>${l.autor}</td>
        <td>
            <span style="color: ${isDisponivel ? '#10b981' : '#ef4444'}; font-weight: bold;">
                ${isDisponivel ? `Disponível (${disponiveis}/${l.quantidade})` : `Esgotado (0/${l.quantidade})`}
            </span>
        </td>
        <td>
            <button class="btn edit" onclick="window.abrirModalEmprestimo('${l.id}')" ${!isDisponivel ? 'disabled style="background:#ccc; cursor:not-allowed;"' : ''}>Alugar</button>
            <button class="btn" style="background:#2563eb; color:white;" onclick="window.verListaAlugueis('${l.id}')">Ver Aluguéis</button>
            <button class="btn delete" onclick="window.excluirLivro('${l.id}')">Excluir</button>
        </td>`;
    corpo.appendChild(tr);
}

function renderizarCardUsuario(l) {
    const container = document.getElementById('container-cards-livros');
    if (!container) return;

    const disponivel = Number(l.quantidadeDisponivel || 0) > 0;
    const card = document.createElement('div');
    card.className = 'book-card-v2';
    
    // LINHA ESSENCIAL PARA O FILTRO FUNCIONAR:
    card.setAttribute('data-id', l.id); 

    card.onclick = () => window.abrirDetalhesLivro(l.id);

    card.innerHTML = `
        <img src="${l.capa}" class="book-cover-v2">
        <div class="book-info">
            <h3>${l.titulo}</h3>
            <p>${l.autor}</p>
            <span class="${disponivel ? 'status-livre' : 'status-alugado'}">${disponivel ? 'Disponível' : 'Esgotado'}</span>
            <small>(${l.quantidadeDisponivel} un.)</small>
        </div>`;
    container.appendChild(card);
}

/**
 * --- 7. FILTROS ---
 * Filtra os livros por título, autor, gênero ou status.
 */
function setupFiltros() {
    document.getElementById('inputBusca')?.addEventListener('input', filtrarLivros);
    document.getElementById('filtroGenero')?.addEventListener('change', filtrarLivros);
    document.getElementById('filtroStatus')?.addEventListener('change', filtrarLivros);
}

function filtrarLivros() {
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const generoSel = document.getElementById('filtroGenero').value;
    const statusSel = document.getElementById('filtroStatus').value;

    todosOsLivros.forEach(l => {
        const tr = document.querySelector(`tr[data-id="${l.id}"]`);
        const card = document.querySelector(`.book-card-v2[data-id="${l.id}"]`);

        const matchesTexto = l.titulo.toLowerCase().includes(termo) || 
                             l.autor.toLowerCase().includes(termo);

        // Ajuste na lógica de gênero:
        const matchesGenero = generoSel === "Todos" || 
                             (l.generos && l.generos.includes(generoSel));

        const disponivel = Number(l.quantidadeDisponivel || 0) > 0;
        const matchesStatus = statusSel === "Todos" || 
                             (statusSel === "Disponível" ? disponivel : !disponivel);

        const exibir = matchesTexto && matchesGenero && matchesStatus;

        if (tr) tr.style.display = exibir ? "" : "none";
        if (card) card.style.display = exibir ? "flex" : "none";
    });
}

function atualizarOpcoesFiltroGenero() {
    const filtro = document.getElementById('filtroGenero');
    if (!filtro) return;
    
    const generosSet = new Set();
    todosOsLivros.forEach(livro => {
        if (Array.isArray(livro.generos)) {
            livro.generos.forEach(g => generosSet.add(g));
        }
    });

    // Limpa e repovoa o select
    filtro.innerHTML = '<option value="Todos">Todos os Gêneros</option>';
    
    // Transforma o Set em array e ordena alfabeticamente
    Array.from(generosSet).sort().forEach(g => {
        filtro.innerHTML += `<option value="${g}">${g}</option>`;
    });
}

/**
 * --- 9. DEVOLUÇÃO ---
 * Retorna o exemplar para a lista de disponíveis e recalcula o estoque.
 */
window.confirmarDevolucaoEspecifica = async (idLivro, carimbo) => {
    if (!confirm(`Devolver exemplar ${carimbo}?`)) return;

    try {
        const ref = doc(db, "livros", idLivro);
        const snap = await getDoc(ref);
        const dados = snap.data();

        // CORREÇÃO: Filtra usando 'carimbo', que é o nome no seu Firebase
        const novosAlugueis = (dados.alugueisAtivos || []).filter(a => a.carimbo !== carimbo);
        
        let listaDisp = [...(dados.exemplaresDisponiveis || [])];
        // Adiciona de volta à lista de disponíveis se não estiver lá
        if (!listaDisp.includes(carimbo)) {
            listaDisp.push(carimbo);
        }

        await updateDoc(ref, {
            alugueisAtivos: novosAlugueis,
            exemplaresDisponiveis: listaDisp,
            quantidadeDisponivel: listaDisp.length, // Atualiza a contagem real
            quantidadeEmprestada: novosAlugueis.length
        });

        alert("Devolução concluída!");
        
        // Fecha o modal de lista se ele estiver aberto
        const modalLista = document.getElementById('modalListaAlugueis');
        if (modalLista) modalLista.style.display = 'none';

        // ATUALIZAÇÃO CRÍTICA: Recarrega os dados para refletir na tela
        await carregarDadosDoFirebase();
    } catch (e) { 
        console.error("Erro ao devolver:", e);
        alert("Erro técnico ao processar devolução.");
    }
};

/**
 * --- 10. MODAIS E UTILITÁRIOS ---
 */
window.abrirModalEmprestimo = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    // --- 1. LIMPEZA DE ESTADO (Evita mostrar dados do aluno anterior) ---
    const inputBusca = document.getElementById('inputUsuarioBusca');
    const idUsuarioOculto = document.getElementById('idUsuarioAluguel');
    const infoNome = document.getElementById('info-nome');
    const infoEmail = document.getElementById('info-email');
    const detalhesArea = document.getElementById('detalhesUsuario');
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');

    if (inputBusca) inputBusca.value = "";
    if (idUsuarioOculto) idUsuarioOculto.value = "";
    if (infoNome) infoNome.innerText = "";
    if (infoEmail) infoEmail.innerText = "";
    if (detalhesArea) detalhesArea.style.display = 'none';
    if (btnConfirmar) btnConfirmar.disabled = true; // Só libera após achar novo CPF

    // --- 2. PREENCHIMENTO DOS DADOS DO LIVRO ---
    document.getElementById('idLivroModal').value = id;
    document.getElementById('nomeLivroModal').innerText = livro.titulo;

    const select = document.getElementById('selectIdExemplar');
    if (select) {
        select.innerHTML = '<option value="">Escolha o carimbo...</option>';
        
        if (livro.exemplaresDisponiveis && livro.exemplaresDisponiveis.length > 0) {
            livro.exemplaresDisponiveis.forEach(idEx => {
                const option = document.createElement('option');
                option.value = idEx;
                option.textContent = idEx;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">Nenhum exemplar disponível</option>';
        }
    }

    // --- 3. EXIBIÇÃO DO MODAL ---
    document.getElementById('modalEmprestimo').style.display = 'flex';
};

window.verListaAlugueis = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    const modal = document.getElementById('modalListaAlugueis');
    const container = document.getElementById('listaAlugueisCorpo');
    const inputBusca = document.getElementById('inputBuscaAluguelModal');

    // Função para gerar o HTML dos CARDS
    const renderizarCards = (alugueis) => {
        if (!alugueis || alugueis.length === 0) {
            return `<div style="text-align:center; padding:40px; color:#94a3b8;">
                        <p>Nenhum aluguel ativo encontrado.</p>
                    </div>`;
        }

        return alugueis.map(a => `
            <div class="card-aluguel" style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <span style="background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: bold; padding: 2px 8px; border-radius: 4px;">
                            ${a.carimbo || 'S/ID'}
                        </span>
                        <span style="color: #64748b; font-size: 12px;">
                            📅 ${a.dataEmprestimo ? new Date(a.dataEmprestimo).toLocaleDateString('pt-BR') : '--/--/--'}
                        </span>
                    </div>
                    <h4 style="margin: 0; color: #1e293b; font-size: 15px;">${a.usuarioNome || 'Usuário Desconhecido'}</h4>
                    <p style="margin: 3px 0 0 0; color: #64748b; font-size: 13px;">CPF: ${a.usuarioCpf || 'Não informado'}</p>
                </div>
                <button class="btn delete" style="padding: 8px 12px; font-size: 12px;" 
                    onclick="window.confirmarDevolucaoEspecifica('${livro.id}', '${a.carimbo}')">
                    Dar Baixa
                </button>
            </div>
        `).join('');
    };

    // Renderização inicial
    container.innerHTML = renderizarCards(livro.alugueisAtivos);

    // Lógica de Busca em Tempo Real
    inputBusca.value = ""; // Limpa busca anterior
    inputBusca.oninput = (e) => {
        const termo = e.target.value.toLowerCase();
        const filtrados = (livro.alugueisAtivos || []).filter(a => 
            (a.usuarioNome && a.usuarioNome.toLowerCase().includes(termo)) || 
            (a.carimbo && a.carimbo.toLowerCase().includes(termo)) ||
            (a.usuarioCpf && a.usuarioCpf.includes(termo))
        );
        container.innerHTML = renderizarCards(filtrados);
    };

    modal.style.display = 'flex';
};

window.fecharModalEmprestimo = () => document.getElementById('modalEmprestimo').style.display = 'none';
window.fecharModalEmprestimoInfo = () => document.getElementById('modalDetalhesEmprestimo').style.display = 'none';

function configurarLayoutPorCargo() {
    const isAdmin = tipoUsuario === 'admin';
    const btnAdd = document.getElementById('btn-admin-add');
    const areaTab = document.getElementById('area-admin-tabela');
    if (btnAdd) btnAdd.style.display = isAdmin ? 'block' : 'none';
    if (areaTab) areaTab.style.display = isAdmin ? 'block' : 'none';
}

function aplicarMascaraCPFAluguel() {
    const input = document.getElementById('inputUsuarioBusca');
    if (!input) return;
    input.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 11);
        if (v.length >= 10) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d)/, "$1.$2.$3-$4");
        else if (v.length >= 7) v = v.replace(/(\d{3})(\d{3})(\d)/, "$1.$2.$3");
        else if (v.length >= 4) v = v.replace(/(\d{3})(\d)/, "$1.$2");
        e.target.value = v;
        if (v.length === 14) buscarUsuarioPorCPF(v);
    });
}

async function buscarUsuarioPorCPF(cpf) {
    const detalhesDiv = document.getElementById('detalhesUsuario');
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');
    try {
        const q = query(collection(db, "usuarios"), where("cpf", "==", cpf));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const user = snap.docs[0].data();
            document.getElementById('info-nome').innerText = user.nome;
            document.getElementById('info-email').innerText = user.email;
            detalhesDiv.style.display = 'block';
            btnConfirmar.disabled = false;
        } else {
            alert("CPF não encontrado.");
            detalhesDiv.style.display = 'none';
            btnConfirmar.disabled = true;
        }
    } catch (e) { console.error(e); }
}

// ---- CONFIRMAR EMPRESTIMO ----

async function confirmarEmprestimo(e) {
    if(e) e.preventDefault();

    // 1. Captura os IDs dos elementos
    const idLivro = document.getElementById('idLivroModal').value;
    const carimboSelecionado = document.getElementById('selectIdExemplar').value;
    
    // 2. Captura os dados do usuário que estão visíveis no modal
    const nomeAluno = document.getElementById('info-nome').innerText;
    const emailAluno = document.getElementById('info-email').innerText;
    const cpfAluno = document.getElementById('inputUsuarioBusca').value;

    // Validação de segurança
    if (!carimboSelecionado || carimboSelecionado === "undefined" || !nomeAluno) {
        alert("Erro: Selecione um exemplar válido e certifique-se de que o aluno foi encontrado.");
        return;
    }

    try {
        const btn = document.getElementById('btnConfirmarEmprestimo');
        btn.disabled = true;
        btn.innerText = "Processando...";

        const livroRef = doc(db, "livros", idLivro);
        const snap = await getDoc(livroRef);
        const dados = snap.data();

        // 3. Monta o objeto do aluguel com os nomes de campos corretos
        const novoAluguel = {
            carimbo: carimboSelecionado,
            usuarioNome: nomeAluno,
            usuarioEmail: emailAluno,
            usuarioCpf: cpfAluno,
            dataEmprestimo: new Date().toISOString()
        };

        // 4. Atualiza as listas no banco de dados
        const novosDisponiveis = (dados.exemplaresDisponiveis || []).filter(c => c !== carimboSelecionado);
        const novosAlugueis = [...(dados.alugueisAtivos || []), novoAluguel];

        await updateDoc(livroRef, {
            quantidadeDisponivel: novosDisponiveis.length,
            quantidadeEmprestada: (Number(dados.quantidadeEmprestada) || 0) + 1,
            exemplaresDisponiveis: novosDisponiveis,
            alugueisAtivos: novosAlugueis
        });

        alert("Aluguel registrado com sucesso!");
        window.fecharModalEmprestimo(); // Fecha o modal
        carregarDadosDoFirebase();     // Atualiza a tabela ao fundo
        atualizarOpcoesFiltroGenero();    // Depois reconstrói o select de gêneros

    } catch (error) {
        console.error("Erro ao alugar:", error);
        alert("Erro ao salvar no banco de dados.");
        document.getElementById('btnConfirmarEmprestimo').disabled = false;
        document.getElementById('btnConfirmarEmprestimo').innerText = "Confirmar Aluguel";
    }
}

// Vincular ao formulário
document.getElementById('formEmprestimo')?.addEventListener('submit', confirmarEmprestimo);


window.verAlugueis = async (idLivro) => {
    try {
        const livroRef = doc(db, "livros", idLivro);
        const snap = await getDoc(livroRef);
        const dados = snap.data();
        const alugueis = dados.alugueisAtivos || [];

        const container = document.getElementById('listaAlugueisCorpo');
        
        if (alugueis.length === 0) {
            container.innerHTML = "<p style='text-align:center; padding: 20px;'>Nenhum exemplar deste livro está alugado no momento.</p>";
        } else {
            let html = `
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f1f5f9; text-align: left;">
                            <th style="padding: 10px; border-bottom: 2px solid #ddd;">Carimbo</th>
                            <th style="padding: 10px; border-bottom: 2px solid #ddd;">Aluno</th>
                            <th style="padding: 10px; border-bottom: 2px solid #ddd;">Data Empréstimo</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            alugueis.forEach(al => {
                const dataFormatada = new Date(al.dataEmprestimo).toLocaleDateString('pt-BR');
                html += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${al.carimbo}</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${al.usuarioNome}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${dataFormatada}</td>
                    </tr>
                `;
            });

            html += "</tbody></table>";
            container.innerHTML = html;
        }

        document.getElementById('modalListaAlugueis').style.display = 'flex';

    } catch (error) {
        console.error("Erro ao carregar aluguéis:", error);
        alert("Não foi possível carregar a lista de aluguéis.");
    }
};


//---- Resetar modal aluguel ----
function resetarModalAluguel() {
    const form = document.getElementById('formEmprestimo');
    if (form) form.reset(); // Limpa todos os inputs do form de uma vez
    
    document.getElementById('info-nome').innerText = "";
    document.getElementById('info-email').innerText = "";
    document.getElementById('detalhesUsuario').style.display = 'none';
}

// Chame essa função dentro da fecharModalEmprestimo()
window.fecharModalEmprestimo = () => {
    document.getElementById('modalEmprestimo').style.display = 'none';
    resetarModalAluguel();
};

/**
 * --- FUNÇÃO DE EXCLUSÃO (RESTAURADA) ---
 */
window.excluirLivro = async (id) => {
    if (confirm("Tem certeza que deseja excluir este livro e todos os seus registros permanentemente?")) {
        try {
            await deleteDoc(doc(db, "livros", id));
            alert("Livro excluído com sucesso!");
            carregarDadosDoFirebase(); // Atualiza a tabela imediatamente
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir do banco de dados.");
        }
    }
};


window.abrirDetalhesLivro = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    // Preenche textos e imagem
    document.getElementById('detalheCapa').src = livro.capa || '../img/default-book.png';
    document.getElementById('detalheTitulo').innerText = livro.titulo;
    document.getElementById('detalheAutor').innerText = livro.autor;
    document.getElementById('detalheSinopse').innerText = livro.sinopse || "Sem sinopse disponível.";

    // Preenche Gêneros
    const generosDiv = document.getElementById('detalheGeneros');
    generosDiv.innerHTML = (livro.generos || []).map(g => 
        `<span class="tag-genero" style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-size:0.7rem;">${g}</span>`
    ).join('');

    // --- LÓGICA DO PDF (CORREÇÃO AQUI) ---
    const btnPDF = document.getElementById('btnBaixarPDF');
    
    if (livro.pdfUrl && livro.pdfUrl.trim() !== "") {
        btnPDF.href = livro.pdfUrl; // Aqui entra o Base64 ou Link
        btnPDF.style.display = 'flex'; // Use flex para manter o alinhamento centralizado
                
        // Opcional: define o nome do arquivo no download
        btnPDF.setAttribute('download', `Livro_${livro.titulo}.pdf`);
    } else {
        btnPDF.style.display = 'none'; // Esconde se não houver arquivo
    }

    // Abre o modal
    document.getElementById('modalDetalhesLivro').style.display = 'flex';
};

// Função para fechar (caso ainda não tenha)
window.fecharModalGeral = () => {
    document.getElementById('modalDetalhesLivro').style.display = 'none';
};