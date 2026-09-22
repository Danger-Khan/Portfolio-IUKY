// =====================================================================
// FILE: page_settings.h (Pruned & Fully Cleaned Version)
// =====================================================================
#ifndef PAGE_SETTINGS_H
#define PAGE_SETTINGS_H

#include "config.h"

// Explicitly declared at global file scope so both functions can access it
static bool lastDrawnThemeMode = false;

void drawTab_Settings() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  tft.fillRoundRect(75, 44, 225, 20, 4, COLOR_INFO_BLUE);
  
  // FIX: Eliminated the 'size_t' typo completely
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString("SYSTEM HARDWARE DIAGNOSTICS", 187, 47, 1);
}

// Fixed signature matching your Master Loop's 6 arguments
void updateSettingsDisplay(bool nightModeActive, uint32_t freeHeapKB, bool sdOnline, bool dhtOnline, bool spkReady, bool uartActive) {
  if (currentTab != 0) return; // Guard clause

  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  uint16_t textMain   = isNightMode ? TFT_WHITE : TFT_BLACK;

  if (nightModeActive != lastDrawnThemeMode) {
    lastDrawnThemeMode = nightModeActive;
  }

  // FIX: Changed comparison from '>= 0' to '< 4096' to resolve the compiler warning
  int rawLDR = analogRead(LDR_PIN);
  bool ldrOnline = (rawLDR < 4096); 

  // --- Render Telemetry Array Layout ---
  tft.setTextColor(textMain, panelColor);
  
  // Row 1: Heap Allocation
  tft.fillRect(75, 75, 220, 12, panelColor);
  tft.drawString("HEAP CAPACITY: " + String(freeHeapKB) + " KB", 75, 75, 1);

  // Row 2: SD Status
  tft.drawString("STORAGE (SD): ", 75, 95, 1);
  tft.setTextColor(sdOnline ? COLOR_AVAILABLE : COLOR_UNAVAILABLE, panelColor);
  tft.drawString(sdOnline ? "CONNECTED" : "DISCONNECTED", 160, 95, 1);

  // Row 3: DHT Sensor
  tft.setTextColor(textMain, panelColor);
  tft.drawString("DHT TRANSCEIVER: ", 75, 115, 1);
  tft.setTextColor(dhtOnline ? COLOR_AVAILABLE : COLOR_UNAVAILABLE, panelColor);
  tft.drawString(dhtOnline ? "OPERATIONAL" : "BUS FAULT", 175, 115, 1);

  // Row 4: Audio Status
  tft.setTextColor(textMain, panelColor);
  tft.drawString("SPEAKER CORE: ", 75, 135, 1);
  tft.setTextColor(spkReady ? COLOR_AVAILABLE : COLOR_UNAVAILABLE, panelColor);
  tft.drawString(spkReady ? "ONLINE" : "OFFLINE", 165, 135, 1);

  // Row 5: Serial Bus
  tft.setTextColor(textMain, panelColor);
  tft.drawString("UART SERIAL BUS: ", 75, 155, 1);
  tft.setTextColor(uartActive ? COLOR_AVAILABLE : COLOR_UNAVAILABLE, panelColor);
  tft.drawString(uartActive ? "STABLE" : "DISCONNECTED", 175, 155, 1);

  // Row 6: LDR Status
  tft.setTextColor(textMain, panelColor);
  tft.drawString("AMBIENT LDR: ", 75, 175, 1);
  tft.setTextColor(ldrOnline ? COLOR_AVAILABLE : COLOR_UNAVAILABLE, panelColor);
  tft.drawString(ldrOnline ? "ACTIVE" : "LINK FAULT", 160, 175, 1);
}
#endif