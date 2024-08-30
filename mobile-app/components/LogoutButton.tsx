import React from 'react';
import {Button} from 'react-native-paper';
import {StyleSheet, View} from 'react-native';

interface LogoutButtonProps {
  onLogout: () => void;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({onLogout}) => {
  return (
    <View style={styles.container}>
      <Button mode="contained" onPress={onLogout} style={styles.button}>
        Logout
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    marginHorizontal: 16,
  },
  button: {
    backgroundColor: '#ff3b30',
  },
});

export default LogoutButton;
