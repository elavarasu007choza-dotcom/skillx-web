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
  const [soundSettings, setSoundSettings] = useState(getSoundSettings());
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem("notificationSettings");
    return saved ? JSON.parse(saved) : {
      inApp: true,
      email: true,
      push: true,
      messages: true,
      calls: true,
      requests: true,
      ratings: true,
      sessions: true,
      dnd: false,
      dndStart: "22:00",
      dndEnd: "08:00",
    };
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSoundSettings(getSoundSettings());
  }, []);

  const updateSoundSettings = (next) => {
    const updated = saveSoundSettings(next);
    setSoundSettings(updated);
    showSaved();
  };

  const updateNotificationSettings = (next) => {
    const updated = { ...notificationSettings, ...next };
    setNotificationSettings(updated);
    localStorage.setItem("notificationSettings", JSON.stringify(updated));
    showSaved();
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="notif-settings-page">
      <BackButton />
      
      <div className="notif-settings-container">
        <div className="notif-header">
          <h1>🔔 Notification Settings</h1>
          <p>Manage how and when you receive notifications</p>
        </div>

        {/* Notification Types Section */}
        <div className="notif-settings-section">
          <h3 className="section-title">📢 Notification Types</h3>
          <div className="settings-grid">
            <label className="setting-toggle">
              <div className="toggle-header">
                <span>💬 Messages</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.messages}
                  onChange={(e) => updateNotificationSettings({ messages: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>Notifications for new messages</p>
            </label>

            <label className="setting-toggle">
              <div className="toggle-header">
                <span>📞 Calls</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.calls}
                  onChange={(e) => updateNotificationSettings({ calls: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>Incoming call notifications</p>
            </label>

            <label className="setting-toggle">
              <div className="toggle-header">
                <span>🎯 Requests</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.requests}
                  onChange={(e) => updateNotificationSettings({ requests: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>Skill exchange requests</p>
            </label>

            <label className="setting-toggle">
              <div className="toggle-header">
                <span>⭐ Ratings</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.ratings}
                  onChange={(e) => updateNotificationSettings({ ratings: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>When you receive ratings</p>
            </label>

            <label className="setting-toggle">
              <div className="toggle-header">
                <span>📅 Sessions</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.sessions}
                  onChange={(e) => updateNotificationSettings({ sessions: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>Session reminders & updates</p>
            </label>
          </div>
        </div>

        {/* Notification Channels Section */}
        <div className="notif-settings-section">
          <h3 className="section-title">📧 Notification Channels</h3>
          <div className="settings-list">
            <label className="setting-toggle">
              <div className="toggle-header">
                <span>🔔 In-App Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.inApp}
                  onChange={(e) => updateNotificationSettings({ inApp: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>Show notifications inside the app</p>
            </label>

            <label className="setting-toggle">
              <div className="toggle-header">
                <span>✉️ Email Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.email}
                  onChange={(e) => updateNotificationSettings({ email: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>Send important updates to your email</p>
            </label>

            <label className="setting-toggle">
              <div className="toggle-header">
                <span>📱 Push Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.push}
                  onChange={(e) => updateNotificationSettings({ push: e.target.checked })}
                />
                <span className="toggle-switch"></span>
              </div>
              <p>Browser push notifications</p>
            </label>
          </div>
        </div>

        {/* Do Not Disturb Section */}
        <div className="notif-settings-section">
          <h3 className="section-title">😴 Do Not Disturb</h3>
          <label className="setting-toggle">
            <div className="toggle-header">
              <span>Enable Do Not Disturb</span>
              <input
                type="checkbox"
                checked={notificationSettings.dnd}
                onChange={(e) => updateNotificationSettings({ dnd: e.target.checked })}
              />
              <span className="toggle-switch"></span>
            </div>
            <p>Mute notifications during selected hours</p>
          </label>

          {notificationSettings.dnd && (
            <div className="dnd-times">
              <div className="time-input-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={notificationSettings.dndStart}
                  onChange={(e) => updateNotificationSettings({ dndStart: e.target.value })}
                />
              </div>
              <div className="time-input-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={notificationSettings.dndEnd}
                  onChange={(e) => updateNotificationSettings({ dndEnd: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sound Settings Section */}
        <div className="notif-settings-section">
          <h3 className="section-title">🔊 Sound Settings</h3>
          
          <label className="setting-toggle">
            <div className="toggle-header">
              <span>Mute All Sounds</span>
              <input
                type="checkbox"
                checked={soundSettings.muted}
                onChange={(e) => updateSoundSettings({ muted: e.target.checked })}
              />
              <span className="toggle-switch"></span>
            </div>
          </label>

          {!soundSettings.muted && (
            <div className="volume-controls">
              <div className="volume-group">
                <label>
                  <span>🔉 Master Volume: {toPercent(soundSettings.masterVolume)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={toPercent(soundSettings.masterVolume)}
                    onChange={(e) => updateSoundSettings({ masterVolume: Number(e.target.value) / 100 })}
                  />
                </label>
              </div>

              <div className="volume-group">
                <label>
                  <span>💬 Message Volume: {toPercent(soundSettings.messageVolume)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={toPercent(soundSettings.messageVolume)}
                    onChange={(e) => updateSoundSettings({ messageVolume: Number(e.target.value) / 100 })}
                  />
                </label>
              </div>

              <div className="volume-group">
                <label>
                  <span>📞 Call Volume: {toPercent(soundSettings.callVolume)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={toPercent(soundSettings.callVolume)}
                    onChange={(e) => updateSoundSettings({ callVolume: Number(e.target.value) / 100 })}
                  />
                </label>
              </div>

              <div className="volume-group">
                <label>
                  <span>🔔 Notification Volume: {toPercent(soundSettings.notificationVolume)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={toPercent(soundSettings.notificationVolume)}
                    onChange={(e) => updateSoundSettings({ notificationVolume: Number(e.target.value) / 100 })}
                  />
                </label>
              </div>

              <div className="preview-actions">
                <button type="button" onClick={() => playSound("message")}>🎵 Test Message Sound</button>
                <button type="button" onClick={() => playSound("notification")}>🎵 Test Notification Sound</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {saved && <div className="saved-chip">✓ Settings saved successfully</div>}
    </div>
  );
}
