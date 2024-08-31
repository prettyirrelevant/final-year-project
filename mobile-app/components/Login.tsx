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

type LoginProps = {
  onLogin: (email: string) => void;
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (_email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(_email);
  };

  const handleLogin = () => {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    setEmailError("");
    onLogin(email);
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Welcome to Neuron</Title>
          <Paragraph style={styles.subtitle}>
            Empowering education through seamless interaction!
          </Paragraph>
          <TextInput
            label="Enter your email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError("");
            }}
            style={styles.input}
            keyboardType="email-address"
            error={!!emailError}
          />
          {emailError ? (
            <Text style={styles.errorText}>{emailError}</Text>
          ) : null}
          <Button
            mode="contained"
            loading={isLoading}
            style={styles.button}
            disabled={!!isLoading}
            onPress={handleLogin}
            labelStyle={styles.buttonText}
          >
            Continue
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
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#1565c0",
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 24,
    textAlign: "center",
    color: "#666",
  },
  input: {
    marginBottom: 16,
    backgroundColor: "white",
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    marginBottom: 8,
  },
});

export default Login;
