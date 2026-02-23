"use strict";

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const qs = require("qs");
const moment = require("moment");

// =====================
// 1) CONFIG
// =====================

// ✅ حط توكنك هنا داخل ملفك فقط
const BOT_TOKEN = "7976169299:AAETNdgYqS84r2wr9StV9oWVfxYkivFp7zs"; // نفس اللي دزيته
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const USERS_FILE = path.join(__dirname, "users.json");
const PENDING_FILE = path.join(__dirname, "pendingOrders.json");
const CODES_FILE = path.join(__dirname, "codes.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");

// ✅ عدد الأعضاء ثابت (أنت تكتبه)
const MEMBERS_COUNT = 1234; // غيّره للعدد اللي تريده

// قنوات الاشتراك (اختياري)
const channels = [
  { name: "📢 قناة الأخبار", link: "https://t.me/balul344" },
  { name: "📢 قناة العروض", link: "https://t.me/balul344" },
];

// نقاط الإحالة
const REFERRAL_BONUS = 8;

// نقاط الاشتراك بالقنوات
const CHANNEL_JOIN_POINTS = 5;

// API (SMM) - مو مربوط فعلياً حالياً
const API_URL = "https://smmlox.com/api/v2";
const API_KEY = "PUT_YOUR_API_KEY_HERE"; // إذا تستخدمه فعلاً، خليه سري

// =====================
// ✅ أهم شي: أرقام الخدمات (Service IDs)
// =====================
const SERVICE_IDS = {
  tiktok_likes: 10880,
  tiktok_views: 5202,
  instagram_shares: 10901,
  fb_story_views: 9191,
  tiktok_free_views: 10869,
  instagram_likes: 10641,
  telegram_followers: 6261,
};

// ربط orderType الداخلي بالـ serviceKey أعلاه
const ORDER_TYPE_TO_SERVICE_KEY = {
  ttlikes: "tiktok_likes",
  ttviews: "tiktok_views",
  freeviews: "tiktok_free_views",
  iglikes: "instagram_likes",
  igshares: "instagram_shares",
  fbstory: "fb_story_views",
  tgfollowers: "telegram_followers",
};

// =====================
// ✅ بوابة إنشاء الأكواد (زر ظاهر)
// =====================
const LOCKED_BTN_TEXT = "🚫 المشرفين";
const LOCKED_PASSWORD = "QWERTYASDFG123##123Q2002#2004####123456789010#2026ًُ"; // غيرها
const CREATE_CODE_COST = 10000;  // كلفة الإنشاء
const DEFAULT_MAX_USES = 4;      // إذا تخطي العدد

// =====================
// 2) HELPERS: load/save
// =====================
function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("loadJSON error:", e);
  }
  return fallback;
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("saveJSON error:", e);
  }
}

function normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

let users = loadJSON(USERS_FILE, {});
let pendingOrders = loadJSON(PENDING_FILE, {});
let orders = loadJSON(ORDERS_FILE, []);

// codes: { CODE: { points, usedBy:[], maxUses, createdBy, createdAt } }
let codes = loadJSON(CODES_FILE, {
  k100SHYRHRHFHHDD: { points: 40, usedBy: [], maxUses: 1 },
  BOT100: { points: 50, usedBy: [], maxUses: 5 },
  Shadhfhghg5JDDJ757ow: { points: 10, usedBy: [], maxUses: 2 },
});

function saveCodes() {
  saveJSON(CODES_FILE, codes);
}
function saveOrders() {
  saveJSON(ORDERS_FILE, orders);
}

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
      state: { page: "HOME", lastMsgId: null, tmp: {} },
    };
    saveJSON(USERS_FILE, users);
    return users[chatId];
  }

  const u = users[chatId];

  if (!u.uid) {
    if (u.id) u.uid = String(u.id);
    else u.uid = String(Math.floor(1000000000 + Math.random() * 9000000000));
  }

  if (typeof u.points !== "number" || !Number.isFinite(u.points)) u.points = 0;
  if (!u.joinedChannels) u.joinedChannels = [];
  if (!u.referrals) u.referrals = [];
  if (!u.state) u.state = { page: "HOME", lastMsgId: null, tmp: {} };
  if (!u.state.tmp) u.state.tmp = {};

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
// 4) UI BUILDERS
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
      [{ text: "🎁 مشاهدات تيك توك مجانية", callback_data: "NAV:SVC_TT_FREEVIEWS" }],
      [{ text: "👥 متابعين تلجرام", callback_data: "NAV:SVC_TG_FOLLOWERS" }],
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
// 5) EDIT / SEND SAFE
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
// 6) REFERRAL
// =====================
function makeReferralLink(u) {
  const botUsername = "AnimeShadomBot"; // غيره ليوزر بوتك الحقيقي
  return `https://t.me/${botUsername}?start=ref_${u.uid}`;
}

// =====================
// 7) SERVICES PRICES
// =====================
const ttLikePrices = { 10: 5, 20: 10, 30: 20, 40: 30, 50: 40, 60: 50, 70: 60, 80: 70, 90: 80, 100: 90, 120: 100 };
const ttViewPrices = { 500: 50, 1000: 100, 1500: 150, 3000: 200 };
const igLikePrices = { 5: 40, 10: 50, 18: 80, 90: 200 };
const igSharePrices = { 20: 60, 50: 150, 180: 300, 250: 700 };
const fbStoryPrices = { 10: 60, 30: 130, 50: 200, 100: 270 };
const tgFollowerPrices = { 10: 80, 20: 160, 30: 210, 40: 260, 50: 310, 500: 600, 1000: 1000 };

// =====================
// 8) SERVICE MENUS
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
// 9) BALANCE GUARD
// =====================
function requireBalanceOrWarn(chatId, user, cost) {
  if (user.points < cost) {
    editOrSend(chatId, `❌ رصيدك غير كافي.\n\n💰 السعر: ${cost}\n💎 رصيدك: ${user.points}`, backToHomeKeyboard());
    return false;
  }
  return true;
}

// =====================
// 10) ORDER FLOW (pending)
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
// 11) SECRET ADMIN (مخفي)
// =====================
const ADMIN_CHAT_ID = "5571001437";
const SECRET_OPEN = "/!(12345)/!?أنمي شادو افتح";

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
// 12) /start
// =====================
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const u = ensureUser(chatId);

  const payload = match && match[1] ? match[1].trim() : null;
  if (payload && payload.startsWith("ref_")) {
    const refUid = payload.replace("ref_", "");
    if (!u.referredBy && refUid !== u.uid) {
      const refChatId = Object.keys(users).find(cid => users[cid]?.uid === refUid);
      if (refChatId) {
        u.referredBy = refUid;
        users[refChatId].points += REFERRAL_BONUS;
        users[refChatId].referrals = users[refChatId].referrals || [];
        users[refChatId].referrals.push(chatId);

        saveJSON(USERS_FILE, users);
        bot.sendMessage(refChatId, `🎉 انضم عضو جديد عبر رابطك!\n✅ تمت إضافة ${REFERRAL_BONUS} نقطة لحسابك 💰`);
      }
    }
  }

  await showHome(chatId);
});

// =====================
// 13) CALLBACK ROUTER
// =====================
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const u = ensureUser(chatId);

  try { await bot.answerCallbackQuery(q.id); } catch (_) {}

  const data = q.data || "";

  // ---------------------
  // NAV
  // ---------------------
  if (data.startsWith("NAV:")) {
    const action = data.split(":")[1];

    if (action === "HOME") return showHome(chatId);

    if (action === "MEMBERS") {
      return editOrSend(chatId, `👥 عدد المشتركين في البوت:\n\n${MEMBERS_COUNT} مستخدم 🔥`, backToHomeKeyboard());
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

      // تحقق شكلي (مثل كودك)
      setTimeout(() => {
        const uu = ensureUser(chatId);
        uu.points += CHANNEL_JOIN_POINTS;
        uu.joinedChannels.push(available[0].link);
        saveJSON(USERS_FILE, users);
        bot.sendMessage(chatId, `✅ حصلت على ${CHANNEL_JOIN_POINTS} نقاط!`);
      }, 5000);

      return;
    }

    // لوحة الأدمن القديمة
    if (action === "MAKE_POINTS_CODE") {
      if (!isAdmin(chatId)) return;
      u.state.tmp.admin = { step: "WAIT_POINTS_EACH" };
      saveJSON(USERS_FILE, users);
      return bot.sendMessage(chatId, "✍️ اكتب عدد النقاط لكل شخص (مثلاً 10):");
    }

    // خدمات -> قوائم كميات
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

    return;
  }

  // ---------------------
  // LOCKED: اختيار maxUses
  // ---------------------
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

  // ---------------------
  // LOCKED: إنشاء الكود (خصم 10000)
  // ---------------------
  if (data === "LOCKED_CREATE:DO") {
    const lock = u.state?.tmp?.locked;
    if (!lock || lock.step !== "READY_CREATE") {
      return bot.sendMessage(chatId, "❌ أكو نقص بالخطوات. افتح البوابة من جديد.");
    }

    if (u.points < CREATE_CODE_COST) {
      return editOrSend(chatId, `❌ رصيدك غير كافي.\n\n💸 الكلفة: ${CREATE_CODE_COST}\n💎 رصيدك: ${u.points}`, backToHomeKeyboard());
    }

    const flow = lock.flow || {};
    const code = String(flow.code || "").trim();
    const points = parseInt(flow.points, 10);
    const maxUses = parseInt(flow.maxUses, 10);

    if (!code) return bot.sendMessage(chatId, "❌ الكود فارغ.");
    if (codes[code]) return bot.sendMessage(chatId, "❌ هذا الكود موجود مسبقًا. اكتب كود غيره.");
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

  // ---------------------
  // BUY: اختيار خدمة (يطلب رابط بعدين)
  // ---------------------
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

    if (!orderType) return editOrSend(chatId, "❌ خيار غير صالح.", backToHomeKeyboard());

    // تحقق الرصيد للخدمات المدفوعة
    if (cost > 0 && !requireBalanceOrWarn(chatId, u, cost)) return;

    // احسب رقم الخدمة
    const serviceKey = ORDER_TYPE_TO_SERVICE_KEY[orderType];
    const serviceId = serviceKey ? SERVICE_IDS[serviceKey] : null;

    // خزّن pending
    setPending(chatId, { orderType, qty, cost, step: "WAIT_LINK", serviceId });

    await editOrSend(chatId, `✅ تم اختيار: ${qty}\n💰 السعر: ${cost}\n🧩 رقم الخدمة: ${serviceId ?? "غير معروف"}\n\n📩 الآن ارسل المطلوب بالرسالة التالية.`, {
      inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }]],
    });

    return bot.sendMessage(chatId, askText);
  }
});

// =====================
// 14) SINGLE MESSAGE HANDLER
//    - secret open
//    - pending service link => creates order with orderId + serviceId
//    - locked flow steps
//    - use code flow
//    - share flow
//    - admin flow
// =====================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const u = ensureUser(chatId);
  const text = normalizeText(msg.text);

  // فتح لوحة الأدمن (مخفي)
  if (text === SECRET_OPEN) {
    if (!isAdmin(chatId)) return;
    return editOrSend(chatId, "✅ تم فتح لوحة الأدمن.", adminKeyboard());
  }

  // =====================
  // ✅ Pending Service Order: استلام الرابط + إنشاء طلب + رقم خدمة
  // =====================
  const pending = pendingOrders[chatId];
  if (pending && pending.step === "WAIT_LINK") {
    const link = text;

    if (!link || link.length < 8) return bot.sendMessage(chatId, "❌ الرابط غير صحيح. ارسله مرة ثانية.");

    // خصم الرصيد للخدمات المدفوعة
    if (pending.cost > 0) {
      if (u.points < pending.cost) {
        clearPending(chatId);
        return bot.sendMessage(chatId, `❌ رصيدك غير كافي لإكمال الطلب.\n💰 السعر: ${pending.cost}\n💎 رصيدك: ${u.points}`);
      }
      u.points -= pending.cost;
      saveJSON(USERS_FILE, users);
    }

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
    };

    orders.push(order);
    saveOrders();

    clearPending(chatId);

    bot.sendMessage(
      chatId,
      `✅ تم إنشاء طلبك بنجاح!\n\n🧾 رقم الطلب: ${orderId}\n🧩 رقم الخدمة: ${order.serviceId ?? "غير معروف"}\n🛍 الخدمة: ${order.orderType}\n🔢 الكمية: ${order.qty}\n💰 السعر: ${order.cost}\n🔗 الرابط: ${order.link}\n\n💎 رصيدك الحالي: ${u.points}`
    );

    // إرسال للأدمن
    bot.sendMessage(
      ADMIN_CHAT_ID,
      `📥 طلب جديد\n\n🧾 رقم الطلب: ${orderId}\n🧩 رقم الخدمة: ${order.serviceId ?? "غير معروف"}\n👤 المستخدم: ${u.uid}\n🛍 الخدمة: ${order.orderType}\n🔢 الكمية: ${order.qty}\n💰 السعر: ${order.cost}\n🔗 الرابط: ${order.link}\n🕒 ${order.createdAt}`
    ).catch(() => {});

    return;
  }

  // =====================
  // ✅ LOCKED FLOW (ID -> PASS -> CODE -> POINTS -> MAX USES -> CREATE)
  // =====================
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

  // =====================
  // ✅ Use Code Flow (WAIT_CODE -> WAIT_ID)
  // =====================
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
      return bot.sendMessage(chatId, "❌ تم انتهاء صلاحيته (وصل الحد الأقصى من الاستخدام).");
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
      return bot.sendMessage(chatId, "❌ الـ ID اللي كتبته مو مالك. اكتب ID الصحيح الموجود بحسابك داخل البوت.");
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
      return bot.sendMessage(chatId, "❌ تم انتهاء صلاحيته (وصل الحد الأقصى).");
    }

    u.points += codeData.points;
    codeData.usedBy.push(String(chatId));

    // إذا وصل الحد نحذفه حتى المستخدم الخامس يطلعله انتهت صلاحيته
    if (codeData.usedBy.length >= codeData.maxUses) {
      delete codes[code];
    }

    saveJSON(USERS_FILE, users);
    saveCodes();

    u.state.tmp.useCode = null;
    saveJSON(USERS_FILE, users);

    return bot.sendMessage(chatId, `✅ تم إضافة ${codeData.points} نقطة إلى حسابك.\n💎 رصيدك الحالي: ${u.points}`);
  }

  // =====================
  // ✅ Share Points Flow
  // =====================
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

  // =====================
  // ✅ Admin make points code (مثل كودك)
  // =====================
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
      return bot.sendMessage(
        chatId,
        `❌ رصيدك غير كافي لإنشاء هذا الكود.\n\n⭐️ لكل شخص: ${pointsEach}\n👥 العدد: ${maxUses}\n💸 الكلفة: ${totalCost}\n💎 رصيدك: ${u.points}`
      );
    }

    u.points -= totalCost;
    saveJSON(USERS_FILE, users);

    let code = genCode(10);
    while (codes[code]) code = genCode(10);

    codes[code] = {
      points: pointsEach,
      usedBy: [],
      maxUses: maxUses,
      createdBy: u.uid,
      createdAt: new Date().toISOString(),
    };
    saveCodes();

    u.state.tmp.admin = null;
    saveJSON(USERS_FILE, users);

    return bot.sendMessage(
      chatId,
      `✅ تم إنشاء الكود بنجاح!\n\n🧾 الكود: ${code}\n⭐️ يعطي لكل شخص: ${pointsEach} نقطة\n👥 عدد المستخدمين: ${maxUses}\n💸 تم خصم: ${totalCost}\n💎 رصيدك الحالي: ${u.points}`,
      { reply_markup: { inline_keyboard: [[{ text: "⬅️ رجوع للأقسام", callback_data: "NAV:HOME" }]] } }
    );
  }
});
