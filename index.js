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
const BOT_TOKEN = "7976169299:AAETNdgYqS84r2wr9StV9oWVfxYkivFp7zs"; // لا تخلي التوكن القديم
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const USERS_FILE = path.join(__dirname, "users.json");
const PENDING_FILE = path.join(__dirname, "pendingOrders.json");

// قنوات الاشتراك (اختياري)
const channels = [
  { name: "📢 قناة الأخبار", link: "https://t.me/balul344" },
  { name: "📢 قناة العروض", link: "https://t.me/balul344" },
];

// نقاط الإحالة
const REFERRAL_BONUS = 50;

// نقاط الاشتراك بالقنوات (إذا تريده)
const CHANNEL_JOIN_POINTS = 5;

// API (SMM)
const API_URL = "https://smmlox.com/api/v2";
const API_KEY = "cbfc807f1983d1ee38283a3c19219a9b";

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

let users = loadJSON(USERS_FILE, {});
let pendingOrders = loadJSON(PENDING_FILE, {});

// =====================
// 3) USERS + STATE
// =====================
// state لكل مستخدم: { page, lastMsgId, tmp }
function ensureUser(chatId) {
  if (!users[chatId]) {
    users[chatId] = {
      uid: String(Math.floor(1000000000 + Math.random() * 9000000000)), // ID للمشاركة
      points: 0,
      joinedChannels: [],
      lastGift: null,
      referrals: [],
      referredBy: null,
      state: { page: "HOME", lastMsgId: null, tmp: {} },
    };
    saveJSON(USERS_FILE, users);
  }
  if (!users[chatId].state) users[chatId].state = { page: "HOME", lastMsgId: null, tmp: {} };
  return users[chatId];
}

function setLastMessage(chatId, messageId) {
  const u = ensureUser(chatId);
  u.state.lastMsgId = messageId;
  saveJSON(USERS_FILE, users);
}

function getLastMessage(chatId) {
  const u = ensureUser(chatId);
  return u.state.lastMsgId;
}

function setPage(chatId, page) {
  const u = ensureUser(chatId);
  u.state.page = page;
  saveJSON(USERS_FILE, users);
}

function getPage(chatId) {
  const u = ensureUser(chatId);
  return u.state.page || "HOME";
}

// =====================
// 4) UI BUILDERS
// =====================
function homeText(u) {
  return (
`مرحبًا بك في بوت تطبيق انمي شادو 👋

🫂 نقاطك: ${u.points}
🔢 آيديك: ${u.uid}`
  );
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
// 5) EDIT / SEND SAFE
// =====================
async function showHome(chatId) {
  const u = ensureUser(chatId);
  setPage(chatId, "HOME");

  const lastMsgId = getLastMessage(chatId);

  // إذا عنده رسالة قديمة نعدلها، إذا لا نرسل وحدة جديدة
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

  const sent = await bot.sendMessage(chatId, homeText(u), {
    reply_markup: homeKeyboard(),
  });
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
// رابط الإحالة يعتمد على uid (وليس chatId)
function makeReferralLink(u) {
  const botUsername = "BlueMoonBot_2025Bot"; // غيّرها ليوزر بوتك الحقيقي
  return `https://t.me/${botUsername}?start=ref_${u.uid}`;
}

// =====================
// 7) CODES
// =====================
let codes = {
  "k100SHYRHRHFHHDD": { points: 40, usedBy: [], maxUses: 1 },
  "BOT100": { points: 50, usedBy: [], maxUses: 5 },
  "Shadhfhghg5JDDJ757ow": { points: 10, usedBy: [], maxUses: 2 },
};

// =====================
// 8) SERVICES PRICES
// =====================
// TikTok likes
const ttLikePrices = {
  10: 5, 20: 10, 30: 20, 40: 30, 50: 40,
  60: 50, 70: 60, 80: 70, 90: 80, 100: 90, 120: 100,
};

// TikTok views
const ttViewPrices = { 500: 50, 1000: 100, 1500: 150, 3000: 200 };

// IG likes
const igLikePrices = { 5: 40, 10: 50, 18: 80, 90: 200 };

// IG shares
const igSharePrices = { 20: 60, 50: 150, 180: 300, 250: 700 };

// FB story views
const fbStoryPrices = { 10: 60, 30: 130, 50: 200, 100: 270 };

// TG followers
const tgFollowerPrices = { 10: 80, 20: 160, 30: 210, 40: 260, 50: 310, 500: 600, 1000: 1000 };

// =====================
// 9) SERVICE MENUS
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
// 10) BALANCE GUARD (طلبك)
// =====================
function requireBalanceOrWarn(chatId, user, cost) {
  if (user.points < cost) {
    editOrSend(
      chatId,
      `❌ رصيدك غير كافي.\n\n💰 السعر: ${cost}\n💎 رصيدك: ${user.points}`,
      backToHomeKeyboard()
    );
    return false;
  }
  return true;
}

// =====================
// 11) ORDER FLOW (طلب رابط/يوزر بعد اختيار كمية)
// =====================
function setPending(chatId, order) {
  pendingOrders[chatId] = order;
  saveJSON(PENDING_FILE, pendingOrders);
}

function clearPending(chatId) {
  delete pendingOrders[chatId];
  saveJSON(PENDING_FILE, pendingOrders);
}

async function askForLink(chatId, promptText) {
  // ما نرسل أقسام جديدة، نرسل سؤال فقط (رسالة واحدة)
  await bot.sendMessage(chatId, promptText);
}

// =====================
// 12) /start (يرسل الأقسام فقط هنا)
// =====================
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const u = ensureUser(chatId);

  // Referral
  const payload = match && match[1] ? match[1].trim() : null;
  if (payload && payload.startsWith("ref_")) {
    const refUid = payload.replace("ref_", "");

    // لا تعطي نفسك
    if (!u.referredBy && refUid !== u.uid) {
      // دور على صاحب uid
      const refChatId = Object.keys(users).find(cid => users[cid]?.uid === refUid);

      if (refChatId) {
        u.referredBy = refUid;
        users[refChatId].points += REFERRAL_BONUS;
        users[refChatId].referrals = users[refChatId].referrals || [];
        users[refChatId].referrals.push(chatId);

        saveJSON(USERS_FILE, users);

        bot.sendMessage(refChatId,
          `🎉 انضم عضو جديد عبر رابطك!\n✅ تمت إضافة ${REFERRAL_BONUS} نقطة لحسابك 💰`
        );
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
      return editOrSend(chatId,
        `📜 الشروط:\n\n- يمنع الاحتيال أو استغلال الثغرات.\n- النقاط تُحسب حسب النظام داخل البوت.\n- أي إساءة استخدام قد تؤدي للحظر.`,
        backToHomeKeyboard()
      );
    }

    if (action === "REF") {
      const link = makeReferralLink(u);
      return editOrSend(chatId,
        `🔗 رابط دعوتك الخاص:\n\n${link}\n\n✅ إذا دخل شخص عبر رابطك راح تحصل ${REFERRAL_BONUS} نقطة.`,
        backToHomeKeyboard()
      );
    }

    if (action === "SERVICES") return showServices(chatId);

    if (action === "CODE") {
      await bot.sendMessage(chatId, "🔑 أدخل الكود للحصول على نقاط:");
      // مرة وحدة فقط
      bot.once("message", (m) => {
        const code = (m.text || "").trim();
        const codeData = codes[code];

        if (!codeData) return bot.sendMessage(chatId, "❌ كود غير صحيح أو انتهت صلاحيته.");

        codeData.usedBy = codeData.usedBy || [];
        if (codeData.usedBy.includes(chatId)) return bot.sendMessage(chatId, "❌ لقد استخدمت هذا الكود من قبل.");

        u.points += codeData.points;
        codeData.usedBy.push(chatId);

        if (codeData.usedBy.length >= codeData.maxUses) delete codes[code];

        saveJSON(USERS_FILE, users);
        bot.sendMessage(chatId, `✅ تم إضافة ${codeData.points} نقطة إلى حسابك.`);
      });
      return;
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

    if (action === "SHARE_POINTS") {
      await bot.sendMessage(chatId, "🔢 أدخل ID صديقك لمشاركة النقاط:");
      bot.once("message", (m1) => {
        const friendUid = (m1.text || "").trim();

        bot.sendMessage(chatId, "💰 أدخل عدد النقاط التي تريد إرسالها:");
        bot.once("message", (m2) => {
          const amount = parseInt((m2.text || "0").trim(), 10);

          if (!Number.isFinite(amount) || amount <= 0) return bot.sendMessage(chatId, "❌ أدخل رقم صحيح.");
          if (amount > u.points) return bot.sendMessage(chatId, "❌ ليس لديك نقاط كافية.");

          const friendChatId = Object.keys(users).find(cid => users[cid]?.uid === friendUid);
          if (!friendChatId) return bot.sendMessage(chatId, "❌ لم يتم العثور على هذا المستخدم.");

          u.points -= amount;
          users[friendChatId].points += amount;
          saveJSON(USERS_FILE, users);

          bot.sendMessage(chatId, `✅ تم إرسال ${amount} نقطة إلى ID: ${friendUid}`);
          bot.sendMessage(friendChatId, `🎉 وصلك ${amount} نقطة من مستخدم آخر!`);
        });
      });
      return;
    }

    // (اختياري) تجميع النقاط بالقنوات
    if (action === "COLLECT") {
      const available = channels.filter(ch => !u.joinedChannels.includes(ch.link));
      if (available.length === 0) return editOrSend(chatId, "✅ لقد اشتركت في جميع القنوات المتاحة.", backToHomeKeyboard());

      const buttons = available.map(ch => [{ text: ch.name, url: ch.link }]);
      buttons.push([{ text: "⬅️ رجوع", callback_data: "NAV:HOME" }]);

      await editOrSend(chatId, "📢 اشترك بالقنوات التالية للحصول على نقاط:", { inline_keyboard: buttons });

      // ملاحظة: هذا التحقق “شكلي” لأنه ما يفحص فعلياً الاشتراك بدون getChatMember
      // إذا تريد تحقق فعلي، كلّي وأضيفه.
      setTimeout(() => {
        u.points += CHANNEL_JOIN_POINTS;
        u.joinedChannels.push(available[0].link);
        saveJSON(USERS_FILE, users);
        bot.sendMessage(chatId, `✅ حصلت على ${CHANNEL_JOIN_POINTS} نقاط!`);
      }, 5000);
      return;
    }

    // خدمات: قوائم الكميات
    if (action === "SVC_TT_LIKES") {
      setPage(chatId, "SVC_TT_LIKES");
      return showQtyMenu(chatId, "❤️ لايكات تيك توك\nاختر الكمية:", "BUY:TTLIKES", ttLikePrices, "NAV:SERVICES");
    }
    if (action === "SVC_TT_VIEWS") {
      setPage(chatId, "SVC_TT_VIEWS");
      return showQtyMenu(chatId, "👁 مشاهدات تيك توك\nاختر الكمية:", "BUY:TTVIEWS", ttViewPrices, "NAV:SERVICES");
    }
    if (action === "SVC_TT_FREEVIEWS") {
      setPage(chatId, "SVC_TT_FREEVIEWS");
      return editOrSend(chatId, "🎁 مشاهدات تيك توك مجانية\n\nكل 100 مشاهدة = 0 عملة", {
        inline_keyboard: [
          [{ text: "100 مشاهدة مجانية", callback_data: "BUY:FREEVIEWS:100" }],
          [{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }],
        ],
      });
    }
    if (action === "SVC_TG_FOLLOWERS") {
      setPage(chatId, "SVC_TG_FOLLOWERS");
      return showQtyMenu(chatId, "👥 متابعين تلجرام\nاختر الكمية:", "BUY:TGFOLLOW", tgFollowerPrices, "NAV:SERVICES");
    }
    if (action === "SVC_IG_LIKES") {
      setPage(chatId, "SVC_IG_LIKES");
      return showQtyMenu(chatId, "❤️ اعجابات إنستقرام\nاختر الكمية:", "BUY:IGLIKES", igLikePrices, "NAV:SERVICES");
    }
    if (action === "SVC_IG_SHARES") {
      setPage(chatId, "SVC_IG_SHARES");
      return showQtyMenu(chatId, "🔁 مشاركات إنستقرام\nاختر الكمية:", "BUY:IGSHARES", igSharePrices, "NAV:SERVICES");
    }
    if (action === "SVC_FB_STORY") {
      setPage(chatId, "SVC_FB_STORY");
      return showQtyMenu(chatId, "📘 مشاهدات ستوري فيسبوك\nاختر الكمية:", "BUY:FBSTORY", fbStoryPrices, "NAV:SERVICES");
    }
  }

  // BUY: service purchase
  if (data.startsWith("BUY:")) {
    const parts = data.split(":"); // BUY, TYPE, QTY
    const type = parts[1];
    const qty = parseInt(parts[2], 10);

    // حدد السعر حسب النوع
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

    if (!orderType || (!cost && cost !== 0)) {
      return editOrSend(chatId, "❌ خيار غير صالح.", backToHomeKeyboard());
    }

    // ✅ شرطك: إذا ما عنده نقاط كافية ما يوصل لمرحلة الرابط
    if (cost > 0 && !requireBalanceOrWarn(chatId, u, cost)) return;

    setPending(chatId, { orderType, qty, cost, step: "WAIT_LINK" });

    // خليه يبقى بواجهة الخدمات (نفس الرسالة) ويطلب الرابط برسالة وحده
    await editOrSend(chatId, `✅ تم اختيار: ${qty}\n💰 السعر: ${cost}\n\n📩 الآن ارسل المطلوب بالرسالة التالية.`, {
      inline_keyboard: [[{ text: "⬅️ رجوع", callback_data: "NAV:SERVICES" }]],
    });

    return askForLink(chatId, askText);
  }
});

// =====================
// 14) MESSAGE HANDLER FOR PENDING ORDERS
// =====================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // تجاهل /start هنا لأن معالجها موجود
  if (text.startsWith("/start")) return;

  const u = ensureUser(chatId);
  const p = pendingOrders[chatId];

  if (!p) return;

  if (p.step === "WAIT_LINK") {
    const link = text;

    // تحقق بسيط حسب نوع الخدمة
    if (p.orderType === "tgfollowers" && !/^https:\/\/t\.me\//i.test(link)) {
      return bot.sendMessage(chatId, "❌ الرابط لازم يبدأ بـ https://t.me/ (أعد الإرسال)");
    }

    // ✅ خصم النقاط الآن (حتى ما يطلب بدون رصيد)
    if (p.cost > 0) {
      if (u.points < p.cost) {
        clearPending(chatId);
        return bot.sendMessage(chatId, "❌ رصيدك صار غير كافي. حاول مرة ثانية.");
      }
      u.points -= p.cost;
      saveJSON(USERS_FILE, users);
    }

    // هنا تقدر تنفذ طلب API الحقيقي (أنا خليته قالب)
    // إذا تريد أربطه بخدمات SMM بشكل كامل (add + status) كلّي وأركبه
    clearPending(chatId);

    return bot.sendMessage(
      chatId,
      `✅ تم استلام طلبك بنجاح!\n\n📦 الخدمة: ${p.orderType}\n🔢 الكمية: ${p.qty}\n🔗 الرابط: ${link}\n\n💎 رصيدك الحالي: ${u.points}`
    );
  }
});

// =====================
// 15) LOG
// =====================
bot.on("polling_error", (e) => console.error("polling_error:", e.message));
console.log("✅ Bot is running...");
