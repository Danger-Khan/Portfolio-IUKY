// =====================================================================
// FILE: ESP32_Gateway.ino (Complete Central Execution Engine)
// =====================================================================
// Code By: Imaad Ullah Khan Yameen @ 2026
//=====================================================================
// Libraries Section
//=====================================================================
#include <SPI.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>
#include <esp_now.h>
#include <WiFi.h>
#include <LoRa.h>
// Include All The Config tabs
#include "config.h"
#include "diagnostics.h"
#include "global.h"
// Include All Component Tabs
#include "web_page.h"
// =====================================================================
// 📌 SYSTEM CONFIGURATION STRUCTURES
// =====================================================================
struct SystemMetrics {
  float temperature = 0;
  float humidity = 0;
  float batteryVoltage = 0;
  uint8_t batteryPercent = 0;
  int ldrValue = 0;
  uint8_t screenBrightness = 128;
  int wifiRSSI = 0;
  bool wifiConnected = false;
  bool loraConnected = false;
  bool sdPresent = false;
  String ipAddress = "0.0.0.0";
  String macAddress = "";
  uint32_t heapFree = 0;
  uint32_t uptime = 0;
} metrics;

struct AppConfig {
  char ssid[32] = "YOUR_WIFI_SSID";
  char password[32] = "YOUR_WIFI_PASSWORD";
  bool fanAutoMode = true;
  uint8_t fanSpeed = 50;
  bool speakerEnabled = true;
  uint8_t speakerVolume = 50;
  bool darkMode = false;
  uint8_t brightness = 128;
} appConfig;

struct WiFiNetwork {
  String ssid;
  int32_t rssi;
  uint8_t encryptionType;
  bool saved;
} networks[20];

struct LoRaPacket {
  String data;
  float rssi;
  float snr;
  unsigned long timestamp;
} lastPacket;

// =====================================================================
// 📌 FUNCTION PROTOTYPES
// =====================================================================
void systemInit();
void updateDisplay();
void renderHome();
void renderEnvironment();
void renderWiFiPage();
void renderLoRaPage();
void renderStoragePage();
void renderDiagnosticsPage();
void renderSettingsPage();
void drawStatusBar();
void drawSidebar();
void readSensors();
void readBattery();
void readLDR();
void scanWiFi();
void sendLoRaPacket(String data);
bool initSDCard();
void logToSD(String data);
void loadConfig();
void saveConfig();
void handleTouch();
bool isInRect(int x, int y, int rx, int ry, int rw, int rh);

// =====================================================================
// 📌 SETUP
// =====================================================================
void setup() {
  Serial.begin(115200);
  Serial.println("Gateway Loading...");
  
  systemInit();
  
  // Display splash screen
  tft.fillScreen(COLOR_NIGHT_BG);
  tft.setTextColor(COLOR_DAY_BG, COLOR_NIGHT_BG);
  tft.setTextSize(3);
  tft.setCursor(20, 60);
  tft.println("ESP32-CYD");
  tft.setTextSize(1);
  tft.setCursor(40, 110);
  tft.println("Multi-Protocol Gateway");
  tft.setCursor(80, 140);
  tft.println("Loading...");
  
  // Load configuration
  loadConfig();
  
  // Set initial state
  currentState = STATE_HOME;
  statusMessage = "System Ready";
  
  Serial.println("System Initialization Complete!");
}

// =====================================================================
// 📌 MAIN LOOP
// =====================================================================
void loop() {
  // Update display at 30-40ms intervals
  if(millis() - lastDisplayUpdate > 33) {
    lastDisplayUpdate = millis();
    updateDisplay();
  }
  
  // Handle touch at 10ms intervals
  if(millis() - lastTouchTime > 10) {
    lastTouchTime = millis();
    handleTouch();
  }
  
  // DHT reading every 2 seconds
  if(millis() - lastSensorRead > 2000) {
    lastSensorRead = millis();
    readSensors();
  }
  
  // Battery reading every 5 seconds
  if(millis() - lastBatteryRead > 5000) {
    lastBatteryRead = millis();
    readBattery();
  }
  
  // Update uptime
  metrics.uptime = millis() / 1000;
  metrics.heapFree = ESP.getFreeHeap();
  
  // WiFi management
  if(WiFi.status() == WL_CONNECTED) {
    if(!metrics.wifiConnected) {
      metrics.wifiConnected = true;
      metrics.ipAddress = WiFi.localIP().toString();
      Serial.println("WiFi Connected: " + metrics.ipAddress);
    }
    if(millis() - lastWiFiScan > 5000) {
      lastWiFiScan = millis();
      metrics.wifiRSSI = WiFi.RSSI();
    }
  } else {
    if(metrics.wifiConnected) {
      metrics.wifiConnected = false;
      statusMessage = "WiFi Disconnected";
    }
    // Try to connect
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
  
  // SD logging every 10 seconds
  if(millis() - lastSDLog > 10000) {
    lastSDLog = millis();
    String logData = String(metrics.temperature) + "," + 
                     String(metrics.humidity) + "," +
                     String(metrics.batteryPercent) + "," +
                     String(metrics.wifiRSSI);
    logToSD(logData);
  }
  
  // LoRa read
  if(Serial1.available()) {
    String packet = Serial1.readStringUntil('\n');
    packet.trim();
    if(packet.length() > 0) {
      lastPacket.data = packet;
      lastPacket.timestamp = millis();
      metrics.loraConnected = true;
      Serial.println("LoRa Received: " + packet);
      logToSD("LoRa: " + packet);
    }
  }
  
  delay(10);
}

// =====================================================================
// 📌 SYSTEM INITIALIZATION
// =====================================================================
void systemInit() {
  Serial.println("Hardware Initialization...");
  
  // Initialize pins
  pinMode(RGB_RED_PIN, OUTPUT);
  pinMode(RGB_GREEN_PIN, OUTPUT);
  pinMode(RGB_BLUE_PIN, OUTPUT);
  pinMode(BACKLIGHT_PIN, OUTPUT);
  pinMode(SPEAKER_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(LDR_PIN, INPUT);
  pinMode(BATTERY_PIN, INPUT);
  
  // Set initial states
  digitalWrite(RGB_RED_PIN, LOW);
  digitalWrite(RGB_GREEN_PIN, LOW);
  digitalWrite(RGB_BLUE_PIN, HIGH);
  
  // Initialize display
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  
  // Backlight on
  analogWrite(BACKLIGHT_PIN, 128);
  
  // Initialize touch
  touchscreen.begin();
  touchscreen.setRotation(1);
  
  // Initialize SD Card
  initSDCard();
  
  // Get MAC address
  metrics.macAddress = WiFi.macAddress();
  
  // Initialize LoRa UART
  Serial1.begin(9600, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);
  Serial.println("LoRa UART Initialized");
  
  Serial.println("Hardware Initialization Complete");
}

// =====================================================================
// 📌 DISPLAY RENDER FUNCTIONS
// =====================================================================
void updateDisplay() {
  switch(currentState) {
    case STATE_HOME: renderHome(); break;
    case STATE_ENVIRONMENT: renderEnvironment(); break;
    case STATE_WIFI: renderWiFiPage(); break;
    case STATE_LORA: renderLoRaPage(); break;
    case STATE_STORAGE: renderStoragePage(); break;
    case STATE_DIAGNOSTICS: renderDiagnosticsPage(); break;
    case STATE_SETTINGS: renderSettingsPage(); break;
    default: renderHome(); break;
  }
}

// =====================================================================
// 📌 HOME PAGE
// =====================================================================
void renderHome() {
  uint16_t bgColor = nightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillScreen(bgColor);
  drawStatusBar();
  
  tft.setTextColor(textColor);
  tft.setTextSize(2);
  tft.setCursor(10, 35);
  tft.println("GATEWAY STATUS");
  
  int y = 70;
  int spacing = 28;
  tft.setTextSize(1);
  
  // Row 1: Temperature & Humidity
  tft.setCursor(10, y);
  tft.print("Temp: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(metrics.temperature, 1);
  tft.setTextColor(textColor);
  tft.print(" C");
  
  tft.setCursor(160, y);
  tft.print("Humidity: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(metrics.humidity, 1);
  tft.setTextColor(textColor);
  tft.print("%");
  
  // Row 2: Battery & WiFi
  y += spacing;
  tft.setCursor(10, y);
  tft.print("Battery: ");
  tft.setTextColor(metrics.batteryPercent > 20 ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.batteryPercent);
  tft.setTextColor(textColor);
  tft.print("%");
  
  tft.setCursor(160, y);
  tft.print("WiFi: ");
  tft.setTextColor(metrics.wifiConnected ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.wifiConnected ? "ON" : "OFF");
  tft.setTextColor(textColor);
  tft.print(" ");
  tft.print(metrics.wifiRSSI);
  tft.print("dBm");
  
  // Row 3: LoRa & SD
  y += spacing;
  tft.setCursor(10, y);
  tft.print("LoRa: ");
  tft.setTextColor(metrics.loraConnected ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.loraConnected ? "ON" : "OFF");
  
  tft.setCursor(160, y);
  tft.print("SD: ");
  tft.setTextColor(metrics.sdPresent ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.sdPresent ? "OK" : "MISSING");
  
  // Row 4: Heap
  y += spacing;
  tft.setCursor(10, y);
  tft.print("Heap: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(metrics.heapFree / 1024);
  tft.setTextColor(textColor);
  tft.print("KB");
  
  tft.setCursor(160, y);
  tft.print("Uptime: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  int hours = metrics.uptime / 3600;
  int mins = (metrics.uptime % 3600) / 60;
  tft.print(hours);
  tft.print("h ");
  tft.print(mins);
  tft.print("m");
  
  // Status Message
  tft.setTextColor(nightMode ? TFT_YELLOW : TFT_BLUE);
  tft.setCursor(10, 210);
  tft.print(statusMessage);
  
  drawSidebar();
}

// =====================================================================
// 📌 ENVIRONMENT PAGE
// =====================================================================
void renderEnvironment() {
  uint16_t bgColor = nightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillScreen(bgColor);
  drawStatusBar();
  
  tft.setTextColor(textColor);
  tft.setTextSize(2);
  tft.setCursor(10, 35);
  tft.println("ENVIRONMENT");
  
  tft.setTextSize(4);
  tft.setCursor(40, 80);
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(metrics.temperature, 1);
  tft.setTextColor(textColor);
  tft.print(" C");
  
  tft.setTextSize(2);
  tft.setCursor(40, 140);
  tft.setTextColor(COLOR_AVAILABLE);
  tft.print(metrics.humidity, 1);
  tft.setTextColor(textColor);
  tft.print("% RH");
  
  tft.setTextSize(1);
  tft.setCursor(40, 180);
  tft.print("Light: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(map(metrics.ldrValue, 0, 4095, 0, 100));
  tft.setTextColor(textColor);
  tft.print("%");
  
  drawSidebar();
}

// =====================================================================
// 📌 WIFI PAGE
// =====================================================================
void renderWiFiPage() {
  uint16_t bgColor = nightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillScreen(bgColor);
  drawStatusBar();
  
  tft.setTextColor(textColor);
  tft.setTextSize(2);
  tft.setCursor(10, 35);
  tft.println("WiFi MANAGEMENT");
  
  tft.setTextSize(1);
  tft.setCursor(10, 70);
  tft.print("Status: ");
  tft.setTextColor(metrics.wifiConnected ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.wifiConnected ? "CONNECTED" : "DISCONNECTED");
  
  if(metrics.wifiConnected) {
    tft.setTextColor(textColor);
    tft.setCursor(10, 90);
    tft.print("SSID: ");
    tft.setTextColor(COLOR_INFO_BLUE);
    tft.print(WIFI_SSID);
    
    tft.setTextColor(textColor);
    tft.setCursor(10, 110);
    tft.print("IP: ");
    tft.setTextColor(COLOR_INFO_BLUE);
    tft.print(metrics.ipAddress);
    
    tft.setTextColor(textColor);
    tft.setCursor(10, 130);
    tft.print("RSSI: ");
    tft.setTextColor(COLOR_INFO_BLUE);
    tft.print(metrics.wifiRSSI);
    tft.print("dBm");
  }
  
  // WiFi networks list
  tft.setTextColor(textColor);
  tft.setCursor(160, 70);
  tft.print("Networks:");
  
  for(int i = 0; i < networkCount && i < 5; i++) {
    int y = 90 + i * 20;
    tft.setCursor(160, y);
    tft.setTextColor(COLOR_INFO_BLUE);
    tft.print(networks[i].ssid.substring(0, 12));
    tft.setTextColor(textColor);
    tft.print(" ");
    tft.print(networks[i].rssi);
    tft.print("dBm");
  }
  
  drawSidebar();
}

// =====================================================================
// 📌 LORA PAGE
// =====================================================================
void renderLoRaPage() {
  uint16_t bgColor = nightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillScreen(bgColor);
  drawStatusBar();
  
  tft.setTextColor(textColor);
  tft.setTextSize(2);
  tft.setCursor(10, 35);
  tft.println("LORA");
  
  tft.setTextSize(1);
  tft.setCursor(10, 70);
  tft.print("Status: ");
  tft.setTextColor(metrics.loraConnected ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.loraConnected ? "ACTIVE" : "INACTIVE");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 90);
  tft.print("Last Packet: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(lastPacket.data.length() > 0 ? "Received" : "None");
  
  if(lastPacket.data.length() > 0) {
    tft.setCursor(10, 110);
    tft.print("Data: ");
    tft.setTextColor(COLOR_INFO_BLUE);
    tft.print(lastPacket.data.substring(0, 20));
  }
  
  drawSidebar();
}

// =====================================================================
// 📌 STORAGE PAGE
// =====================================================================
void renderStoragePage() {
  uint16_t bgColor = nightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillScreen(bgColor);
  drawStatusBar();
  
  tft.setTextColor(textColor);
  tft.setTextSize(2);
  tft.setCursor(10, 35);
  tft.println("STORAGE");
  
  tft.setTextSize(1);
  tft.setCursor(10, 70);
  tft.print("SD Card: ");
  tft.setTextColor(metrics.sdPresent ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.sdPresent ? "PRESENT" : "MISSING");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 90);
  tft.print("Free Heap: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(metrics.heapFree / 1024);
  tft.print("KB");
  
  if(metrics.sdPresent) {
    tft.setTextColor(textColor);
    tft.setCursor(10, 110);
    tft.print("Logging: ");
    tft.setTextColor(COLOR_AVAILABLE);
    tft.print("ACTIVE");
  }
  
  drawSidebar();
}

// =====================================================================
// 📌 DIAGNOSTICS PAGE
// =====================================================================
void renderDiagnosticsPage() {
  uint16_t bgColor = nightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillScreen(bgColor);
  drawStatusBar();
  
  tft.setTextColor(textColor);
  tft.setTextSize(2);
  tft.setCursor(10, 35);
  tft.println("DIAGNOSTICS");
  
  tft.setTextSize(1);
  tft.setCursor(10, 70);
  tft.print("Free Heap: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(metrics.heapFree / 1024);
  tft.print("KB");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 90);
  tft.print("Uptime: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  int hours = metrics.uptime / 3600;
  int mins = (metrics.uptime % 3600) / 60;
  int secs = metrics.uptime % 60;
  tft.print(hours);
  tft.print("h ");
  tft.print(mins);
  tft.print("m ");
  tft.print(secs);
  tft.print("s");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 110);
  tft.print("MAC: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(metrics.macAddress);
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 130);
  tft.print("SD: ");
  tft.setTextColor(metrics.sdPresent ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.sdPresent ? "OK" : "FAIL");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 150);
  tft.print("LoRa: ");
  tft.setTextColor(metrics.loraConnected ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.loraConnected ? "OK" : "FAIL");
  
  drawSidebar();
}

// =====================================================================
// 📌 SETTINGS PAGE
// =====================================================================
void renderSettingsPage() {
  uint16_t bgColor = nightMode ? COLOR_NIGHT_BG : COLOR_DAY_BG;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillScreen(bgColor);
  drawStatusBar();
  
  tft.setTextColor(textColor);
  tft.setTextSize(2);
  tft.setCursor(10, 35);
  tft.println("SETTINGS");
  
  tft.setTextSize(1);
  tft.setCursor(10, 70);
  tft.print("Fan Auto: ");
  tft.setTextColor(appConfig.fanAutoMode ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(appConfig.fanAutoMode ? "ON" : "OFF");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 90);
  tft.print("Fan Speed: ");
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.print(appConfig.fanSpeed);
  tft.print("%");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 110);
  tft.print("Speaker: ");
  tft.setTextColor(appConfig.speakerEnabled ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(appConfig.speakerEnabled ? "ON" : "OFF");
  
  tft.setTextColor(textColor);
  tft.setCursor(10, 130);
  tft.print("Night Mode: ");
  tft.setTextColor(nightMode ? COLOR_INFO_BLUE : COLOR_UNAVAILABLE);
  tft.print(nightMode ? "ON" : "OFF");
  
  drawSidebar();
}

// =====================================================================
// 📌 UI HELPERS
// =====================================================================
void drawStatusBar() {
  uint16_t bgColor = nightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  uint16_t textColor = nightMode ? TFT_WHITE : TFT_BLACK;
  
  tft.fillRect(0, 0, 320, 25, bgColor);
  tft.drawFastHLine(0, 25, 320, nightMode ? TFT_DARKGREY : TFT_LIGHTGREY);
  
  tft.setTextColor(textColor);
  tft.setTextSize(1);
  tft.setCursor(5, 8);
  tft.print("ESP32-CYD");
  
  tft.setCursor(180, 8);
  tft.print("WiFi:");
  tft.setTextColor(metrics.wifiConnected ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.wifiConnected ? "ON" : "OFF");
  
  tft.setTextColor(textColor);
  tft.setCursor(230, 8);
  tft.print("LoRa:");
  tft.setTextColor(metrics.loraConnected ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.loraConnected ? "ON" : "OFF");
  
  tft.setTextColor(textColor);
  tft.setCursor(270, 8);
  tft.print("Bat:");
  tft.setTextColor(metrics.batteryPercent > 20 ? COLOR_AVAILABLE : COLOR_UNAVAILABLE);
  tft.print(metrics.batteryPercent);
  tft.print("%");
}

void drawSidebar() {
  uint16_t bgColor = nightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  tft.fillRect(0, 215, 320, 25, bgColor);
  tft.drawFastHLine(0, 215, 320, nightMode ? TFT_DARKGREY : TFT_LIGHTGREY);
  
  const char* tabs[] = {"Home", "Env", "WiFi", "LoRa", "SD", "Diag", "Set"};
  int numTabs = 7;
  int tabWidth = 320 / numTabs;
  
  for(int i = 0; i < numTabs; i++) {
    int x = i * tabWidth;
    if(i == currentTab) {
      tft.fillRect(x, 215, tabWidth, 25, COLOR_INFO_BLUE);
      tft.setTextColor(TFT_WHITE);
    } else {
      tft.setTextColor(nightMode ? TFT_LIGHTGREY : TFT_DARKGREY);
    }
    tft.setCursor(x + 12, 220);
    tft.print(tabs[i]);
  }
}

// =====================================================================
// 📌 TOUCH HANDLING
// =====================================================================
void handleTouch() {
  if(touchscreen.touched()) {
    TS_Point p = touchscreen.getPoint();
    
    int x = map(p.x, 200, 3700, 0, 320);
    int y = map(p.y, 200, 3700, 0, 240);
    
    x = constrain(x, 0, 319);
    y = constrain(y, 0, 239);
    
    touchX = x;
    touchY = y;
    touchPressed = true;
    
    // Check bottom navigation bar
    if(y > 215) {
      int numTabs = 7;
      int tabWidth = 320 / numTabs;
      int tab = x / tabWidth;
      if(tab >= 0 && tab < numTabs) {
        currentTab = tab;
        switch(tab) {
          case 0: currentState = STATE_HOME; break;
          case 1: currentState = STATE_ENVIRONMENT; break;
          case 2: currentState = STATE_WIFI; break;
          case 3: currentState = STATE_LORA; break;
          case 4: currentState = STATE_STORAGE; break;
          case 5: currentState = STATE_DIAGNOSTICS; break;
          case 6: currentState = STATE_SETTINGS; break;
        }
        statusMessage = "Tab: " + String(currentState);
      }
    }
    delay(50);
  } else {
    touchPressed = false;
  }
}

// =====================================================================
// 📌 SENSOR FUNCTIONS
// =====================================================================
void readSensors() {
  // Read DHT11
  int temperature = 0;
  int humidity = 0;
  int result = dht11.readTemperatureHumidity(temperature, humidity);
  
  if(result == 0) {  // Success
    metrics.temperature = temperature;
    metrics.humidity = humidity;
  } else {
    Serial.println("DHT11 error: " + String(result));
  }
  
  // Read LDR
  readLDR();
}

void readBattery() {
  int raw = analogRead(BATTERY_PIN);
  float voltage = (raw / 4095.0) * 3.3 * 2;
  metrics.batteryVoltage = voltage;
  
  float percent = (voltage - 3.0) / 1.2 * 100;
  metrics.batteryPercent = constrain((int)percent, 0, 100);
}

void readLDR() {
  metrics.ldrValue = analogRead(LDR_PIN);
  
  if(!nightMode) {
    int brightness = map(metrics.ldrValue, 0, 4095, 50, 255);
    brightness = constrain(brightness, 30, 255);
    appConfig.brightness = brightness;
    analogWrite(BACKLIGHT_PIN, brightness);
  }
}

// =====================================================================
// 📌 NETWORK FUNCTIONS
// =====================================================================
void scanWiFi() {
  networkCount = WiFi.scanNetworks();
  for(int i = 0; i < networkCount && i < 20; i++) {
    networks[i].ssid = WiFi.SSID(i);
    networks[i].rssi = WiFi.RSSI(i);
    networks[i].encryptionType = WiFi.encryptionType(i);
    networks[i].saved = (networks[i].ssid == String(WIFI_SSID));
  }
}

// =====================================================================
// 📌 LORA FUNCTIONS
// =====================================================================
void sendLoRaPacket(String data) {
  Serial1.println(data);
  Serial.println("LoRa Sent: " + data);
  lastPacket.data = data;
  lastPacket.timestamp = millis();
  metrics.loraConnected = true;
  logToSD("LoRa Sent: " + data);
}

// =====================================================================
// 📌 SD CARD FUNCTIONS
// =====================================================================
bool initSDCard() {
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI);
  if(!SD.begin(SD_CS)) {
    Serial.println("SD Card initialization failed!");
    metrics.sdPresent = false;
    return false;
  }
  metrics.sdPresent = true;
  Serial.println("SD Card initialized.");
  
  File file = SD.open("/log.csv", FILE_APPEND);
  if(file) {
    file.println("Timestamp,Temperature,Humidity,Battery,WiFiRSSI");
    file.close();
  }
  return true;
}

void logToSD(String data) {
  if(!metrics.sdPresent) return;
  
  File file = SD.open("/log.csv", FILE_APPEND);
  if(file) {
    file.print(millis() / 1000);
    file.print(",");
    file.println(data);
    file.close();
  }
}

void loadConfig() {
  if(!metrics.sdPresent) return;
  
  File file = SD.open("/config.json");
  if(file) {
    String json = file.readString();
    file.close();
    Serial.println("Config loaded from SD");
  }
}

void saveConfig() {
  if(!metrics.sdPresent) return;
  
  File file = SD.open("/config.json", FILE_WRITE);
  if(file) {
    file.println("{");
    file.println("\"ssid\":\"" + String(WIFI_SSID) + "\",");
    file.println("\"fanAuto\":" + String(appConfig.fanAutoMode ? "true" : "false") + ",");
    file.println("\"fanSpeed\":" + String(appConfig.fanSpeed) + ",");
    file.println("\"speaker\":" + String(appConfig.speakerEnabled ? "true" : "false") + ",");
    file.println("\"darkMode\":" + String(nightMode ? "true" : "false"));
    file.println("}");
    file.close();
    Serial.println("Config saved to SD");
  }
}

// =====================================================================
// 📌 UTILITY FUNCTIONS
// =====================================================================
bool isInRect(int x, int y, int rx, int ry, int rw, int rh) {
  return (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
}

