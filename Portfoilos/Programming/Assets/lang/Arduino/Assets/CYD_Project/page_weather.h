// =====================================================================
// FILE: page_weather.h (Meteorological Telemetry Module)
// =====================================================================
#ifndef PAGE_WEATHER_H
#define PAGE_WEATHER_H

#include "config.h"

static float  lastDrawnOutTemp = -999.0;
static String lastDrawnCond    = "";
static int    lastDrawnWind    = -1;

void drawTab_Weather() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  uint16_t defaultTextColor = isNightMode ? TFT_WHITE : TFT_BLACK;

  // Render Base Canvas Cover
  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  
  // Header Plate
  tft.fillRoundRect(75, 46, 225, 22, 4, COLOR_INFO_BLUE);
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString(WEATHER_CITY + " LIVE METAR", 187, 49, 2);
  
  // Grid Lines for Data Segments
  tft.drawFastHLine(75, 132, 225, COLOR_LABEL_GREY);
  tft.drawFastVLine(187, 137, 50, COLOR_LABEL_GREY);

  // Structural Labels
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  tft.drawString("WIND SPEED", 85, 142, 1);
  tft.drawString("BARO PRESSURE", 197, 142, 1);

  lastDrawnOutTemp = -999.0;
  lastDrawnCond    = "";
  lastDrawnWind    = -1;
}

void updateWeatherDisplay(float outdoorTemp, String condition, int windSpeed, int pressure) {
  if (currentTab != 4) return; // Guard Clause

  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  //uint16_t txtColor = isNightMode ? TFT_WHITE : TFT_BLACK;

  // 1. Dynamic Primary Temperature Window (Font 4)
  if (outdoorTemp != lastDrawnOutTemp) {
    tft.fillRect(75, 78, 105, 30, panelColor);
    tft.setTextColor(COLOR_AVAILABLE, panelColor);
    tft.drawString(String(outdoorTemp, 1) + " C", 85, 82, 4);
    lastDrawnOutTemp = outdoorTemp;
  }

  // 2. Weather Status Condition Banner
  if (condition != lastDrawnCond) {
    tft.fillRect(75, 110, 225, 16, panelColor);
    tft.setTextColor(txtColor, panelColor);
    tft.drawString("Sky: " + condition, 85, 110, 2);
    lastDrawnCond = condition;
  }

  // 3. Dynamic Sub-Metrics (Wind / Barometer)
  if (windSpeed != lastDrawnWind) {
    tft.fillRect(85, 158, 90, 20, panelColor);
    tft.fillRect(197, 158, 90, 20, panelColor);

    tft.setTextColor(txtColor, panelColor);
    tft.drawString(String(windSpeed) + " m/s", 85, 158, 2);
    tft.drawString(String(pressure) + " hPa", 197, 158, 2);
    lastDrawnWind = windSpeed;
  }
}

#endif