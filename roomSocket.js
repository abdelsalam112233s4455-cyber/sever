// =============================================================================================
//  أحداث الغرف الصوتية (الأعضاء + المقاعد + شات الغرفة + الطرد)
//  ملف منفصل تمامًا: ما بيلمسش كود الرسايل الخاصة
// =============================================================================================

const SEATS_COUNT = 12;
const HOST_SEAT = 1; // المقعد الكبير (رقم 2) مخصص للمضيف
const MAX_MESSAGE_LENGTH = 500;
const MIN_MESSAGE_GAP_MS = 400; // أقل فاصل بين رسالتين من نفس المستخدم
const KICK_BAN_MS = 10 * 60 * 1000; // المطرود ما يقدرش يرجع قبل 10 دقايق
const VOICE_TOKEN_TTL = 60 * 60; // صلاحية تصريح الصوت: ساعة (بالثواني)

// مكتبة Agora (npm install agora-token). لو مش متثبتة الغرف تفضل شغالة من غير صوت
let RtcTokenBuilder = null;
let RtcRole = null;

try {
  ({ RtcTokenBuilder, RtcRole } = require("agora-token"));
} catch (_) {
  console.warn("⚠️ مكتبة agora-token غير مثبتة. شغّل: npm install agora-token");
}

// رقم Agora للمستخدم (رقم صحيح موجب) مشتق من آخر 8 خانات من الـ _id
function agoraUidFor(userId) {
  const n = parseInt(String(userId).slice(-8), 16);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

module.exports = function registerRoomSockets(io, { User, Room, mongoose }) {
  // roomNumber -> {
  //   members: Map(userId -> socketId)   (الترتيب = ترتيب الدخول)
  //   seats:   Array(12) من (مستخدم | null)
  //   hostId:  userId المضيف (أول واحد دخل الغرفة)
  //   banned:  Map(userId -> وقت انتهاء المنع)
  // }
  const rooms = new Map();

  // socket.id -> { roomNumber, userId, user, lastMessageAt }
  const sessions = new Map();

  const channel = (roomNumber) => `room:${roomNumber}`;

  function getState(roomNumber) {
    let state = rooms.get(roomNumber);

    if (!state) {
      state = {
        members: new Map(),
        seats: Array(SEATS_COUNT).fill(null),
        hostId: null,
        banned: new Map(),
      };
      rooms.set(roomNumber, state);
    }

    return state;
  }

  function snapshot(state) {
    return {
      count: state.members.size,
      seats: state.seats,
      hostId: state.hostId,
    };
  }

  // بيفضّي مقعد المستخدم (لو قاعد) ويرجّع رقم المقعد أو -1
  function releaseSeat(state, userId) {
    const index = state.seats.findIndex((s) => s && s.userId === userId);

    if (index !== -1) {
      state.seats[index] = null;
    }

    return index;
  }

  // لو مفيش مضيف، أقدم واحد في الغرفة يبقى المضيف ويقعد على المقعد الكبير
  function assignHostIfNeeded(roomNumber, state) {
    if (state.hostId && state.members.has(state.hostId)) return;

    const nextHostId = state.members.keys().next().value || null;

    state.hostId = nextHostId;

    if (!nextHostId) return;

    const socketId = state.members.get(nextHostId);
    const session = sessions.get(socketId);

    if (!session) return;

    // سيب مقعدك القديم لو قاعد في مكان تاني
    const oldIndex = releaseSeat(state, nextHostId);

    if (oldIndex !== -1) {
      io.to(channel(roomNumber)).emit("seat_changed", {
        seatIndex: oldIndex,
        user: null,
      });
    }

    if (!state.seats[HOST_SEAT]) {
      state.seats[HOST_SEAT] = session.user;

      io.to(channel(roomNumber)).emit("seat_changed", {
        seatIndex: HOST_SEAT,
        user: session.user,
      });
    }

    io.to(channel(roomNumber)).emit("host_changed", { hostId: nextHostId });

    console.log(
      `👑 [غرفة ${roomNumber}] المضيف الآن: ${session.user.username || nextHostId}`,
    );
  }

  // بيشيل المستخدم من الغرفة (خروج / فصل اتصال / طرد / دخول غرفة تانية)
  function removeFromRoom(socket) {
    const session = sessions.get(socket.id);

    if (!session) return;

    sessions.delete(socket.id);

    const { roomNumber, userId } = session;

    socket.leave(channel(roomNumber));

    const state = rooms.get(roomNumber);

    if (!state) return;

    // لو المستخدم دخل من اتصال أحدث، ما نمسحوش
    if (state.members.get(userId) !== socket.id) return;

    state.members.delete(userId);

    console.log(
      `🚶 [غرفة ${roomNumber}] خرج ${session.user.username || userId} | الأعضاء: ${state.members.size}`,
    );

    const seatIndex = releaseSeat(state, userId);

    if (seatIndex !== -1) {
      io.to(channel(roomNumber)).emit("seat_changed", {
        seatIndex,
        user: null,
      });
    }

    io.to(channel(roomNumber)).emit("members_count", {
      count: state.members.size,
    });

    if (state.members.size === 0) {
      rooms.delete(roomNumber);
      return;
    }

    // لو اللي خرج هو المضيف، المضيف الجديد = أقدم واحد باقي
    if (state.hostId === userId) {
      state.hostId = null;
      assignHostIfNeeded(roomNumber, state);
    }
  }

  io.on("connection", (socket) => {
    // ---------------------------------------------------
    // دخول الغرفة
    // ---------------------------------------------------
    socket.on("join_room", async (data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const roomNumber = String(data?.roomNumber || "").trim();
        const userId = String(data?.userId || "").trim();

        if (!roomNumber) {
          throw new Error("رقم الغرفة مطلوب");
        }

        if (!mongoose.isValidObjectId(userId)) {
          throw new Error("معرّف المستخدم غير صحيح");
        }

        // المطرود ما يرجعش قبل ما المدة تخلص
        const banUntil = rooms.get(roomNumber)?.banned.get(userId);

        if (banUntil && banUntil > Date.now()) {
          throw new Error("تم طردك من هذه الغرفة، حاول لاحقًا");
        }

        const [room, user] = await Promise.all([
          Room.findOne({ roomNumber }).select("roomname"),
          User.findById(userId).select("username avatarUrl"),
        ]);

        if (!room) {
          throw new Error("الغرفة غير موجودة");
        }

        if (!user) {
          throw new Error("المستخدم غير موجود");
        }

        // لو كان في غرفة قبل كده نخرجه منها
        removeFromRoom(socket);

        const state = getState(roomNumber);

        // نفس المستخدم داخل من اتصال تاني (مثلًا النت قطع ورجع)؟
        // بننقل مكانه للاتصال الجديد وبنحافظ على مقعده ودوره كمضيف
        const oldSocketId = state.members.get(userId);

        if (oldSocketId && oldSocketId !== socket.id) {
          sessions.delete(oldSocketId);

          const oldSocket = io.sockets.sockets.get(oldSocketId);

          if (oldSocket) {
            oldSocket.leave(channel(roomNumber));
          }
        }

        const publicUser = {
          userId,
          username: user.username || "",
          avatarUrl: user.avatarUrl || "",
          agoraUid: agoraUidFor(userId),
        };

        state.members.set(userId, socket.id);

        sessions.set(socket.id, {
          roomNumber,
          userId,
          user: publicUser,
          lastMessageAt: 0,
        });

        socket.join(channel(roomNumber));

        // أول واحد يدخل الغرفة بيبقى المضيف
        assignHostIfNeeded(roomNumber, state);

        io.to(channel(roomNumber)).emit("members_count", {
          count: state.members.size,
        });

        console.log(
          `🚪 [غرفة ${roomNumber}] دخل ${publicUser.username || userId} | الأعضاء: ${state.members.size}`,
        );

        reply({
          success: true,
          isOwner: state.hostId === userId,
          state: snapshot(state),
        });
      } catch (error) {
        console.error("❌ join_room error:", error);

        reply({
          success: false,
          message: error.message || "تعذر دخول الغرفة",
        });
      }
    });

    // ---------------------------------------------------
    // الخروج من الغرفة
    // ---------------------------------------------------
    socket.on("leave_room", (_data, callback) => {
      removeFromRoom(socket);

      if (typeof callback === "function") {
        callback({ success: true });
      }
    });

    // ---------------------------------------------------
    // القعود على مقعد
    // ---------------------------------------------------
/*    socket.on("take_seat", (data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const session = sessions.get(socket.id);

        if (!session) {
          throw new Error("لازم تدخل الغرفة الأول");
        }

        const seatIndex = Number(data?.seatIndex);

        if (
          !Number.isInteger(seatIndex) ||
          seatIndex < 0 ||
          seatIndex >= SEATS_COUNT
        ) {
          throw new Error("رقم المقعد غير صحيح");
        }

        const state = rooms.get(session.roomNumber);

        if (!state) {
          throw new Error("الغرفة غير متاحة");
        }

        if (seatIndex === HOST_SEAT && state.hostId !== session.userId) {
          throw new Error("المقعد ده للمضيف");
        }

        const current = state.seats[seatIndex];

        if (current && current.userId !== session.userId) {
          throw new Error("المقعد محجوز");
        }

        // أنا قاعد على المقعد ده أصلًا
        if (current && current.userId === session.userId) {
          return reply({ success: true });
        }

        // سيب مقعدك القديم الأول
        const oldIndex = releaseSeat(state, session.userId);

        if (oldIndex !== -1) {
          io.to(channel(session.roomNumber)).emit("seat_changed", {
            seatIndex: oldIndex,
            user: null,
          });
        }

        state.seats[seatIndex] = session.user;

        console.log(
          `💺 [غرفة ${session.roomNumber}] ${session.user.username || session.userId} قعد على المقعد ${seatIndex + 1}`,
        );

        io.to(channel(session.roomNumber)).emit("seat_changed", {
          seatIndex,
          user: session.user,
        });

        reply({ success: true });
      } catch (error) {
        reply({
          success: false,
          message: error.message || "تعذر القعود على المقعد",
        });
      }
    });*/
    socket.on("take_seat", (data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const session = sessions.get(socket.id);
        if (!session) throw new Error("لازم تدخل الغرفة الأول");

        const seatIndex = Number(data?.seatIndex);
        if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= SEATS_COUNT) {
          throw new Error("رقم المقعد غير صحيح");
        }

        const state = rooms.get(session.roomNumber);
        if (!state) throw new Error("الغرفة غير متاحة");

        if (seatIndex === HOST_SEAT && state.hostId !== session.userId) {
          throw new Error("المقعد ده للمضيف");
        }

        const current = state.seats[seatIndex];
        if (current && current.userId !== session.userId) {
          throw new Error("المقعد محجوز");
        }
        if (current && current.userId === session.userId) {
          return reply({ success: true });
        }

        // حركة ذرّية: نسيبه من مكانه وقعّده في الجديد في عملية واحدة
        const oldIndex = state.seats.findIndex(
          (s) => s && s.userId === session.userId,
        );

        if (oldIndex !== -1) {
          state.seats[oldIndex] = null;
        }
        state.seats[seatIndex] = session.user;

        // حدث واحد بس: قايمة المقاعد اللي اتغيرت
        io.to(channel(session.roomNumber)).emit("seats_updated", {
          changed: [
            if (oldIndex !== -1) { seatIndex: oldIndex, user: null },
            { seatIndex, user: session.user },
          ],
        });

        reply({ success: true });
      } catch (error) {
        reply({ success: false, message: error.message || "تعذر القعود على المقعد" });
      }
    });

    // ---------------------------------------------------
    // ترك المقعد
    // ---------------------------------------------------
    socket.on("leave_seat", (_data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      const session = sessions.get(socket.id);

      if (!session) {
        return reply({ success: false, message: "لازم تدخل الغرفة الأول" });
      }

      const state = rooms.get(session.roomNumber);

      if (state) {
        const seatIndex = releaseSeat(state, session.userId);

        if (seatIndex !== -1) {
          io.to(channel(session.roomNumber)).emit("seat_changed", {
            seatIndex,
            user: null,
          });
        }
      }

      reply({ success: true });
    });

    // ---------------------------------------------------
    // طرد مستخدم (للمضيف فقط — السيرفر هو اللي بيتأكد)
    // ---------------------------------------------------
    socket.on("kick_user", (data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const session = sessions.get(socket.id);

        if (!session) {
          throw new Error("لازم تدخل الغرفة الأول");
        }

        const state = rooms.get(session.roomNumber);

        if (!state) {
          throw new Error("الغرفة غير متاحة");
        }

        // الفحص هنا من بيانات السيرفر، مش من اللي التطبيق بيقوله
        if (state.hostId !== session.userId) {
          throw new Error("الطرد لمضيف الغرفة فقط");
        }

        const targetId = String(data?.userId || "").trim();

        if (!targetId || targetId === session.userId) {
          throw new Error("مينفعش تطرد نفسك");
        }

        const targetSocketId = state.members.get(targetId);

        if (!targetSocketId) {
          throw new Error("المستخدم مش موجود في الغرفة");
        }

        state.banned.set(targetId, Date.now() + KICK_BAN_MS);

        const targetSocket = io.sockets.sockets.get(targetSocketId);

        console.log(
          `🥾 [غرفة ${session.roomNumber}] ${session.user.username || session.userId} طرد ${targetId}`,
        );

        if (targetSocket) {
          targetSocket.emit("kicked", { message: "تم طردك من الغرفة" });
          removeFromRoom(targetSocket);
        } else {
          // الاتصال مات: ننضّف مكانه بس
          state.members.delete(targetId);

          const seatIndex = releaseSeat(state, targetId);

          if (seatIndex !== -1) {
            io.to(channel(session.roomNumber)).emit("seat_changed", {
              seatIndex,
              user: null,
            });
          }

          io.to(channel(session.roomNumber)).emit("members_count", {
            count: state.members.size,
          });
        }

        reply({ success: true });
      } catch (error) {
        reply({
          success: false,
          message: error.message || "تعذر تنفيذ الطرد",
        });
      }
    });

    // ---------------------------------------------------
    // تصريح الصوت (Agora)
    // اللي قاعد على مقعد بياخد تصريح تكلم، والباقي استماع بس
    // ---------------------------------------------------
    socket.on("get_voice_token", (_data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        if (!RtcTokenBuilder || !RtcRole) {
          throw new Error("خدمة الصوت غير مفعّلة على السيرفر");
        }

        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
          throw new Error("مفاتيح Agora غير مضبوطة في config.env");
        }

        const session = sessions.get(socket.id);

        if (!session) {
          throw new Error("لازم تدخل الغرفة الأول");
        }

        const state = rooms.get(session.roomNumber);

        if (!state) {
          throw new Error("الغرفة غير متاحة");
        }

        // القرار من بيانات السيرفر: هل أنت قاعد على مقعد؟
        const canSpeak = state.seats.some(
          (seat) => seat && seat.userId === session.userId,
        );

        const uid = session.user.agoraUid;
        const channelName = `room_${session.roomNumber}`;

        const token = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          channelName,
          uid,
          canSpeak ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
          VOICE_TOKEN_TTL,
          VOICE_TOKEN_TTL,
        );

        reply({
          success: true,
          appId,
          token,
          uid,
          channelName,
          canSpeak,
        });
      } catch (error) {
        console.error("❌ get_voice_token error:", error.message);

        reply({
          success: false,
          message: error.message || "تعذر تشغيل الصوت",
        });
      }
    });

    // ---------------------------------------------------
    // شات الغرفة
    // ---------------------------------------------------
    socket.on("room_message", (data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};

      try {
        const session = sessions.get(socket.id);

        if (!session) {
          throw new Error("لازم تدخل الغرفة الأول");
        }

        const text = typeof data?.text === "string" ? data.text.trim() : "";

        if (!text) {
          throw new Error("اكتب رسالة أولاً");
        }

        if (text.length > MAX_MESSAGE_LENGTH) {
          throw new Error("الرسالة طويلة جدًا");
        }

        const now = Date.now();

        if (now - session.lastMessageAt < MIN_MESSAGE_GAP_MS) {
          throw new Error("استنى شوية قبل الرسالة اللي بعدها");
        }

        session.lastMessageAt = now;

        console.log(
          `💬 [غرفة ${session.roomNumber}] ${session.user.username || session.userId}: ${text}`,
        );

        io.to(channel(session.roomNumber)).emit("room_message", {
          userId: session.userId,
          username: session.user.username,
          text,
          createdAt: new Date(now).toISOString(),
        });

        reply({ success: true });
      } catch (error) {
        reply({
          success: false,
          message: error.message || "تعذر إرسال الرسالة",
        });
      }
    });

    // ---------------------------------------------------
    // فصل الاتصال
    // ---------------------------------------------------
    socket.on("disconnect", () => {
      removeFromRoom(socket);
    });
  });
};