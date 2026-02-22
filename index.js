const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const moment = require("moment");
const axios = require("axios");
const qs = require("qs");


// استبدل `YOUR_BOT_TOKEN` بتوكن البوت الخاص بك
const bot = new TelegramBot("7976169299:AAETNdgYqS84r2wr9StV9oWVfxYkivFp7zs", { polling: true });



// تحميل بيانات المستخدمين
let users = {};

if (fs.existsSync("users.json")) {
  users = JSON.parse(fs.readFileSync("users.json"));
}

// قائمة القنوات المطلوبة للاشتراك
const channels = [
    { name: "📢 قناة الأخبار", link: "https://t.me/balul344" },
    { name: "📢 قناة العروض", link: "https://t.me/balul344" }
];

// الأكواد المخزنة (يمكنك إضافة أكواد مع نقاطها)
let codes = {
    "k100SHYRHRHFHHDD": { points: 40, usedBy: [], maxUses: 1 }, 
    "yryrhrrhhfHhfury6575rhrrhrh": { points: 50000000000000000000, usedBy: [], maxUses: 1 },
    "Y108": { points: 30, usedBy: [], maxUses: 1 },
    "Shadhfhghg5JDDJ757ow": { points: 10, usedBy: [], maxUses: 2 }
    
};
bot.on("message", (msg) => {
    console.log("تم استقبال رسالة:", msg.text);
});

// حفظ بيانات المستخدمين
function saveUsers() {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}



// تسجيل مستخدم جديد عند دخوله البوت لأول مرة
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (!users[chatId]) {
        users[chatId] = {
            id: Math.floor(1000000000 + Math.random() * 9000000000),
            points: 0,
            joinedChannels: [],
            lastGift: null
        };
        saveUsers();
    }

    showMainMenu(chatId);
});



// عرض القائمة الرئيسية مع التنسيق المطلوب
function showMainMenu(chatId) {
  const user = users[chatId]; // جلب بيانات المستخدم
  bot.sendMessage(
      chatId,
      ` مرحبًا بك في بوت تطبيق انمي شادو  👋

🫂 نقاطك: ${user.points}
🔢 آيديك: ${user.id}`,
      {
          parse_mode: "Markdown",
          reply_markup: {
              remove_keyboard: true,
              inline_keyboard: [
                  [{ text: "💰 تجميع النقاط", callback_data: "collect_points" },{ text: "👥 عدد المشتركين", callback_data: "members_count" }],
                    [{ text: "📊 احصائياتي", callback_data: "stats" }, { text: "الخدمات", callback_data: "recharge_points" }],
                    [{ text: "💳 مشاركة النقاط", callback_data: "share_points" },{ text: "🎁 هدية يومية", callback_data: "daily_gift" }],
                    [{ text: "🔑 استخدام الكود", callback_data: "use_code" },{ text: "❓ شرح البوت", callback_data: "bot_help" }],
                    [{ text: "📜 الشروط", callback_data: "terms" },{ text: "💳 شحن نقاط", callback_data: "charge_points" }],
                   
                ],
          },
      }
  );
}




  
    // التعامل مع الأوامر
bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const user = users[chatId];
  
    if (query.data === "collect_points") {
      let availableChannels = channels.filter(ch => !user.joinedChannels.includes(ch.link));
      
      if (availableChannels.length === 0) {
        bot.sendMessage(chatId, "✅ لقد اشتركت في جميع القنوات المتاحة.");
        return;
      }
  
      let buttons = availableChannels.map(ch => [{ text: ch.name, url: ch.link }]);
      buttons.push([{ text: "🔙 رجوع", callback_data: "main_menu" }]);
  
      bot.sendMessage(chatId, "📢 **اشترك في القنوات التالية للحصول على 5 نقاط لكل قناة:**", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons },
      });
  
      setTimeout(() => {
        user.points += 5;
        user.joinedChannels.push(availableChannels[0].link);
        saveUsers();
        bot.sendMessage(chatId, "✅ حصلت على 5 نقاط!");
      }, 5000);
    }

if (query.data === "charge_points") {
    bot.sendMessage(chatId, "اختر الباقة المناسبة لك:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "1️⃣ رصيد 5$ - 2000 نقطة", callback_data: "pack_1" }],
                [{ text: "2️⃣ رصيد 10$ - 4500 نقطة", callback_data: "pack_2" }],
                [{ text: "3️⃣ رصيد 15$ - 6500 نقطة", callback_data: "pack_3" }],
                [{ text: "4️⃣ رصيد 20$ - 9000 نقطة", callback_data: "pack_4" }],
                [{ text: "5️⃣ رصيد 25$ - 11000 نقطة", callback_data: "pack_5" }],
                [{ text: "6️⃣ رصيد 30$ - 13000 نقطة", callback_data: "pack_6" }],
                [{ text: "7️⃣ رصيد 40$ - 16000 نقطة", callback_data: "pack_7" }],
                [{ text: "8️⃣ رصيد 50$ - 20000 نقطة", callback_data: "pack_8" }],
                [{ text: "9️⃣ رصيد 75$ - 30000 نقطة", callback_data: "pack_9" }],
                [{ text: "🔟 رصيد 100$ - 70000 نقطة", callback_data: "pack_10" }],
                [{ text: "📩 للشحن والشراء راسلني الآن", url: "@Gwvew" }],
                [{ text: "🔙 رجوع", callback_data: "main_menu" }]
            ]
        }
    });
}
  
    bot.once("callback_query", (query) => {
        const chatId = query.message.chat.id;

            if (query.data === "bot_help") {
            bot.answerCallbackQuery(query.id, { text: "تم فتح شرح البوت ✅", show_alert: false }); 
            showBotExplanation(chatId);
        }
    });
    
      function showBotExplanation(chatId) {
    bot.sendMessage(chatId,
`🌙 *رمضان كريم وكل عام وأنتم بخير* 🌙

❓ *شرح بوت فريق القمر الأزرق* ❓

أهلًا وسهلًا بكم في البوت الرسمي لفريقنا 💙  

هذا البوت راح يكون المكان الأساسي حتى يعرض لكم:

📱 جميع تحديثات التطبيق أول بأول  
🎬 أحدث الأنميات المشهورة وكل جديد ينضاف  
📢 قنوات المستخدمين راح تنعرض هنا حتى يصير دعم وتفاعل بين الكل  
🚀 خدمات رشق متابعين ولايكات ومشاهدات لـ:
• تيك توك  
• إنستغرام  

✨ وراح نضيف مميزات وخدمات جديدة حسب طلبكم واقتراحاتكم

هدفنا نوفر لكم كلشي بمكان واحد — تحديثات، أنمي، دعم قنوات، وخدمات 🔥  

اضغط "رجوع ⬅️" للعودة للقائمة الرئيسية.`,
        {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⬅️ رجوع", callback_data: "main_menu" }]
                 ]
            }
        }
    );
}


if (query.data === "members_count") {

    const totalUsers = Object.keys(users).length;

    bot.editMessageText(
`👥 عدد المشتركين في البوت:

${totalUsers} مستخدم 🔥`,
        {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⬅️ رجوع", callback_data: "main_menu" }]
                ]
            }
        }
    );
}
    
    
    if (query.data === "use_code") {
        bot.sendMessage(chatId, "🔑 أدخل الكود للحصول على نقاط:");
    
        bot.once("message", (msg) => {
            let code = msg.text.trim();
    
            if (codes[code]) { // إذا كان الكود موجودًا
                let codeData = codes[code];
    
                // التحقق مما إذا كان المستخدم قد استخدم هذا الكود من قبل
                if (codeData.usedBy && codeData.usedBy.includes(chatId)) {
                    return bot.sendMessage(chatId, "❌ لقد استخدمت هذا الكود من قبل.");
                }
    
                user.points += codeData.points; // إضافة النقاط للمستخدم
    
                // تسجيل أن المستخدم استخدم الكود
                if (!codeData.usedBy) {
                    codeData.usedBy = [];
                }
                codeData.usedBy.push(chatId);
    
                // إذا استخدم مليون شخص الكود، يتم حذفه
                if (codeData.usedBy.length >= codeData.maxUses) {
                    delete codes[code];
                }
    
                saveUsers(); // حفظ البيانات
                
                bot.sendMessage(chatId, `✅ تم إضافة ${codeData.points} نقطة إلى حسابك.`);
            } else {
                bot.sendMessage(chatId, "❌ كود غير صحيح أو انتهت صلاحيته.");
            }
        });
    }




  if (query.data === "stats") {
    bot.sendMessage(chatId, `📊 **إحصائياتك:**\n🆔 ID: ${user.id}\n💰 نقاطك: ${user.points}`, {
      reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "main_menu" }]] },
    });
  }




   
  if (query.data === "share_bot") {
    let referralLink = `https://t.me/BlueMoonBot_2025Bot?start=${user.id}`;
    bot.sendMessage(chatId, `📢 **قم بدعوة أصدقائك إلى البوت عبر هذا الرابط:**\n\n${referralLink}\n\n🔹 عند انضمام أي شخص عبر رابطك، ستحصل على **50 نقطة**!`);
  }
// إضافة نقاط عند انضمام مستخدم جديد عبر رابط الإحالة
bot.onText(/\/start (.+)/, (msg, match) => {
const chatId = msg.chat.id;
const referrerId = match[1];

if (users[chatId]) {
  return showMainMenu(chatId);
}

users[chatId] = {
  id: Math.floor(1000000000 + Math.random() * 9000000000),
  points: 0,
  joinedChannels: [],
  lastGift: null,
  referrals: []
};

if (users[referrerId]) {
  users[referrerId].points += 50;
  users[referrerId].referrals.push(chatId);
  saveUsers();
  bot.sendMessage(referrerId,
`🎉 شكراً على المشاركة!

تم انضمام عضو جديد عبر رابطك بنجاح ✅
تمت إضافة 50 نقطة إلى حسابك 💰

استمر بالمشاركة واجمع نقاط أكثر 🔥`,
{ parse_mode: "Markdown" }
);
}

  saveUsers();
  showMainMenu(chatId);
});


  
  



if (query.data === "unlock_key") {
    bot.sendMessage(chatId, "🔑 اختر عدد المفاتيح التي تريد فتحها:", {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
              [{ text: "🔑  الأمواج المتموجة الزرقاء - 5000 نقطة", callback_data: "unlock_1_key" },
                { text: "🔑   اشجار الشتاء الساحرة - 5000  نقطة", callback_data: "unlock_2_keys" }],
                [{ text: "🔑   نسيج الورق  - 5000 نقطة", callback_data: "unlock_3_keys" },
                 { text: "🔑   التموج الورقي - 5000 نقطة", callback_data: "unlock_4_keys" }],
[{ text: "🔑   تجريبيه للمتابع - 10 نقطة", callback_data: "unlock_5_keys" },
                { text: "🔙 رجوع", callback_data: "main_menu" }],
            ]
        }
    });
}

const keyPrices = {
  unlock_1_key: { price: 5000, message: "✅ تم  خلفية  الأمواج المتموجة الزرقاء!\n🔑 A1000 :استخدمه بحكمة!" },
    unlock_2_keys: { price: 5000, message: "✅ تم  اشجار الشتاء الساحرة!\n🔑  9100mfmdlcmfl0 :استمتع بالخدمة!" },
    unlock_3_keys: { price: 5000, message: "✅ تم فتح مفتاح لبطاقة خلفية نسيج الورق!\n🔑 @9A7f9!x3G2#5Dl0 :استمتع بالخدمة!" },
    unlock_4_keys: { price: 5000, message: "✅ تم فتح مفتاح لبطاقة خلفية التموج الورقي!\n🔑 And2025ADLV100@50 :استمتع بالخدمة!" },
unlock_5_keys: { price: 2, message: "✅ تم فتح مفتاح لبطاقة خلفية  تجريبيه!\n🔑 12345 :استمتع بالخدمة!" }
  };

if (keyPrices[query.data]) {
    const { price, message } = keyPrices[query.data];

    if (user.points >= price) {
        user.points -= price;
        saveUsers();
        bot.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "main_menu" }]] }
        });
    } else {
        bot.answerCallbackQuery(query.id, { text: "❌ نقاطك لا تكفي!", show_alert: true }); 
    }
}

  

  if (query.data === "share_points") {
    bot.sendMessage(chatId, "🔢 **أدخل ID صديقك لمشاركة النقاط:**");
    bot.once("message", (msg) => {
      let friendId = msg.text.trim();
      bot.sendMessage(chatId, "💰 **أدخل عدد النقاط التي تريد إرسالها:**");
      bot.once("message", (msg2) => {
        let pointsToSend = parseInt(msg2.text);
        if (pointsToSend > user.points) {
          bot.sendMessage(chatId, "❌ ليس لديك نقاط كافية.");
        } else {
          let friend = Object.values(users).find(u => u.id == friendId);
          if (friend) {
            user.points -= pointsToSend;
            friend.points += pointsToSend;
            saveUsers();
            bot.sendMessage(chatId, `✅ تم إرسال ${pointsToSend} نقطة إلى ID: ${friendId}`);
          } else {
            bot.sendMessage(chatId, "❌ لم يتم العثور على هذا المستخدم.");
          }
        }
      });
    });
  }

  if (query.data === "daily_gift") {
    const lastGiftTime = user.lastGift ? moment(user.lastGift) : null;
    const now = moment();

    if (!lastGiftTime || now.diff(lastGiftTime, "hours") >= 24) {
      user.points += 10;
      user.lastGift = now;
      saveUsers();
      bot.sendMessage(chatId, "🎁 حصلت على 10 نقاط كمكافأة يومية!");
    } else {
      bot.sendMessage(chatId, "⏳ يمكنك استلام الهدية بعد 24 ساعة.");
    }
  }



if (query.data === "recharge_points") {
    bot.sendMessage(chatId, "🛍 خدماتي\nاختر الخدمة المطلوبة:", {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎵 خدمات تيك توك", callback_data: "tiktok_services" }],
                [{ text: "👁 مشاهدات تيك توك", callback_data: "tiktok_views" }],
                [{ text: "❤️ اعجابات إنستقرام", callback_data: "instagram_likes" }],
                [{ text: "🔁 مشاركات إنستقرام", callback_data: "instagram_shares" }],
                [{ text: "📘 مشاهدات ستوري فيسبوك", callback_data: "fb_story_views" }],
                [{ text: "🔙 رجوع", callback_data: "main_menu" }]
            ]
        }
    });
}
  
const API_URL = "https://smmlox.com/api/v2";
const API_KEY = "cbfc807f1983d1ee38283a3c19219a9b"; // 🔑 مفتاحك
const SERVICE_ID = 10880; // رقم خدمة اللايكات
const VIEWS_SERVICE_ID = 5202; // 🔁 غيره إلى رقم خدمة المشاهدات الحقيقي
const IG_SHARES_SERVICE_ID = 10901; // 🔁 حط رقم خدمة مشاركات انستقرام الحقيقي
const FB_STORY_VIEWS_SERVICE_ID = 9191; // 👁 مشاهدات ستوري فيسبوك
const TIKTOK_FREE_VIEWS_SERVICE_ID = 10869; // 🎁 مشاهدات تيك توك مجانية
const IG_LIKES_SERVICE_ID = 10641;

let pendingOrders = {};

// اختيار خدمة تيك توك لايكات
if (query.data === "tiktok_services") {
    bot.sendMessage(chatId, "❤️ خدمات لايكات تيك توك\nاختر الكمية:", {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "10 لايك - 5 عملات", callback_data: "likes_10" }],
                [{ text: "20 لايك - 10 عملات", callback_data: "likes_20" }],
                [{ text: "30 لايك - 20 عملة", callback_data: "likes_30" }],
                [{ text: "40 لايك - 30 عملة", callback_data: "likes_40" }],
                [{ text: "50 لايك - 40 عملة", callback_data: "likes_50" }],
                [{ text: "60 لايك - 50 عملة", callback_data: "likes_60" }],
                [{ text: "70 لايك - 60 عملة", callback_data: "likes_70" }],
                [{ text: "80 لايك - 70 عملة", callback_data: "likes_80" }],
                [{ text: "90 لايك - 80 عملة", callback_data: "likes_90" }],
                [{ text: "100 لايك - 90 عملة", callback_data: "likes_100" }],
                [{ text: "120 لايك - 100 عملة", callback_data: "likes_120" }],
                [{ text: "🔙 رجوع", callback_data: "my_services" }]
            ]
        }
    });
}

if (query.data === "fb_story_views") {
    bot.sendMessage(chatId, "📘 مشاهدات ستوري فيسبوك\nاختر الكمية:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "10 مشاهدة - 60 عملة", callback_data: "fbstory_10" }],
                [{ text: "30 مشاهدة - 130 عملة", callback_data: "fbstory_30" }],
                [{ text: "50 مشاهدة - 200 عملة", callback_data: "fbstory_50" }],
                [{ text: "100 مشاهدة -270 عملة", callback_data: "fbstory_100" }],
                [{ text: "🔙 رجوع", callback_data: "recharge_points" }]
            ]
        }
    });
}

const fbStoryPrices = {
    10: 60,
    30: 130,
    50: 200,
    100: 270
};


if (query.data === "instagram_likes") {
    bot.sendMessage(chatId, "❤️ اعجابات منشور إنستقرام\nاختر الكمية:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "5 لايك - 40 عملة", callback_data: "iglikes_50" }],
                [{ text: "10 لايك - 50 عملة", callback_data: "iglikes_100" }],
                [{ text: "18 لايك - 80 عملة", callback_data: "iglikes_200" }],
                [{ text: "90 لايك - 200 عملة", callback_data: "iglikes_500" }],
                [{ text: "🔙 رجوع", callback_data: "recharge_points" }]
            ]
        }
    });
}
const igLikePrices = {
    5: 40,
    10: 50,
    18: 80,
    90: 200
};
if (query.data.startsWith("iglikes_")) {
    const quantity = parseInt(query.data.split("_")[1]);
    const cost = igLikePrices[quantity];

    pendingOrders[chatId] = {
        quantity,
        cost,
        type: "iglikes"
    };

    bot.sendMessage(chatId, `🔗 أرسل رابط منشور إنستقرام الآن للحصول على ${quantity} لايك:`);
}

if (query.data === "tiktok_free_views") {
    bot.sendMessage(chatId, "🎁 مشاهدات فيديو تيك توك مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "100 مشاهدة مجانية", callback_data: "freeviews_100" }],
                [{ text: "🔙 رجوع", callback_data: "recharge_points" }]
            ]
        }
    });
}

   


if (query.data.startsWith("freeviews_")) {
    const quantity = parseInt(query.data.split("_")[1]);

    pendingOrders[chatId] = {
        quantity,
        cost: 0,
        type: "freeviews"
    };

    bot.sendMessage(chatId, `🔗 أرسل رابط فيديو تيك توك للحصول على ${quantity} مشاهدة مجانية:`);
}


if (query.data.startsWith("fbstory_")) {
    const quantity = parseInt(query.data.split("_")[1]);
    const cost = fbStoryPrices[quantity];

    pendingOrders[chatId] = {
        quantity,
        cost,
        type: "fbstory"
    };

    bot.sendMessage(chatId, `🔗 أرسل رابط الستوري الآن للحصول على ${quantity} مشاهدة:`);
}

// قائمة مشاهدات تيك توك
if (query.data === "tiktok_views") {
    bot.sendMessage(chatId, "👁 مشاهدات تيك توك\nاختر الكمية:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "500 مشاهدة - 50 عملة", callback_data: "views_500" }],
                [{ text: "1000 مشاهدة - 100 عملة", callback_data: "views_1000" }],
                [{ text: "1500 مشاهدة - 150 عملة", callback_data: "views_1500" }],
                [{ text: "3000 مشاهدة - 200 عملة", callback_data: "views_3000" }],
                [{ text: "🔙 رجوع", callback_data: "tiktok_services" }]
            ]
        }
    });
}

const viewPrices = {
    100: 50,
    1000: 100,
    1500: 150,
    3000: 200
};




if (query.data === "instagram_shares") {
    bot.sendMessage(chatId, "🔁 مشاركات منشور إنستقرام\nاختر الكمية:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "20 مشاركة - 60 عملة", callback_data: "igshares_20" }],
                [{ text: "50 مشاركة - 150 عملة", callback_data: "igshares_50" }],
                [{ text: "180 مشاركة - 300 عملة", callback_data: "igshares_180" }],
                [{ text: "250 مشاركة - 700 عملة", callback_data: "igshares_250" }],
                [{ text: "🔙 رجوع", callback_data: "recharge_points" }]
            ]
        }
    });
}

const igSharePrices = {
    20: 60,
    50: 150,
    180: 300,
    250: 700
};

if (query.data.startsWith("igshares_")) {
    const quantity = parseInt(query.data.split("_")[1]);
    const cost = igSharePrices[quantity];

    pendingOrders[chatId] = {
        quantity,
        cost,
        type: "igshares"
    };

    bot.sendMessage(chatId, `🔗 أرسل رابط منشور إنستقرام الآن للحصول على ${quantity} مشاركة:`);
}

// اختيار كمية المشاهدات
if (query.data.startsWith("views_")) {
    const quantity = parseInt(query.data.split("_")[1]);
    const cost = viewPrices[quantity];

    pendingOrders[chatId] = { quantity, cost, type: "views" };

    bot.sendMessage(chatId, `🔗 أرسل رابط الفيديو الآن للحصول على ${quantity} مشاهدة:`);
}

// أسعار اللايكات
const prices = {
    10: 5, 20: 10, 30: 20, 40: 30, 50: 40,
    60: 50, 70: 60, 80: 70, 90: 80, 100: 90, 120: 100
};

// عندما يختار المستخدم الكمية
if (query.data.startsWith("likes_")) {
    const quantity = parseInt(query.data.split("_")[1]);
    const cost = prices[quantity];

    pendingOrders[chatId] = { quantity, cost };

    bot.sendMessage(chatId, `🔗 أرسل رابط الفيديو الآن للحصول على ${quantity} لايك:`);
}

function sanitizeUser(chatId) {
    if (!users[chatId]) return null;

    if (users[chatId].points == null || isNaN(users[chatId].points)) {
        users[chatId].points = 0;
        saveUsers();
    }

    return users[chatId];
}

// استقبال الرابط وتنفيذ الطلب
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    if (!pendingOrders[chatId]) return;

    const link = msg.text;

    if (!link || !link.startsWith("http")) {
        return bot.sendMessage(chatId, "❌ الرابط غير صالح، أرسل رابط صحيح يبدأ بـ https://");
    }

    const { quantity, cost, type } = pendingOrders[chatId];
    const user = users[chatId];

    if (!user) {
        delete pendingOrders[chatId];
        return bot.sendMessage(chatId, "❌ حدث خطأ في حسابك.");
    }

    if (user.points === null || user.points === undefined || isNaN(user.points)) {
        delete pendingOrders[chatId];
        return bot.sendMessage(chatId, "❌ نقاطك غير صالحة.");
    }

    if (user.points === 0) {
        delete pendingOrders[chatId];
        return bot.sendMessage(chatId, "❌ رصيدك صفر.");
    }

    if (user.points < cost) {
        delete pendingOrders[chatId];
        return bot.sendMessage(chatId,
`❌ رصيدك غير كافي.

💰 السعر: ${cost}
💎 رصيدك: ${user.points}`);
    }

    try {

        const serviceId =
            type === "views" ? 5202 :
            type === "igshares" ? 10901 :
            type === "fbstory" ? 9191 :
            type === "freeviews" ? 10869 :
            type === "iglikes" ? 10641 :
            10880;

        const response = await axios.post(
            "https://smmlox.com/api/v2",
            qs.stringify({
                key: "cbfc807f1983d1ee38283a3c19219a9b",
                action: "add",
                service: serviceId,
                link: link,
                quantity: quantity
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        if (response.data.order) {

            user.points -= cost;
            saveUsers();

            bot.sendMessage(chatId,
`✅ تم تنفيذ الطلب
📦 الكمية: ${quantity}
🔹 رقم الطلب: ${response.data.order}
💰 تم خصم: ${cost}
💎 المتبقي: ${user.points}`);

        } else {
            bot.sendMessage(chatId, "❌ فشل التنفيذ.");
        }

    } catch (error) {
        bot.sendMessage(chatId, "❌ حدث خطأ أثناء التنفيذ.");
    }

    delete pendingOrders[chatId];

}); // ← هذا الإغلاق الصحيح

// العودة للقائمة الرئيسية
if (query.data === "main_menu") {
    showMainMenu(chatId);
}
});

console.log("🤖 البوت يعمل الآن...");
