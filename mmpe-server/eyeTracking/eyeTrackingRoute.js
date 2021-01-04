const router = require('express').Router();
const pty = require('node-pty');
const stripAnsi = require('strip-ansi');

let python;
let lingeringLine = '';

function startPython(ws, eyeTracker) {
    // spawn new child process to call the python script
    console.log('Running python script for receiving eye data');
    let scriptName;
    switch (eyeTracker) {
        case 'Tobii 4C Pro':
            scriptName = './eyeTracking/python/TobiiProIntegration.py';
            break;
        case 'Test':
            scriptName = './eyeTracking/python/test.py';
            break;
        case 'Pupil':
            scriptName = './eyeTracking/python/pupil.py';
            break;
        default:
            console.log('No such eye tracker');
            if (ws.readyState === 1) {
                ws.send('CLOSED: No such eye tracker');
                console.log('Informed client that no such eye tracker exists');
            } else {
                console.log('Could not inform client of non-existing eye tracker, as the ws was dead.');
            }
    }
    python = pty.spawn('python.exe', [scriptName], {handleFlowControl: true});

    // collect data from script
    python.onData(function (data_chunk) {
        if (ws.readyState === 1) {
            data_chunk = stripAnsi(data_chunk); // remove ansi stuff coming from console

            let lines = data_chunk.split('</eos>'); // split after complete json (need to add }}} later)

            if (lines.length > 2) {
                // two options: could send all events, or just ignore as we get many events anyways
                lingeringLine = '';
                return;
            }

            lines[0] = lingeringLine + lines[0];
            lingeringLine = lines.pop();

            for (let line in lines) {
                let actual_event = lines[line] // + '}}}}'; // add the cut off json end again
                                // remove newlines as these destroy the json
                actual_event = actual_event.replace(/(\r\n|\n|\r)/gm, '');
                // replace NaN with null as these destroy the json
                actual_event = actual_event.replace(/NaN/g, 'null');

                while (actual_event.startsWith('X') || /^\s/.test(actual_event)) { // sometimes there is an X or space, no idea why
                    actual_event = actual_event.substring(1); // cut it off
                }

                // Send it
                // console.log('Pipe data from python script ...', actual_event);
                ws.send(actual_event);
            }
        }
    });
    // in exit event we are sure that stream from child process is closed
    python.onExit(() => {
        console.log('Connection to eye tracker closed');
    });
}

function killPython(ws) {
    if (python) {
        try {
            console.log('Closing python eye tracking script');
            python.write('\r');
            python.kill();
            console.log('Finished closing python eye tracking script');
            python = null;
            lingeringLine = '';
        } catch (e) {
            console.log(e);
            python = null;
        }
    }
    // tell the client that we killed it
    if (ws.readyState === 1) {
        ws.send('CLOSED: Connection to eye tracker closed');
        console.log('Informed client of closed connection to eye tracker');
    } else {
        console.log('Could not inform client of closed connection to eye tracker, as the ws was dead.');
    }
}

router.ws('/eyeTracking/getEyeData',
    function(ws, res) {
        console.log('Client connected');

        ws.on('message', function(msg) {
            if (msg.startsWith('subscribe')) {
                let eyeTracker = msg.split(':')[1];
                console.log('Subscribing to eye tracker', eyeTracker);
                startPython(ws, eyeTracker);
            } else if (msg === 'unsubscribe') {
                console.log('Unsubscribing from eye tracker');
                killPython(ws);
            } else {
                console.log('Unknown command');
                ws.send('Unknown command: Please use "subscribe" or "unsubscribe".');
            }
        });

        ws.on('close', function (msg) {
            killPython(ws);
            console.log('Closing Python as websocket was closed');
            ws.close();
        })
    }
);

module.exports = router;
