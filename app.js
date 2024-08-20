const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const client = new Client();

const sessions = {};
const prices = {
    lanches: { 'X-Tudo': 20, 'X-Salada': 15, 'X-Ratoso': 18 },
    salgados: { 'Coxinha': 5, 'Kibe': 6, 'Enroladinho': 5 },
    bebidas: { 'Coca-Cola': 7, 'Guaraná': 6, 'Água': 3 }
};
const customizationOptions = {
    lanches: ['Adicional de queijo', 'Sem cebola', 'Pão integral'],
    salgados: ['Com molho picante', 'Sem tempero', 'Adicional de queijo'],
    bebidas: ['Sem gelo', 'Com limão', 'Mais gelo']
};

const sendMessage = async (userId, message) => {
    try {
        await client.sendMessage(userId, message);
    } catch (error) {
        console.error(`Error sending message to ${userId}:`, error);
    }
};

const getCategoryMessage = (category) => {
    const messages = {
        lanches: `Você escolheu Lanches. Escolha um item:\n1. X-Tudo\n2. X-Salada\n3. X-Ratoso`,
        salgados: `Você escolheu Salgados. Escolha um item:\n1. Coxinha\n2. Kibe\n3. Enroladinho`,
        bebidas: `Você escolheu Bebidas. Escolha uma bebida:\n1. Coca-Cola\n2. Guaraná\n3. Água`
    };
    return messages[category] || `Categoria inválida. Por favor, escolha novamente.`;
};

const getItem = (category, index) => {
    const items = {
        lanches: ['X-Tudo', 'X-Salada', 'X-Ratoso'],
        salgados: ['Coxinha', 'Kibe', 'Enroladinho'],
        bebidas: ['Coca-Cola', 'Guaraná', 'Água']
    };
    return items[category]?.[index - 1];
};

const getCustomizationOptions = (category) => {
    return customizationOptions[category]?.join('\n') || 'Nenhuma opção de personalização disponível.';
};

const getPaymentMessage = () => `Como deseja pagar?\n1. Cartão de Crédito\n2. Pix\n3. Dinheiro`;

const getPaymentMethod = (index) => {
    const payments = ['Cartão de Crédito', 'Pix', 'Dinheiro'];
    return payments[index - 1];
};

const finalizeOrder = (userSession) => {
    const totalPrice = userSession.itemPrice * userSession.itemQuantity;
    return `Obrigado, ${userSession.name}! Seu pedido foi registrado:\n- Item: ${userSession.item}\n- Quantidade: ${userSession.itemQuantity}\n- Personalização: ${userSession.customization || 'Nenhuma'}\n- Pagamento: ${userSession.paymentMethod}\n- Endereço: ${userSession.address}\n- Total: R$${totalPrice}\n\nSeu pedido está a caminho!`;
};

const reviewOrderMessage = (userSession) => {
    const totalPrice = userSession.itemPrice * userSession.itemQuantity;
    return `Você selecionou o seguinte pedido:\n- Nome: ${userSession.name}\n- Item: ${userSession.item}\n- Quantidade: ${userSession.itemQuantity}\n- Personalização: ${userSession.customization || 'Nenhuma'}\n- Pagamento: ${userSession.paymentMethod}\n- Endereço: ${userSession.address}\n- Total: R$${totalPrice}\n\nConfirma este pedido?\n1. Sim\n2. Não`;
};

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async message => {
    const userId = message.from;
    const text = message.body.trim().toLowerCase();

    if (!sessions[userId]) {
        sessions[userId] = { step: 'greeting' };
    }

    const userSession = sessions[userId];

    if (text === 'oi' && userSession.step === 'completed') {
        userSession.step = 'greeting';
    }

    switch (userSession.step) {
        case 'greeting':
            await sendMessage(userId, `Olá! Eu sou o assistente Virtual Jc. Qual o seu nome?`);
            userSession.step = 'get-name';
            break;

        case 'get-name':
            userSession.name = message.body;
            await sendMessage(userId, `Obrigado, ${userSession.name}! Escolha o assunto:\n1. Lanches\n2. Salgados\n3. Bebidas`);
            userSession.step = 'choose-category';
            break;

        case 'choose-category':
            if (['1', '2', '3'].includes(text)) {
                const categories = ['lanches', 'salgados', 'bebidas'];
                userSession.category = categories[text - 1];
                await sendMessage(userId, getCategoryMessage(userSession.category));
                userSession.step = 'choose-item';
            } else {
                await sendMessage(userId, `Opção inválida. Escolha entre 1, 2 ou 3.`);
            }
            break;

        case 'choose-item':
            const item = getItem(userSession.category, parseInt(text));
            if (item) {
                userSession.item = item;
                userSession.itemPrice = prices[userSession.category][item];
                await sendMessage(userId, `Você escolheu ${item}. Quantas unidades deseja?`);
                userSession.step = 'choose-quantity';
            } else {
                await sendMessage(userId, `Opção inválida. Escolha uma opção válida.`);
            }
            break;

        case 'choose-quantity':
            const quantity = parseInt(text);
            if (quantity > 0) {
                userSession.itemQuantity = quantity;
                await sendMessage(userId, `Deseja personalizar seu item? Se sim, escolha uma opção:\n${getCustomizationOptions(userSession.category)}\nOu digite "não" para continuar.`);
                userSession.step = 'choose-customization';
            } else {
                await sendMessage(userId, `Quantidade inválida. Informe uma quantidade válida.`);
            }
            break;

        case 'choose-customization':
            if (text === 'não') {
                userSession.customization = 'Nenhuma';
                await sendMessage(userId, `Informe seu endereço para entrega.`);
                userSession.step = 'get-address';
            } else if (customizationOptions[userSession.category]?.includes(text)) {
                userSession.customization = text;
                await sendMessage(userId, `Personalização adicionada. Informe seu endereço para entrega.`);
                userSession.step = 'get-address';
            } else {
                await sendMessage(userId, `Opção de personalização inválida. Escolha uma opção válida ou digite "não" para continuar.`);
            }
            break;

        case 'get-address':
            userSession.address = message.body;
            await sendMessage(userId, reviewOrderMessage(userSession));
            userSession.step = 'review-order';
            break;

        case 'review-order':
            if (text === '1') {
                await sendMessage(userId, getPaymentMessage());
                userSession.step = 'choose-payment';
            } else if (text === '2') {
                await sendMessage(userId, `Pedido cancelado. Deseja fazer um novo pedido ou adicionar mais itens? Digite "novo" para um novo pedido ou "adicionar" para adicionar mais itens.`);
                userSession.step = 'post-review';
            } else {
                await sendMessage(userId, `Opção inválida. Escolha 1 para confirmar ou 2 para cancelar.`);
            }
            break;

        case 'post-review':
            if (text === 'novo') {
                userSession.step = 'greeting';
                await sendMessage(userId, `Iniciando um novo pedido. Envie seu nome para começar.`);
            } else if (text === 'adicionar') {
                userSession.step = 'choose-category';
                await sendMessage(userId, `Você pode adicionar mais itens. Escolha uma categoria:\n1. Lanches\n2. Salgados\n3. Bebidas`);
            } else {
                await sendMessage(userId, `Opção inválida. Digite "novo" para iniciar um novo pedido ou "adicionar" para adicionar mais itens.`);
            }
            break;

        case 'choose-payment':
            const paymentMethod = getPaymentMethod(parseInt(text));
            if (paymentMethod) {
                userSession.paymentMethod = paymentMethod;
                // Aqui você pode implementar a lógica de processamento de pagamento
                await sendMessage(userId, finalizeOrder(userSession));
                await sendMessage('restaurante', finalizeOrder(userSession)); // Enviar pedido para o restaurante
                await sendMessage(userId, `O tempo estimado para entrega é de 30 minutos.`);
                userSession.step = 'completed';
            } else {
                await sendMessage(userId, `Opção inválida. Escolha uma forma de pagamento válida.`);
            }
            break;

        case 'completed':
            await sendMessage(userId, `Você já concluiu um pedido. Envie "oi" para começar novamente.`);
            break;

        default:
            await sendMessage(userId, `Desculpe, ocorreu um erro. Envie "oi" para reiniciar.`);
            userSession.step = 'greeting';
            break;
    }
});

client.initialize();
