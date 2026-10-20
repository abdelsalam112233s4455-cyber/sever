const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// تحميل إعدادات البيئة
dotenv.config({ path: path.join(__dirname, 'config.env') });

const app = express();
app.use(express.json());

// 📝 الـ Schema الخاصة بالمستخدمين في MongoDB
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, default: '' },
    country: { type: String, default: '' },
    age: { type: String, default: '' },
    gender: { type: String, default: '' },
    bio: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ✅ الاتصال بقاعدة بيانات MongoDB
mongoose.connect(process.env.CONNECTION_STRING)
    .then(async () => {
        console.log('✅ تم الاتصال بـ MongoDB بنجاح!');
    })
    .catch(err => console.error('❌ خطأ الاتصال بقاعدة البيانات:', err));

app.get('/users/:email', async (req , res) => {
    try {
        const email = req.params.email;
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
            res.send("اكمل بينات الحساب");
        }else {
            res.send(`تم العثور على المستخدم ${email}`);
        }
    }catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ أثناء البحث عن المستخدم' });
    }
});

app.post("/users", async (req , res) => {
    try {
        const userinformation = await req.body;
        
        if (!userinformation|| !userinformation.email || !userinformation.username || !userinformation.country || !userinformation.age || !userinformation.gender || !userinformation.bio || !userinformation.avatarUrl) {
            return res.status(400).json({ message: 'بيانات المستخدم غير مكتملة أو الإيميل مفقود' });
        }

        const newUser = await User.create(userinformation);
        res.status(201).json({ message: 'تم إنشاء الحساب وحفظ البيانات بنجاح!', newUser });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'حدث خطأ أثناء الحفظ (ربما الإيميل مسجل مسبقاً): ' + error.message });
    }
});

app.get("/users" , async (req , res) => {
    try{
        const users = await User.findOne({email: req.body.email});
        console.log(users.username + " " + users.country + " " + users.age + " " + users.gender + " " + users.bio + " " + users.avatarUrl);
        res.send(users.username , users.avatarUrl);
    }catch(error){
        console.error(error);
    }
});
    
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل الآن على Port ${PORT}`);
});