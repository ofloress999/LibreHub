// 1. ADICIONADO: Imports necessários
import { db } from './firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.form-book');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // --- Lógica de Tema ---
    if (localStorage.getItem('theme') === 'dark') body.classList.add('dark');
    themeToggle?.addEventListener('click', () => {
        body.classList.toggle('dark');
        localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const inputs = form.querySelectorAll('input');
            const capaFile = form.querySelectorAll('input[type="file"]')[0]?.files[0];
            const pdfFile = form.querySelectorAll('input[type="file"]')[1]?.files[0];

            const toBase64 = file => new Promise((resolve, reject) => {
                if (!file) resolve(null);
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            try {
                // Feedback visual: desabilita o botão para evitar cliques duplos
                const btnSubmit = form.querySelector('button[type="submit"]');
                btnSubmit.disabled = true;
                btnSubmit.innerText = "Cadastrando no Banco...";

                const capaBase64 = await toBase64(capaFile);
                const pdfBase64 = await toBase64(pdfFile);

                // 2. MODIFICADO: Objeto preparado para o Firebase
                const novoLivro = {
                    titulo: inputs[0].value, // Usando 'titulo' para bater com a listagem
                    autor: inputs[1].value,
                    categoria: inputs[2].value,
                    quantidade: inputs[3].value,
                    sinopse: form.querySelector('textarea').value,
                    capa: capaBase64 || '../img/default-book.png',
                    pdfUrl: pdfBase64 || null,
                    status: "Disponível",
                    dataCadastro: new Date().toISOString() 
                };

                // 3. ADICIONADO: Envio real para o Firestore
                await addDoc(collection(db, "livros"), novoLivro);

                alert('Livro cadastrado com sucesso no Firebase!');
                window.location.href = 'books.html';

            } catch (err) {
    // Isto vai abrir um pop-up com o erro técnico real
    alert('ERRO TÉCNICO: ' + err.code + " - " + err.message);
    console.error("Erro completo:", err);
    
    const btnSubmit = form.querySelector('button[type="submit"]');
    btnSubmit.disabled = false;
    btnSubmit.innerText = "Cadastrar Livro";
}
        });
    }
});