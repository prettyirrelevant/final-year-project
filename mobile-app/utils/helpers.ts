import { format, fromUnixTime } from "date-fns";

export function now() {
  return Date.now() / 1000;
}

export const formatDateTime = (timestamp: number) => {
  const date = fromUnixTime(timestamp);
  return format(date, "EEE, MMM d, yyyy 'at' h:mm a");
};

export const generateStudentAttendanceFilename = (
  courseCode: string,
  timestamp: number,
  sessionType: "lecturer" | "student"
) => {
  const formattedDate = format(fromUnixTime(timestamp), "yyyy-MM-dd");
  return `${formattedDate}_${courseCode}_${sessionType.toUpperCase()}_Attendance.csv`;
};
