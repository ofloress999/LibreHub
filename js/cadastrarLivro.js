// 1. ADICIONADO: setDoc nos imports para permitir a criação automática do contador
import { db } from './firebase.js';
import { 
    collection, addDoc, getDoc, doc, updateDoc, query, where, getDocs, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variável Global para armazenar os gêneros
let tagsGeneros = [];

// --- FUNÇÃO PARA GERAR OS IDS (CARIMBOS LIB-XXX) ---
async function gerarProximasMatriculas(quantidade) {
    try {
        const livrosRef = collection(db, "livros");
        const snap = await getDocs(livrosRef);
        
        let idsEmUso = new Set();
        
        snap.forEach(docSnap => {
            const dados = docSnap.data();
            if (dados.exemplaresDisponiveis && Array.isArray(dados.exemplaresDisponiveis)) {
                dados.exemplaresDisponiveis.forEach(id => idsEmUso.add(id));
            }
            if (dados.alugueisAtivos && Array.isArray(dados.alugueisAtivos)) {
                dados.alugueisAtivos.forEach(aluguel => idsEmUso.add(aluguel.carimbo));
            }
        });

        let novasMatriculas = [];
        let numeroTeste = 1;

        while (novasMatriculas.length < quantidade) {
            const idGerado = `LIB-${String(numeroTeste).padStart(3, '0')}`;
            if (!idsEmUso.has(idGerado)) {
                novasMatriculas.push(idGerado);
                idsEmUso.add(idGerado);
            }
            numeroTeste++;
        }

        const contadorRef = doc(db, "configuracoes", "contadores");
        await setDoc(contadorRef, { ultimoIdLivro: numeroTeste - 1 }, { merge: true });

        return novasMatriculas;
    } catch (e) {
        console.error("Erro ao gerar IDs inteligentes:", e);
        return Array.from({length: quantidade}, (_, i) => `LIB-ERR-${i}`);
    }
}

// --- FUNÇÃO PARA EXIBIR O MODAL COM TUTORIAL ---
function mostrarModalIdsGerados(titulo, ids) {
    const modal = document.getElementById('modalIdsGerados');
    const container = document.getElementById('conteudoIdsGerados');
    const campoTitulo = document.getElementById('tituloLivroGerado');

    if (modal && container) {
        campoTitulo.innerText = titulo;
        
        // Renderiza cada ID como uma etiqueta visual
        container.innerHTML = ids.map(id => `
            <div style="background: white; border: 1.5px solid #2563eb; color: #2563eb; padding: 5px; border-radius: 6px; text-align: center; font-family: monospace; font-weight: bold; font-size: 14px;">
                ${id}
            </div>
        `).join('');

        modal.style.display = 'flex';
    } else {
        alert("Livro cadastrado: " + titulo + "\nIDs: " + ids.join(", "));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-cadastrar-livro');
    const inputTag = document.getElementById('input-tag-genero');
    const listaTagsElemento = document.getElementById('lista-tags-cadastro');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Lógica de Tema
    if (localStorage.getItem('theme') === 'dark') body.classList.add('dark');
    themeToggle?.addEventListener('click', () => {
        body.classList.toggle('dark');
        localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
    });

    // Lógica de Tags
    inputTag?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const valor = inputTag.value.trim();
            if (valor && !tagsGeneros.includes(valor)) {
                tagsGeneros.push(valor);
                renderizarTags();
                inputTag.value = '';
            }
        }
    });

    function renderizarTags() {
        if (!listaTagsElemento) return;
        listaTagsElemento.innerHTML = '';
        tagsGeneros.forEach((tag, index) => {
            const div = document.createElement('div');
            div.className = 'tag';
            div.innerHTML = `${tag} <span style="cursor:pointer; font-weight:bold" onclick="removerTagCadastro(${index})">&times;</span>`;
            listaTagsElemento.appendChild(div);
        });
    }

    window.removerTagCadastro = (index) => {
        tagsGeneros.splice(index, 1);
        renderizarTags();
    };

    // --- Lógica de Envio (AJUSTADA) ---
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnSubmit = document.getElementById('btn-salvar-livro');
            const titulo = document.getElementById('titulo').value.trim();
            const autor = document.getElementById('autor').value.trim();
            const quantidadeDigitada = parseInt(document.getElementById('quantidade').value) || 0;
            const sinopse = document.getElementById('sinopse').value.trim();
            const capaFile = document.getElementById('capa-arquivo')?.files[0];
            const pdfFile = document.getElementById('pdf-arquivo')?.files[0];

            if (quantidadeDigitada <= 0) {
                alert("A quantidade deve ser maior que zero.");
                return;
            }

            const toBase64 = file => new Promise((resolve, reject) => {
                if (!file) resolve(null);
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            try {
                btnSubmit.disabled = true;
                btnSubmit.innerText = "Salvando...";

                const novasMatriculas = await gerarProximasMatriculas(quantidadeDigitada);
                const capaBase64 = await toBase64(capaFile);
                const pdfBase64 = await toBase64(pdfFile);

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
                        titulo, autor, generos: tagsGeneros,
                        quantidade: quantidadeDigitada,
                        quantidadeDisponivel: quantidadeDigitada,
                        quantidadeEmprestada: 0,
                        exemplaresDisponiveis: novasMatriculas,
                        alugueisAtivos: [], sinopse,
                        capa: capaBase64 || '../img/default-book.png',
                        pdfUrl: pdfBase64 || null,
                        status: "Disponível",
                        dataCadastro: new Date().toISOString()
                    };
                    await addDoc(livrosRef, novoLivro);
                }

                // 1. Abre o modal com os IDs e o tutorial
                mostrarModalIdsGerados(titulo, novasMatriculas);

                // 2. Limpa o formulário e reseta o botão
                form.reset();
                tagsGeneros = [];
                renderizarTags();
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Salvar Livro";

                // O REDIRECIONAMENTO FOI REMOVIDO PARA O USUÁRIO PODER LER O TUTORIAL NO MODAL

            } catch (err) {
                alert('ERRO: ' + err.message);
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Salvar Livro";
            }
        });
    }
});