// =====================================================================
// FILE: page_env.h (Atmospheric Sensor UI Module)
// =====================================================================
#ifndef PAGE_ENV_H
#define PAGE_ENV_H

#include "config.h"

static float lastDrawnTemp = -999.0;
static float lastDrawnHum  = -999.0;

void drawTab_Environment() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  
  // Custom Card Background Tones tailored for Day/Night balance
  uint16_t tCardBg = isNightMode ? tft.color565(45, 30, 35) : tft.color565(255, 235, 235); // Crimson Tint
  uint16_t hCardBg = isNightMode ? tft.color565(20, 35, 50) : tft.color565(230, 242, 255); // Teal Tint
  
  // --- SUB PANEL LEFT: TEMPERATURE ---
  tft.fillRoundRect(73, 50, 107, 125, 6, tCardBg);
  tft.drawRoundRect(73, 50, 107, 125, 6, COLOR_LABEL_GREY);
  tft.setTextColor(isNightMode ? tft.color565(250, 100, 100) : tft.color565(180, 20, 20));
  tft.drawCentreString("TEMPERATURE", 126, 60, 1);
  
  // --- SUB PANEL RIGHT: HUMIDITY ---
  tft.fillRoundRect(190, 50, 107, 125, 6, hCardBg);
  tft.drawRoundRect(190, 50, 107, 125, 6, COLOR_LABEL_GREY);
  tft.setTextColor(COLOR_INFO_BLUE);
  tft.drawCentreString("HUMIDITY", 243, 60, 1);
  
  // Hardware Attribution footer
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  tft.drawCentreString("Telemetry Node: DHT11 (AM2302)", 187, 198, 1);
  
  lastDrawnTemp = -999.0;
  lastDrawnHum  = -999.0;
}

// Called by the Master background execution loop
void updateEnvDisplay(float currentTemp, float currentHum) {
  if (currentTab != 2) return; // Guard Clause: Interrupt processing if tab is hidden

  uint16_t tCardBg = isNightMode ? tft.color565(45, 30, 35) : tft.color565(255, 235, 235);
  uint16_t hCardBg = isNightMode ? tft.color565(20, 35, 50) : tft.color565(230, 242, 255);

  // 1. Dynamic Temperature Readout Generation (Font 4)
  if (currentTemp != lastDrawnTemp) {
    tft.fillRect(78, 95, 97, 35, tCardBg); // Clean sub-card content block
    tft.setTextColor(isNightMode ? TFT_WHITE : tft.color565(60, 10, 10), tCardBg);
    
    String tempBuffer = String(currentTemp, 1) + " C"; 
    tft.drawCentreString(tempBuffer, 126, 100, 4);
    lastDrawnTemp = currentTemp;
  }

  // 2. Dynamic Humidity Readout Generation (Font 4)
  if (currentHum != lastDrawnHum) {
    tft.fillRect(195, 95, 97, 35, hCardBg);
    tft.setTextColor(isNightMode ? TFT_WHITE : tft.color565(10, 30, 60), hCardBg);
    
    String humBuffer = String(currentHum, 0) + " %"; 
    tft.drawCentreString(humBuffer, 243, 100, 4);
    lastDrawnHum = currentHum;
  }
}

#endif