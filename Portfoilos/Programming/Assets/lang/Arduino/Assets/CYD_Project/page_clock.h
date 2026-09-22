// =====================================================================
// FILE: page_clock.h (Real-Time Clock UI Module)
// =====================================================================
#ifndef PAGE_CLOCK_H
#define PAGE_CLOCK_H

#include "config.h"

// Explicit declaration tracking to prevent screen updates when values match
static String lastDrawnTime = "";
static String lastDrawnDate = "";

void drawTab_Clock() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  
  // Base Panel Canvas Creation
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  
  // Structural Header
  tft.fillRoundRect(75, 48, 225, 22, 4, COLOR_INFO_BLUE);
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString("SYSTEM CHRONOMETER", 187, 51, 2);
  
  // Force variable reset to compel immediate text drawing upon opening tab
  lastDrawnTime = "";
  lastDrawnDate = "";
}

// Called by the Master background execution loop
void updateClockDisplay(String currentTime, String currentDate, bool rtcStatus) {
  if (currentTab != 1) return; // Guard Clause: Interrupt processing if tab is hidden

  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  uint16_t defaultTextColor = isNightMode ? TFT_WHITE : TFT_BLACK;

  // 1. Time Update Processing Layer (Font 6: Large Digital Display)
  if (currentTime != lastDrawnTime) {
    // Isolate and clear text box region exactly to wipe previous characters
    tft.fillRect(75, 85, 225, 42, panelColor); 
    tft.setTextColor(COLOR_AVAILABLE, panelColor);
    tft.drawCentreString(currentTime, 187, 85, 6);
    lastDrawnTime = currentTime;
  }

  // 2. Date Update Processing Layer
  if (currentDate != lastDrawnDate) {
    tft.fillRect(75, 142, 225, 18, panelColor);
    tft.setTextColor(defaultTextColor, panelColor);
    tft.drawCentreString(currentDate, 187, 142, 2);
    lastDrawnDate = currentDate;
  }

  // 3. Static Module Telemetry Diagnostics Footer
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  if (rtcStatus) {
    tft.drawCentreString("DS3231 Hardware Link: ONLINE", 187, 198, 1);
  } else {
    tft.setTextColor(COLOR_UNAVAILABLE, panelColor);
    tft.drawCentreString("DS3231 Hardware Link: FAULT / DISCONNECTED", 187, 198, 1);
  }
}

#endif