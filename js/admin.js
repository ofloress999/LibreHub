import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    getDocs, 
    collection, 
    deleteDoc,
    query,
    where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PROTEÇÃO DE ROTA (ADMIN APENAS) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== "admin") {
            alert("Acesso negado!");
            window.location.href = "dashboard.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    window.renderizarUsuarios(); // Carrega a lista inicial
    carregarGruposNoSelect();
    
    const buscaLista = document.getElementById('inputBuscaUserLista');
    if (buscaLista) {
        buscaLista.addEventListener('input', () => window.renderizarUsuarios(buscaLista.value));
    }
});

// --- FUNÇÕES DE NAVEGAÇÃO ---
window.mudarAba = function(idAba) {
    // 1. Esconde todos os conteúdos e remove active dos botões
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // 2. Mostra a aba clicada
    const abaAlvo = document.getElementById(idAba);
    if (abaAlvo) {
        abaAlvo.classList.add('active');
    }
    
    // 3. Destaca o botão clicado (procura por botões que chamam mudarAba com o id correspondente)
    const btnAtivo = document.querySelector(`button[onclick*="${idAba}"]`);
    if (btnAtivo) {
        btnAtivo.classList.add('active');
    }

    // 4. Lógicas específicas por aba
    if (idAba === 'tab-lista') {
        window.renderizarUsuarios();
    } else if (idAba === 'tab-vencidos') {
        window.carregarLivrosVencidos();
    }
};

// --- RELATÓRIO DE LIVROS VENCIDOS E MULTAS ---
window.carregarLivrosVencidos = async function() {
    const container = document.getElementById('listaVencidosTabela');
    if (!container) return;

    container.innerHTML = `<tr><td colspan="5" style="text-align:center;">Buscando atrasos...</td></tr>`;

    try {
        // Busca apenas livros que estão com status "Alugado"
        const q = query(collection(db, "livros"), where("status", "==", "Alugado"));
        const querySnapshot = await getDocs(q);
        
        const hoje = Date.now();
        let contadorVencidos = 0;
        let html = "";

        for (const docLivro of querySnapshot.docs) {
            const livro = docLivro.data();
            
            // Verifica se o prazoLimite existe e se já passou do tempo atual
            if (livro.prazoLimite && hoje > livro.prazoLimite) {
                contadorVencidos++;

                // Cálculo de dias de atraso e multa (R$ 5,00 por dia)
                const diffTempo = hoje - livro.prazoLimite;
                const diasAtraso = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
                const multa = diasAtraso * 5;

                // Busca informações adicionais do usuário para contato
                let contato = "Não informado";
                if (livro.alugadoPor) { // UID do usuário salvo no ato do aluguel
                    const userSnap = await getDoc(doc(db, "usuarios", livro.alugadoPor));
                    if (userSnap.exists()) {
                        const u = userSnap.data();
                        contato = u.telefone || u.email || "Sem contato";
                    }
                }

                html += `
                    <tr>
                        <td><strong>${livro.titulo}</strong></td>
                        <td>${livro.usuarioAluguel}</td>
                        <td>${contato}</td>
                        <td><span style="color:var(--danger); font-weight:bold;">${livro.dataDevolucao}</span></td>
                        <td>
                            <div style="background:rgba(239, 68, 68, 0.1); padding:5px; border-radius:5px; color:var(--danger); font-size:12px;">
                                <b>Atraso:</b> ${diasAtraso} dias<br>
                                <b>Multa:</b> R$ ${multa.toFixed(2)}
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        if (contadorVencidos === 0) {
            container.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #10b981;">Nenhum livro atrasado no momento.</td></tr>`;
        } else {
            container.innerHTML = html;
        }

    } catch (error) {
        console.error("Erro ao carregar vencidos:", error);
        container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro ao processar dados.</td></tr>`;
    }
};

// --- RENDERIZAÇÃO DE USUÁRIOS (FIREBASE) ---
window.renderizarUsuarios = async function(filtro = "") {
    const tabela = document.getElementById('listaUsuariosTabela');
    if (!tabela) return;

    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        const usuarios = [];
        querySnapshot.forEach(doc => {
            usuarios.push({ id: doc.id, ...doc.data() });
        });

        const usuariosFiltrados = usuarios.filter(u => 
            (u.nome && u.nome.toLowerCase().includes(filtro.toLowerCase())) || 
            (u.cpf && u.cpf.includes(filtro)) ||
            (u.email && u.email.toLowerCase().includes(filtro.toLowerCase()))
        );

        tabela.innerHTML = "";
        if (usuariosFiltrados.length === 0) {
            tabela.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum usuário encontrado.</td></tr>`;
            return;
        }

        tabela.innerHTML = usuariosFiltrados.map(u => {
            return `
                <tr>
                    <td><strong>${u.nome || 'Sem Nome'}</strong></td>
                    <td>${u.cpf || '---'}</td>
                    <td>${u.email}</td>
                    <td><span class="status-livre">${u.role || 'user'}</span></td>
                    <td>
                        <button class="btn edit" onclick="verDetalhes('${u.id}')">Ver Ficha</button>
                        <button class="btn delete" onclick="excluirUsuarioFirestore('${u.id}')">Remover</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error("Erro Firebase:", error);
    }
};

// --- FICHA DETALHADA ---
window.verDetalhes = async function(userId) {
    try {
        const userDoc = await getDoc(doc(db, "usuarios", userId));
        if (!userDoc.exists()) return;
        const user = userDoc.data();

        document.getElementById('fichaNome').innerText = user.nome || "---";
        document.getElementById('fichaCPF').innerText = user.cpf || "---";
        document.getElementById('fichaEmail').innerText = user.email || "---";
        document.getElementById('fichaTel').innerText = user.telefone || "Não informado";
        document.getElementById('fichaGrupo').innerText = user.grupo || "Geral";

        const containerHist = document.getElementById('fichaHistoricoLista');
        containerHist.innerHTML = (user.historico && user.historico.length > 0) 
            ? user.historico.map(h => `<div class="history-item">✔️ ${h}</div>`).join('')
            : "<p>Sem histórico.</p>";

        document.getElementById('modalFichaUsuario').style.display = 'flex';
    } catch (e) {
        alert("Erro ao abrir ficha.");
    }
};

// --- EXCLUSÃO NO FIREBASE ---
window.excluirUsuarioFirestore = async function(docId) {
    if (!confirm("Remover permanentemente este usuário do banco de dados?")) return;
    try {
        await deleteDoc(doc(db, "usuarios", docId));
        alert("Removido com sucesso!");
        window.renderizarUsuarios();
    } catch (error) {
        alert("Erro ao excluir.");
    }
};

// --- UTILITÁRIOS ---
window.fecharModalFicha = function() {
    document.getElementById('modalFichaUsuario').style.display = 'none';
};

function carregarGruposNoSelect() {
    const select = document.getElementById('regGrupo');
    if (!select) return;
    const grupos = JSON.parse(localStorage.getItem('biblioteca_grupos')) || ["Aluno", "Professor", "Funcionário", "Externo"];
    select.innerHTML = grupos.map(g => `<option value="${g}">${g}</option>`).join('');
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modalFichaUsuario');
    if (event.target == modal) {
        window.fecharModalFicha();
    }
};