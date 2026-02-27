"use strict";

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const qs = require("qs");
const moment = require("moment");
const path = require("path");
const fs = require("fs");

const admin = require("firebase-admin");

// =========================================================
// 1) CONFIG (ENV)
// =========================================================
const BOT_TOKEN ="7976169299:AAETNdgYqS84r2wr9StV9oWVfxYkivFp7zs";
if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing in .env");

const API_URL ="https://smmlox.com/api/v2";
const API_KEY ="cbfc807f1983d1ee38283a3c19219a9b";
if (!API_KEY) throw new Error("API_KEY missing in .env");

const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "");
const BOT_USERNAME = process.env.BOT_USERNAME || "BlueMoonBot_2025Bot";
const BOT_CHANNEL = process.env.BOT_CHANNEL || "@balul344";

// زر المشرف + كلمة المرور
const LOCKED_BTN_TEXT = "🚫 المشرف";
const LOCKED_PASSWORD = "QWERTYASDFG123##123Q2002#2004####123456789010#2026ًُ";
const CREATE_CODE_COST = 10000;
const DEFAULT_MAX_USES = 4;

// نقاط الإحالة + نقاط الاشتراك بالقنوات
const REFERRAL_BONUS = 30;
const CHANNEL_JOIN_POINTS = 5;

// قنوات التجميع
const channels = [
  { name: "📢 قناة الأخبار", link: "https://t.me/balul344" },
  { name: "📢 قناة العروض", link: "https://t.me/balul344" },
];

// =========================================================
// 2) FIREBASE INIT (RTDB)
// =========================================================
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
if (!FIREBASE_DB_URL) throw new Error("FIREBASE_DB_URL missing in .env");

function initFirebase() {
  if (admin.apps.length) return;

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (saPath && fs.existsSync(saPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: FIREBASE_DB_URL,
    });
    return;
  }

  throw new Error(
    "Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT_PATH to your JSON file path."
  );
}

initFirebase();
const db = admin.database();

// مسارات بالداتابيس
const refUsers = db.ref("users");                 // users/{chatId}
const refCodes = db.ref("codes");                 // codes/{code}
const refPending = db.ref("pendingOrders");       // pendingOrders/{chatId}
const refOrders = db.ref("orders");               // orders/{orderId}

// =========================================================
// 3) BOT INIT
// =========================================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =========================================================
// 4) SERVICES IDs + PRICES (مثل كودك)
// =========================================================
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

const ttLikePrices = { 10: 5, 20: 10, 30: 20, 40: 30, 50: 40, 60: 50, 70: 60, 80: 70, 90: 80, 100: 90, 120: 100 };
const ttViewPrices = { 500: 50, 1000: 100, 1500: 150, 3000: 200 };
const igLikePrices = { 5: 40, 10: 50, 18: 80, 90: 200 };
const igSharePrices = { 20: 60, 50: 150, 180: 300, 250: 700 };
const fbStoryPrices = { 10: 60, 30: 130, 50: 200, 100: 270 };
const tgFollowerPrices = { 10: 80, 20: 160, 30: 210, 40: 260, 50: 310, 500: 600, 1000: 1000 };
const ttFollowersPrices = { 500: 5000, 1000: 10000, 30: 2000 };
const igFollowersPrices = { 10: 500, 30: 1000, 100: 3000, 500: 5000, 1000: 10000 };

// =========================================================
// 5) HELPERS
// =========================================================
function normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function isAdmin(chatId) {
  return ADMIN_CHAT_ID && String(chatId) === String(ADMIN_CHAT_ID);
}

function genCode(len = 10) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function genOrderId() {
  return "ORD" + Date.now().toString(10) + Math.floor(100 + Math.random() * 900);
}

async function isJoinedChannel(userId) {
  try {
    const m = await bot.getChatMember(BOT_CHANNEL, userId);
    return ["member", "administrator", "creator"].includes(m.status);
  } catch (_) {
    return false;
  }
}

function makeReferralLink(u) {
  return `https://t.me/${BOT_USERNAME}?start=ref_${u.uid}`;
}

// =========================================================
// 6) FIREBASE DATA LAYER
// =========================================================
async function getUser(chatId) {
  const snap = await refUsers.child(String(chatId)).get();
  return snap.exists() ? snap.val() : null;
}

async function ensureUser(chatId) {
  const cid = String(chatId);
  const userRef = refUsers.child(cid);

  const snap = await userRef.get();
  if (!snap.exists()) {
    const newUser = {
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
      refStats: { stamps: [], blockedUntil: 0 },
    };
    await userRef.set(newUser);
    return newUser;
  }

  const u = snap.val() || {};
  // ترقيع أي نقص
  if (!u.uid) u.uid = String(Math.floor(1000000000 + Math.random() * 9000000000));
  if (typeof u.points !== "number" || !Number.isFinite(u.points)) u.points = 0;
  if (!Array.isArray(u.joinedChannels)) u.joinedChannels = [];
  if (!Array.isArray(u.referrals)) u.referrals = [];
  if (!u.state) u.state = { page: "HOME", lastMsgId: null, tmp: {} };
  if (!u.state.tmp) u.state.tmp = {};
  if (typeof u.isActive !== "boolean") u.isActive = true;
  if (!u.createdAt) u.createdAt = new Date().toISOString();
  if (!u.lastSeen) u.lastSeen = new Date().toISOString();
  if (!u.refStats) u.refStats = { stamps: [], blockedUntil: 0 };

  await userRef.update(u);
  return u;
}

async function updateUser(chatId, patch) {
  await refUsers.child(String(chatId)).update(patch);
}

async function setLastMessage(chatId, messageId) {
  const u = await ensureUser(chatId);
  u.state.lastMsgId = messageId;
  await updateUser(chatId, { state: u.state });
}

async function getLastMessage(chatId) {
  const u = await ensureUser(chatId);
  return u.state?.lastMsgId || null;
}

async function setPage(chatId, page) {
  const u = await ensureUser(chatId);
  u.state.page = page;
  await updateUser(chatId, { state: u.state });
}

// Pending orders
async function setPending(chatId, order) {
  await refPending.child(String(chatId)).set(order);
}
async function getPending(chatId) {
  const snap = await refPending.child(String(chatId)).get();
  return snap.exists() ? snap.val() : null;
}
async function clearPending(chatId) {
  await refPending.child(String(chatId)).remove();
}

// Codes
async function getCode(code) {
  const snap = await refCodes.child(code).get();
  return snap.exists() ? snap.val() : null;
}
async function setCode(code, data) {
  await refCodes.child(code).set(data);
}
async function updateCode(code, patch) {
  await refCodes.child(code).update(patch);
}

// Orders
async function addOrder(orderId, data) {
  await refOrders.child(orderId).set(data);
}

// Atomic points (transaction)
async function addPoints(chatId, amount) {
  const pRef = refUsers.child(String(chatId)).child("points");
  await pRef.transaction((cur) => (Number(cur || 0) + Number(amount || 0)));
}
async function takePoints(chatId, amount) {
  const pRef = refUsers.child(String(chatId)).child("points");
  const res = await pRef.transaction((cur) => {
    const now = Number(cur || 0);
    const cost = Number(amount || 0);
    if (now < cost) return; // abort
    return now - cost;
  });
  return res.committed;
}

// =========================================================
// 7) SMMLOX API
// =========================================================
async function sendOrderDirect({ service, link, quantity }) {
  const payload = { key: API_KEY, action: "add", service, link, quantity };

  const res = await axios.post(API_URL, qs.stringify(payload), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });

  return res.data;
}

// =========================================================
// 8) UI BUILDERS
// =========================================================
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

function buildQtyKeyboard(prefix, priceMap, backTo = "NAV:SERVICES") {
  const qtyList = Object.keys(priceMap)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b)
    .map((qty) => ({ qty, label: `${qty} - ${priceMap[qty]} عملة` }));

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

async function editOrSend(chatId, text, keyboard) {
  const lastMsgId = await getLastMessage(chatId);

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
  await setLastMessage(chatId, sent.message_id);
}

async function showHome(chatId) {
  const u = await ensureUser(chatId);
  await setPage(chatId, "HOME");
  await editOrSend(chatId, homeText(u), homeKeyboard());
}

async function showServices(chatId) {
  await setPage(chatId, "SERVICES");
  await editOrSend(chatId, "🛍 خدماتي\nاختر الخدمة المطلوبة:", servicesKeyboard());
}

// referral anti-spam (نفس فكرة كودك)
const REF_WINDOW_MS = 10 * 60 * 1000;
const REF_MAX_IN_WINDOW = 5;
const REF_BLOCK_MS = 60 * 60 * 1000;

function nowMs() { return Date.now(); }

async function markAndCheckReferrerSuspicious(refChatId) {
  const cid = String(refChatId);
  const userRef = refUsers.child(cid);

  const snap = await userRef.get();
  if (!snap.exists()) return true;

  const u = snap.val();
  u.refStats = u.refStats || { stamps: [], blockedUntil: 0 };

  const t = nowMs();

  if (u.refStats.blockedUntil && u.refStats.blockedUntil > t) {
    return true;
  }

  u.refStats.stamps = (u.refStats.stamps || []).filter((s) => (t - s) <= REF_WINDOW_MS);
  u.refStats.stamps.push(t);

  if (u.refStats.stamps.length > REF_MAX_IN_WINDOW) {
    u.refStats.blockedUntil = t + REF_BLOCK_MS;
    await userRef.update({ refStats: u.refStats });
    return true;
  }

  await userRef.update({ refStats: u.refStats });
  return false;
}
// =========================================================
// 9) /start + referral logic (Firebase)
// =========================================================
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = String(msg.chat.id);

  // هل جديد؟
  const existed = await getUser(chatId);
  const isBrandNewUser = !existed;

  const u = await ensureUser(chatId);
  u.lastSeen = new Date().toISOString();
  u.isActive = true;

  const payload = match && match[1] ? String(match[1]).trim() : null;

  // إحالة
  if (isBrandNewUser && payload && payload.startsWith("ref_")) {
    const refUid = payload.slice(4);

    if (!u.referredBy && refUid && refUid !== u.uid) {
      // نجيب صاحب uid من الداتابيس (نبحث بالusers)
      const allUsersSnap = await refUsers.get();
      const allUsers = allUsersSnap.exists() ? allUsersSnap.val() : {};

      const refChatId = Object.keys(allUsers).find((cid) => allUsers[cid]?.uid === refUid);

      if (refChatId) {
        u.referredBy = refUid;
        await updateUser(chatId, { referredBy: refUid });

        // لازم يكون مشترك بالقناة حتى تنحسب الإحالة
        const joined = await isJoinedChannel(msg.from.id);
        if (!joined) {
          await bot.sendMessage(chatId, "❌ حتى تنحسب الإحالة لازم تشترك بالقناة أولاً.").catch(() => {});
          await showHome(chatId);
          return;
        }

        // كشف رشق على المحيل
        const suspicious = await markAndCheckReferrerSuspicious(refChatId);
        if (suspicious) {
          await bot.sendMessage(
            refChatId,
            "⚠️ تم رصد نشاط إحالات غير طبيعي (رشق).\n❌ تم تعطيل نقاط الإحالة مؤقتاً."
          ).catch(() => {});
          await showHome(chatId);
          return;
        }

        // إضافة نقاط للمحيل
        await addPoints(refChatId, REFERRAL_BONUS);
        const refUser = await ensureUser(refChatId);
        refUser.referrals = Array.isArray(refUser.referrals) ? refUser.referrals : [];
        refUser.referrals.push(chatId);
        await updateUser(refChatId, { referrals: refUser.referrals });

        await bot.sendMessage(
          refChatId,
          `🎉 انضم عضو جديد عبر رابطك!\n✅ تمت إضافة ${REFERRAL_BONUS} نقطة لحسابك 💰`
        ).catch(() => {});
      }
    }
  }

  await updateUser(chatId, { lastSeen: u.lastSeen, isActive: true });
  await showHome(chatId);
});

// =========================================================
// 10) CALLBACK ROUTER
// =========================================================
bot.on("callback_query", async (q) => {
  const chatId = String(q.message.chat.id);
  const data = q.data || "";

  try { await bot.answerCallbackQuery(q.id); } catch (_) {}

  const u = await ensureUser(chatId);

  // ---------------- NAV ----------------
  if (data.startsWith("NAV:")) {
    const action = data.split(":")[1];

    if (action === "HOME") return showHome(chatId);

    if (action === "MEMBERS") {
      const snap = await refUsers.get();
      const all = snap.exists() ? Object.keys(snap.val() || {}).length : 0;
      const active = snap.exists()
        ? Object.values(snap.val() || {}).filter((x) => x && x.isActive).length
        : 0;

      return editOrSend(chatId, `👥 عدد المشتركين:\n\n✅ الكل: ${all}\n🟢 الفعّالين: ${active}`, backToHomeKeyboard());
    }

    if (action === "STATS") {
      const fresh = await ensureUser(chatId);
      return editOrSend(chatId, `📊 إحصائياتك:\n🆔 ID: ${fresh.uid}\n💰 نقاطك: ${fresh.points}`, backToHomeKeyboard());
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

    if (action === "COLLECT") {
      const fresh = await ensureUser(chatId);
      const available = channels.filter((ch) => !fresh.joinedChannels.includes(ch.link));
      if (available.length === 0) return editOrSend(chatId, "✅ لقد اشتركت في جميع القنوات المتاحة.", backToHomeKeyboard());

      const buttons = available.map((ch) => [{ text: ch.name, url: ch.link }]);
      buttons.push([{ text: "✅ تحقّق من الاشتراك", callback_data: "NAV:CHECK_JOIN" }]);
      buttons.push([{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]);

      return editOrSend(chatId, "📢 اشترك بالقنوات التالية ثم اضغط (تحقّق):", { inline_keyboard: buttons });
    }

    if (action === "CHECK_JOIN") {
      // نتحقق اشتراك بالقناة BOT_CHANNEL (شرط سريع)
      const joined = await isJoinedChannel(q.from.id);
      if (!joined) {
        return editOrSend(chatId, `❌ لازم تشترك بالقناة أولاً: ${BOT_CHANNEL}`, backToHomeKeyboard());
      }

      // نمنح نقاط لكل قناة من القائمة (مرة وحدة)
      const fresh = await ensureUser(chatId);
      const before = new Set(fresh.joinedChannels || []);

      // بما أنه تحقق عام: نضيف كل القنوات اللي مو مسجلة
      let gained = 0;
      for (const ch of channels) {
        if (!before.has(ch.link)) {
          before.add(ch.link);
          gained += CHANNEL_JOIN_POINTS;
        }
      }

      fresh.joinedChannels = Array.from(before);
      await updateUser(chatId, { joinedChannels: fresh.joinedChannels });

      if (gained > 0) {
        await addPoints(chatId, gained);
        return editOrSend(chatId, `✅ تم التحقق!\n🎁 حصلت: ${gained} نقطة`, backToHomeKeyboard());
      }
      return editOrSend(chatId, "✅ أنت مستلم نقاط القنوات مسبقاً.", backToHomeKeyboard());
    }

    if (action === "DAILY") {
      const fresh = await ensureUser(chatId);
      const lastGiftTime = fresh.lastGift ? moment(fresh.lastGift) : null;
      const now = moment();

      if (!lastGiftTime || now.diff(lastGiftTime, "hours") >= 24) {
        await addPoints(chatId, 10);
        await updateUser(chatId, { lastGift: now.toISOString() });
        return editOrSend(chatId, "🎁 حصلت على 10 نقاط كمكافأة يومية!", backToHomeKeyboard());
      }
      return editOrSend(chatId, "⏳ يمكنك استلام الهدية بعد 24 ساعة.", backToHomeKeyboard());
    }

    if (action === "CODE") {
      u.state.tmp.useCode = { step: "WAIT_CODE" };
      await updateUser(chatId, { state: u.state });
      return bot.sendMessage(chatId, "🔑 اكتب الكود:").catch(() => {});
    }

    if (action === "SHARE_POINTS") {
      u.state.tmp.share = { step: "WAIT_FRIEND_ID", friendUid: null };
      await updateUser(chatId, { state: u.state });
      return bot.sendMessage(chatId, "🔢 أدخل ID صديقك لمشاركة النقاط:").catch(() => {});
    }

    if (action === "LOCKED_GATE") {
      // هنا نخليها بوابة للمشرف فقط
      u.state.tmp.locked = { step: "WAIT_PASSWORD" };
      await updateUser(chatId, { state: u.state });
      return bot.sendMessage(chatId, "🚫 بوابة المشرف\n\n🔐 اكتب كلمة المرور:").catch(() => {});
    }

    // ---- خدمات: قوائم كميات ----
    if (action === "SVC_TT_LIKES") return editOrSend(chatId, "❤️ لايكات تيك توك\nاختر الكمية:", buildQtyKeyboard("QTY:ttlikes", ttLikePrices));
    if (action === "SVC_TT_VIEWS") return editOrSend(chatId, "👁 مشاهدات تيك توك\nاختر الكمية:", buildQtyKeyboard("QTY:ttviews", ttViewPrices));
    if (action === "SVC_TT_FREEVIEWS") return editOrSend(chatId, "🎁 مشاهدات تيك توك مجانية\nاختر الكمية:", buildQtyKeyboard("QTY:freeviews", ttViewPrices));
    if (action === "SVC_IG_LIKES") return editOrSend(chatId, "❤️ اعجابات انستقرام\nاختر الكمية:", buildQtyKeyboard("QTY:iglikes", igLikePrices));
    if (action === "SVC_IG_SHARES") return editOrSend(chatId, "🔁 مشاركات انستقرام\nاختر الكمية:", buildQtyKeyboard("QTY:igshares", igSharePrices));
    if (action === "SVC_FB_STORY") return editOrSend(chatId, "📘 مشاهدات ستوري فيسبوك\nاختر الكمية:", buildQtyKeyboard("QTY:fbstory", fbStoryPrices));
    if (action === "SVC_TT_FOLLOWERS") return editOrSend(chatId, "👥 متابعين تيك توك (مدى الحياة)\nاختر الكمية:", buildQtyKeyboard("QTY:ttfollowers", ttFollowersPrices));
    if (action === "SVC_IG_FOLLOWERS") return editOrSend(chatId, "👥 متابعين انستقرام (مدى الحياة)\nاختر الكمية:", buildQtyKeyboard("QTY:igfollowers", igFollowersPrices));

    return;
  }

  // ---------------- QTY (اختيار كمية خدمة) ----------------
  if (data.startsWith("QTY:")) {
    const [, orderType, qtyStr] = data.split(":"); // QTY:ttlikes:10
    const qty = parseInt(qtyStr, 10);

    // السعر حسب نوع الخدمة
    const priceMap = {
      ttlikes: ttLikePrices,
      ttviews: ttViewPrices,
      freeviews: ttViewPrices,
      iglikes: igLikePrices,
      igshares: igSharePrices,
      fbstory: fbStoryPrices,
      tgfollowers: tgFollowerPrices,
      ttfollowers: ttFollowersPrices,
      igfollowers: igFollowersPrices,
    }[orderType];

    if (!priceMap || !priceMap[qty]) {
      return editOrSend(chatId, "❌ اختيار غير صحيح.", backToHomeKeyboard());
    }

    const cost = Number(priceMap[qty]);
    await setPending(chatId, { step: "WAIT_LINK", orderType, quantity: qty, cost });

    return bot.sendMessage(
      chatId,
      `✅ تم اختيار الكمية: ${qty}\n💰 السعر: ${cost} عملة\n\n🔗 الآن ارسل الرابط:`
    ).catch(() => {});
  }

});

// =========================================================
// 11) MESSAGE ROUTER (الخطوات النصية: كود/مشاركة/مشرف/روابط خدمات)
// =========================================================
bot.on("message", async (msg) => {
  const chatId = String(msg.chat.id);
  const text = normalizeText(msg.text || "");

  // ignore commands هنا
  if (text.startsWith("/start")) return;

  const u = await ensureUser(chatId);

  // 1) Pending order link
  const pending = await getPending(chatId);
  if (pending && pending.step === "WAIT_LINK") {
    const link = text;

    const service = ORDER_TYPE_TO_SERVICE_ID[pending.orderType];
    if (!service) {
      await clearPending(chatId);
      return bot.sendMessage(chatId, "❌ خدمة غير معروفة.").catch(() => {});
    }

    // خصم نقاط
    const ok = await takePoints(chatId, pending.cost);
    if (!ok) {
      await clearPending(chatId);
      return bot.sendMessage(chatId, `❌ رصيدك غير كافي.\n💰 السعر: ${pending.cost}`).catch(() => {});
    }

    // إرسال الطلب
    try {
      const res = await sendOrderDirect({ service, link, quantity: pending.quantity });
      const orderId = genOrderId();

      await addOrder(orderId, {
        chatId,
        service,
        orderType: pending.orderType,
        quantity: pending.quantity,
        cost: pending.cost,
        link,
        apiResponse: res,
        createdAt: new Date().toISOString(),
      });

      await clearPending(chatId);

      if (res && res.order) {
        await bot.sendMessage(chatId, `✅ تم تنفيذ الطلب بنجاح!\n🔹 رقم الطلب: ${res.order}`).catch(() => {});
      } else {
        await bot.sendMessage(chatId, `⚠️ تم إرسال الطلب بس الرد غير واضح.\n🧾 الرد: ${JSON.stringify(res)}`).catch(() => {});
      }

      return showHome(chatId);
    } catch (e) {
      await clearPending(chatId);
      // رجّع النقاط إذا فشل
      await addPoints(chatId, pending.cost);
      return bot.sendMessage(chatId, "❌ حدث خطأ أثناء تنفيذ الطلب وتم إرجاع رصيدك.").catch(() => {});
    }
  }

  // 2) use code flow
  if (u.state?.tmp?.useCode?.step === "WAIT_CODE") {
    const code = text.replace(/\s+/g, "");
    const c = await getCode(code);

    u.state.tmp.useCode = null;
    await updateUser(chatId, { state: u.state });

    if (!c) return bot.sendMessage(chatId, "❌ الكود غير صحيح.").catch(() => {});

    const usedBy = c.usedBy || {};
    const maxUses = Number(c.maxUses || DEFAULT_MAX_USES);
    const usedCount = Object.keys(usedBy).length;

    if (usedBy[chatId]) return bot.sendMessage(chatId, "⚠️ أنت مستخدم هذا الكود مسبقاً.").catch(() => {});
    if (usedCount >= maxUses) return bot.sendMessage(chatId, "⚠️ الكود منتهي (وصل الحد).").catch(() => {});

    // نحدّث الكود + نضيف نقاط للمستخدم (transaction على الكود)
    await refCodes.child(code).child("usedBy").child(chatId).set(true);
    await addPoints(chatId, Number(c.points || 0));

    await bot.sendMessage(chatId, `✅ تم قبول الكود!\n🎁 حصلت: ${c.points} نقطة`).catch(() => {});
    return showHome(chatId);
  }

  // 3) share points flow
  if (u.state?.tmp?.share?.step === "WAIT_FRIEND_ID") {
    const friendUid = text;
    u.state.tmp.share.friendUid = friendUid;
    u.state.tmp.share.step = "WAIT_AMOUNT";
    await updateUser(chatId, { state: u.state });
    return bot.sendMessage(chatId, "💰 اكتب المبلغ اللي تريد ترسله:").catch(() => {});
  }

  if (u.state?.tmp?.share?.step === "WAIT_AMOUNT") {
    const amount = parseInt(text, 10);
    const friendUid = u.state.tmp.share.friendUid;

    u.state.tmp.share = null;
    await updateUser(chatId, { state: u.state });

    if (!amount || amount <= 0) return bot.sendMessage(chatId, "❌ مبلغ غير صحيح.").catch(() => {});

    // نبحث عن friend by uid
    const allUsersSnap = await refUsers.get();
    const allUsers = allUsersSnap.exists() ? allUsersSnap.val() : {};
    const friendChatId = Object.keys(allUsers).find((cid) => allUsers[cid]?.uid === friendUid);

    if (!friendChatId) return bot.sendMessage(chatId, "❌ ماكو مستخدم بهذا الـ ID.").catch(() => {});

    const ok = await takePoints(chatId, amount);
    if (!ok) return bot.sendMessage(chatId, "❌ رصيدك غير كافي.").catch(() => {});

    await addPoints(friendChatId, amount);

    await bot.sendMessage(chatId, `✅ تم إرسال ${amount} نقطة.`).catch(() => {});
    await bot.sendMessage(friendChatId, `🎁 وصلك تحويل نقاط!\n✅ استلمت ${amount} نقطة.`).catch(() => {});
    return showHome(chatId);
  }

  // 4) locked admin gate
  if (u.state?.tmp?.locked?.step === "WAIT_PASSWORD") {
    if (text !== LOCKED_PASSWORD) {
      u.state.tmp.locked = null;
      await updateUser(chatId, { state: u.state });
      return bot.sendMessage(chatId, "❌ كلمة المرور خطأ.").catch(() => {});
    }

    // إذا مو أدمن نخليه يسوي كود مقابل كلفة
    if (!isAdmin(chatId)) {
      u.state.tmp.locked = { step: "WAIT_CODE_POINTS", maxUses: DEFAULT_MAX_USES };
      await updateUser(chatId, { state: u.state });
      return bot.sendMessage(chatId, `✅ تم الدخول.\n\n💰 اكتب عدد النقاط داخل الكود (مثلاً 50):`).catch(() => {});
    }

    // أدمن: ينشئ كود نقاط
    u.state.tmp.locked = { step: "WAIT_CODE_POINTS", maxUses: DEFAULT_MAX_USES, admin: true };
    await updateUser(chatId, { state: u.state });
    return bot.sendMessage(chatId, "✅ أهلاً مشرف.\n\n💰 اكتب عدد النقاط للكود:").catch(() => {});
  }

  if (u.state?.tmp?.locked?.step === "WAIT_CODE_POINTS") {
    const points = parseInt(text, 10);
    if (!points || points <= 0) return bot.sendMessage(chatId, "❌ رقم نقاط غير صحيح.").catch(() => {});

    u.state.tmp.locked.points = points;
    u.state.tmp.locked.step = "WAIT_MAX_USES";
    await updateUser(chatId, { state: u.state });

    return bot.sendMessage(chatId, "🔢 اكتب عدد مرات الاستخدام للكود (مثلاً 1 أو 5) أو اكتب skip للتخطي:").catch(() => {});
  }

  if (u.state?.tmp?.locked?.step === "WAIT_MAX_USES") {
    let maxUses = DEFAULT_MAX_USES;
    if (text.toLowerCase() !== "skip") {
      const n = parseInt(text, 10);
      if (!n || n <= 0) return bot.sendMessage(chatId, "❌ رقم غير صحيح.").catch(() => {});
      maxUses = n;
    }

    const points = Number(u.state.tmp.locked.points || 0);

    // إذا مو أدمن: نخصم كلفة الانشاء
    if (!isAdmin(chatId)) {
      const ok = await takePoints(chatId, CREATE_CODE_COST);
      if (!ok) {
        u.state.tmp.locked = null;
        await updateUser(chatId, { state: u.state });
        return bot.sendMessage(chatId, `❌ رصيدك غير كافي لإنشاء كود.\n💰 الكلفة: ${CREATE_CODE_COST}`).catch(() => {});
      }
    }

    const code = genCode(10);
    await setCode(code, {
      points,
      maxUses,
      usedBy: {},
      createdAt: new Date().toISOString(),
      createdBy: chatId,
    });

    u.state.tmp.locked = null;
    await updateUser(chatId, { state: u.state });

    await bot.sendMessage(chatId, `✅ تم إنشاء الكود بنجاح!\n\n🔑 الكود: ${code}\n🎁 نقاطه: ${points}\n🔁 max: ${maxUses}`).catch(() => {});
    return showHome(chatId);
  }

});

// =========================================================
// 12) STARTUP LOG
// =========================================================
console.log("✅ Bot is running with Firebase RTDB persistence...");