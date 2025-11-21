// ====================================================================
// CONFIGURAÇÃO FIREBASE
// ====================================================================

const firebaseConfig = {
    apiKey: "AIzaSyAGFbBUOt8-74eDVlydPubn0hBolGfSqzo",
    authDomain: "usguridaunoesc1.firebaseapp.com",
    projectId: "usguridaunoesc1",
    storageBucket: "usguridaunoesc1.firebasestorage.app",
    messagingSenderId: "737967909997",
    appId: "1:737967909997:web:83482f7dbd034047cca364",
    measurementId: "G-14XB3SB6XS"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const storageRef = storage.ref();
const photosCollection = db.collection("galeria_fotos");

// ====================================================================
// VARIÁVEIS GLOBAIS
// ====================================================================

let currentUser = null;
let recadosUnsubscribe = null;
let chatUnsubscribe = null;

const AVATAR_URLS = [
    "img/avatars/guri_verde.png",
    "img/avatars/guri_azul.png",
    "img/avatars/guri_vermelho.png",
    "img/avatars/guri_amarelo.png",
    "img/avatars/guri_roxo.png"
];

// ====================================================================
// FUNÇÕES DE NAVEGAÇÃO ENTRE PÁGINAS
// ====================================================================

function showPage(pageId) {
    // Desliga listeners de páginas anteriores
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }
    if (recadosUnsubscribe) {
        recadosUnsubscribe();
        recadosUnsubscribe = null;
    }
    if (rankingUnsubscribe) {
        rankingUnsubscribe();
        rankingUnsubscribe = null;
    }
    if (snakeRankingUnsubscribe) {
        snakeRankingUnsubscribe();
        snakeRankingUnsubscribe = null;
    }

    // Parar o jogo Dino se estiver rodando
    if (gameRunning) {
        gameRunning = false;
        document.removeEventListener('keydown', handleJump);
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.removeEventListener('click', handleTouchJump);
            canvas.removeEventListener('touchstart', handleTouchJump);
        }
    }

    // Parar o jogo Snake se estiver rodando
    if (snakeRunning) {
        snakeRunning = false;
        if (snakeGameLoop) {
            clearInterval(snakeGameLoop);
            snakeGameLoop = null;
        }
        document.removeEventListener('keydown', handleSnakeKeyPress);
        const snakeCanvas = document.getElementById('snakeCanvas');
        if (snakeCanvas) {
            snakeCanvas.removeEventListener('touchstart', handleSnakeTouchStart);
            snakeCanvas.removeEventListener('touchend', handleSnakeTouchEnd);
        }
        disableSnakeAntiCheat();
    }

    // Troca a página ativa
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    // Scroll suave para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Inicia listeners específicos da página
    if (pageId === 'chat') {
        loadChat();
        updateChatAccess();
    }
    if (pageId === 'recados') {
        loadRecados();
    }
    if (pageId === 'galeria') {
        loadGallery();
    }
    if (pageId === 'jogo') {
        initGame();
        loadRanking();
    }
    if (pageId === 'snake') {
        initSnakeGame();
        loadSnakeRanking();
    }

    // Fecha menu mobile se estiver aberto
    document.getElementById('navMenu').classList.remove('active');
}

// ====================================================================
// SISTEMA DE AUTENTICAÇÃO - LOGIN E CADASTRO
// ====================================================================

// --- Função para exibir mensagens de erro/sucesso ---
function showMessage(msgDiv, text, isError = false) {
    msgDiv.textContent = text;
    msgDiv.style.display = 'block';
    msgDiv.className = isError ? 'mensagem-auth error' : 'mensagem-auth success';
    
    // Auto-hide após 5 segundos se for sucesso
    if (!isError) {
        setTimeout(() => {
            msgDiv.style.display = 'none';
        }, 5000);
    }
}

// --- Alternar entre formulário de Login e Cadastro ---
function toggleAuthMode() {
    const loginForm = document.getElementById('loginForm');
    const cadastroForm = document.getElementById('cadastroForm');
    const msg = document.getElementById('authMessage');
    const isLogin = loginForm.style.display !== 'none';

    loginForm.style.display = isLogin ? 'none' : 'block';
    cadastroForm.style.display = isLogin ? 'block' : 'none';

    // Limpa mensagem ao trocar de formulário
    if (msg) {
        msg.style.display = 'none';
        msg.textContent = '';
    }
}

// --- Clique no botão Login/Sair ---
function handleAuthClick(event) {
    event.preventDefault();
    if (currentUser) {
        doLogout();
    } else {
        showPage('login');
    }
}

// --- Logout ---
function doLogout() {
    if (confirm('Tem certeza que quer sair do rolê?')) {
        currentUser = null;
        localStorage.removeItem('guriUsername');
        localStorage.removeItem('guriAvatarUrl');
        updateAuthUI();
        updateChatAccess();
        alert('Até mais! Deslogado com sucesso.');
        showPage('quem-somos');
    }
}

// --- Atualizar interface (mostrar username e botão Login/Sair) ---
function updateAuthUI() {
    const authLink = document.getElementById('auth-link');
    const usernameDisplay = document.getElementById('guri-username-display');

    if (currentUser) {
        // Usuário logado
        authLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
        if (usernameDisplay) {
            usernameDisplay.textContent = currentUser.toUpperCase();
        }
    } else {
        // Usuário deslogado
        authLink.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        if (usernameDisplay) {
            usernameDisplay.textContent = '';
        }
    }

    updateChatAccess();
}

// --- CADASTRO ---
document.getElementById('cadastroForm').onsubmit = function(e) {
    e.preventDefault();

    const username = document.getElementById('usernameCadastro').value.trim().toLowerCase();
    const password = document.getElementById('senhaCadastro').value;
    const msgDiv = document.getElementById('authMessage');
    const btn = this.querySelector('button[type="submit"]');

    // Limpa mensagem anterior
    msgDiv.style.display = 'none';
    msgDiv.textContent = '';

    // Validações
    if (username.length < 3) {
        showMessage(msgDiv, '❌ O username deve ter pelo menos 3 caracteres!', true);
        return;
    }

    if (password.length < 6) {
        showMessage(msgDiv, '❌ A senha deve ter pelo menos 6 caracteres!', true);
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    // Verifica se username já existe
    db.collection("users").doc(username).get()
        .then(doc => {
            if (doc.exists) {
                showMessage(msgDiv, '❌ Este username já existe! Escolha outro.', true);
                btn.disabled = false;
                btn.textContent = 'Criar Conta';
                return Promise.reject('Username já existe');
            }

            // Salva usuário no Firestore
            return db.collection("users").doc(username).set({
                username: username,
                password: password,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                avatarUrl: getDefaultAvatar()
            });
        })
        .then(() => {
            // Login automático após cadastro
            currentUser = username;
            localStorage.setItem('guriUsername', username);
            localStorage.setItem('guriAvatarUrl', getDefaultAvatar());
            updateAuthUI();

            showMessage(msgDiv, '✅ Cadastro concluído! Seja bem-vindo, guri!');
            
            this.reset();
            
            setTimeout(() => {
                showPage('quem-somos');
            }, 2000);
        })
        .catch(err => {
            if (err !== 'Username já existe') {
                console.error('Erro no cadastro:', err);
                showMessage(msgDiv, '❌ Erro ao cadastrar: ' + err.message, true);
            }
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Criar Conta';
        });
};

// --- LOGIN ---
document.getElementById('loginForm').onsubmit = function(e) {
    e.preventDefault();

    const username = document.getElementById('usernameLogin').value.trim().toLowerCase();
    const password = document.getElementById('senhaLogin').value;
    const msgDiv = document.getElementById('authMessage');
    const btn = document.getElementById('btnLogin');

    // Limpa mensagem anterior
    msgDiv.style.display = 'none';
    msgDiv.textContent = '';

    // Validações básicas
    if (username.length < 3) {
        showMessage(msgDiv, '❌ Digite um username válido!', true);
        return;
    }

    if (password.length < 6) {
        showMessage(msgDiv, '❌ Senha muito curta!', true);
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    // Busca usuário no Firestore
    db.collection("users").doc(username).get()
        .then(doc => {
            if (!doc.exists) {
                showMessage(msgDiv, '❌ Usuário não encontrado! Cadastre-se primeiro.', true);
                btn.disabled = false;
                btn.textContent = 'Entrar';
                return;
            }

            const userData = doc.data();

            // Verifica senha (sem criptografia)
            if (userData.password !== password) {
                showMessage(msgDiv, '❌ Senha incorreta!', true);
                btn.disabled = false;
                btn.textContent = 'Entrar';
                return;
            }

            // Login bem-sucedido
            currentUser = username;
            localStorage.setItem('guriUsername', username);
            localStorage.setItem('guriAvatarUrl', userData.avatarUrl || getDefaultAvatar());
            updateAuthUI();

            showMessage(msgDiv, '✅ Acesso liberado, guri!');
            
            this.reset();
            
            setTimeout(() => {
                showPage('quem-somos');
            }, 1500);
        })
        .catch(err => {
            console.error('Erro no login:', err);
            showMessage(msgDiv, '❌ Erro ao fazer login: ' + err.message, true);
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Entrar';
        });
};

// ====================================================================
// SISTEMA DE CHAT EM TEMPO REAL
// ====================================================================

// --- Carregar mensagens do chat ---
function loadChat() {
    const chatMessages = document.getElementById('chat-messages');

    chatUnsubscribe = db.collection("chat")
        .orderBy("createdAt", "asc")
        .onSnapshot(
            snapshot => {
                chatMessages.innerHTML = '';

                if (!currentUser) {
                    chatMessages.innerHTML = '<p class="system-message">💬 Chat do rolê! Você precisa estar logado para enviar mensagens.</p>';
                }

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const chatItem = document.createElement('div');
                    chatItem.classList.add('chat-item');

                    chatItem.innerHTML = `
                        <img src="${data.avatarUrl || getDefaultAvatar()}" class="chat-avatar" alt="${data.username}" />
                        <p>
                            <strong>${data.username}:</strong> 
                            <span>${data.message}</span>
                        </p>
                    `;
                    chatMessages.appendChild(chatItem);
                });

                chatMessages.scrollTop = chatMessages.scrollHeight;
            },
            error => {
                console.error("Erro ao carregar chat:", error);
                chatMessages.innerHTML = '<p class="system-message" style="color: red;">❌ Erro ao carregar mensagens.</p>';
            }
        );
}

// --- Habilitar/Desabilitar input do chat ---
function updateChatAccess() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const isLoggedIn = currentUser !== null;

    if (isLoggedIn) {
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.placeholder = 'Digite sua mensagem...';
    } else {
        chatInput.disabled = true;
        sendButton.disabled = true;
        chatInput.placeholder = 'Você precisa estar logado para digitar.';
    }
}

// --- Enviar mensagem ---
function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();

    if (!currentUser || message === '') {
        return;
    }

    const username = currentUser.toUpperCase();
    const avatarUrl = localStorage.getItem('guriAvatarUrl') || getDefaultAvatar();

    db.collection("chat").add({
        username: username,
        message: message,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        avatarUrl: avatarUrl
    })
    .then(() => {
        chatInput.value = '';
    })
    .catch((err) => {
        console.error("Erro ao enviar mensagem:", err);
        alert("❌ Erro ao enviar mensagem: " + err.message);
    });
}

// ====================================================================
// SISTEMA DE RECADOS
// ====================================================================

// --- Carregar recados ---
function loadRecados() {
    const lista = document.getElementById("lista-recados");

    recadosUnsubscribe = db.collection("recados")
        .orderBy("timestamp", "desc")
        .onSnapshot(
            snap => {
                lista.innerHTML = "";

                snap.forEach(doc => {
                    const d = doc.data();
                    const div = document.createElement("div");
                    div.className = "recado-item";
                    div.innerHTML = `<strong>${d.nome}:</strong> ${d.mensagem}`;
                    lista.appendChild(div);
                });
            },
            error => {
                console.error("Erro ao carregar recados:", error);
                lista.innerHTML = '<p style="color:red;">❌ Erro ao carregar Recados.</p>';
            }
        );
}

// --- Enviar recado ---
document.getElementById("form-recado").onsubmit = (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value.trim();
    const msg = document.getElementById("mensagem").value.trim();

    if (!nome || !msg) {
        alert("⚠️ Preenche tudo, guri!");
        return;
    }

    db.collection("recados").add({
        nome: nome,
        mensagem: msg,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("✅ ZOEIRA ENVIADA COM SUCESSO 🔥");
        e.target.reset();
    })
    .catch((err) => {
        console.error(err);
        alert("❌ Erro: " + err.message);
    });
};

/// ====================================================================
// SISTEMA DE PERSONALIZAÇÃO DE CAMISETA
// =====================================================================

function atualizarCamiseta() {
    const nomeInput = document.getElementById('nomePersonalizado');
    const numeroInput = document.getElementById('numeroPersonalizado');
    
    // Pega o valor e limita
    let nome = (nomeInput?.value || '').toUpperCase();
    let numero = numeroInput?.value || '';
    
    // Força limite de 18 caracteres no nome
    if (nome.length > 18) {
        nome = nome.substring(0, 18);
        nomeInput.value = nome;
    }
    
    // Força apenas números e limite de 2 dígitos
    numero = numero.replace(/[^0-9]/g, ''); // Remove não-números
    if (numero.length > 2) {
        numero = numero.substring(0, 2);
    }
    numeroInput.value = numero;
    
    // Para exibição: se estiver vazio, mostra padrão (mas não força no input)
    const nomeDisplay = nome || 'SEU NOME';
    const numeroDisplay = numero || '10';
    
    // Atualiza número no peito (frente)
    const numeroFrente = document.getElementById('previewNumeroFrente');
    if (numeroFrente) {
        numeroFrente.innerText = numeroDisplay;
    }
    
    // Atualiza nome nas costas
    const nomeCostas = document.getElementById('previewNomeCostas');
    if (nomeCostas) {
        nomeCostas.innerText = nomeDisplay;
    }
    
    // Atualiza número nas costas
    const numeroCostas = document.getElementById('previewNumeroCostas');
    if (numeroCostas) {
        numeroCostas.innerText = numeroDisplay;
    }
}

// Inicializa a preview quando a página carrega
window.addEventListener('load', () => {
    atualizarCamiseta();
});

// --- Pedido via WhatsApp ---
document.getElementById('pedidoForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nome = document.getElementById('nomeCompleto').value;
    const whats = document.getElementById('whatsapp').value;
    const tam = document.getElementById('tamanho').value;
    const nomePers = (document.getElementById('nomePersonalizado').value || 'Sem').toUpperCase();
    const numPers = document.getElementById('numeroPersonalizado').value || 'Sem';

    const msg = `*PEDIDO 2º LOTE - US GURI*\n\nNome: ${nome}\nWhats: ${whats}\nTamanho: ${tam}\n\nPersonalização:\nNome: ${nomePers}\nNúmero: ${numPers}`;
    const url = `https://wa.me/5549991348038?text=${encodeURIComponent(msg)}`;
    
    window.open(url, '_blank');
    document.getElementById('mensagemSucesso').innerHTML = '✅ Pedido enviado! Abre o WhatsApp.';
    this.reset();
    setTimeout(() => document.getElementById('mensagemSucesso').innerHTML = '', 5000);
});

// ====================================================================
// SISTEMA DE GALERIA DE FOTOS
// ====================================================================

// --- Upload de foto ---
document.getElementById('upload-btn').onclick = () => {
    if (!currentUser) {
        alert("⚠️ Você precisa estar logado para fazer upload de fotos!");
        return;
    }

    const fileInput = document.getElementById('photo-file');
    const captionInput = document.getElementById('photo-caption');
    const statusText = document.getElementById('upload-status');
    const file = fileInput.files[0];
    const caption = captionInput.value.trim();

    if (!file) {
        alert("⚠️ Selecione uma foto, guri!");
        return;
    }

    statusText.textContent = "⏳ Iniciando upload...";

    const fileName = `${currentUser}_${Date.now()}_${file.name}`;
    const photoRef = storageRef.child('fotos_guris/' + fileName);

    photoRef.put(file)
        .then((snapshot) => {
            statusText.textContent = "✅ Upload concluído!";
            return snapshot.ref.getDownloadURL();
        })
        .then((downloadURL) => {
            return photosCollection.add({
                uploadedBy: currentUser.toUpperCase(),
                caption: caption,
                photoURL: downloadURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            statusText.textContent = "🎉 Foto salva na galeria!";
            fileInput.value = '';
            captionInput.value = '';
            loadGallery();
        })
        .catch((error) => {
            console.error("Erro no upload:", error);
            statusText.textContent = `❌ Erro: ${error.message}`;
        });
};

// --- Carregar galeria ---
function loadGallery() {
    const container = document.getElementById('photos-container');
    container.innerHTML = "⏳ Carregando as melhores zoeiras...";

    photosCollection.orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            container.innerHTML = '';
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const photoId = doc.id;

                const photoItem = document.createElement('div');
                photoItem.classList.add('photo-item');

                photoItem.innerHTML = `
                    <img src="${data.photoURL}" alt="${data.caption || 'Foto do Guri'}" />
                    <div class="photo-info">
                        <p class="photo-caption">${data.caption || '(Sem Legenda)'}</p>
                        <small>📸 Postado por: ${data.uploadedBy}</small>
                    </div>
                    
                    <div id="comments-${photoId}" class="comments-list"></div>

                    <div class="comment-form-area">
                        <input type="text" id="comment-input-${photoId}" placeholder="Comente aqui..." />
                        <button onclick="postComment('${photoId}')">💬 Comentar</button>
                    </div>
                `;
                container.appendChild(photoItem);

                loadComments(photoId);
            });
        })
        .catch(err => {
            console.error("Erro ao carregar galeria:", err);
            container.innerHTML = "❌ Não foi possível carregar a galeria.";
        });
}

// --- Postar comentário ---
function postComment(photoId) {
    if (!currentUser) {
        alert("⚠️ Faça login para comentar!");
        return;
    }

    const input = document.getElementById(`comment-input-${photoId}`);
    const commentText = input.value.trim();

    if (commentText === "") return;

    photosCollection.doc(photoId).collection('comments').add({
        username: currentUser.toUpperCase(),
        text: commentText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        input.value = '';
        loadComments(photoId);
    })
    .catch(err => console.error("Erro ao postar comentário:", err));
}

// --- Carregar comentários ---
function loadComments(photoId) {
    const listDiv = document.getElementById(`comments-${photoId}`);
    listDiv.innerHTML = '⏳ Carregando comentários...';

    photosCollection.doc(photoId).collection('comments')
        .orderBy('createdAt', 'asc')
        .get()
        .then(snapshot => {
            listDiv.innerHTML = '';
            
            snapshot.forEach(doc => {
                const comment = doc.data();
                const commentElement = document.createElement('p');
                commentElement.innerHTML = `<strong>${comment.username}:</strong> ${comment.text}`;
                listDiv.appendChild(commentElement);
            });
            
            if (snapshot.empty) {
                listDiv.innerHTML = '<p class="no-comments">💭 Seja o primeiro a comentar!</p>';
            }
        });
}

// ====================================================================
// FUNÇÕES UTILITÁRIAS
// ====================================================================

function getDefaultAvatar() {
    const randomIndex = Math.floor(Math.random() * AVATAR_URLS.length);
    return AVATAR_URLS[randomIndex];
}

// ====================================================================
// SISTEMA DE JOGO - DINO RUNNER
// ====================================================================

// Variáveis do Jogo
let gameCanvas, gameCtx;
let gameRunning = false;
let gameScore = 0;
let gameSpeed = 5;
let gameFrameCount = 0;
let highScore = 0;
let rankingUnsubscribe = null;

// Objeto Dinossauro
const dino = {
    x: 50,
    y: 0,
    width: 44,
    height: 47,
    jumping: false,
    velocityY: 0,
    gravity: 0.6,
    jumpPower: -13,
    groundY: 333,
    coyoteTime: 0,
    coyoteTimeMax: 8,  // Frames após deixar o chão que ainda pode pular
    jumpBuffered: false,  // Se o jogador tentou pular no ar
    jumpBufferTime: 0,    // Frames desde que tentou pular
    jumpBufferMax: 10     // Frames que o buffer de pulo dura
};

// Array de Obstáculos
let obstacles = [];

// Configurações dos Obstáculos
const obstacleConfig = {
    width: 20,
    minHeight: 40,
    maxHeight: 60,
    color: '#27ae60',
    minGap: 200,
    maxGap: 7000
};

// --- Inicializar Jogo ---
function initGame() {
    gameCanvas = document.getElementById('gameCanvas');
    gameCtx = gameCanvas.getContext('2d');

    // Ajustar dimensões do canvas para tela real
    gameCanvas.width = 800;
    gameCanvas.height = 400;

    dino.y = dino.groundY;

    // Carregar high score do localStorage
    highScore = parseInt(localStorage.getItem('guriDinoHighScore')) || 0;
    document.getElementById('high-score').textContent = highScore;
}

// --- Começar Jogo ---
function startGame() {
    // Verificar se está logado
    if (!currentUser) {
        document.getElementById('login-warning').style.display = 'block';
        setTimeout(() => {
            showPage('login');
        }, 2000);
        return;
    }

    // Esconder tela de início
    document.getElementById('game-start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';

    // Reset variáveis
    gameRunning = true;
    gameScore = 0;
    gameSpeed = 5;
    gameFrameCount = 0;
    obstacles = [];
    dino.y = dino.groundY;
    dino.velocityY = 0;
    dino.jumping = false;
    dino.coyoteTime = 0;
    dino.jumpBuffered = false;
    dino.jumpBufferTime = 0;

    // Ativar proteção anti-cheat
    enableAntiCheat();

    // Adicionar listeners de teclado e toque
    document.addEventListener('keydown', handleJump);
    gameCanvas.addEventListener('click', handleTouchJump);
    gameCanvas.addEventListener('touchstart', handleTouchJump);

    // Iniciar loop do jogo
    gameLoop();
}

// --- Reiniciar Jogo ---
function restartGame() {
    document.getElementById('game-over-screen').style.display = 'none';
    startGame();
}

// --- Pular (Teclado) ---
function handleJump(e) {
    if (!gameRunning) return;

    // Prevenir scroll da página
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
    }

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        // Coyote time: permite pular se estiver no chão ou recém saiu do chão
        if (!dino.jumping || dino.coyoteTime < dino.coyoteTimeMax) {
            dino.velocityY = dino.jumpPower;
            dino.jumping = true;
            dino.coyoteTime = dino.coyoteTimeMax;
            dino.jumpBuffered = false; // Limpa buffer ao pular
        } else {
            // Jump buffer: guarda a intenção de pular para quando tocar o chão
            dino.jumpBuffered = true;
            dino.jumpBufferTime = 0;
        }
    }
}

// --- Pular (Toque/Click) ---
function handleTouchJump(e) {
    e.preventDefault();
    if (!gameRunning) return;

    // Coyote time: permite pular se estiver no chão ou recém saiu do chão
    if (!dino.jumping || dino.coyoteTime < dino.coyoteTimeMax) {
        dino.velocityY = dino.jumpPower;
        dino.jumping = true;
        dino.coyoteTime = dino.coyoteTimeMax;
        dino.jumpBuffered = false; // Limpa buffer ao pular
    } else {
        // Jump buffer: guarda a intenção de pular para quando tocar o chão
        dino.jumpBuffered = true;
        dino.jumpBufferTime = 0;
    }
}

// --- Desenhar Nuvens ---
function drawClouds() {
    gameCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    gameCtx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    gameCtx.lineWidth = 1;

    // Nuvens que se movem lentamente
    const cloudOffset = (gameFrameCount * 0.5) % 900;

    // Nuvem 1
    let x1 = 100 - cloudOffset;
    if (x1 < -80) x1 += 900;
    drawCloud(x1, 50);

    // Nuvem 2
    let x2 = 350 - cloudOffset;
    if (x2 < -80) x2 += 900;
    drawCloud(x2, 80);

    // Nuvem 3
    let x3 = 600 - cloudOffset;
    if (x3 < -80) x3 += 900;
    drawCloud(x3, 40);
}

// --- Desenhar uma Nuvem ---
function drawCloud(x, y) {
    gameCtx.beginPath();
    gameCtx.arc(x, y, 15, 0, Math.PI * 2);
    gameCtx.arc(x + 20, y, 20, 0, Math.PI * 2);
    gameCtx.arc(x + 40, y, 15, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.stroke();
}

// --- Loop Principal do Jogo ---
function gameLoop() {
    if (!gameRunning) return;

    // Limpar canvas
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Desenhar nuvens
    drawClouds();

    // Desenhar chão
    drawGround();

    // Atualizar e desenhar dinossauro
    updateDino();
    drawDino();

    // Gerenciar obstáculos
    updateObstacles();
    drawObstacles();

    // Verificar colisões
    checkCollisions();

    // Atualizar pontuação
    gameScore++;
    const currentScore = Math.floor(gameScore / 10);
    document.getElementById('current-score').textContent = currentScore;

    // Aumentar dificuldade gradualmente (a cada 50 pontos)
    if (gameScore % 500 === 0 && gameScore > 0 && gameSpeed < 20) {
        gameSpeed += 0.5;
    }

    gameFrameCount++;

    // Continuar loop
    requestAnimationFrame(gameLoop);
}

// --- Desenhar Chão ---
function drawGround() {
    // Chão verde sólido
    gameCtx.fillStyle = '#27ae60';
    gameCtx.fillRect(0, 380, gameCanvas.width, 20);

    // Linha de contorno no topo do chão
    gameCtx.strokeStyle = '#1e7e34';
    gameCtx.lineWidth = 3;
    gameCtx.beginPath();
    gameCtx.moveTo(0, 380);
    gameCtx.lineTo(gameCanvas.width, 380);
    gameCtx.stroke();
}

// --- Atualizar Dinossauro ---
function updateDino() {
    // Aplicar gravidade
    dino.velocityY += dino.gravity;
    dino.y += dino.velocityY;

    // Incrementar tempo do jump buffer
    if (dino.jumpBuffered) {
        dino.jumpBufferTime++;
        // Expirar buffer após tempo máximo
        if (dino.jumpBufferTime > dino.jumpBufferMax) {
            dino.jumpBuffered = false;
        }
    }

    // Verificar se tocou o chão
    if (dino.y >= dino.groundY) {
        dino.y = dino.groundY;
        dino.velocityY = 0;
        dino.jumping = false;
        dino.coyoteTime = 0; // Reset coyote time no chão

        // Jump buffer: se apertou pulo antes de tocar o chão, pula agora!
        if (dino.jumpBuffered) {
            dino.velocityY = dino.jumpPower;
            dino.jumping = true;
            dino.jumpBuffered = false;
        }
    } else {
        // Incrementar coyote time quando está no ar
        if (dino.coyoteTime < dino.coyoteTimeMax) {
            dino.coyoteTime++;
        }
    }
}

// --- Desenhar Dinossauro ---
function drawDino() {
    const x = dino.x;
    const y = dino.y;

    gameCtx.fillStyle = '#f1c40f';
    gameCtx.strokeStyle = '#000';
    gameCtx.lineWidth = 2;

    // Corpo principal
    gameCtx.fillRect(x + 8, y + 20, 28, 20);
    gameCtx.strokeRect(x + 8, y + 20, 28, 20);

    // Cabeça
    gameCtx.fillRect(x + 28, y + 8, 16, 18);
    gameCtx.strokeRect(x + 28, y + 8, 16, 18);

    // Olho
    gameCtx.fillStyle = '#000';
    gameCtx.fillRect(x + 35, y + 12, 4, 4);

    // Boca
    gameCtx.strokeStyle = '#000';
    gameCtx.lineWidth = 1.5;
    gameCtx.beginPath();
    gameCtx.moveTo(x + 42, y + 20);
    gameCtx.lineTo(x + 38, y + 20);
    gameCtx.stroke();
    gameCtx.lineWidth = 2;

    gameCtx.fillStyle = '#f1c40f';

    // Cauda
    gameCtx.fillRect(x + 2, y + 24, 8, 8);
    gameCtx.strokeRect(x + 2, y + 24, 8, 8);

    // Perna traseira
    gameCtx.fillRect(x + 12, y + 40, 6, 7);
    gameCtx.strokeRect(x + 12, y + 40, 6, 7);

    // Perna dianteira (animação simples baseada no frame)
    const legOffset = dino.jumping ? 0 : Math.floor(gameFrameCount / 10) % 2 * 2;
    gameCtx.fillRect(x + 26, y + 40 + legOffset, 6, 7 - legOffset);
    gameCtx.strokeRect(x + 26, y + 40 + legOffset, 6, 7 - legOffset);
}

// --- Atualizar Obstáculos ---
function updateObstacles() {
    // Criar novo obstáculo
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < gameCanvas.width - 250) {
        const gap = Math.random() * (obstacleConfig.maxGap - obstacleConfig.minGap) + obstacleConfig.minGap;

        if (obstacles.length === 0 || gameCanvas.width - obstacles[obstacles.length - 1].x >= gap) {
            const height = Math.random() * (obstacleConfig.maxHeight - obstacleConfig.minHeight) + obstacleConfig.minHeight;
            obstacles.push({
                x: gameCanvas.width,
                y: 380 - height,
                width: obstacleConfig.width,
                height: height
            });
        }
    }

    // Mover obstáculos
    obstacles.forEach((obstacle, index) => {
        obstacle.x -= gameSpeed;

        // Remover obstáculos fora da tela
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(index, 1);
        }
    });
}

// --- Desenhar Obstáculos ---
function drawObstacles() {
    obstacles.forEach(obstacle => {
        const x = obstacle.x;
        const y = obstacle.y;
        const w = obstacle.width;
        const h = obstacle.height;

        gameCtx.fillStyle = '#27ae60';
        gameCtx.strokeStyle = '#000';
        gameCtx.lineWidth = 2;

        // Tronco principal do cacto
        gameCtx.fillRect(x + 6, y, 8, h);
        gameCtx.strokeRect(x + 6, y, 8, h);

        // Braços do cacto (variam com a altura)
        if (h > 45) {
            // Braço esquerdo
            gameCtx.fillRect(x, y + h * 0.3, 8, h * 0.35);
            gameCtx.strokeRect(x, y + h * 0.3, 8, h * 0.35);

            // Braço direito
            gameCtx.fillRect(x + 12, y + h * 0.4, 8, h * 0.4);
            gameCtx.strokeRect(x + 12, y + h * 0.4, 8, h * 0.4);
        } else {
            // Cacto pequeno - só um braço
            gameCtx.fillRect(x + 12, y + h * 0.4, 6, h * 0.5);
            gameCtx.strokeRect(x + 12, y + h * 0.4, 6, h * 0.5);
        }

        // Detalhes (espinhos) - linhas pequenas
        gameCtx.strokeStyle = '#1e7e34';
        gameCtx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const spinY = y + (h / 4) * (i + 0.5);
            gameCtx.beginPath();
            gameCtx.moveTo(x + 6, spinY);
            gameCtx.lineTo(x + 4, spinY);
            gameCtx.stroke();

            gameCtx.beginPath();
            gameCtx.moveTo(x + 14, spinY);
            gameCtx.lineTo(x + 16, spinY);
            gameCtx.stroke();
        }
    });
}

// --- Verificar Colisões ---
function checkCollisions() {
    obstacles.forEach(obstacle => {
        // Hitbox do dinossauro (ajustada para o corpo principal)
        const dinoLeft = dino.x + 8;
        const dinoRight = dino.x + 38;
        const dinoTop = dino.y + 8;
        const dinoBottom = dino.y + dino.height;

        // Hitbox do cacto (tronco principal + braços)
        const cactusLeft = obstacle.x;
        const cactusRight = obstacle.x + obstacle.width;
        const cactusTop = obstacle.y;
        const cactusBottom = obstacle.y + obstacle.height;

        // Detecção de colisão com margem reduzida (mais perdoador)
        if (
            dinoRight > cactusLeft + 5 &&
            dinoLeft < cactusRight - 5 &&
            dinoBottom > cactusTop + 5 &&
            dinoTop < cactusBottom
        ) {
            gameOver();
        }
    });
}

// --- Game Over ---
function gameOver() {
    gameRunning = false;
    document.removeEventListener('keydown', handleJump);
    gameCanvas.removeEventListener('click', handleTouchJump);
    gameCanvas.removeEventListener('touchstart', handleTouchJump);

    // Desativar proteção anti-cheat
    disableAntiCheat();

    const finalScore = Math.floor(gameScore / 10);
    document.getElementById('final-score').textContent = finalScore;

    // Atualizar high score local
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem('guriDinoHighScore', highScore);
        document.getElementById('high-score').textContent = highScore;
    }

    // Salvar pontuação no Firestore
    saveScore(finalScore);

    // Mostrar tela de game over
    document.getElementById('game-over-screen').style.display = 'block';
}

// ====================================================================
// SISTEMA ANTI-CHEAT
// ====================================================================

// Armazena os métodos originais do console
let originalConsole = {};
let antiCheatActive = false;

// --- Ativar Proteção Anti-Cheat ---
function enableAntiCheat() {
    if (antiCheatActive) return;
    antiCheatActive = true;

    // Salvar métodos originais do console
    originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };

    // Desabilitar console durante o jogo
    console.log = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.info = function() {};
    console.debug = function() {};

    // Detectar DevTools apenas no desktop (mobile tem falsos positivos)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
        const detectDevTools = () => {
            const threshold = 160;
            if (window.outerWidth - window.innerWidth > threshold ||
                window.outerHeight - window.innerHeight > threshold) {
                if (gameRunning) {
                    gameOver();
                    alert('⚠️ DevTools detectado! Jogo encerrado para manter a integridade do ranking.');
                }
            }
        };
        // Verificar a cada 1 segundo
        window.antiCheatInterval = setInterval(detectDevTools, 1000);
    }
}

// --- Desativar Proteção Anti-Cheat ---
function disableAntiCheat() {
    if (!antiCheatActive) return;
    antiCheatActive = false;

    // Restaurar console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;

    // Limpar intervalo de detecção
    if (window.antiCheatInterval) {
        clearInterval(window.antiCheatInterval);
        window.antiCheatInterval = null;
    }
}

// --- Salvar Pontuação no Firestore ---
function saveScore(score) {
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = '⏳ Salvando pontuação...';
    saveStatus.style.color = '#f1c40f';

    if (!currentUser) {
        saveStatus.textContent = '❌ Não logado - pontuação não salva';
        saveStatus.style.color = '#ff0000';
        return;
    }

    // Verificar se já existe um recorde do usuário
    db.collection("dino_scores").doc(currentUser).get()
        .then(doc => {
            if (doc.exists) {
                const currentHighScore = doc.data().score;

                // Só atualiza se for um novo recorde
                if (score > currentHighScore) {
                    return db.collection("dino_scores").doc(currentUser).update({
                        score: score,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    saveStatus.textContent = `✅ Pontuação salva! Seu recorde é ${currentHighScore}`;
                    saveStatus.style.color = '#27ae60';
                    return Promise.resolve();
                }
            } else {
                // Primeiro jogo do usuário
                return db.collection("dino_scores").doc(currentUser).set({
                    username: currentUser.toUpperCase(),
                    score: score,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .then(() => {
            saveStatus.textContent = '🎉 Novo recorde salvo!';
            saveStatus.style.color = '#27ae60';
            loadRanking();
        })
        .catch(err => {
            console.error('Erro ao salvar pontuação:', err);
            saveStatus.textContent = '❌ Erro ao salvar: ' + err.message;
            saveStatus.style.color = '#ff0000';
        });
}

// --- Carregar Ranking ---
function loadRanking() {
    const rankingList = document.getElementById('ranking-list');

    rankingUnsubscribe = db.collection("dino_scores")
        .orderBy("score", "desc")
        .limit(10)
        .onSnapshot(
            snapshot => {
                rankingList.innerHTML = '';

                if (snapshot.empty) {
                    rankingList.innerHTML = '<p class="loading-text">Nenhuma pontuação ainda. Seja o primeiro!</p>';
                    return;
                }

                let position = 0;
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    position++;

                    const rankingItem = document.createElement('div');
                    rankingItem.classList.add('ranking-item');

                    // Adicionar classe especial para top 3
                    if (position === 1) rankingItem.classList.add('top-1');
                    if (position === 2) rankingItem.classList.add('top-2');
                    if (position === 3) rankingItem.classList.add('top-3');

                    // Emoji de medalha
                    let medal = '';
                    if (position === 1) {
                        medal = '🥇';
                    } else if (position === 2) {
                        medal = '🥈';
                    } else if (position === 3) {
                        medal = '🥉';
                    } else {
                        medal = position + 'º';
                    }

                    const playerName = data.username || 'Anônimo';
                    const playerScore = data.score || 0;

                    rankingItem.innerHTML = `
                        <span class="ranking-position">${medal}</span>
                        <span class="ranking-player">${playerName}</span>
                        <span class="ranking-score">${playerScore}</span>
                    `;

                    rankingList.appendChild(rankingItem);
                });
            },
            error => {
                console.error('Erro ao carregar ranking:', error);
                rankingList.innerHTML = '<p style="color: red;">❌ Erro ao carregar ranking</p>';
            }
        );
}

// ====================================================================
// SISTEMA DE JOGO - SNAKE
// ====================================================================

// Variáveis do Snake
let snakeCanvas, snakeCtx;
let snakeRunning = false;
let snakeScore = 0;
let snakeSpeed = 150; // ms entre movimentos
let snakeHighScore = 0;
let snakeRankingUnsubscribe = null;
let snakeGameLoop = null;
let snakeAntiCheatInterval = null;
let snakeAntiCheatActive = false;
let snakeOriginalConsole = {};

// Grid
const gridSize = 20;
const tileCount = 20;

// Snake
let snake = [];
let snakeLength = 3;
let headX = 10;
let headY = 10;
let velocityX = 0;
let velocityY = 0;

// Comida
let foodX = 15;
let foodY = 15;

// Controles touch
let touchStartX = 0;
let touchStartY = 0;

// --- Inicializar Snake ---
function initSnakeGame() {
    snakeCanvas = document.getElementById('snakeCanvas');
    snakeCtx = snakeCanvas.getContext('2d');

    // Ajustar dimensões
    snakeCanvas.width = 400;
    snakeCanvas.height = 400;

    // Carregar high score
    snakeHighScore = parseInt(localStorage.getItem('guriSnakeHighScore')) || 0;
    document.getElementById('snake-high-score').textContent = snakeHighScore;
}

// --- Começar Jogo Snake ---
function startSnakeGame() {
    // Verificar login
    if (!currentUser) {
        document.getElementById('snake-login-warning').style.display = 'block';
        setTimeout(() => {
            showPage('login');
        }, 2000);
        return;
    }

    // Esconder telas
    document.getElementById('snake-start-screen').style.display = 'none';
    document.getElementById('snake-game-over-screen').style.display = 'none';

    // Reset variáveis
    snakeRunning = true;
    snakeScore = 0;
    snakeLength = 3;
    snake = [];
    headX = 10;
    headY = 10;
    velocityX = 1;
    velocityY = 0;
    snakeSpeed = 150;

    // Posicionar comida
    placeFood();

    // Ativar anti-cheat
    enableSnakeAntiCheat();

    // Listeners
    document.addEventListener('keydown', handleSnakeKeyPress);
    snakeCanvas.addEventListener('touchstart', handleSnakeTouchStart);
    snakeCanvas.addEventListener('touchend', handleSnakeTouchEnd);

    // Atualizar UI
    document.getElementById('snake-current-score').textContent = snakeScore;
    document.getElementById('snake-current-length').textContent = snakeLength;

    // Iniciar loop
    snakeGameLoop = setInterval(updateSnakeGame, snakeSpeed);
}

// --- Reiniciar Snake ---
function restartSnakeGame() {
    document.getElementById('snake-game-over-screen').style.display = 'none';
    startSnakeGame();
}

// --- Controles Teclado ---
function handleSnakeKeyPress(e) {
    if (!snakeRunning) return;

    // Prevenir scroll
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }

    // Mudar direção (não pode ir na direção oposta)
    if (e.code === 'ArrowUp' && velocityY !== 1) {
        velocityX = 0;
        velocityY = -1;
    }
    if (e.code === 'ArrowDown' && velocityY !== -1) {
        velocityX = 0;
        velocityY = 1;
    }
    if (e.code === 'ArrowLeft' && velocityX !== 1) {
        velocityX = -1;
        velocityY = 0;
    }
    if (e.code === 'ArrowRight' && velocityX !== -1) {
        velocityX = 1;
        velocityY = 0;
    }
}

// --- Controles Touch ---
function handleSnakeTouchStart(e) {
    e.preventDefault();
    if (!snakeRunning) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}

function handleSnakeTouchEnd(e) {
    e.preventDefault();
    if (!snakeRunning) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Determinar direção baseado no maior deslocamento
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Movimento horizontal
        if (diffX > 0 && velocityX !== -1) {
            velocityX = 1;
            velocityY = 0;
        } else if (diffX < 0 && velocityX !== 1) {
            velocityX = -1;
            velocityY = 0;
        }
    } else {
        // Movimento vertical
        if (diffY > 0 && velocityY !== -1) {
            velocityX = 0;
            velocityY = 1;
        } else if (diffY < 0 && velocityY !== 1) {
            velocityX = 0;
            velocityY = -1;
        }
    }
}

// --- Controle por Botões (D-pad Mobile) ---
function snakeChangeDirection(direction) {
    if (!snakeRunning) return;

    switch (direction) {
        case 'up':
            if (velocityY !== 1) {
                velocityX = 0;
                velocityY = -1;
            }
            break;
        case 'down':
            if (velocityY !== -1) {
                velocityX = 0;
                velocityY = 1;
            }
            break;
        case 'left':
            if (velocityX !== 1) {
                velocityX = -1;
                velocityY = 0;
            }
            break;
        case 'right':
            if (velocityX !== -1) {
                velocityX = 1;
                velocityY = 0;
            }
            break;
    }
}

// --- Loop Principal ---
function updateSnakeGame() {
    if (!snakeRunning) return;

    // Mover cobra
    headX += velocityX;
    headY += velocityY;

    // Colisão com paredes
    if (headX < 0 || headX >= tileCount || headY < 0 || headY >= tileCount) {
        snakeGameOver();
        return;
    }

    // Colisão com próprio corpo
    for (let i = 0; i < snake.length; i++) {
        if (snake[i].x === headX && snake[i].y === headY) {
            snakeGameOver();
            return;
        }
    }

    // Adicionar nova posição da cabeça
    snake.push({ x: headX, y: headY });

    // Remover cauda se não comeu
    while (snake.length > snakeLength) {
        snake.shift();
    }

    // Verificar se comeu
    if (headX === foodX && headY === foodY) {
        snakeLength++;
        snakeScore += 10;
        document.getElementById('snake-current-score').textContent = snakeScore;
        document.getElementById('snake-current-length').textContent = snakeLength;
        placeFood();

        // Aumentar velocidade a cada 5 comidas
        if (snakeLength % 5 === 0 && snakeSpeed > 50) {
            snakeSpeed -= 10;
            clearInterval(snakeGameLoop);
            snakeGameLoop = setInterval(updateSnakeGame, snakeSpeed);
        }
    }

    // Desenhar tudo
    drawSnakeGame();
}

// --- Desenhar Jogo ---
function drawSnakeGame() {
    // Fundo
    snakeCtx.fillStyle = '#1a1a1a';
    snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);

    // Grid
    snakeCtx.strokeStyle = '#2a2a2a';
    snakeCtx.lineWidth = 1;
    for (let i = 0; i <= tileCount; i++) {
        snakeCtx.beginPath();
        snakeCtx.moveTo(i * gridSize, 0);
        snakeCtx.lineTo(i * gridSize, snakeCanvas.height);
        snakeCtx.stroke();

        snakeCtx.beginPath();
        snakeCtx.moveTo(0, i * gridSize);
        snakeCtx.lineTo(snakeCanvas.width, i * gridSize);
        snakeCtx.stroke();
    }

    // Comida
    snakeCtx.fillStyle = '#e74c3c';
    snakeCtx.shadowBlur = 10;
    snakeCtx.shadowColor = '#e74c3c';
    snakeCtx.fillRect(foodX * gridSize, foodY * gridSize, gridSize - 2, gridSize - 2);
    snakeCtx.shadowBlur = 0;

    // Cobra
    for (let i = 0; i < snake.length; i++) {
        if (i === snake.length - 1) {
            // Cabeça
            snakeCtx.fillStyle = '#2ecc71';
            snakeCtx.shadowBlur = 10;
            snakeCtx.shadowColor = '#2ecc71';
        } else {
            // Corpo
            const gradient = snakeCtx.createLinearGradient(
                snake[i].x * gridSize,
                snake[i].y * gridSize,
                snake[i].x * gridSize + gridSize,
                snake[i].y * gridSize + gridSize
            );
            gradient.addColorStop(0, '#27ae60');
            gradient.addColorStop(1, '#229954');
            snakeCtx.fillStyle = gradient;
            snakeCtx.shadowBlur = 5;
            snakeCtx.shadowColor = '#27ae60';
        }

        snakeCtx.fillRect(
            snake[i].x * gridSize + 1,
            snake[i].y * gridSize + 1,
            gridSize - 3,
            gridSize - 3
        );
    }
    snakeCtx.shadowBlur = 0;

    // Olhos da cobra (na cabeça)
    if (snake.length > 0) {
        const head = snake[snake.length - 1];
        snakeCtx.fillStyle = '#000';

        if (velocityX === 1) {
            // Olhando para direita
            snakeCtx.fillRect(head.x * gridSize + 13, head.y * gridSize + 4, 3, 3);
            snakeCtx.fillRect(head.x * gridSize + 13, head.y * gridSize + 11, 3, 3);
        } else if (velocityX === -1) {
            // Olhando para esquerda
            snakeCtx.fillRect(head.x * gridSize + 3, head.y * gridSize + 4, 3, 3);
            snakeCtx.fillRect(head.x * gridSize + 3, head.y * gridSize + 11, 3, 3);
        } else if (velocityY === 1) {
            // Olhando para baixo
            snakeCtx.fillRect(head.x * gridSize + 4, head.y * gridSize + 13, 3, 3);
            snakeCtx.fillRect(head.x * gridSize + 11, head.y * gridSize + 13, 3, 3);
        } else if (velocityY === -1) {
            // Olhando para cima
            snakeCtx.fillRect(head.x * gridSize + 4, head.y * gridSize + 3, 3, 3);
            snakeCtx.fillRect(head.x * gridSize + 11, head.y * gridSize + 3, 3, 3);
        }
    }
}

// --- Posicionar Comida ---
function placeFood() {
    let validPosition = false;

    while (!validPosition) {
        foodX = Math.floor(Math.random() * tileCount);
        foodY = Math.floor(Math.random() * tileCount);

        // Verificar se não está em cima da cobra
        validPosition = true;
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === foodX && snake[i].y === foodY) {
                validPosition = false;
                break;
            }
        }
    }
}

// --- Game Over ---
function snakeGameOver() {
    snakeRunning = false;
    clearInterval(snakeGameLoop);

    document.removeEventListener('keydown', handleSnakeKeyPress);
    snakeCanvas.removeEventListener('touchstart', handleSnakeTouchStart);
    snakeCanvas.removeEventListener('touchend', handleSnakeTouchEnd);

    // Desativar anti-cheat
    disableSnakeAntiCheat();

    document.getElementById('snake-final-score').textContent = snakeScore;
    document.getElementById('snake-final-length').textContent = snakeLength;

    // Atualizar high score
    if (snakeScore > snakeHighScore) {
        snakeHighScore = snakeScore;
        localStorage.setItem('guriSnakeHighScore', snakeHighScore);
        document.getElementById('snake-high-score').textContent = snakeHighScore;
    }

    // Salvar pontuação
    saveSnakeScore(snakeScore);

    // Mostrar game over
    document.getElementById('snake-game-over-screen').style.display = 'block';
}

// --- Salvar Pontuação ---
function saveSnakeScore(score) {
    const saveStatus = document.getElementById('snake-save-status');
    saveStatus.textContent = '⏳ Salvando pontuação...';
    saveStatus.style.color = '#f1c40f';

    if (!currentUser) {
        saveStatus.textContent = '❌ Não logado - pontuação não salva';
        saveStatus.style.color = '#ff0000';
        return;
    }

    db.collection("snake_scores").doc(currentUser).get()
        .then(doc => {
            if (doc.exists) {
                const currentHighScore = doc.data().score;

                if (score > currentHighScore) {
                    return db.collection("snake_scores").doc(currentUser).update({
                        score: score,
                        length: snakeLength,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    saveStatus.textContent = `✅ Pontuação salva! Seu recorde é ${currentHighScore}`;
                    saveStatus.style.color = '#27ae60';
                    return Promise.resolve();
                }
            } else {
                return db.collection("snake_scores").doc(currentUser).set({
                    username: currentUser.toUpperCase(),
                    score: score,
                    length: snakeLength,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .then(() => {
            saveStatus.textContent = '🎉 Novo recorde salvo!';
            saveStatus.style.color = '#27ae60';
            loadSnakeRanking();
        })
        .catch(err => {
            console.error('Erro ao salvar pontuação:', err);
            saveStatus.textContent = '❌ Erro ao salvar: ' + err.message;
            saveStatus.style.color = '#ff0000';
        });
}

// --- Carregar Ranking ---
function loadSnakeRanking() {
    const rankingList = document.getElementById('snake-ranking-list');

    snakeRankingUnsubscribe = db.collection("snake_scores")
        .orderBy("score", "desc")
        .limit(10)
        .onSnapshot(
            snapshot => {
                rankingList.innerHTML = '';

                if (snapshot.empty) {
                    rankingList.innerHTML = '<p class="loading-text">Nenhuma pontuação ainda. Seja o primeiro!</p>';
                    return;
                }

                let position = 0;
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    position++;

                    const rankingItem = document.createElement('div');
                    rankingItem.classList.add('ranking-item');

                    if (position === 1) rankingItem.classList.add('top-1');
                    if (position === 2) rankingItem.classList.add('top-2');
                    if (position === 3) rankingItem.classList.add('top-3');

                    let medal = '';
                    if (position === 1) medal = '🥇';
                    else if (position === 2) medal = '🥈';
                    else if (position === 3) medal = '🥉';
                    else medal = position + 'º';

                    const playerName = data.username || 'Anônimo';
                    const playerScore = data.score || 0;

                    rankingItem.innerHTML = `
                        <span class="ranking-position">${medal}</span>
                        <span class="ranking-player">${playerName}</span>
                        <span class="ranking-score">${playerScore}</span>
                    `;

                    rankingList.appendChild(rankingItem);
                });
            },
            error => {
                console.error('Erro ao carregar ranking:', error);
                rankingList.innerHTML = '<p style="color: red;">❌ Erro ao carregar ranking</p>';
            }
        );
}

// --- Anti-Cheat Snake ---
function enableSnakeAntiCheat() {
    if (snakeAntiCheatActive) return;
    snakeAntiCheatActive = true;

    snakeOriginalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };

    console.log = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.info = function() {};
    console.debug = function() {};

    // Detectar DevTools apenas no desktop (mobile tem falsos positivos)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
        const detectDevTools = () => {
            const threshold = 160;
            if (window.outerWidth - window.innerWidth > threshold ||
                window.outerHeight - window.innerHeight > threshold) {
                if (snakeRunning) {
                    snakeGameOver();
                    alert('⚠️ DevTools detectado! Jogo encerrado para manter a integridade do ranking.');
                }
            }
        };
        snakeAntiCheatInterval = setInterval(detectDevTools, 1000);
    }
}

function disableSnakeAntiCheat() {
    if (!snakeAntiCheatActive) return;
    snakeAntiCheatActive = false;

    console.log = snakeOriginalConsole.log;
    console.warn = snakeOriginalConsole.warn;
    console.error = snakeOriginalConsole.error;
    console.info = snakeOriginalConsole.info;
    console.debug = snakeOriginalConsole.debug;

    if (snakeAntiCheatInterval) {
        clearInterval(snakeAntiCheatInterval);
        snakeAntiCheatInterval = null;
    }
}

// ====================================================================
// INICIALIZAÇÃO QUANDO A PÁGINA CARREGAR
// ====================================================================

window.addEventListener('load', () => {
    // Verifica se há usuário salvo na sessão
    const savedUsername = localStorage.getItem('guriUsername');
    if (savedUsername) {
        currentUser = savedUsername;
        updateAuthUI();
    }

    // Menu mobile toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', function() {
        document.getElementById('navMenu').classList.toggle('active');
    });

    // Dropdown toggle para mobile
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        if (toggle) {
            toggle.addEventListener('click', function(e) {
                // Só funciona em mobile
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    dropdown.classList.toggle('active');
                }
            });
        }
    });

    // Listener para enviar mensagem com Enter no chat
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !chatInput.disabled) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    // Prevenir scroll global quando teclas de jogo são pressionadas
    window.addEventListener('keydown', (e) => {
        if (gameRunning && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
            e.preventDefault();
        }
        if (snakeRunning && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    });

    console.log('🎉 US GURI DA UNOESC - Sistema carregado com sucesso!');
});