# Students' Attendance System using Bluetooth Low Energy

## Overview

This is my final year project for the Electronic and Electrical Engineering degree at Obafemi Awolowo University. It's a system that uses Bluetooth Low Energy (BLE) to track student attendance.

## Main Parts

1. ESP32 microcontroller: Acts as a BLE server
2. Mobile app: For students and lecturers to use
3. Backend server: Handles user accounts and stores data

## What It Can Do

- Secure login with institutional email and OTP
- Works offline and syncs when online
- Lecturers can start attendance sessions
- Easy to use for both students and lecturers
- Students can mark their attendance using their phones

## Tech Used

- ESP32 (C++/Arduino)
- SQLite for storing data
- Bluetooth Low Energy (BLE)
- React Native for the mobile app
- Node.js (Hono framework) for the backend

## Files and Folders

The project has three main folders:

1. `esp32/`: Code for the ESP32 BLE server
2. `mobile-app/`: Code for the React Native app
3. `auth-server/`: Code for the Node.js server

## How to Set It Up

### ESP32 Setup

1. Install PlatformIO in your code editor
2. Open the `esp32/` folder as a PlatformIO project
3. Install required libraries: NimBLE-Arduino, ArduinoJson
4. Build and upload the code to your ESP32

### Mobile App Setup

1. Make sure you have React Native set up on your computer
2. Go to the `mobile-app/` folder
3. Run `yarn install` to get all the needed packages
4. Run `yarn android` or `yarn ios` to start the app

### Backend Setup

1. Go to the `auth-server/` folder
2. Run `yarn install` to get all the needed packages
3. Set up your settings in a `.env` file (look at `.env.example` for help)
4. Run `yarn start` to start the server

## How to Use It

1. Lecturers log in and start an attendance session
2. Students log in and see available sessions
3. Students get close to the ESP32 and mark their attendance
4. Lecturers can see who's present

## Thank You

- Dr. T.K. Yesufu, my project supervisor
- Department of Electrical and Electronic Engineering, Obafemi Awolowo University
