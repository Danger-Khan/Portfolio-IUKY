// // =====================================================================
// // FILE: page_settings.h (System Configuration & Diagnostic Window)
// // FILE: page_settings.h (Corrected Signature & Variable Scope Fix)
// // FILE: page_settings.h (Pruned & Fully Cleaned Version)
// // =====================================================================
// #ifndef PAGE_SETTINGS_H
// #define PAGE_SETTINGS_H

// #include "config.h"

// // Explicitly declared at global file scope so both functions can access it
// static bool lastDrawnThemeMode = false;
// static int lastDrawnSettingsTab = -1;
// static uint32_t lastDrawnHeapKB    = 0;

// /// Function 
// void drawTab_Settings() {
//   uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
//   uint16_t txtColor = isNightMode ? TFT_WHITE : TFT_BLACK;

//   // Render Base Panel
//   tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
//     // Header Plate
//   tft.fillRoundRect(75, 44, 225, 20, 4, COLOR_LABEL_GREY);
//   tft.setTextColor(TFT_WHITE);
//   tft.drawCentreString("HARDWARE INTERFACE LAYER", 187, 47, 1);

//  // Structural Hardware Pin Mapping Matrix Table
//   tft.setTextColor(COLOR_LABEL_GREY, panelColor);
//   tft.drawString("RGB Interface:", 75, 76, 1);
//   tft.drawString("LDR Sensor pin:", 75, 91, 1);
//   tft.drawString("TFT Bus Speed:", 75, 106, 1);
//   tft.drawString("Touch Engine:", 75, 121, 1);
//   tft.drawString("DHT11 Bus Pins:", 72, 68, 1);
//   tft.drawString("Speaker Out Pin:", 72, 81, 1);
//   tft.drawString("UART0 Interface:", 72, 94, 1);

//   tft.setTextColor(txtColor, panelColor);
//   tft.drawString("IO4, IO16, IO17", 175, 76, 1);
//   tft.drawString("Analog IO34", 175, 91, 1);
//   tft.drawString("SPI @ 40MHz", 175, 106, 1);
//   tft.drawString("XPT2046 (IO33)", 175, 121, 1);
//   tft.drawString("SDA:22 | SCL:27",  172, 68, 1);
//   tft.drawString("GPIO 26 (PWM)",    172, 81, 1);
//   tft.drawString("TX:IO1 | RX:IO3",  172, 94, 1);

//  // Divider Line
//   tft.drawFastHLine(75, 140, 225, COLOR_LABEL_GREY);

//  // Runtime Tracking Metadata Labels
//   tft.setTextColor(COLOR_LABEL_GREY, panelColor);
//   tft.drawString("FREE RAM:",   75, 130, 1);
//   tft.drawString("SD STORAGE:", 75, 146, 1);
//   tft.drawString("DHT11 NODE:", 75, 162, 1);
//   tft.drawString("SPEAKER:",    75, 178, 1);
//   tft.drawString("UART SERIAL:", 75, 194, 1);
//   tft.drawString("LDR LINK:", 75, 186, 2);
//   tft.drawString("THEME:", 75, 206, 2);

//  // Dynamic Content Section Labels
//   tft.size_t :: tft.setTextColor(COLOR_LABEL_GREY, panelColor);
//   tft.drawString("LED STATE:", 75, 155, 2);
//   tft.drawString("THEME:", 75, 185, 2);

//   lastDrawnSettingsTab = -1; // Force immediate update
//   lastDrawnHeapKB    = 0;
// }

// void updateSettingsDisplay(bool nightModeActive, uint32_t freeHeapKB, bool sdOnline, bool dhtOnline, bool spkReady, bool uartActive) {
//   if (currentTab != 0) return; // Guard clause

//   uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
//   uint16_t txtColor = isNightMode ? TFT_WHITE : TFT_BLACK;
//   // Sample LDR pin status directly using definitions from config.h
//   bool ldrOnline = (analogRead(LDR_PIN) >= 0);

//   // 1. Dynamic Memory Pipeline Refresh Tracker
//   if (freeHeapKB != lastDrawnHeapKB) {
//     tft.fillRect(150, 146, 140, 16, panelColor);
//     tft.setTextColor(COLOR_INFO_BLUE, panelColor);
//     tft.drawString(String(freeHeapKB) + " KB FREE", 150, 146, 2);
//     lastDrawnHeapKB = freeHeapKB;
//   }
//   // 2. State Evaluations & Hardware Link Verification Layer
//   if (nightModeActive != lastDrawnThemeMode) {
//     // SD Card Interface Link Verification Output
//     tft.fillRect(150, 166, 140, 16, panelColor);
//     if (sdOnline) {
//       tft.setTextColor(COLOR_AVAILABLE, panelColor);
//       tft.drawString("CONNECTED", 150, 166, 2);
//     } else {
//       tft.setTextColor(COLOR_UNAVAILABLE, panelColor);
//       tft.drawString("DISCONNECTED", 150, 166, 2);
//     }
//     // DHT11 Connection Check
//     tft.fillRect(155, 162, 145, 13, panelColor);
//     if (dhtOnline) {
//       tft.setTextColor(COLOR_AVAILABLE, panelColor);
//       tft.drawString("CONNECTED / OK", 155, 162, 1);
//     } else {
//       tft.setTextColor(COLOR_UNAVAILABLE, panelColor);
//       tft.drawString("BUS ERROR / FAULT", 155, 162, 1);
//     }
//     // Speaker Hardware Assignment Status Check
//     tft.fillRect(155, 178, 145, 13, panelColor);
//     if (spkReady) {
//       tft.setTextColor(COLOR_AVAILABLE, panelColor);
//       tft.drawString("AUDIO NODE READY", 155, 178, 1);
//     } else {
//       tft.setTextColor(COLOR_UNAVAILABLE, panelColor);
//       tft.drawString("OFFLINE", 155, 178, 1);
//     }
//     // Hardware Serial Hardware Interface Bus Verification
//     tft.fillRect(155, 194, 145, 13, panelColor);
//     if (uartActive) {
//       tft.setTextColor(COLOR_AVAILABLE, panelColor);
//       tft.drawString("ACTIVE @ 115200bps", 155, 194, 1);
//     } else {
//       tft.setTextColor(COLOR_UNAVAILABLE, panelColor);
//       tft.drawString("BUS DISABLED", 155, 194, 1);
//     }
//     // Light Dependent Resistor Live Connection Verification
//     tft.fillRect(150, 186, 140, 16, panelColor);
//     if (ldrOnline) {
//       tft.setTextColor(COLOR_AVAILABLE, panelColor);
//       tft.drawString("ONLINE", 150, 186, 2);
//     } else {
//       tft.setTextColor(COLOR_UNAVAILABLE, panelColor);
//       tft.drawString("OPEN CIRCUIT", 150, 186, 2);
//     }
//     // Theme Mode Verification Output
//     tft.fillRect(150, 206, 140, 16, panelColor);
//     if (nightModeActive) {
//       tft.setTextColor(COLOR_INFO_BLUE, panelColor);
//       tft.drawString("MIDNIGHT SLATE", 150, 206, 2);
//     } else {
//       tft.setTextColor(COLOR_LABEL_GREY, panelColor);
//       tft.drawString("NEUTRAL LIGHT", 150, 206, 2);
//     }
//     lastDrawnSettingsTab = nightModeActive;
//   }
// }

// #endif