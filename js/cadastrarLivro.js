// 1. ADICIONADO: Imports necessários
import { db } from './firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variável Global para armazenar os gêneros
let tagsGeneros = [];

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-cadastrar-livro');
    const inputTag = document.getElementById('input-tag-genero');
    const listaTagsElemento = document.getElementById('lista-tags-cadastro');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // --- Lógica de Tema ---
    if (localStorage.getItem('theme') === 'dark') body.classList.add('dark');
    themeToggle?.addEventListener('click', () => {
        body.classList.toggle('dark');
        localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
    });

    // --- Lógica de Tags (Categorias) ---
    inputTag?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Impede o envio do formulário ao dar Enter no input
            const valor = inputTag.value.trim();

            if (valor && !tagsGeneros.includes(valor)) {
                tagsGeneros.push(valor);
                renderizarTags();
                inputTag.value = ''; // Limpa o campo
            }
        }
    });

    // Função para desenhar as tags na tela
    function renderizarTags() {
        if (!listaTagsElemento) return;
        listaTagsElemento.innerHTML = '';
        tagsGeneros.forEach((tag, index) => {
            const div = document.createElement('div');
            div.className = 'tag'; // Estilo definido no CSS
            div.innerHTML = `
                ${tag} 
                <span style="cursor:pointer; font-weight:bold" onclick="removerTagCadastro(${index})">&times;</span>
            `;
            listaTagsElemento.appendChild(div);
        });
    }

    // Tornar a remoção global para o onclick do HTML
    window.removerTagCadastro = (index) => {
        tagsGeneros.splice(index, 1);
        renderizarTags();
    };

    // --- Lógica de Envio (Submit) ---
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Captura de Arquivos
            const capaFile = document.getElementById('capa-arquivo')?.files[0];
            const pdfFile = document.getElementById('pdf-arquivo')?.files[0];

            const toBase64 = file => new Promise((resolve, reject) => {
                if (!file) resolve(null);
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            try {
                // Feedback visual
                const btnSubmit = document.getElementById('btn-salvar-livro');
                btnSubmit.disabled = true;
                btnSubmit.innerText = "Salvando no Banco...";

                const capaBase64 = await toBase64(capaFile);
                const pdfBase64 = await toBase64(pdfFile);

                // Montagem do Objeto para o Firebase
                const novoLivro = {
                    titulo: document.getElementById('titulo').value,
                    autor: document.getElementById('autor').value,
                    // SALVANDO COMO ARRAY DE STRINGS
                    generos: tagsGeneros, 
                    quantidade: document.getElementById('quantidade').value,
                    sinopse: document.getElementById('sinopse').value,
                    capa: capaBase64 || '../img/default-book.png',
                    pdfUrl: pdfBase64 || null,
                    status: "Disponível",
                    dataCadastro: new Date().toISOString() 
                };

                // Envio para o Firestore
                await addDoc(collection(db, "livros"), novoLivro);

                alert('Livro cadastrado com sucesso!');
                window.location.href = 'books.html';

            } catch (err) {
                alert('ERRO AO CADASTRAR: ' + err.message);
                console.error("Erro:", err);
                
                const btnSubmit = document.getElementById('btn-salvar-livro');
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Salvar Livro";
            }
        });
    }
});