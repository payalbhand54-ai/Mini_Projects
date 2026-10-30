document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const state = {
    totalSlots: 3,
    slots: [
      { id: 1, occupied: false, carColor: null },
      { id: 2, occupied: false, carColor: null },
      { id: 3, occupied: false, carColor: null }
    ],
    gateState: 'CLOSED', // 'CLOSED' (0 deg) or 'OPEN' (-90 deg)
    isBusy: false,
    soundEnabled: true,
    selectedColor: '#3b82f6',
    activeView: 'iso', // 'iso' or 'schematic'
    activeTab: 'code', // 'code' or 'serial'
    lcdTheme: 'blue',
    presentationStep: 1,
    serialLogCount: 0
  };
  // ==========================================
  // DOM ELEMENT REFERENCES
  // ==========================================
  const arriveBtn = document.getElementById('arriveBtn');
  const exitS1Btn = document.getElementById('exitS1Btn');
  const exitS2Btn = document.getElementById('exitS2Btn');
  const exitS3Btn = document.getElementById('exitS3Btn');
  const autoExitBtn = document.getElementById('autoExitBtn');
  const resetAllBtn = document.getElementById('resetAllBtn');
  const carColorSelect = document.getElementById('carColorSelect');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const tourBtn = document.getElementById('tourBtn');
  // LCD Elements
  const lcdScreen = document.getElementById('lcdScreen');
  const lcdLine1 = document.getElementById('lcdLine1');
  const lcdLine2 = document.getElementById('lcdLine2');
  // Barrier Gate & Entrance Sensor
  const servoBarrierArm = document.getElementById('servoBarrierArm');
  const gateAngleDisplay = document.getElementById('gateAngleDisplay');
  const servoStatusDot = document.getElementById('servoStatusDot');
  const entranceLaserBeam = document.getElementById('entranceLaserBeam');
  // Moving Car Sprite
  const movingCarContainer = document.getElementById('movingCarContainer');
  const movingCarSprite = document.getElementById('movingCarSprite');
  // Buzzer & Arduino Board
  const buzzerCard = document.getElementById('buzzerCard');
  const buzzerStateText = document.getElementById('buzzerStateText');
  const ledTx = document.getElementById('ledTx');
  const ledRx = document.getElementById('ledRx');
  // Status Readouts
  const sysGateStatus = document.getElementById('sysGateStatus');
  const sysEntranceStatus = document.getElementById('sysEntranceStatus');
  const sysSlot1Status = document.getElementById('sysSlot1Status');
  const sysSlot2Status = document.getElementById('sysSlot2Status');
  const sysSlot3Status = document.getElementById('sysSlot3Status');
  const tallyTotal = document.getElementById('tallyTotal');
  const tallyOccupied = document.getElementById('tallyOccupied');
  const tallyAvailable = document.getElementById('tallyAvailable');
  // Code & Terminal
  const codeContainer = document.getElementById('codeContainer');
  const serialTerminal = document.getElementById('serialTerminal');
  const clearSerialBtn = document.getElementById('clearSerialBtn');
  // Modals & Tabs
  const tabIsoBtn = document.getElementById('tabIsoBtn');
  const tabSchematicBtn = document.getElementById('tabSchematicBtn');
  const isoParkingArena = document.getElementById('isoParkingArena');
  const schematicArena = document.getElementById('schematicArena');
  const tabCodeBtn = document.getElementById('tabCodeBtn');
  const tabSerialBtn = document.getElementById('tabSerialBtn');
  const codePane = document.getElementById('codePane');
  const serialPane = document.getElementById('serialPane');
  const presentationModal = document.getElementById('presentationModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const prevStepBtn = document.getElementById('prevStepBtn');
  const nextStepBtn = document.getElementById('nextStepBtn');
  const stepCounterText = document.getElementById('stepCounterText');
  // ==========================================
  // WEB AUDIO SYNTHESIZER (NO EXTERNAL ASSETS NEEDED)
  // ==========================================
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }
  function playTone(freq, type, duration, startVol = 0.2, endVol = 0.01) {
    if (!state.soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(startVol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(endVol, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.log('Audio playback prevented:', e);
    }
  }
  function soundIRChime() {
    playTone(880, 'sine', 0.1, 0.3); // High IR chime
  }
  function soundServoMotor() {
    if (!state.soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(300, now + 0.5);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }
  function soundBuzzerAlarm() {
    if (!state.soundEnabled) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        playTone(600, 'square', 0.18, 0.4);
      }, i * 220);
    }
  }
  // ==========================================
  // INITIALIZATION & ARDUINO CODE DISPLAY
  // ==========================================
  function init() {
    renderArduinoCode();
    updateUI();
    attachEventListeners();
    addSerialLog('System initialized. Waiting for vehicle detection...', 'system-line');
  }
  function renderArduinoCode() {
    if (typeof ARDUINO_CODE_TEXT !== 'undefined') {
      const lines = ARDUINO_CODE_TEXT.split('\n');
      const formatted = lines.map((line, idx) => {
        const lineNum = String(idx + 1).padStart(3, ' ');
        return `<span class="code-line" id="line-${idx + 1}"><span class="line-num">${lineNum}</span>  ${escapeHtml(line)}</span>`;
      }).join('\n');
      codeContainer.innerHTML = formatted;
    }
  }
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function highlightCodePhase(phase) {
    if (typeof CODE_HIGHLIGHT_MAP === 'undefined') return;
    document.querySelectorAll('.code-line.active-highlight').forEach(el => {
      el.classList.remove('active-highlight');
    });
    const lineNums = CODE_HIGHLIGHT_MAP[phase];
    if (lineNums) {
      lineNums.forEach(num => {
        const lineEl = document.getElementById(`line-${num}`);
        if (lineEl) {
          lineEl.classList.add('active-highlight');
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  }
  // ==========================================
  // SERIAL MONITOR TERMINAL
  // ==========================================
  function addSerialLog(message, typeClass = '') {
    state.serialLogCount++;
    const timestamp = (performance.now() / 1000).toFixed(2);
    const line = document.createElement('div');
    line.className = `terminal-line ${typeClass}`;
    line.textContent = `[${timestamp}s] ${message}`;
    serialTerminal.appendChild(line);
    serialTerminal.scrollTop = serialTerminal.scrollHeight;
    // Flash RX/TX LEDs on Arduino board
    flashBoardLeds();
  }
  function flashBoardLeds() {
    ledTx.classList.add('blinking');
    ledRx.classList.add('blinking');
    setTimeout(() => {
      ledTx.classList.remove('blinking');
      ledRx.classList.remove('blinking');
    }, 150);
  }
  // ==========================================
  // LCD DISPLAY BUFFER
  // ==========================================
  function setLCDText(line1Text, line2Text) {
    lcdLine1.textContent = padLCDLine(line1Text);
    lcdLine2.textContent = padLCDLine(line2Text);
    // Also update schematic view summary
    document.getElementById('schLcdVal').textContent = `"${line1Text}"`;
  }
  function padLCDLine(str) {
    const padded = String(str).substring(0, 16);
    return padded.padEnd(16, ' ');
  }
  // ==========================================
  // MAIN SIMULATION LOGIC: VEHICLE ARRIVAL
  // ==========================================
  async function handleVehicleArrive() {
    if (state.isBusy) return;
    state.isBusy = true;
    arriveBtn.disabled = true;
    // 1. Entrance Detection Step
    highlightCodePhase('ENTRANCE_DETECT');
    addSerialLog('Vehicle detected at Entrance IR Sensor (Pin D2 LOW).', 'warn-line');
    soundIRChime();
    entranceLaserBeam.classList.add('beam-interrupted');
    sysEntranceStatus.textContent = 'DETECTED (0V)';
    sysEntranceStatus.className = 'status-val badge badge-danger';
    document.getElementById('schEntranceVal').textContent = '0V LOW (Detected)';
    highlightPin('2');
    await sleep(600);
    // 2. Check Available Slots
    highlightCodePhase('CHECK_VACANCY');
    const availableSlot = state.slots.find(s => !s.occupied);
    if (availableSlot) {
      // SUCCESS: SLOT AVAILABLE -> OPEN GATE
      addSerialLog(`Access Granted! Slot ${availableSlot.id} is available.`, 'success-line');
      setLCDText('ACCESS GRANTED', `Slot ${availableSlot.id} Reserved`);
      // Open Gate Servo
      highlightCodePhase('OPEN_GATE');
      await openGateServo();
      // Drive Car into Slot
      await animateCarEntry(availableSlot.id, state.selectedColor);
      // Occupy Slot State
      occupySlot(availableSlot.id, state.selectedColor);
      addSerialLog(`Vehicle parked in Slot ${availableSlot.id}. IR Sensor Pin D${availableSlot.id + 2} LOW.`, 'success-line');
      await sleep(500);
      // Close Gate Servo
      highlightCodePhase('CLOSE_GATE');
      await closeGateServo();
      // Reset Entrance Sensor
      entranceLaserBeam.classList.remove('beam-interrupted');
      sysEntranceStatus.textContent = 'NO VEHICLE';
      sysEntranceStatus.className = 'status-val badge badge-neutral';
      document.getElementById('schEntranceVal').textContent = '5V HIGH (Clear)';
      unhighlightPin('2');
    } else {
      // FAIL: PARKING FULL
      addSerialLog('Access Denied! PARKING FULL (0 Slots Available).', 'alert-line');
      setLCDText('PARKING FULL', 'No Vacancy!');
      highlightCodePhase('PARKING_FULL');
      triggerBuzzerAlert();
      await sleep(1800);
      // Clear Sensor
      entranceLaserBeam.classList.remove('beam-interrupted');
      sysEntranceStatus.textContent = 'NO VEHICLE';
      sysEntranceStatus.className = 'status-val badge badge-neutral';
      document.getElementById('schEntranceVal').textContent = '5V HIGH (Clear)';
      unhighlightPin('2');
    }
    // Update Display back to standard
    updateLCDStandard();
    highlightCodePhase('IDLE');
    state.isBusy = false;
    arriveBtn.disabled = false;
  }
  // ==========================================
  // MAIN SIMULATION LOGIC: VEHICLE EXIT
  // ==========================================
  async function handleVehicleExit(slotId) {
    const slot = state.slots.find(s => s.id === slotId);
    if (!slot || !slot.occupied || state.isBusy) return;
    state.isBusy = true;
    arriveBtn.disabled = true;
    addSerialLog(`Vehicle leaving Slot ${slotId}...`, 'warn-line');
    setLCDText('VEHICLE EXIT', `Leaving Slot ${slotId}`);
    highlightPin(String(slotId + 2));
    // Open Gate Servo
    highlightCodePhase('OPEN_GATE');
    await openGateServo();
    // Animate Car Exit
    await animateCarExit(slotId);
    // Vacate Slot State
    vacateSlot(slotId);
    addSerialLog(`Slot ${slotId} is now VACANT (Pin D${slotId + 2} HIGH).`, 'success-line');
    await sleep(500);
    // Close Gate Servo
    highlightCodePhase('CLOSE_GATE');
    await closeGateServo();
    unhighlightPin(String(slotId + 2));
    updateLCDStandard();
    highlightCodePhase('IDLE');
    state.isBusy = false;
    arriveBtn.disabled = false;
  }
  // Auto exit first occupied vehicle
  function handleAutoExit() {
    const occupiedSlot = state.slots.find(s => s.occupied);
    if (occupiedSlot) {
      handleVehicleExit(occupiedSlot.id);
    } else {
      addSerialLog('No vehicles available to exit.', 'system-line');
    }
  }
  // ==========================================
  // GATE SERVO ANIMATIONS
  // ==========================================
  async function openGateServo() {
    servoStatusDot.classList.add('active-servo');
    servoBarrierArm.classList.add('open');
    gateAngleDisplay.textContent = '90° OPEN';
    sysGateStatus.textContent = 'OPEN (90°)';
    sysGateStatus.className = 'status-val badge badge-success';
    document.getElementById('schServoVal').textContent = '90° (Open)';
    highlightPin('9');
    soundServoMotor();
    await sleep(700);
  }
  async function closeGateServo() {
    servoBarrierArm.classList.remove('open');
    servoStatusDot.classList.remove('active-servo');
    gateAngleDisplay.textContent = '0° CLOSED';
    sysGateStatus.textContent = 'CLOSED (0°)';
    sysGateStatus.className = 'status-val badge badge-closed';
    document.getElementById('schServoVal').textContent = '0° (Closed)';
    unhighlightPin('9');
    soundServoMotor();
    await sleep(700);
  }
  // ==========================================
  // CAR DRIVING ANIMATION PROCEDURES
  // ==========================================
  async function animateCarEntry(slotId, carColor) {
    movingCarSprite.style.backgroundColor = carColor;
    movingCarContainer.classList.remove('hidden');
    // Keyframe path points
    const slotXOffsets = { 1: 18, 2: 48, 3: 78 };
    const targetLeft = slotXOffsets[slotId];
    // Step 1: Drive to entrance stop line
    movingCarContainer.style.transition = 'all 0.6s ease-out';
    movingCarContainer.style.left = '160px';
    movingCarContainer.style.top = '45px';
    movingCarSprite.style.transform = 'rotate(0deg)';
    await sleep(650);
    // Step 2: Drive past open gate into parking lot corridor
    movingCarContainer.style.transition = 'all 0.6s linear';
    movingCarContainer.style.left = `${targetLeft}%`;
    movingCarContainer.style.top = '45px';
    await sleep(650);
    // Step 3: Turn down into assigned slot bay
    movingCarContainer.style.transition = 'all 0.5s ease-in-out';
    movingCarSprite.style.transform = 'rotate(90deg)';
    movingCarContainer.style.top = '190px';
    await sleep(550);
    // Hide moving container
    movingCarContainer.classList.add('hidden');
    movingCarContainer.style.left = '-90px';
    movingCarContainer.style.top = '45px';
  }
  async function animateCarExit(slotId) {
    const slotXOffsets = { 1: 18, 2: 48, 3: 78 };
    const currentLeft = slotXOffsets[slotId];
    movingCarSprite.style.backgroundColor = state.slots.find(s => s.id === slotId).carColor || '#3b82f6';
    movingCarContainer.style.left = `${currentLeft}%`;
    movingCarContainer.style.top = '190px';
    movingCarSprite.style.transform = 'rotate(-90deg)';
    movingCarContainer.classList.remove('hidden');
    // Step 1: Drive up out of slot bay into road corridor
    movingCarContainer.style.transition = 'all 0.5s ease-in-out';
    movingCarContainer.style.top = '45px';
    await sleep(550);
    // Step 2: Turn towards exit past open gate
    movingCarContainer.style.transition = 'all 0.7s linear';
    movingCarSprite.style.transform = 'rotate(180deg)';
    movingCarContainer.style.left = '100%';
    await sleep(750);
    movingCarContainer.classList.add('hidden');
    movingCarContainer.style.left = '-90px';
  }
  // ==========================================
  // SLOT STATE HELPERS
  // ==========================================
  function occupySlot(slotId, color) {
    const slot = state.slots.find(s => s.id === slotId);
    if (!slot) return;
    slot.occupied = true;
    slot.carColor = color;
    // Render Car SVG in Slot Bay
    const spotEl = document.getElementById(`vehicleSpot${slotId}`);
    spotEl.innerHTML = createCarSvg(color);
    // Update LED & Card Styling
    const slotCard = document.getElementById(`slotCard${slotId}`);
    const ledEl = document.getElementById(`ledSlot${slotId}`);
    const statusText = document.getElementById(`statusTextSlot${slotId}`);
    const sysStatusEl = document.getElementById(`sysSlot${slotId}Status`);
    const exitBtn = document.getElementById(`exitS${slotId}Btn`);
    slotCard.className = 'parking-slot occupied';
    ledEl.className = 'slot-led-indicator red';
    statusText.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> OCCUPIED';
    sysStatusEl.textContent = 'OCCUPIED (R)';
    sysStatusEl.className = 'status-val badge badge-danger';
    exitBtn.disabled = false;
    updateTally();
  }
  function vacateSlot(slotId) {
    const slot = state.slots.find(s => s.id === slotId);
    if (!slot) return;
    slot.occupied = false;
    slot.carColor = null;
    // Clear Vehicle SVG
    const spotEl = document.getElementById(`vehicleSpot${slotId}`);
    spotEl.innerHTML = '';
    // Update LED & Card Styling
    const slotCard = document.getElementById(`slotCard${slotId}`);
    const ledEl = document.getElementById(`ledSlot${slotId}`);
    const statusText = document.getElementById(`statusTextSlot${slotId}`);
    const sysStatusEl = document.getElementById(`sysSlot${slotId}Status`);
    const exitBtn = document.getElementById(`exitS${slotId}Btn`);
    slotCard.className = 'parking-slot available';
    ledEl.className = 'slot-led-indicator green';
    statusText.innerHTML = '<i class="fa-solid fa-circle-check"></i> AVAILABLE';
    sysStatusEl.textContent = 'AVAILABLE (G)';
    sysStatusEl.className = 'status-val badge badge-success';
    exitBtn.disabled = true;
    updateTally();
  }
  function createCarSvg(color) {
    return `
      <div class="parked-car-wrapper">
        <svg viewBox="0 0 65 120" class="car-body-svg">
          <rect x="2" y="2" width="61" height="116" rx="14" fill="${color}" stroke="#0f172a" stroke-width="2"/>
          <rect x="8" y="24" width="49" height="24" rx="6" fill="#0f172a" opacity="0.85"/>
          <rect x="10" y="70" width="45" height="18" rx="4" fill="#0f172a" opacity="0.85"/>
          <circle cx="12" cy="8" r="4" fill="#fef08a"/>
          <circle cx="53" cy="8" r="4" fill="#fef08a"/>
          <rect x="8" y="112" width="10" height="4" rx="2" fill="#ef4444"/>
          <rect x="47" y="112" width="10" height="4" rx="2" fill="#ef4444"/>
        </svg>
      </div>
    `;
  }
  function updateTally() {
    const occupiedCount = state.slots.filter(s => s.occupied).length;
    const availableCount = state.totalSlots - occupiedCount;
    tallyTotal.textContent = state.totalSlots;
    tallyOccupied.textContent = occupiedCount;
    tallyAvailable.textContent = availableCount;
  }
  function updateLCDStandard() {
    const availableCount = state.totalSlots - state.slots.filter(s => s.occupied).length;
    if (availableCount === 0) {
      setLCDText('PARKING FULL', 'Available: 0');
    } else {
      setLCDText('SMART PARKING', `Available: ${availableCount}`);
    }
  }
  function triggerBuzzerAlert() {
    buzzerCard.classList.add('alarm-active');
    buzzerStateText.textContent = 'STATUS: ALARM ACTIVE!';
    document.getElementById('schBuzzerVal').textContent = 'ACTIVE ALARM';
    highlightPin('10');
    soundBuzzerAlarm();
    setTimeout(() => {
      buzzerCard.classList.remove('alarm-active');
      buzzerStateText.textContent = 'STATUS: INACTIVE';
      document.getElementById('schBuzzerVal').textContent = 'OFF';
      unhighlightPin('10');
    }, 1800);
  }
  function handleResetAll() {
    if (state.isBusy) return;
    state.slots.forEach(s => vacateSlot(s.id));
    updateLCDStandard();
    addSerialLog('System Reset: All parking slots returned to AVAILABLE.', 'system-line');
    highlightCodePhase('RESET');
  }
  // ==========================================
  // ARDUINO PIN HIGHLIGHT HELPERS
  // ==========================================
  function highlightPin(pinNum) {
    const pinEl = document.getElementById(`pinH_${pinNum}`);
    if (pinEl) pinEl.classList.add('active-pin');
    const schTag = document.getElementById(`schPinD${pinNum}`);
    if (schTag) schTag.classList.add('pin-active-tag');
  }
  function unhighlightPin(pinNum) {
    const pinEl = document.getElementById(`pinH_${pinNum}`);
    if (pinEl) pinEl.classList.remove('active-pin');
    const schTag = document.getElementById(`schPinD${pinNum}`);
    if (schTag) schTag.classList.remove('pin-active-tag');
  }
  // Utility sleep promise
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  // ==========================================
  // EVENT LISTENERS & UI INTERACTION HANDLERS
  // ==========================================
  function attachEventListeners() {
    arriveBtn.addEventListener('click', handleVehicleArrive);
    exitS1Btn.addEventListener('click', () => handleVehicleExit(1));
    exitS2Btn.addEventListener('click', () => handleVehicleExit(2));
    exitS3Btn.addEventListener('click', () => handleVehicleExit(3));
    autoExitBtn.addEventListener('click', handleAutoExit);
    resetAllBtn.addEventListener('click', handleResetAll);
    carColorSelect.addEventListener('change', (e) => {
      state.selectedColor = e.target.value;
    });
    soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      if (state.soundEnabled) {
        soundIcon.className = 'fa-solid fa-volume-high';
        addSerialLog('Audio Sound Effects: ENABLED', 'system-line');
      } else {
        soundIcon.className = 'fa-solid fa-volume-xmark';
        addSerialLog('Audio Sound Effects: MUTED', 'system-line');
      }
    });
    // View Tabs (Isometric vs Schematic)
    tabIsoBtn.addEventListener('click', () => {
      tabIsoBtn.classList.add('active');
      tabSchematicBtn.classList.remove('active');
      isoParkingArena.classList.add('active-pane');
      schematicArena.classList.remove('active-pane');
      document.getElementById('viewModeBadge').textContent = '2.5D Isometric Mode';
    });
    tabSchematicBtn.addEventListener('click', () => {
      tabSchematicBtn.classList.add('active');
      tabIsoBtn.classList.remove('active');
      schematicArena.classList.add('active-pane');
      isoParkingArena.classList.remove('active-pane');
      document.getElementById('viewModeBadge').textContent = 'Hardware Wiring Schematic';
    });
    // Workbench Tabs (Code vs Serial)
    tabCodeBtn.addEventListener('click', () => {
      tabCodeBtn.classList.add('active');
      tabSerialBtn.classList.remove('active');
      codePane.classList.add('active-pane');
      serialPane.classList.remove('active-pane');
    });
    tabSerialBtn.addEventListener('click', () => {
      tabSerialBtn.classList.add('active');
      tabCodeBtn.classList.remove('active');
      serialPane.classList.add('active-pane');
      codePane.classList.remove('active-pane');
    });
    clearSerialBtn.addEventListener('click', () => {
      serialTerminal.innerHTML = '';
      addSerialLog('Terminal Log Cleared.', 'system-line');
    });
    // LCD Theme Toggle
    document.querySelectorAll('.theme-dot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.theme-dot').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.getAttribute('data-theme');
        if (theme === 'green') {
          lcdScreen.className = 'lcd-screen-container green-backlight';
        } else {
          lcdScreen.className = 'lcd-screen-container blue-backlight';
        }
      });
    });
    // Guided Presentation Modal
    tourBtn.addEventListener('click', () => {
      presentationModal.classList.remove('hidden');
      setPresentationStep(1);
    });
    closeModalBtn.addEventListener('click', () => {
      presentationModal.classList.add('hidden');
    });
    prevStepBtn.addEventListener('click', () => {
      if (state.presentationStep > 1) setPresentationStep(state.presentationStep - 1);
    });
    nextStepBtn.addEventListener('click', () => {
      if (state.presentationStep < 3) {
        setPresentationStep(state.presentationStep + 1);
      } else {
        presentationModal.classList.add('hidden');
      }
    });
    // Click on Slot to toggle manually
    document.querySelectorAll('.parking-slot').forEach(slotCard => {
      slotCard.addEventListener('click', () => {
        const slotId = parseInt(slotCard.getAttribute('data-slot'));
        const slot = state.slots.find(s => s.id === slotId);
        if (slot) {
          if (slot.occupied) {
            handleVehicleExit(slotId);
          } else {
            occupySlot(slotId, state.selectedColor);
            addSerialLog(`Manual Toggle: Slot ${slotId} occupied.`, 'system-line');
            updateLCDStandard();
          }
        }
      });
    });
  }
  function setPresentationStep(stepNum) {
    state.presentationStep = stepNum;
    document.querySelectorAll('.tour-step').forEach(stepEl => {
      stepEl.classList.remove('active');
    });
    const currentEl = document.querySelector(`.tour-step[data-step="${stepNum}"]`);
    if (currentEl) currentEl.classList.add('active');
    stepCounterText.textContent = `Step ${stepNum} of 3`;
    prevStepBtn.disabled = (stepNum === 1);
    nextStepBtn.textContent = (stepNum === 3) ? 'Finish Demo' : 'Next Step';
  }
  function updateUI() {
    updateTally();
    updateLCDStandard();
  }
  // Initialize Application
  init();
});
