document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.form-book');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // --- 1. Lógica de Tema (Reaproveitada) ---
    if (localStorage.getItem('theme') === 'dark') body.classList.add('dark');
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark');
        localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
    });

    // --- 2. Menu Lateral ---
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('closed');
    });

    // --- 3. Cadastro do Livro ---
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const inputs = form.querySelectorAll('input');
            const capaFile = form.querySelectorAll('input[type="file"]')[0].files[0];
            const pdfFile = form.querySelectorAll('input[type="file"]')[1].files[0];

            const toBase64 = file => new Promise((resolve, reject) => {
                if (!file) resolve(null);
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            try {
                const capaBase64 = await toBase64(capaFile);
                const pdfBase64 = await toBase64(pdfFile);

                // IMPORTANTE: Nomes das propriedades ajustados para o Modal
                const novoLivro = {
                    id: Date.now(),
                    nome: inputs[0].value,
                    autor: inputs[1].value,
                    categoria: inputs[2].value,
                    quantidade: inputs[3].value,
                    sinopse: form.querySelector('textarea').value, // Antes era 'descricao'
                    capa: capaBase64 || '../img/default-book.png',
                    pdfUrl: pdfBase64, // Antes era 'pdf'
                    status: "Disponível",
                    dataCadastro: new Date().toLocaleDateString()
                };

                let biblioteca = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
                biblioteca.push(novoLivro);
                localStorage.setItem('biblioteca_livros', JSON.stringify(biblioteca));

                alert('Livro cadastrado com sucesso!');
                window.location.href = 'books.html';

            } catch (err) {
                alert('Erro ao processar arquivos. Tente arquivos menores.');
                console.error(err);
            }
        });
    }
});