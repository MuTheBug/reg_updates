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
        { name: 'special_needs_details', type: 'TEXT' },
        { name: 'breadwinner_relation', type: 'TEXT' },
        { name: 'breadwinner_relation_other', type: 'TEXT' },
        { name: 'survivor_cv_path', type: 'TEXT' },
        { name: 'survivor_cv_text', type: 'TEXT' },
        { name: 'survivor_cv_photo_path', type: 'TEXT' },
        { name: 'source_type', type: 'TEXT' },
        { name: 'source_url', type: 'TEXT' },
        { name: 'collection_date', type: 'TEXT' },
        { name: 'collector_name', type: 'TEXT' },
        { name: 'verification_status', type: 'TEXT' },
        { name: 'methodology_notes', type: 'TEXT' },
        { name: 'cause_number', type: 'TEXT' },
        { name: 'record_slug', type: 'TEXT' }
    ];
    for (const col of columnsToAdd) {
        try { db.exec(`ALTER TABLE records ADD COLUMN ${col.name} ${col.type}`); } catch (err) {}
    }
}
initDbSchema();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subdir = 'documents';
        if (file.fieldname === 'photo') subdir = 'photos';
        else if (file.fieldname === 'survivorCvPhoto' || file.fieldname.startsWith('cvPhoto_')) subdir = 'cv_photos';
        else if (file.fieldname === 'survivorCv' || file.fieldname.startsWith('cv_')) subdir = 'cvs';
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
    limits: { fileSize: 10 * 1024 * 1024, files: 50 }
});

// Separate multer for backup restore (no size limit for large backups)
const backupUpload = multer({
    dest: path.join(__dirname, 'temp_uploads')
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

function collectChildrenData(body, prefix, filesMap, existingChildren) {
    const children = [];
    let under18Count = 0;
    const currentYear = new Date().getFullYear();
    const existing = existingChildren || [];
    for (let i = 1; i <= 20; i++) {
        const key = `cName_${prefix}_${i}`;
        if (body[key]) {
            const birthYearVal = body[`cBirthYear_${prefix}_${i}`];
            const birthYear = parseInt(birthYearVal);
            if (!isNaN(birthYear) && (currentYear - birthYear) < 18) under18Count++;
            const uid = `${prefix}_${i}`;
            const oldChild = existing[i - 1] || {};
            children.push({
                name: body[key],
                gender: body[`cGender_${uid}`] || '',
                birthYear: birthYearVal || '',
                education: body[`cEdu_${uid}`] || '',
                eduType: body[`cEduType_${uid}`] || '',
                specialization: body[`cSpec_${uid}`] || '',
                university: body[`cUniv_${uid}`] || '',
                job: body[`cJob_${uid}`] || '',
                healthStatus: body[`cHP_${uid}`] || '',
                healthDetails: body[`cHPD_${uid}`] || '',
                diseases: body[`cDiseases_${uid}`] ? JSON.parse(body[`cDiseases_${uid}`]) : [],
                cv_path: (filesMap && filesMap[`cv_${uid}`]) || oldChild.cv_path || '',
                cv_text: body[`cCvText_${uid}`] || '',
                cv_photo_path: (filesMap && filesMap[`cvPhoto_${uid}`]) || oldChild.cv_photo_path || ''
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

app.post('/api/records', upload.any(), (req, res) => {
    try {
        const b = req.body;
        const filesMap = {};
        (req.files || []).forEach(f => { filesMap[f.fieldname] = f.filename; });
        const photoPath = filesMap['photo'] || null;
        const docPath = filesMap['document'] || null;
        const { data: c1, under18Count: u1 } = collectChildrenData(b, 'kidsBox', filesMap);
        const { data: c2, under18Count: u2 } = collectChildrenData(b, 'kidsBoxW', filesMap);
        const survivorCvPath = filesMap['survivorCv'] || null;
        const survivorCvPhotoPath = filesMap['survivorCvPhoto'] || null;

        // Berkeley Protocol Generation Logic
        const causeNumber = b.causeNumber || `CASE-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
        const slugBase = `${b.firstName}-${b.lastName}`.replace(/\s+/g, '-').toLowerCase();
        const recordSlug = `${slugBase}-${Date.now().toString(36)}`;

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
                has_special_needs, special_needs_details, breadwinner_relation,
                breadwinner_relation_other,
                survivor_cv_path, survivor_cv_text, survivor_cv_photo_path,
                source_type, source_url, collection_date, collector_name, verification_status, methodology_notes, cause_number, record_slug
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?
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
            b.hasSpecialNeeds === 'yes' ? 1 : 0, b.specialNeedsDetails || null,
            b.breadwinnerRelation || null,
            b.breadwinnerRelationOther || null,
            survivorCvPath, b.survivorCvText || null, survivorCvPhotoPath,
            b.sourceType || null, b.sourceUrl || null, b.collectionDate || null, b.collectorName || null, b.verificationStatus || null, b.methodologyNotes || null, causeNumber, recordSlug
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

        // Individual name filters
        const fnFilter = req.query.firstName || '';
        const fatFilter = req.query.fatherName || '';
        const lnFilter = req.query.lastName || '';
        const mnFilter = req.query.motherName || '';
        if (fnFilter) { where += ' AND first_name LIKE ?'; params.push(`%${fnFilter}%`); }
        if (fatFilter) { where += ' AND father_name LIKE ?'; params.push(`%${fatFilter}%`); }
        if (lnFilter) { where += ' AND last_name LIKE ?'; params.push(`%${lnFilter}%`); }
        if (mnFilter) { where += ' AND mother_name LIKE ?'; params.push(`%${mnFilter}%`); }

        // General search (national ID / phone)
        if (search) {
            where += ' AND (national_id LIKE ? OR phone LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }
        if (status) { where += ' AND status = ?'; params.push(status); }
        if (province) { where += ' AND province = ?'; params.push(province); }

        // Parent status multi-select filter
        const parentStatuses = req.query.parentStatuses || '';
        if (parentStatuses) {
            const statusArr = parentStatuses.split(',').filter(s => ['enforced', 'survivor', 'deceased'].includes(s));
            if (statusArr.length > 0) {
                where += ` AND status IN (${statusArr.map(() => '?').join(',')})`;
                params.push(...statusArr);
            }
        }

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

        // Chronic diseases filter
        const chronic = req.query.chronic || '';
        if (chronic) { where += ' AND chronic = ?'; params.push(chronic); }

        // Blood type filter
        const bloodType = req.query.bloodType || '';
        if (bloodType) { where += ' AND blood_type = ?'; params.push(bloodType); }

        // Arrest year range
        const arrestYearFrom = req.query.arrestYearFrom || '';
        const arrestYearTo = req.query.arrestYearTo || '';
        if (arrestYearFrom) { where += ' AND arrest_year >= ?'; params.push(parseInt(arrestYearFrom)); }
        if (arrestYearTo) { where += ' AND arrest_year <= ?'; params.push(parseInt(arrestYearTo)); }

        // Has photo filter
        const hasPhoto = req.query.hasPhoto || '';
        if (hasPhoto === 'yes') { where += " AND photo_path IS NOT NULL AND photo_path != ''"; }
        if (hasPhoto === 'no') { where += " AND (photo_path IS NULL OR photo_path = '')"; }

        // No docs filter
        if (req.query.noDocs === 'true') {
            where += " AND (photo_path IS NULL OR photo_path = '') AND (document_path IS NULL OR document_path = '')";
        }
        if (req.query.diedInPlace) {
            where += " AND status = 'deceased' AND death_place = ?";
            params.push(req.query.diedInPlace);
        }
        if (req.query.survivedInPlace) {
            where += " AND status = 'survivor' AND arrest_place = ?";
            params.push(req.query.survivedInPlace);
        }

        // Employment filter
        const employment = req.query.employment || '';
        if (employment) { where += ' AND employment = ?'; params.push(employment); }

        // Housing type filter
        const housingType = req.query.housingType || '';
        if (housingType) { where += ' AND housing_type = ?'; params.push(housingType); }
        const addressSearch = req.query.addressSearch || '';
        if (addressSearch) {
            const terms = addressSearch.split(',').map(t => t.trim()).filter(Boolean);
            if (terms.length === 1) {
                where += ' AND address LIKE ?';
                params.push(`%${terms[0]}%`);
            } else if (terms.length > 1) {
                where += ` AND (${terms.map(() => 'address LIKE ?').join(' OR ')})`;
                terms.forEach(t => params.push(`%${t}%`));
            }
        }

        // Special needs filter
        const hasSpecialNeeds = req.query.hasSpecialNeeds || '';
        if (hasSpecialNeeds === 'yes') { where += ' AND has_special_needs = 1'; }
        if (hasSpecialNeeds === 'no') { where += ' AND (has_special_needs IS NULL OR has_special_needs = 0)'; }

        // Legal problems filter
        const legal = req.query.legal || '';
        if (legal) { where += ' AND legal = ?'; params.push(legal); }

        // Officially registered filter
        const isOfficiallyRegistered = req.query.isOfficiallyRegistered || '';
        if (isOfficiallyRegistered === 'yes') { where += ' AND is_officially_registered = 1'; }
        if (isOfficiallyRegistered === 'no') { where += ' AND (is_officially_registered IS NULL OR is_officially_registered = 0)'; }

        // Birth year range (age filter)
        const birthYearFrom = req.query.birthYearFrom || '';
        const birthYearTo = req.query.birthYearTo || '';
        if (birthYearFrom) { where += ' AND birth_year >= ?'; params.push(parseInt(birthYearFrom)); }
        if (birthYearTo) { where += ' AND birth_year <= ?'; params.push(parseInt(birthYearTo)); }

        // Release year range
        const releaseYearFrom = req.query.releaseYearFrom || '';
        const releaseYearTo = req.query.releaseYearTo || '';
        if (releaseYearFrom) { where += ' AND release_year >= ?'; params.push(parseInt(releaseYearFrom)); }
        if (releaseYearTo) { where += ' AND release_year <= ?'; params.push(parseInt(releaseYearTo)); }

        // Has kids filter
        const hasKids = req.query.hasKids || '';
        if (hasKids === 'yes') { where += " AND has_kids = 'yes'"; }
        if (hasKids === 'no') { where += " AND (has_kids = 'no' OR has_kids IS NULL)"; }

        // Association filter
        const assoc = req.query.assoc || '';
        if (assoc) { where += ' AND assoc = ?'; params.push(assoc); }

        // Arrest authority filter
        const arrestAuthority = req.query.arrestAuthority || '';
        if (arrestAuthority) { where += ' AND arrest_authority LIKE ?'; params.push(`%${arrestAuthority}%`); }

        // Arrest place filter (general, not died/survived specific)
        const arrestPlace = req.query.arrestPlace || '';
        if (arrestPlace) { where += ' AND arrest_place = ?'; params.push(arrestPlace); }

        // Has document filter
        const hasDocument = req.query.hasDocument || '';
        if (hasDocument === 'yes') { where += " AND document_path IS NOT NULL AND document_path != ''"; }
        if (hasDocument === 'no') { where += " AND (document_path IS NULL OR document_path = '')"; }

        // Hypertension filter
        const hasHypertension = req.query.hasHypertension || '';
        if (hasHypertension === 'yes') { where += ' AND has_hypertension = 1'; }

        // Diabetes filter
        const hasDiabetes = req.query.hasDiabetes || '';
        if (hasDiabetes === 'yes') { where += ' AND has_diabetes = 1'; }

        // Children birth year range filter (at least one child born in range)
        // Supports both old format (age field) and new format (birthYear field)
        const childBirthYearFrom = req.query.childBirthYearFrom || '';
        const childBirthYearTo = req.query.childBirthYearTo || '';
        let childYearCondForCount = null;
        let childYearPartsForCount = [];
        if (childBirthYearFrom || childBirthYearTo) {
            const currentYear = new Date().getFullYear();
            // COALESCE: use birthYear if present, otherwise calculate from age
            const byExpr = `COALESCE(
                NULLIF(CAST(json_extract(value, '$.birthYear') AS INTEGER), 0),
                CASE WHEN CAST(json_extract(value, '$.age') AS INTEGER) > 0
                     THEN ${currentYear} - CAST(json_extract(value, '$.age') AS INTEGER)
                     ELSE NULL END
            )`;
            let childYearCond = '';
            const yearParts = [];
            if (childBirthYearFrom && childBirthYearTo) {
                childYearCond = `${byExpr} >= ? AND ${byExpr} <= ?`;
                yearParts.push(parseInt(childBirthYearFrom), parseInt(childBirthYearTo));
            } else if (childBirthYearFrom) {
                childYearCond = `${byExpr} >= ?`;
                yearParts.push(parseInt(childBirthYearFrom));
            } else {
                childYearCond = `${byExpr} <= ?`;
                yearParts.push(parseInt(childBirthYearTo));
            }
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE ${childYearCond}))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE ${childYearCond}))
            )`;
            params.push(...yearParts, ...yearParts);
            childYearCondForCount = childYearCond;
            childYearPartsForCount = [...yearParts];
        }

        // Children health status filter
        const childHealthStatus = req.query.childHealthStatus || '';
        if (childHealthStatus) {
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE json_extract(value, '$.healthStatus') = ?))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE json_extract(value, '$.healthStatus') = ?))
            )`;
            params.push(childHealthStatus, childHealthStatus);
        }

        // Children gender filter
        const childGender = req.query.childGender || '';
        if (childGender) {
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE json_extract(value, '$.gender') = ?))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE json_extract(value, '$.gender') = ?))
            )`;
            params.push(childGender, childGender);
        }

        // Children education filter (with "and above" support)
        const childEducation = req.query.childEducation || '';
        const childEducationAbove = req.query.childEducationAbove === 'true';
        if (childEducation) {
            const eduLevels = ['أمي', 'ابتدائية', 'إعدادية', 'ثانوية', 'معهد', 'بكالوريوس', 'ماجستير', 'دكتوراه'];
            let eduValues;
            if (childEducationAbove) {
                const idx = eduLevels.indexOf(childEducation);
                eduValues = idx >= 0 ? eduLevels.slice(idx) : [childEducation];
            } else {
                eduValues = [childEducation];
            }
            const eduPlaceholders = eduValues.map(() => '?').join(',');
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE json_extract(value, '$.education') IN (${eduPlaceholders})))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE json_extract(value, '$.education') IN (${eduPlaceholders})))
            )`;
            params.push(...eduValues, ...eduValues);
        }

        const total = db.prepare(`SELECT COUNT(*) as count FROM records ${where}`).get(...params).count;
        const records = db.prepare(`SELECT * FROM records ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

        // Count matching children if birth year filter is active
        let matchingChildrenCount = null;
        if (childYearCondForCount) {
            const countSql = `SELECT COALESCE(SUM(
                CASE WHEN json_valid(children_data) THEN
                    (SELECT COUNT(*) FROM json_each(children_data) WHERE ${childYearCondForCount})
                ELSE 0 END
                +
                CASE WHEN json_valid(children_data_w) THEN
                    (SELECT COUNT(*) FROM json_each(children_data_w) WHERE ${childYearCondForCount})
                ELSE 0 END
            ), 0) as total FROM records ${where}`;
            const countParams = [...childYearPartsForCount, ...childYearPartsForCount, ...params];
            matchingChildrenCount = db.prepare(countSql).get(...countParams).total;
        }

        res.json({ records, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, matchingChildrenCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Print endpoint: returns all filtered records without pagination
app.get('/api/records-print', authMiddleware, (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const province = req.query.province || '';

        let where = 'WHERE 1=1';
        const params = [];

        // Individual name filters
        const fnFilter = req.query.firstName || '';
        const fatFilter = req.query.fatherName || '';
        const lnFilter = req.query.lastName || '';
        const mnFilter = req.query.motherName || '';
        if (fnFilter) { where += ' AND first_name LIKE ?'; params.push(`%${fnFilter}%`); }
        if (fatFilter) { where += ' AND father_name LIKE ?'; params.push(`%${fatFilter}%`); }
        if (lnFilter) { where += ' AND last_name LIKE ?'; params.push(`%${lnFilter}%`); }
        if (mnFilter) { where += ' AND mother_name LIKE ?'; params.push(`%${mnFilter}%`); }

        // General search (national ID / phone)
        if (search) {
            where += ' AND (national_id LIKE ? OR phone LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }
        if (status) { where += ' AND status = ?'; params.push(status); }
        if (province) { where += ' AND province = ?'; params.push(province); }

        // Parent status multi-select filter
        const parentStatuses = req.query.parentStatuses || '';
        if (parentStatuses) {
            const statusArr = parentStatuses.split(',').filter(s => ['enforced', 'survivor', 'deceased'].includes(s));
            if (statusArr.length > 0) {
                where += ` AND status IN (${statusArr.map(() => '?').join(',')})`;
                params.push(...statusArr);
            }
        }

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

        const chronic = req.query.chronic || '';
        if (chronic) { where += ' AND chronic = ?'; params.push(chronic); }
        const bloodType = req.query.bloodType || '';
        if (bloodType) { where += ' AND blood_type = ?'; params.push(bloodType); }
        const arrestYearFrom = req.query.arrestYearFrom || '';
        const arrestYearTo = req.query.arrestYearTo || '';
        if (arrestYearFrom) { where += ' AND arrest_year >= ?'; params.push(parseInt(arrestYearFrom)); }
        if (arrestYearTo) { where += ' AND arrest_year <= ?'; params.push(parseInt(arrestYearTo)); }
        const hasPhoto = req.query.hasPhoto || '';
        if (hasPhoto === 'yes') { where += " AND photo_path IS NOT NULL AND photo_path != ''"; }
        if (hasPhoto === 'no') { where += " AND (photo_path IS NULL OR photo_path = '')"; }
        if (req.query.noDocs === 'true') {
            where += " AND (photo_path IS NULL OR photo_path = '') AND (document_path IS NULL OR document_path = '')";
        }
        if (req.query.diedInPlace) { where += " AND status = 'deceased' AND death_place = ?"; params.push(req.query.diedInPlace); }
        if (req.query.survivedInPlace) { where += " AND status = 'survivor' AND arrest_place = ?"; params.push(req.query.survivedInPlace); }
        const employment = req.query.employment || '';
        if (employment) { where += ' AND employment = ?'; params.push(employment); }
        const housingType = req.query.housingType || '';
        if (housingType) { where += ' AND housing_type = ?'; params.push(housingType); }
        const addressSearch = req.query.addressSearch || '';
        if (addressSearch) {
            const terms = addressSearch.split(',').map(t => t.trim()).filter(Boolean);
            if (terms.length === 1) {
                where += ' AND address LIKE ?';
                params.push(`%${terms[0]}%`);
            } else if (terms.length > 1) {
                where += ` AND (${terms.map(() => 'address LIKE ?').join(' OR ')})`;
                terms.forEach(t => params.push(`%${t}%`));
            }
        }
        const hasSpecialNeeds = req.query.hasSpecialNeeds || '';
        if (hasSpecialNeeds === 'yes') { where += ' AND has_special_needs = 1'; }
        if (hasSpecialNeeds === 'no') { where += ' AND (has_special_needs IS NULL OR has_special_needs = 0)'; }
        const legal = req.query.legal || '';
        if (legal) { where += ' AND legal = ?'; params.push(legal); }
        const isOfficiallyRegistered = req.query.isOfficiallyRegistered || '';
        if (isOfficiallyRegistered === 'yes') { where += ' AND is_officially_registered = 1'; }
        if (isOfficiallyRegistered === 'no') { where += ' AND (is_officially_registered IS NULL OR is_officially_registered = 0)'; }
        const birthYearFrom = req.query.birthYearFrom || '';
        const birthYearTo = req.query.birthYearTo || '';
        if (birthYearFrom) { where += ' AND birth_year >= ?'; params.push(parseInt(birthYearFrom)); }
        if (birthYearTo) { where += ' AND birth_year <= ?'; params.push(parseInt(birthYearTo)); }
        const releaseYearFrom = req.query.releaseYearFrom || '';
        const releaseYearTo = req.query.releaseYearTo || '';
        if (releaseYearFrom) { where += ' AND release_year >= ?'; params.push(parseInt(releaseYearFrom)); }
        if (releaseYearTo) { where += ' AND release_year <= ?'; params.push(parseInt(releaseYearTo)); }
        const hasKids = req.query.hasKids || '';
        if (hasKids === 'yes') { where += " AND has_kids = 'yes'"; }
        if (hasKids === 'no') { where += " AND (has_kids = 'no' OR has_kids IS NULL)"; }
        const assoc = req.query.assoc || '';
        if (assoc) { where += ' AND assoc = ?'; params.push(assoc); }
        const arrestAuthority = req.query.arrestAuthority || '';
        if (arrestAuthority) { where += ' AND arrest_authority LIKE ?'; params.push(`%${arrestAuthority}%`); }
        const arrestPlace = req.query.arrestPlace || '';
        if (arrestPlace) { where += ' AND arrest_place = ?'; params.push(arrestPlace); }
        const hasDocument = req.query.hasDocument || '';
        if (hasDocument === 'yes') { where += " AND document_path IS NOT NULL AND document_path != ''"; }
        if (hasDocument === 'no') { where += " AND (document_path IS NULL OR document_path = '')"; }
        const hasHypertension = req.query.hasHypertension || '';
        if (hasHypertension === 'yes') { where += ' AND has_hypertension = 1'; }
        const hasDiabetes = req.query.hasDiabetes || '';
        if (hasDiabetes === 'yes') { where += ' AND has_diabetes = 1'; }

        // Children birth year range filter (at least one child born in range)
        // Supports both old format (age field) and new format (birthYear field)
        const childBirthYearFrom = req.query.childBirthYearFrom || '';
        const childBirthYearTo = req.query.childBirthYearTo || '';
        if (childBirthYearFrom || childBirthYearTo) {
            const currentYear = new Date().getFullYear();
            const byExpr = `COALESCE(
                NULLIF(CAST(json_extract(value, '$.birthYear') AS INTEGER), 0),
                CASE WHEN CAST(json_extract(value, '$.age') AS INTEGER) > 0
                     THEN ${currentYear} - CAST(json_extract(value, '$.age') AS INTEGER)
                     ELSE NULL END
            )`;
            let childYearCond = '';
            const yearParts = [];
            if (childBirthYearFrom && childBirthYearTo) {
                childYearCond = `${byExpr} >= ? AND ${byExpr} <= ?`;
                yearParts.push(parseInt(childBirthYearFrom), parseInt(childBirthYearTo));
            } else if (childBirthYearFrom) {
                childYearCond = `${byExpr} >= ?`;
                yearParts.push(parseInt(childBirthYearFrom));
            } else {
                childYearCond = `${byExpr} <= ?`;
                yearParts.push(parseInt(childBirthYearTo));
            }
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE ${childYearCond}))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE ${childYearCond}))
            )`;
            params.push(...yearParts, ...yearParts);
        }

        // Children health status filter
        const childHealthStatus = req.query.childHealthStatus || '';
        if (childHealthStatus) {
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE json_extract(value, '$.healthStatus') = ?))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE json_extract(value, '$.healthStatus') = ?))
            )`;
            params.push(childHealthStatus, childHealthStatus);
        }

        // Children gender filter
        const childGender = req.query.childGender || '';
        if (childGender) {
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE json_extract(value, '$.gender') = ?))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE json_extract(value, '$.gender') = ?))
            )`;
            params.push(childGender, childGender);
        }

        // Children education filter (with "and above" support)
        const childEducation = req.query.childEducation || '';
        const childEducationAbove = req.query.childEducationAbove === 'true';
        if (childEducation) {
            const eduLevels = ['أمي', 'ابتدائية', 'إعدادية', 'ثانوية', 'معهد', 'بكالوريوس', 'ماجستير', 'دكتوراه'];
            let eduValues;
            if (childEducationAbove) {
                const idx = eduLevels.indexOf(childEducation);
                eduValues = idx >= 0 ? eduLevels.slice(idx) : [childEducation];
            } else {
                eduValues = [childEducation];
            }
            const eduPlaceholders = eduValues.map(() => '?').join(',');
            where += ` AND (
                (json_valid(children_data) AND EXISTS (SELECT 1 FROM json_each(children_data) WHERE json_extract(value, '$.education') IN (${eduPlaceholders})))
                OR (json_valid(children_data_w) AND EXISTS (SELECT 1 FROM json_each(children_data_w) WHERE json_extract(value, '$.education') IN (${eduPlaceholders})))
            )`;
            params.push(...eduValues, ...eduValues);
        }

        const records = db.prepare(`SELECT * FROM records ${where} ORDER BY id DESC`).all(...params);
        res.json({ records, total: records.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/records/:id', authMiddleware, (req, res) => {
    const r = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
});

app.put('/api/records/:id', authMiddleware, upload.any(), (req, res) => {
    try {
        const b = req.body;
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
        if (!old) return res.status(404).json({ error: 'Not found' });

        const filesMap = {};
        (req.files || []).forEach(f => { filesMap[f.fieldname] = f.filename; });

        let pPath = old.photo_path;
        if (b.deletePhoto === 'yes') {
            if (old.photo_path) {
                const photoFile = path.join(UPLOAD_DIR, 'photos', old.photo_path);
                try { fs.unlinkSync(photoFile); } catch(e) {}
            }
            pPath = null;
        } else if (filesMap['photo']) {
            pPath = filesMap['photo'];
        }
        let dPath = old.document_path;
        if (b.deleteDocument === 'yes') {
            if (old.document_path) {
                const docFile = path.join(UPLOAD_DIR, 'documents', old.document_path);
                try { fs.unlinkSync(docFile); } catch(e) {}
            }
            dPath = null;
        } else if (filesMap['document']) {
            dPath = filesMap['document'];
        }

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
            hasSpecialNeeds:'has_special_needs', specialNeedsDetails:'special_needs_details',
            breadwinnerRelation:'breadwinner_relation',
            breadwinnerRelationOther:'breadwinner_relation_other',
            survivorCvText:'survivor_cv_text',
            sourceType:'source_type', sourceUrl:'source_url', collectionDate:'collection_date',
            collectorName:'collector_name', verificationStatus:'verification_status',
            methodologyNotes:'methodology_notes', causeNumber:'cause_number', recordSlug:'record_slug'
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
            let existingC1 = [];
            try { existingC1 = JSON.parse(old.children_data || '[]'); } catch(e) {}
            const { data, under18Count: u1 } = collectChildrenData(b, 'kidsBox', filesMap, existingC1);
            const u2existing = b.kidsBoxW_present === 'true' ? 0 : (() => {
                try { const cw = JSON.parse(old.children_data_w || '[]'); const cy = new Date().getFullYear(); return cw.filter(c => { const by = parseInt(c.birthYear); return !isNaN(by) && (cy - by) < 18; }).length; } catch(e) { return 0; }
            })();
            sets.push('children_data = ?', 'kids_under_18_count = ?');
            vals.push(data ? JSON.stringify(data) : null, u1 + u2existing);
        }
        if (b.kidsBoxW_present === 'true') {
            let existingC2 = [];
            try { existingC2 = JSON.parse(old.children_data_w || '[]'); } catch(e) {}
            const { data, under18Count: u2 } = collectChildrenData(b, 'kidsBoxW', filesMap, existingC2);
            const u1existing = b.kidsBox_present === 'true' ? 0 : (() => {
                try { const c1 = JSON.parse(old.children_data || '[]'); const cy = new Date().getFullYear(); return c1.filter(c => { const by = parseInt(c.birthYear); return !isNaN(by) && (cy - by) < 18; }).length; } catch(e) { return 0; }
            })();
            sets.push('children_data_w = ?');
            vals.push(data ? JSON.stringify(data) : null);
            if (b.kidsBox_present !== 'true') {
                sets.push('kids_under_18_count = ?');
                vals.push(u1existing + u2);
            }
        }
        if (b.legal_present === 'true') {
            sets.push('legal_details = ?');
            vals.push(b.legal === 'yes' ? collectLegalData(b) : null);
        }

        // Survivor CV file handling
        let sCvPath = old.survivor_cv_path;
        if (b.deleteSurvivorCv === 'yes') {
            if (old.survivor_cv_path) {
                try { fs.unlinkSync(path.join(UPLOAD_DIR, 'cvs', old.survivor_cv_path)); } catch(e) {}
            }
            sCvPath = null;
        } else if (filesMap['survivorCv']) {
            sCvPath = filesMap['survivorCv'];
        }
        let sCvPhotoPath = old.survivor_cv_photo_path;
        if (b.deleteSurvivorCvPhoto === 'yes') {
            if (old.survivor_cv_photo_path) {
                try { fs.unlinkSync(path.join(UPLOAD_DIR, 'cv_photos', old.survivor_cv_photo_path)); } catch(e) {}
            }
            sCvPhotoPath = null;
        } else if (filesMap['survivorCvPhoto']) {
            sCvPhotoPath = filesMap['survivorCvPhoto'];
        }
        sets.push('survivor_cv_path = ?', 'survivor_cv_photo_path = ?');
        vals.push(sCvPath, sCvPhotoPath);

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
        const tempZipPath = path.join(__dirname, `backup_temp_${Date.now()}.zip`);
        zip.writeZip(tempZipPath);
        const stat = fs.statSync(tempZipPath);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', 'attachment; filename=full_backup.zip');
        const stream = fs.createReadStream(tempZipPath);
        stream.pipe(res);
        stream.on('end', () => { try { fs.unlinkSync(tempZipPath); } catch(x) {} });
        stream.on('error', (err) => {
            try { fs.unlinkSync(tempZipPath); } catch(x) {}
            if (!res.headersSent) res.status(500).json({ error: err.message });
        });
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
