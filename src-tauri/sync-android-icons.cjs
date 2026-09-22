/**
 * TANKHOR (تن‌خور) - Android Resource & Configuration Synchronization Helper
 * Automatically copies high-resolution branded icons and configures Universal APK generation.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const MASTER_ICON = path.join(ROOT_DIR, 'src-tauri', 'icons', 'icon.png');
const ICONS_SRC_DIR = path.join(ROOT_DIR, 'src-tauri', 'icons', 'android');
const ANDROID_RES_DIR = path.join(ROOT_DIR, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res');
const GRADLE_KTS_FILE = path.join(ROOT_DIR, 'src-tauri', 'gen', 'android', 'app', 'build.gradle.kts');
const GRADLE_PROPERTIES_FILES = [
  path.join(ROOT_DIR, 'src-tauri', 'gen', 'android', 'gradle.properties'),
  path.join(ROOT_DIR, 'src-tauri', 'gen', 'android', 'app', 'gradle.properties')
];

function isPngValid(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  } catch {
    return false;
  }
}

function verifyAndEnsureSourceIcons() {
  let needsRegen = !fs.existsSync(ICONS_SRC_DIR);
  if (!needsRegen) {
    const testFiles = [
      path.join(ICONS_SRC_DIR, 'mipmap-mdpi', 'ic_launcher.png'),
      path.join(ICONS_SRC_DIR, 'mipmap-hdpi', 'ic_launcher.png'),
      path.join(ICONS_SRC_DIR, 'mipmap-xxxhdpi', 'ic_launcher.png')
    ];
    for (const tf of testFiles) {
      if (!fs.existsSync(tf) || !isPngValid(tf)) {
        needsRegen = true;
        break;
      }
    }
  }

  if (needsRegen) {
    console.log('[Android Sync] Source icons missing or invalid. Regenerating with @tauri-apps/cli...');
    try {
      execSync(`npx tauri icon "${MASTER_ICON}" -o "${path.join(ROOT_DIR, 'src-tauri', 'icons')}"`, {
        cwd: ROOT_DIR,
        stdio: 'inherit'
      });
      console.log('[Android Sync] Successfully regenerated valid launcher icons.');
    } catch (e) {
      console.warn('[Android Sync] Warning: icon generation command failed:', e.message);
    }
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      if (entry.name.endsWith('.png') && !isPngValid(srcPath)) {
        console.warn(`[Android Sync] Skipping invalid PNG source: ${srcPath}`);
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`[Android Sync] Copied icon: ${entry.name} -> ${path.relative(ROOT_DIR, destPath)}`);
    }
  }
}

function configureUniversalApk() {
  if (!fs.existsSync(GRADLE_KTS_FILE)) return;
  try {
    let content = fs.readFileSync(GRADLE_KTS_FILE, 'utf8');
    // Ensure splits enable universal APK if splits block is present or add splits block
    if (content.includes('splits {') && content.includes('abi {')) {
      if (!content.includes('isUniversalApk = true')) {
        content = content.replace(/abi\s*\{([^}]+)\}/, (match, p1) => {
          return `abi {\n            isUniversalApk = true${p1}\n        }`;
        });
        fs.writeFileSync(GRADLE_KTS_FILE, content, 'utf8');
        console.log('[Android Sync] Enabled isUniversalApk in build.gradle.kts');
      }
    }
  } catch (err) {
    console.warn('[Android Sync] Could not patch build.gradle.kts:', err.message);
  }
}

function configureGradleProperties() {
  for (const propFile of GRADLE_PROPERTIES_FILES) {
    const dir = path.dirname(propFile);
    if (!fs.existsSync(dir)) continue;
    try {
      let content = fs.existsSync(propFile) ? fs.readFileSync(propFile, 'utf8') : '';
      if (!content.includes('android.suppressUnsupportedCompileSdk=36')) {
        content = (content.trim() + '\nandroid.suppressUnsupportedCompileSdk=36\n').trimStart();
        fs.writeFileSync(propFile, content, 'utf8');
        console.log(`[Android Sync] Added android.suppressUnsupportedCompileSdk=36 to ${path.relative(ROOT_DIR, propFile)}`);
      }
    } catch (err) {
      console.warn('[Android Sync] Could not patch gradle.properties:', err.message);
    }
  }
}

function syncAndroidResources() {
  console.log('[Android Sync] Checking Android project structure...');
  verifyAndEnsureSourceIcons();

  if (!fs.existsSync(ICONS_SRC_DIR)) {
    console.warn('[Android Sync] Source icons directory not found:', ICONS_SRC_DIR);
  } else if (fs.existsSync(ANDROID_RES_DIR)) {
    console.log('[Android Sync] Syncing Tankhor custom icons to Android res directory...');
    copyDirRecursive(ICONS_SRC_DIR, ANDROID_RES_DIR);
    console.log('[Android Sync] Successfully synchronized all Android launcher icons!');
  }

  configureUniversalApk();
  configureGradleProperties();
}

syncAndroidResources();

