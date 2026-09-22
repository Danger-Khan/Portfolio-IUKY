// =====================================================================
// FILE: Master.ino (Complete Central Execution Engine)
// =====================================================================
#include <SPI.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>
#include "config.h"

// Include All Component Tabs
#include "page_settings.h"
#include "page_clock.h"
#include "page_env.h"
#include "page_weather.h"
#include "page_storage.h"
#include "page_network.h"

// --- Global Variable Instantiation ---
TFT_eSPI tft = TFT_eSPI();
SPIClass touchscreenSPI = SPIClass(VSPI);
XPT2046_Touchscreen touchscreen(XPT2046_CS, XPT2046_IRQ);

int currentTab = 0;       
bool isNightMode = true;
// Shared Hardware Pipeline Status State Hooks
float globalTempReading = 29.8; // Set to NaN if sensor fails to test diagnostic alerts
String networkSSID       = "Khan_CYD";
String networkBT         = "Khan_CYD";
bool   isWifiActive      = false;
bool   isBtActive        = false;
// Background Scheduler Performance Track Timers
unsigned long lastMetricUpdate = 0;
unsigned long lastTouchTime = 0;
unsigned long lastClockUpdate = 0;
unsigned long lastSensorRead   = 0;
unsigned long lastWeatherFetch = 0;
unsigned long lastStorageScan   = 0;

// Forward Declarations
void drawSidebar();
void drawBaseUI();
void drawMainContent();
void setHardwareRGB(bool r, bool g, bool b);
void showBootSequence();
void handleTabSpecificTouch(int x, int y);

// =====================================================================
// 🚀 HARDWARE SETUP
// =====================================================================
void setup() {
  Serial.begin(115200);

  // Initialize Common-Anode Display Backlight Control and Diagnostic RGB Output Pins
  pinMode(backlight, OUTPUT);
  digitalWrite(backlight, HIGH);
  // 1. Initialize Onboard RGB Pins as Outputs
  pinMode(RGB_RED_PIN, OUTPUT);
  pinMode(RGB_GREEN_PIN, OUTPUT);
  pinMode(RGB_BLUE_PIN, OUTPUT);
  // Speaker Output Line Definition
  pinMode(Speaker, OUTPUT);
  digitalWrite(Speaker, LOW); // Pull low to prevent standard continuous popping sounds
  // Set initial status color indicator
  setHardwareRGB(false, false, true); // Active Blue light up on boot
  // 3. Initialize Display Panel Hardware
  tft.init();
  tft.setRotation(1);
  // Execute Cinematic Loading Screen
  showBootSequence();
  // 2. Initialize Touch Panel Hardware Bus
  touchscreenSPI.begin(XPT2046_CLK, XPT2046_MISO, XPT2046_MOSI, XPT2046_CS);
  touchscreen.begin(touchscreenSPI);
  touchscreen.setRotation(1);
  // 4. Initial Screen Render
  drawBaseUI();
  drawMainContent();
}
// =====================================================================
// 🎬 CINEMATIC BOOT SEQUENCE
// =====================================================================
void showBootSequence() {
  tft.fillScreen(COLOR_NIGHT_BG); 
  setHardwareRGB(true, false, false); 
  
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString("SYSTEM KERNEL", 160, 70, 4);
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.drawCentreString("By Danger Khan", 160, 100, 2);
  tft.drawRoundRect(40, 140, 240, 16, 4, COLOR_LABEL_GREY);

// Draw Empty Progress Bar Frame
  tft.drawRoundRect(40, 140, 240, 16, 4, COLOR_LABEL_GREY);

  // Boot Steps Array for dynamic text updates
  const char* bootSteps[] = {
    "Mounting FAT32 File System...",
    "Initializing DHT11 Sensor Bus...",
    "Configuring UART Transceiver...",
    "Starting Graphical UI Engine..."
  };

  // Simulate Hardware Loading Pipeline
  for (int i = 0; i <= 100; i++) {
    // Fill progress bar math
    int loadWidth = map(i, 0, 100, 0, 236);
    tft.fillRoundRect(42, 142, loadWidth, 12, 3, COLOR_INFO_BLUE);

    // Shift LED to Cyan halfway through
    if (i == 50) setHardwareRGB(false, true, true); 

    // Update textual feedback based on progress percentage
    if (i == 10) {
      tft.fillRect(30, 170, 260, 20, COLOR_NIGHT_BG);
      tft.setTextColor(COLOR_LABEL_GREY);
      tft.drawCentreString(bootSteps[0], 160, 170, 1);
    } else if (i == 40) {
      tft.fillRect(30, 170, 260, 20, COLOR_NIGHT_BG);
      tft.drawCentreString(bootSteps[1], 160, 170, 1);
    } else if (i == 70) {
      tft.fillRect(30, 170, 260, 20, COLOR_NIGHT_BG);
      tft.drawCentreString(bootSteps[2], 160, 170, 1);
    } else if (i == 90) {
      tft.fillRect(30, 170, 260, 20, COLOR_NIGHT_BG);
      tft.setTextColor(COLOR_AVAILABLE); // Switch to green text
      tft.drawCentreString(bootSteps[3], 160, 170, 1);
    }
    delay(25); // Controls the speed of the loading screen
  }
  // Final Ready State: Blue LED
  setHardwareRGB(false, false, true); 
  delay(200); // Brief pause to let the user see 100% completion
}
// =====================================================================
// 🔄 CORE SYSTEM LOOP (NON-BLOCKING)
// =====================================================================
void loop() {
  handleTouch();
  
  uint32_t currentHeapKB = ESP.getFreeHeap() / 1024;
  // Core Functional Checks for Interface Evaluation
  bool isSdHardwareValid   = true; 
  bool isDhtHardwareValid  = !isnan(globalTempReading); // Evaluates true if data stream returns valid numbers
  bool isSpeakerValid      = (Speaker == 26);           // Pin configuration verification check
  bool isUartHardwareValid = Serial;                    // Verifies UART core serial channel initialization

  // 1. Telemetry Updates: CPU & RAM Top Bar (Every 1.5s)
  if (millis() - lastMetricUpdate > 1500) {
    drawSysMetrics();
    lastMetricUpdate = millis();
    // Periodically keep settings page numerical variables updated
    updateSettingsDisplay(isNightMode, currentHeapKB, isSdHardwareValid, isDhtHardwareValid, isSpeakerValid, isUartHardwareValid);
    // Background execution engine loop for data channel status visualization updates
    updateNetworkDisplay(networkSSID, isWifiActive, networkBT, isBtActive);
  }
  // 2. Clock Task Track (Every 1s)
  if (millis() - lastClockUpdate > 1000) {
    lastClockUpdate = millis();
    updateClockDisplay("21:46:12", "WED, JUL 08, 2026", true);
  }

  // 3. Environmental DHT11 Task Track (Every 2s)
  if (millis() - lastSensorRead > 2000) {
    lastSensorRead = millis();
    updateEnvDisplay(globalTempReading, 62.0);
  }

  // 4. Meteorology Task Track (Every 5s)
  if (millis() - lastWeatherFetch > 5000) {
    lastWeatherFetch = millis();
    updateWeatherDisplay(32.5, "Sunny / Clear", 4, 1008);
  }

  // 5. Mass Storage File System Task Track (Every 4s)
  if (millis() - lastStorageScan > 4000) {
    lastStorageScan = millis();
    updateStorageDisplay(isSdHardwareValid, 15240, 4320);
  }
}

// =====================================================================
// 💡 RGB UTILITY (Handles Inverted Common-Anode Logic)
// =====================================================================
void setHardwareRGB(bool r, bool g, bool b) {
  // LOW turns the channel ON, HIGH turns it OFF
  digitalWrite(RGB_RED_PIN,   r ? LOW : HIGH);
  digitalWrite(RGB_GREEN_PIN, g ? LOW : HIGH);
  digitalWrite(RGB_BLUE_PIN,  b ? LOW : HIGH);
}

// =====================================================================
// 📊 METRIC DRAW ENGINE
// =====================================================================
void drawSysMetrics() {
  uint16_t bgColor = isNightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  tft.fillRect(115, 0, 155, 33, bgColor); 
  tft.setTextColor(COLOR_INFO_BLUE, bgColor);
  
  uint32_t freeRam = ESP.getFreeHeap() / 1024;
  uint32_t cpuFreq = ESP.getCpuFreqMHz();

  String telemetryBuffer = "CPU:" + String(cpuFreq) + "Mhz | RAM:" + String(freeRam) + "KB";
  tft.drawString(telemetryBuffer, 120, 12, 1);
}

// =====================================================================
// 👆 HMI TOUCH DECODER AND MATRIX COORDINATE MAP ROUTER
// =====================================================================
void handleTouch() {
  if (touchscreen.tirqTouched() && touchscreen.touched() && (millis() - lastTouchTime > 220)) {
    TS_Point p = touchscreen.getPoint();
    int x = map(p.x, 200, 3700, 1, 320);
    int y = map(p.y, 240, 3800, 1, 240);
    lastTouchTime = millis();

    // Left Sidebar Navigation
    if (x < 55) {
      int calculatedTab = y / 40; 
      if (calculatedTab >= 0 && calculatedTab <= 5 && calculatedTab != currentTab) {
        currentTab = calculatedTab;
        drawSidebar();      
        drawMainContent();  
      }
    }
    
    // Day/Night Master Toggle Intercept
    if (x > 270 && y < 35) {
      isNightMode = !isNightMode;
       // Physically update the internal RGB indicator color based on mode
       if(isNightMode) {
         setHardwareRGB(false, false, true); // Deep calm blue for night mode
       } else {
         setHardwareRGB(false, true, false); // Bright emerald green for day mode
      }   
      drawBaseUI();       
      drawMainContent();  
    }
    // Process context menus inside active windows
    if (x >= 65 && y >= 40) {
      handleTabSpecificTouch(x, y);
    }
  }
}
// =====================================================================
// 🎛️ TAB-SPECIFIC COORDINATE BUTTON INTERCEPT LAYER
// =====================================================================
void handleTabSpecificTouch(int x, int y) {
  if (currentTab != 5) return; // Abort if not currently monitoring network tab

  // Wi-Fi Button Intercepts (Row Y: 100 to 122)
  if (y >= 100 && y <= 122) {
    if (x >= 75 && x <= 145) {         // LOAD Button
      networkSSID = loadNetworkProfile("/wifi.txt");
      isWifiActive = true;             // Engage transceiver on file check pass
      Serial.println("Loaded Wi-Fi Profile from SD storage array.");
    } else if (x >= 152 && x <= 222) {  // SAVE Button
      saveNetworkProfile("/wifi.txt", networkSSID);
      Serial.println("Saved Wi-Fi Profile safely to text block file.");
    } else if (x >= 229 && x <= 294) {  // EDIT/CREATE Button
      networkSSID = "NEW_SSID_PROP";   // Simulate an configuration entry event
      isWifiActive = false;            // Drop structural line until re-saved
    }
  }

  // Bluetooth Button Intercepts (Row Y: 170 to 192)
  if (y >= 170 && y <= 192) {
    if (x >= 75 && x <= 145) {         // LOAD Button
      networkBT = loadNetworkProfile("/bt.txt");
      isBtActive = true;
    } else if (x >= 152 && x <= 222) {  // SAVE Button
      saveNetworkProfile("/bt.txt", networkBT);
    } else if (x >= 229 && x <= 294) {  // EDIT/CREATE Button
      networkBT = "EDITED_BT_DEV";
      isBtActive = false;
    }
  }
  updateNetworkDisplay(networkSSID, isWifiActive, networkBT, isBtActive);
}
// =====================================================================
// 🎨 CORE FRAMEWORK RENDERING MATRIX
// =====================================================================
void drawBaseUI() {
  tft.fillScreen(
    isNightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG
    );
  drawSidebar();
  drawSysMetrics(); 

  uint16_t interfaceColor = isNightMode ? TFT_WHITE : TFT_BLACK;
  tft.drawRoundRect(285, 8, 30, 15, 7, interfaceColor);
  if(isNightMode) {
    tft.fillCircle(292, 15, 5, interfaceColor);
    tft.drawString("Night", 285, 25, 1);
  } else {
    tft.fillCircle(308, 15, 5, interfaceColor);
    tft.drawString("Day", 290, 25, 1);
  }
}

void drawSidebar() {
  tft.fillRect(0, 0, 55, 240, isNightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG); 
  const char* tabLabels[6] = {"SET", "CLK", "ENV", "WEA", "STG", "NET"};
  
  for(int i = 0; i < 6; i++) {
    int yPos = 6 + (i * 40);
    uint16_t internalBtnColor = (i == currentTab) ? COLOR_INFO_BLUE : COLOR_LABEL_GREY;
    tft.fillRoundRect(5, yPos, 47, 36, 5, internalBtnColor);
    tft.setTextColor(TFT_WHITE);
    tft.drawCentreString(tabLabels[i], 27, yPos + 10, 2);
  }
}
// =====================================================================
// 📂 MAIN CANVAS DISPATCHER INTERPOLATION MATRIX
// =====================================================================
void drawMainContent() {
  tft.fillRect(60, 35, 260, 205, isNightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG);
  uint32_t currentHeapKB = ESP.getFreeHeap() / 1024;

  bool isSdHardwareValid   = true;
  bool isDhtHardwareValid  = !isnan(globalTempReading);
  bool isSpeakerValid      = (Speaker == 26);
  bool isUartHardwareValid = Serial;

  switch(currentTab) {
    case 0: 
      drawTab_Settings(); 
      updateSettingsDisplay(isNightMode, currentHeapKB, isSdHardwareValid, isDhtHardwareValid, isSpeakerValid, isUartHardwareValid);
      break;
    case 1: 
      drawTab_Clock(); 
      break;
    case 2: 
      drawTab_Environment(); 
      break;
    case 3: 
      drawTab_Weather(); 
      break;
    case 4: 
      drawTab_Storage(); 
      break;
    case 5: 
      drawTab_Network(); 
      updateNetworkDisplay(networkSSID, isWifiActive, networkBT, isBtActive);
      break;
  }
}