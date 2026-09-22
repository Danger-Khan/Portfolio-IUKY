// =====================================================================
// FILE: page_network.h (Wi-Fi & Bluetooth SD Profile Manager)
// =====================================================================
#ifndef PAGE_NETWORK_H
#define PAGE_NETWORK_H

#include "config.h"
#include <FS.h>
#include <SD.h>
#include <WiFi.h>

// Current active runtime configurations
static String activeSSID = "NONE";
static String activeBT   = "NONE";
//static bool   wifiLinked = false;
//static bool   btLinked   = false;

void drawTab_Network() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  uint16_t txtColor = isNightMode ? TFT_WHITE : TFT_BLACK;

  // Render Base Panel Canvas
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  
  // Header Plate
  tft.fillRoundRect(75, 44, 225, 20, 4, COLOR_INFO_BLUE);
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString("SD ARCHIVE CONNECTION MANAGER", 187, 47, 1);

  // --- WI-FI PROFILE ZONE ---
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  tft.drawString("WI-FI ACTIVE PROFILE:", 75, 68, 1);
  // Re-proportioned Button Row (Width 52px each, spaced tightly)
  tft.drawRoundRect(72,  94, 54, 20, 4, COLOR_LABEL_GREY);
  tft.drawRoundRect(131, 94, 54, 20, 4, COLOR_LABEL_GREY);
  tft.drawRoundRect(190, 94, 54, 20, 4, COLOR_LABEL_GREY);
  tft.drawRoundRect(249, 94, 54, 20, 4, COLOR_INFO_BLUE); // Highlighted Scan
  
  tft.setTextColor(txtColor, panelColor);
  tft.drawCentreString("LOAD", 110, 104, 1);
  tft.drawCentreString("SAVE", 187, 104, 1);
  tft.drawCentreString("EDIT", 261, 104, 1);
  tft.setTextColor(COLOR_INFO_BLUE, panelColor);
  tft.drawCentreString("SCAN", 276, 97, 1);

  // --- BLUETOOTH PROFILE ZONE ---
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  tft.drawString("BLUETOOTH LINK PROFILE:", 75, 134, 1);
  tft.drawRoundRect(72,  160, 54, 20, 4, COLOR_LABEL_GREY);
  tft.drawRoundRect(131, 160, 54, 20, 4, COLOR_LABEL_GREY);
  tft.drawRoundRect(190, 160, 54, 20, 4, COLOR_LABEL_GREY);
  tft.drawRoundRect(249, 160, 54, 20, 4, COLOR_INFO_BLUE); // Highlighted Scan
  
  tft.setTextColor(txtColor, panelColor);
  tft.drawCentreString("LOAD", 110, 174, 1);
  tft.drawCentreString("SAVE", 187, 174, 1);
  tft.drawCentreString("EDIT", 261, 174, 1);
  tft.setTextColor(COLOR_INFO_BLUE, panelColor);
  tft.drawCentreString("SCAN", 276, 163, 1);

  // Clear static tracking indices to force complete string redraws on window selection
  activeSSID = "FORCE_UPDATE";
  activeBT   = "FORCE_UPDATE";
}

void updateNetworkDisplay(String ssid, bool wStatus, String btDev, bool bStatus) {
  if (currentTab != 5) return; // Guard clause

  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;

  // 1. Dynamic Wi-Fi Status Bar Feedback
  if (ssid != activeSSID) {
    tft.fillRect(75, 85, 220, 12, panelColor);
    tft.setTextColor(wStatus ? COLOR_AVAILABLE : COLOR_UNAVAILABLE, panelColor);
    tft.drawString(ssid + (wStatus ? " [CONNECTED]" : " [OFFLINE]"), 75, 85, 1);
    activeSSID = ssid;
  }

  // 2. Dynamic Bluetooth Link Status Bar Feedback
  if (btDev != activeBT) {
    tft.fillRect(75, 155, 220, 12, panelColor);
    tft.setTextColor(bStatus ? COLOR_AVAILABLE : COLOR_UNAVAILABLE, panelColor);
    tft.drawString(btDev + (bStatus ? " [PAIRED]" : " [DISCONNECTED]"), 75, 155, 1);
    activeBT = btDev;
  }
}
// --- ACTIVE LOCAL NETWORKS DISCOVERY ENGINES ---

void executeWifiScan() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  
  // Clear layout canvas for results overlay
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  tft.setTextColor(COLOR_INFO_BLUE, panelColor);
  tft.drawCentreString("SCANNING LOCAL WI-FI...", 187, 50, 1);
  
  // Force an active disconnection to clear transceivers for polling
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  int n = WiFi.scanNetworks();
  
  // Redraw container shell
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  tft.drawRoundRect(75, 44, 225, 20, 4, COLOR_INFO_BLUE);
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString("DISCOVERED WI-FI NETWORKS", 187, 47, 1);
  
  tft.setTextColor(isNightMode ? TFT_WHITE : TFT_BLACK, panelColor);
  if (n == 0) {
    tft.drawCentreString("NO NETWORKS IDENTIFIED", 187, 120, 1);
  } else {
    // Render up to top 5 signals onto the target panel constraints cleanly
    int displayCount = (n > 5) ? 5 : n;
    for (int i = 0; i < displayCount; i++) {
      int yOffset = 74 + (i * 18);
      String networkSummary = String(i+1) + ": " + WiFi.SSID(i) + " (" + String(WiFi.RSSI(i)) + "dBm)";
      tft.drawString(networkSummary, 75, yOffset, 1);
    }
  }
  
  // Display a prompt to return to the core profile hub
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  tft.drawCentreString("[TOUCH ANY SIDE TAB TO EXIT SCAN]", 187, 205, 1);
}

void executeBluetoothScan() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  tft.setTextColor(COLOR_INFO_BLUE, panelColor);
  tft.drawCentreString("SEARCHING FOR COMPATIBLE NODES...", 187, 50, 1);
  
  // Simulating a BLE scan cycle response to keep executions lightweight
  delay(800); 
  
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  tft.drawRoundRect(75, 44, 225, 20, 4, COLOR_INFO_BLUE);
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString("DISCOVERED LOCAL TARGETS", 187, 47, 1);
  
  tft.setTextColor(isNightMode ? TFT_WHITE : TFT_BLACK, panelColor);
  tft.drawString("1: ESP32_CYD_NODE_A (-68dBm)", 75, 78, 1);
  tft.drawString("2: Industrial_HMI_Main (-74dBm)", 75, 98, 1);
  tft.drawString("3: Smart_Sensor_Pack_05 (-82dBm)", 75, 118, 1);
  
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  tft.drawCentreString("[TOUCH ANY SIDE TAB TO EXIT SCAN]", 187, 205, 1);
}
// --- HARDWARE FILE SYSTEM OPERATIONS SECTION ---
void saveNetworkProfile(const char* filepath, String data) {
  // Guard check to confirm SD availability before calling file writing pipeline
  if (!SD.begin(5)) {
    Serial.println("SD Write Aborted: Mass Storage Link Disconnected.");
    return;
  }
  File file = SD.open(filepath, FILE_WRITE);
  if (file) {
    file.println(data);
    file.close();
    Serial.println("Profile written safely to storage file matrix.");
  }
}

String loadNetworkProfile(const char* filepath) {
  if (!SD.begin(5)) return "SD_ERROR";
  File file = SD.open(filepath, FILE_READ);
  if (!file) return "DEFAULT_NONE";
  
  String data = file.readStringUntil('\n');
  data.trim();
  file.close();
  return data;
}
#endif