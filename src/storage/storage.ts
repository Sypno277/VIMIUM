// Compatibility re-export. The settings store was split into the `storage/`
// layer (settings-store / migrations / quota / broadcast); this module keeps
// the historical import path working for any consumer that still uses it.
export { SettingsStore, settingsStore, type QuotaInfo } from "./settings-store";
export { SETTINGS_VERSION } from "../settings/settings";
