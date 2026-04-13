// Notification sound utility
// Creates and manages audio notifications

let messageSound = null;
let callSound = null;
let notificationSound = null;

// Initialize sounds (call once on app load)
export const initNotificationSounds = () => {
  // Message received sound
  messageSound = new Audio('/sounds/message.mp3');
  messageSound.volume = 0.5;
  
  // Call incoming sound
  callSound = new Audio('/sounds/call.mp3');
  callSound.volume = 0.5;
  callSound.loop = true; // Loop for calls
  
  // General notification sound
  notificationSound = new Audio('/sounds/notification.mp3');
  notificationSound.volume = 0.5;
};

// Play message received sound
export const playMessageSound = () => {
  if (messageSound) {
    messageSound.currentTime = 0;
    messageSound.play().catch(() => {
      // Auto-play policy might block this
      console.log('Audio play blocked by browser');
    });
  }
};

// Play call incoming sound (loops)
export const playCallSound = () => {
  if (callSound) {
    callSound.currentTime = 0;
    callSound.play().catch(() => {
      console.log('Audio play blocked by browser');
    });
  }
};

// Stop call sound
export const stopCallSound = () => {
  if (callSound) {
    callSound.pause();
    callSound.currentTime = 0;
  }
};

// Play general notification sound
export const playNotificationSound = () => {
  if (notificationSound) {
    notificationSound.currentTime = 0;
    notificationSound.play().catch(() => {
      console.log('Audio play blocked by browser');
    });
  }
};

// Play sound based on type
export const playSound = (type) => {
  switch (type) {
    case 'message':
      playMessageSound();
      break;
    case 'call':
      playCallSound();
      break;
    case 'notification':
      playNotificationSound();
      break;
    default:
      playNotificationSound();
  }
};
