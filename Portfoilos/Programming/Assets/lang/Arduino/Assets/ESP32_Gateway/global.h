//=============================================================================
// FILE: global.h
// DESCRIPTION:
// Global Objects, Shared Variables & FreeRTOS Resources
//=============================================================================

#ifndef GLOBAL_H
#define GLOBAL_H

#include "config.h"

#include "wifi_page.h"
#include "bluetooth_page.h"
#include "lora_page.h"
#include "web_page.h"
#include "diagnostics.h"

#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <WiFi.h>
#include <Preferences.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>

//=============================================================================
// Global Hardware Objects
//=============================================================================

extern TFT_eSPI tft;
extern XPT2046_Touchscreen touchscreen;
extern Preferences preferences;

//=============================================================================
// System Pages
//=============================================================================

enum PageID
{
    PAGE_HOME = 0,
    PAGE_WIFI,
    PAGE_LORA,
    PAGE_WEB,
    PAGE_DIAGNOSTICS,
    PAGE_SETTINGS
};

extern PageID currentPage;

//=============================================================================
// System Status
//=============================================================================

struct SystemState
{
    float temperature;
    float humidity;

    uint16_t ldrValue;

    bool fanRunning;

    bool wifiConnected;
    bool loraRunning;
    bool webRunning;
    bool sdMounted;

    int wifiRSSI;
    int loraRSSI;

    float loraSNR;

    uint32_t packetsRX;
    uint32_t packetsTX;

    String ipAddress;
    String hostname;
};

extern SystemState systemState;

//=============================================================================
// UI
//=============================================================================

extern bool touchPressed;

extern uint32_t lastTouchTime;

extern uint32_t lastDisplayUpdate;

//=============================================================================
// Queues
//=============================================================================

extern QueueHandle_t telemetryQueue;
extern QueueHandle_t eventQueue;
extern QueueHandle_t loraQueue;

//=============================================================================
// Mutexes
//=============================================================================

extern SemaphoreHandle_t spiMutex;
extern SemaphoreHandle_t displayMutex;
extern SemaphoreHandle_t sdMutex;

//=============================================================================
// Task Handles
//=============================================================================

extern TaskHandle_t displayTaskHandle;
extern TaskHandle_t touchTaskHandle;
extern TaskHandle_t networkTaskHandle;
extern TaskHandle_t sensorTaskHandle;
extern TaskHandle_t webTaskHandle;
extern TaskHandle_t loraTaskHandle;

//=============================================================================
// Core Tasks
//=============================================================================

void vDisplayTask(void *pvParameters);

void vTouchTask(void *pvParameters);

void vSensorTask(void *pvParameters);

void vNetworkTask(void *pvParameters);

void vLoRaTask(void *pvParameters);

void vWebTask(void *pvParameters);

//=============================================================================
// Utility
//=============================================================================

void initializeGlobals();

#endif