// =====================================================================
// FILE: web_page.h (Cotrolling Online Web Page System)
// =====================================================================
// Page Defination Section
#ifndef WEB_PAGE_H
#define WEB_PAGE_H
// Include config tabs
#include "global.h"
#include "config.h"
#include "diagnostics.h"
// Include Libaraies
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <ArduinoJson.h>

//=============================================================================
// Web Server Objects
//=============================================================================
extern AsyncWebServer server;
extern AsyncWebSocket ws;

//=============================================================================
// Page Functions
//=============================================================================
void initWebPage();
void drawWebPage();
void updateWebPage();
void handleWebTouch(int16_t x, int16_t y);

//=============================================================================
// Web Server Control
//=============================================================================
bool beginWebServer();
void stopWebServer();

bool isWebServerRunning();

//=============================================================================
// WebSocket
//=============================================================================
void initWebSocket();

void notifyClients(String json);

void broadcastStatus();

void cleanupClients();

//=============================================================================
// HTTP Routes
//=============================================================================
void setupWebRoutes();

void handleRoot();

void handleNotFound();

void handleRestart();

void handleSettings();

void handleDownloadLog();

//=============================================================================
// SD Card Web Files
//=============================================================================
bool loadWebsite();

bool websiteAvailable();

//=============================================================================
// JSON Responses
//=============================================================================
String getSystemJSON();

String getSensorJSON();

String getWiFiJSON();

String getBluetoothJSON();

String getLoRaJSON();

String getDiagnosticsJSON();

//=============================================================================
// Network Information
//=============================================================================
String getIPAddress();

String getHostname();

String getMACAddress();

int getConnectedClients();

//=============================================================================
// Authentication
//=============================================================================
bool login(String username, String password);

void logout();

bool userAuthenticated();

//=============================================================================
// Configuration
//=============================================================================
bool saveWebSettings();

bool loadWebSettings();

//=============================================================================
// Status
//=============================================================================
extern bool webServerRunning;

extern bool webSocketConnected;

extern bool sdWebsiteLoaded;

extern uint16_t connectedClients;

extern String hostname;

extern uint16_t httpPort;

#endif