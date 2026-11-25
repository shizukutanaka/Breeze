'use strict';
/**
 * Breeze Desktop — Auto-update state machine and downgrade/verification guard.
 *
 * Extracted as a dependency-free module (like nav-guard.js / csp-guard.js) so
 * the full update lifecycle can be unit-tested without Electron.
 *
 * Security invariants:
 *   1. autoDownload = false, autoInstallOnAppQuit = false, allowDowngrade = false.
 *   2. Candidate version must be a valid semver strictly greater than currentVersion
 *      on BOTH update-available and update-downloaded (no downgrade, no swap).
 *   3. downloadUpdate() must be explicitly triggered before installUpdate().
 *   4. installUpdate() refuses to call quitAndInstall() unless update-downloaded
 *      succeeded for the verified candidate version.
 *   5. Any updater/verification/hash/signature error clears verified state and
 *      surfaces to the renderer (fail-secure, never silent).
 */

function parseSemver(v) {
  if (typeof v !== 'string') return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || null,
  };
}

function isStrictlyNewerVersion(candidate, current) {
  const c = parseSemver(candidate);
  const cur = parseSemver(current);
  if (!c || !cur) return false;
  // Never auto-upgrade a stable release onto a prerelease of the same or lower tuple.
  if (c.major !== cur.major) return c.major > cur.major;
  if (c.minor !== cur.minor) return c.minor > cur.minor;
  if (c.patch !== cur.patch) return c.patch > cur.patch;
  // Same major.minor.patch: only newer if current was prerelease and candidate is stable.
  return Boolean(cur.prerelease && !c.prerelease);
}

function classifyError(err) {
  const raw = String(err?.message || err || '');
  const lower = raw.toLowerCase();
  if (lower.includes('sha512') || lower.includes('checksum') || lower.includes('digest') || lower.includes('hash')) {
    return 'CHECKSUM_FAILED';
  }
  if (lower.includes('sign') || lower.includes('certificate') || lower.includes('publisher') || lower.includes('code signature')) {
    return 'SIGNATURE_FAILED';
  }
  return 'UPDATE_FAILED';
}

function createUpdateController({ autoUpdater, currentVersion, onAvailable, onDownloaded, onError, onQuit }) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;

  let state = 'idle'; // 'idle' | 'available' | 'downloading' | 'downloaded' | 'error'
  let availableVersion = null;
  let verifiedVersion = null;

  const fail = (code) => {
    state = 'error';
    availableVersion = null;
    verifiedVersion = null;
    if (onError) onError({ code });
  };

  autoUpdater.on('update-available', (info) => {
    const version = typeof info?.version === 'string' ? info.version.trim() : '';
    if (!isStrictlyNewerVersion(version, currentVersion)) {
      fail('DOWNGRADE_REJECTED');
      return;
    }
    state = 'available';
    availableVersion = version;
    verifiedVersion = null;
    if (onAvailable) onAvailable({ version });
  });

  autoUpdater.on('update-downloaded', (info) => {
    const version = typeof info?.version === 'string' ? info.version.trim() : '';
    if (!isStrictlyNewerVersion(version, currentVersion) || (availableVersion && version !== availableVersion)) {
      fail('VERSION_MISMATCH');
      return;
    }
    state = 'downloaded';
    verifiedVersion = version;
    if (onDownloaded) onDownloaded({ version });
  });

  autoUpdater.on('error', (err) => {
    fail(classifyError(err));
  });

  return {
    getState: () => ({ state, availableVersion, verifiedVersion }),

    checkForUpdates() {
      return Promise.resolve(autoUpdater.checkForUpdates()).catch((err) => {
        fail(classifyError(err));
      });
    },

    downloadUpdate() {
      if (state !== 'available' || !availableVersion) {
        return Promise.resolve(false);
      }
      state = 'downloading';
      return Promise.resolve(autoUpdater.downloadUpdate()).then(
        () => true,
        (err) => {
          fail(classifyError(err));
          return false;
        }
      );
    },

    installUpdate() {
      if (state !== 'downloaded' || !verifiedVersion) {
        fail('NOT_DOWNLOADED');
        return false;
      }
      if (onQuit) onQuit();
      autoUpdater.quitAndInstall();
      return true;
    },
  };
}

module.exports = { parseSemver, isStrictlyNewerVersion, classifyError, createUpdateController };
