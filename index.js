"use strict";

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const qs = require("qs");
const moment = require("moment");
const Redis = require("ioredis");

// =====================
// 1) ENV / CONFIG
// =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("❌ BOT_TOKEN is missing in Railway Variables");

const BOT_USERNAME = process.env.BOT_USERNAME; // مثال: AnimeShadomBot (بدون @)
if (!BOT_USERNAME) throw new Error("❌ BOT_USERNAME is missing in Railway Variables");

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error("❌ REDIS_URL is missing (add Redis database on Railway)");

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const redis = new Redis(REDIS_URL);
redis.on("error", (e) => console.error("Redis error:", e.message));

// =====================
// 2) SETTINGS
// =====================
// قنوات الاشتراك (اختياري)
const channels = [
  { name: "📢 قناة الأخبار", link: "https://t.me/balul344" },
  { name: "📢 قناة العروض", link: "https://t.me/balul344" },
];

// نقاط الإحالة
const REFERRAL_BONUS = 8;

// نقاط الاشتراك بالقنوات
const CHANNEL_JOIN_POINTS = 5;

// API (SMM) - (مو مربوط فعلياً هنا، بس خليته مثل كودك)
const API_URL = "https://smmlox.com/api/v2";
const API_KEY = "cbfc807f1983d1ee38283a3c19219a9b";

// =====================
// 3) REDIS KEYS
// =====================
const USERS_KEY = "users";
const PENDING_KEY = "pendingOrders";
const CODES_KEY = "codes";

// =====================
// 4) DATA IN MEMORY
// =====================
let users = {};
let pendingOrders = {};
let codes = {
  "k100SHYRHRHFHHDD": { points: 40, usedBy: [], maxUses: 1 },
  "BOT100": { points: 50, usedBy: [], maxUses: 5 },
  "Shadhfhghg5JDDJ757ow": { points: 10, usedBy: [], maxUses: 2 },
};

// =====================
// 5) REDIS HELPERS
// =====================
async function loadFromRedis(key, fallback) {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`loadFromRedis(${key}) error:`, e);
    return fallback;
  }
}

async function saveToRedis(key, data) {
  try {
    await redis.set(key, JSON.stringify(data));
  } catch (e) {
    console.error(`saveToRedis(${key}) error:`, e);
  }
}

async function saveAll() {
  await Promise.all([
    saveToRedis(USERS_KEY, users),
    saveToRedis(PENDING_KEY, pendingOrders),
    saveToRedis(CODES_KEY, codes),
  ]);
}

// تحميل الداتا عند تشغيل البوت
(async () => {
  users = await loadFromRedis(USERS_KEY, {});
  pendingOrders = await loadFromRedis(PENDING_KEY, {});
  const storedCodes = await loadFromRedis(CODES_KEY, null);
  if (storedCodes && typeof storedCodes === "object") codes = storedCodes;
  console.log("✅ Loaded users/pendingOrders/codes from Redis");
})();

// =====================
// 6) USERS + STATE
// =====================
function ensureUser(chatId) {
  if (!users[chatId]) {
    users[chatId] = {
      uid: String(Math.floor(1000000000 + Math.random() * 9000000000)),
      points: 0,
      joinedChannels: [],
      lastGift: null,
      referrals: [],
      referredBy: null,
      state: { page: "HOME", lastMsgId: null, tmp: {} },
    };
    saveAll();
    return users[chatId];
  }

  // ترميم الحسابات القديمة
  if (!users[chatId].uid) {
    if (users[chatId].id) users[chatId].uid = String(users[chatId].id);
    else users[chatId].uid = String(Math.floor(1000000000 + Math.random() * 9000000000));
  }
  if (typeof users[chatId].points !== "number") users[chatId].points = 0;
  if (!Array.isArray(users[chatId].joinedChannels)) users[chatId].joinedChannels = [];
  if (!Array.isArray(users[chatId].referrals)) users[chatId].referrals = [];
  if (!users[chatId].state) users[chatId].state = { page: "HOME", lastMsgId: null, tmp: {} };

  return users[chatId];
}

function setLastMessage(chatId, messageId) {
  const u = ensureUser(chatId);
  u.state.lastMsgId = messageId;
  saveAll();
}

function getLastMessage(chatId) {
  const u = ensureUser(chatId);
  return u.state.lastMsgId || null;
}

function setPage(chatId, page) {
  const u = ensureUser(chatId);
  u.state.page = page;
  saveAll();
}

function getPage(chatId) {
  const u = ensureUser(chatId);
  return u.state.page || "HOME";
}

// =====================
// 7) UI BUILDERS
// =====================
function homeText(u) {
  return `مرحبًا بك في بوت تطبيق انمي شادو 👋

🫂 نقاطك: ${u.points}
🔢 آيديك: ${u.uid}`;
}

function homeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "💰 تجميع النقاط", callback_data: "NAV:COLLECT" },
        { text: "👥 عدد المشتركين", callback_data: "NAV:MEMBERS" },
      ],
      [
        { text: "📊 احصائياتي", callback_data: "NAV:STATS" },
        { text: "🛍 الخدمات", callback_data: "NAV:SERVICES" },
      ],
      [
        { text: "💳 مشاركة النقاط", callback_data: "NAV:SHARE_POINTS" },
        { text: "🎁 هدية يومية", callback_data: "NAV:DAILY" },
      ],
      [
        { text: "🔗 مشاركة البوت", callback_data: "NAV:REF" },
        { text: "🔑 استخدام الكود", callback_data: "NAV:CODE" },
      ],
      [{ text: "📜 الشروط", callback_data: "NAV:TERMS" }],
    ],
  };
}

function backToHomeKeyboard() {
  return { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]] };
}

function servicesKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "❤️ لايكات تيك توك", callback_data: "NAV:SVC_TT_LIKES" }],
      [{ text: "👁 مشاهدات تيك توك", callback_data: "NAV:SVC_TT_VIEWS" }],
      [{ text: "🎁 مشاهدات تيك توك مجانية", callback_data: "NAV:SVC_TT_FREEVIEWS" }],
      [{ text: "👥 متابعين تلجرام", callback_data: "NAV:SVC_TG_FOLLOWERS" }],
      [{ text: "❤️ اعجابات إنستقرام", callback_data: "NAV:SVC_IG_LIKES" }],
      [{ text: "🔁 مشاركات إنستقرام", callback_data: "NAV:SVC_IG_SHARES" }],
      [{ text: "📘 مشاهدات ستوري فيسبوك", callback_data: "NAV:SVC_FB_STORY" }],
      [{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }],
    ],
  };
}

// =====================
// 8) EDIT / SEND SAFE
// =====================
async function showHome(chatId) {
  const u = ensureUser(chatId);
  setPage(chatId, "HOME");

  const lastMsgId = getLastMessage(chatId);
  if (lastMsgId) {
    try {
      await bot.editMessageText(homeText(u), {
        chat_id: chatId,
        message_id: lastMsgId,
        reply_markup: homeKeyboard(),
      });
      return;
    } catch (_) {}
  }

  const sent = await bot.sendMessage(chatId, homeText(u), { reply_markup: homeKeyboard() });
  setLastMessage(chatId, sent.message_id);
}

async function editOrSend(chatId, text, keyboard) {
  const lastMsgId = getLastMessage(chatId);

  if (lastMsgId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: lastMsgId,
        reply_markup: keyboard,
      });
      return;
    } catch (_) {}
  }

  const sent = await bot.sendMessage(chatId, text, { reply_markup: keyboard });
  setLastMessage(chatId, sent.message_id);
}

// =====================
// 9) REFERRAL
// =====================
function makeReferralLink(u) {
  return `https://t.me/${BOT_USERNAME}?start=ref_${u.uid}`;
}

// =====================
// 10) SERVICES PRICES
// =====================
const ttLikePrices = { 10: 5, 20: 10, 30: 20, 40: 30, 50: 40, 60: 50, 70: 60, 80: 70, 90: 80, 100: 90, 120: 100 };
const ttViewPrices = { 500: 50, 1000: 100, 1500: 150, 3000: 200 };
const igLikePrices = { 5: 40, 10: 50, 18: 80, 90: 200 };
const igSharePrices = { 20: 60, 50: 150, 180: 300, 250: 700 };
const fbStoryPrices = { 10: 60, 30: 130, 50: 200, 100: 270 };
const tgFollowerPrices = { 10: 80, 20: 160, 30: 210, 40: 260, 50: 310, 500: 600, 1000: 1000 };

// =====================
// 11) SERVICE MENUS
// =====================
async function showServices(chatId) {
  setPage(chatId, "SERVICES");
  await editOrSend(chatId, "🛍 خدماتي\nاختر الخدمة المطلوبة:", servicesKeyboard());
}

function buildQtyKeyboard(prefix, qtyList, backTo = "NAV:SERVICES") {
  const rows = [];
  for (let i = 0; i < qtyList.length; i += 2) {
    const a = qtyList[i];
    const b = qtyList[i + 1];
    const row = [{ text: a.label, callback_data: `${prefix}:${a.qty}` }];
    if (b) row.push({ text: b.label, callback_data: `${prefix}:${b.qty}` });
    rows.push(row);
  }
  rows.push([{ text: "⬅️ رجوع", callback_data: backTo }]);
  return { inline_keyboard: rows };
}

async function showQtyMenu(chatId, title, prefix, priceMap, backTo) {
  const qtyList = Object.keys(priceMap)
    .map(k => parseInt(k, 10))
    .sort((a, b) => a - b)
    .map(qty => ({ qty, label: `${qty} - ${priceMap[qty]} عملة` }));

  await editOrSend(chatId, title, buildQtyKeyboard(prefix, qtyList, backTo));
}

// =====================
// 12) BALANCE GUARD
// =====================
async function requireBalanceOrWarn(chatId, user, cost) {
  if (user.points < cost) {
    await editOrSend(
      chatId,
      `❌ رصيدك غير كافي.\n\n💰 السعر: ${cost}\n💎 رصيدك: ${user.points}`,
      backToHomeKeyboard()
    );
    return false;
  }
  return true;
}

// =====================
// 13) PENDING ORDERS
// =====================
async function setPending(chatId, order) {
  pendingOrders[chatId] = order;
  await saveToRedis(PENDING_KEY, pendingOrders);
}

async function clearPending(chatId) {
  delete pendingOrders[chatId];
  await saveToRedis(PENDING_KEY, pendingOrders);
}

async function askForLink(chatId, promptText) {
  await bot.sendMessage(chatId, promptText);
}

// =====================
// 14) /start
// =====================
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const u = ensureUser(chatId);

  const payload = match && match[1] ? match[1].trim() : null;

  // Referral: ref_UID
  if (payload && payload.startsWith("ref_")) {
    const refUid = payload.replace("ref_", "");

    // لا تعطي نفسك + لا تكرر
    if (!u.referredBy && refUid !== u.uid) {
      const refChatId = Object.keys(users).find(cid => users[cid]?.uid === refUid);

      if (refChatId) {
        u.referredBy = refUid;
        users[refChatId].points += REFERRAL_BONUS;
        users[refChatId].referrals = users[refChatId].referrals || [];
        users[refChatId].referrals.push(chatId);

        await saveToRedis(USERS_KEY, users);

        await bot.sendMessage(
          refChatId,
          `🎉 انضم عضو جديد عبر رابطك!\n✅ تمت إضافة ${REFERRAL_BONUS} نقطة لحسابك 💰`
        );
      }
    }
  }

  await showHome(chatId);
});

// =====================
// 15) CALLBACK ROUTER
// =====================
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const u = ensureUser(chatId);

  try { await bot.answerCallbackQuery(q.id); } catch (_) {}

  const data = q.data || "";

  // NAV
  if (data.startsWith("NAV:")) {
    const action = data.split(":")[1];

    if (action === "HOME") return showHome(chatId);

    if (action === "MEMBERS") {
      const totalUsers = Object.keys(users).length;
      return editOrSend(chatId, `👥 عدد المشتركين في البوت:\n\n${totalUsers} مستخدم 🔥`, backToHomeKeyboard());
    }

    if (action === "STATS") {
      return editOrSend(chatId, `📊 إحصائياتك:\n🆔 ID: ${u.uid}\n💰 نقاطك: ${u.points}`, backToHomeKeyboard());
    }

    if (action === "TERMS") {
      return editOrSend(
        chatId,
        `📜 الشروط:\n\n- يمنع الاحتيال أو استغلال الثغرات.\n- النقاط تُحسب حسب النظام داخل البوت.\n- أي إساءة استخدام قد تؤدي للحظر.`,
        backToHomeKeyboard()
      );
    }

    if (action === "REF") {
      const link = makeReferralLink(u);
      return editOrSend(
        chatId,
        `🔗 رابط دعوتك الخاص:\n\n${link}\n\n✅ إذا دخل شخص عبر رابطك راح تحصل ${REFERRAL_BONUS} نقطة.`,
        backToHomeKeyboard()
      );
    }

    if (action === "SERVICES") return showServices(chatId);

    if (action === "CODE") {
      await bot.sendMessage(chatId, "🔑 أدخل الكود للحصول على نقاط:");
      bot.once("message", async (m) => {
        const code = (m.text || "").trim();
        const codeData = codes[code];

        if (!codeData) return bot.sendMessage(chatId, "❌ كود غير صحيح أو انتهت صلاحيته.");

        codeData.usedBy = codeData.usedBy || [];
        if (codeData.usedBy.includes(chatId)) return bot.sendMessage(chatId, "❌ لقد استخدمت هذا الكود من قبل.");

        u.points += codeData.points;
        codeData.usedBy.push(chatId);

        if (codeData.usedBy.length >= codeData.maxUses) delete codes[code];

        await saveToRedis(USERS_KEY, users);
        await saveToRedis(CODES_KEY, codes);

        return bot.sendMessage(chatId, `✅ تم إضافة ${codeData.points} نقطة إلى حسابك.`);
      });
      return;
    }

    if (action === "DAILY") {
      const lastGiftTime = u.lastGift ? moment(u.lastGift) : null;
      const now = moment();

      if (!lastGiftTime || now.diff(lastGiftTime, "hours") >= 24) {
        u.points += 10;
        u.lastGift = now.toISOString();
        await saveToRedis(USERS_KEY, users);
        return editOrSend(chatId, "🎁 حصلت على 10 نقاط كمكافأة يومية!", backToHomeKeyboard());
      }
      return editOrSend(chatId, "⏳ يمكنك استلام الهدية بعد 24 ساعة.", backToHomeKeyboard());
    }

    if (action === "SHARE_POINTS") {
      await bot.sendMessage(chatId, "🔢 أدخل ID صديقك لمشاركة النقاط:");
      bot.once("message", (m1) => {
        const friendUid = (m1.text || "").trim();

        bot.sendMessage(chatId, "💰 أدخل عدد النقاط التي تريد إرسالها:");
        bot.once("message", async (m2) => {
          const amount = parseInt((m2.text || "0").trim(), 10);

          if (!Number.isFinite(amount) || amount <= 0) return bot.sendMessage(chatId, "❌ أدخل رقم صحيح.");
          if (amount > u.points) return bot.sendMessage(chatId, "❌ ليس لديك نقاط كافية.");

          const friendChatId = Object.keys(users).find(cid => users[cid]?.uid === friendUid);
          if (!friendChatId) return bot.sendMessage(chatId, "❌ لم يتم العثور على هذا المستخدم.");

          u.points -= amount;
          users[friendChatId].points += amount;

          await saveToRedis(USERS_KEY, users);

          bot.sendMessage(chatId, `✅ تم إرسال ${amount} نقطة إلى ID: ${friendUid}`);
          bot.sendMessage(friendChatId, `🎉 وصلك ${amount} نقطة من مستخدم آخر!`);
        });
      });
      return;
    }

    // تجميع نقاط بالقنوات (تحقق شكلي مثل كودك)
    if (action === "COLLECT") {
      const available = channels.filter(ch => !u.joinedChannels.includes(ch.link));
      if (available.length === 0) return editOrSend(chatId, "✅ لقد اشتركت في جميع القنوات المتاحة.", backToHomeKeyboard());

      const buttons = available.map(ch => [{ text: ch.name, url: ch.link }]);
      buttons.push([{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]);

      await editOrSend(chatId, "📢 اشترك بالقنوات التالية للحصول على نقاط:", { inline_keyboard: buttons });

      setTimeout(async () => {
        u.points += CHANNEL_JOIN_POINTS;
        u.joinedChannels.push(available[0].link);
        await saveToRedis(USERS_KEY, users);
        bot.sendMessage(chatId, `✅ حصلت على ${CHANNEL_JOIN_POINTS} نقاط!`);
      }, 5000);

      return;
    }

    // خدمات: قوائم الكميات
    if (action === "SVC_TT_LIKES") return showQtyMenu(chatId, "❤️ لايكات تيك توك\nاختر الكمية:", "BUY:TTLIKES", ttLikePrices, "NAV:SERVICES");
    if (action === "SVC_TT_VIEWS") return showQtyMenu(chatId, "👁 مشاهدات تيك توك\nاختر الكمية:", "BUY:TTVIEWS", ttViewPrices, "NAV:SERVICES");

    if (action === "SVC_TT_FREEVIEWS") {
      return editOrSend(chatId, "🎁 مشاهدات تيك توك مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        inline_keyboard: [
          [{ text: "100 مشاهدة مجانية", callback_data: "BUY:FREEVIEWS:100" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }

    if (action === "SVC_TG_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين تلجرام\nاختر الكمية:", "BUY:TGFOLLOW", tgFollowerPrices, "NAV:SERVICES");
    if (action === "SVC_IG_LIKES") return showQtyMenu(chatId, "❤️ اعجابات إنستقرام\nاختر الكمية:", "BUY:IGLIKES", igLikePrices, "NAV:SERVICES");
    if (action === "SVC_IG_SHARES") return showQtyMenu(chatId, "🔁 مشاركات إنستقرام\nاختر الكمية:", "BUY:IGSHARES", igSharePrices, "NAV:SERVICES");
    if (action === "SVC_FB_STORY") return showQtyMenu(chatId, "📘 مشاهدات ستوري فيسبوك\nاختر الكمية:", "BUY:FBSTORY", fbStoryPrices, "NAV:SERVICES");
  }

  // BUY
  if (data.startsWith("BUY:")) {
    const parts = data.split(":"); // BUY, TYPE, QTY
    const type = parts[1];
    const qty = parseInt(parts[2], 10);

    let cost = 0;
    let askText = "";
    let orderType = "";

    if (type === "TTLIKES") { cost = ttLikePrices[qty] || 0; askText = "🔗 أرسل رابط فيديو تيك توك:"; orderType = "ttlikes"; }
    if (type === "TTVIEWS") { cost = ttViewPrices[qty] || 0; askText = "🔗 أرسل رابط فيديو تيك توك:"; orderType = "ttviews"; }
    if (type === "FREEVIEWS") { cost = 0; askText = "🔗 أرسل رابط فيديو تيك توك للمشاهدات المجانية:"; orderType = "freeviews"; }
    if (type === "TGFOLLOW") { cost = tgFollowerPrices[qty] || 0; askText = "🔗 أرسل رابط القناة (لازم يبدأ بـ https://t.me/ ):"; orderType = "tgfollowers"; }
    if (type === "IGLIKES") { cost = igLikePrices[qty] || 0; askText = "🔗 أرسل رابط منشور إنستقرام:"; orderType = "iglikes"; }
    if (type === "IGSHARES") { cost = igSharePrices[qty] || 0; askText = "🔗 أرسل رابط منشور إنستقرام:"; orderType = "igshares"; }
    if (type === "FBSTORY") { cost = fbStoryPrices[qty] || 0; askText = "🔗 أرسل رابط الستوري:"; orderType = "fbstory"; }

    if (!orderType) {
      return editOrSend(chatId, "❌ خيار غير صالح.", backToHomeKeyboard());
    }

    // شرطك: إذا ما عنده نقاط كافية ما يوصل لمرحلة الرابط
    if (cost > 0) {
      const ok = await requireBalanceOrWarn(chatId, u, cost);
      if (!ok) return;
    }

    await setPending(chatId, { orderType, qty, cost, step: "WAIT_LINK" });

    await editOrSend(
      chatId,
      `✅ تم اختيار: ${qty}\n💰 السعر: ${cost}\n\n📩 الآن ارسل المطلوب بالرسالة التالية.`,
      { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }]] }
    );

    return askForLink(chatId, askText);
  }
});

// =====================
// 16) MESSAGE HANDLER FOR PENDING ORDERS
// =====================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text.startsWith("/start")) return;

  const u = ensureUser(chatId);
  const p = pendingOrders[chatId];

  if (!p) return;

  if (p.step === "WAIT_LINK") {
    const link = text;

    if (p.orderType === "tgfollowers" && !/^https:\/\/t\.me\//i.test(link)) {
      return bot.sendMessage(chatId, "❌ الرابط لازم يبدأ بـ https://t.me/ (أعد الإرسال)");
    }

    // خصم النقاط الآن
    if (p.cost > 0) {
      if (u.points < p.cost) {
        await clearPending(chatId);
        return bot.sendMessage(chatId, "❌ رصيدك صار غير كافي. حاول مرة ثانية.");
      }
      u.points -= p.cost;
      await saveToRedis(USERS_KEY, users);
    }

    await clearPending(chatId);

    return bot.sendMessage(
      chatId,
      `✅ تم استلام طلبك بنجاح!\n\n📦 الخدمة: ${p.orderType}\n🔢 الكمية: ${p.qty}\n🔗 الرابط: ${link}\n\n💎 رصيدك الحالي: ${u.points}`
    );
  }
});

// =====================
// 17) LOG / ERRORS
// =====================
bot.on("polling_error", (e) => console.error("polling_error:", e.message));
console.log("✅ Bot is running...");
