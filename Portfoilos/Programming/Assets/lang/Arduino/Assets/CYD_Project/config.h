// =====================================================================
// FILE: config.h (System Configuration Hub)
// =====================================================================
#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>

// ---------------------------------------------------------------------
// 📡 USER CONFIGURATION & NETWORK CREDENTIALS
// ---------------------------------------------------------------------
const char WIFI_SSID[]     = "YOUR_WIFI_SSID";
const char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";

const String WEATHER_API_KEY = "YOUR_OPENWEATHERMAP_API_KEY";
const String WEATHER_CITY    = "Peshawar,PK"; 

// ---------------------------------------------------------------------
// 📌 HARDWARE INTERFACE PIN ASSIGNMENTS (CYD Specific)
// ---------------------------------------------------------------------
//Touch Screen
#define XPT2046_IRQ  36 
#define XPT2046_MOSI 32  
#define XPT2046_MISO 39  
#define XPT2046_CLK  25  
#define XPT2046_CS   33  
//Display Pins
#define TFT_DC       2 
#define TFT_MOSI     13  
#define TFT_MISO     12 
#define TFT_SCLK     14  
#define TFT_CS       15 
#define backlight    21
//SD Card
#define SD_MOSI      23
#define SD_MISO      19
#define SD_SCK       18
#define SD_CS         5   
// DHT Sensor
#define I2C_SDA      22  
#define I2C_SCL      27  
//RGB Led
#define RGB_RED_PIN    4
#define RGB_GREEN_PIN  16
#define RGB_BLUE_PIN   17
//Speaker Pin
#define Speaker       26
//LDR Pin
#define LDR_PIN       34
//Tx / Rx
#define TX_PIN        1
#define RX_PIN        3
// P3 Extension Pins
#define PIN_1         35
// ---------------------------------------------------------------------
// 🎨 INDUSTRIAL RGB565 HIGH-CONTRAST PALETTES
// ---------------------------------------------------------------------
#define COLOR_NIGHT_BG    0x08A3  // Deep Midnight Slate
#define COLOR_DAY_BG      0xF7F3  // Soft Neutral Light Grey
#define COLOR_PANEL_DARK  0x1A2C  // Rich Dark Charcoal
#define COLOR_PANEL_LIGHT 0xFFFF  // Crisp Studio White

#define COLOR_AVAILABLE   0x2E6E  // Emerald Green (Normal)
#define COLOR_UNAVAILABLE 0xE227  // Alizarin Red (Fault/Offline)
#define COLOR_INFO_BLUE   0x3498  // Process Blue (Data/Labels)
#define COLOR_LABEL_GREY  0x642F  // Steel Grey (Structural Borders)

// ---------------------------------------------------------------------
// 🌐 GLOBAL OBJECTS & STATE VARIABLES (Shared System Access)
// ---------------------------------------------------------------------
extern TFT_eSPI tft;
extern XPT2046_Touchscreen touchscreen;

extern int currentTab;
extern bool isNightMode;

extern unsigned long lastMetricUpdate;
extern unsigned long lastTouchTime;

#endif