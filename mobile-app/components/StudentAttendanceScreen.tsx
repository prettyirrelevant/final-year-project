import React, {useState, useEffect, useCallback} from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Avatar,
  Divider,
} from 'react-native-paper';
import {BleManager, Device} from 'react-native-ble-plx';
import {formatDistance, formatDistanceToNow} from 'date-fns';
import Share from 'react-native-share';
import LogoutButton from './LogoutButton';
import {
  formatDateTime,
  generateStudentAttendanceFilename,
  now,
} from '../utils/helpers';
import {requestBlePermissions} from '../utils/permission';

const SCAN_TIMEOUT = 10000;
const DEVICE_NAME = 'ESP32-Attendance';
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID_MARK_ATTENDANCE = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const CHAR_UUID_RETRIEVE_SESSIONS = 'beb5483f-36e1-4688-b7f5-ea07361b26ab';

interface AttendanceSession {
  sessionId: string;
  courseCode: string;
  courseName: string;
  expiryTimestamp: number;
}

interface MarkedAttendance extends AttendanceSession {
  timestamp: number;
}

interface StudentAttendanceScreenProps {
  bleManager: BleManager;
  studentName: string;
  matricNumber: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onLogout: () => Promise<void>;
  saveStudentAttendance: (attendanceData: MarkedAttendance) => Promise<void>;
  fetchStudentAttendances: () => Promise<MarkedAttendance[]>;
}

const StudentAttendanceScreen: React.FC<StudentAttendanceScreenProps> = ({
  bleManager,
  studentName,
  matricNumber,
  showToast,
  onLogout,
  saveStudentAttendance,
  fetchStudentAttendances,
}) => {
  const [connectionState, setConnectionState] = useState<
    'disconnected' | 'scanning' | 'connecting' | 'connected'
  >('disconnected');
  const [device, setDevice] = useState<Device | null>(null);
  const [isFetchingSessions, setIsFetchingSessions] = useState(false);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<
    AttendanceSession[]
  >([]);
  const [markedSessions, setMarkedSessions] = useState<MarkedAttendance[]>([]);

  useEffect(() => {
    loadMarkedAttendances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMarkedAttendances = useCallback(async () => {
    try {
      const attendances = await fetchStudentAttendances();
      setMarkedSessions(attendances);
    } catch (error) {
      console.error('Error loading marked attendances:', error);
      showToast('Failed to load marked attendances', 'error');
    }
  }, [fetchStudentAttendances, showToast]);

  const resetConnection = useCallback(() => {
    setConnectionState('disconnected');
    setDevice(null);
    bleManager.stopDeviceScan();
    setAvailableSessions([]);
  }, [bleManager]);

  const retrieveAvailableSessions = useCallback(
    (currentDevice: Device) => {
      if (!currentDevice) {
        console.error('No device available for retrieving sessions');
        return;
      }
      setIsFetchingSessions(true);
      currentDevice
        .readCharacteristicForService(SERVICE_UUID, CHAR_UUID_RETRIEVE_SESSIONS)
        .then(characteristic => {
          if (characteristic.value) {
            const decodedValue = atob(characteristic.value);
            try {
              const sessions: AttendanceSession[] = JSON.parse(decodedValue);
              console.log('All sessions from device:', sessions);
              console.log('Current marked sessions:', markedSessions);

              const filteredSessions = sessions.filter(
                session =>
                  !markedSessions.some(
                    marked => marked.sessionId === session.sessionId,
                  ),
              );

              console.log('Filtered sessions:', filteredSessions);
              setAvailableSessions(filteredSessions);
              showToast('Available sessions retrieved successfully', 'success');
            } catch (parseError) {
              console.error('Error parsing sessions data:', parseError);
              showToast('Error parsing available sessions', 'error');
            }
          } else {
            console.warn('No data received from characteristic');
            showToast('No available sessions found', 'error');
          }
        })
        .catch(error => {
          console.error('Retrieve sessions error:', error);
          showToast('Failed to retrieve available sessions', 'error');
        })
        .finally(() => {
          setIsFetchingSessions(false);
        });
    },
    [showToast, markedSessions],
  );

  const scanAndConnect = useCallback(async () => {
    if (connectionState !== 'disconnected') {
      console.log(
        'Already in connection process. Current state:',
        connectionState,
      );
      return;
    }

    const permissionsGranted = await requestBlePermissions();
    if (!permissionsGranted) {
      showToast('Bluetooth permissions not granted', 'error');
      return;
    }

    setConnectionState('scanning');
    console.log('Starting scan');

    const scanTimeout = setTimeout(() => {
      console.log('Scan timeout reached');
      resetConnection();
      showToast('Scan timed out. No device found.', 'error');
    }, SCAN_TIMEOUT);

    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error('Scan error:', error);
        clearTimeout(scanTimeout);
        resetConnection();
        showToast('Failed to scan for devices', 'error');
        return;
      }

      if (scannedDevice && scannedDevice.name === DEVICE_NAME) {
        console.log('Found target device:', DEVICE_NAME);
        bleManager.stopDeviceScan();
        clearTimeout(scanTimeout);

        setConnectionState('connecting');
        scannedDevice
          .connect({requestMTU: 512})
          .then(connectedDevice =>
            connectedDevice.discoverAllServicesAndCharacteristics(),
          )
          .then(discoveredDevice => {
            console.log('Connected and discovered services');
            setDevice(discoveredDevice);
            setConnectionState('connected');
            showToast('Connected to ESP32-Attendance', 'success');
            retrieveAvailableSessions(discoveredDevice);
          })
          .catch(connectError => {
            console.error('Connection error:', connectError);
            resetConnection();
            showToast('Failed to connect to ESP32-Attendance', 'error');
          });
      }
    });
  }, [
    bleManager,
    connectionState,
    resetConnection,
    showToast,
    retrieveAvailableSessions,
  ]);

  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up BLE');
      bleManager.stopDeviceScan();
      device?.cancelConnection();
    };
  }, [bleManager, device]);

  const markAttendance = useCallback(
    async (session: AttendanceSession) => {
      if (!device || connectionState !== 'connected') {
        showToast('Device not connected', 'error');
        return;
      }
      setIsMarkingAttendance(true);
      const timestamp = now();
      const data = JSON.stringify({
        sessionId: session.sessionId,
        studentName,
        matricNumber,
        timestamp,
      });

      try {
        await device.writeCharacteristicWithoutResponseForService(
          SERVICE_UUID,
          CHAR_UUID_MARK_ATTENDANCE,
          btoa(data),
        );

        const markedAttendance: MarkedAttendance = {...session, timestamp};
        await saveStudentAttendance(markedAttendance);

        setMarkedSessions(prev => [...prev, markedAttendance]);
        setAvailableSessions(prev =>
          prev.filter(s => s.sessionId !== session.sessionId),
        );

        showToast('Attendance marked successfully', 'success');
      } catch (error) {
        console.error('Mark attendance error:', error);
        showToast('Failed to mark attendance', 'error');
      } finally {
        setIsMarkingAttendance(false);
      }
    },
    [
      device,
      connectionState,
      studentName,
      matricNumber,
      showToast,
      saveStudentAttendance,
    ],
  );

  const renderAttendanceSession = (
    session: AttendanceSession | MarkedAttendance,
    isMarked: boolean,
  ) => {
    const expiryDate = new Date(session.expiryTimestamp * 1000);
    const formattedExpiry = formatDistance(Date.now(), expiryDate, {
      addSuffix: true,
    });

    return (
      <Card key={session.sessionId} style={styles.sessionCard}>
        <Card.Content>
          <View style={styles.sessionHeader}>
            <Avatar.Text
              size={48}
              label={session.courseCode.substring(0, 2)}
              style={styles.avatar}
            />
            <View style={styles.sessionInfo}>
              <Title style={styles.sessionTitle}>{session.courseName}</Title>
              <Paragraph style={styles.sessionSubtitle}>
                {session.courseCode}
              </Paragraph>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.sessionDetails}>
            <View style={styles.dateContainer}>
              <Paragraph style={styles.sessionDate}>
                {isMarked ? 'Marked:' : 'Expires:'}
              </Paragraph>
              <Paragraph style={styles.dateValue}>
                {isMarked
                  ? formatDistanceToNow(
                      new Date((session as MarkedAttendance).timestamp * 1000),
                      {addSuffix: true},
                    )
                  : formattedExpiry}
              </Paragraph>
            </View>
            {isMarked ? (
              <Button
                mode="contained"
                style={styles.exportButton}>
                Marked
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={() => markAttendance(session)}
                disabled={isMarkingAttendance}
                loading={isMarkingAttendance}
                style={styles.markButton}>
                {isMarkingAttendance ? 'Marking...' : 'Mark Attendance'}
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Student Information</Title>
            <Paragraph>
              Name: <Paragraph style={styles.boldText}>{studentName}</Paragraph>
            </Paragraph>
            <Paragraph>
              Matric Number:{' '}
              <Paragraph style={styles.boldText}>{matricNumber}</Paragraph>
            </Paragraph>
            <Paragraph
              style={
                connectionState === 'connected'
                  ? styles.connectedText
                  : styles.disconnectedText
              }>
              Bluetooth Status: {connectionState}
            </Paragraph>
            <Button
              mode="contained"
              onPress={
                connectionState === 'disconnected'
                  ? scanAndConnect
                  : resetConnection
              }
              style={styles.actionButton}
              disabled={
                connectionState === 'scanning' ||
                connectionState === 'connecting'
              }
              loading={
                connectionState === 'scanning' ||
                connectionState === 'connecting'
              }>
              {connectionState === 'disconnected'
                ? 'Connect to Device'
                : connectionState === 'scanning'
                ? 'Scanning...'
                : connectionState === 'connecting'
                ? 'Connecting...'
                : 'Disconnect'}
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Title style={styles.cardTitle}>Available Sessions</Title>
              <Button
                mode="outlined"
                onPress={() => device && retrieveAvailableSessions(device)}
                disabled={connectionState !== 'connected' || isFetchingSessions}
                loading={isFetchingSessions}>
                {isFetchingSessions ? 'Fetching...' : 'Refresh'}
              </Button>
            </View>
            {availableSessions.length > 0 ? (
              availableSessions.map(session =>
                renderAttendanceSession(session, false),
              )
            ) : (
              <Paragraph style={styles.emptyStateText}>
                No available sessions.
              </Paragraph>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Marked Attendances</Title>
            {markedSessions.length > 0 ? (
              markedSessions.map(session =>
                renderAttendanceSession(session, true),
              )
            ) : (
              <Paragraph style={styles.emptyStateText}>
                No marked attendances yet.
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
    backgroundColor: '#f5f5f5',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1565c0',
  },
  actionButton: {
    marginTop: 16,
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  connectedText: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  disconnectedText: {
    color: '#f44336',
  },
  boldText: {
    fontWeight: 'bold',
  },
  sessionCard: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    backgroundColor: '#1565c0',
  },
  sessionInfo: {
    marginLeft: 16,
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sessionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    marginVertical: 12,
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateContainer: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  exportButton: {
    borderRadius: 8,
    backgroundColor: '#4caf50', // Green color for export button
  },
  markButton: {
    borderRadius: 8,
  },
});

export default StudentAttendanceScreen;
