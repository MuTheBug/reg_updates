# جمعية حقنا - نظام تسجيل البيانات
# Haquna Association - Registry System

نظام ويب محلي لتسجيل وإدارة بيانات المعتقلين والمغيبين قسرياً والناجين والمتوفين.

A local web-based registry system for recording and managing information about detainees, forcibly disappeared persons, survivors, and deceased.

---

## المميزات / Features

- **نموذج تفاعلي متقدم** — 9 أقسام شاملة لتسجيل جميع البيانات الشخصية والاجتماعية والصحية
- **قاعدة بيانات SQLite** — تخزين آمن يدعم حتى 1500+ سجل
- **رفع الصور والوثائق** — دعم رفع الصور الشخصية ووثائق الإثبات
- **لوحة إدارة** — عرض، بحث، تصفية، وتصدير السجلات
- **دعم الشبكة المحلية** — يمكن لأي جهاز على نفس الشبكة الوصول للنظام
- **متوافق مع الأجهزة المحمولة** — تصميم متجاوب مُحسَّن لأجهزة Android
- **يدعم 7 مستخدمين متزامنين** — SQLite WAL mode للأداء الأمثل

---

## المتطلبات / Requirements

- **Node.js** الإصدار 16 أو أحدث
- **npm** (يأتي مع Node.js)

---

## التثبيت على Linux / Linux Setup

### 1. تثبيت Node.js

**Ubuntu / Debian:**
```bash
# تحديث قائمة الحزم
sudo apt update

# تثبيت Node.js و npm
sudo apt install -y nodejs npm

# التحقق من الإصدار
node --version
npm --version
```

**إذا كنت تحتاج إصدار أحدث من Node.js:**
```bash
# تثبيت Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Fedora / CentOS / RHEL:**
```bash
sudo dnf install -y nodejs npm
```

**Arch Linux:**
```bash
sudo pacman -S nodejs npm
```

### 2. تحميل المشروع وتثبيت الاعتماديات

```bash
# انتقل إلى مجلد المشروع
cd registry_system

# تثبيت الاعتماديات
npm install
```

### 3. تشغيل السيرفر

```bash
# تشغيل السيرفر
npm start
```

### 4. تشغيل السيرفر في الخلفية (اختياري)

```bash
# تشغيل في الخلفية باستخدام nohup
nohup npm start > server.log 2>&1 &

# لإيقاف السيرفر لاحقاً
kill $(lsof -t -i:3000)
```

### 5. السماح بالوصول عبر جدار الحماية (إن لزم)

```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp

# firewalld (Fedora/CentOS)
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

---

## التثبيت على Windows / Windows Setup

### 1. تثبيت Node.js

1. اذهب إلى الموقع الرسمي: **https://nodejs.org**
2. حمّل نسخة **LTS** (الإصدار المستقر الطويل الدعم)
3. شغّل ملف التثبيت واتبع الخطوات (اترك الخيارات الافتراضية)
4. **مهم:** تأكد من تحديد خيار "Add to PATH" أثناء التثبيت

**للتحقق من التثبيت:**
- افتح **Command Prompt** أو **PowerShell**
```cmd
node --version
npm --version
```

### 2. تحميل المشروع وتثبيت الاعتماديات

افتح **Command Prompt** أو **PowerShell**:

```cmd
:: انتقل إلى مجلد المشروع
cd registry_system

:: تثبيت الاعتماديات
npm install
```

### 3. تشغيل السيرفر

```cmd
npm start
```

### 4. السماح بالوصول عبر جدار حماية Windows

عند تشغيل السيرفر لأول مرة، قد يظهر تنبيه من جدار حماية Windows:
- اضغط **"Allow access"** أو **"السماح بالوصول"**
- تأكد من تحديد **"Private networks"** (الشبكات الخاصة)

**إذا لم يظهر التنبيه، أضف القاعدة يدوياً:**

1. افتح **Windows Defender Firewall**
2. اضغط على **"Advanced settings"**
3. اضغط على **"Inbound Rules"** → **"New Rule"**
4. اختر **"Port"** → **"TCP"** → أدخل **3000**
5. اختر **"Allow the connection"**
6. حدد **"Private"** → أعطِ القاعدة اسماً مثل "Registry System"

---

## الاستخدام / Usage

### الوصول للنظام

بعد تشغيل السيرفر، ستظهر رسالة تحتوي على عناوين الوصول:

```
╔════════════════════════════════════════════════╗
║       جمعية حقنا - نظام تسجيل البيانات       ║
╠════════════════════════════════════════════════╣
║  Local:   http://localhost:3000               ║
║  Network: http://192.168.x.x:3000            ║
║  Admin:   http://localhost:3000/admin          ║
╚════════════════════════════════════════════════╝
```

| الصفحة | الرابط | الوصف |
|--------|--------|-------|
| **نموذج التسجيل** | `http://localhost:3000` | الصفحة الرئيسية لتسجيل البيانات |
| **لوحة الإدارة** | `http://localhost:3000/admin` | عرض وإدارة السجلات |

### الوصول من أجهزة أخرى على نفس الشبكة

1. تأكد من أن الأجهزة على **نفس شبكة WiFi** أو الشبكة المحلية
2. على جهاز آخر (هاتف أو حاسوب)، افتح المتصفح
3. أدخل عنوان **Network** الذي يظهر عند تشغيل السيرفر
   - مثال: `http://192.168.1.100:3000`

### معرفة عنوان IP للجهاز

**Linux:**
```bash
ip addr show | grep "inet "
# أو
hostname -I
```

**Windows:**
```cmd
ipconfig
```
ابحث عن **IPv4 Address** تحت **Wireless LAN adapter Wi-Fi** أو **Ethernet adapter**

---

## هيكل المشروع / Project Structure

```
registry_system/
├── server.js          # سيرفر Node.js الرئيسي
├── form.html          # نموذج التسجيل (الصفحة الرئيسية)
├── admin.html         # لوحة الإدارة
├── logo.jpg           # شعار الجمعية
├── package.json       # اعتماديات المشروع
├── .gitignore         # ملفات مُستثناة من Git
├── README.md          # هذا الملف
├── registry.db        # قاعدة البيانات (يُنشأ تلقائياً)
└── uploads/           # مجلد الملفات المرفوعة (يُنشأ تلقائياً)
    ├── photos/        # الصور الشخصية
    └── documents/     # وثائق الإثبات
```

---

## التقنيات المستخدمة / Tech Stack

| التقنية | الوصف |
|---------|-------|
| **Node.js** | بيئة تشغيل JavaScript على الخادم |
| **Express.js** | إطار عمل للويب |
| **SQLite** (better-sqlite3) | قاعدة بيانات مدمجة لا تحتاج خادم منفصل |
| **Multer** | معالجة رفع الملفات |
| **HTML/CSS/JS** | الواجهة الأمامية بدون اعتماديات خارجية |

---

## واجهة برمجة التطبيقات (API)

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| `GET` | `/` | نموذج التسجيل |
| `GET` | `/admin` | لوحة الإدارة |
| `POST` | `/api/records` | إنشاء سجل جديد |
| `GET` | `/api/records` | جلب السجلات (مع تصفية وترقيم) |
| `GET` | `/api/records/:id` | جلب سجل واحد |
| `DELETE` | `/api/records/:id` | حذف سجل |
| `GET` | `/api/stats` | إحصائيات عامة |
| `GET` | `/api/export` | تصدير جميع السجلات كملف JSON |

### معاملات البحث (GET /api/records)

| المعامل | الوصف | مثال |
|---------|-------|------|
| `page` | رقم الصفحة | `?page=2` |
| `limit` | عدد السجلات في الصفحة | `?limit=25` |
| `search` | بحث بالاسم أو الرقم الوطني أو الهاتف | `?search=أحمد` |
| `status` | تصفية بالحالة (enforced/survivor/deceased) | `?status=survivor` |
| `province` | تصفية بالمحافظة | `?province=دمشق` |

---

## تغيير المنفذ / Changing the Port

بشكل افتراضي يعمل السيرفر على المنفذ **3000**. لتغييره:

**Linux:**
```bash
PORT=8080 npm start
```

**Windows (PowerShell):**
```powershell
$env:PORT=8080; npm start
```

**Windows (Command Prompt):**
```cmd
set PORT=8080 && npm start
```

---

## النسخ الاحتياطي / Backup

لعمل نسخة احتياطية من البيانات:

```bash
# نسخ قاعدة البيانات
cp registry.db registry_backup_$(date +%Y%m%d).db

# نسخ الملفات المرفوعة
cp -r uploads/ uploads_backup_$(date +%Y%m%d)/
```

على Windows:
```cmd
:: نسخ قاعدة البيانات
copy registry.db registry_backup.db

:: نسخ الملفات المرفوعة
xcopy uploads uploads_backup /E /I
```

---

## استكشاف الأخطاء / Troubleshooting

### السيرفر لا يعمل
- تأكد من تثبيت Node.js: `node --version`
- تأكد من تشغيل `npm install` قبل `npm start`
- تأكد من عدم استخدام المنفذ 3000 من برنامج آخر

### لا يمكن الوصول من أجهزة أخرى
- تأكد من أن الأجهزة على نفس الشبكة
- تحقق من إعدادات جدار الحماية (Firewall)
- استخدم عنوان IP الصحيح (ليس localhost)

### خطأ في رفع الملفات
- الحد الأقصى لحجم الملف: 10 ميغابايت
- الصيغ المدعومة للصور: JPG, PNG, GIF, WebP
- الصيغ المدعومة للوثائق: JPG, PNG, PDF

### خطأ "better-sqlite3" على Windows
إذا فشل تثبيت `better-sqlite3`، قد تحتاج إلى أدوات البناء:
```cmd
npm install --global windows-build-tools
```
أو قم بتثبيت **Visual Studio Build Tools** من موقع Microsoft.

---

## الترخيص / License

هذا المشروع مُطوَّر لصالح **جمعية حقنا** لأغراض إنسانية.

تصميم فريق جمعية حقنا بكل ❤️ حب
