const ARDUINO_CODE_TEXT = `/*
 * Project: Automated Parking System using Arduino Uno & IR Sensors
 * Author: Mini-Project Student Demo
 * Components: Arduino Uno, 4x IR Sensors, Servo Motor, 16x2 LCD (I2C), 3x Red/Green LEDs, Piezo Buzzer
 */
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>
// Pin Definitions
#define IR_ENTRANCE  2
#define IR_SLOT1     3
#define IR_SLOT2     4
#define IR_SLOT3     5
#define SERVO_PIN    9
#define BUZZER_PIN   10
// LED Pins (Green / Red indicator pairs)
#define LED_S1_GREEN 6
#define LED_S1_RED   7
#define LED_S2_GREEN 8
#define LED_S2_RED   11
#define LED_S3_GREEN 12
#define LED_S3_RED   13
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo gateServo;
int totalSlots = 3;
int availableSlots = 3;
bool s1_occupied = false;
bool s2_occupied = false;
bool s3_occupied = false;
void setup() {
  Serial.begin(9600);
  
  // Pin modes setup
  pinMode(IR_ENTRANCE, INPUT);
  pinMode(IR_SLOT1, INPUT);
  pinMode(IR_SLOT2, INPUT);
  pinMode(IR_SLOT3, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  pinMode(LED_S1_GREEN, OUTPUT); pinMode(LED_S1_RED, OUTPUT);
  pinMode(LED_S2_GREEN, OUTPUT); pinMode(LED_S2_RED, OUTPUT);
  pinMode(LED_S3_GREEN, OUTPUT); pinMode(LED_S3_RED, OUTPUT);
  gateServo.attach(SERVO_PIN);
  gateServo.write(0); // Gate initially closed
  lcd.init();
  lcd.backlight();
  updateLCD("SMART PARKING", "Available: 3");
  Serial.println("System Initialized Successfully.");
}
void loop() {
  // Read Slot Sensors (LOW = Detected object/car)
  s1_occupied = (digitalRead(IR_SLOT1) == LOW);
  s2_occupied = (digitalRead(IR_SLOT2) == LOW);
  s3_occupied = (digitalRead(IR_SLOT3) == LOW);
  
  // Calculate available slots
  int currentOccupied = (s1_occupied ? 1 : 0) + (s2_occupied ? 1 : 0) + (s3_occupied ? 1 : 0);
  availableSlots = totalSlots - currentOccupied;
  updateLEDs();
  // Check Entrance IR Sensor
  if (digitalRead(IR_ENTRANCE) == LOW) {
    Serial.println("Vehicle Detected at Entrance!");
    
    if (availableSlots > 0) {
      Serial.println("Access Granted: Slot Available.");
      updateLCD("ACCESS GRANTED", "Drive In...");
      openGate();
      delay(3000); // Wait for vehicle to cross
      closeGate();
    } else {
      Serial.println("Access Denied: PARKING FULL!");
      updateLCD("PARKING FULL", "No Vacancy!");
      triggerBuzzerAlert();
    }
  }
  // Update Display in normal state
  if (availableSlots == 0) {
    updateLCD("PARKING FULL", "Available: 0");
  } else {
    String msg = "Available: " + String(availableSlots);
    updateLCD("SMART PARKING", msg);
  }
  
  delay(200);
}
void openGate() {
  for (int pos = 0; pos <= 90; pos += 5) {
    gateServo.write(pos);
    delay(15);
  }
}
void closeGate() {
  for (int pos = 90; pos >= 0; pos -= 5) {
    gateServo.write(pos);
    delay(15);
  }
}
void triggerBuzzerAlert() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(800);
  digitalWrite(BUZZER_PIN, LOW);
}
void updateLEDs() {
  digitalWrite(LED_S1_GREEN, !s1_occupied);
  digitalWrite(LED_S1_RED, s1_occupied);
  digitalWrite(LED_S2_GREEN, !s2_occupied);
  digitalWrite(LED_S2_RED, s2_occupied);
  digitalWrite(LED_S3_GREEN, !s3_occupied);
  digitalWrite(LED_S3_RED, s3_occupied);
}
void updateLCD(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}`;
// Line highlights for execution phases
const CODE_HIGHLIGHT_MAP = {
  'IDLE': [46, 75],
  'ENTRANCE_DETECT': [56, 57],
  'CHECK_VACANCY': [59, 60],
  'OPEN_GATE': [61, 63, 80, 84],
  'PARKING_FULL': [66, 68, 93, 96],
  'CLOSE_GATE': [64, 86, 91],
  'EXIT_DETECT': [48, 51, 98, 105],
  'RESET': [31, 44]
};
