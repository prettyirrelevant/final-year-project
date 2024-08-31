import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import {
  Button,
  Card,
  Paragraph,
  Text,
  TextInput,
  Title,
} from "react-native-paper";

type OTPVerificationProps = {
  onVerify: (otp: string) => void;
};

const OTPVerification: React.FC<OTPVerificationProps> = ({ onVerify }) => {
  const [otp, setOTP] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = () => {
    if (otp.length !== 6) {
      setOtpError("OTP must be 6 digits long");
      return;
    }
    setOtpError("");
    setIsLoading(true);
    onVerify(otp);
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Verify OTP</Title>
          <Paragraph style={styles.subtitle}>
            Enter the 6-digit code sent to your email
          </Paragraph>
          <TextInput
            label="Enter OTP"
            value={otp}
            onChangeText={(text) => {
              setOTP(text);
              setOtpError("");
            }}
            style={styles.input}
            keyboardType="number-pad"
            error={!!otpError}
            maxLength={6}
          />
          {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
          <Button
            mode="contained"
            loading={isLoading}
            style={styles.button}
            onPress={handleVerify}
            disabled={!!isLoading}
            labelStyle={styles.buttonText}
          >
            Verify OTP
          </Button>
        </Card.Content>
      </Card>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  card: {
    elevation: 4,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    color: "#666",
  },
  input: {
    marginBottom: 16,
    backgroundColor: "white",
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    marginBottom: 8,
  },
});

export default OTPVerification;
