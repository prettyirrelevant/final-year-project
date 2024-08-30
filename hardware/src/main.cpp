#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEServer.h>
#include <NimBLEUtils.h>
#include <NimBLECharacteristic.h>
#include <ArduinoJson.h>
#include <map>
#include <vector>

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID_CREATE_ATTENDANCE "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_UUID_MARK_ATTENDANCE "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define CHAR_UUID_RETRIEVE_ATTENDANCES "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define CHAR_UUID_RETRIEVE_SESSIONS "beb5483f-36e1-4688-b7f5-ea07361b26ab"

#define MAX_SESSIONS 5

NimBLEServer *pServer = nullptr;
NimBLECharacteristic *pCreateAttendanceCharacteristic = nullptr;
NimBLECharacteristic *pMarkAttendanceCharacteristic = nullptr;
NimBLECharacteristic *pRetrieveAttendancesCharacteristic = nullptr;
NimBLECharacteristic *pRetrieveSessionsCharacteristic = nullptr;

struct AttendanceRecord
{
    String name;
    String matricNumber;
    unsigned long timestamp;
};

struct AttendanceSession
{
    String courseCode;
    String courseName;
    unsigned long expiryTimestamp;
};

std::map<String, AttendanceSession> sessions;
std::map<String, std::vector<AttendanceRecord>> markedAttendances;

void logJson(const JsonDocument& doc, const char* label) {
    String output;
    serializeJson(doc, output);
    Serial.print(label);
    Serial.println(output);
}

String createResponse(bool success, const String &message)
{
    Serial.println("Creating response:");
    Serial.print("Success: ");
    Serial.println(success);
    Serial.print("Message: ");
    Serial.println(message);

    JsonDocument doc;
    doc["success"] = success;
    doc["message"] = message;
    String response;
    serializeJson(doc, response);

    Serial.print("Response JSON: ");
    Serial.println(response);

    return response;
}

void removeExpiredSessions()
{
    Serial.println("Checking for expired sessions...");
    unsigned long currentTime = millis();
    for (auto it = sessions.begin(); it != sessions.end();)
    {
        Serial.print("Checking session: ");
        Serial.println(it->first);
        Serial.print("Current time: ");
        Serial.print(currentTime);
        Serial.print(", Expiry time: ");
        Serial.println(it->second.expiryTimestamp);

        if (it->second.expiryTimestamp <= currentTime)
        {
            Serial.print("Removing expired session: ");
            Serial.println(it->first);
            markedAttendances.erase(it->first);
            it = sessions.erase(it);
        }
        else
        {
            ++it;
        }
    }
    Serial.print("Remaining active sessions: ");
    Serial.println(sessions.size());
}

class ServerCallbacks : public NimBLEServerCallbacks
{
    void onConnect(NimBLEServer *pServer)
    {
        Serial.println("Client connected");
        pServer->startAdvertising();
        Serial.println("Restarted advertising");
    };

    void onDisconnect(NimBLEServer *pServer)
    {
        Serial.println("Client disconnected");
        pServer->startAdvertising();
        Serial.println("Restarted advertising");
    }
};

class CreateAttendanceCallback : public NimBLECharacteristicCallbacks
{
    void onWrite(NimBLECharacteristic *pCharacteristic)
    {
        Serial.println("CreateAttendanceCallback: onWrite called");
        std::string value = pCharacteristic->getValue();
        Serial.print("Received value: ");
        Serial.println(value.c_str());

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, value);

        if (error)
        {
            Serial.print("Failed to parse JSON: ");
            Serial.println(error.c_str());
            return;
        }

        logJson(doc, "Parsed JSON: ");

        String sessionId = doc["sessionId"].as<String>();
        String courseCode = doc["courseCode"].as<String>();
        String courseName = doc["courseName"].as<String>();
        unsigned long expiryTimestamp = doc["expiryTimestamp"].as<unsigned long>();

        Serial.print("Session ID: ");
        Serial.println(sessionId);
        Serial.print("Course Code: ");
        Serial.println(courseCode);
        Serial.print("Course Name: ");
        Serial.println(courseName);
        Serial.print("Expiry Timestamp: ");
        Serial.println(expiryTimestamp);

        if (sessions.size() >= MAX_SESSIONS)
        {
            Serial.println("Maximum number of sessions reached");
            return;
        }

        AttendanceSession newSession = {courseCode, courseName, expiryTimestamp};
        sessions[sessionId] = newSession;

        Serial.println("New attendance session created successfully");
        Serial.print("Total active sessions: ");
        Serial.println(sessions.size());
    }
};

class MarkAttendanceCallback : public NimBLECharacteristicCallbacks
{
    void onWrite(NimBLECharacteristic *pCharacteristic)
    {
        Serial.println("MarkAttendanceCallback: onWrite called");
        std::string value = pCharacteristic->getValue();
        Serial.print("Received value: ");
        Serial.println(value.c_str());

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, value);

        if (error)
        {
            Serial.print("Failed to parse JSON: ");
            Serial.println(error.c_str());
            return;
        }

        logJson(doc, "Parsed JSON: ");

        String sessionId = doc["sessionId"].as<String>();
        String studentName = doc["name"].as<String>();
        String matricNumber = doc["matricNumber"].as<String>();
        unsigned long timestamp = doc["timestamp"].as<unsigned long>();

        Serial.print("Session ID: ");
        Serial.println(sessionId);
        Serial.print("Student Name: ");
        Serial.println(studentName);
        Serial.print("Matric Number: ");
        Serial.println(matricNumber);
        Serial.print("Timestamp: ");
        Serial.println(timestamp);

        if (sessions.find(sessionId) != sessions.end())
        {
            AttendanceSession &session = sessions[sessionId];
            Serial.print("Session found. Expiry timestamp: ");
            Serial.println(session.expiryTimestamp);

            if (timestamp <= session.expiryTimestamp)
            {
                AttendanceRecord record = {studentName, matricNumber, timestamp};
                markedAttendances[sessionId].push_back(record);
                Serial.println("Attendance marked successfully");
                Serial.print("Total attendances for this session: ");
                Serial.println(markedAttendances[sessionId].size());
            }
            else
            {
                Serial.println("Attendance session has expired");
            }
        }
        else
        {
            Serial.println("No active attendance session found for this ID");
        }
    }
};

class RetrieveAttendancesCallback : public NimBLECharacteristicCallbacks
{
    void onRead(NimBLECharacteristic *pCharacteristic)
    {
        Serial.println("RetrieveAttendancesCallback: onRead called");

        JsonDocument doc;
        JsonObject sessionsObj = doc.to<JsonObject>();

        for (const auto &pair : sessions)
        {
            JsonObject sessionObj = sessionsObj[pair.first].to<JsonObject>();
            sessionObj["sessionId"] = pair.first;
            sessionObj["courseCode"] = pair.second.courseCode;
            sessionObj["courseName"] = pair.second.courseName;
            sessionObj["expiryTimestamp"] = pair.second.expiryTimestamp;

            JsonArray attendancesArray = sessionObj["attendances"].to<JsonArray>();
            const auto &sessionAttendances = markedAttendances[pair.first];
            for (const auto &record : sessionAttendances)
            {
                JsonObject recordObj = attendancesArray.add<JsonObject>();
                recordObj["name"] = record.name;
                recordObj["matricNumber"] = record.matricNumber;
                recordObj["timestamp"] = record.timestamp;
            }
        }

        String attendancesJson;
        serializeJson(doc, attendancesJson);

        Serial.println("Retrieved attendances:");
        Serial.println(attendancesJson);

        pCharacteristic->setValue(attendancesJson);
    }
};

class RetrieveSessionsCallback : public NimBLECharacteristicCallbacks
{
    void onRead(NimBLECharacteristic *pCharacteristic)
    {
        Serial.println("RetrieveSessionsCallback: onRead called");

        JsonDocument doc;
        JsonArray sessionsArray = doc.to<JsonArray>();

        for (const auto &pair : sessions)
        {
            JsonObject sessionObj = sessionsArray.add<JsonObject>();
            sessionObj["sessionId"] = pair.first;
            sessionObj["courseCode"] = pair.second.courseCode;
            sessionObj["courseName"] = pair.second.courseName;
            sessionObj["expiryTimestamp"] = pair.second.expiryTimestamp;
        }

        String sessionsJson;
        serializeJson(doc, sessionsJson);

        Serial.println("Retrieved sessions:");
        Serial.println(sessionsJson);

        pCharacteristic->setValue(sessionsJson);
    }
};

void setup()
{
    Serial.begin(115200);
    Serial.println("Starting BLE Attendance System!");

    NimBLEDevice::init("ESP32-Attendance");
    Serial.println("NimBLE initialized");

    pServer = NimBLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());
    Serial.println("Server created with callbacks");

    NimBLEService *pService = pServer->createService(SERVICE_UUID);
    Serial.println("Service created");

    pCreateAttendanceCharacteristic = pService->createCharacteristic(
        CHAR_UUID_CREATE_ATTENDANCE,
        NIMBLE_PROPERTY::WRITE_NR | NIMBLE_PROPERTY::WRITE);
    pCreateAttendanceCharacteristic->setCallbacks(new CreateAttendanceCallback());
    Serial.println("Create Attendance characteristic set up");

    pMarkAttendanceCharacteristic = pService->createCharacteristic(
        CHAR_UUID_MARK_ATTENDANCE,
        NIMBLE_PROPERTY::WRITE_NR | NIMBLE_PROPERTY::WRITE);
    pMarkAttendanceCharacteristic->setCallbacks(new MarkAttendanceCallback());
    Serial.println("Mark Attendance characteristic set up");

    pRetrieveAttendancesCharacteristic = pService->createCharacteristic(
        CHAR_UUID_RETRIEVE_ATTENDANCES,
        NIMBLE_PROPERTY::READ);
    pRetrieveAttendancesCharacteristic->setCallbacks(new RetrieveAttendancesCallback());
    Serial.println("Retrieve Attendances characteristic set up");

    pRetrieveSessionsCharacteristic = pService->createCharacteristic(
        CHAR_UUID_RETRIEVE_SESSIONS,
        NIMBLE_PROPERTY::READ);
    pRetrieveSessionsCharacteristic->setCallbacks(new RetrieveSessionsCallback());
    Serial.println("Retrieve Sessions characteristic set up");

    pService->start();
    Serial.println("Service started");

    NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMaxPreferred(0x12);
    pAdvertising->start();
    Serial.println("Advertising started");

    Serial.println("BLE Attendance System is ready!");
}

void loop()
{
    delay(2000);
    // Serial.println("Loop iteration");
    // removeExpiredSessions();
}
