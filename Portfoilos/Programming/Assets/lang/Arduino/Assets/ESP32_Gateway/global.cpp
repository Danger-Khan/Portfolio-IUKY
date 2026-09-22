//=============================================================================
// FILE: global.cpp
//=============================================================================

#include "global.h"

//=============================================================================
// Hardware Objects
//=============================================================================

TFT_eSPI tft = TFT_eSPI();

XPT2046_Touchscreen touchscreen(XPT2046_CS, XPT2046_IRQ);

Preferences preferences;

//=============================================================================
// Current Page
//=============================================================================

PageID currentPage = PAGE_HOME;

//=============================================================================
// System State
//=============================================================================

SystemState systemState =
{
    0.0,
    0.0,

    0.0,
    0,

    0,

    false,

    false,
    false,
    false,
    false,
    false,

    0,
    0,

    0.0,

    0,
    0,

    "",
    "ESP32-Gateway"
};

//=============================================================================
// UI
//=============================================================================

bool touchPressed = false;

uint32_t lastTouchTime = 0;

uint32_t lastDisplayUpdate = 0;

//=============================================================================
// Queues
//=============================================================================

QueueHandle_t telemetryQueue = NULL;

QueueHandle_t eventQueue = NULL;

QueueHandle_t loraQueue = NULL;

//=============================================================================
// Mutexes
//=============================================================================

SemaphoreHandle_t spiMutex = NULL;

SemaphoreHandle_t displayMutex = NULL;

SemaphoreHandle_t sdMutex = NULL;

//=============================================================================
// Task Handles
//=============================================================================

TaskHandle_t displayTaskHandle = NULL;

TaskHandle_t touchTaskHandle = NULL;

TaskHandle_t sensorTaskHandle = NULL;

TaskHandle_t networkTaskHandle = NULL;

TaskHandle_t webTaskHandle = NULL;

TaskHandle_t loraTaskHandle = NULL;

//=============================================================================
// Initialize Global Resources
//=============================================================================

void initializeGlobals()
{
    telemetryQueue = xQueueCreate(20, sizeof(SystemState));

    eventQueue = xQueueCreate(20, sizeof(String));

    loraQueue = xQueueCreate(20, sizeof(LoRaPacket));

    spiMutex = xSemaphoreCreateMutex();

    displayMutex = xSemaphoreCreateMutex();

    sdMutex = xSemaphoreCreateMutex();
}