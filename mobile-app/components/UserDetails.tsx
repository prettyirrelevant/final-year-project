import React, {useState} from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  Text,
} from 'react-native-paper';

type UserDetailsProps = {
  onSubmit: (details: {
    firstName: string;
    lastName: string;
    matricNumber?: string;
  }) => void;
  userType: 'student' | 'lecturer' | null;
};

const UserDetails: React.FC<UserDetailsProps> = ({onSubmit, userType}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateInputs = () => {
    const newErrors: {[key: string]: string} = {};
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (userType === 'student') {
      if (!matricNumber.trim()) {
        newErrors.matricNumber = 'Matric number is required';
      } else if (!/^[A-Z]{3}\/\d{4}\/\d{3}$/.test(matricNumber)) {
        newErrors.matricNumber = 'Invalid matric number format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateInputs()) {
      onSubmit(
        userType === 'student'
          ? {firstName, lastName, matricNumber}
          : {firstName, lastName},
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>User Details</Title>
            <Paragraph style={styles.subtitle}>
              Please provide your personal information
            </Paragraph>
            <TextInput
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              style={styles.input}
              error={!!errors.firstName}
            />
            {errors.firstName && (
              <Text style={styles.errorText}>{errors.firstName}</Text>
            )}

            <TextInput
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              style={styles.input}
              error={!!errors.lastName}
            />
            {errors.lastName && (
              <Text style={styles.errorText}>{errors.lastName}</Text>
            )}

            {userType === 'student' && (
              <>
                <TextInput
                  label="Matric Number"
                  value={matricNumber}
                  onChangeText={setMatricNumber}
                  style={styles.input}
                  error={!!errors.matricNumber}
                />
                {errors.matricNumber && (
                  <Text style={styles.errorText}>{errors.matricNumber}</Text>
                )}
              </>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.button}
              labelStyle={styles.buttonText}>
              Submit
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    elevation: 4,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    color: '#666',
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 8,
  },
});

export default UserDetails;
