#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

#define IR_PIN 3
#define FAN_PIN 5

WebServer server(80);

bool printerHomed = false;

unsigned long triggerStart = 0;
bool sensorTriggered = false;

String getHTML()
{
  String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="1">
<title>3D Printer Status</title>

<style>
body {
  font-family: Arial;
  text-align: center;
  background: #111;
  color: white;
  padding-top: 50px;
}

.card {
  width: 300px;
  margin: auto;
  padding: 20px;
  background: #222;
  border-radius: 10px;
}

.ok {
  color: lime;
  font-size: 32px;
}

.warn {
  color: red;
  font-size: 32px;
}
</style>
</head>

<body>

<div class="card">

<h1>3D Printer</h1>
)rawliteral";

  if(printerHomed)
  {
    html += "<p class='ok'>HOMED / PRINT COMPLETE</p>";
  }
  else
  {
    html += "<p class='warn'>PRINTING</p>";
  }

  html += R"rawliteral(
</div>

</body>
</html>
)rawliteral";

  return html;
}

void handleRoot()
{
  server.send(200, "text/html", getHTML());
}

void setup()
{
  Serial.begin(115200);

  pinMode(IR_PIN, INPUT);
  pinMode(FAN_PIN, OUTPUT);

  // Set initial state for the fan
  digitalWrite(FAN_PIN, HIGH);

  WiFi.begin(ssid, password);

  Serial.print("Connecting");

  while(WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Connected");

  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.begin();
}

void loop()
{
  server.handleClient();

  bool sensorState = digitalRead(IR_PIN);

  // Assuming active-low IR sensor
  if(sensorState == LOW)
  {
    if(!sensorTriggered)
    {
      sensorTriggered = true;
      triggerStart = millis(); // Start the 5-second timer
    }

    // Check if 5 seconds have passed since triggered
    if((millis() - triggerStart) > 5000)
    {
      printerHomed = true;
      digitalWrite(FAN_PIN, LOW);
    }
  }
  else
  {
    // Reset everything if the sensor is no longer triggered
    sensorTriggered = false;
    printerHomed = false;
    digitalWrite(FAN_PIN, HIGH);
  }
}