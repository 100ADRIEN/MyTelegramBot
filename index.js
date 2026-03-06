"use strict";

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const qs = require("qs");
const moment = require("moment");
const { MongoClient } = require("mongodb");

// =====================
// 1) CONFIG
// =====================


// ===== MongoDB Connection =====
// 🔴 حط رابطك هنا (من Atlas > Connect > Drivers)
// مثال: mongodb+srv://animebot:PASSWORD@cluster0....mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
const MONGO_URI = "mongodb+srv://ppuki162_db_user:9FjRUKatWMrM4nZA@cluster0.bicecd4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// ✅ إعدادات اتصال أقوى (أفضل من مشاكل TLS)
const mongoClient = new MongoClient(MONGO_URI, {
  tls: true,
  serverSelectionTimeoutMS: 15000,
});

let db;

async function connectMongo() {
  try {
    await mongoClient.connect();
    db = mongoClient.db("anime_shadow_bot");
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.log("❌ MongoDB Error:", err?.message || err);
  }
}
connectMongo();
// بعد الاتصال، اسحب بيانات المستخدمين من Mongo واعتبرها المصدر الحقيقي
async function connectMongo() {
  try {
    await mongoClient.connect();
    db = mongoClient.db("anime_shadow_bot");
    console.log("✅ MongoDB Connected");

    // ✅ بعد الاتصال مباشرة اسحب المستخدمين من Mongo
    const mongoUsers = await loadUsersFromMongo();

    // ✅ دمج: Mongo يغلب json
    users = { ...users, ...mongoUsers };

    // ✅ احفظ محلياً (اختياري)
    saveUsers();

    console.log("✅ users loaded from MongoDB:", Object.keys(users).length);
  } catch (err) {
    console.log("❌ MongoDB Error:", err?.message || err);
  }
}

// ⚠️ حط توكنك هنا
const BOT_TOKEN = "7976169299:AAETNdgYqS84r2wr9StV9oWVfxYkivFp7zs";
if (!BOT_TOKEN || BOT_TOKEN === "PUT_YOUR_BOT_TOKEN_HERE") {
  throw new Error("BOT_TOKEN is missing. Put your token in BOT_TOKEN.");
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const USERS_FILE = path.join(__dirname, "users.json");
const PENDING_FILE = path.join(__dirname, "pendingOrders.json");
const CODES_FILE = path.join(__dirname, "codes.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");

// =====================
// ✅ SMMLOX API (مباشر)
// =====================
const API_URL = "https://smmlox.com/api/v2";
const API_KEY = "cbfc807f1983d1ee38283a3c19219a9b"; // 🔑 مفتاحك

// ✅ قنوات الاشتراك (اختياري)
const channels = [
  { name: "📢 قناة الأخبار", link: "https://t.me/balul344" },
  { name: "📢 قناة العروض", link: "https://t.me/balul344" },
];

// نقاط الإحالة
const REFERRAL_BONUS = 30;

// نقاط الاشتراك بالقنوات
const CHANNEL_JOIN_POINTS = 5;

// =====================
// ✅ أرقام الخدمات (Service IDs)
// =====================


// 🎁 خدمات مجانية إضافية
const IG_REELS_FREE_VIEWS_SERVICE_ID = 10870; // 🎁 ريلز انستقرام مجاني
const TG_POST_FREE_VIEWS_SERVICE_ID = 10871; // 🎁 مشاهدات بوست تلجرام مجانية
const TWITTER_FREE_VIEWS_SERVICE_ID = 10872; // 🎁 مشاهدات تغريدة تويتر مجانية
const TG_POST_REACTIONS_FREE_SERVICE_ID = 10913; // 🎁 تفاعل بوست تلجرام ايموجي
const TIKTOK_FREE_VIEWS_SERVICE_ID = 10869; // 🎁 مشاهدات تيك توك مجانية
const TIKTOK_FOLLOWERS_LIFETIME_SERVICE_ID = 10932; // 👥 متابعين تيك توك (مدى الحياة)
const TIKTOK_LIKES_SERVICE_ID = 10927; // ❤️ اعجابات تيك توك (اضافة جديدة)

// 📸 انستقرام
const IG_LIKES_SERVICE_ID = 10641; // ❤️ لايكات انستقرام
const IG_SHARES_SERVICE_ID = 10901; // 🔁 مشاركات انستقرام
const IG_COMMENTS_SERVICE_ID = 5431; // 💬 تعليقات عشوائية انستقرام
const IG_FOLLOWERS_LIFETIME_SERVICE_ID = 10945; // 👥 متابعين انستقرام (مدى الحياة)

// ▶️ يوتيوب
const YOUTUBE_LIKES_SERVICE_ID = 10943; // 👍 اعجابات يوتيوب

// 👍 فيسبوك
const FB_STORY_VIEWS_SERVICE_ID = 9191; // 👁 ستوري فيسبوك
const FB_REACTIONS_HEART_SERVICE_ID = 9037; // ❤️ تفاعلات قلب
const FB_FOLLOWERS_LIFETIME_SERVICE_ID = 5574; // 👥 متابعين فيسبوك (مدى الحياة)

// 📡 تيليجرام
const TELEGRAM_FOLLOWERS_SERVICE_ID = 6261; // 👥 متابعين تلغرام
const TELEGRAM_PREMIUM_VIEWS_SERVICE_ID = 10908; // 🌟 مشاهدات مميزة بريميوم

const ORDER_TYPE_TO_SERVICE_ID = {

  ttviews: VIEWS_SERVICE_ID,
  freeviews: TIKTOK_FREE_VIEWS_SERVICE_ID,
  ttfollowers: TIKTOK_FOLLOWERS_LIFETIME_SERVICE_ID,
  ttlikes_new: TIKTOK_LIKES_SERVICE_ID,

  // 🎁 خدمات مجانية
  igfreeviews: IG_REELS_FREE_VIEWS_SERVICE_ID,
  tgpostfreeviews: TG_POST_FREE_VIEWS_SERVICE_ID,
  twitterfreeviews: TWITTER_FREE_VIEWS_SERVICE_ID,
  tgpostreactions: TG_POST_REACTIONS_FREE_SERVICE_ID,

  // انستقرام
  iglikes: IG_LIKES_SERVICE_ID,
  igshares: IG_SHARES_SERVICE_ID,
  igcomments: IG_COMMENTS_SERVICE_ID,
  igfollowers: IG_FOLLOWERS_LIFETIME_SERVICE_ID,

  // يوتيوب
  youtubelikes: YOUTUBE_LIKES_SERVICE_ID,

  // فيسبوك
  fbstory: FB_STORY_VIEWS_SERVICE_ID,
  fbreactions: FB_REACTIONS_HEART_SERVICE_ID,
  fbfollowers: FB_FOLLOWERS_LIFETIME_SERVICE_ID,

  // تيليجرام
  tgfollowers: TELEGRAM_FOLLOWERS_SERVICE_ID,
  tgpremiumviews: TELEGRAM_PREMIUM_VIEWS_SERVICE_ID,
};

// =====================
// ✅ بوابة إنشاء الأكواد (زر ظاهر)
// =====================
const LOCKED_BTN_TEXT = "🚫 المشرف";
const LOCKED_PASSWORD = "PUT_YOUR_LOCKED_PASSWORD_HERE"; // غيرها
const CREATE_CODE_COST = 10000;  // كلفة الإنشاء
const DEFAULT_MAX_USES = 4;      // إذا تخطي العدد

// الأدمن
const ADMIN_CHAT_ID = "5571001437";
const SECRET_OPEN = "/!(12345)/!?أنمي شادو افتح";

// =====================
// 2) HELPERS: load/save
// =====================

// =====================
// 2) HELPERS: load/save  ✅ FIXED
// =====================

function loadJSONSafe(file, fallback) {
  const bak = file + ".bak";
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      if (raw && raw.trim().length) return JSON.parse(raw);
    }
  } catch (e) {
    console.error("loadJSONSafe main failed:", file, e);
  }

  // جرّب نسخة احتياطية
  try {
    if (fs.existsSync(bak)) {
      const raw = fs.readFileSync(bak, "utf8");
      if (raw && raw.trim().length) return JSON.parse(raw);
    }
  } catch (e) {
    console.error("loadJSONSafe bak failed:", bak, e);
  }

  return fallback;
}

function saveJSONSafe(file, data) {
  const tmp = file + ".tmp";
  const bak = file + ".bak";
  try {
    const json = JSON.stringify(data, null, 2);

    // اكتب ملف مؤقت
    fs.writeFileSync(tmp, json, "utf8");

    // انسخ القديم كنسخة احتياطية
    if (fs.existsSync(file)) {
      try { fs.copyFileSync(file, bak); } catch (_) {}
    }

    // بدّل بشكل آمن
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error("saveJSONSafe error:", file, e);
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
  }
}

// =====================
// ✅ Mongo Users Persist (FIXED)
// =====================
let saveUsersTimer = null;

async function loadUsersFromMongo() {
  if (!db) return {};
  const col = db.collection("users");
  const docs = await col.find({}).toArray();

  const map = {};
  for (const d of docs) {
    const { _id, chatId, ...rest } = d;
    if (!chatId) continue;
    map[String(chatId)] = rest;
  }
  return map;
}

async function flushUsersToMongo() {
  if (!db) return;
  const col = db.collection("users");

  const entries = Object.entries(users || {});
  if (!entries.length) return;

  const ops = entries.map(([chatId, u]) => ({
    updateOne: {
      filter: { chatId: String(chatId) },
      update: { $set: { chatId: String(chatId), ...u } },
      upsert: true,
    }
  }));

  await col.bulkWrite(ops, { ordered: false });
}

// ✅ هذه هي الدالة الصح: تحفظ محلي + تسوي مزامنة Mongo بدون recursion
function saveUsers() {
  // 1) حفظ محلي (حتى لو Mongo فصل)
  saveJSONSafe(USERS_FILE, users);

  // 2) حفظ على Mongo (Debounce)
  if (!db) return;
  clearTimeout(saveUsersTimer);
  saveUsersTimer = setTimeout(() => {
    flushUsersToMongo().catch((e) => {
      console.log("❌ flushUsersToMongo error:", e?.message || e);
    });
  }, 400);
}

// ✅ لما ينطفي السيرفر حاول احفظ آخر نسخة
async function shutdownAndSave() {
  try { saveJSONSafe(USERS_FILE, users); } catch (_) {}
  try { await flushUsersToMongo(); } catch (_) {}
  process.exit(0);
}

process.on("SIGINT", shutdownAndSave);
process.on("SIGTERM", shutdownAndSave);

function saveJSONSafe(file, data) {
  const tmp = file + ".tmp";
  const bak = file + ".bak";
  try {
    const json = JSON.stringify(data, null, 2);

    // اكتب ملف مؤقت
    fs.writeFileSync(tmp, json, "utf8");

    // انسخ القديم كنسخة احتياطية
    if (fs.existsSync(file)) {
      try { fs.copyFileSync(file, bak); } catch (_) {}
    }

    // بدّل بشكل آمن
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error("saveJSONSafe error:", file, e);
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
  }
}


function normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

let users = loadJSONSafe(USERS_FILE, {});
let pendingOrders = loadJSONSafe(PENDING_FILE, {});
let orders = loadJSONSafe(ORDERS_FILE, []);
let codes = loadJSONSafe(CODES_FILE, {
  k100SHYRHRHFHHDD: { points: 400000000000000000000000000000, usedBy: [], maxUses: 1 },
  BOT100: { points: 50, usedBy: [], maxUses: 5 },
  Shadhfhghg5JDDJ757ow: { points: 10, usedBy: [], maxUses: 2 },
});

function saveCodes() { saveJSONSafe(CODES_FILE, codes); }
function saveOrders() { saveJSONSafe(ORDERS_FILE, orders); }



// =====================
// 3) USERS + STATE
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
      isActive: true,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      state: { page: "HOME", lastMsgId: null, tmp: {} },
    };
    saveUsers();
    return users[chatId];
  }

  const u = users[chatId];

  if (!u.uid) u.uid = String(Math.floor(1000000000 + Math.random() * 9000000000));
  if (typeof u.points !== "number" || !Number.isFinite(u.points)) u.points = 0;
  if (!u.joinedChannels) u.joinedChannels = [];
  if (!u.referrals) u.referrals = [];
  if (!u.state) u.state = { page: "HOME", lastMsgId: null, tmp: {} };
  if (!u.state.tmp) u.state.tmp = {};
  if (typeof u.isActive !== "boolean") u.isActive = true;
  if (!u.createdAt) u.createdAt = new Date().toISOString();
  if (!u.lastSeen) u.lastSeen = new Date().toISOString();

  saveUsers();
  return u;
}

function setLastMessage(chatId, messageId) {
  const u = ensureUser(chatId);
  u.state.lastMsgId = messageId;
  saveUsers();
}

function getLastMessage(chatId) {
  return ensureUser(chatId).state.lastMsgId;
}

function setPage(chatId, page) {
  const u = ensureUser(chatId);
  u.state.page = page;
  saveUsers();
}

// =====================
// 4) API: إرسال طلب مباشر لـ SMMLOX
// =====================
async function sendOrderDirect({ service, link, quantity }) {
  const payload = {
    key: API_KEY,
    action: "add",
    service,
    link,
    quantity,
  };

  const res = await axios.post(API_URL, qs.stringify(payload), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });

  return res.data;
}

// =====================
// 5) UI BUILDERS
// =====================
function homeText(u) {
  return `مرحبًا بك في بوت تطبيق انمي شادو 👋🫂

💰 نقاطك: ${u.points}
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
      [
        { text: "💎 أسعار النقاط", callback_data: "NAV:PRICES" }
      ],
      [
        { text: "📜 الشروط", callback_data: "NAV:TERMS" },
        { text: LOCKED_BTN_TEXT, callback_data: "NAV:LOCKED_GATE" },
      ],
    ],
  };
}
function backToHomeKeyboard() {
  return { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]] };
}

function servicesKeyboard() {
  return {
    inline_keyboard: [
      // 🎬 تيك توك
      [{ text: "👥 متابعين تيك توك (مدى الحياة)", callback_data: "NAV:SVC_TT_FOLLOWERS" }],
      [{ text: "🎁 مشاهدات تيك توك مجانية", callback_data: "NAV:SVC_TT_FREEVIEWS" }],
      [{ text: "🎁 مشاهدات ريلز انستقرام مجانية", callback_data: "NAV:SVC_IG_FREEVIEWS" }],
      [{ text: "🎁 مشاهدات بوست تلجرام مجانية", callback_data: "NAV:SVC_TG_POST_FREE" }],
      [{ text: "🎁 مشاهدات تغريدة تويتر مجانية", callback_data: "NAV:SVC_TWITTER_FREE" }],
      [{ text: "🎁 تفاعل بوست تلجرام (ايموجي)", callback_data: "NAV:SVC_TG_REACTIONS_FREE" }],
      [{ text: "❤️ اعجابات تيك توك (جديدة)", callback_data: "NAV:SVC_TT_LIKES_NEW" }],

      // 📸 انستقرام
      [{ text: "👥 متابعين إنستقرام (مدى الحياة)", callback_data: "NAV:SVC_IG_FOLLOWERS" }],
      [{ text: "❤️ اعجابات إنستقرام", callback_data: "NAV:SVC_IG_LIKES" }],
      [{ text: "🔁 مشاركات إنستقرام", callback_data: "NAV:SVC_IG_SHARES" }],
      [{ text: "💬 تعليقات عشوائية إنستقرام", callback_data: "NAV:SVC_IG_COMMENTS" }],

      // ▶️ يوتيوب
      [{ text: "👍 اعجابات يوتيوب", callback_data: "NAV:SVC_YT_LIKES" }],

      // 📘 فيسبوك
      [{ text: "📘 مشاهدات ستوري فيسبوك", callback_data: "NAV:SVC_FB_STORY" }],
      [{ text: "❤️ تفاعلات قلب فيسبوك", callback_data: "NAV:SVC_FB_REACTIONS" }],
      [{ text: "👥 متابعين فيسبوك (مدى الحياة)", callback_data: "NAV:SVC_FB_FOLLOWERS" }],

      // 📡 تيليجرام
      [{ text: "👥 متابعين تيليجرام", callback_data: "NAV:SVC_TG_FOLLOWERS" }],
      [{ text: "🌟 مشاهدات تيليجرام بريميوم", callback_data: "NAV:SVC_TG_PREMIUM_VIEWS" }],

      // 🔙 رجوع
      [{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }],
    ],
  };
}

function maxUsesKeyboardLocked() {
  return {
    inline_keyboard: [
      [
        { text: "1", callback_data: "LOCKED_MAX:1" },
        { text: "2", callback_data: "LOCKED_MAX:2" },
        { text: "3", callback_data: "LOCKED_MAX:3" },
        { text: "4", callback_data: "LOCKED_MAX:4" },
      ],
      [{ text: "⏭ تخطي", callback_data: "LOCKED_MAX:SKIP" }],
      [{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }],
    ],
  };
}

function createLockedKeyboard() {
  return {
    inline_keyboard: [
      [{ text: `✅ إنشاء (${CREATE_CODE_COST})`, callback_data: "LOCKED_CREATE:DO" }],
      [{ text: "⬅️ رجوع إلى الاقسام", callback_data: "NAV:HOME" }],
    ],
  };
}

// =====================
// 6) EDIT / SEND SAFE
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
// 7) REFERRAL
// =====================
function makeReferralLink(u) {
  const botUsername = "BlueMoonBot_2025Bot"; // غيره ليوزر بوتك الحقيقي
  return `https://t.me/${botUsername}?start=ref_${u.uid}`;
}

// =====================
// 8) SERVICES PRICES
// =====================
// 🎬 تيك توك (مشاهدات)

const igLikePrices = { 5: 40, 10: 50, 18: 80, 90: 200 };
const igSharePrices = { 20: 60, 50: 150, 180: 300, 250: 700 };
const fbStoryPrices = { 10: 60, 30: 130, 50: 200, 100: 270 };
const tgFollowerPrices = { 10: 80, 20: 160, 30: 210, 40: 260, 50: 310, 500: 600, 1000: 1000 };
const ttFollowersPrices = { 500: 5000, 1000: 10000, 30: 2000 }; // مثال (غيرها حسب سعر نقاطك)
const igFollowersPrices = { 10: 1500, 100: 3000, 1000: 15000, 10000: 49000 };

// 🎬 تيك توك (اعجابات جديدة)
const ttLikesNewPrices = { 10: 90, 100: 400, 500: 900, 1000: 1450, 10000: 8000 };

// 📸 انستقرام (تعليقات عشوائية)
const igCommentsPrices = { 10: 500, 100: 1200, 1000: 26000, 10000: 55000 };

// ▶️ يوتيوب (اعجابات)
const youtubeLikesPrices = { 100: 700, 500: 1500, 1000: 2200, 10000: 9700, 20000: 19000 };

// 📘 فيسبوك (تفاعلات قلب)
const fbReactionsPrices = { 10: 60, 20: 90, 50: 190, 100: 290, 1000: 1280, 5000: 4080, 10000: 19000, 50000: 45000 };

// 📘 فيسبوك (متابعين مدى الحياة)
const fbFollowersPrices = { 20: 1000, 100: 3500, 1000: 13000, 10000: 26000 };

// 📡 تيليجرام (مشاهدات بريميوم)
const tgPremiumViewsPrices = { 100: 200, 500: 400, 1000: 2200, 5000: 4000, 10000: 9000 };

// =====================
// 9) MENUS HELPERS
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
    const row = [{ text: `${a.label}`, callback_data: `${prefix}:${a.qty}` }];
    if (b) row.push({ text: `${b.label}`, callback_data: `${prefix}:${b.qty}` });
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
// 10) BALANCE GUARD
// =====================
function requireBalanceOrWarn(chatId, user, cost) {
  if (user.points < cost) {
    editOrSend(chatId, `❌ رصيدك غير كافي.\n\n💰 السعر: ${cost}\n💎 رصيدك: ${user.points}`, backToHomeKeyboard());
    return false;
  }
  return true;
}

// =====================
// 11) Pending orders
// =====================
function setPending(chatId, order) {
  pendingOrders[chatId] = order;
  saveJSONSafe(PENDING_FILE, pendingOrders);
}

function clearPending(chatId) {
  delete pendingOrders[chatId];
  saveJSONSafe(PENDING_FILE, pendingOrders);
}

function genOrderId() {
  return "ORD" + Date.now().toString(10) + Math.floor(100 + Math.random() * 900);
}

// =====================
// 12) ADMIN
// =====================
function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

function adminKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🧾 كتابة كود نقاط", callback_data: "NAV:MAKE_POINTS_CODE" }],
      [{ text: "⬅️ رجوع للأقسام", callback_data: "NAV:HOME" }],
    ],
  };
}

function genCode(len = 10) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// =====================
// 13) /start + Anti-spam referral
// =====================
const BOT_CHANNEL = "@balul344"; // <-- غيّرها لقناتك
const REF_WINDOW_MS = 10 * 60 * 1000; // 10 دقائق
const REF_MAX_IN_WINDOW = 5;          // أكثر من 5 إحالات خلال النافذة = رشق
const REF_BLOCK_MS = 60 * 60 * 1000;  // حظر ساعة على الإحالات

function _now() { return Date.now(); }

async function isJoinedChannel(userId) {
  try {
    const m = await bot.getChatMember(BOT_CHANNEL, userId);
    return ["member", "administrator", "creator"].includes(m.status);
  } catch (e) {
    return false;
  }
}

function markAndCheckReferrerSuspicious(refChatId) {
  if (!users[refChatId]) return true;

  users[refChatId].refStats = users[refChatId].refStats || { stamps: [], blockedUntil: 0 };

  const t = _now();

  if (users[refChatId].refStats.blockedUntil && users[refChatId].refStats.blockedUntil > t) {
    return true;
  }

  users[refChatId].refStats.stamps = (users[refChatId].refStats.stamps || [])
    .filter(s => (t - s) <= REF_WINDOW_MS);

  users[refChatId].refStats.stamps.push(t);

  if (users[refChatId].refStats.stamps.length > REF_MAX_IN_WINDOW) {
    users[refChatId].refStats.blockedUntil = t + REF_BLOCK_MS;
    return true;
  }

  return false;
}

bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = String(msg.chat.id);

  const isBrandNewUser = !users[chatId];
  const u = ensureUser(chatId);

  u.lastSeen = new Date().toISOString();
  u.isActive = true;

  const payload = match && match[1] ? String(match[1]).trim() : null;

  if (isBrandNewUser && payload && payload.startsWith("ref_")) {
    const refUid = payload.slice(4);

    if (!u.referredBy && refUid && refUid !== u.uid) {
      const refChatId = Object.keys(users).find((cid) => users[cid]?.uid === refUid);

      if (refChatId) {
        u.referredBy = refUid;

        const joined = await isJoinedChannel(msg.from.id);
        if (!joined) {
          saveUsers();
          bot.sendMessage(chatId, "❌ حتى تنحسب الإحالة لازم تشترك بالقناة أولاً.").catch(() => {});
          await showHome(chatId);
          return;
        }

        const suspicious = markAndCheckReferrerSuspicious(refChatId);
        if (suspicious) {
          saveUsers();

          bot.sendMessage(
            refChatId,
            "⚠️ تم رصد نشاط إحالات غير طبيعي (رشق).\n❌ تم تعطيل نقاط الإحالة مؤقتاً."
          ).catch(() => {});

          await showHome(chatId);
          return;
        }

        users[refChatId].points = (users[refChatId].points || 0) + REFERRAL_BONUS;
        users[refChatId].referrals = users[refChatId].referrals || [];
        users[refChatId].referrals.push(chatId);

        saveUsers();

        bot.sendMessage(
          refChatId,
          `🎉 انضم عضو جديد عبر رابطك!\n✅ تمت إضافة ${REFERRAL_BONUS} نقطة لحسابك 💰`
        ).catch(() => {});
      }
    }
  }

  saveUsers();
  await showHome(chatId);
});

// =====================
// 14) CALLBACK ROUTER
// =====================
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const u = ensureUser(chatId);

  try { await bot.answerCallbackQuery(q.id); } catch (_) {}

  const data = q.data || "";

  if (data.startsWith("NAV:")) {
    const action = data.split(":")[1];

    if (action === "HOME") return showHome(chatId);

    if (action === "MEMBERS") {
      const all = Object.keys(users).length;
      const active = Object.values(users).filter(x => x && x.isActive).length;
      return editOrSend(chatId, `👥 عدد المشتركين:\n\n✅ الكل: ${all}\n🟢 الفعّالين: ${active}`, backToHomeKeyboard());
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


    if (data === "NAV:PRICES") {

const msg =` 
💎 *أسعار نقاط البوت*

$5 = 20000 نقطة 💎
$10 = 33000 نقطة 💎
$20 = 57000 نقطة 💎
$50 = 105000 نقطة 💎
$150 = 200000 نقطة 💎

━━━━━━━━━━━━━━

📩 *لشراء النقاط تواصل معنا من هنا:*
`;

bot.sendMessage(chatId, msg, {
parse_mode: "Markdown",
reply_markup: {
inline_keyboard: [
[
{ text: "📨 تواصل للشراء", url: "https://t.me/GWVEW" }
]
]
}
});

}

    if (action === "SERVICES") return showServices(chatId);

    if (action === "LOCKED_GATE") {
      u.state.tmp.locked = { step: "WAIT_ID", flow: {} };
      saveUsers();
      return bot.sendMessage(chatId, "🚫 بوابة محظورة\n\n🔢 اكتب الايدي مالك:");
    }

    if (action === "CODE") {
      u.state.tmp.useCode = { step: "WAIT_CODE" };
      saveUsers();
      return bot.sendMessage(chatId, "🔑 اكتب الكود:");
    }

    if (action === "SHARE_POINTS") {
      u.state.tmp.share = { step: "WAIT_FRIEND_ID" };
      saveUsers();
      return bot.sendMessage(chatId, "🔢 أدخل ID صديقك لمشاركة النقاط:");
    }

    if (action === "DAILY") {
      const lastGiftTime = u.lastGift ? moment(u.lastGift) : null;
      const now = moment();

      if (!lastGiftTime || now.diff(lastGiftTime, "hours") >= 24) {
        u.points += 10;
        u.lastGift = now.toISOString();
        saveUsers();
        return editOrSend(chatId, "🎁 حصلت على 10 نقاط كمكافأة يومية!", backToHomeKeyboard());
      }
      return editOrSend(chatId, "⏳ يمكنك استلام الهدية بعد 24 ساعة.", backToHomeKeyboard());
    }

    if (action === "COLLECT") {
      const available = channels.filter(ch => !u.joinedChannels.includes(ch.link));
      if (available.length === 0) return editOrSend(chatId, "✅ لقد اشتركت في جميع القنوات المتاحة.", backToHomeKeyboard());

      const buttons = available.map(ch => [{ text: ch.name, url: ch.link }]);
      buttons.push([{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]);

      await editOrSend(chatId, "📢 اشترك بالقنوات التالية للحصول على نقاط:", { inline_keyboard: buttons });

      setTimeout(() => {
        const uu = ensureUser(chatId);
        uu.points += CHANNEL_JOIN_POINTS;
        uu.joinedChannels.push(available[0].link);
        saveUsers();
        bot.sendMessage(chatId, `✅ حصلت على ${CHANNEL_JOIN_POINTS} نقاط!`);
      }, 5000);

      return;
    }

    if (action === "MAKE_POINTS_CODE") {
      if (!isAdmin(chatId)) return;
      u.state.tmp.admin = { step: "WAIT_POINTS_EACH" };
      saveUsers();
      return bot.sendMessage(chatId, "✍️ اكتب عدد النقاط لكل شخص (مثلاً 10):");
    }

    // خدمات
    

    if (action === "SVC_TT_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين تيك توك (مدى الحياة)\nاختر الكمية:", "BUY:TTFOLLOW", ttFollowersPrices, "NAV:SERVICES");

    if (action === "SVC_TT_FREEVIEWS") {
      return editOrSend(chatId, "🎁 مشاهدات تيك توك مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        inline_keyboard: [
          [{ text: "100 مشاهدة مجانية", callback_data: "BUY:FREEVIEWS:100" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }

    if (action === "SVC_IG_FREEVIEWS") {
      return editOrSend(chatId, "🎁 مشاهدات ريلز انستقرام مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        inline_keyboard: [
          [{ text: "100 مشاهدة مجانية", callback_data: "BUY:IGFREEVIEWS:100" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }

    if (action === "SVC_TG_POST_FREE") {
      return editOrSend(chatId, "🎁 مشاهدات بوست تلجرام مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        inline_keyboard: [
          [{ text: "100 مشاهدة مجانية", callback_data: "BUY:TGPOSTFREEVIEWS:100" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }

    if (action === "SVC_TWITTER_FREE") {
      return editOrSend(chatId, "🎁 مشاهدات تغريدة تويتر مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        inline_keyboard: [
          [{ text: "100 مشاهدة مجانية", callback_data: "BUY:TWITTERFREEVIEWS:100" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }

    if (action === "SVC_TG_REACTIONS_FREE") {
      return editOrSend(chatId, "🎁 تفاعل بوست تلجرام (ايموجي) مجاني\n\nكل 50 تفاعل = 0 عملة", {
        inline_keyboard: [
          [{ text: "50 تفاعل مجاني", callback_data: "BUY:TGPOSTREACTIONS:50" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }

    if (action === "SVC_TT_LIKES_NEW") return showQtyMenu(chatId, "❤️ اعجابات تيك توك (جديدة)\nاختر الكمية:", "BUY:TTLIKESNEW", ttLikesNewPrices, "NAV:SERVICES");
    if (action === "SVC_IG_COMMENTS") return showQtyMenu(chatId, "💬 تعليقات عشوائية إنستقرام\nاختر الكمية:", "BUY:IGCOMMENTS", igCommentsPrices, "NAV:SERVICES");
    if (action === "SVC_YT_LIKES") return showQtyMenu(chatId, "👍 اعجابات يوتيوب\nاختر الكمية:", "BUY:YOUTUBELIKES", youtubeLikesPrices, "NAV:SERVICES");
    if (action === "SVC_FB_REACTIONS") return showQtyMenu(chatId, "❤️ تفاعلات قلب فيسبوك\nاختر الكمية:", "BUY:FBREACTIONS", fbReactionsPrices, "NAV:SERVICES");
    if (action === "SVC_FB_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين فيسبوك (مدى الحياة)\nاختر الكمية:", "BUY:FBFOLLOWERS", fbFollowersPrices, "NAV:SERVICES");
    if (action === "SVC_TG_PREMIUM_VIEWS") return showQtyMenu(chatId, "🌟 مشاهدات تيليجرام بريميوم\nاختر الكمية:", "BUY:TGPREMIUMVIEWS", tgPremiumViewsPrices, "NAV:SERVICES");

    if (action === "SVC_IG_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين إنستقرام (مدى الحياة)\nاختر الكمية:", "BUY:IGFOLLOW", igFollowersPrices, "NAV:SERVICES");
    if (action === "SVC_TG_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين تلغرام\nاختر الكمية:", "BUY:TGFOLLOW", tgFollowerPrices, "NAV:SERVICES");
    if (action === "SVC_IG_LIKES") return showQtyMenu(chatId, "❤️ اعجابات إنستقرام\nاختر الكمية:", "BUY:IGLIKES", igLikePrices, "NAV:SERVICES");
    if (action === "SVC_IG_SHARES") return showQtyMenu(chatId, "🔁 مشاركات إنستقرام\nاختر الكمية:", "BUY:IGSHARES", igSharePrices, "NAV:SERVICES");
    if (action === "SVC_FB_STORY") return showQtyMenu(chatId, "📘 مشاهدات ستوري فيسبوك\nاختر الكمية:", "BUY:FBSTORY", fbStoryPrices, "NAV:SERVICES");
  }

  // بوابة الأكواد: اختيار maxUses
  if (data.startsWith("LOCKED_MAX:")) {
    if (!u.state?.tmp?.locked || u.state.tmp.locked.step !== "WAIT_MAX_CHOICE") return;

    const val = data.split(":")[1];
    let maxUses = DEFAULT_MAX_USES;

    if (val !== "SKIP") {
      const n = parseInt(val, 10);
      if (Number.isFinite(n) && n > 0) maxUses = n;
    }

    u.state.tmp.locked.flow.maxUses = maxUses;
    u.state.tmp.locked.step = "READY_CREATE";
    saveUsers();

    const flow = u.state.tmp.locked.flow;
    return editOrSend(
      chatId,
      `✅ جاهز للإنشاء\n\n🧾 الكود: ${flow.code}\n⭐️ النقاط لكل شخص: ${flow.points}\n👥 عدد المستخدمين: ${flow.maxUses}\n\n💸 كلفة الإنشاء: ${CREATE_CODE_COST} نقطة\nاضغط إنشاء:`,
      createLockedKeyboard()
    );
  }

  // إنشاء الكود
  if (data === "LOCKED_CREATE:DO") {
    const lock = u.state?.tmp?.locked;
    if (!lock || lock.step !== "READY_CREATE") return bot.sendMessage(chatId, "❌ أكو نقص بالخطوات. افتح البوابة من جديد.");

    if (u.points < CREATE_CODE_COST) {
      return editOrSend(chatId, `❌ رصيدك غير كافي.\n\n💸 الكلفة: ${CREATE_CODE_COST}\n💎 رصيدك: ${u.points}`, backToHomeKeyboard());
    }

    const flow = lock.flow || {};
    const code = String(flow.code || "").trim();
    const points = parseInt(flow.points, 10);
    const maxUses = parseInt(flow.maxUses, 10);

    if (!code) return bot.sendMessage(chatId, "❌ الكود فارغ.");
    if (codes[code]) return bot.sendMessage(chatId, "❌ هذا الكود موجود مسبقًا.");
    if (!Number.isFinite(points) || points <= 0) return bot.sendMessage(chatId, "❌ نقاط الكود غير صحيحة.");
    if (!Number.isFinite(maxUses) || maxUses <= 0) return bot.sendMessage(chatId, "❌ عدد المستخدمين غير صحيح.");

    u.points -= CREATE_CODE_COST;

    codes[code] = { points, usedBy: [], maxUses, createdBy: u.uid, createdAt: new Date().toISOString() };

    saveUsers();
    saveCodes();

    u.state.tmp.locked = null;
    saveUsers();

    return editOrSend(
      chatId,
      `✅ تم انشاءه بنجاح!\n\n🧾 الكود: ${code}\n⭐️ لكل شخص: ${points} نقطة\n👥 عدد المستخدمين: ${maxUses}\n\n💸 تم خصم: ${CREATE_CODE_COST}\n💎 رصيدك الحالي: ${u.points}`,
      { inline_keyboard: [[{ text: "⬅️ رجوع إلى الاقسام", callback_data: "NAV:HOME" }]] }
    );
  }

  // شراء خدمة
  if (data.startsWith("BUY:")) {
    const parts = data.split(":");
    const type = parts[1];
    const qty = parseInt(parts[2], 10);

    let cost = 0;
    let askText = "";
    let orderType = "";


    if (type === "TTFOLLOW") { cost = ttFollowersPrices[qty] || 0; askText = "🔗 أرسل رابط حساب تيك توك:"; orderType = "ttfollowers"; }
    if (type === "FREEVIEWS") { cost = 0; askText = "🔗 أرسل رابط:"; orderType = "freeviews"; }
    if (type === "TGFOLLOW") { cost = tgFollowerPrices[qty] || 0; askText = "🔗 أرسل رابط (https://t.me/..):"; orderType = "tgfollowers"; }
    if (type === "IGLIKES") { cost = igLikePrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "iglikes"; }
    if (type === "IGSHARES") { cost = igSharePrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "igshares"; }
    if (type === "FBSTORY") { cost = fbStoryPrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "fbstory"; }
    if (type === "IGFOLLOW") { cost = igFollowersPrices[qty] || 0; askText = "🔗 أرسل رابط حساب إنستقرام:"; orderType = "igfollowers"; }

    // 🎁 مجانية
    if (type === "IGFREEVIEWS") { cost = 0; askText = "🔗 أرسل رابط ريلز انستقرام:"; orderType = "igfreeviews"; }
    if (type === "TGPOSTFREEVIEWS") { cost = 0; askText = "🔗 أرسل رابط بوست تلجرام:"; orderType = "tgpostfreeviews"; }
    if (type === "TWITTERFREEVIEWS") { cost = 0; askText = "🔗 أرسل رابط تغريدة تويتر:"; orderType = "twitterfreeviews"; }
    if (type === "TGPOSTREACTIONS") { cost = 0; askText = "🔗 أرسل رابط بوست تلجرام:"; orderType = "tgpostreactions"; }

    // خدمات جديدة
    if (type === "TTLIKESNEW") { cost = ttLikesNewPrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "ttlikes_new"; }
    if (type === "IGCOMMENTS") { cost = igCommentsPrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "igcomments"; }
    if (type === "YOUTUBELIKES") { cost = youtubeLikesPrices[qty] || 0; askText = "🔗 أرسل رابط فيديو اليوتيوب:"; orderType = "youtubelikes"; }
    if (type === "FBREACTIONS") { cost = fbReactionsPrices[qty] || 0; askText = "🔗 أرسل رابط منشور الفيسبوك:"; orderType = "fbreactions"; }
    if (type === "FBFOLLOWERS") { cost = fbFollowersPrices[qty] || 0; askText = "🔗 أرسل رابط صفحة الفيسبوك:"; orderType = "fbfollowers"; }
    if (type === "TGPREMIUMVIEWS") { cost = tgPremiumViewsPrices[qty] || 0; askText = "🔗 أرسل رابط منشور التليجرام:"; orderType = "tgpremiumviews"; }

    if (!orderType) return editOrSend(chatId, "❌ خيار غير صالح.", backToHomeKeyboard());
    if (cost > 0 && !requireBalanceOrWarn(chatId, u, cost)) return;

    const serviceId = ORDER_TYPE_TO_SERVICE_ID[orderType] || null;

    setPending(chatId, { orderType, qty, cost, step: "WAIT_LINK", serviceId });

    await editOrSend(chatId, `✅ تم اختيار: ${qty}\n💰 السعر: ${cost}\n🧩 رقم الخدمة: ${serviceId ?? "غير معروف"}\n\n📩 الآن ارسل المطلوب بالرسالة التالية.`, {
      inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }]],
    });

    return bot.sendMessage(chatId, askText);
  }
});

// =====================
// 15) SINGLE MESSAGE HANDLER
// =====================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const u = ensureUser(chatId);
  const text = normalizeText(msg.text);

  u.lastSeen = new Date().toISOString();
  u.isActive = true;
  saveUsers();

  if (text === SECRET_OPEN) {
    if (!isAdmin(chatId)) return;
    return editOrSend(chatId, "✅ تم فتح لوحة الأدمن.", adminKeyboard());
  }

  const pending = pendingOrders[chatId];
  if (pending && pending.step === "WAIT_LINK") {
    const link = text;
    if (!link || link.length < 4) return bot.sendMessage(chatId, "❌ الرابط/المعرف غير صحيح. ارسله مرة ثانية.");

    const orderId = genOrderId();
    const order = {
      orderId,
      chatId: String(chatId),
      uid: u.uid,
      orderType: pending.orderType,
      serviceId: pending.serviceId ?? null,
      qty: pending.qty,
      cost: pending.cost,
      link,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      remoteOrderId: null,
      apiResponse: null,
      apiError: null,
    };

    let deducted = 0;
    if (pending.cost > 0) {
      if (u.points < pending.cost) {
        clearPending(chatId);
        return bot.sendMessage(chatId, `❌ رصيدك غير كافي.\n💰 السعر: ${pending.cost}\n💎 رصيدك: ${u.points}`);
      }
      u.points -= pending.cost;
      deducted = pending.cost;
      saveUsers();
    }

    orders.push(order);
    saveOrders();
    clearPending(chatId);

    try {
      if (!order.serviceId) throw new Error("Missing serviceId");

      const apiResp = await sendOrderDirect({
        service: order.serviceId,
        link: order.link,
        quantity: order.qty,
      });

      order.apiResponse = apiResp;

      const remote = apiResp?.order || apiResp?.orderId || apiResp?.order_id || apiResp?.id || null;

      if (remote) {
        order.status = "SENT";
        order.remoteOrderId = String(remote);
      } else if (apiResp?.error) {
        order.status = "FAILED";
        order.apiError = String(apiResp.error);
      } else {
        order.status = "FAILED";
        order.apiError = JSON.stringify(apiResp);
      }

      if (order.status === "FAILED" && deducted > 0) {
        u.points += deducted;
        saveUsers();
      }

      saveOrders();
    } catch (e) {
      order.status = "FAILED";
      order.apiError = e?.response?.data ? JSON.stringify(e.response.data) : (e?.message || String(e));

      if (deducted > 0) {
        u.points += deducted;
        saveUsers();
      }

      saveOrders();
    }

    const remoteTxt = order.remoteOrderId ? `\n🌐 رقم الطلب بالموقع: ${order.remoteOrderId}` : "";
    const statusTxt = order.status === "SENT" ? "✅ تم الإرسال للموقع" : "❌ فشل الإرسال للموقع (تم ارجاع النقاط إذا انخصمت)";

    bot.sendMessage(
      chatId,
      `✅ تم إنشاء طلبك!\n\n🧾 رقم الطلب: ${order.orderId}${remoteTxt}\n🧩 رقم الخدمة: ${order.serviceId ?? "غير معروف"}\n🔢 الكمية: ${order.qty}\n💰 السعر: ${order.cost}\n🔗 المطلوب: ${order.link}\n\n${statusTxt}\n💎 رصيدك الحالي: ${u.points}`
    );

    bot.sendMessage(
      ADMIN_CHAT_ID,
      `📥 طلب جديد\n\n🧾 رقم الطلب: ${order.orderId}\n🌐 خارجي: ${order.remoteOrderId ?? "-"}\n🧩 رقم الخدمة: ${order.serviceId ?? "غير معروف"}\n👤 المستخدم: ${order.uid}\n🛍 النوع: ${order.orderType}\n🔢 الكمية: ${order.qty}\n💰 السعر: ${order.cost}\n🔗 المطلوب: ${order.link}\n📌 الحالة: ${order.status}\n🕒 ${order.createdAt}\n${order.apiError ? `\n⚠️ خطأ API: ${order.apiError}` : ""}`
    ).catch(() => {});

    return;
  }

  // بوابة الأكواد
  if (u.state?.tmp?.locked?.step === "WAIT_ID") {
    if (text !== u.uid) {
      u.state.tmp.locked = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ الايدي غير صحيح. ارجع اضغط زر البوابة من جديد.");
    }
    u.state.tmp.locked.step = "WAIT_PASS";
    saveUsers();
    return bot.sendMessage(chatId, "✅ تم التحقق من الايدي.\n\n🔐 اكتب كلمة السر:");
  }

  if (u.state?.tmp?.locked?.step === "WAIT_PASS") {
    if (text !== LOCKED_PASSWORD) {
      u.state.tmp.locked = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ كلمة السر غير صحيحة.");
    }
    u.state.tmp.locked = { step: "WAIT_CODE", flow: {} };
    saveUsers();
    return bot.sendMessage(chatId, "✅ تم فتح البوابة.\n\n✍️ اكتب الكود اللي تريد تنشئه:");
  }

  if (u.state?.tmp?.locked?.step === "WAIT_CODE") {
    const code = (text || "").trim();
    if (!code) return bot.sendMessage(chatId, "❌ اكتب كود صحيح.");
    if (codes[code]) return bot.sendMessage(chatId, "❌ هذا الكود موجود مسبقًا. اكتب كود غيره.");
    u.state.tmp.locked.flow = { code };
    u.state.tmp.locked.step = "WAIT_POINTS";
    saveUsers();
    return bot.sendMessage(chatId, "⭐️ اكتب كم نقطة يحصلون من هذا الكود؟ (مثلاً 10):");
  }

  if (u.state?.tmp?.locked?.step === "WAIT_POINTS") {
    const points = parseInt((text || "").trim(), 10);
    if (!Number.isFinite(points) || points <= 0) {
      return bot.sendMessage(chatId, "❌ لازم رقم صحيح أكبر من 0. اكتب النقاط مرة ثانية:");
    }
    u.state.tmp.locked.flow.points = points;
    u.state.tmp.locked.step = "WAIT_MAX_CHOICE";
    saveUsers();
    return editOrSend(chatId, "👥 اختر عدد الناس اللي يستخدمون الكود (1/2/3/4) أو تخطي:", maxUsesKeyboardLocked());
  }

  // استخدام الكود
  if (u.state?.tmp?.useCode?.step === "WAIT_CODE") {
    const code = text;
    const codeData = codes[code];

    if (!codeData) {
      u.state.tmp.useCode = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ كود غير صحيح أو انتهت صلاحيته.");
    }

    codeData.usedBy = codeData.usedBy || [];

    if (codeData.usedBy.includes(String(chatId))) {
      u.state.tmp.useCode = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ انت مستخدم هذا الكود من قبل.");
    }

    if (codeData.usedBy.length >= codeData.maxUses) {
      u.state.tmp.useCode = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ تم انتهاء صلاحيته.");
    }

    u.state.tmp.useCode = { step: "WAIT_ID", code };
    saveUsers();
    return bot.sendMessage(chatId, "🔢 اكتب ID مالك حتى تستلم النقاط:");
  }

  if (u.state?.tmp?.useCode?.step === "WAIT_ID") {
    const code = u.state.tmp.useCode.code;
    const codeData = codes[code];

    if (!codeData) {
      u.state.tmp.useCode = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ الكود غير موجود أو انتهى.");
    }

    if (text !== u.uid) {
      u.state.tmp.useCode = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ الـ ID اللي كتبته مو مالك.");
    }

    codeData.usedBy = codeData.usedBy || [];

    if (codeData.usedBy.includes(String(chatId))) {
      u.state.tmp.useCode = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ انت مستخدم هذا الكود من قبل.");
    }

    if (codeData.usedBy.length >= codeData.maxUses) {
      u.state.tmp.useCode = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ تم انتهاء صلاحيته.");
    }

    u.points += codeData.points;
    codeData.usedBy.push(String(chatId));

    if (codeData.usedBy.length >= codeData.maxUses) {
      delete codes[code];
    }

    saveUsers();
    saveCodes();

    u.state.tmp.useCode = null;
    saveUsers();

    return bot.sendMessage(chatId, `✅ تم إضافة ${codeData.points} نقطة إلى حسابك.\n💎 رصيدك الحالي: ${u.points}`);
  }

  // مشاركة النقاط
  if (u.state?.tmp?.share?.step === "WAIT_FRIEND_ID") {
    const friendUid = text;
    u.state.tmp.share.friendUid = friendUid;
    u.state.tmp.share.step = "WAIT_AMOUNT";
    saveUsers();
    return bot.sendMessage(chatId, "💰 أدخل عدد النقاط التي تريد إرسالها:");
  }

  if (u.state?.tmp?.share?.step === "WAIT_AMOUNT") {
    const amount = parseInt(text || "0", 10);
    const friendUid = u.state.tmp.share.friendUid;

    if (!Number.isFinite(amount) || amount <= 0) return bot.sendMessage(chatId, "❌ أدخل رقم صحيح.");
    if (amount > u.points) return bot.sendMessage(chatId, "❌ ليس لديك نقاط كافية.");

    const friendChatId = Object.keys(users).find(cid => users[cid]?.uid === friendUid);
    if (!friendChatId) {
      u.state.tmp.share = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ لم يتم العثور على هذا المستخدم.");
    }

    u.points -= amount;
    users[friendChatId].points += amount;
    saveUsers();

    u.state.tmp.share = null;
    saveUsers();

    bot.sendMessage(chatId, `✅ تم إرسال ${amount} نقطة إلى ID: ${friendUid}`);
    bot.sendMessage(friendChatId, `🎉 وصلك ${amount} نقطة من مستخدم آخر!`);
    return;
  }

  // أدمن: إنشاء كود نقاط
  if (u.state?.tmp?.admin?.step === "WAIT_POINTS_EACH") {
    const pointsEach = parseInt(text, 10);
    if (!Number.isFinite(pointsEach) || pointsEach <= 0) {
      u.state.tmp.admin = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ لازم رقم صحيح أكبر من 0.");
    }
    u.state.tmp.admin = { step: "WAIT_MAX_USES", pointsEach };
    saveUsers();
    return bot.sendMessage(chatId, "👥 اكتب عدد الأشخاص اللي يقدرون يستخدمون الكود (مثلاً 4):");
  }

  if (u.state?.tmp?.admin?.step === "WAIT_MAX_USES") {
    const maxUses = parseInt(text, 10);
    const pointsEach = u.state.tmp.admin.pointsEach;

    if (!Number.isFinite(maxUses) || maxUses <= 0) {
      u.state.tmp.admin = null;
      saveUsers();
      return bot.sendMessage(chatId, "❌ لازم رقم صحيح أكبر من 0.");
    }

    const totalCost = pointsEach * maxUses;
    if (u.points < totalCost) {
      u.state.tmp.admin = null;
      saveUsers();
      return bot.sendMessage(chatId, `❌ رصيدك غير كافي.\n💸 الكلفة: ${totalCost}\n💎 رصيدك: ${u.points}`);
    }

    u.points -= totalCost;
    saveUsers();

    let code = genCode(10);
    while (codes[code]) code = genCode(10);

    codes[code] = { points: pointsEach, usedBy: [], maxUses, createdBy: u.uid, createdAt: new Date().toISOString() };

    saveCodes();

    u.state.tmp.admin = null;
    saveUsers();

    return bot.sendMessage(
      chatId,
      `✅ تم إنشاء الكود!\n\n🧾 الكود: ${code}\n⭐️ لكل شخص: ${pointsEach}\n👥 العدد: ${maxUses}\n💸 تم خصم: ${totalCost}\n💎 رصيدك الحالي: ${u.points}`,
      { reply_markup: { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]] } }
    );
  }
});

// =====================
// Graceful Exit
// =====================
function gracefulExit(signal) {
  console.log(`\n🛑 ${signal}: saving...`);

  try { saveUsers(); } catch (_) {}
  try { saveJSONSafe(CODES_FILE, codes); } catch (_) {}
  try { saveJSONSafe(ORDERS_FILE, orders); } catch (_) {}

  try { bot.stopPolling(); } catch (_) {}
  process.exit(0);
}

process.on("SIGINT", () => gracefulExit("SIGINT"));
process.on("SIGTERM", () => gracefulExit("SIGTERM"));
