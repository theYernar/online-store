function openAddProductModal() {
    document.getElementById('product-modal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

function openSelectProductModal(){
    document.getElementById('product-box').style.display ='flex';
}

function openModal(imageUrl, productName, productPrice) {
    document.getElementById('modal-image').src = imageUrl;
    document.getElementById('modal-title').innerText = productName;
    document.getElementById('modal-price').innerText = productPrice;
    
    document.getElementById('product-modal').style.display = 'flex';
}


let currentImageIndex = 0;
let productImages = []; 
let cart = [];

function openModal(images, productName, productPrice) {
    productImages = images.split(',');
    currentImageIndex = productImages.length - 1; 

    document.getElementById('modal-image').src = productImages[currentImageIndex];
    document.getElementById('modal-title').innerText = productName;
    document.getElementById('modal-price').innerText = productPrice;

    document.getElementById('product-modal').style.display = 'flex';

    toggleButtonsVisibility();
}

function prevImage() {
    if (currentImageIndex < productImages.length - 1) {
        currentImageIndex++;
        document.getElementById('modal-image').src = productImages[currentImageIndex];
    }
    toggleButtonsVisibility();
}

function nextImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        document.getElementById('modal-image').src = productImages[currentImageIndex];
    }
    toggleButtonsVisibility();
}

function toggleButtonsVisibility() {
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');

    prevBtn.style.display = (currentImageIndex === productImages.length - 1) ? 'none' : 'block';
    nextBtn.style.display = (currentImageIndex === 0) ? 'none' : 'block';
}

function addToCart() {
    const productName = document.getElementById('modal-title').innerText;
    const productPrice = document.getElementById('modal-price').innerText;
    const productImage = productImages[currentImageIndex];

    const product = {
        name: productName,
        price: productPrice,
        image: productImage
    };

    cart.push(product);

    updateCartDisplay();

    closeProductModal();
}

function updateCartDisplay() {
    const cartList = document.getElementById('cart-list');
    const cartTotal = document.getElementById('cart-total');
    cartList.innerHTML = '';

    let total = 0;

    cart.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <img src="${item.image}" width="50px" alt="${item.name}"> 
            ${item.name} - ${item.price} 
            <button class="remove-btn" onclick="removeFromCart(${index})"><img src="icons/delete.png" alt="delete" class="delete-btn-icon"></button>
        `;
        cartList.appendChild(listItem);

        total += parseFloat(item.price.replace(/\D/g, ''));
    });

    cartTotal.innerText = `Общая сумма: ${total} ₸`;
}

function getChatIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('chatId');
}

const chatId = getChatIdFromUrl();

function sendCartToTelegram() {
    let total = 0;

    cart.forEach(item => {
        total += parseFloat(item.price.replace(/\D/g, ''));
    });

    fetch('/send-cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cart, chatId, total })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Корзина успешно отправлена в Telegram!');
            window.close();
        } else {
            alert('Ошибка при отправке корзины.');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
    });
}


function showLoadingSpinner() {
    document.getElementById('loading-spinner').style.display = 'block';
    document.getElementById('submit-btn').disabled = true;
}


function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay(); 
}
