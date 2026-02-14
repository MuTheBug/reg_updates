const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = path.join(__dirname, 'registry.db');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

function initDbSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            first_name TEXT NOT NULL,
            father_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            gender TEXT NOT NULL,
            mother_name TEXT NOT NULL,
            birth_day INTEGER,
            birth_month INTEGER,
            birth_year INTEGER,
            province TEXT NOT NULL,
            national_id TEXT NOT NULL,
            phone TEXT,
            blood_type TEXT,
            photo_path TEXT,
            document_path TEXT,
            arrest_day INTEGER,
            arrest_month INTEGER,
            arrest_year INTEGER,
            arrest_place TEXT NOT NULL,
            arrest_authority TEXT NOT NULL,
            arrest_reason TEXT NOT NULL,
            arrest_causer TEXT,
            status TEXT,
            release_day INTEGER,
            release_month INTEGER,
            release_year INTEGER,
            death_day INTEGER,
            death_month INTEGER,
            death_year INTEGER,
            marital TEXT,
            guardian_name TEXT,
            guardian_relation TEXT,
            guardian_phone TEXT,
            spouse_name TEXT,
            spouse_phone TEXT,
            has_kids TEXT,
            kids_count INTEGER,
            children_data TEXT,
            ex_spouse_name TEXT,
            has_kids_w TEXT,
            kids_count_w INTEGER,
            children_data_w TEXT,
            address TEXT NOT NULL,
            housing_type TEXT NOT NULL,
            employment TEXT,
            profession TEXT,
            employer TEXT,
            breadwinner TEXT,
            breadwinner_job TEXT,
            chronic TEXT,
            diseases TEXT,
            education TEXT,
            edu_type TEXT,
            edu_specialization TEXT,
            edu_university TEXT,
            kids_under_18_count INTEGER DEFAULT 0,
            rent_amount TEXT,
            has_hypertension INTEGER,
            has_diabetes INTEGER,
            other_diseases TEXT,
            is_officially_registered INTEGER,
            legal TEXT,
            legal_details TEXT,
            assoc TEXT,
            assoc_name TEXT,
            service_type TEXT,
            notes TEXT
        );
    `);
    const columnsToAdd = [
        { name: 'edu_type', type: 'TEXT' },
        { name: 'edu_specialization', type: 'TEXT' },
        { name: 'edu_university', type: 'TEXT' },
        { name: 'kids_under_18_count', type: 'INTEGER DEFAULT 0' },
        { name: 'breadwinner_job', type: 'TEXT' },
        { name: 'death_place', type: 'TEXT' },
        { name: 'rent_amount', type: 'TEXT' },
        { name: 'has_hypertension', type: 'INTEGER' },
        { name: 'has_diabetes', type: 'INTEGER' },
        { name: 'other_diseases', type: 'TEXT' },
        { name: 'is_officially_registered', type: 'INTEGER' },
        { name: 'has_special_needs', type: 'INTEGER' },
        { name: 'special_needs_details', type: 'TEXT' }
    ];
    for (const col of columnsToAdd) {
        try { db.exec(`ALTER TABLE records ADD COLUMN ${col.name} ${col.type}`); } catch (err) {}
    }
}
initDbSchema();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subdir = file.fieldname === 'photo' ? 'photos' : 'documents';
        const dir = path.join(UPLOAD_DIR, subdir);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 2 }
});

// Separate multer for backup restore (higher size limit, temp storage)
const backupUpload = multer({
    dest: path.join(__dirname, 'temp_uploads'),
    limits: { fileSize: 500 * 1024 * 1024 }
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
const AUTH_TOKEN = 'authenticated_session_' + Buffer.from(ADMIN_PASS).toString('base64').substring(0, 16);

const authMiddleware = (req, res, next) => {
    if (req.cookies.admin_auth === AUTH_TOKEN) next();
    else if (req.xhr || req.path.startsWith('/api/')) res.status(401).json({ error: 'Unauthorized' });
    else res.redirect('/login');
};

app.use(express.static(__dirname, { index: false }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'form.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/admin', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.post('/api/login', (req, res) => {
    if (req.body.password === ADMIN_PASS) {
        res.cookie('admin_auth', AUTH_TOKEN, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.json({ success: true });
    } else res.status(401).json({ error: 'Invalid password' });
});

app.get('/api/logout', (req, res) => {
    res.clearCookie('admin_auth');
    res.redirect('/login');
});

function collectChildrenData(body, prefix) {
    const children = [];
    let under18Count = 0;
    const currentYear = new Date().getFullYear();
    for (let i = 1; i <= 20; i++) {
        const key = `cName_${prefix}_${i}`;
        if (body[key]) {
            const birthYearVal = body[`cBirthYear_${prefix}_${i}`];
            const birthYear = parseInt(birthYearVal);
            if (!isNaN(birthYear) && (currentYear - birthYear) < 18) under18Count++;
            children.push({
                name: body[key],
                gender: body[`cGender_${prefix}_${i}`] || '',
                birthYear: birthYearVal || '',
                education: body[`cEdu_${prefix}_${i}`] || '',
                eduType: body[`cEduType_${prefix}_${i}`] || '',
                specialization: body[`cSpec_${prefix}_${i}`] || '',
                university: body[`cUniv_${prefix}_${i}`] || '',
                job: body[`cJob_${prefix}_${i}`] || '',
                healthStatus: body[`cHP_${prefix}_${i}`] || '',
                healthDetails: body[`cHPD_${prefix}_${i}`] || '',
                diseases: body[`cDiseases_${prefix}_${i}`] ? JSON.parse(body[`cDiseases_${prefix}_${i}`]) : []
            });
        }
    }
    return { data: children.length > 0 ? children : null, under18Count };
}

function collectLegalData(body) {
    const problems = [];
    for (let i = 1; i <= 20; i++) {
        const key = `legalProb_${i}`;
        if (body[key]) problems.push(body[key]);
    }
    return problems.length > 0 ? JSON.stringify(problems) : null;
}

app.post('/api/records', upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'document', maxCount: 1 }
]), (req, res) => {
    try {
        const b = req.body;
        const photoPath = req.files?.photo?.[0]?.filename || null;
        const docPath = req.files?.document?.[0]?.filename || null;
        const { data: c1, under18Count: u1 } = collectChildrenData(b, 'kidsBox');
        const { data: c2, under18Count: u2 } = collectChildrenData(b, 'kidsBoxW');

        const stmt = db.prepare(`
            INSERT INTO records (
                first_name, father_name, last_name, gender, mother_name,
                birth_day, birth_month, birth_year, province, national_id,
                phone, blood_type, photo_path, document_path,
                arrest_day, arrest_month, arrest_year, arrest_place,
                arrest_authority, arrest_reason, arrest_causer, status,
                release_day, release_month, release_year,
                death_day, death_month, death_year, death_place,
                marital, guardian_name, guardian_relation, guardian_phone,
                spouse_name, spouse_phone, has_kids, kids_count, children_data,
                ex_spouse_name, has_kids_w, kids_count_w, children_data_w,
                kids_under_18_count, address, housing_type, employment,
                profession, employer, breadwinner, chronic, diseases,
                education, edu_type, edu_specialization, edu_university,
                legal, legal_details, assoc, assoc_name, service_type, notes, breadwinner_job,
                rent_amount, has_hypertension, has_diabetes, other_diseases, is_officially_registered,
                has_special_needs, special_needs_details
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?
            )
        `);

        const result = stmt.run(
            b.firstName, b.fatherName, b.lastName, b.gender, b.motherName,
            b.birthDay || null, b.birthMonth || null, b.birthYear || null, b.province, b.nationalId,
            b.phone || null, b.bloodType || null, photoPath, docPath,
            b.arrestDay || null, b.arrestMonth || null, b.arrestYear || null, b.arrestPlace,
            b.arrestAuthority, b.arrestReason, b.arrestCauser || null, b.status || null,
            b.releaseDay || null, b.releaseMonth || null, b.releaseYear || null,
            b.deathDay || null, b.deathMonth || null, b.deathYear || null, b.deathPlace || null,
            b.marital || null, b.guardianName || null, b.guardianRelation || null, b.guardianPhone || null,
            b.spouseName || null, b.spousePhone || null, b.hasKids || null, b.kidsCount || null,
            c1 ? JSON.stringify(c1) : null, b.exSpouseName || null, b.hasKidsW || null,
            b.kidsCountW || null, c2 ? JSON.stringify(c2) : null,
            u1 + u2, b.address, b.housingType, b.employment || null, b.profession || null,
            b.employer || null, b.breadwinner || null, b.chronic || null, b.diseases || null,
            b.education || null, b.eduType || null, b.eduSpecialization || null, b.eduUniversity || null,
            b.legal || null, b.legal === 'yes' ? collectLegalData(b) : null, b.assoc || null, b.assocName || null,
            b.serviceType || null, b.notes || null, b.breadwinnerJob || null,
            b.rentAmount || null, b.hasHypertension === 'yes' ? 1 : 0, b.hasDiabetes === 'yes' ? 1 : 0, b.otherDiseases || null, b.isOfficiallyRegistered === 'yes' ? 1 : 0,
            b.hasSpecialNeeds === 'yes' ? 1 : 0, b.specialNeedsDetails || null
        );
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/records', authMiddleware, (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const province = req.query.province || '';

        let where = 'WHERE 1=1';
        const params = [];
        if (search) {
            where += ' AND (first_name LIKE ? OR last_name LIKE ? OR father_name LIKE ? OR national_id LIKE ? OR phone LIKE ? OR mother_name LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }
        if (status) { where += ' AND status = ?'; params.push(status); }
        if (province) { where += ' AND province = ?'; params.push(province); }

        const gender = req.query.gender || '';
        const marital = req.query.marital || '';
        const education = req.query.education || '';
        const minKids = req.query.minKids || '';
        const minUnder18 = req.query.minUnder18 || '';

        if (gender) { where += ' AND gender = ?'; params.push(gender); }
        if (marital) { where += ' AND marital = ?'; params.push(marital); }
        if (education) { where += ' AND education = ?'; params.push(education); }
        if (minKids) { where += ' AND (IFNULL(kids_count, 0) + IFNULL(kids_count_w, 0)) >= ?'; params.push(parseInt(minKids)); }
        if (minUnder18) { where += ' AND kids_under_18_count >= ?'; params.push(parseInt(minUnder18)); }

        if (req.query.noDocs === 'true') {
            where += ' AND (photo_path IS NULL OR photo_path = "") AND (document_path IS NULL OR document_path = "")';
        }
        if (req.query.diedInPlace) {
            where += ' AND status = "deceased" AND death_place = ?';
            params.push(req.query.diedInPlace);
        }
        if (req.query.survivedInPlace) {
            where += ' AND status = "survivor" AND arrest_place = ?';
            params.push(req.query.survivedInPlace);
        }

        const total = db.prepare(`SELECT COUNT(*) as count FROM records ${where}`).get(...params).count;
        const records = db.prepare(`SELECT * FROM records ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
        res.json({ records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/records/:id', authMiddleware, (req, res) => {
    const r = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
});

app.put('/api/records/:id', authMiddleware, upload.fields([{ name: 'photo' }, { name: 'document' }]), (req, res) => {
    try {
        const b = req.body;
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
        if (!old) return res.status(404).json({ error: 'Not found' });

        let pPath = old.photo_path;
        if (req.files?.photo) pPath = req.files.photo[0].filename;
        let dPath = old.document_path;
        if (req.files?.document) dPath = req.files.document[0].filename;

        const map = {
            firstName:'first_name', fatherName:'father_name', lastName:'last_name', gender:'gender', motherName:'mother_name',
            birthDay:'birth_day', birthMonth:'birth_month', birthYear:'birth_year', province:'province', nationalId:'national_id',
            phone:'phone', bloodType:'blood_type', arrestDay:'arrest_day', arrestMonth:'arrest_month', arrestYear:'arrest_year',
            arrestPlace:'arrest_place', arrestAuthority:'arrest_authority', arrestReason:'arrest_reason', arrestCauser:'arrest_causer',
            status:'status',
            releaseDay:'release_day', releaseMonth:'release_month', releaseYear:'release_year',
            deathDay:'death_day', deathMonth:'death_month', deathYear:'death_year', deathPlace:'death_place',
            marital:'marital', spouseName:'spouse_name', spousePhone:'spouse_phone', exSpouseName:'ex_spouse_name',
            guardianName:'guardian_name', guardianRelation:'guardian_relation', guardianPhone:'guardian_phone',
            hasKids:'has_kids', kidsCount:'kids_count', hasKidsW:'has_kids_w', kidsCountW:'kids_count_w',
            kids_under_18_count:'kids_under_18_count',
            address:'address', housingType:'housing_type', employment:'employment', profession:'profession',
            employer:'employer', breadwinner:'breadwinner', breadwinnerJob:'breadwinner_job',
            chronic:'chronic', diseases:'diseases',
            education:'education', eduType:'edu_type', eduSpecialization:'edu_specialization',
            eduUniversity:'edu_university', legal:'legal', legal_details:'legal_details',
            children_data:'children_data', children_data_w:'children_data_w',
            assoc:'assoc', assocName:'assoc_name', serviceType:'service_type', notes:'notes',
            rentAmount:'rent_amount', hasHypertension:'has_hypertension', hasDiabetes:'has_diabetes',
            otherDiseases:'other_diseases', isOfficiallyRegistered:'is_officially_registered',
            hasSpecialNeeds:'has_special_needs', specialNeedsDetails:'special_needs_details'
        };

        const sets = [];
        const vals = [];

        // Handle checkboxes explicitly for PUT
        const boolFields = ['hasHypertension', 'hasDiabetes', 'isOfficiallyRegistered', 'hasSpecialNeeds'];
        boolFields.forEach(f => {
            sets.push(`${map[f]} = ?`);
            vals.push(b[f] === 'yes' ? 1 : 0);
        });

        for (const [bk, col] of Object.entries(map)) {
            if (boolFields.includes(bk)) continue; // Already handled
            if (b[bk] !== undefined) {
                sets.push(`${col} = ?`);
                const val = (b[bk] === 0 || b[bk] === '0') ? 0 : (b[bk] || null);
                vals.push(val);
            }
        }

        if (b.kidsBox_present === 'true') {
            const { data, under18Count } = collectChildrenData(b, 'kidsBox');
            sets.push('children_data = ?', 'kids_under_18_count = ?');
            vals.push(data ? JSON.stringify(data) : null, under18Count);
        }
        if (b.legal_present === 'true') {
            sets.push('legal_details = ?');
            vals.push(b.legal === 'yes' ? collectLegalData(b) : null);
        }

        sets.push('photo_path = ?', 'document_path = ?');
        vals.push(pPath, dPath);

        if (sets.length > 0) {
            vals.push(id);
            db.prepare(`UPDATE records SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
        }
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/records/:id', authMiddleware, (req, res) => {
    db.prepare('DELETE FROM records WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.get('/api/stats', authMiddleware, (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as count FROM records').get().count;
    const enforced = db.prepare("SELECT COUNT(*) as count FROM records WHERE status = 'enforced'").get().count;
    const survivors = db.prepare("SELECT COUNT(*) as count FROM records WHERE status = 'survivor'").get().count;
    const deceased = db.prepare("SELECT COUNT(*) as count FROM records WHERE status = 'deceased'").get().count;
    res.json({ total, enforced, survivors, deceased });
});

app.get('/api/export', authMiddleware, (req, res) => {
    const records = db.prepare('SELECT * FROM records ORDER BY id DESC').all();
    res.json(records);
});

app.get('/api/export/csv', authMiddleware, (req, res) => {
    try {
        const records = db.prepare('SELECT * FROM records ORDER BY id DESC').all();
        if (records.length === 0) return res.send('');

        const headers = Object.keys(records[0]);
        let csv = '\ufeff' + headers.join(',') + '\n';

        records.forEach(r => {
            const row = headers.map(h => {
                let val = r[h];
                if (val === null || val === undefined) return '';
                val = String(val).replace(/"/g, '""');
                if (val.includes(',') || val.includes('\n') || val.includes('"')) {
                    return `"${val}"`;
                }
                return val;
            });
            csv += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=registry_export.csv');
        res.send(csv);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/backup', authMiddleware, (req, res) => {
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        const backupName = `registry_backup_${Date.now()}.db`;
        const backupPath = path.join(__dirname, backupName);
        fs.copyFileSync(DB_PATH, backupPath);
        res.download(backupPath, backupName, () => fs.unlinkSync(backupPath));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/backup/full', authMiddleware, (req, res) => {
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        const zip = new AdmZip();
        if (fs.existsSync(DB_PATH)) {
            zip.addLocalFile(DB_PATH);
        }
        if (fs.existsSync(UPLOAD_DIR)) {
            zip.addLocalFolder(UPLOAD_DIR, 'uploads');
        }
        const zipBuffer = zip.toBuffer();
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=full_backup.zip');
        res.send(zipBuffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/restore/full', authMiddleware, backupUpload.single('backup'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const uploadedFilePath = req.file.path;
    try {
        const zip = new AdmZip(uploadedFilePath);
        const tempDir = path.join(__dirname, 'temp_restore');
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
        fs.mkdirSync(tempDir);
        zip.extractAllTo(tempDir, true);

        // Check if database exists in zip
        const newDbPath = path.join(tempDir, 'registry.db');
        const newUploadsDir = path.join(tempDir, 'uploads');

        if (fs.existsSync(newDbPath)) {
            db.close();
            if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
            if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
            fs.copyFileSync(newDbPath, DB_PATH);
            // Reopen db
            db = new Database(DB_PATH);
            db.pragma('journal_mode = WAL');
            db.pragma('busy_timeout = 5000');
            initDbSchema();
        }

        if (fs.existsSync(newUploadsDir)) {
            if (fs.existsSync(UPLOAD_DIR)) fs.rmSync(UPLOAD_DIR, { recursive: true });
            fs.renameSync(newUploadsDir, UPLOAD_DIR);
        }

        fs.rmSync(tempDir, { recursive: true });
        if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
        // Clean up temp_uploads dir
        const tempUploadsDir = path.join(__dirname, 'temp_uploads');
        if (fs.existsSync(tempUploadsDir)) fs.rmSync(tempUploadsDir, { recursive: true });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        // Clean up on error
        if (fs.existsSync(uploadedFilePath)) try { fs.unlinkSync(uploadedFilePath); } catch(x) {}
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server started on port ${PORT}`));
