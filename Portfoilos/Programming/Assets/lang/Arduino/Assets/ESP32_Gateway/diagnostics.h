// ============================================================================
// FILE: diagnostics.h
// DESCRIPTION:
// System Diagnostics & Performance Monitor
// ESP32 CYD Gateway Project
// ============================================================================

#ifndef DIAGNOSTICS_H
#define DIAGNOSTICS_H

#include <Arduino.h>
#include <WiFi.h>
#include <vector>

//=============================================================================
// System Statistics
//=============================================================================
struct SystemDiagnostics
{
    uint32_t uptime;

    uint32_t freeHeap;
    uint32_t minFreeHeap;
    uint32_t heapSize;

    uint32_t flashSize;
    uint32_t sketchSize;

    uint32_t cpuFrequency;

    float cpuTemperature;

    float batteryVoltage;
    uint8_t batteryPercent;

    uint16_t ldrValue;

    bool sdMounted;
    bool wifiConnected;
    bool bluetoothEnabled;
    bool loraConnected;
    bool webServerRunning;
    bool fanRunning;

    int wifiRSSI;
    int loraRSSI;
    float loraSNR;

    uint32_t packetsRX;
    uint32_t packetsTX;

    uint32_t wifiClients;
};

//=============================================================================
// Event Log
//=============================================================================
struct DiagnosticEvent
{
    uint32_t timestamp;
    String event;
};

extern SystemDiagnostics systemStatus;
extern std::vector<DiagnosticEvent> eventLog;

//=============================================================================
// Page Functions
//=============================================================================
void initDiagnosticsPage();

void drawDiagnosticsPage();

void updateDiagnosticsPage();

void handleDiagnosticsTouch(int16_t x, int16_t y);

//=============================================================================
// System Monitor
//=============================================================================
void updateSystemStatus();

void updateMemoryStatus();

void updateCPUStatus();

void updateBatteryStatus();

void updateStorageStatus();

void updateWiFiStatus();

void updateBluetoothStatus();

void updateLoRaStatus();

void updateFanStatus();

//=============================================================================
// Logging
//=============================================================================
void addDiagnosticEvent(String message);

void clearDiagnosticLog();

bool saveDiagnosticLog();

bool loadDiagnosticLog();

//=============================================================================
// Performance
//=============================================================================
uint32_t getFreeHeap();

uint32_t getMinimumHeap();

uint32_t getHeapSize();

uint32_t getFlashSize();

uint32_t getSketchSize();

uint32_t getCPUFrequency();

float getCPUTemperature();

//=============================================================================
// Battery
//=============================================================================
float getBatteryVoltage();

uint8_t getBatteryPercentage();

//=============================================================================
// Sensors
//=============================================================================
uint16_t getLDRValue();

//=============================================================================
// Network Statistics
//=============================================================================
int getWiFiRSSI();

int getLoRaRSSI();

float getLoRaSNR();

uint32_t getPacketsRX();

uint32_t getPacketsTX();

//=============================================================================
// SD Card
//=============================================================================
bool isSDMounted();

uint64_t getSDTotalSpace();

uint64_t getSDUsedSpace();

uint64_t getSDFreeSpace();

//=============================================================================
// Export
//=============================================================================
bool exportDiagnosticsCSV();

bool exportDiagnosticsJSON();

//=============================================================================
// System Control
//=============================================================================
void restartESP32();

void factoryReset();

//=============================================================================
// Status Flags
//=============================================================================
extern bool diagnosticsRunning;

#endif