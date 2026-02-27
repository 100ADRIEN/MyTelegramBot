"use strict";
// =====================
// 🔥 FIREBASE SETUP
// =====================
const admin = require("firebase-admin");

let db = null;
let firebaseEnabled = false;

function initFirebase() {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DB_URL,
    });

    db = admin.database();
    firebaseEnabled = true;

    console.log("🔥 Firebase Connected");
  } catch (e) {
    console.log("⚠️ Firebase not enabled, fallback to JSON");
  }
}

initFirebase();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const qs = require("qs");
const moment = require("moment");

// =====================
// 1) CONFIG
// =====================

// ⚠️ حط توكنك داخل ملفك فقط
const BOT_TOKEN = "7976169299:AAETNdgYqS84r2wr9StV9oWVfxYkivFp7zs"; // نفس اللي دزيته
if (!BOT_TOKEN || BOT_TOKEN === "PUT_YOUR_TOKEN_HERE") {
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
const SERVICE_ID = 10880; // ❤️ لايكات تيك توك
const VIEWS_SERVICE_ID = 5202; // 👁 مشاهدات تيك توك
const IG_SHARES_SERVICE_ID = 10901; // 🔁 مشاركات انستقرام
const FB_STORY_VIEWS_SERVICE_ID = 9191; // 👁 ستوري فيسبوك
const TIKTOK_FREE_VIEWS_SERVICE_ID = 10869; // 🎁 مشاهدات تيك توك مجانية
const IG_LIKES_SERVICE_ID = 10641; // ❤️ لايكات انستقرام
const TELEGRAM_FOLLOWERS_SERVICE_ID = 6261; // 👥 متابعين تلغرام
const TIKTOK_FOLLOWERS_LIFETIME_SERVICE_ID = 10932; // 👥 متابعين تيك توك (مدى الحياة)
const IG_FOLLOWERS_LIFETIME_SERVICE_ID = 10945; // 👥 متابعين انستقرام (مدى الحياة)

const ORDER_TYPE_TO_SERVICE_ID = {
  ttlikes: SERVICE_ID,
  ttviews: VIEWS_SERVICE_ID,
  freeviews: TIKTOK_FREE_VIEWS_SERVICE_ID,
  iglikes: IG_LIKES_SERVICE_ID,
  igshares: IG_SHARES_SERVICE_ID,
  fbstory: FB_STORY_VIEWS_SERVICE_ID,
  tgfollowers: TELEGRAM_FOLLOWERS_SERVICE_ID,
  ttfollowers: TIKTOK_FOLLOWERS_LIFETIME_SERVICE_ID,
  igfollowers: IG_FOLLOWERS_LIFETIME_SERVICE_ID,
  
};

// =====================
// ✅ بوابة إنشاء الأكواد (زر ظاهر)
// =====================
const LOCKED_BTN_TEXT = "🚫 المشرف";
const LOCKED_PASSWORD = "QWERTYASDFG123##123Q2002#2004####123456789010#2026ًُ"; // غيرها
const CREATE_CODE_COST = 10000;  // كلفة الإنشاء
const DEFAULT_MAX_USES = 4;      // إذا تخطي العدد

// الأدمن
const ADMIN_CHAT_ID = "5571001437";
const SECRET_OPEN = "/!(12345)/!?أنمي شادو افتح";

// =====================
// 2) HELPERS: load/save
// =====================
async function loadJson(path, fallback) {
  if (!firebaseEnabled) {
    try {
      if (!fs.existsSync(path)) return fallback;
      return JSON.parse(fs.readFileSync(path, "utf8"));
    } catch (e) {
      console.error("❌ loadJson error:", e);
      return fallback;
    }
  }

  try {
    const key = path.replace(".json", "");
    const snap = await db.ref(key).once("value");
    return snap.val() || fallback;
  } catch (e) {
    console.error("❌ Firebase load error:", e);
    return fallback;
  }
}

async function loadJSON(file, fallback) {
  if (!firebaseEnabled) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.error("loadJSON error:", e);
    }
    return fallback;
  }

  try {
    const key = file.replace(".json", "");
    const snap = await db.ref(key).once("value");
    return snap.val() || fallback;
  } catch (e) {
    console.error("Firebase load error:", e);
    return fallback;
  }
}

function normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

let users = {};
let pendingOrders = {};
let orders = [];
let codes = {};

async function loadAllData() {
  users = await loadJSON(USERS_FILE, {});
  pendingOrders = await loadJSON(PENDING_FILE, {});
  orders = await loadJSON(ORDERS_FILE, []);
  codes = await loadJSON(CODES_FILE, {
    k100SHYRHRHFHHDD: { poinhgjjuyytfrdbjjts: 400000000000000000000000000000, usedBy: [], maxUses: 1 },
    BOT100: { points: 50, usedBy: [], maxUses: 5 },
    Shadhfhghg5JDDJ757ow: { points: 10, usedBy: [], maxUses: 2 },
  });
}

(async () => {
  await loadAllData();
})();

// =====================
// 3) USERS + STATE
// =====================
async function ensureUser(chatId) {
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

    await saveJson(USERS_FILE, users);
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

  saveJSON(USERS_FILE, users);
  return u;
}

function setLastMessage(chatId, messageId) {
  const u = ensureUser(chatId);
  u.state.lastMsgId = messageId;
  saveJSON(USERS_FILE, users);
}

function getLastMessage(chatId) {
  return ensureUser(chatId).state.lastMsgId;
}

function setPage(chatId, page) {
  const u = ensureUser(chatId);
  u.state.page = page;
  saveJSON(USERS_FILE, users);
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
      [{ text: "❤️ لايكات تيك توك", callback_data: "NAV:SVC_TT_LIKES" }],
      [{ text: "👁 مشاهدات تيك توك", callback_data: "NAV:SVC_TT_VIEWS" }],
      [{ text: "👥 متابعين تيك توك (مدى الحياة)", callback_data: "NAV:SVC_TT_FOLLOWERS" }],
      [{ text: "🎁 مشاهدات تيك توك مجانية", callback_data: "NAV:SVC_TT_FREEVIEWS" }],
      [{ text: "👥 متابعين إنستقرام (مدى الحياة)", callback_data: "NAV:SVC_IG_FOLLOWERS" }],
      [{ text: "❤️ اعجابات إنستقرام", callback_data: "NAV:SVC_IG_LIKES" }],
      [{ text: "🔁 مشاركات إنستقرام", callback_data: "NAV:SVC_IG_SHARES" }],
      [{ text: "📘 مشاهدات ستوري فيسبوك", callback_data: "NAV:SVC_FB_STORY" }],
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
const ttLikePrices = { 10: 5, 20: 10, 30: 20, 40: 30, 50: 40, 60: 50, 70: 60, 80: 70, 90: 80, 100: 90, 120: 100 };
const ttViewPrices = { 500: 50, 1000: 100, 1500: 150, 3000: 200 };
const igLikePrices = { 5: 40, 10: 50, 18: 80, 90: 200 };
const igSharePrices = { 20: 60, 50: 150, 180: 300, 250: 700 };
const fbStoryPrices = { 10: 60, 30: 130, 50: 200, 100: 270 };
const tgFollowerPrices = { 10: 80, 20: 160, 30: 210, 40: 260, 50: 310, 500: 600, 1000: 1000 };
const ttFollowersPrices = { 500: 5000, 1000: 10000, 30: 2000 }; // مثال (غيرها حسب سعر نقاطك)
const igFollowersPrices = {
  10: 500,
  30: 1000,
  100: 3000,
  500: 5000,
  1000: 10000,
};

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
  saveJSON(PENDING_FILE, pendingOrders);
}

function clearPending(chatId) {
  delete pendingOrders[chatId];
  saveJSON(PENDING_FILE, pendingOrders);
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
// 13) /start
// =====================
// ✅✅ إضافات (لا تمس كودك) — حطهن فوق /start
const BOT_CHANNEL = "@balul344"; // <-- غيّرها لقناتك
const REF_WINDOW_MS = 10 * 60 * 1000; // 10 دقائق
const REF_MAX_IN_WINDOW = 5;          // أكثر من 5 إحالات خلال النافذة = رشق
const REF_BLOCK_MS = 60 * 60 * 1000;  // حظر ساعة على الإحالات (للمُحيل المشبوه)

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

  // إذا محظور
  if (users[refChatId].refStats.blockedUntil && users[refChatId].refStats.blockedUntil > t) {
    return true;
  }

  // نظف النافذة
  users[refChatId].refStats.stamps = (users[refChatId].refStats.stamps || [])
    .filter(s => (t - s) <= REF_WINDOW_MS);

  // سجل محاولة إحالة
  users[refChatId].refStats.stamps.push(t);

  // إذا تجاوز الحد => اعتبر رشق واحبس الإحالات
  if (users[refChatId].refStats.stamps.length > REF_MAX_IN_WINDOW) {
    users[refChatId].refStats.blockedUntil = t + REF_BLOCK_MS;
    return true;
  }

  return false;
}


// ✅ كودك نفسه + إضافات شرطين فقط داخل بلوك الإحالة
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = String(msg.chat.id);

  // ✅ الشرط الأول: هل هذا المستخدم جديد (ما كان موجود بالملف قبل)؟
  const isBrandNewUser = !users[chatId];

  const u = ensureUser(chatId);

  u.lastSeen = new Date().toISOString();
  u.isActive = true;

  const payload = match && match[1] ? String(match[1]).trim() : null;

  // ✅ نظام الإحالة:
  // - فقط إذا المستخدم جديد فعلاً
  // - وداخل من رابط ref_
  // - وما سبق أخذ إحالة
  // - ومنع إحالة النفس
  if (isBrandNewUser && payload && payload.startsWith("ref_")) {
    const refUid = payload.slice(4);

    if (!u.referredBy && refUid && refUid !== u.uid) {
      const refChatId = Object.keys(users).find(
        (cid) => users[cid]?.uid === refUid
      );

      if (refChatId) {
        u.referredBy = refUid;

        // =========================
        // ✅✅ (الشرط الثاني القوي) لازم العضو الجديد يكون مشترك بالقناة
        // إذا مو مشترك => ما تنحسب إحالة وماكو نقاط
        const joined = await isJoinedChannel(msg.from.id);
        if (!joined) {
          // نخليها referredBy مسجلة (مثل ما انت كاتب) بس بدون نقاط إطلاقاً
          saveJSON(USERS_FILE, users);
          bot.sendMessage(chatId, "❌ حتى تنحسب الإحالة لازم تشترك بالقناة أولاً.").catch(() => {});
          await showHome(chatId);
          return;
        }

        // ✅✅ (الشرط الأول) كشف الرشق على المُحيل => نقاط = 0 نهائياً
        const suspicious = markAndCheckReferrerSuspicious(refChatId);
        if (suspicious) {
          // ما نضيف نقاط ولا referrals (خليها 0)
          saveJSON(USERS_FILE, users);

          bot.sendMessage(
            refChatId,
            "⚠️ تم رصد نشاط إحالات غير طبيعي (رشق).\n❌ تم تعطيل نقاط الإحالة مؤقتاً."
          ).catch(() => {});

          await showHome(chatId);
          return;
        }
        // =========================

        // ✅ إذا ماكو رشق + مشترك بالقناة => كمل كودك الطبيعي (نقاط)
        users[refChatId].points = (users[refChatId].points || 0) + REFERRAL_BONUS;
        users[refChatId].referrals = users[refChatId].referrals || [];
        users[refChatId].referrals.push(chatId);

        saveJSON(USERS_FILE, users);

        bot.sendMessage(
          refChatId,
          `🎉 انضم عضو جديد عبر رابطك!\n✅ تمت إضافة ${REFERRAL_BONUS} نقطة لحسابك 💰`
        ).catch(() => {});
      }
    }
  }

  saveJSON(USERS_FILE, users);
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

    if (action === "SERVICES") return showServices(chatId);

    if (action === "LOCKED_GATE") {
      u.state.tmp.locked = { step: "WAIT_ID", flow: {} };
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "🚫 بوابة محظورة\n\n🔢 اكتب الايدي مالك:");
    }

    if (action === "CODE") {
      u.state.tmp.useCode = { step: "WAIT_CODE" };
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "🔑 اكتب الكود:");
    }

    if (action === "SHARE_POINTS") {
      u.state.tmp.share = { step: "WAIT_FRIEND_ID" };
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "🔢 أدخل ID صديقك لمشاركة النقاط:");
    }

    if (action === "DAILY") {
      const lastGiftTime = u.lastGift ? moment(u.lastGift) : null;
      const now = moment();

      if (!lastGiftTime || now.diff(lastGiftTime, "hours") >= 24) {
        u.points += 10;
        u.lastGift = now.toISOString();
        saveJSON(USERS_FILE, users);
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
        saveJSON(USERS_FILE, users);
        bot.sendMessage(chatId, `✅ حصلت على ${CHANNEL_JOIN_POINTS} نقاط!`);
      }, 5000);

      return;
    }

    if (action === "MAKE_POINTS_CODE") {
      if (!isAdmin(chatId)) return;
      u.state.tmp.admin = { step: "WAIT_POINTS_EACH" };
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "✍️ اكتب عدد النقاط لكل شخص (مثلاً 10):");
    }

    // خدمات
    if (action === "SVC_TT_LIKES") return showQtyMenu(chatId, "❤️ لايكات تيك توك\nاختر الكمية:", "BUY:TTLIKES", ttLikePrices, "NAV:SERVICES");
    if (action === "SVC_TT_VIEWS") return showQtyMenu(chatId, "👁 مشاهدات تيك توك\nاختر الكمية:", "BUY:TTVIEWS", ttViewPrices, "NAV:SERVICES");
    if (action === "SVC_TT_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين تيك توك (مدى الحياة)\nاختر الكمية:", "BUY:TTFOLLOW", ttFollowersPrices, "NAV:SERVICES");
    if (action === "SVC_TT_FREEVIEWS") {
      return editOrSend(chatId, "🎁 مشاهدات تيك توك مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        inline_keyboard: [
          [{ text: "100 مشاهدة مجانية", callback_data: "BUY:FREEVIEWS:100" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }
    if (action === "SVC_IG_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين إنستقرام (مدى الحياة)\nاختر الكمية:", "BUY:IGFOLLOW", igFollowersPrices, "NAV:SERVICES");
    if (action === "SVC_TG_FOLLOWERS") return showQtyMenu(chatId, "👥 متابعين تلجرام\nاختر الكمية:", "BUY:TGFOLLOW", tgFollowerPrices, "NAV:SERVICES");
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
    saveJSON(USERS_FILE, users);

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

    codes[code] = {
      points,
      usedBy: [],
      maxUses,
      createdBy: u.uid,
      createdAt: new Date().toISOString(),
    };

    saveJSON(USERS_FILE, users);
    saveCodes();

    u.state.tmp.locked = null;
    saveJSON(USERS_FILE, users);

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

    if (type === "TTLIKES") { cost = ttLikePrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "ttlikes"; }
    if (type === "TTVIEWS") { cost = ttViewPrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "ttviews"; }
    if (type === "TTFOLLOW") { cost = ttFollowersPrices[qty] || 0; askText = "🔗 أرسل رابط حساب تيك توك:"; orderType = "ttfollowers"; }
    if (type === "FREEVIEWS") { cost = 0; askText = "🔗 أرسل رابط:"; orderType = "freeviews"; }
    if (type === "TGFOLLOW") { cost = tgFollowerPrices[qty] || 0; askText = "🔗 أرسل رابط (https://t.me/..):"; orderType = "tgfollowers"; }
    if (type === "IGLIKES") { cost = igLikePrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "iglikes"; }
    if (type === "IGSHARES") { cost = igSharePrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "igshares"; }
    if (type === "FBSTORY") { cost = fbStoryPrices[qty] || 0; askText = "🔗 أرسل رابط:"; orderType = "fbstory"; }
    if (type === "IGFOLLOW") { cost = igFollowersPrices[qty] || 0; askText = "🔗 أرسل رابط حساب إنستقرام:"; orderType = "igfollowers"; }

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
  saveJSON(USERS_FILE, users);

  if (text === SECRET_OPEN) {
    if (!isAdmin(chatId)) return;
    return editOrSend(chatId, "✅ تم فتح لوحة الأدمن.", adminKeyboard());
  }

  // استلام رابط الطلب + إرسال API مباشر لـ SMMLOX
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

    // خصم النقاط (قبل الإرسال)
    let deducted = 0;
    if (pending.cost > 0) {
      if (u.points < pending.cost) {
        clearPending(chatId);
        return bot.sendMessage(chatId, `❌ رصيدك غير كافي.\n💰 السعر: ${pending.cost}\n💎 رصيدك: ${u.points}`);
      }
      u.points -= pending.cost;
      deducted = pending.cost;
      saveJSON(USERS_FILE, users);
    }

    orders.push(order);
    saveOrders();
    clearPending(chatId);

    // ✅ إرسال طلب حقيقي إلى SMMLOX مباشرة
    try {
      if (!order.serviceId) throw new Error("Missing serviceId");

      const apiResp = await sendOrderDirect({
        service: order.serviceId,
        link: order.link,
        quantity: order.qty,
      });

      order.apiResponse = apiResp;

      // SMM panels غالباً يرجعون { order: 12345 } أو { orderId: ... }
      const remote =
        apiResp?.order ||
        apiResp?.orderId ||
        apiResp?.order_id ||
        apiResp?.id ||
        null;

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

      // ✅ رجّع النقاط إذا فشل
      if (order.status === "FAILED" && deducted > 0) {
        u.points += deducted;
        saveJSON(USERS_FILE, users);
      }

      saveOrders();
    } catch (e) {
      order.status = "FAILED";
      order.apiError = e?.response?.data
        ? JSON.stringify(e.response.data)
        : (e?.message || String(e));

      // ✅ رجّع النقاط إذا فشل
      if (deducted > 0) {
        u.points += deducted;
        saveJSON(USERS_FILE, users);
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

  // بوابة الأكواد: خطوات الرسائل
  if (u.state?.tmp?.locked?.step === "WAIT_ID") {
    if (text !== u.uid) {
      u.state.tmp.locked = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ الايدي غير صحيح. ارجع اضغط زر البوابة من جديد.");
    }
    u.state.tmp.locked.step = "WAIT_PASS";
    saveJSON(USERS_FILE, users);
    return bot.sendMessage(chatId, "✅ تم التحقق من الايدي.\n\n🔐 اكتب كلمة السر:");
  }

  if (u.state?.tmp?.locked?.step === "WAIT_PASS") {
    if (text !== LOCKED_PASSWORD) {
      u.state.tmp.locked = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ كلمة السر غير صحيحة.");
    }
    u.state.tmp.locked = { step: "WAIT_CODE", flow: {} };
    saveJSON(USERS_FILE, users);
    return bot.sendMessage(chatId, "✅ تم فتح البوابة.\n\n✍️ اكتب الكود اللي تريد تنشئه:");
  }

  if (u.state?.tmp?.locked?.step === "WAIT_CODE") {
    const code = (text || "").trim();
    if (!code) return bot.sendMessage(chatId, "❌ اكتب كود صحيح.");
    if (codes[code]) return bot.sendMessage(chatId, "❌ هذا الكود موجود مسبقًا. اكتب كود غيره.");
    u.state.tmp.locked.flow = { code };
    u.state.tmp.locked.step = "WAIT_POINTS";
    saveJSON(USERS_FILE, users);
    return bot.sendMessage(chatId, "⭐️ اكتب كم نقطة يحصلون من هذا الكود؟ (مثلاً 10):");
  }

  if (u.state?.tmp?.locked?.step === "WAIT_POINTS") {
    const points = parseInt((text || "").trim(), 10);
    if (!Number.isFinite(points) || points <= 0) {
      return bot.sendMessage(chatId, "❌ لازم رقم صحيح أكبر من 0. اكتب النقاط مرة ثانية:");
    }
    u.state.tmp.locked.flow.points = points;
    u.state.tmp.locked.step = "WAIT_MAX_CHOICE";
    saveJSON(USERS_FILE, users);
    return editOrSend(chatId, "👥 اختر عدد الناس اللي يستخدمون الكود (1/2/3/4) أو تخطي:", maxUsesKeyboardLocked());
  }

  // استخدام الكود
  if (u.state?.tmp?.useCode?.step === "WAIT_CODE") {
    const code = text;
    const codeData = codes[code];

    if (!codeData) {
      u.state.tmp.useCode = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ كود غير صحيح أو انتهت صلاحيته.");
    }

    codeData.usedBy = codeData.usedBy || [];

    if (codeData.usedBy.includes(String(chatId))) {
      u.state.tmp.useCode = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ انت مستخدم هذا الكود من قبل.");
    }

    if (codeData.usedBy.length >= codeData.maxUses) {
      u.state.tmp.useCode = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ تم انتهاء صلاحيته.");
    }

    u.state.tmp.useCode = { step: "WAIT_ID", code };
    saveJSON(USERS_FILE, users);
    return bot.sendMessage(chatId, "🔢 اكتب ID مالك حتى تستلم النقاط:");
  }

  if (u.state?.tmp?.useCode?.step === "WAIT_ID") {
    const code = u.state.tmp.useCode.code;
    const codeData = codes[code];

    if (!codeData) {
      u.state.tmp.useCode = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ الكود غير موجود أو انتهى.");
    }

    if (text !== u.uid) {
      u.state.tmp.useCode = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ الـ ID اللي كتبته مو مالك.");
    }

    codeData.usedBy = codeData.usedBy || [];

    if (codeData.usedBy.includes(String(chatId))) {
      u.state.tmp.useCode = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ انت مستخدم هذا الكود من قبل.");
    }

    if (codeData.usedBy.length >= codeData.maxUses) {
      u.state.tmp.useCode = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ تم انتهاء صلاحيته.");
    }

    u.points += codeData.points;
    codeData.usedBy.push(String(chatId));

    if (codeData.usedBy.length >= codeData.maxUses) {
      delete codes[code];
    }

    saveJSON(USERS_FILE, users);
    saveCodes();

    u.state.tmp.useCode = null;
    saveJSON(USERS_FILE, users);

    return bot.sendMessage(chatId, `✅ تم إضافة ${codeData.points} نقطة إلى حسابك.\n💎 رصيدك الحالي: ${u.points}`);
  }

  // مشاركة النقاط
  if (u.state?.tmp?.share?.step === "WAIT_FRIEND_ID") {
    const friendUid = text;
    u.state.tmp.share.friendUid = friendUid;
    u.state.tmp.share.step = "WAIT_AMOUNT";
    saveJSON(USERS_FILE, users);
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
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ لم يتم العثور على هذا المستخدم.");
    }

    u.points -= amount;
    users[friendChatId].points += amount;
    saveJSON(USERS_FILE, users);

    u.state.tmp.share = null;
    saveJSON(USERS_FILE, users);

    bot.sendMessage(chatId, `✅ تم إرسال ${amount} نقطة إلى ID: ${friendUid}`);
    bot.sendMessage(friendChatId, `🎉 وصلك ${amount} نقطة من مستخدم آخر!`);
    return;
  }

  // أدمن: إنشاء كود نقاط
  if (u.state?.tmp?.admin?.step === "WAIT_POINTS_EACH") {
    const pointsEach = parseInt(text, 10);
    if (!Number.isFinite(pointsEach) || pointsEach <= 0) {
      u.state.tmp.admin = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ لازم رقم صحيح أكبر من 0.");
    }
    u.state.tmp.admin = { step: "WAIT_MAX_USES", pointsEach };
    saveJSON(USERS_FILE, users);
    return bot.sendMessage(chatId, "👥 اكتب عدد الأشخاص اللي يقدرون يستخدمون الكود (مثلاً 4):");
  }

  if (u.state?.tmp?.admin?.step === "WAIT_MAX_USES") {
    const maxUses = parseInt(text, 10);
    const pointsEach = u.state.tmp.admin.pointsEach;

    if (!Number.isFinite(maxUses) || maxUses <= 0) {
      u.state.tmp.admin = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "❌ لازم رقم صحيح أكبر من 0.");
    }

    const totalCost = pointsEach * maxUses;
    if (u.points < totalCost) {
      u.state.tmp.admin = null;
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, `❌ رصيدك غير كافي.\n💸 الكلفة: ${totalCost}\n💎 رصيدك: ${u.points}`);
    }

    u.points -= totalCost;
    saveJSON(USERS_FILE, users);

    let code = genCode(10);
    while (codes[code]) code = genCode(10);

    codes[code] = {
      points: pointsEach,
      usedBy: [],
      maxUses,
      createdBy: u.uid,
      createdAt: new Date().toISOString(),
    };

    saveCodes();

    u.state.tmp.admin = null;
    saveJSON(USERS_FILE, users);

    return bot.sendMessage(
      chatId,
      `✅ تم إنشاء الكود!\n\n🧾 الكود: ${code}\n⭐️ لكل شخص: ${pointsEach}\n👥 العدد: ${maxUses}\n💸 تم خصم: ${totalCost}\n💎 رصيدك الحالي: ${u.points}`,
      { reply_markup: { inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]] } }
    );
  } 
});
