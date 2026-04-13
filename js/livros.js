import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, getDocs, deleteDoc, doc, getDoc, 
    query, where, updateDoc, addDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. VARIÁVEIS GLOBAIS ---
let todosOsLivros = [];
let tipoUsuario = String(localStorage.getItem('tipoUsuario') || "").replace(/["']/g, "").trim().toLowerCase(); 

// --- 2. AUTENTICAÇÃO ---
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
    } else { window.location.href = "../index.html"; }
});

document.addEventListener('DOMContentLoaded', () => {
    setupFiltros();
    aplicarMascaraCPFAluguel();

    const formCadastro = document.getElementById('formCadastrarLivro');
    if (formCadastro) formCadastro.addEventListener('submit', cadastrarOuAtualizarLivro);

    const formEmprestimo = document.getElementById('formEmprestimo');
    if (formEmprestimo) formEmprestimo.addEventListener('submit', salvarEmprestimoNoFirebase);
});

// --- 3. UTILITÁRIOS ---
async function gerarProximasMatriculas(quantidade) {
    const contadorRef = doc(db, "configuracoes", "contadores");
    let ultimoNumero = 0;

    try {
        const snap = await getDoc(contadorRef);
        
        if (snap.exists()) {
            ultimoNumero = snap.data().ultimoIdLivro || 0;
        } else {
            // Se não existir, o código cria o documento automaticamente agora
            await addDoc(collection(db, "configuracoes"), { ultimoIdLivro: 0 });
        }

        let matriculas = [];
        for (let i = 1; i <= quantidade; i++) {
            const novoNumero = ultimoNumero + i;
            const idFormatado = `LIB-${String(novoNumero).padStart(3, '0')}`;
            matriculas.push(idFormatado);
        }

        // Atualiza para o próximo
        await updateDoc(contadorRef, { ultimoIdLivro: ultimoNumero + quantidade });
        return matriculas;

    } catch (e) {
        // Caso a coleção nem exista, ele tenta criar o primeiro registro
        console.log("Criando coleção de contadores pela primeira vez...");
        await addDoc(collection(db, "configuracoes"), { ultimoIdLivro: quantidade });
        return Array.from({length: quantidade}, (_, i) => `LIB-${String(i+1).padStart(3, '0')}`);
    }
}

// --- 4. CADASTRO (CORRIGIDO) ---
async function cadastrarOuAtualizarLivro(e) {
    e.preventDefault();

    const tituloNormal = document.getElementById('titulo').value.trim();
    const autorNormal = document.getElementById('autor').value.trim();
    const qtdInformada = Number(document.getElementById('quantidade').value) || 0; // Nome corrigido

    try {
        const q = query(collection(db, "livros"), 
                        where("titulo_search", "==", tituloNormal.toUpperCase()), 
                        where("autor_search", "==", autorNormal.toUpperCase()));
        
        const snap = await getDocs(q);
        let novasMatriculas = [];
        
        // Loop corrigido: usando qtdInformada
        for(let i=0; i < qtdInformada; i++) {
            novasMatriculas.push(gerarMatriculaUnica());
        }

        if (!snap.empty) {
            const docExistente = snap.docs[0];
            const ref = doc(db, "livros", docExistente.id);
            const dadosAtuais = docExistente.data();
            const listaAtualizada = [...(dadosAtuais.exemplaresDisponiveis || []), ...novasMatriculas];

            await updateDoc(ref, {
                quantidade: listaAtualizada.length, 
                exemplaresDisponiveis: listaAtualizada,
                status: "Disponível"
            });
        } else {
            await addDoc(collection(db, "livros"), {
                titulo: tituloNormal,
                autor: autorNormal,
                titulo_search: tituloNormal.toUpperCase(),
                autor_search: autorNormal.toUpperCase(),
                quantidade: qtdInformada,
                exemplaresDisponiveis: novasMatriculas, 
                status: "Disponível",
                capa: document.getElementById('capa')?.value || '../img/default-book.png',
                alugueisAtivos: []
            });
        }

        exibirModalCarimbo(tituloNormal, novasMatriculas);
        carregarDadosDoFirebase();
    } catch (err) { console.error("Erro ao salvar:", err); }
}

// --- 5. RENDERIZAÇÃO ---
async function carregarDadosDoFirebase() {
    const corpoTabela = document.getElementById('tabelaLivrosCorpo');
    const snap = await getDocs(collection(db, "livros"));
    todosOsLivros = [];
    corpoTabela.innerHTML = "";

    snap.forEach(async (docSnap) => {
        let data = docSnap.data();
        let livroId = docSnap.id;

        // --- O CONSERTO AUTOMÁTICO ACONTECE AQUI ---
        let exemplares = data.exemplaresDisponiveis || [];
        let qtdNoBanco = Number(data.quantidade) || 0;

        // Se o livro tem quantidade mas o array está sumido (Erro de esgotado)
        if (exemplares.length === 0 && qtdNoBanco > 0) {
            console.log(`Corrigindo livro: ${data.titulo}`);
            exemplares = await gerarProximasMatriculas(qtdNoBanco);
            
            // Salva o conserto no Firebase automaticamente
            await updateDoc(doc(db, "livros", livroId), {
                exemplaresDisponiveis: exemplares
            });
        }

        const livroCompleto = { id: livroId, ...data, exemplaresDisponiveis: exemplares };
        todosOsLivros.push(livroCompleto);
        renderizarLinhaTabela(livroCompleto);
    });
}

function renderizarLinhaTabela(l) {
    const corpo = document.getElementById('tabelaLivrosCorpo');
    if (!corpo) return;
    
    // 1. Garantimos que estamos lendo números para evitar erros de exibição
    const total = Number(l.quantidade || 0);
    const disponiveis = Number(l.quantidadeDisponivel || 0);
    
    // 2. A lógica de disponibilidade agora é baseada no contador numérico
    const isDisponivel = disponiveis > 0;

    const tr = document.createElement('tr');
    tr.setAttribute('data-id', l.id);
    
    tr.innerHTML = `
        <td><img src="${l.capa}" style="width:40px;height:50px;object-fit:cover;"></td>
        <td><strong>${l.titulo}</strong></td>
        <td>${l.autor}</td>
        <td>
            <span class="${isDisponivel ? 'status-livre' : 'status-alugado'}" 
                  style="color: ${isDisponivel ? '#10b981' : '#ef4444'}; font-weight: bold;">
                ${isDisponivel ? `Disponível (${disponiveis}/${total})` : `Esgotado (0/${total})`}
            </span>
        </td>
        <td>
            <button class="btn edit" 
                    onclick="window.abrirModalEmprestimo('${l.id}')" 
                    ${!isDisponivel ? 'disabled style="background:#ccc; cursor:not-allowed;"' : ''}>
                Alugar
            </button>
            
            <button class="btn" 
                    style="background:#2563eb; color:white;" 
                    onclick="window.verListaAlugueis('${l.id}')">
                Ver Aluguéis
            </button>
            
            <button class="btn delete" 
                    onclick="window.excluirLivro('${l.id}')">
                Excluir
            </button>
        </td>`;
        
    corpo.appendChild(tr);
}

function renderizarCardUsuario(l) {
    const container = document.getElementById('container-cards-livros');
    if (!container) return;

    const disponivel = l.exemplaresDisponiveis.length > 0;
    const card = document.createElement('div');
    card.className = 'book-card-v2';
    card.setAttribute('data-id', l.id);
    card.onclick = () => typeof window.abrirDetalhesLivro === 'function' ? window.abrirDetalhesLivro(l.id) : null;

    card.innerHTML = `
        <img src="${l.capa}" alt="${l.titulo}" class="book-cover-v2">
        <div class="book-info">
            <h3>${l.titulo}</h3>
            <p>${l.autor}</p>
            <span class="${disponivel ? 'status-livre' : 'status-alugado'}">
                ${disponivel ? 'Disponível' : 'Esgotado'} 
            </span>
            <small>(${l.exemplaresDisponiveis.length} un.)</small>
        </div>`;
    container.appendChild(card);
}

// --- 7. FILTROS E BUSCA ---
function setupFiltros() {
    document.getElementById('inputBusca')?.addEventListener('input', filtrarLivros);
    document.getElementById('filtroGenero')?.addEventListener('change', filtrarLivros);
    document.getElementById('filtroStatus')?.addEventListener('change', filtrarLivros);
}

function filtrarLivros() {
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const generoSelecionado = document.getElementById('filtroGenero').value;
    const statusSelecionado = document.getElementById('filtroStatus').value;

    todosOsLivros.forEach(l => {
        const elemento = document.querySelector(`tr[data-id="${l.id}"]`) || 
                         document.querySelector(`.book-card-v2[data-id="${l.id}"]`);
        if (!elemento) return;

        const atendeTexto = l.titulo.toLowerCase().includes(termo) || l.autor.toLowerCase().includes(termo);
        const atendeGenero = generoSelecionado === "Todos" || (l.generos && l.generos.includes(generoSelecionado));
        
        const disponivel = l.exemplaresDisponiveis.length > 0;
        let atendeStatus = true;
        if (statusSelecionado === "Disponível") atendeStatus = disponivel;
        if (statusSelecionado === "Alugado") atendeStatus = !disponivel;

        elemento.style.display = (atendeTexto && atendeGenero && atendeStatus) ? "" : "none";
    });
}

function atualizarOpcoesFiltroGenero() {
    const filtroGenero = document.getElementById('filtroGenero');
    if (!filtroGenero) return;

    const generosSet = new Set();
    todosOsLivros.forEach(livro => {
        if (Array.isArray(livro.generos)) livro.generos.forEach(g => generosSet.add(g));
    });

    filtroGenero.innerHTML = '<option value="Todos">Todos os Gêneros</option>';
    generosSet.forEach(genero => {
        const option = document.createElement('option');
        option.value = genero;
        option.textContent = genero;
        filtroGenero.appendChild(option);
    });
}

// --- 8. LÓGICA DE EMPRÉSTIMOS E DEVOLUÇÕES ---
async function salvarEmprestimoNoFirebase(e) {
    e.preventDefault();
    
    try {
        const idLivro = document.getElementById('idLivroModal').value;
        const nomeUser = document.getElementById('info-nome').innerText;
        const emailUser = document.getElementById('info-email').innerText;
        // Capturando o telefone que adicionamos ao HTML para o histórico
        const telefoneUser = document.getElementById('info-telefone')?.innerText || "Não informado";

        if (!nomeUser || nomeUser === "") {
            alert("Por favor, busque um usuário válido por CPF primeiro.");
            return;
        }

        const livroRef = doc(db, "livros", idLivro);
        const livroSnap = await getDoc(livroRef);
        
        if (!livroSnap.exists()) return;
        const dados = livroSnap.data();

        // 1. Garantir que tratamos os números como Number para evitar o erro de NaN
        const qtdDisponivelAtual = Number(dados.quantidadeDisponivel || 0);
        const qtdEmprestadaAtual = Number(dados.quantidadeEmprestada || 0);

        // 2. Verificação de segurança robusta
        if (qtdDisponivelAtual <= 0 || !dados.exemplaresDisponiveis || dados.exemplaresDisponiveis.length === 0) {
            alert("Impossível realizar empréstimo: Livro Esgotado!");
            fecharModalEmprestimo();
            return;
        }

        // 3. Manipulação do Array (Tirando da estante)
        let novosDisponiveis = [...dados.exemplaresDisponiveis];
        const matriculaAlugada = novosDisponiveis.shift(); 

        // 4. ATUALIZAÇÃO SINCRONIZADA
        // A quantidade disponível DEVE ser o tamanho do array resultante
        await updateDoc(livroRef, {
            exemplaresDisponiveis: novosDisponiveis,
            quantidadeDisponivel: novosDisponiveis.length, 
            quantidadeEmprestada: qtdEmprestadaAtual + 1,
            alugueisAtivos: [...(dados.alugueisAtivos || []), {
                idExemplar: matriculaAlugada,
                nome: nomeUser,
                email: emailUser,
                telefone: telefoneUser,
                dataEmprestimo: new Date().toLocaleDateString('pt-BR'),
                // Data de devolução prevista (15 dias)
                dataDevolucao: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
            }]
        });

        alert(`Empréstimo realizado! Exemplar: ${matriculaAlugada}`);
        fecharModalEmprestimo();
        
        // Limpar campos de busca para o próximo
        document.getElementById('inputUsuarioBusca').value = "";
        document.getElementById('detalhesUsuario').style.display = 'none';
        
        carregarDadosDoFirebase();

    } catch (error) {
        console.error("Erro ao salvar empréstimo:", error);
        alert("Erro técnico ao registrar no banco de dados.");
    }
}

window.confirmarDevolucaoEspecifica = async (idLivro, idExemplar) => {
    if (!confirm(`Confirmar devolução do exemplar ${idExemplar}?`)) return;

    try {
        const ref = doc(db, "livros", idLivro);
        const snap = await getDoc(ref);
        const dados = snap.data();

        // 1. Remove o locatário da lista
        const novosAlugueis = (dados.alugueisAtivos || []).filter(a => a.idExemplar !== idExemplar);
        
        // 2. Devolve o ID para a estante (sem duplicar)
        let listaDisponiveis = [...(dados.exemplaresDisponiveis || [])];
        if (!listaDisponiveis.includes(idExemplar)) {
            listaDisponiveis.push(idExemplar);
        }

        // 3. CÁLCULO REAL (Subtração do Total)
        // Isso impede que o sistema invente que tem 2/2 se ainda houver gente com o livro
        const totalLivros = Number(dados.quantidade || 2);
        const qtdAindaAlugada = novosAlugueis.length;
        
        const disponivelFinal = totalLivros - qtdAindaAlugada;

        await updateDoc(ref, {
            alugueisAtivos: novosAlugueis,
            exemplaresDisponiveis: listaDisponiveis,
            quantidadeDisponivel: disponivelFinal, // Se sobrar 1 alugado, aqui será 1 obrigatoriamente
            quantidadeEmprestada: qtdAindaAlugada
        });

        alert("Devolução processada!");
        fecharModalEmprestimoInfo();
        carregarDadosDoFirebase();

    } catch (error) {
        console.error("Erro crítico na devolução:", error);
    }
};

// --- 9. MODAIS E UTILITÁRIOS DE INTERFACE ---
function exibirModalCarimbo(titulo, lista) {
    const modalExistente = document.getElementById('modalCarimbo');
    if(modalExistente) modalExistente.remove();

    const modalHTML = `
        <div id="modalCarimbo" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:10000;">
            <div style="background:white; padding:30px; border-radius:12px; max-width:450px; width:90%; text-align:center;">
                <h2 style="color:#059669;">✔ Concluído!</h2>
                <p>Matrículas geradas para: <strong>${titulo}</strong></p>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin:20px 0; max-height:200px; overflow-y:auto;">
                    ${lista.map(m => `<div style="background:#f3f4f6; padding:8px; border-radius:6px; font-weight:bold; color:#2563eb; border:1px solid #d1d5db;">${m}</div>`).join('')}
                </div>
                <button onclick="document.getElementById('modalCarimbo').remove()" style="width:100%; background:#2563eb; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer;">Fechar</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// --- CORREÇÃO DEFINITIVA DO BOTÃO ALUGAR ---
window.abrirModalEmprestimo = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    const modal = document.getElementById('modalEmprestimo');
    if (modal) {
        // Preenche o ID escondido para o formulário saber qual livro é
        document.getElementById('idLivroModal').value = id;
        
        // Preenche o nome do livro no título do modal (ID do seu HTML)
        const labelTitulo = document.getElementById('nomeLivroModal');
        if (labelTitulo) labelTitulo.innerText = livro.titulo;

        // Reseta o modal para uma nova busca
        document.getElementById('detalhesUsuario').style.display = 'none';
        document.getElementById('inputUsuarioBusca').value = "";
        
        modal.style.display = 'flex';
    }
};


// Garante que o fechar também funciona globalmente
window.fecharModalEmprestimo = () => {
    document.getElementById('modalEmprestimo').style.display = 'none';
};

window.fecharModalEmprestimoInfo = () => document.getElementById('modalDetalhesEmprestimo').style.display = 'none';

// --- FUNÇÃO DE EXCLUSÃO (DEFINIDA COMO GLOBAL) ---
window.excluirLivro = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este livro permanentemente? Todas as matrículas e registros de aluguel serão perdidos.")) return;

    try {
        const livroRef = doc(db, "livros", id);
        await deleteDoc(livroRef);
        
        console.log("Livro excluído com sucesso:", id);
        
        // Atualiza a interface localmente removendo o elemento para ser mais rápido
        const elemento = document.querySelector(`tr[data-id="${id}"]`) || 
                         document.querySelector(`.book-card-v2[data-id="${id}"]`);
        if (elemento) elemento.remove();

        // Recarrega os dados do Firebase para garantir sincronia
        carregarDadosDoFirebase();
        
    } catch (error) {
        console.error("Erro ao excluir livro:", error);
        alert("Erro ao excluir o livro. Verifique o console.");
    }
};

// --- 6. LISTAGEM DE ALUGUÉIS ATUALIZADA (MODAL BONITO) ---
window.verListaAlugueis = async (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    const modal = document.getElementById('modalDetalhesEmprestimo');
    const container = modal.querySelector('.modal-content') || modal;
    
    // Cabeçalho do Modal
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
            <h2 style="margin:0; color:#1e293b; font-size: 1.5rem;">Aluguéis Ativos</h2>
            <span style="cursor:pointer; font-size: 28px; color: #64748b;" onclick="window.fecharModalEmprestimoInfo()">&times;</span>
        </div>
        <p style="margin-bottom: 20px; color: #2563eb; font-weight: 600;">📖 ${livro.titulo}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
    `;
    
    if (livro.alugueisAtivos.length === 0) {
        html += `<p style="text-align:center; color:#94a3b8; padding: 20px;">Nenhum exemplar alugado no momento.</p>`;
    } else {
        // Criar um card para cada aluguel ativo
        livro.alugueisAtivos.forEach(a => {
            // Lógica simples para destacar se a devolução é hoje ou passou (opcional)
            const dataHoje = new Date().toLocaleDateString('pt-BR');
            const ehUrgente = a.dataDevolucao === dataHoje;

            html += `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                            Matrícula: ${a.idExemplar}
                        </span>
                        <span style="font-size: 12px; color: ${ehUrgente ? '#ef4444' : '#64748b'}; font-weight: bold;">
                            📅 Devolução: ${a.dataDevolucao}
                        </span>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <h4 style="margin: 0 0 5px 0; color: #1e293b;">${a.nome}</h4>
                        <p style="margin: 0; font-size: 13px; color: #64748b;">📧 ${a.email || 'E-mail não informado'}</p>
                        <p style="margin: 0; font-size: 13px; color: #64748b;">📞 ${a.telefone || '(00) 00000-0000'}</p>
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 10px; border-top: 1px solid #edf2f7; pt: 10px;">
                         <button class="btn delete" style="flex: 1; margin-top: 10px; padding: 8px; font-size: 13px;" 
                            onclick="window.confirmarDevolucaoEspecifica('${livro.id}', '${a.idExemplar}')">
                            📥 Dar Baixa (Devolver)
                        </button>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    modal.style.display = 'flex';
};

// Aproveite e garanta que a função de fechar também seja global
window.fecharModalEmprestimoInfo = () => {
    document.getElementById('modalDetalhesEmprestimo').style.display = 'none';
};

function configurarLayoutPorCargo() {
    const btnAdd = document.getElementById('btn-admin-add');
    const areaTabela = document.getElementById('area-admin-tabela');
    if (tipoUsuario === 'admin') {
        if (btnAdd) btnAdd.style.display = 'block';
        if (areaTabela) areaTabela.style.display = 'block';
    }
}

function aplicarMascaraCPFAluguel() {
    const input = document.getElementById('inputUsuarioBusca');
    if (!input) return;
    input.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 11);
        if (v.length >= 4 && v.length <= 6) v = v.replace(/(\d{3})(\d)/, "$1.$2");
        else if (v.length >= 7 && v.length <= 9) v = v.replace(/(\d{3})(\d{3})(\d)/, "$1.$2.$3");
        else if (v.length >= 10) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d)/, "$1.$2.$3-$4");
        e.target.value = v;
        if (v.length === 14) buscarUsuarioPorCPF(v);
    });
}

async function buscarUsuarioPorCPF(cpf) {
    const detalhesDiv = document.getElementById('detalhesUsuario');
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');
    
    // Limpa campos antes da busca para não mostrar dados do usuário anterior
    document.getElementById('info-nome').innerText = "";
    document.getElementById('info-email').innerText = "";
    if(document.getElementById('info-telefone')) document.getElementById('info-telefone').innerText = "";
    detalhesDiv.style.display = 'none';
    btnConfirmar.disabled = true;

    try {
        const q = query(collection(db, "usuarios"), where("cpf", "==", cpf));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const user = snap.docs[0].data();
            document.getElementById('info-nome').innerText = user.nome || "Não informado";
            document.getElementById('info-email').innerText = user.email || "Não informado";
            
            const elTel = document.getElementById('info-telefone');
            if (elTel) elTel.innerText = user.telefone || "Não informado";

            detalhesDiv.style.display = 'block';
            btnConfirmar.disabled = false;
        } else {
            alert("CPF inexistente ou não cadastrado!");
            document.getElementById('inputUsuarioBusca').value = ""; // Limpa o input
        }
    } catch (error) {
        console.error("Erro ao buscar CPF:", error);
        alert("Erro na conexão com o banco de dados.");
    }
}