const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const port = 8888;

// Инициализация базы данных
const db = new sqlite3.Database('./onlineShopDB.sqlite', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

// Создание таблицы при запуске
db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    images TEXT
  )
`);

// Настройки multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage }).array('images');

// Настройки для EJS
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Для обработки JSON
app.use(express.static('public'));

// Главная страница
app.get('/', (req, res) => {
  db.all('SELECT * FROM products', [], (err, products) => {
    if (err) throw err;
    res.render('index', { products });
  });
});


app.get('/users', (req, res) => {
  db.all('SELECT * FROM products', [], (err, products) => {
    if (err) throw err;
    res.render('index-for-users', { products });
  });
});

// Добавление товара
app.post('/add-product', (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) return res.status(500).json({ message: 'Ошибка загрузки файлов' });
    if (err) return res.status(500).json({ message: 'Неизвестная ошибка' });

    const { name, price } = req.body;
    const images = req.files.map(file => `/uploads/${file.filename}`).join(',');

    const query = `INSERT INTO products (name, price, images) VALUES (?, ?, ?)`;
    db.run(query, [name, price, images], (err) => {
      if (err) return console.error(err.message);
      res.redirect('/');
    });
  });
});

// Удаление товара
app.post('/delete-product/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', id, (err) => {
    if (err) return console.error(err.message);
    res.redirect('/');
  });
});

// Telegram Bot
const TOKEN = process.env.KEY;
const URL = process.env.URL_FOR_USERS;
const URL_ADMINS = process.env.URL_FOR_ADMINS;
const bot = new TelegramBot(TOKEN, { polling: true });
const adminIds = process.env.ADMIN_IDS.split(',').map(id => id.trim());

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  // Передаем chatId через URL веб-приложения
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: 'Добавить товар',
          web_app: { url: `${URL_ADMINS}?chatId=${chatId}` }
        },
        {
          text: 'Открыть Магазин',
          web_app: { url: `${URL}?chatId=${chatId}` }
        }
      ]
    ]
  };

  const keyboardForUsers = {
    inline_keyboard: [
      [
        {
          text: 'Открыть Магазин',
          web_app: { url: `${URL}?chatId=${chatId}` }
        }
      ]
    ]
  };

  const userId = msg.from.id;

  if (adminIds.includes(userId.toString())) {
    bot.sendMessage(chatId, 'Добро пожаловать admin!', {
      reply_markup: keyboard
    });
  } else {
    bot.sendMessage(chatId, 'Добро пожаловать в наш магазин! 🤗', {
      reply_markup: keyboardForUsers
    });
  }

});


app.post('/send-cart', async (req, res) => {
  const cart = req.body.cart;
  const chatId = req.body.chatId;
  const total = req.body.total;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: 'Подтвердить заказ',
          callback_data: 'confirm_order'  // Добавляем callback для подтверждения
        },
        {
          text: 'Отменить заказ',
          callback_data: 'cancel_order'  // Добавляем callback для отмены
        },
      ]
    ]
  };

  if (!cart || cart.length === 0) {
    return res.status(400).json({ success: false, message: 'Корзина пуста' });
  }

  const cartMessage = cart.map(item => `${item.name} - ${item.price}`).join('\n');
  const totalMessage = `Общая сумма: ${total} ₸`;

  try {
    // Отправляем сообщение с товарами и общей суммой
    await bot.sendMessage(chatId, `Ваш заказ:\n${cartMessage}\n\n${totalMessage}`, {
      reply_markup: keyboard
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при отправке сообщения в Telegram:', error.response?.body || error);
    res.json({ success: false, message: 'Ошибка при отправке сообщения в Telegram' });
  }
});



// Обработчик inline-кнопок
bot.on('callback_query', async (query) => {
  const { data, message } = query;
  const chatId = message.chat.id;

  if (data === 'confirm_order') {
    // Если заказ подтвержден, отправляем данные в группу
    const cartMessage = message.text.split('\n').slice(1, -2).join('\n'); // Извлекаем данные корзины из текста
    const totalMessage = message.text.split('\n').slice(-2).join('\n');   // Извлекаем общую сумму

    // Отправляем данные в группу
    try {
      const groupChatId = process.env.GROUP_CHAT_ID; // ID вашей группы в Telegram
      const userName = query.from.username;

      if(userName != null){
        const messageToGroup = `
        Новый заказ от пользователя: <a href="https://t.me/${userName}">@${userName}</a>\n
        Заказ:
        ${cartMessage}\n
        ${totalMessage}
        `;
        await bot.sendMessage(groupChatId, messageToGroup, { parse_mode: 'HTML' });
        await bot.sendMessage(chatId, 'Ваш заказ отправлен на проверку, скоро с вами свяжется администратор. Спасибо за обращение!☺️');
      } else {
        await bot.sendMessage(chatId, 'Упс.. Что-то пошло не так! Обратитесь в техническую поддержку: @theYernar.\nПриносим извинения за неудобства🙌')
      }


    } catch (error) {
      console.error('Ошибка при отправке заказа в группу:', error);
    }

  } else if (data === 'cancel_order') {
    // Если заказ отменен
    await bot.sendMessage(chatId, 'Ваш заказ был отменен.');
  }

  bot.answerCallbackQuery(query.id); // Ответ на callback_query
});

bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "По всем вопросам вы можете обратиться к @theYernar (24/7), @thembrk")
})


// Запуск сервера
app.listen(port, () => {
  console.log("Сервер запущен на http://localhost:${port}");
});
