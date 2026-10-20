/*const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { accessSync } = require("fs");

dotenv.config({ path: path.join(__dirname, "config.env") });

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(express.json({ limit: "10mb" }));

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  username: {
    type: String,
    default: "",
  },

  country: {
    type: String,
    default: "",
  },

  age: {
    type: String,
    default: "",
  },

  gender: {
    type: String,
    default: "",
  },

  bio: {
    type: String,
    default: "",
  },

  avatarUrl: {
    type: String,
    default: "",
  },

  uid: {
    type: String,
    default: "",
  },
});

const roomSchema = new mongoose.Schema({
  roomname: {
    type: String,
    default: "",
  },

  country: {
    type: String,
    default: "",
  },

  bio: {
    type: String,
    default: "",
  },

  avatarUrl: {
    type: String,
    default: "",
  },

  background: {
    type: String,
    default: "",
  },

  uid: {
    type: String,
    default: "",
  },

  // رقم الغرفة (ID قصير: 6 أرقام أو أكتر) بيتولد في السيرفر
  roomNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
});

const notesSchema = new mongoose.Schema({
  des: {
    type: String,
    required: true,
    trim: true,
  },

  type: {
    type: String,
    required: true,
    trim: true,
  },
});

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({
  senderId: 1,
  receiverId: 1,
  createdAt: 1,
});

const User = mongoose.model("User", userSchema);
const Room = mongoose.model("Room", roomSchema);

// بيولّد رقم غرفة فريد (6 أرقام، ولو الأرقام خلصت بيزوّد خانة)
async function generateRoomNumber() {
  let digits = 6;

  for (let attempt = 1; ; attempt++) {
    const min = Math.pow(10, digits - 1);
    const number = String(Math.floor(min + Math.random() * 9 * min));

    const exists = await Room.exists({ roomNumber: number });
    if (!exists) return number;

    if (attempt % 10 === 0) digits++;
  }
}
const Note = mongoose.models.Note || mongoose.model("Note", notesSchema);

const Message = mongoose.model("Message", messageSchema);
mongoose
  .connect(process.env.CONNECTION_STRING)
  .then(() => {
    console.log("✅ تم الاتصال بـ MongoDB بنجاح!");
    console.log("📁 Database:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("❌ خطأ الاتصال بقاعدة البيانات:", err);
  });
// =============================================================================================
// البحث عن مستخدم بالإيميل
// =============================================================================================

app.get("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      res.status(400).json({
        message: `لم يتم العثور على المستخدم ${email}!`,
        atchevement: false,
      });

      return;
    } else {
      res.status(201).json({
        message: `تم العثور على المستخدم ${email} بنجاح!`,
        atchevement: true,
      });
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "حدث خطأ أثناء البحث عن المستخدم",
    });
  }
});

// =============================================================================================
// إنشاء مستخدم
// =============================================================================================

app.post("/users", async (req, res) => {
  try {
    const userinformation = await req.body;

    if (
      !userinformation ||
      !userinformation.email ||
      !userinformation.username ||
      !userinformation.country ||
      !userinformation.age ||
      !userinformation.gender ||
      !userinformation.bio ||
      !userinformation.avatarUrl
    ) {
      return res.status(400).json({
        message: "بيانات المستخدم غير مكتملة أو الإيميل مفقود",
      });
    }

    const newUser = await User.create(userinformation);

    res.status(201).json({
      message: "تم إنشاء الحساب وحفظ البيانات بنجاح!",
      newUser,
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      message:
        "حدث خطأ أثناء الحفظ (ربما الإيميل مسجل مسبقاً): " + error.message,
    });
  }
});
// =============================================================================================
// التأكد من وجود المستخدم
// =============================================================================================

app.get("/users/check/:email", async (req, res) => {
  try {
    const users = await User.findOne({
      email: req.params.email,
    });

    if (!users) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    console.log("👤 Username:", users.username);
    console.log("🖼️ Avatar:", users.avatarUrl);
    console.log("USER ID FROM MONGODB:", users._id.toString());
    return res.status(200).json({
      _id: users._id.toString(),
      username: users.username,
      uid: users.uid,
      avatarUrl: users.avatarUrl,
      country: users.country,
      bio: users.bio,
      age: users.age,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "حدث خطأ أثناء البحث عن المستخدم",
    });
  }
});

// =============================================================================================
// حذف المستخدم
// =============================================================================================

app.delete("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const deletedUser = await User.findOneAndDelete({
      email: email,
    });

    if (!deletedUser) {
      return res.status(404).json({
        message: `لم يتم العثور على المستخدم ${email} لحذفه!`,
      });
    }

    return res.status(200).json({
      message: `تم حذف المستخدم ${email} بنجاح!`,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "حدث خطأ أثناء محاولة حذف المستخدم",
    });
  }
});

app.put("/users/iditto/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // الحقول المسموح بتعديلها فقط
    const allowedUpdates = {};

    if (req.body.username !== undefined) {
      allowedUpdates.username = req.body.username;
    }

    if (req.body.country !== undefined) {
      allowedUpdates.country = req.body.country;
    }

    if (req.body.age !== undefined) {
      allowedUpdates.age = req.body.age;
    }

    if (req.body.gender !== undefined) {
      allowedUpdates.gender = req.body.gender;
    }

    if (req.body.bio !== undefined) {
      allowedUpdates.bio = req.body.bio;
    }

    if (req.body.avatarUrl !== undefined) {
      allowedUpdates.avatarUrl = req.body.avatarUrl;
    }

    // لازم يكون فيه حاجة واحدة على الأقل للتعديل
    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        message: "لم يتم إرسال أي بيانات للتعديل",
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      { $set: allowedUpdates },
      { new: true },
    );

    if (!updatedUser) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    return res.status(200).json({
      message: "تم تعديل بيانات المستخدم بنجاح",
      user: updatedUser,
    });
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      message: "حدث خطأ أثناء تعديل بيانات المستخدم",
    });
  }
});

// =============================================================================================
// إضافة ملاحظة
// =============================================================================================

app.post("/users/note", async (req, res) => {
  try {
    const { des, type } = req.body || {};

    if (
      typeof des !== "string" ||
      !des.trim() ||
      typeof type !== "string" ||
      !type.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "من فضلك أدخل الملاحظة ونوعها بشكل صحيح",
      });
    }

    // حفظ الملاحظة في MongoDB أولاً
    const savedNote = await Note.create({
      des: des.trim(),
      type: type.trim(),
    });

    // إرسال النجاح بعد اكتمال الحفظ فقط
    return res.status(201).json({
      success: true,
      message: "شكرًا على رأيك، سيتم مراجعته",
      noteId: savedNote._id,
    });
  } catch (e) {
    console.error("خطأ أثناء حفظ الملاحظة:", e);

    if (res.headersSent) return;

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء حفظ الملاحظة",
    });
  }
});

// =============================================================================================
//  الغرف
// =============================================================================================

//انشاء الغرف
app.post("/create/room", async (req, res) => {
  try {
    const roominfo = req.body;
    if (!roominfo) {
      return res.status(400).json({
        message: "هناك خطأ اثناء ارسال البيانات",
      });
    } else if (
      !roominfo.country ||
      !roominfo.roomname ||
      !roominfo.uid ||
      !roominfo.avatarUrl ||
      !roominfo.bio
    ) {
      return res.status(400).json({
        message: "هناك مدخل ناقص",
      });
    } else {
      // الرقم بيتولد في السيرفر (أي رقم جاي من التطبيق بيتتجاهل)
      const roomNumber = await generateRoomNumber();
      const data = await Room.create({ ...roominfo, roomNumber });
      res.status(200).json({
        message: "تم ارسال البيانات",
      });
    }
  } catch (e) {
    return res.status(404).json({
      message: `حدث خطأ اثناء اﻷرسال : ${e}`,
    });
  }
});

//البحث عن الغرف (برقم الغرفة، أو بالـ uid للتوافق مع القديم)
app.post("/search/rooms", async (req, res) => {
  try {
    const { roomNumber, uid } = req.body;

    if (!roomNumber && !uid) {
      return res.status(400).json({
        message: "الرجاء إدخال ID الغرفة",
      });
    }

    const filter = roomNumber
      ? { roomNumber: String(roomNumber).trim() }
      : { uid: uid };

    const data = await Room.findOne(filter);

    if (!data) {
      return res.status(404).json({
        message: "لم يتم العثور على الغرفة :404",
      });
    }

    return res.status(200).json({
      roomname: data.roomname,
      country: data.country,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      uid: data.uid,
      roomNumber: data.roomNumber,
    });
  } catch (e) {
    return res.status(500).json({
      message: `حدث خطأ: ${e.message}`,
    });
  }
});

//تفاصيل الغرفة كاملة (بما فيها الخلفية) - بتتنادى لما المستخدم يدخل الغرفة
app.post("/room/details", async (req, res) => {
  try {
    const { roomNumber, uid } = req.body;

    if (!roomNumber && !uid) {
      return res.status(400).json({
        message: "الرجاء إدخال ID الغرفة",
      });
    }

    const filter = roomNumber
      ? { roomNumber: String(roomNumber).trim() }
      : { uid: uid };

    const data = await Room.findOne(filter);

    if (!data) {
      return res.status(404).json({
        message: "لم يتم العثور على الغرفة",
      });
    }

    // الغرف القديمة اللي معندهاش رقم بنديها رقم هنا
    if (!data.roomNumber) {
      data.roomNumber = await generateRoomNumber();
      await data.save();
    }

    return res.status(200).json({
      roomname: data.roomname,
      country: data.country,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      uid: data.uid,
      roomNumber: data.roomNumber,
      background: data.background,
    });
  } catch (e) {
    return res.status(500).json({
      message: `حدث خطأ: ${e.message}`,
    });
  }
});

//عرض الغرف
app.get("/show/room", async (req, res) => {
  try {
    const rooms = await Room.find({}).select("-background");

    // الغرف القديمة اللي معندهاش رقم بنديها رقم
    for (const r of rooms) {
      if (!r.roomNumber) {
        r.roomNumber = await generateRoomNumber();
        await r.save();
      }
    }
    const count = rooms.length; // جلب العدد مباشرة من المصفوفة بكل سهولة

    if (count > 0) {
      return res.status(200).json({
        length: count,
        count_rooms: rooms,
      });
    } else {
      // إرسال رد حتى لو لم تكن هناك غرف، لتجنب تعليق الطلب
      return res.status(404).json({
        message: "لا توجد غرف متاحة حالياً",
        length: 0,
        count_rooms: [],
      });
    }
  } catch (e) {
    return res.status(500).json({
      // يفضل استخدام 500 لأخطاء السيرفر الداخلية بدلاً من 404
      message: `حدث خطأ: ${e.message}`,
    });
  }
});

// =============================================================================================
//  الرسائل
// =============================================================================================

app.get("/api/users", async (req, res) => {
  try {
    const currentUserId = req.query.currentUserId;

    if (!currentUserId || !mongoose.isValidObjectId(currentUserId)) {
      return res.status(400).json({
        message: "معرّف المستخدم الحالي غير صحيح",
      });
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
    })
      .select("_id username avatarUrl bio country")
      .lean();

    const results = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            {
              senderId: currentUserId,
              receiverId: user._id,
            },
            {
              senderId: user._id,
              receiverId: currentUserId,
            },
          ],
        })
          .sort({ createdAt: -1 })
          .select("messageText createdAt")
          .lean();

        return {
          ...user,
          lastMessageText: lastMessage?.messageText || "",
          lastMessageTime: lastMessage?.createdAt || null,
        };
      }),
    );

    results.sort((a, b) => {
      const timeA = a.lastMessageTime
        ? new Date(a.lastMessageTime).getTime()
        : 0;

      const timeB = b.lastMessageTime
        ? new Date(b.lastMessageTime).getTime()
        : 0;

      return timeB - timeA;
    });

    return res.json(results);
  } catch (error) {
    console.error("GET /api/users error:", error);

    return res.status(500).json({
      message: "تعذر تحميل المستخدمين",
    });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "معرّف المستخدم غير صحيح",
      });
    }

    const user = await User.findById(id)
      .select("_id username avatarUrl bio country")
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    return res.json(user);
  } catch (error) {
    console.error("Search user error:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء البحث",
    });
  }
});

app.get("/api/messages/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;

    if (
      !mongoose.isValidObjectId(senderId) ||
      !mongoose.isValidObjectId(receiverId)
    ) {
      return res.status(400).json({
        message: "معرّف المرسل أو المستقبل غير صحيح",
      });
    }

    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        {
          senderId: receiverId,
          receiverId: senderId,
        },
      ],
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    return res.json(
      messages.map((message) => ({
        _id: message._id.toString(),
        senderId: message.senderId.toString(),
        receiverId: message.receiverId.toString(),
        messageText: message.messageText,
        createdAt: message.createdAt,
      })),
    );
  } catch (error) {
    console.error("Fetch messages error:", error);

    return res.status(500).json({
      message: "تعذر تحميل الرسائل",
    });
  }
});

const connectedUsers = new Map();

const voiceRoomMembers = new Map();
const socketVoiceRooms = new Map();

function leaveVoiceRoom(socket) {
  const roomNumber = socketVoiceRooms.get(socket.id);

  if (!roomNumber) return;

  const roomKey = `voice_room:${roomNumber}`;
  const members = voiceRoomMembers.get(roomNumber);

  if (members) {
    members.delete(socket.id);

    if (members.size === 0) {
      voiceRoomMembers.delete(roomNumber);
    }
  }

  socketVoiceRooms.delete(socket.id);
  socket.leave(roomKey);

  const remainingMembers = voiceRoomMembers.get(roomNumber);

  io.to(roomKey).emit(
    "voice_room_users",
    remainingMembers ? Array.from(remainingMembers.values()) : [],
  );

  console.log("🚪 Voice room left:", roomNumber);
}

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // تسجيل المستخدم في غرفة الدردشة
  socket.on("join", async (userId, callback) => {
    try {
      const mongoUserId = String(userId || "").trim();

      if (!mongoose.isValidObjectId(mongoUserId)) {
        return typeof callback === "function"
          ? callback({
              success: false,
              message: "معرّف MongoDB غير صالح",
            })
          : undefined;
      }

      // التأكد من أن المستخدم موجود في قاعدة البيانات
      const userExists = await User.exists({
        _id: mongoUserId,
      });

      if (!userExists) {
        return typeof callback === "function"
          ? callback({
              success: false,
              message: "المستخدم غير موجود في قاعدة البيانات",
            })
          : undefined;
      }

      // تسجيل المستخدم وربطه بالاتصال الحالي
      connectedUsers.set(socket.id, mongoUserId);
      socket.join(mongoUserId);

      console.log("✅ User joined:", mongoUserId);
      console.log("🏠 Socket ID:", socket.id);

      if (typeof callback === "function") {
        callback({
          success: true,
          userId: mongoUserId,
          message: "تم الاتصال بالدردشة بنجاح",
        });
      }
    } catch (error) {
      console.error("❌ Join error:", error);

      if (typeof callback === "function") {
        callback({
          success: false,
          message: "حدث خطأ أثناء الاتصال بالدردشة",
        });
      }
    }
  });

  // ==========================================
  // دخول الغرفة الصوتية
  // ==========================================
  socket.on("join_voice_room", async (data, callback) => {
    try {
      const userId = connectedUsers.get(socket.id);
      const roomNumber = String(data?.roomNumber || "").trim();

      if (!userId) {
        throw new Error("سجّل دخولك في الدردشة أولاً");
      }

      if (!roomNumber) {
        throw new Error("رقم الغرفة مطلوب");
      }

      const roomExists = await Room.exists({ roomNumber });

      if (!roomExists) {
        throw new Error("الغرفة غير موجودة");
      }

      const user = await User.findById(userId)
        .select("_id username avatarUrl country")
        .lean();

      if (!user) {
        throw new Error("المستخدم غير موجود");
      }

      // منع بقاء الاتصال في غرفتين صوتيتين
      leaveVoiceRoom(socket);

      const roomKey = `voice_room:${roomNumber}`;

      socket.join(roomKey);
      socketVoiceRooms.set(socket.id, roomNumber);

      if (!voiceRoomMembers.has(roomNumber)) {
        voiceRoomMembers.set(roomNumber, new Map());
      }

      const members = voiceRoomMembers.get(roomNumber);

      members.set(socket.id, {
        userId: user._id.toString(),
        username: user.username,
        avatarUrl: user.avatarUrl,
        country: user.country,
      });

      const users = Array.from(members.values());

      // إرسال قائمة الأعضاء المحدثة للجميع
      io.to(roomKey).emit("voice_room_users", users);

      console.log("🎙️ User joined voice room:", user.username, roomNumber);

      if (typeof callback === "function") {
        callback({
          success: true,
          roomNumber,
          users,
        });
      }
    } catch (error) {
      console.error("❌ Join voice room error:", error);

      if (typeof callback === "function") {
        callback({
          success: false,
          message: error.message || "تعذر دخول الغرفة",
        });
      }
    }
  });

  // ==========================================
  // مغادرة الغرفة الصوتية
  // ==========================================
  socket.on("leave_voice_room", (callback) => {
    leaveVoiceRoom(socket);

    if (typeof callback === "function") {
      callback({ success: true });
    }
  });

  // إرسال الرسائل وحفظها في MongoDB
  socket.on("send_message", async (data, callback) => {
    try {
      const senderId = connectedUsers.get(socket.id);

      const receiverId = String(data?.receiverId || "").trim();

      const messageText =
        typeof data?.messageText === "string" ? data.messageText.trim() : "";

      if (!senderId) {
        throw new Error("لم يتم تسجيل المرسل في الدردشة. أعد فتح المحادثة.");
      }

      if (!mongoose.isValidObjectId(receiverId)) {
        throw new Error("معرّف المستقبل غير صحيح");
      }

      if (!messageText) {
        throw new Error("اكتب رسالة أولاً");
      }

      if (messageText.length > 5000) {
        throw new Error("الرسالة طويلة جدًا");
      }

      const receiverExists = await User.exists({
        _id: receiverId,
      });

      if (!receiverExists) {
        throw new Error("المستخدم المستقبل غير موجود");
      }

      const savedMessage = await Message.create({
        senderId,
        receiverId,
        messageText,
      });

      const message = {
        _id: savedMessage._id.toString(),
        senderId: savedMessage.senderId.toString(),
        receiverId: savedMessage.receiverId.toString(),
        messageText: savedMessage.messageText,
        createdAt: savedMessage.createdAt,
      };

      // إرسال الرسالة إلى غرفتي المرسل والمستقبل
      io.to(senderId).emit("receive_message", message);
      io.to(receiverId).emit("receive_message", message);

      // تحديث قائمة المحادثات
      io.to(senderId).emit("new_message", message);
      io.to(receiverId).emit("new_message", message);

      if (typeof callback === "function") {
        callback({
          success: true,
          message,
        });
      }
    } catch (error) {
      console.error("❌ Send message error:", error);

      if (typeof callback === "function") {
        callback({
          success: false,
          message: error.message || "تعذر إرسال الرسالة",
        });
      } else {
        socket.emit("chat_error", {
          message: error.message || "تعذر إرسال الرسالة",
        });
      }
    }
  });

  // إزالة الاتصال عند الخروج

  // إزالة الاتصال عند الخروج
  socket.on("disconnect", (reason) => {
    leaveVoiceRoom(socket);
    connectedUsers.delete(socket.id);
    console.log("🔌 Socket disconnected:", socket.id, reason);
  });
}); // إغلاق io.on("connection")

// تشغيل السيرفر
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Server is running");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});*/
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { accessSync } = require("fs");

dotenv.config({ path: path.join(__dirname, "config.env") });

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(express.json({ limit: "10mb" }));

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  username: {
    type: String,
    default: "",
  },

  country: {
    type: String,
    default: "",
  },

  age: {
    type: String,
    default: "",
  },

  gender: {
    type: String,
    default: "",
  },

  bio: {
    type: String,
    default: "",
  },

  avatarUrl: {
    type: String,
    default: "",
  },

  uid: {
    type: String,
    default: "",
  },
});

const roomSchema = new mongoose.Schema({
  roomname: {
    type: String,
    default: "",
  },

  country: {
    type: String,
    default: "",
  },

  bio: {
    type: String,
    default: "",
  },

  avatarUrl: {
    type: String,
    default: "",
  },

  background: {
    type: String,
    default: "",
  },

  uid: {
    type: String,
    default: "",
  },

  // رقم الغرفة (ID قصير: 6 أرقام أو أكتر) بيتولد في السيرفر
  roomNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
});

const notesSchema = new mongoose.Schema({
  des: {
    type: String,
    required: true,
    trim: true,
  },

  type: {
    type: String,
    required: true,
    trim: true,
  },
});

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({
  senderId: 1,
  receiverId: 1,
  createdAt: 1,
});

const User = mongoose.model("User", userSchema);
const Room = mongoose.model("Room", roomSchema);

// بيولّد رقم غرفة فريد (6 أرقام، ولو الأرقام خلصت بيزوّد خانة)
async function generateRoomNumber() {
  let digits = 6;

  for (let attempt = 1; ; attempt++) {
    const min = Math.pow(10, digits - 1);
    const number = String(Math.floor(min + Math.random() * 9 * min));

    const exists = await Room.exists({ roomNumber: number });
    if (!exists) return number;

    if (attempt % 10 === 0) digits++;
  }
}
const Note = mongoose.models.Note || mongoose.model("Note", notesSchema);

const Message = mongoose.model("Message", messageSchema);
mongoose
  .connect(process.env.CONNECTION_STRING)
  .then(() => {
    console.log("✅ تم الاتصال بـ MongoDB بنجاح!");
    console.log("📁 Database:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("❌ خطأ الاتصال بقاعدة البيانات:", err);
  });
// =============================================================================================
// البحث عن مستخدم بالإيميل
// =============================================================================================

app.get("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      res.status(400).json({
        message: `لم يتم العثور على المستخدم ${email}!`,
        atchevement: false,
      });

      return;
    } else {
      res.status(201).json({
        message: `تم العثور على المستخدم ${email} بنجاح!`,
        atchevement: true,
      });
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "حدث خطأ أثناء البحث عن المستخدم",
    });
  }
});

// =============================================================================================
// إنشاء مستخدم
// =============================================================================================

app.post("/users", async (req, res) => {
  try {
    const userinformation = await req.body;

    if (
      !userinformation ||
      !userinformation.email ||
      !userinformation.username ||
      !userinformation.country ||
      !userinformation.age ||
      !userinformation.gender ||
      !userinformation.bio ||
      !userinformation.avatarUrl
    ) {
      return res.status(400).json({
        message: "بيانات المستخدم غير مكتملة أو الإيميل مفقود",
      });
    }

    const newUser = await User.create(userinformation);

    res.status(201).json({
      message: "تم إنشاء الحساب وحفظ البيانات بنجاح!",
      newUser,
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      message:
        "حدث خطأ أثناء الحفظ (ربما الإيميل مسجل مسبقاً): " +
        // @ts-ignore
        error.message,
    });
  }
});
// =============================================================================================
// التأكد من وجود المستخدم
// =============================================================================================

app.get("/users/check/:email", async (req, res) => {
  try {
    const users = await User.findOne({
      email: req.params.email,
    });

    if (!users) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    console.log("👤 Username:", users.username);
    console.log("🖼️ Avatar:", users.avatarUrl);
    console.log("USER ID FROM MONGODB:", users._id.toString());
    return res.status(200).json({
      _id: users._id.toString(),
      username: users.username,
      uid: users.uid,
      avatarUrl: users.avatarUrl,
      country: users.country,
      bio: users.bio,
      age: users.age,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "حدث خطأ أثناء البحث عن المستخدم",
    });
  }
});

// =============================================================================================
// حذف المستخدم
// =============================================================================================

app.delete("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const deletedUser = await User.findOneAndDelete({
      email: email,
    });

    if (!deletedUser) {
      return res.status(404).json({
        message: `لم يتم العثور على المستخدم ${email} لحذفه!`,
      });
    }

    return res.status(200).json({
      message: `تم حذف المستخدم ${email} بنجاح!`,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "حدث خطأ أثناء محاولة حذف المستخدم",
    });
  }
});

app.put("/users/iditto/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // الحقول المسموح بتعديلها فقط
    const allowedUpdates = {};

    if (req.body.username !== undefined) {
      // @ts-ignore
      allowedUpdates.username = req.body.username;
    }

    if (req.body.country !== undefined) {
      // @ts-ignore
      allowedUpdates.country = req.body.country;
    }

    if (req.body.age !== undefined) {
      // @ts-ignore
      allowedUpdates.age = req.body.age;
    }

    if (req.body.gender !== undefined) {
      // @ts-ignore
      allowedUpdates.gender = req.body.gender;
    }

    if (req.body.bio !== undefined) {
      // @ts-ignore
      allowedUpdates.bio = req.body.bio;
    }

    if (req.body.avatarUrl !== undefined) {
      // @ts-ignore
      allowedUpdates.avatarUrl = req.body.avatarUrl;
    }

    // لازم يكون فيه حاجة واحدة على الأقل للتعديل
    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        message: "لم يتم إرسال أي بيانات للتعديل",
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      { $set: allowedUpdates },
      { new: true },
    );

    if (!updatedUser) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    return res.status(200).json({
      message: "تم تعديل بيانات المستخدم بنجاح",
      user: updatedUser,
    });
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      message: "حدث خطأ أثناء تعديل بيانات المستخدم",
    });
  }
});

// =============================================================================================
// إضافة ملاحظة
// =============================================================================================

app.post("/users/note", async (req, res) => {
  try {
    const { des, type } = req.body || {};

    if (
      typeof des !== "string" ||
      !des.trim() ||
      typeof type !== "string" ||
      !type.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "من فضلك أدخل الملاحظة ونوعها بشكل صحيح",
      });
    }

    // حفظ الملاحظة في MongoDB أولاً
    const savedNote = await Note.create({
      des: des.trim(),
      type: type.trim(),
    });

    // إرسال النجاح بعد اكتمال الحفظ فقط
    return res.status(201).json({
      success: true,
      message: "شكرًا على رأيك، سيتم مراجعته",
      noteId: savedNote._id,
    });
  } catch (e) {
    console.error("خطأ أثناء حفظ الملاحظة:", e);

    if (res.headersSent) return;

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء حفظ الملاحظة",
    });
  }
});

// =============================================================================================
//  الغرف
// =============================================================================================

//انشاء الغرف
app.post("/create/room", async (req, res) => {
  try {
    const roominfo = req.body;
    if (!roominfo) {
      return res.status(400).json({
        message: "هناك خطأ اثناء ارسال البيانات",
      });
    } else if (
      !roominfo.country ||
      !roominfo.roomname ||
      !roominfo.uid ||
      !roominfo.avatarUrl ||
      !roominfo.bio
    ) {
      return res.status(400).json({
        message: "هناك مدخل ناقص",
      });
    } else {
      // الرقم بيتولد في السيرفر (أي رقم جاي من التطبيق بيتتجاهل)
      const roomNumber = await generateRoomNumber();
      const data = await Room.create({ ...roominfo, roomNumber });
      res.status(200).json({
        message: "تم ارسال البيانات",
      });
    }
  } catch (e) {
    return res.status(404).json({
      message: `حدث خطأ اثناء اﻷرسال : ${e}`,
    });
  }
});

//البحث عن الغرف (برقم الغرفة، أو بالـ uid للتوافق مع القديم)
app.post("/search/rooms", async (req, res) => {
  try {
    const { roomNumber, uid } = req.body;

    if (!roomNumber && !uid) {
      return res.status(400).json({
        message: "الرجاء إدخال ID الغرفة",
      });
    }

    const filter = roomNumber
      ? { roomNumber: String(roomNumber).trim() }
      : { uid: uid };

    const data = await Room.findOne(filter);

    if (!data) {
      return res.status(404).json({
        message: "لم يتم العثور على الغرفة :404",
      });
    }

    return res.status(200).json({
      roomname: data.roomname,
      country: data.country,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      uid: data.uid,
      roomNumber: data.roomNumber,
    });
  } catch (e) {
    return res.status(500).json({
      message: `حدث خطأ: ${e.message}`,
    });
  }
});

//تفاصيل الغرفة كاملة (بما فيها الخلفية) - بتتنادى لما المستخدم يدخل الغرفة
app.post("/room/details", async (req, res) => {
  try {
    const { roomNumber, uid } = req.body;

    if (!roomNumber && !uid) {
      return res.status(400).json({
        message: "الرجاء إدخال ID الغرفة",
      });
    }

    const filter = roomNumber
      ? { roomNumber: String(roomNumber).trim() }
      : { uid: uid };

    const data = await Room.findOne(filter);

    if (!data) {
      return res.status(404).json({
        message: "لم يتم العثور على الغرفة",
      });
    }

    // الغرف القديمة اللي معندهاش رقم بنديها رقم هنا
    if (!data.roomNumber) {
      data.roomNumber = await generateRoomNumber();
      await data.save();
    }

    return res.status(200).json({
      roomname: data.roomname,
      country: data.country,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      uid: data.uid,
      roomNumber: data.roomNumber,
      background: data.background,
    });
  } catch (e) {
    return res.status(500).json({
      message: `حدث خطأ: ${e.message}`,
    });
  }
});

//عرض الغرف
app.get("/show/room", async (req, res) => {
  try {
    const rooms = await Room.find({}).select("-background");

    // الغرف القديمة اللي معندهاش رقم بنديها رقم
    for (const r of rooms) {
      if (!r.roomNumber) {
        r.roomNumber = await generateRoomNumber();
        await r.save();
      }
    }
    const count = rooms.length; // جلب العدد مباشرة من المصفوفة بكل سهولة

    if (count > 0) {
      return res.status(200).json({
        length: count,
        count_rooms: rooms,
      });
    } else {
      // إرسال رد حتى لو لم تكن هناك غرف، لتجنب تعليق الطلب
      return res.status(404).json({
        message: "لا توجد غرف متاحة حالياً",
        length: 0,
        count_rooms: [],
      });
    }
  } catch (e) {
    return res.status(500).json({
      // يفضل استخدام 500 لأخطاء السيرفر الداخلية بدلاً من 404
      message: `حدث خطأ: ${e.message}`,
    });
  }
});

// =============================================================================================
//  الرسائل
// =============================================================================================

app.get("/api/users", async (req, res) => {
  try {
    const currentUserId = req.query.currentUserId;

    if (!currentUserId || !mongoose.isValidObjectId(currentUserId)) {
      return res.status(400).json({
        message: "معرّف المستخدم الحالي غير صحيح",
      });
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
    })
      .select("_id username avatarUrl bio country")
      .lean();

    const results = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          // @ts-ignore
          $or: [
            {
              senderId: currentUserId,
              receiverId: user._id,
            },
            {
              senderId: user._id,
              receiverId: currentUserId,
            },
          ],
        })
          .sort({ createdAt: -1 })
          .select("messageText createdAt")
          .lean();

        return {
          ...user,
          lastMessageText: lastMessage?.messageText || "",
          lastMessageTime: lastMessage?.createdAt || null,
        };
      }),
    );

    results.sort((a, b) => {
      const timeA = a.lastMessageTime
        ? new Date(a.lastMessageTime).getTime()
        : 0;

      const timeB = b.lastMessageTime
        ? new Date(b.lastMessageTime).getTime()
        : 0;

      return timeB - timeA;
    });

    return res.json(results);
  } catch (error) {
    console.error("GET /api/users error:", error);

    return res.status(500).json({
      message: "تعذر تحميل المستخدمين",
    });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "معرّف المستخدم غير صحيح",
      });
    }

    const user = await User.findById(id)
      .select("_id username avatarUrl bio country")
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    return res.json(user);
  } catch (error) {
    console.error("Search user error:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء البحث",
    });
  }
});

app.get("/api/messages/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;

    if (
      !mongoose.isValidObjectId(senderId) ||
      !mongoose.isValidObjectId(receiverId)
    ) {
      return res.status(400).json({
        message: "معرّف المرسل أو المستقبل غير صحيح",
      });
    }

    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        {
          senderId: receiverId,
          receiverId: senderId,
        },
      ],
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    return res.json(
      messages.map((message) => ({
        _id: message._id.toString(),
        senderId: message.senderId.toString(),
        receiverId: message.receiverId.toString(),
        messageText: message.messageText,
        createdAt: message.createdAt,
      })),
    );
  } catch (error) {
    console.error("Fetch messages error:", error);

    return res.status(500).json({
      message: "تعذر تحميل الرسائل",
    });
  }
});

const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // تسجيل المستخدم في غرفة الدردشة
  socket.on("join", async (userId, callback) => {
    try {
      const mongoUserId = String(userId || "").trim();

      if (!mongoose.isValidObjectId(mongoUserId)) {
        return typeof callback === "function"
          ? callback({
              success: false,
              message: "معرّف MongoDB غير صالح",
            })
          : undefined;
      }

      // التأكد من أن المستخدم موجود في قاعدة البيانات
      const userExists = await User.exists({
        _id: mongoUserId,
      });

      if (!userExists) {
        return typeof callback === "function"
          ? callback({
              success: false,
              message: "المستخدم غير موجود في قاعدة البيانات",
            })
          : undefined;
      }

      // تسجيل المستخدم وربطه بالاتصال الحالي
      connectedUsers.set(socket.id, mongoUserId);
      socket.join(mongoUserId);

      console.log("✅ User joined:", mongoUserId);
      console.log("🏠 Socket ID:", socket.id);

      if (typeof callback === "function") {
        callback({
          success: true,
          userId: mongoUserId,
          message: "تم الاتصال بالدردشة بنجاح",
        });
      }
    } catch (error) {
      console.error("❌ Join error:", error);

      if (typeof callback === "function") {
        callback({
          success: false,
          message: "حدث خطأ أثناء الاتصال بالدردشة",
        });
      }
    }
  });

  // إرسال الرسائل وحفظها في MongoDB
  socket.on("send_message", async (data, callback) => {
    try {
      const senderId = connectedUsers.get(socket.id);

      const receiverId = String(data?.receiverId || "").trim();

      const messageText =
        typeof data?.messageText === "string" ? data.messageText.trim() : "";

      if (!senderId) {
        throw new Error("لم يتم تسجيل المرسل في الدردشة. أعد فتح المحادثة.");
      }

      if (!mongoose.isValidObjectId(receiverId)) {
        throw new Error("معرّف المستقبل غير صحيح");
      }

      if (!messageText) {
        throw new Error("اكتب رسالة أولاً");
      }

      if (messageText.length > 5000) {
        throw new Error("الرسالة طويلة جدًا");
      }

      const receiverExists = await User.exists({
        _id: receiverId,
      });

      if (!receiverExists) {
        throw new Error("المستخدم المستقبل غير موجود");
      }

      const savedMessage = await Message.create({
        senderId,
        receiverId,
        messageText,
      });

      const message = {
        _id: savedMessage._id.toString(),
        senderId: savedMessage.senderId.toString(),
        receiverId: savedMessage.receiverId.toString(),
        messageText: savedMessage.messageText,
        createdAt: savedMessage.createdAt,
      };

      // إرسال الرسالة إلى غرفتي المرسل والمستقبل
      io.to(senderId).emit("receive_message", message);
      io.to(receiverId).emit("receive_message", message);

      // تحديث قائمة المحادثات
      io.to(senderId).emit("new_message", message);
      io.to(receiverId).emit("new_message", message);

      if (typeof callback === "function") {
        callback({
          success: true,
          message,
        });
      }
    } catch (error) {
      console.error("❌ Send message error:", error);

      if (typeof callback === "function") {
        callback({
          success: false,
          // @ts-ignore
          message: error.message || "تعذر إرسال الرسالة",
        });
      } else {
        socket.emit("chat_error", {
          // @ts-ignore
          message: error.message || "تعذر إرسال الرسالة",
        });
      }
    }
  });

  // إزالة الاتصال عند الخروج
  socket.on("disconnect", (reason) => {
    connectedUsers.delete(socket.id);

    console.log("🔌 Socket disconnected:", socket.id, reason);
  });
});

// ===============================
// أحداث الغرف الصوتية (ملف منفصل: roomSocket.js)
// ===============================
require("./roomSocket")(io, { User, Room, mongoose });

// ===============================
// تشغيل السيرفر
// ===============================

const PORT = process.env.PORT || 5000;

// @ts-ignore
app.get("/", (req, res) => {
  res.send("Server is running");
});

// @ts-ignore
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
