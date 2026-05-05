import { useEffect, useState } from "react";
import BackButton from "../components/BackButton";
import {
  getSoundSettings,
  saveSoundSettings,
  playSound,
} from "../utils/notificationSound";
import "./NotificationSettings.css";

const toPercent = (value) => Math.round((value || 0) * 100);

export default function NotificationSettings() {
  const [settings, setSettings] = useState(getSoundSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getSoundSettings());
  }, []);

  const updateSettings = (next) => {
    const updated = saveSoundSettings(next);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="notif-settings-page">
      <BackButton />
      <div className="notif-settings-card">
        <h2>Notification Sound Settings</h2>
        <p>Control ringtone volume and mute behavior.</p>

        <label className="setting-row checkbox-row">
          <span>Mute all sounds</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => updateSettings({ muted: e.target.checked })}
          />
        </label>

        <label className="setting-row">
          <span>Master Volume: {toPercent(settings.masterVolume)}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={toPercent(settings.masterVolume)}
            onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) / 100 })}
          />
        </label>

        <label className="setting-row">
          <span>Message Volume: {toPercent(settings.messageVolume)}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={toPercent(settings.messageVolume)}
            onChange={(e) => updateSettings({ messageVolume: Number(e.target.value) / 100 })}
          />
        </label>

        <label className="setting-row">
          <span>Call Volume: {toPercent(settings.callVolume)}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={toPercent(settings.callVolume)}
            onChange={(e) => updateSettings({ callVolume: Number(e.target.value) / 100 })}
          />
        </label>

        <label className="setting-row">
          <span>Notification Volume: {toPercent(settings.notificationVolume)}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={toPercent(settings.notificationVolume)}
            onChange={(e) => updateSettings({ notificationVolume: Number(e.target.value) / 100 })}
          />
        </label>

        <div className="preview-actions">
          <button type="button" onClick={() => playSound("message")}>Test Message</button>
          <button type="button" onClick={() => playSound("notification")}>Test Notification</button>
        </div>

        {saved && <div className="saved-chip">Saved</div>}
      </div>
    </div>
  );
}
