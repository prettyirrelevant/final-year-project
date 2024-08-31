import { formatDistanceToNow } from "date-fns";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BleManager, Device } from "react-native-ble-plx";
import {
  Avatar,
  Button,
  Card,
  Divider,
  Paragraph,
  TextInput,
  Title,
} from "react-native-paper";
import Share from "react-native-share";

import {
  formatDateTime,
  generateStudentAttendanceFilename,
  now,
} from "../utils/helpers";
import { requestBlePermissions } from "../utils/permission";
import LogoutButton from "./LogoutButton";

const SCAN_TIMEOUT = 10000;
const DEVICE_NAME = "ESP32-Attendance";
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_UUID_CREATE_ATTENDANCE = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CHAR_UUID_RETRIEVE_ATTENDANCES = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

interface AttendanceRecord {
  studentName: string;
  matricNumber: string;
  timestamp: number;
}

interface AttendanceSession {
  sessionId: string;
  courseCode: string;
  courseName: string;
  createdAt: number;
  records: AttendanceRecord[];
}

interface LecturerAttendanceScreenProps {
  bleManager: BleManager;
  lecturerName: string;
  lecturerEmail: string;
  showToast: (message: string, type?: "success" | "error") => void;
  onLogout: () => Promise<void>;
  saveAttendanceSession: (sessionData: {
    sessionId: string;
    lecturerEmail: string;
    courseCode: string;
    courseName: string;
    records: AttendanceRecord[];
  }) => Promise<void>;
  fetchAttendanceSessions: (
    lecturerEmail: string
  ) => Promise<AttendanceSession[]>;
}

const LecturerAttendanceScreen: React.FC<LecturerAttendanceScreenProps> = ({
  bleManager,
  lecturerName,
  lecturerEmail,
  showToast,
  onLogout,
  saveAttendanceSession,
  fetchAttendanceSessions,
}) => {
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "scanning" | "connecting" | "connected"
  >("disconnected");
  const [device, setDevice] = useState<Device | null>(null);
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState("60");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isFetchingSessions, setIsFetchingSessions] = useState(false);
  const [attendanceSessions, setAttendanceSessions] = useState<
    AttendanceSession[]
  >([]);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  useEffect(() => {
    const subscription = device?.onDisconnected(() => {
      console.log("Device disconnected");
      setConnectionState("disconnected");
      setDevice(null);
      showToast("Device disconnected", "error");
    });

    return () => {
      console.log("Component unmounting, cleaning up BLE");
      subscription?.remove();
      bleManager.stopDeviceScan();
      device?.cancelConnection();
    };
  }, [bleManager, device, showToast]);

  const resetConnection = useCallback(() => {
    setConnectionState("disconnected");
    setDevice(null);
    bleManager.stopDeviceScan();
  }, [bleManager]);

  const scanAndConnect = useCallback(async () => {
    if (connectionState !== "disconnected") {
      console.log(
        "Already in connection process. Current state:",
        connectionState
      );
      return;
    }

    const permissionsGranted = await requestBlePermissions();
    if (!permissionsGranted) {
      showToast("Bluetooth permissions not granted", "error");
      return;
    }

    setConnectionState("scanning");
    console.log("Starting scan");

    const scanTimeout = setTimeout(() => {
      console.log("Scan timeout reached");
      resetConnection();
      showToast("Scan timed out. No device found.", "error");
    }, SCAN_TIMEOUT);

    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error("Scan error:", error);
        clearTimeout(scanTimeout);
        resetConnection();
        showToast("Failed to scan for devices", "error");
        return;
      }

      if (scannedDevice && scannedDevice.name === DEVICE_NAME) {
        console.log("Found target device:", DEVICE_NAME);
        bleManager.stopDeviceScan();
        clearTimeout(scanTimeout);

        setConnectionState("connecting");
        scannedDevice
          .connect({ requestMTU: 512 })
          .then((connectedDevice) =>
            connectedDevice.discoverAllServicesAndCharacteristics()
          )
          .then((discoveredDevice) => {
            console.log("Connected and discovered services");
            setDevice(discoveredDevice);
            setConnectionState("connected");
            showToast("Connected to ESP32-Attendance", "success");
          })
          .catch((connectError) => {
            console.error("Connection error:", connectError);
            resetConnection();
            showToast("Failed to connect to ESP32-Attendance", "error");
          });
      }
    });
  }, [bleManager, connectionState, resetConnection, showToast]);

  const retrieveAttendances = useCallback(async () => {
    setIsFetchingSessions(true);
    try {
      // Fetch sessions from the local database
      const localSessions = await fetchAttendanceSessions(lecturerEmail);

      // If connected to the device, try to update with the latest records
      if (device && connectionState === "connected") {
        try {
          const characteristic = await device.readCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUID_RETRIEVE_ATTENDANCES
          );
          if (characteristic.value) {
            const decodedValue = atob(characteristic.value);
            const deviceData = JSON.parse(decodedValue);
            console.log("Data from server:", deviceData);
            console.log("Data from local database:", localSessions);

            const updatedSessions = await Promise.all(
              Object.entries(deviceData).map(
                async ([sessionId, sessionData]: [string, any]) => {
                  const localSession = localSessions.find(
                    (s) => s.sessionId === sessionId
                  );
                  const updatedRecords: AttendanceRecord[] =
                    sessionData.attendances.map((record: any) => ({
                      studentName: record.name,
                      matricNumber: record.matricNumber,
                      timestamp: record.timestamp,
                    }));

                  // Update the local database with new records
                  await saveAttendanceSession({
                    sessionId,
                    lecturerEmail,
                    courseCode: sessionData.courseCode,
                    courseName: sessionData.courseName,
                    records: updatedRecords,
                  });

                  return {
                    sessionId,
                    courseCode: sessionData.courseCode,
                    courseName: sessionData.courseName,
                    createdAt: localSession
                      ? localSession.createdAt
                      : Date.now(),
                    records: updatedRecords,
                  };
                }
              )
            );

            // Merge updated sessions with local sessions
            const mergedSessions = [
              ...updatedSessions,
              ...localSessions.filter(
                (local) =>
                  !updatedSessions.some(
                    (updated) => updated.sessionId === local.sessionId
                  )
              ),
            ];

            setAttendanceSessions(mergedSessions);
          } else {
            console.log("No data from BLE server, using local sessions");
            setAttendanceSessions(localSessions);
          }
        } catch (bleError) {
          console.error("Error reading from BLE device:", bleError);
          console.log("Using local sessions due to BLE error");
          setAttendanceSessions(localSessions);
        }
      } else {
        console.log("Device not connected, using local sessions");
        setAttendanceSessions(localSessions);
      }

      showToast("Attendances retrieved successfully", "success");
    } catch (error) {
      console.error("Retrieve attendances error:", error);
      showToast("Failed to retrieve attendances", "error");
    } finally {
      setIsFetchingSessions(false);
    }
  }, [
    device,
    connectionState,
    showToast,
    fetchAttendanceSessions,
    lecturerEmail,
    saveAttendanceSession,
  ]);

  const createAttendanceSession = useCallback(() => {
    if (!device || connectionState !== "connected") {
      showToast("Device not connected", "error");
      return;
    }

    const expiryMinutesNum = parseInt(expiryMinutes, 10);
    if (isNaN(expiryMinutesNum) || expiryMinutesNum < 5) {
      showToast("Expiry time must be at least 5 minutes", "error");
      return;
    }

    setIsCreatingSession(true);
    const sessionId = `${courseName}-${courseCode}-${now()}`;
    const data = JSON.stringify({
      sessionId,
      courseCode,
      courseName,
      expiryTimestamp: now() + expiryMinutesNum * 60,
    });

    device
      .writeCharacteristicWithoutResponseForService(
        SERVICE_UUID,
        CHAR_UUID_CREATE_ATTENDANCE,
        btoa(data)
      )
      .then(() => {
        showToast("Attendance session created successfully", "success");

        // Save the attendance session to the local database
        saveAttendanceSession({
          sessionId,
          lecturerEmail,
          courseCode,
          courseName,
          records: [], // Initially empty, will be populated as students mark attendance
        });

        setCourseCode("");
        setCourseName("");
        setExpiryMinutes("15");
        retrieveAttendances();
      })
      .catch((error) => {
        console.error("Create session error:", error);
        showToast("Failed to create attendance session", "error");
      })
      .finally(() => {
        setIsCreatingSession(false);
      });
  }, [
    device,
    connectionState,
    courseCode,
    courseName,
    expiryMinutes,
    showToast,
    lecturerEmail,
    saveAttendanceSession,
    retrieveAttendances,
  ]);

  const exportSessionAsCSV = useCallback(
    async (session: AttendanceSession) => {
      setIsExporting(session.sessionId);
      try {
        const headers = "Matric Number,Course Code,Timestamp\n";
        const rows = session.records
          .map(
            (record) =>
              `${record.matricNumber},${session.courseCode},${formatDateTime(
                record.timestamp
              )}`
          )
          .join("\n");
        const csvContent = headers + rows;

        const shareOptions = {
          title: "Export Attendance",
          message: "Attendance Record",
          url: `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`,
          filename: generateStudentAttendanceFilename(
            session.courseCode,
            session.createdAt,
            "lecturer"
          ),
          failOnCancel: false,
        };

        try {
          await Share.open(shareOptions);
        } catch (error) {
          console.error("Error exporting attendance:", error);
          showToast("Failed to export attendance", "error");
        }

        // Here you would typically use a library or API to save or share the file
        console.log("CSV Content:", csvContent);

        showToast(
          `CSV for session ${session.courseCode} generated successfully`,
          "success"
        );
      } catch (error) {
        console.error("Export error:", error);
        showToast(
          `Failed to generate CSV for session ${session.courseCode}`,
          "error"
        );
      } finally {
        setIsExporting(null);
      }
    },
    [showToast]
  );

  const renderAttendanceSession = (session: AttendanceSession) => {
    const formattedDate = formatDistanceToNow(new Date(session.createdAt), {
      includeSeconds: true,
      addSuffix: true,
    });
    const attendeeCount = session.records.length;

    return (
      <Card key={session.sessionId} style={styles.sessionCard}>
        <Card.Content>
          <View style={styles.sessionHeader}>
            <Avatar.Text size={40} label={session.courseCode.substring(0, 2)} />
            <View style={styles.sessionInfo}>
              <Title style={styles.sessionTitle}>{session.courseName}</Title>
              <Paragraph style={styles.sessionSubtitle}>
                {session.courseCode}
              </Paragraph>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.sessionDetails}>
            <Paragraph style={styles.sessionDate}>{formattedDate}</Paragraph>
            <Paragraph style={styles.attendeeCount}>
              {attendeeCount} attendee{attendeeCount !== 1 ? "s" : ""}
            </Paragraph>
          </View>
          <Button
            mode="outlined"
            onPress={() => exportSessionAsCSV(session)}
            disabled={isExporting !== null}
            loading={isExporting === session.sessionId}
            style={styles.exportButton}
          >
            {isExporting === session.sessionId ? "Exporting..." : "Export CSV"}
          </Button>
        </Card.Content>
      </Card>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Lecturer Information</Title>
            <Paragraph>
              Name:{" "}
              <Paragraph style={styles.boldText}>{lecturerName}</Paragraph>
            </Paragraph>
            <Paragraph>
              Email:{" "}
              <Paragraph style={styles.boldText}>{lecturerEmail}</Paragraph>
            </Paragraph>
            <Paragraph
              style={
                connectionState === "connected"
                  ? styles.connectedText
                  : styles.disconnectedText
              }
            >
              Bluetooth Status: {connectionState}
            </Paragraph>
            <Button
              mode="contained"
              onPress={
                connectionState === "disconnected"
                  ? scanAndConnect
                  : resetConnection
              }
              style={styles.actionButton}
              disabled={
                connectionState === "scanning" ||
                connectionState === "connecting"
              }
              loading={
                connectionState === "scanning" ||
                connectionState === "connecting"
              }
            >
              {connectionState === "disconnected"
                ? "Connect to Device"
                : connectionState === "scanning"
                ? "Scanning..."
                : connectionState === "connecting"
                ? "Connecting..."
                : "Disconnect"}
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Create Attendance Session</Title>
            <TextInput
              label="Course Code"
              value={courseCode}
              onChangeText={setCourseCode}
              style={styles.input}
              disabled={connectionState !== "connected"}
            />
            <TextInput
              label="Course Name"
              value={courseName}
              onChangeText={setCourseName}
              style={styles.input}
              disabled={connectionState !== "connected"}
            />
            <TextInput
              label="Expiry Time (minutes)"
              value={expiryMinutes}
              onChangeText={setExpiryMinutes}
              keyboardType="numeric"
              style={styles.input}
              disabled={connectionState !== "connected"}
            />
            <Paragraph style={styles.helperText}>
              Minimum expiry time is 5 minutes
            </Paragraph>
            <Button
              mode="contained"
              onPress={createAttendanceSession}
              style={styles.actionButton}
              disabled={connectionState !== "connected" || isCreatingSession}
              loading={isCreatingSession}
            >
              {isCreatingSession ? "Creating..." : "Create Session"}
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Title style={styles.cardTitle}>Attendance Sessions</Title>
              <Button
                mode="outlined"
                onPress={retrieveAttendances}
                disabled={isFetchingSessions}
                loading={isFetchingSessions}
              >
                {isFetchingSessions ? "Fetching..." : "Refresh"}
              </Button>
            </View>
            {attendanceSessions.length > 0 ? (
              attendanceSessions.map(renderAttendanceSession)
            ) : (
              <Paragraph style={styles.emptyStateText}>
                No attendance sessions available.
              </Paragraph>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
      <LogoutButton onLogout={onLogout} />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 4,
    borderRadius: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1565c0",
  },
  input: {
    marginBottom: 8,
  },
  actionButton: {
    marginTop: 16,
  },
  divider: {
    marginVertical: 8,
  },
  emptyStateText: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
  },
  connectedText: {
    color: "#4caf50",
    fontWeight: "bold",
  },
  disconnectedText: {
    color: "#f44336",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginTop: -4,
    marginBottom: 8,
  },
  boldText: {
    fontWeight: "bold",
  },
  sessionCard: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sessionInfo: {
    marginLeft: 16,
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  sessionSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  sessionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sessionDate: {
    fontSize: 14,
    color: "#666",
  },
  attendeeCount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1565c0",
  },
  exportButton: {
    marginTop: 12,
  },
});

export default LecturerAttendanceScreen;
