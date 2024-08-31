import { open, type DB } from "@op-engineering/op-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BleManager } from "react-native-ble-plx";
import {
  DefaultTheme,
  Provider as PaperProvider,
  Text,
} from "react-native-paper";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { completeAuth, initiateAuth } from "./utils/api";

import LecturerAttendanceScreen from "./components/LecturerAttendanceScreen";
import Login from "./components/Login";
import LogoutButton from "./components/LogoutButton";
import OTPVerification from "./components/OTPVerification";
import StudentAttendanceScreen from "./components/StudentAttendanceScreen";
import UserDetails from "./components/UserDetails";

// Initialize BLE Manager
const bleManager = new BleManager();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#1565c0",
    accent: "#f50057",
  },
};

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

interface MarkedAttendance {
  sessionId: string;
  courseCode: string;
  courseName: string;
  expiryTimestamp: number;
  timestamp: number;
}

const App: React.FC = () => {
  const [email, setEmail] = useState("");
  const [db, setDb] = useState<DB | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>("login");
  const [userDetails, setUserDetails] = useState<{
    firstName: string;
    lastName: string;
    matricNumber?: string;
  }>({ firstName: "", lastName: "", matricNumber: "" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      await initDatabase();
      await checkAuthStatus();
      setIsLoading(false);
    };

    initApp();

    // Set up BLE state change listener
    const subscription = bleManager.onStateChange((state) => {
      if (state === "PoweredOn") {
        console.log("Bluetooth is powered on");
      }
    }, true);

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      Toast.show({
        type: type,
        text1: message,
        position: "top",
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 30,
        bottomOffset: 40,
      });
    },
    []
  );

  const initDatabase = async () => {
    try {
      const database = open({ name: "MainDB.db" });
      setDb(database);
      await createTables(database);
    } catch (error) {
      console.error("Error initializing database:", error);
      showToast("Failed to initialize database", "error");
    }
  };

  const createTables = async (database: DB) => {
    try {
      await database.executeAsync(`
        CREATE TABLE IF NOT EXISTS AttendanceSessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sessionId TEXT UNIQUE,
          lecturerEmail TEXT,
          courseCode TEXT,
          courseName TEXT,
          createdAt INTEGER
        )
      `);
      await database.executeAsync(`
        CREATE TABLE IF NOT EXISTS AttendanceRecords (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sessionId TEXT,
          studentName TEXT,
          matricNumber TEXT,
          timestamp INTEGER,
          FOREIGN KEY (sessionId) REFERENCES AttendanceSessions (sessionId)
        )
      `);
      await database.executeAsync(`
        CREATE TABLE IF NOT EXISTS StudentAttendances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sessionId TEXT UNIQUE,
          studentEmail TEXT,
          courseCode TEXT,
          courseName TEXT,
          expiryTimestamp INTEGER,
          timestamp INTEGER
        )
      `);
      console.log("Tables created successfully");
    } catch (error) {
      console.error("Error creating tables:", error);
      showToast("Failed to create database tables", "error");
    }
  };

  const saveAttendanceSession = async (sessionData: {
    sessionId: string;
    courseName: string;
    courseCode: string;
    lecturerEmail: string;
    records: AttendanceRecord[];
  }) => {
    if (!db) {
      console.error("Database not initialized");
      return;
    }

    try {
      await db.executeAsync(
        `INSERT OR REPLACE INTO AttendanceSessions (sessionId, lecturerEmail, courseCode, courseName, createdAt)
         VALUES (?, ?, ?, ?, ?)`,
        [
          sessionData.sessionId,
          sessionData.lecturerEmail,
          sessionData.courseCode,
          sessionData.courseName,
          Date.now(),
        ]
      );

      for (const record of sessionData.records) {
        await db.executeAsync(
          `INSERT INTO AttendanceRecords (sessionId, studentName, matricNumber, timestamp)
           VALUES (?, ?, ?, ?)`,
          [
            sessionData.sessionId,
            record.studentName,
            record.matricNumber,
            record.timestamp,
          ]
        );
      }

      console.log("Attendance session saved successfully");
    } catch (error) {
      console.error("Error saving attendance session:", error);
      showToast("Failed to save attendance session", "error");
    }
  };

  const fetchAttendanceSessions = async (
    lecturerEmail: string
  ): Promise<AttendanceSession[]> => {
    if (!db) {
      console.error("Database not initialized");
      return [];
    }

    try {
      const result = await db.executeAsync(
        `SELECT
          s.sessionId, s.courseCode, s.courseName, s.createdAt,
          r.studentName, r.matricNumber, r.timestamp
         FROM AttendanceSessions s
         LEFT JOIN AttendanceRecords r ON s.sessionId = r.sessionId
         WHERE s.lecturerEmail = ?
         ORDER BY s.createdAt DESC, r.timestamp ASC`,
        [lecturerEmail]
      );

      const rows = result.rows?._array ?? [];

      // Group the results by session
      const sessionsMap = new Map<string, AttendanceSession>();

      rows.forEach((row) => {
        if (!sessionsMap.has(row.sessionId)) {
          sessionsMap.set(row.sessionId, {
            sessionId: row.sessionId,
            courseCode: row.courseCode,
            courseName: row.courseName,
            createdAt: row.createdAt,
            records: [],
          });
        }

        const session = sessionsMap.get(row.sessionId)!;

        if (row.studentName) {
          // Check if there's an attendance record
          session.records.push({
            studentName: row.studentName,
            matricNumber: row.matricNumber,
            timestamp: row.timestamp,
          });
        }
      });

      return Array.from(sessionsMap.values());
    } catch (error) {
      console.error("Error fetching attendance sessions:", error);
      showToast("Failed to fetch attendance sessions", "error");
      return [];
    }
  };

  const saveStudentAttendance = async (attendanceData: MarkedAttendance) => {
    if (!db) {
      console.error("Database not initialized");
      return;
    }

    try {
      await db.executeAsync(
        `INSERT OR REPLACE INTO StudentAttendances (sessionId, studentEmail, courseCode, courseName, expiryTimestamp, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          attendanceData.sessionId,
          email,
          attendanceData.courseCode,
          attendanceData.courseName,
          attendanceData.expiryTimestamp,
          attendanceData.timestamp,
        ]
      );

      console.log("Student attendance saved successfully");
    } catch (error) {
      console.error("Error saving student attendance:", error);
      showToast("Failed to save student attendance", "error");
    }
  };

  const fetchStudentAttendances = async (): Promise<MarkedAttendance[]> => {
    if (!db) {
      console.error("Database not initialized");
      return [];
    }

    try {
      const result = await db.executeAsync(
        "SELECT * FROM StudentAttendances WHERE studentEmail = ? ORDER BY timestamp DESC",
        [email]
      );

      return result.rows?._array ?? [];
    } catch (error) {
      console.error("Error fetching student attendances:", error);
      showToast("Failed to fetch student attendances", "error");
      return [];
    }
  };

  const checkAuthStatus = async () => {
    const storedUserId = await AsyncStorage.getItem("userId");
    if (storedUserId) {
      try {
        const storedEmail = await AsyncStorage.getItem("email");
        const firstName = await AsyncStorage.getItem("firstName");
        const lastName = await AsyncStorage.getItem("lastName");
        const matricNumber = await AsyncStorage.getItem("matricNumber");
        const storedUserType = await AsyncStorage.getItem("userType");

        if (firstName && lastName && storedUserType && storedEmail) {
          setUserId(storedUserId);
          setEmail(storedEmail);
          setUserDetails({
            firstName,
            lastName,
            matricNumber: matricNumber || undefined,
          });
          setCurrentScreen(
            storedUserType === "lecturer"
              ? "lecturerDashboard"
              : "studentDashboard"
          );
        } else {
          // If any required data is missing, reset to login
          await handleLogout();
        }
      } catch (error) {
        console.error("Error fetching user details from AsyncStorage:", error);
        showToast("Failed to fetch user details", "error");
        setCurrentScreen("login");
      }
    } else {
      setCurrentScreen("login");
    }
  };

  const handleLogin = async (_email: string) => {
    try {
      const response = await initiateAuth(_email);
      if (response.success) {
        setUserId(response.data!.id);
        setEmail(_email);
        setCurrentScreen("otpVerification");
      } else {
        showToast(response.message, "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      showToast("An error occurred during login", "error");
    }
  };

  const handleOTPVerification = async (otp: string) => {
    if (!userId) {
      return;
    }

    const userType = email.endsWith("@student.oauife.edu.ng")
      ? "student"
      : "lecturer";
    try {
      const response = await completeAuth(userId, otp);
      if (response.success) {
        await AsyncStorage.setItem("userId", userId);
        await AsyncStorage.setItem("email", email);
        await AsyncStorage.setItem("userType", userType);

        const storedFirstName = await AsyncStorage.getItem("firstName");
        if (!storedFirstName) {
          setCurrentScreen("userDetails");
        } else {
          setCurrentScreen(
            userType === "lecturer" ? "lecturerDashboard" : "studentDashboard"
          );
        }
      } else {
        showToast(response.message, "error");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      showToast("An error occurred during OTP verification", "error");
    }
  };

  const handleUserDetailsSubmit = async (details: {
    firstName: string;
    lastName: string;
    matricNumber?: string;
  }) => {
    if (!userId) {
      return;
    }

    const userType = email.endsWith("@student.oauife.edu.ng")
      ? "student"
      : "lecturer";
    try {
      setUserDetails(details);
      await AsyncStorage.setItem("firstName", details.firstName);
      await AsyncStorage.setItem("lastName", details.lastName);
      if (details.matricNumber) {
        await AsyncStorage.setItem("matricNumber", details.matricNumber);
      }
      setCurrentScreen(
        userType === "lecturer" ? "lecturerDashboard" : "studentDashboard"
      );
      showToast("User details saved successfully", "success");
    } catch (error) {
      console.error("User details submission error:", error);
      showToast("An error occurred while submitting user details", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        "userId",
        "email",
        "firstName",
        "lastName",
        "matricNumber",
        "userType",
      ]);
      setCurrentScreen("login");
      setUserId(null);
      setEmail("");
      setUserDetails({ firstName: "", lastName: "", matricNumber: "" });
      showToast("Logged out successfully", "success");
    } catch (error) {
      console.error("Logout error:", error);
      showToast("Failed to log out", "error");
    }
  };

  const renderScreen = () => {
    console.log("Current screen:", currentScreen);
    try {
      switch (currentScreen) {
        case "login":
          return <Login onLogin={handleLogin} />;
        case "otpVerification":
          return <OTPVerification onVerify={handleOTPVerification} />;
        case "userDetails":
          return (
            <UserDetails
              onSubmit={handleUserDetailsSubmit}
              userType={
                email.endsWith("@student.oauife.edu.ng")
                  ? "student"
                  : "lecturer"
              }
            />
          );
        case "lecturerDashboard":
          return (
            <LecturerAttendanceScreen
              showToast={showToast}
              lecturerEmail={email}
              bleManager={bleManager}
              onLogout={handleLogout}
              saveAttendanceSession={saveAttendanceSession}
              fetchAttendanceSessions={fetchAttendanceSessions}
              lecturerName={userDetails.firstName + " " + userDetails.lastName}
            />
          );
        case "studentDashboard":
          return (
            <StudentAttendanceScreen
              bleManager={bleManager}
              studentName={userDetails.firstName + " " + userDetails.lastName}
              matricNumber={userDetails.matricNumber || ""}
              showToast={showToast}
              onLogout={handleLogout}
              saveStudentAttendance={saveStudentAttendance}
              fetchStudentAttendances={fetchStudentAttendances}
            />
          );
        default:
          return null;
      }
    } catch (error) {
      console.error("Error rendering screen:", error);
      return (
        <View style={styles.centerContainer}>
          <Text>An error occurred. Please try again.</Text>
          <LogoutButton onLogout={handleLogout} />
        </View>
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <SafeAreaView style={styles.container}>{renderScreen()}</SafeAreaView>
      </PaperProvider>
      <Toast />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default App;
