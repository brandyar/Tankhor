/**
 * TANKHOR (تن‌خور) - Android Resource & Configuration Synchronization Helper
 * Automatically copies high-resolution branded icons and configures Universal APK generation.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ICONS_SRC_DIR = path.join(ROOT_DIR, 'src-tauri', 'icons', 'android');
const ANDROID_RES_DIR = path.join(ROOT_DIR, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res');
const GRADLE_KTS_FILE = path.join(ROOT_DIR, 'src-tauri', 'gen', 'android', 'app', 'build.gradle.kts');

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

function syncAndroidResources() {
  console.log('[Android Sync] Checking Android project structure...');
  if (!fs.existsSync(ICONS_SRC_DIR)) {
    console.warn('[Android Sync] Source icons directory not found:', ICONS_SRC_DIR);
  } else if (fs.existsSync(ANDROID_RES_DIR)) {
    console.log('[Android Sync] Syncing Tankhor custom icons to Android res directory...');
    copyDirRecursive(ICONS_SRC_DIR, ANDROID_RES_DIR);
    console.log('[Android Sync] Successfully synchronized all Android launcher icons!');
  }

  configureUniversalApk();
}

syncAndroidResources();

