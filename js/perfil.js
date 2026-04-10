import { auth, db } from './firebase.js';
import { onAuthStateChanged, updateEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, getDoc, updateDoc, collection, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        carregarPerfil(user);
        carregarMinhasReunioes(user); 
        carregarMeusLivros(user.uid);
    } else {
        window.location.href = "../index.html";
    }
});

// --- 1. CARREGAR PERFIL ---
async function carregarPerfil(user) {
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    
    // Displays fixos (texto)
    document.getElementById('email-usuario-display').innerText = user.email;

    if (userDoc.exists()) {
        const d = userDoc.data();
        
        // Nome no topo
        document.getElementById('nome-usuario-display').innerText = d.nome || "Usuário";

        // Preencher os Inputs do Formulário
        document.getElementById('perfil-nome').value = d.nome || "";
        document.getElementById('perfil-email').value = user.email || ""; // E-mail vem do Auth
        document.getElementById('perfil-cpf').value = d.cpf || "";
        document.getElementById('perfil-telefone').value = d.telefone || "";
        document.getElementById('perfil-endereco').value = d.endereco || "";
        document.getElementById('perfil-cidade').value = d.cidade || "";
        
        // Avatar
        if (d.fotoUrl) {
            const avatarHtml = `<img src="${d.fotoUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            if(document.getElementById('avatar-preview')) document.getElementById('avatar-preview').innerHTML = avatarHtml;
            if(document.getElementById('profileBtn')) document.getElementById('profileBtn').src = d.fotoUrl;
        }
    }
}

// --- 2. ATUALIZAR DADOS (BOTÃO SALVAR) ---
// Alterado para 'submit' caso esteja usando a tag <form>, ou mantido seletor de classe
const formPerfil = document.getElementById('form-perfil-edit');

const salvarDados = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const novoEmail = document.getElementById('perfil-email').value;

    const novosDados = {
        nome: document.getElementById('perfil-nome').value,
        cpf: document.getElementById('perfil-cpf').value,
        telefone: document.getElementById('perfil-telefone').value,
        endereco: document.getElementById('perfil-endereco').value,
        cidade: document.getElementById('perfil-cidade').value
    };

    try {
        // A. Atualizar E-mail no Authentication (se foi alterado)
        if (novoEmail !== user.email) {
            await updateEmail(user, novoEmail);
        }

        // B. Atualizar o Firestore
        await updateDoc(doc(db, "usuarios", user.uid), novosDados);
        
        alert("Dados atualizados com sucesso!");
        location.reload();
    } catch (err) { 
        console.error(err);
        if (err.code === 'auth/requires-recent-login') {
            alert("Para alterar o e-mail, você precisa fazer logout e login novamente por segurança.");
        } else {
            alert("Erro ao salvar dados: " + err.message); 
        }
    }
};

// Escutando o evento (ajuste o seletor se necessário)
if(formPerfil) {
    formPerfil.addEventListener('submit', salvarDados);
} else {
    // Caso não use tag <form>, escuta o clique no botão
    document.querySelector('.btn-save')?.addEventListener('click', salvarDados);
}

// --- 3. REUNIÕES ---
async function carregarMinhasReunioes(user) {
    const container = document.getElementById('minhas-reunioes');
    try {
        const querySnapshot = await getDocs(collection(db, "reunioes"));
        const agora = new Date();
        const limite24h = new Date(agora.getTime() - (24 * 60 * 60 * 1000));

        let html = "";
        let encontrou = false;
        const nomeUsuario = document.getElementById('nome-usuario-display').innerText;

        querySnapshot.forEach((docSnap) => {
            const r = docSnap.data();
            if (r.criadoPor === nomeUsuario) {
                const dataReuniao = new Date(r.data); 
                if (dataReuniao > limite24h) {
                    encontrou = true;
                    html += `
                        <div class="history-item">
                            <strong>📅 ${r.livro || "Reunião"}</strong>
                            <p style="font-size:12px;">Data: ${dataReuniao.toLocaleString('pt-BR')}</p>
                            <a href="${r.link}" target="_blank" class="link-reuniao">Entrar na Reunião</a>
                        </div>`;
                }
            }
        });
        container.innerHTML = encontrou ? html : '<p class="empty-text">Nenhuma reunião recente.</p>';
    } catch (e) { console.error(e); }
}

// --- 4. LIVROS ---
async function carregarMeusLivros(userId) {
    const container = document.getElementById('meus-livros');
    try {
        const snap = await getDocs(collection(db, "livros"));
        let html = "";
        let temLivro = false;

        snap.forEach(docSnap => {
            const l = docSnap.data();
            if (l.alugadoPor === userId && l.dataDevolucao) {
                temLivro = true;
                html += `
                    <div class="history-item">
                        <img src="${l.capa}" class="mini-capa">
                        <div>
                            <strong>${l.titulo}</strong>
                            <p style="font-size:12px; color:red;">Devolução: ${l.dataDevolucao}</p>
                        </div>
                    </div>`;
            }
        });
        container.innerHTML = temLivro ? html : '<p class="empty-text">Nenhum livro alugado.</p>';
    } catch (e) { console.error(e); }
}