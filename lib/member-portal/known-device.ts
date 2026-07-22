/** Client hint for returning members on a known device (never sole source of truth). */

export type KnownDeviceProfile = {
  deviceId: string;
  mobile: string;
  hasPin: boolean;
  savedAt: number;
};

function key(deviceId: string) {
  return `apg_portal_known_device_v1_${String(deviceId || "").trim()}`;
}

export function readKnownDeviceProfile(deviceId: string): KnownDeviceProfile | null {
  if (typeof window === "undefined" || !deviceId) return null;
  try {
    const raw = localStorage.getItem(key(deviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KnownDeviceProfile;
    if (!parsed?.mobile || parsed.deviceId !== deviceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeKnownDeviceProfile(profile: KnownDeviceProfile) {
  if (typeof window === "undefined" || !profile.deviceId || !profile.mobile) return;
  try {
    localStorage.setItem(
      key(profile.deviceId),
      JSON.stringify({ ...profile, savedAt: Date.now() }),
    );
  } catch {
    /* quota */
  }
}

export function clearKnownDeviceProfile(deviceId: string) {
  if (typeof window === "undefined" || !deviceId) return;
  try {
    localStorage.removeItem(key(deviceId));
  } catch {
    /* ignore */
  }
}
