const router = require('express').Router();
const Leap = require('leapjs');
const frame = require('leapjs/lib/frame');
const hand = require('leapjs/lib/hand');

let clientServerWS = 'undefined';

let controller = 'undefined';

// control values
let appWidth = 600;
let appHeight = 300;

let stageWidth = 300;
let stageHeight = 200;
let leapRangeStartX = -150;
let leapRangeEndX = 150;
let leapRangeStartY = 0;
let leapRangeEndY = 400;
let clamp = true; //
let segmentConfirmed = false;

// variables related to sensitivity
let controlSensitivity = 1;
let moveCaretSensitivity = 1;
let deleteSensitivity = 1;
let groupSelectionSensitivity = 1;
let reorderSenstivity = 1; // reorder at word level NOT char level

let settingsIsSet = false;
let hands, leftHand, rightHand, rightHandFingers, leftHandFingers;


// text selection
var isTextSelected = false; // true when a range/single items selected
var pinchSelection = false;
// operations
// delete - also used in replace
var isTextDeleted = false;
// reorder
let panStart = false;
var moveBothHands = false;
var rightIndexReorder = false;
// hand movement
let newDirection = '?';
let previousDirection;
const LEFT = 'LEFT';
const RIGHT = 'RIGHT';
const UP = 'UP';
const DOWN = 'DOWN';
const FORWARD = 'FORWARD';
const BACKWARD = 'BACKWARD';

const initLeapMotionConnection = () => {
    controller = new Leap.Controller({
        host: '127.0.0.1',
        port: 6437,
        // 'animationFrame' uses the browser animation loop (generally 60 fps).
        // 'deviceFrame' runs at the Leap Motion controller frame rate (20 to 200 fps depending on the user’s settings and available computing power).
        frameEventName: 'deviceFrame',
        useAllPlugins: true,
        // loopWhileDisconnected: false,
    });
    console.log('waiting for Leap Motion connection...');

    controller.connect();

    controller.on('connect', () => {
        console.log('Connected to Leap Motion websocket');
    });
    controller.on('disconnect', () => {
        console.log('Controller disconnected from Leap Motion Controller websocket');
    });
    controller.on('deviceStreaming', () => {
        console.log('Device streaming');
    });
    controller.on('deviceStopped', () => {
        console.log('device disconnected');
    });
    controller.on('frame', (frame) => {
        handleHandMovement(frame);
    });
};
const webSocketDisconnection = () => {
    controller.disconnect();
};
const handleSwipe = (hand) => {
    let previousFrame = controller.frame(1);
    let movement = hand.translation(previousFrame);
    previousDirection = newDirection;

    if (movement[0] > 4) {
        newDirection = RIGHT;
    } else if (movement[0] < -4) {
        newDirection = LEFT;
    }

    if (movement[1] > 4) {
        newDirection = UP;
    } else if (movement[1] < -4) {
        newDirection = DOWN;
    }
    // not used in current settings
    if (movement[2] > 4) {
        newDirection = BACKWARD;
    } else if (movement[2] < -4) {
        newDirection = FORWARD;
    }

    if (previousDirection !== newDirection) {
        return newDirection;
    } else {
        return '?';
    }
};
function handleHandMovement(frame) {
    frameID = frame.id;
    // console.log(frame.currentFrameRate, frameID);
    hands = frame.hands;
    numHands = hands.length;
    if (numHands == 0) {
        // no hands detected
    } else if (numHands == 1) {
        // check right or left
        let currentHand = hands[0];
        let handType = currentHand.type;
        let handConfidence = currentHand.confidence.toPrecision(2);
        let grabStrength = currentHand.grabStrength.toPrecision(2);
        let indexFinger = currentHand.indexFinger;
        let middleFinger = currentHand.middleFinger;
        let thumbFinger = currentHand.thumb;
        let pinchStrength = currentHand.pinchStrength;

        let fingersExtended = getExtendedFingers(currentHand.fingers);
        // if right hand
        // get extended fingers
        if (handType == 'right' && handConfidence > 0.7) {
            // move caret || delete
            if (
                (fingersExtended.length == 1 && fingersExtended.includes('index')) ||
                (fingersExtended.length == 2 && fingersExtended.includes('index') && fingersExtended.includes('thumb'))
            ) {
                try {
                    moveCaretGesture(frame, currentHand);
                } catch (error) {
                    console.log('moveCaretGesture', error);
                }
            } else if (fingersExtended.length == 2 && fingersExtended.includes('index') && fingersExtended.includes('middle')) {
                try {
                    deleteOrConfirmGesture(frame, indexFinger.stabilizedTipPosition, currentHand.id);
                } catch (error) {
                    console.log('deleteOrConfirmGesture', error);
                }
            }
            // delete with hand up/down
            else if (fingersExtended.length >= 4) {
                // either delete or confirm gesture
                try {
                    deleteOrConfirmGesture(frame, indexFinger.stabilizedTipPosition, currentHand.id);
                } catch (error) {
                    console.log('deleteOrConfirmGesture', error);
                }
            } else {
                // nothing for now
            }
        } else {
            // it is left hand, nothing todo
        }
        handsNumberOutput = handType;
    } else if (numHands == 2) {
        // both hands detected
        handsNumberOutput = 'two hands detected ';
        var leftHandIndex = 0;
        var rightHandIndex = 1;

        // check which hand position is the left
        // add a condition for if selection is in process
        if (hands[0].type == 'right') {
            leftHandIndex = 1;
            rightHandIndex = 0;
        }

        leftHand = hands[leftHandIndex];
        rightHand = hands[rightHandIndex];

        let fingersExtendedLeft = getExtendedFingers(leftHand.fingers);
        let fingersExtendedRight = getExtendedFingers(rightHand.fingers);

        var leftHandConfidence = leftHand.confidence.toPrecision(2);
        var rightHandConfidence = rightHand.confidence.toPrecision(2);

        var leftHandGrabStrength = leftHand.grabStrength.toPrecision(2);
        var rightHandGrabStrength = rightHand.grabStrength.toPrecision(2);

        let leftIndex = leftHand.indexFinger;
        let rightIndex = rightHand.indexFinger;

        // case group selection
        if (
            (   // left hand condition
                (
                    fingersExtendedLeft.length == 1 &&
                    fingersExtendedLeft.includes('index')
                ) ||
                (
                    fingersExtendedLeft.length == 2 &&
                    fingersExtendedLeft.includes('index') &&
                    fingersExtendedLeft.includes('thumb')
                )
            ) &&
            (   // right hand condition
                (
                    fingersExtendedRight.length == 1 &&
                    fingersExtendedRight.includes('index') 
                ) ||
                (
                    fingersExtendedRight.length == 2 &&
                    fingersExtendedRight.includes('thumb') &&
                    fingersExtendedRight.includes('index')
                )
            )
        ) {
            try {
                selectGroupGesture(frame, leftHand, rightHand);
            } catch (error) {
                console.log('selectGroupGesture', error);
            }
        }
        // case reorder panStart && move
        if (leftHandGrabStrength > 0.8 && fingersExtendedLeft.length === 0 && !leftIndex.extended && rightIndex.extended) {
            try {
                reorderGesturePanStart(frame, rightHand, leftHand);
            } catch (error) {
                console.log('reorderGesturePanStart', error);
            }
        }
        // case panEnd
        if (leftHandGrabStrength > 0.7 && rightHandGrabStrength > 0.7) {
            try {
                reorderGesturePanEnd(frame, leftHand.id, rightHand.id);
            } catch (error) {
                console.log('reorderGesturePanEnd', error);
            }
        }
        // case delete while in selection
        if (
            (   // left hand condition
                (
                    fingersExtendedLeft.length == 1 &&
                    fingersExtendedLeft.includes('index')
                ) ||
                (
                    fingersExtendedLeft.length == 2 &&
                    fingersExtendedLeft.includes('index') &&
                    fingersExtendedLeft.includes('thumb')
                )
            )
            && fingersExtendedRight.length >= 4) {
            try {
                deleteOrConfirmGesture(frame, rightIndex.stabilizedTipPosition, rightHand.id);
            } catch (error) {
                console.log('deleteOrConfirmGesture', error);
            }
        }
    } else {
        // more than one hand, not accepted
        handsNumberOutput = 'only 1 or two hands allowed!';
    }
}
function confirmGesture(frame, leftHandID, rightHandID, gestureType) {
    let previousFrame = frame.controller.frame(30);

    let leftHand = previousFrame.hand(leftHandID);
    let rightHand = previousFrame.hand(rightHandID);

    if (leftHand.valid && rightHand.valid) {
        let fingersExtendedLeft = getExtendedFingers(leftHand.fingers);
        let fingersExtendedRight = getExtendedFingers(rightHand.fingers);

        let leftIndex = leftHand.indexFinger;
        let rightIndex = rightHand.indexFinger;

        let leftHandGrabStrength = leftHand.grabStrength.toPrecision(2);
        let rightHandGrabStrength = rightHand.grabStrength.toPrecision(2);

        if (gestureType == 'selectGroupGesture') {
            if (
                (   // left hand condition
                    (
                        fingersExtendedLeft.length == 1 &&
                        fingersExtendedLeft.includes('index')
                    ) ||
                    (
                        fingersExtendedLeft.length == 2 &&
                        fingersExtendedLeft.includes('index') &&
                        fingersExtendedLeft.includes('thumb')
                    )
                ) &&
                (   // right hand condition
                    (
                        fingersExtendedRight.length == 1 &&
                        fingersExtendedRight.includes('index') 
                    ) ||
                    (
                        fingersExtendedRight.length == 2 &&
                        fingersExtendedRight.includes('thumb') &&
                        fingersExtendedRight.includes('index')
                    )
                )
            ) {
                return true;
            } else {
                return false;
            }
        } else if (gestureType == 'reorderGesturePanStart') {
            if (leftHandGrabStrength > 0.8 && rightIndex.extended && !leftIndex.extended) {
                return true;
            } else {
                return false;
            }
        } else if (gestureType == 'reorderGesturePanEnd') {
            if (leftHandGrabStrength > 0.8 && rightHandGrabStrength > 0.8) {
                return true;
            } else {
                return false;
            }
        }
        // gesture unkonwn
        else {
            return false;
        }
    }
}
function checkLeapWebSocketConnection() {
    //Create and open the socket
    if (typeof WebSocket == 'undefined' && typeof MozWebSocket != 'undefined') {
        WebSocket = MozWebSocket;
    }
    ws = new WebSocket('ws://localhost:6437/');
    // On successful connection
    ws.onopen = function (event) {
        console.log('Leap Motion Service is open via the websocket!');
    };
}
function getExtendedFingers(fingers) {
    let extendFingers = new Array();
    for (let i = 0; i < fingers.length; i++) {
        if (fingers[i].extended) {
            extendFingers.push(getFingerType(fingers[i].type));
            //extendFingers[i] = getFingerType(fingers[i].type);
        }
    }
    return extendFingers;
}
function getFingerType(fingerNumber) {
    switch (fingerNumber) {
        case 0:
            return 'thumb';
            break;
        case 1:
            return 'index';
            break;
        case 2:
            return 'middle';
            break;
        case 3:
            return 'ring';
            break;
        case 4:
            return 'pinky';
            break;
        default:
            return 'unknown';
            break;
    }
}
function checkRangeChange(previous, current) {
    return previous - current;
}
function normalizeControlFrame(iBox, pointable, isLeft, sensitivity) {
    // pointable is a finger
    if (typeof pointable != 'undefined') {
        let leapPoint = pointable;
        let normalizedPoint = iBox.normalizePoint(leapPoint, true);
        Leap.vec3.scale(normalizedPoint, normalizedPoint, sensitivity); //scale
        let center = sensitivity * 0.5 - 0.5;
        Leap.vec3.subtract(normalizedPoint, normalizedPoint, [center, center, center]);

        let appX = normalizedPoint[0] * appWidth;
        let appY = (1 - normalizedPoint[1]) * appHeight;

        return [Math.floor(appX), Math.floor(appY)];
    } else {
        return [0, 0];
    }
}
function normalizePoint(leapFrame, pointable, sensitivity) {
    let leapScaleStartX = leapRangeStartX * sensitivity;
    let leapScaleEndX = leapRangeEndX * sensitivity;
    let leapScaleStartY = leapRangeStartY * sensitivity;
    let leapScaleEndY = leapRangeEndY * sensitivity;
    let LeapScale = [
        { start: leapScaleStartX, end: leapScaleEndX },
        { start: leapScaleStartY, end: leapScaleEndY },
    ];

    let AppScale = [
        { start: 0, end: stageWidth },
        { start: stageHeight, end: 0 },
    ];
    if (leapFrame.valid) {
        var pos = convert(pointable, LeapScale, AppScale);
        return pos;
    }
}
function convert(position, LeapScale, AppScale) {
    var result = [rescaleCoordinate(position[0], LeapScale[0], AppScale[0]), rescaleCoordinate(position[1], LeapScale[1], AppScale[1])];

    if (clamp) {
        if (result[0] < 0) {
            result[0] = 0;
        }
        if (result[0] > stageWidth) {
            result[0] = stageWidth;
        }
        if (result[1] > stageHeight) {
            result[1] = stageHeight;
        }
        if (result[1] < 0) {
            result[1] = 0;
        }
    }

    return result;
}
function rescaleCoordinate(coordinate, currentScale, targetScale) {
    var currentRange = currentScale.end - currentScale.start;
    var targetRange = targetScale.end - targetScale.start;
    var result = ((coordinate - currentScale.start) * targetRange) / currentRange + targetScale.start;
    return result;
}
function moveCaretGesture(frame, currentHand) {
    // reset some flags
    isTextSelected = false;
    isTextDeleted = false;
    //
    let indexFinger = currentHand.indexFinger.stabilizedTipPosition;
    let palmPoint = currentHand.stabilizedPalmPosition;
    // check if there was a hand detected
    if (frame.valid) {
        let palmCoordinations = normalizePoint(frame, palmPoint, controlSensitivity);
        let indexCoordinations = normalizePoint(frame, indexFinger, moveCaretSensitivity);

        // hand values
        let palmY = Math.floor(palmCoordinations[1]);
        // index values
        let indexX = Math.floor(indexCoordinations[0]);

        try {
            let gesture = {
                type: 'moveCaret',
                indexX: indexX,
                palmY: palmY,
            };
            clientServerWS.send(JSON.stringify(gesture));
        } catch (error) {
            console.log('moveCaret', error);
        }
    }
}
function selectGroupGesture(frame, leftHand, rightHand) {
    let leftIndex = leftHand.indexFinger.stabilizedTipPosition;
    let leftPalm = leftHand.stabilizedPalmPosition;
    let rightIndex = rightHand.indexFinger.stabilizedTipPosition;
    let rightPalm = rightHand.stabilizedPalmPosition;
    // check if this is the gesture we want
    let confirmGestureState = confirmGesture(frame, leftHand.id, rightHand.id, 'selectGroupGesture');
    // && confirmGestureState
    // check if there was a hand detected
    if (frame.valid && confirmGestureState) {
        // get indices coordinations
        let leftIndexCoordinations = normalizePoint(frame, leftIndex, groupSelectionSensitivity);
        let rightIndexCoordinations = normalizePoint(frame, rightIndex, groupSelectionSensitivity);
        let leftIndexX = Math.floor(leftIndexCoordinations[0]);
        let rightIndexX = Math.floor(rightIndexCoordinations[0]);

        // get palm coordinations
        let leftPalmCoordinations = normalizePoint(frame, leftPalm, controlSensitivity);
        let rightPalmCoordinations = normalizePoint(frame, rightPalm, controlSensitivity);
        let leftPalmY = Math.floor(leftPalmCoordinations[1]);
        let rightPalmY = Math.floor(rightPalmCoordinations[1]);

        // group wb message
        if (!panStart) {
            try {
                isTextSelected = true;
                let gesture = {
                    type: 'selectGroup',
                    leftIndexX: leftIndexX,
                    rightIndexX: rightIndexX,
                    leftPalmY: leftPalmY,
                    rightPalmY: rightPalmY,
                };
                clientServerWS.send(JSON.stringify(gesture));
            } catch (error) {
                console.log('selectGroup', error);
            }
        }
    }
}
function deleteOrConfirmGesture(frame, currentIndex, handID) {
    // get normalized x,y
    let currentNormalizedPoints = normalizePoint(frame, currentIndex, deleteSensitivity); // ibox is at fixed size
    // get previous frame
    let previousFrame = frame.controller.frame(3);
    let previousHand = previousFrame.hand(handID);
    let previousIndex = previousHand.indexFinger.stabilizedTipPosition;
    let previousNormalizedPoints = normalizePoint(previousFrame, previousIndex, deleteSensitivity);

    // confirm check
    previousFrame = frame.controller.frame(2);
    let previousHandConfirm = previousFrame.hand(handID);
    let previousIndexConfirm = previousHandConfirm.indexFinger.stabilizedTipPosition;
    let currentNormalizedPointsConfirm = normalizePoint(frame, currentIndex, controlSensitivity); // ibox is at fixed size
    let previousNormalizedPointsConfirm = normalizePoint(previousFrame, previousIndexConfirm, controlSensitivity);
    let changeRateConfirm = checkRangeChange(previousNormalizedPointsConfirm[0], currentNormalizedPointsConfirm[0]);
    // for deletion check
    let changeRateY = checkRangeChange(previousNormalizedPoints[1], currentNormalizedPoints[1]);
    if (Math.abs(changeRateY) > 20 && !isTextDeleted) {
        try {
            isTextDeleted = true;
            if (isTextSelected) {
                let gesture = {
                    type: 'deleteGroup',
                    text: isTextSelected,
                };
                clientServerWS.send(JSON.stringify(gesture));
            } else {
                let gesture = {
                    type: 'deleteSingle',
                    text: isTextSelected,
                };
                clientServerWS.send(JSON.stringify(gesture));
            }
            // set timer to enable deleting again 
            setTimeout(function(){ isTextDeleted = false; }, 1000);
        } catch (error) {
            console.log('deleteGroup || deleteSingle', error);
        }
    }
    // check for confirm
    if (Math.abs(changeRateConfirm) > 20 && !segmentConfirmed) {
        console.log(changeRateConfirm);
        try {
            let gesture = {
                type: 'confirm',
            };
            clientServerWS.send(JSON.stringify(gesture));
            segmentConfirmed = true;
            setTimeout(function(){ segmentConfirmed = false;}, 5000);
        } catch (error) {
            console.log('confirm', error);
        }
    }
}
function reorderGesturePanStart(frame, rightHand, leftHand) {
    let indexFinger = rightHand.indexFinger.stabilizedTipPosition;
    let palmPoint = rightHand.stabilizedPalmPosition;

    let confirmGestureState = confirmGesture(frame, leftHand.id, rightHand.id, 'reorderGesturePanStart');
    // check if there was a hand detected
    if (frame.valid && confirmGestureState) {
        let palmCoordinations = normalizePoint(frame, palmPoint, controlSensitivity);
        let indexCoordinations = normalizePoint(frame, indexFinger, reorderSenstivity);

        // hand values
        let palmX = Math.floor(palmCoordinations[0]);
        let palmY = Math.floor(palmCoordinations[1]);
        // index values
        let indexX = Math.floor(indexCoordinations[0]);
        let indexY = Math.floor(indexCoordinations[1]);

        try {
            panStart = true;
            let type = 'panStartAndMove';
            let gesture = {
                type: type,
                indexX: indexX,
                indexY: indexY,
                palmX: palmX,
                palmY: palmY,
            };
            clientServerWS.send(JSON.stringify(gesture));
        } catch (error) {
            console.log('panStartAndMove', error);
        }
    }
}
function reorderGesturePanEnd(frame, leftHandID, rightHandID) {
    let confirmGestureState = confirmGesture(frame, leftHandID, rightHandID, 'reorderGesturePanEnd');
    if (panStart && confirmGestureState) {
        try {
            panStart = false;
            let type = 'panEnd';
            let gesture = {
                type: type,
            };
            clientServerWS.send(JSON.stringify(gesture));
        } catch (error) {
            console.log('panEnd', error);
        }
    }
}
function checkWebSocketConnection(){
    if (clientServerWS.readyState === client.OPEN) {
        return true;
    }
    else{
        clientServerWS.close();
        console.log('Websocket is closed from client side, closing server side...')
        return false;
    }

}
function setSensitivity(type, value) {
    console.log(value);
    value = (3.3 - (3 * (value / 10 ))) ; // min of 0.3
    switch (type) {
        case 'caretSensitivity':
            moveCaretSensitivity = value;
            console.log('Changed Sensitivity of ' + type + ': ' + moveCaretSensitivity);
            break;
        case 'deleteSensitivity':
            deleteSensitivity = 3.3 - value; // reverse
            console.log('Changed Sensitivity of ' + type + ': ' + deleteSensitivity);
            break;
        case 'selectSensitivity':
            groupSelectionSensitivity = value;
            console.log('Changed Sensitivity of ' + type + ': ' + groupSelectionSensitivity);
            break;
        case 'reorderSensitivity':
            reorderSenstivity = value;
            console.log('Changed Sensitivity of ' + type + ': ' + reorderSenstivity);
            break;
        default:
            break;
    }
}
router.ws('/midairGestures/getData', function (ws, res) {
    console.log("Gestures' client connected");
    ws.on('message', function (msg) {
        data = JSON.parse(msg);
        msg = data.operation;
        if (msg === 'subscribe') {
            console.log('Client requested connection to Leap Motion Controller');
            // set a local instance of websocket
            clientServerWS = ws;
            // connect the controller to leap motion
            initLeapMotionConnection();
        } else if (msg === 'unsubscribe') {
            console.log('Client requested disconnetion from Leap Motion Controller');
            webSocketDisconnection();
        } else if (msg === 'changeSenstivity') {
            setSensitivity(data.type, data.sensitivity);
        } else {
            console.log('Unknown command');
            ws.send('Unknown command: Please use "subscribe", "unsubscribe", or "changeSenstivity".');
        }
    });

    ws.on('close', function (msg) {
        console.log('Server websocket to Leap Motion Controller is closed.');
        ws.close();
    });
});

module.exports = router;
