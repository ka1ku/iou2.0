const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'utils/locales');
const enPath = path.join(localesDir, 'en.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');

const missingKeys = {};

function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

const enKeys = getKeys(en);

files.forEach(file => {
    const lang = file.replace('.json', '');
    const content = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
    const langKeys = getKeys(content);



    const missing = [];
    const untranslated = [];

    enKeys.forEach(key => {
        if (!langKeys.includes(key)) {
            missing.push(key);
        } else {
            // Check value
            const enValue = getValue(en, key);
            const langValue = getValue(content, key);
            if (enValue === langValue && typeof enValue === 'string' && enValue.trim() !== '') {
                untranslated.push(key);
            }
        }
    });

    if (missing.length > 0) {
        missingKeys[lang] = { missing };
    }
    if (untranslated.length > 0) {
        if (!missingKeys[lang]) missingKeys[lang] = {};
        missingKeys[lang].untranslated = untranslated;
    }
});

function getValue(obj, key) {
    return key.split('.').reduce((o, i) => o[i], obj);
}

console.log(JSON.stringify(missingKeys, null, 2));
