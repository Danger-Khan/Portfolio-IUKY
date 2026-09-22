// =====================================================================
// FILE: page_storage.h (SD File System Storage Module)
// =====================================================================
#ifndef PAGE_STORAGE_H
#define PAGE_STORAGE_H

#include "config.h"

static uint32_t lastDrawnFreeSpace = 0xFFFFFFFF;

void drawTab_Storage() {
  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  uint16_t txtColor = isNightMode ? TFT_WHITE : TFT_BLACK;

  tft.fillRoundRect(65, 40, 245, 190, 8, panelColor);
  
  // Header Plate
  tft.fillRoundRect(75, 46, 225, 22, 4, tft.color565(230, 126, 34)); // Orange theme for Storage
  tft.setTextColor(TFT_WHITE);
  tft.drawCentreString("MASS STORAGE DEPLOYMENT", 187, 49, 2);

  // Static Metadata Labels
  tft.setTextColor(COLOR_LABEL_GREY, panelColor);
  tft.drawString("Interface Slot:", 80, 80, 2);
  tft.drawString("Format standard:", 80, 100, 2);
  
  tft.setTextColor(txtColor, panelColor);
  tft.drawString("SPI Bus Mode", 180, 80, 2);
  tft.drawString("Storage FileSys", 180, 100, 2);

  // Draw Storage Bar Outlines
  tft.drawRoundRect(80, 135, 215, 16, 3, COLOR_LABEL_GREY);

  lastDrawnFreeSpace = 0xFFFFFFFF;
}

void updateStorageDisplay(bool cardPresent, uint32_t totalMB, uint32_t freeMB) {
  if (currentTab != 5) return; // Guard Clause

  uint16_t panelColor = isNightMode ? COLOR_PANEL_DARK : COLOR_PANEL_LIGHT;
  uint16_t txtColor = isNightMode ? TFT_WHITE : TFT_BLACK;

  // Return early if the hardware detection fails
  if (!cardPresent) {
    tft.fillRect(80, 125, 215, 60, panelColor);
    tft.setTextColor(COLOR_UNAVAILABLE, panelColor);
    tft.drawCentreString("NO SD CARD DETECTED", 187, 145, 2);
    return;
  }

  if (freeMB != lastDrawnFreeSpace) {
    uint32_t usedMB = totalMB - freeMB;
    
    // Mathematically derive scaling factor for horizontal consumption bar (Max 211 px wide)
    int fillWidth = map(usedMB, 0, totalMB, 0, 211);
    
    // Clear inner progress canvas bar area before drawing fill adjustments
    tft.fillRect(82, 137, 211, 12, panelColor);
    tft.fillRect(82, 137, fillWidth, 12, COLOR_INFO_BLUE);

    // Contextual Readout Footer Generation
    tft.fillRect(80, 165, 215, 30, panelColor);
    tft.setTextColor(txtColor, panelColor);
    
    String diskMetrics = "Used: " + String((float)usedMB/1024.0, 1) + "GB / " + String((float)totalMB/1024.0, 1) + "GB";
    tft.drawCentreString(diskMetrics, 187, 165, 2);
    
    tft.setTextColor(COLOR_AVAILABLE, panelColor);
    tft.drawCentreString("System Logging: ACTIVE", 187, 185, 1);
    
    lastDrawnFreeSpace = freeMB;
  }
}

#endif